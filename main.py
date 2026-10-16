import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from supabase import create_client, Client


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

from pydantic import BaseModel, Field

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

@app.get(
    "/api/orders",
    response_model=List[Order]
)
def get_orders():

    try:

        response = (
            supabase
            .table("orders")
            .select("*, order_items(*)")
            .order(
                "created_at",
                desc=True
            )
            .execute()
        )

        return [
            format_order(order)
            for order in response.data
        ]

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# POST - CRIAR PEDIDO
# ============================================================

@app.post(
    "/api/orders",
    response_model=Order
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

@app.put(
    "/api/orders/{order_id}",
    response_model=Order
)
def update_order(
    order_id: str,
    updated_order: Order
):

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


        order_data = {

            "supplier":
                updated_order.supplier,

            "operation":
                updated_order.operation,

            "status":
                updated_order.status,

            "order_date":
                updated_order.date,

            "total":
                updated_order.total,
        }


        (
            supabase
            .table("orders")
            .update(order_data)
            .eq(
                "id",
                order_id
            )
            .execute()
        )


        # Remove os itens antigos
        (
            supabase
            .table("order_items")
            .delete()
            .eq(
                "order_id",
                order_id
            )
            .execute()
        )


        # Insere os novos itens
        if updated_order.items:

            items_data = []

            for item in updated_order.items:

                items_data.append(
                    {
                        "order_id":
                            order_id,

                        "product_id":
                            item.productId,

                        "product":
                            item.product,

                        "quantity":
                            item.quantity,

                        "unit_price":
                            item.unitPrice,
                    }
                )


            (
                supabase
                .table("order_items")
                .insert(items_data)
                .execute()
            )


        result = (
            get_order_from_database(
                order_id
            )
        )


        if not result:

            raise HTTPException(
                status_code=404,
                detail="Pedido não encontrado."
            )


        return result


    except HTTPException:

        raise


    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# DELETE - EXCLUIR PEDIDO
# ============================================================

@app.delete(
    "/api/orders/{order_id}"
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

@app.patch("/api/products/{product_id}/stock")
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

@app.get("/api/stock-movements")
def get_stock_movements():
    try:
        response = (
            supabase
            .table("stock_movements")
            .select("*")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )

        return response.data

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )
# ============================================================
# GET - LISTAR PRODUTOS
# ============================================================

@app.get("/api/products")
def get_products():
    try:
        response = (
            supabase
            .table("products")
            .select("*")
            .order("name")
            .execute()
        )

        products = []

        for product in response.data:
            products.append({
                "id": product["id"],
                "name": product["name"],
                "quantity": product["quantity"],
                "min": product["min"],
                "max": product["max"],
                "unitPrice": float(product["unit_price"]),
                "active": product["active"]
            })

        return products

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )



    # ============================================================
# POST - CADASTRAR PRODUTO
# ============================================================

@app.post("/api/products", response_model=Product, status_code=201)
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

@app.put("/api/products/{product_id}", response_model=Product)
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

@app.delete("/api/products/{product_id}")
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

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )