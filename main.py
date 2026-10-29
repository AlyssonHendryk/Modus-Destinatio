import os

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Literal, Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from api_auth import AuthenticatedUser, require_active_user, require_admin
from postgrest.exceptions import APIError
from admin_users import router as admin_users_router


# ============================================================
# CONFIGURAÇÃO
# ============================================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "SUPABASE_URL e SUPABASE_KEY não foram configuradas no arquivo .env"
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


app = FastAPI(
    title="Modus Destinatio - API"
)
app.state.profile_client = supabase
private_api = APIRouter(dependencies=[Depends(require_active_user)])


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SCHEMAS
# ============================================================

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class SeparationAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["start", "confirm"]


class SeparationRpcResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    order_id: str
    status: Literal["separating", "completed"]
    changed: bool


class SeparationResponse(BaseModel):
    orderId: str
    status: Literal["separating", "completed"]
    changed: bool

class OrderItem(BaseModel):
    productId: str
    product: str
    quantity: int = Field(gt=0)
    unitPrice: float = Field(ge=0)



class Order(BaseModel):
    id: str
    supplier: str
    operation: str
    status: str
    date: str
    total: float
    stock_applied: bool = False
    items: List[OrderItem] = Field(default_factory=list)



class Product(BaseModel):
    id: str
    name: str
    quantity: int
    min: int
    max: int
    unitPrice: float
    active: bool = True

class StockMovement(BaseModel):
    delta: int


# Read contracts are independent of the administrative input models above.
class OperationalOrderItemRead(BaseModel):
    model_config = ConfigDict(extra="forbid")
    productId: str
    product: str
    quantity: int


class AdminOrderItemRead(OperationalOrderItemRead):
    unitPrice: float


