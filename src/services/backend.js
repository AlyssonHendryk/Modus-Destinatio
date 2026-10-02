const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"


function parseMoney(value) {
  if (typeof value === "number") return value

  if (!value) return 0

  const text = String(value).trim()

  // Formato brasileiro: R$ 1.234,56
  if (text.includes(",")) {
    return (
      Number(
        text
          .replace("R$", "")
          .replace(/\./g, "")
          .replace(",", ".")
          .trim()
      ) || 0
    )
  }

  // Número normal vindo da API: 1234.56
  return Number(text.replace("R$", "").trim()) || 0
}


function toBackendOrder(order) {
  return {
    id: String(order.id),

    supplier:
      order.supplier ||
      order.customer ||
      "",

    operation:
      order.operation ||
      "Venda",

    // O backend/Supabase agora usa os status internos
    status:
      order.status ||
      "waiting",

    date:
      order.date ||
      new Date().toLocaleDateString("pt-BR"),

    // FastAPI espera float
    total: parseMoney(order.total),

    items: (order.items || []).map((item) => ({
      productId: String(
        item.productId ||
        item.id ||
        ""
      ),

      product:
        item.product ||
        item.name ||
        "",

      quantity:
        Number(item.quantity) || 1,

      // FastAPI espera unitPrice: float
      unitPrice: parseMoney(
        item.unitPrice ??
        item.price ??
        0
      ),
    })),
  }
}


function fromBackendOrder(order) {
  return {
    ...order,

    total:
      Number(order.total) || 0,

    items: (order.items || []).map((item) => ({
      ...item,

      id: item.productId,

      unitPrice:
        Number(item.unitPrice) || 0,

      // Mantemos price também para componentes antigos
      // do frontend que ainda utilizem esse campo.
      price:
        Number(item.unitPrice) || 0,
    })),
  }
}


async function request(endpoint, options = {}) {
  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,

      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    }
  )

  if (!response.ok) {
    let message =
      "Erro ao comunicar com o backend."

    try {
      const error = await response.json()

      // FastAPI pode devolver detail como string
      // ou como array no erro 422.
      if (Array.isArray(error.detail)) {
        message = error.detail
          .map((item) => {
            const field =
              item.loc?.join(".") || "campo"

            return `${field}: ${item.msg}`
          })
          .join(" | ")
      } else {
        message =
          error.detail ||
          error.message ||
          message
      }
    } catch {
      // mantém mensagem padrão
    }

    console.error(
      `Backend error ${response.status}:`,
      message
    )

    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}


export async function getOrders() {
  const data =
    await request("/api/orders")

  return data.map(fromBackendOrder)
}


export async function createOrder(order) {
  const payload =
    toBackendOrder(order)

  console.log(
    "Criando pedido:",
    payload
  )

  const data = await request(
    "/api/orders",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  )

  return fromBackendOrder(data)
}


export async function updateOrder(order) {
  const payload =
    toBackendOrder(order)

  const data = await request(
    `/api/orders/${encodeURIComponent(order.id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  )

  return fromBackendOrder(data)
}


export async function removeOrder(id) {
  return request(
    `/api/orders/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  )
}