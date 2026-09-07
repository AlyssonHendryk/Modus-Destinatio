const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

const statusToBackend = {
  waiting: "Aguardando",
  separating: "Em separação",
  shipped: "Em rota",
  completed: "Concluído",
  cancelled: "Cancelado",
}

const statusFromBackend = {
  Aguardando: "waiting",
  "Em separação": "separating",
  "Em rota": "shipped",
  Concluído: "completed",
  Cancelado: "cancelled",
}

function parseMoney(value) {
  if (typeof value === "number") return value

  if (!value) return 0

  return Number(
    String(value)
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function toBackendOrder(order) {
  return {
    id: order.id,
    supplier: order.supplier || order.customer || "",
    operation: order.operation || "Venda",

    status:
      statusToBackend[order.status] ||
      order.status ||
      "Aguardando",

    date: order.date || new Date().toLocaleDateString("pt-BR"),

    total: formatMoney(order.total),

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

      quantity: Number(item.quantity) || 1,

      price: formatMoney(
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

    status:
      statusFromBackend[order.status] ||
      order.status,

    total: parseMoney(order.total),

    items: (order.items || []).map((item) => ({
      ...item,

      id: item.productId,

      unitPrice: parseMoney(item.price),

      price: parseMoney(item.price),
    })),
  }
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = "Erro ao comunicar com o backend."

    try {
      const error = await response.json()

      message =
        error.detail ||
        error.message ||
        message
    } catch {
      // mantém mensagem padrão
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export async function getOrders() {
  const data = await request("/api/orders")

  return data.map(fromBackendOrder)
}

export async function createOrder(order) {
  const data = await request("/api/orders", {
    method: "POST",
    body: JSON.stringify(
      toBackendOrder(order)
    ),
  })

  return fromBackendOrder(data)
}

export async function updateOrder(order) {
  const data = await request(
    `/api/orders/${encodeURIComponent(order.id)}`,
    {
      method: "PUT",

      body: JSON.stringify(
        toBackendOrder(order)
      ),
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