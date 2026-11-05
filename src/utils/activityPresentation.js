export const ACTIVITY_ACTIONS = {
  "order.created": "Pedido criado", "order.updated": "Pedido atualizado", "order.deleted": "Pedido excluído",
  "order.separation_started": "Separação iniciada", "order.separation_completed": "Separação concluída",
  "product.created": "Produto criado", "product.updated": "Produto atualizado", "product.deleted": "Produto excluído",
  "stock.adjusted": "Estoque ajustado", "profile.name_updated": "Nome atualizado",
  "employee.status_updated": "Status do funcionário atualizado",
  "employee.creation_requested": "Criação de conta solicitada", "employee.created": "Conta criada",
  "employee.creation_failed": "Criação de conta não realizada", "employee.creation_outcome_unknown": "Criação de conta pendente de confirmação",
  "employee.deletion_requested": "Exclusão de funcionário solicitada", "employee.deleted": "Funcionário excluído",
  "employee.deletion_failed": "Exclusão de funcionário não realizada", "employee.deletion_outcome_unknown": "Exclusão de funcionário pendente de confirmação",
}

export function activityActorLabel(event, currentUser) {
  const actorName = typeof event?.actor_name === "string" ? event.actor_name.trim() : ""
  if (actorName) return actorName
  if (event?.actor_id === currentUser?.id) return currentUser.name || "Você"
  const role = event?.actor_role === "admin" ? "Administrador" : "Funcionário"
  return `${role} · ${String(event?.actor_id || "").slice(0, 8)}`
}

const fields = {
  name: "Nome", role: "Perfil", supplier: "Fornecedor", customer: "Cliente", operation: "Operação", status: "Status",
  date: "Data", total: "Total", stock_applied: "Estoque aplicado", min: "Mínimo", max: "Máximo",
  unit_price: "Preço unitário", active: "Ativo", quantity: "Quantidade", initial_quantity: "Quantidade inicial",
  item_count: "Itens", delta: "Ajuste", previous_quantity: "Quantidade anterior", new_quantity: "Nova quantidade",
  previous_status: "Status anterior", new_status: "Novo status",
}
const statuses = { active: "Ativo", inactive: "Inativo", waiting: "Aguardando", separating: "Em separação", completed: "Concluído", cancelled: "Cancelado", shipped: "Enviado" }
function valueText(key, value) {
  if (value === null) return "Não informado"
  if (typeof value === "boolean") return value ? "Sim" : "Não"
  if (key === "role") return value === "admin" ? "Administrador" : value === "employee" ? "Funcionário" : "Não informado"
  if (!["string", "number"].includes(typeof value)) return "—"
  if (["status", "previous_status", "new_status"].includes(key)) return statuses[value] || "Não informado"
  if (["total", "unit_price"].includes(key) && Number.isFinite(Number(value))) {
    return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }
  return String(value).slice(0, 160)
}

// Explicit presentation allowlist: never render arbitrary JSON or raw errors.
export function activityDetails(event) {
  if (!ACTIVITY_ACTIONS[event.action]) return []
  const details = event.details || {}
  const lines = []
  for (const [key, label] of Object.entries(fields)) {
    if (Object.hasOwn(details, key)) lines.push(`${label}: ${valueText(key, details[key])}`)
    const change = details.changes?.[key]
    if (change && Object.hasOwn(change, "before") && Object.hasOwn(change, "after")) {
      lines.push(`${label}: ${valueText(key, change.before)} → ${valueText(key, change.after)}`)
    }
  }
  if (Array.isArray(details.item_changes)) {
    const added = details.item_changes.filter(item => item.kind === "added").length
    const removed = details.item_changes.filter(item => item.kind === "removed").length
    lines.push(`Itens incluídos: ${added}; removidos: ${removed}`)
  }
  if (details.compensation_result === "succeeded") lines.push("Cadastro desfeito com confirmação")
  if (details.compensation_result === "not_attempted") lines.push("Reversão não realizada")
  if (details.compensation_result === "unknown") lines.push("Resultado da reversão desconhecido")
  return lines
}

export function activityFilters({ user_id, action, start, end }) {
  const id = user_id.trim()
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Informe um identificador de usuário válido.")
  if (start && end && start > end) throw new Error("A data inicial deve ser anterior ou igual à final.")
  const after = end ? new Date(`${end}T00:00:00`) : null
  if (after) after.setDate(after.getDate() + 1)
  return { user_id: id, action, date_from: start ? new Date(`${start}T00:00:00`).toISOString() : "", date_to: after ? after.toISOString() : "" }
}