class OperationalOrderRead(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    supplier: str
    operation: str
    status: str
    date: str
    items: List[OperationalOrderItemRead]


class AdminOrderRead(OperationalOrderRead):
    total: float
    stock_applied: bool = False
    items: List[AdminOrderItemRead]


class OperationalProductRead(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str
    quantity: int
    min: int
    max: int
    active: bool


class AdminProductRead(OperationalProductRead):
    unitPrice: float


STOCK_MOVEMENT_FIELDS = (
    "id", "product_id", "delta", "previous_quantity", "new_quantity", "created_at",
)


class StockMovementRead(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str | int
    product_id: str
    delta: int
    previous_quantity: int
    new_quantity: int
    created_at: str

# ============================================================
# FUNÇÕES AUXILIARES
# ============================================================


def format_order(row):

    items = []

    for item in row.get("order_items", []):

        items.append(
            {
                "productId": item["product_id"],
                "product": item["product"],
                "quantity": item["quantity"],
                "unitPrice": float(item["unit_price"]),
            }
        )

    return {
        "id": row["id"],
        "supplier": row["supplier"],
        "operation": row["operation"],
        "status": row["status"],
        "date": row["order_date"],
        "total": float(row["total"]),
        "stock_applied": row.get("stock_applied", False),
        "items": items,
    }


def get_order_from_database(order_id: str):

    response = (
        supabase
        .table("orders")
        .select("*, order_items(*)")
        .eq("id", order_id)
        .execute()
    )

    if not response.data:
        return None

    return format_order(
        response.data[0]
    )


# ============================================================
# GET - LISTAR PEDIDOS
# ============================================================

@private_api.get(
    "/api/orders",
    response_model=List[AdminOrderRead | OperationalOrderRead]
)
def get_orders(user: AuthenticatedUser = Depends(require_active_user)):

    try:

        columns = "id,supplier,operation,status,order_date"
        if user.role == "admin":
            columns += ",total,stock_applied,order_items(product_id,product,quantity,unit_price)"
        else:
            columns += ",order_items(product_id,product,quantity)"

        response = (
            supabase
            .table("orders")
            .select(columns)
            .order(
                "created_at",
                desc=True
            )
            .execute()
        )

        if user.role == "admin":
            return [AdminOrderRead(**format_order(row)) for row in response.data]

        return [OperationalOrderRead(
            id=row["id"], supplier=row["supplier"], operation=row["operation"],
            status=row["status"], date=row["order_date"],
            items=[OperationalOrderItemRead(
                productId=item["product_id"], product=item["product"], quantity=item["quantity"],
            ) for item in row.get("order_items", [])],
        ) for row in response.data]

    except Exception:
        raise HTTPException(500, "Não foi possível consultar os pedidos.") from None

# ============================================================
# POST - CRIAR PEDIDO
# ============================================================

@private_api.post(
    "/api/orders",
    response_model=Order,
    dependencies=[Depends(require_admin)],
)

def create_order(order: Order):
    try:
        # Prepara os itens no formato esperado pela função SQL
        items_data = [
            {
                "productId": item.productId,
                "product": item.product,
                "quantity": item.quantity,
                "unitPrice": item.unitPrice,
            }
            for item in (order.items or [])
        ]

        # Cria o pedido e movimenta o estoque em uma transação
        supabase.rpc(
            "create_order_with_stock",
            {
                "p_order_id": order.id,
                "p_supplier": order.supplier,
                "p_operation": order.operation,
                "p_status": order.status,
                "p_order_date": order.date,
                "p_total": order.total,
                "p_items": items_data,
            },
        ).execute()

        # Recupera o pedido recém-criado
        created_order = get_order_from_database(order.id)

        if not created_order:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Pedido criado, mas não foi possível "
                    "recuperá-lo."
                ),
            )

        return created_order

    except HTTPException:
        raise

    except Exception as error:
        error_message = str(error)

        print(
            "Erro ao criar pedido e movimentar estoque:",
            error_message,
        )

        if (
            "Estoque insuficiente" in error_message
            or "Produto não encontrado" in error_message
        ):
            raise HTTPException(
                status_code=409,
                detail="Estoque insuficiente ou produto não encontrado.",
            )

        if (
            "ID de pedido já existe" in error_message
            or "Operação inválida" in error_message
            or "quantidade inválida" in error_message.lower()
            or "Lista de itens inválida" in error_message
            or "pelo menos um item" in error_message
            or "pedido cancelado" in error_message
        ):
            raise HTTPException(
                status_code=400,
                detail=error_message,
            )

        raise HTTPException(
            status_code=500,
            detail="Erro interno ao criar o pedido.",
        )

# ============================================================
# PUT - ATUALIZAR PEDIDO
# ============================================================

@private_api.put(
    "/api/orders/{order_id}",
    response_model=Order,
    dependencies=[Depends(require_admin)],
)

def update_order(order_id: str, updated_order: Order):
    try:
        # Garante que o ID do pedido não seja alterado
        if updated_order.id != order_id:
            raise HTTPException(
                status_code=400,
                detail="O ID do pedido não corresponde ao ID da URL."
            )

        # Prepara os itens para a função PostgreSQL
        items_data = [
            {
                "productId": item.productId,
                "product": item.product,
                "quantity": item.quantity,
                "unitPrice": item.unitPrice,
            }
            for item in (updated_order.items or [])
        ]

        # Atualiza o pedido e ajusta o estoque
        # em uma única transação PostgreSQL
        supabase.rpc(
            "update_order_with_stock",
            {
                "p_order_id": order_id,
                "p_supplier": updated_order.supplier,
                "p_operation": updated_order.operation,
                "p_status": updated_order.status,
                "p_order_date": updated_order.date,
                "p_total": updated_order.total,
                "p_items": items_data,
            },
        ).execute()

        # Recupera o pedido atualizado
        result = get_order_from_database(order_id)

        if not result:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Pedido atualizado, mas não foi possível "
                    "recuperá-lo."
                ),
            )

        return result

    except HTTPException:
        raise

    except Exception as error:
        error_message = str(error)

        print(
            "Erro ao atualizar pedido:",
            error_message,
        )

        if "Pedido não encontrado" in error_message:
            raise HTTPException(
                status_code=404,
                detail="Pedido não encontrado.",
            )

        if (
            "Estoque insuficiente" in error_message
            or "Produto não encontrado" in error_message
        ):
            raise HTTPException(
                status_code=409,
                detail="Estoque insuficiente ou produto não encontrado.",
            )

        if (
            "Pedido cancelado" in error_message
            or "Pedido sem movimentação" in error_message
            or "Operação inválida" in error_message
            or "Status inválido" in error_message
            or "itens válidos" in error_message
            or "Item do pedido inválido" in error_message
            or "Operação original inválida" in error_message
            or "Ajuste de estoque fora do limite" in error_message
        ):
            raise HTTPException(
                status_code=400,
                detail=error_message,
            )

        raise HTTPException(
            status_code=500,
            detail="Erro interno ao atualizar o pedido.",
        )

# ============================================================
# PATCH - SEPARAÇÃO DE PEDIDO (SEM MOVIMENTAÇÃO DE ESTOQUE)
# ============================================================

