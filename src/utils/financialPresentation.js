// Presentation only. API authorization remains the security boundary.
export function canViewFinancials(user) {
  return user?.role === "admin" && user.status === "active"
}

export function sumFinancialValues(values) {
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return undefined
  const total = values.reduce((sum, value) => sum + value, 0)
  return Number.isFinite(total) ? total : undefined
}
