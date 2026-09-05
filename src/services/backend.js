/**
 * PONTO CENTRAL DE INTEGRAÇÃO COM O BACKEND PYTHON.
 *
 * Hoje o frontend usa localStorage pelo AppContext para funcionar sem servidor.
 * Quando o backend Python estiver pronto:
 * 1) defina NEXT_PUBLIC_API_URL (ex.: http://localhost:8000/api)
 * 2) substitua as operações locais do AppContext pelas funções abaixo
 * 3) mantenha os mesmos formatos de objeto usados no frontend.
 *
 * Rotas sugeridas no Python/FastAPI:
 * GET/POST        /orders
 * PUT/DELETE      /orders/{id}
 * GET/POST        /products
 * PUT/DELETE      /products/{id}
 * POST            /auth/login
 * POST            /auth/register
 * GET/PUT/DELETE  /users/{id}
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const message = await response.text().catch(() => "")
    throw new Error(message || `Erro HTTP ${response.status}`)
  }

  if (response.status === 204) return null
  return response.json()
}

export const backend = {
  getOrders: () => request("/orders"),
  createOrder: (data) => request("/orders", { method: "POST", body: JSON.stringify(data) }),
  updateOrder: (id, data) => request(`/orders/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteOrder: (id) => request(`/orders/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getProducts: () => request("/products"),
  createProduct: (data) => request("/products", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/products/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${encodeURIComponent(id)}`, { method: "DELETE" }),
  login: (credentials) => request("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
}
