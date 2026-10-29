import { supabase } from "../lib/supabase"
import { parseCurrency } from "../utils/formatters.js"

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
  const { total: rawTotal, ...fields } = order
  const total = parseCurrency(rawTotal)
  return {
    ...fields,
    ...(total === undefined ? {} : { total }),
    items: (order.items || []).map((item) => {
      const { unitPrice: rawPrice, price: legacyPrice, ...operational } = item
      const unitPrice = parseCurrency(rawPrice ?? legacyPrice)
      return {
        ...operational,
        id: item.productId,
        // Legacy alias is created only when a valid price actually exists.
        ...(unitPrice === undefined ? {} : { unitPrice, price: unitPrice }),
      }
    }),
  }
}


async function request(endpoint, options = {}) {
  // getSession refreshes an expired session through the existing Supabase client.
  const { data, error } = await supabase.auth.getSession()
  const accessToken = data?.session?.access_token
  if (error || !accessToken) {
    const sessionError = new Error("Sessão ausente ou expirada. Entre novamente.")
    sessionError.status = 401
    throw sessionError
  }
  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,

      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
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

    const requestError = new Error(message)
    requestError.status = response.status
    throw requestError
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


export async function transitionOrderSeparation(orderId, action) {
  if (!["start", "confirm"].includes(action)) {
    throw new Error("Ação de separação inválida.")
  }
  // Operational response: do not normalize it as a complete financial order.
  return request(`/api/orders/${encodeURIComponent(orderId)}/separation`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  })
}

// ============================================================
// ADMINISTRAÇÃO - CADASTRO DE FUNCIONÁRIO
// ============================================================

export async function createEmployee({ name, email, password }) {
  return request("/api/admin/users", {
    method: "POST",
    // The API fixes role and status. Keep the password only in this request body.
    body: JSON.stringify({ name, email, password }),
  })
}

export async function getAdminUsers(page = 1, perPage = 25) {
  const query = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  const data = await request(`/api/admin/users?${query.toString()}`)

  if (!data || !Array.isArray(data.users) || !Number.isInteger(data.page) ||
      !Number.isInteger(data.per_page) || !Number.isInteger(data.total)) {
    throw new Error("O backend retornou uma lista de usuários inválida.")
  }

  // Keep only the directory fields explicitly exposed by the API.
  return {
    users: data.users.map(({ id, name, email, role, status, created_at }) => ({
      id, name, email, role, status, created_at,
    })),
    page: data.page,
    per_page: data.per_page,
    total: data.total,
  }
}

// ============================================================
// PRODUTOS - CONSULTAR ESTOQUE
// ============================================================

export async function getProducts() {
  const data = await request("/api/products")

  if (!Array.isArray(data)) {
    throw new Error(
      "O backend retornou um formato inválido para os produtos."
    )
  }

  return data.map((product) => {
    const unitPrice = parseCurrency(product.unitPrice)
    return {
    id: product.id,
    name: product.name,
    quantity: Number(product.quantity),
    min: Number(product.min),
    max: Number(product.max),
    ...(unitPrice === undefined ? {} : { unitPrice }),
    active: product.active,
    }
  })
}
// ============================================================
// PRODUTOS - CADASTRAR
// ============================================================

export async function createProduct(product) {
  return request("/api/products", {
    method: "POST",
    body: JSON.stringify({
      id: String(product.id),
      name: product.name,
      quantity: Number(product.quantity),
      min: Number(product.min),
      max: Number(product.max),
      unitPrice: Number(product.unitPrice),
      active: product.active !== false,
    }),
  })
}

// ============================================================
// PRODUTOS - ATUALIZAR
// ============================================================

export async function updateProduct(product) {
  return request(
    `/api/products/${encodeURIComponent(product.id)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        id: String(product.id),
        name: product.name,
        quantity: Number(product.quantity),
        min: Number(product.min),
        max: Number(product.max),
        unitPrice: Number(product.unitPrice),
        active: product.active !== false,
      }),
    }
  )
}
// ============================================================
// PRODUTOS - MOVIMENTAÇÃO DE ESTOQUE
// ============================================================

export async function moveProductStock(productId, delta) {
  return request(
    `/api/products/${encodeURIComponent(productId)}/stock`,
    {
      method: "PATCH",
      body: JSON.stringify({
        delta: Number(delta),
      }),
    }
  )
}
// ============================================================
// PRODUTOS - EXCLUSÃO
// ============================================================

export async function removeProduct(productId) {
  return request(
    `/api/products/${encodeURIComponent(productId)}`,
    {
      method: "DELETE",
    }
  )
}

// ============================================================
// ESTOQUE - HISTÓRICO DE MOVIMENTAÇÕES
// ============================================================

export async function getStockMovements() {
  return request("/api/stock-movements")
}