@private_api.patch("/api/orders/{order_id}/separation", response_model=SeparationResponse)
def transition_order_separation(order_id: str, action: SeparationAction):
    try:
        response = supabase.rpc(
            "transition_order_separation",
            {"p_order_id": order_id, "p_action": action.action},
        ).execute()
    except APIError as error:
        errors = {
            "P2001": (422, "Solicitação de separação inválida."),
            "P2002": (404, "Pedido não encontrado."),
            "P2003": (409, "Pedido sem estoque aplicado para separação."),
            "P2004": (409, "Transição de separação não permitida."),
            "P2005": (500, "Não foi possível atualizar a separação."),
        }
        status, message = errors.get(str(error.code), (500, "Erro interno ao separar pedido."))
        raise HTTPException(status_code=status, detail=message) from None
    except Exception:
        raise HTTPException(500, "Não foi possível executar a separação.") from None

    try:
        rows = response.data
        if not isinstance(rows, list) or len(rows) != 1:
            raise ValueError()
        result = SeparationRpcResult.model_validate(rows[0])
        expected_status = "separating" if action.action == "start" else "completed"
        if result.order_id != order_id or result.status != expected_status:
            raise ValueError()
    except (ValidationError, ValueError, TypeError, AttributeError):
        raise HTTPException(502, "Resposta inválida do serviço de separação.") from None

    return SeparationResponse(orderId=result.order_id, status=result.status, changed=result.changed)


# ============================================================
# DELETE - EXCLUIR PEDIDO
# ============================================================

@private_api.delete(
    "/api/orders/{order_id}",
    dependencies=[Depends(require_admin)],
)
def delete_order(order_id: str):

    try:

        existing = (
            supabase
            .table("orders")
            .select("id")
            .eq("id", order_id)
            .execute()
        )


        if not existing.data:

            raise HTTPException(
                status_code=404,
                detail="Pedido não encontrado."
            )


        (
            supabase
            .table("orders")
            .delete()
            .eq(
                "id",
                order_id
            )
            .execute()
        )


        return {
            "message":
                f"Pedido {order_id} deletado com sucesso."
        }


    except HTTPException:

        raise


    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )
    # ============================================================
# PATCH - MOVIMENTAÇÃO DE ESTOQUE
# ============================================================

@private_api.patch("/api/products/{product_id}/stock", dependencies=[Depends(require_admin)])
def move_product_stock(product_id: str, movement: StockMovement):
    try:
        response = supabase.rpc(
            "move_product_stock",
            {
                "p_product_id": product_id,
                "p_delta": movement.delta
            }
        ).execute()

        return {
            "productId": product_id,
            "delta": movement.delta,
            "newQuantity": response.data,
            "message": "Estoque atualizado com sucesso."
        }

    except Exception as error:
        error_message = str(error)

        if "Produto não encontrado" in error_message:
            raise HTTPException(
                status_code=404,
                detail="Produto não encontrado."
            )

        if "Estoque insuficiente" in error_message:
            raise HTTPException(
                status_code=422,
                detail="Estoque insuficiente ou quantidade inválida."
            )

        raise HTTPException(
            status_code=500,
            detail=error_message
        )
    # ============================================================
# GET - HISTÓRICO DE MOVIMENTAÇÕES DE ESTOQUE
# ============================================================

@private_api.get("/api/stock-movements", response_model=List[StockMovementRead])
def get_stock_movements():
    try:
        response = (
            supabase
            .table("stock_movements")
            .select(",".join(STOCK_MOVEMENT_FIELDS))
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )

        return [StockMovementRead(**{field: row[field] for field in STOCK_MOVEMENT_FIELDS})
                for row in response.data]

    except Exception:
        raise HTTPException(500, "Não foi possível consultar as movimentações.") from None
# ============================================================
# GET - LISTAR PRODUTOS
# ============================================================

@private_api.get("/api/products", response_model=List[AdminProductRead | OperationalProductRead])
def get_products(user: AuthenticatedUser = Depends(require_active_user)):
    try:
        columns = "id,name,quantity,min,max,active"
        if user.role == "admin":
            columns += ",unit_price"
        response = (
            supabase
            .table("products")
            .select(columns)
            .order("name")
            .execute()
        )

        products = []

        for product in response.data:
            fields = {
                "id": product["id"],
                "name": product["name"],
                "quantity": product["quantity"],
                "min": product["min"],
                "max": product["max"],
                "active": product["active"]
            }
            if user.role == "admin":
                products.append(AdminProductRead(**fields, unitPrice=float(product["unit_price"])))
            else:
                products.append(OperationalProductRead(**fields))

        return products

    except Exception:
        raise HTTPException(500, "Não foi possível consultar os produtos.") from None



    # ============================================================
# POST - CADASTRAR PRODUTO
# ============================================================

