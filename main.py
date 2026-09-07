from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

app = FastAPI(title="Modus Destinatio - API de Pedidos")

# Configuração do CORS para permitir que o Next.js (Porta 3000) acesse o Python (Porta 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos de Dados (Schemas)
class OrderItem(BaseModel):
    productId: str
    product: str
    quantity: int
    price: str

class Order(BaseModel):
    id: str
    supplier: str
    operation: str
    status: str
    date: str
    total: str
    items: Optional[List[OrderItem]] = []

# Banco de dados simulado em memória inicializado com seus dados originais
orders_db: List[Order] = [
    Order(
        id="#1025", supplier="Coca Cola", operation="Venda", status="Concluído", date="14/03/24", total="R$ 350,00",
        items=[
            OrderItem(productId="152", product="Coca Cola Lata", quantity=150, price="R$ 2,00"),
            OrderItem(productId="153", product="Coca Cola 2L", quantity=80, price="R$ 6,50"),
            OrderItem(productId="154", product="Sprite Lata", quantity=100, price="R$ 1,80")
        ]
    ),
    Order(id="#1024", supplier="Nestlé", operation="Compra", status="Em rota", date="14/03/24", total="R$ 1.250,00", items=[]),
    Order(id="#1023", supplier="Ambev", operation="Venda", status="Aguardando", date="13/03/24", total="R$ 890,00", items=[]),
    Order(id="#1022", supplier="Unilever", operation="Compra", status="Cancelado", date="13/03/24", total="R$ 450,00", items=[]),
    Order(id="#1021", supplier="Garoto", operation="Venda", status="Concluído", date="12/03/24", total="R$ 720,00", items=[])
]

# --- ROTAS DO CRUD ---

@app.get("/api/orders", response_model=List[Order])
def get_orders():
    return orders_db

@app.post("/api/orders", response_model=Order)
def create_order(order: Order):
    # Verifica se ID já existe
    if any(o.id == order.id for o in orders_db):
        raise HTTPException(status_code=400, detail="ID de pedido já existe.")
    orders_db.insert(0, order) # Adiciona no topo da lista
    return order

@app.put("/api/orders/{order_id}", response_model=Order)
def update_order(order_id: str, updated_order: Order):
    for index, order in enumerate(orders_db):
        if order.id == order_id:
            orders_db[index] = updated_order
            return updated_order
    raise HTTPException(status_code=404, detail="Pedido não encontrado.")

@app.delete("/api/orders/{order_id}")
def delete_order(order_id: str):
    for index, order in enumerate(orders_db):
        if order.id == order_id:
            orders_db.pop(index)
            return {"message": f"Pedido {order_id} deletado com sucesso."}
    raise HTTPException(status_code=404, detail="Pedido não encontrado.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)