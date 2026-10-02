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

class OrderItem(BaseModel):
    productId: str
    product: str
    quantity: int
    unitPrice: float


class Order(BaseModel):
    id: str
    supplier: str
    operation: str
    status: str
    date: str
    total: float
    items: Optional[List[OrderItem]] = []


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

        existing = (
            supabase
            .table("orders")
            .select("id")
            .eq("id", order.id)
            .execute()
        )

        if existing.data:

            raise HTTPException(
                status_code=400,
                detail="ID de pedido já existe."
            )


        order_data = {

            "id":
                order.id,

            "supplier":
                order.supplier,

            "operation":
                order.operation,

            "status":
                order.status,

            "order_date":
                order.date,

            "total":
                order.total,
        }


        (
            supabase
            .table("orders")
            .insert(order_data)
            .execute()
        )


        if order.items:

            items_data = []

            for item in order.items:

                items_data.append(
                    {
                        "order_id":
                            order.id,

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


        created_order = (
            get_order_from_database(
                order.id
            )
        )


        if not created_order:

            raise HTTPException(
                status_code=500,
                detail="Pedido criado, mas não foi possível recuperá-lo."
            )


        return created_order


    except HTTPException:

        raise


    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
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