@private_api.post("/api/products", response_model=Product, status_code=201, dependencies=[Depends(require_admin)])
def create_product(product: Product):
    if (
        not product.id.strip()
        or not product.name.strip()
        or product.quantity < 0
        or product.min < 0
        or product.max < 1
        or product.min > product.max
        or product.unitPrice < 0
    ):
        raise HTTPException(
            status_code=422,
            detail="Dados do produto inválidos."
        )

    try:
        response = (
            supabase
            .rpc(
                "create_product_with_stock",
                {
                    "p_id": product.id,
                    "p_name": product.name,
                    "p_quantity": product.quantity,
                    "p_min": product.min,
                    "p_max": product.max,
                    "p_unit_price": product.unitPrice,
                    "p_active": product.active
                }
            )
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="O cadastro não retornou o produto criado."
            )

        saved = response.data[0]

        return {
            "id": saved["id"],
            "name": saved["name"],
            "quantity": saved["quantity"],
            "min": saved["min"],
            "max": saved["max"],
            "unitPrice": float(saved["unit_price"]),
            "active": saved["active"]
        }

    except HTTPException:
        raise

    except Exception as error:
        # Produto com ID já cadastrado
        if "23505" in str(error):
            raise HTTPException(
                status_code=409,
                detail="Já existe um produto com este ID."
            )

        raise HTTPException(
            status_code=500,
            detail="Erro interno ao cadastrar produto."
        )
    # ============================================================
# PUT - ATUALIZAR PRODUTO
# ============================================================

@private_api.put("/api/products/{product_id}", response_model=Product, dependencies=[Depends(require_admin)])
def update_product(product_id: str, product: Product):
    if product.id != product_id:
        raise HTTPException(
            status_code=400,
            detail="O ID do produto não corresponde ao ID da URL."
        )

    if (
        product.quantity < 0
        or product.min < 0
        or product.max < 1
        or product.min > product.max
        or product.unitPrice < 0
    ):
        raise HTTPException(
            status_code=422,
            detail="Quantidade, limites ou preço inválidos."
        )

    try:
        existing = (
            supabase
            .table("products")
            .select("id")
            .eq("id", product_id)
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="Produto não encontrado."
            )

        # A quantidade não pode ser modificada por esta rota.
        # Movimentações de estoque devem utilizar a função
        # move_product_stock, que registra o histórico.
        product_data = {
            "name": product.name,
            "min": product.min,
            "max": product.max,
            "unit_price": product.unitPrice,
            "active": product.active
        }

        response = (
            supabase
            .table("products")
            .update(product_data)
            .eq("id", product_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Produto não encontrado após atualização."
            )

        saved = response.data[0]

        return {
            "id": saved["id"],
            "name": saved["name"],
            "quantity": saved["quantity"],
            "min": saved["min"],
            "max": saved["max"],
            "unitPrice": float(saved["unit_price"]),
            "active": saved["active"]
        }

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Erro interno ao atualizar produto."
        )

  # ============================================================
# DELETE - EXCLUIR PRODUTO
# ============================================================

@private_api.delete("/api/products/{product_id}", dependencies=[Depends(require_admin)])
def delete_product(product_id: str):
    try:
        # Verifica se o produto existe
        existing = (
            supabase
            .table("products")
            .select("id")
            .eq("id", product_id)
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="Produto não encontrado."
            )

        # Verifica se o produto está vinculado a pedidos
        linked_orders = (
            supabase
            .table("order_items")
            .select("product_id")
            .eq("product_id", product_id)
            .limit(1)
            .execute()
        )

        if linked_orders.data:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Não é possível excluir este produto, "
                    "pois ele possui pedidos vinculados."
                )
            )

        # Solicita a exclusão
        supabase.table("products") \
            .delete() \
            .eq("id", product_id) \
            .execute()

        return {
            "message": f"Produto {product_id} excluído com sucesso."
        }

    except HTTPException:
        raise

    except Exception as error:
        # A chave estrangeira também protege contra
        # vínculos criados entre a consulta e a exclusão.
        error_message = str(error)

        if "23503" in error_message:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Não é possível excluir este produto, "
                    "pois existem registros vinculados."
                )
            )

        raise HTTPException(
            status_code=500,
            detail="Erro interno ao excluir produto."
        )

# ============================================================
# TESTE DA API
# ============================================================

@app.get("/api/health")
def health():

    return {
        "status": "online",
        "database": "supabase"
    }


# ============================================================
# EXECUÇÃO
# ============================================================

app.include_router(private_api)
app.include_router(admin_users_router)

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )
