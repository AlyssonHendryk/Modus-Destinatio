const LEGACY_KEY = "modusdestinatio_state_v1"
const CACHE_PREFIX = "modusdestinatio_operational_v2:"

const record = value => value !== null && typeof value === "object" && !Array.isArray(value)
const fields = (value, schema) => {
  if (!record(value)) return {}
  return Object.fromEntries(Object.entries(schema).filter(([key, type]) =>
    typeof value[key] === type && (type !== "number" || Number.isFinite(value[key]))
  ).map(([key]) => [key, value[key]]))
}

export function projectOrders(value) {
  return (Array.isArray(value) ? value : []).filter(record).map(order => ({
    ...fields(order, {
      id: "string", supplier: "string", customer: "string", operation: "string",
      status: "string", date: "string", stock_applied: "boolean",
    }),
    items: (Array.isArray(order.items) ? order.items : Array.isArray(order.products) ? order.products : [])
      .filter(record).map(item => fields(item, {
        id: "string", productId: "string", product: "string", name: "string", quantity: "number",
      })),
  }))
}

export function projectProducts(value) {
  return (Array.isArray(value) ? value : []).filter(record).map(product => fields(product, {
    id: "string", name: "string", quantity: "number", min: "number", max: "number", active: "boolean",
  }))
}

function projectState(value) {
  return {
    orders: projectOrders(value?.orders), inventory: projectProducts(value?.inventory),
    tasks: (Array.isArray(value?.tasks) ? value.tasks : []).filter(record)
      .map(task => fields(task, { id: "string", title: "string", done: "boolean" })),
  }
}

export function operationalCacheKey(userId, role) {
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}:${role}`
}

function read(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key))
    return record(value) ? value : null
  } catch {
    return null
  }
}

function write(storage, key, value) {
  const serialized = JSON.stringify(value)
  if (storage.getItem(key) !== serialized) storage.setItem(key, serialized)
}

// Only app state caches are touched. Supabase session keys and preferences stay intact.
export function sanitizeAppCaches(...storages) {
  for (const storage of storages) {
    if (!storage) continue
    try {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      for (const key of keys) {
        if (key !== LEGACY_KEY && !key?.startsWith(`${LEGACY_KEY}:`) && !key?.startsWith(CACHE_PREFIX)) continue
        const value = read(storage, key)
        if (!value || key === LEGACY_KEY) {
          // The unscoped legacy cache has no trustworthy owner.
          storage.removeItem(key)
        } else if (key.startsWith(CACHE_PREFIX)) {
          if (value.version !== 2 || typeof value.userId !== "string") storage.removeItem(key)
          else write(storage, key, { version: 2, userId: value.userId, ...projectState(value) })
        } else {
          write(storage, key, projectState(value))
        }
      }
    } catch {
      // Storage may be disabled. No unsanitized cache is used as a fallback.
    }
  }
}

export function loadOperationalCache(storage, userId, role) {
  if (!["admin", "employee"].includes(role)) return null
  sanitizeAppCaches(storage)
  const cached = read(storage, operationalCacheKey(userId, role))
  if (cached) {
    if (cached.version !== 2 || cached.userId !== userId) return null
    return projectState(cached)
  }
  // Migrate only the current user's scoped legacy data, never its identity/role.
  const legacy = read(storage, `${LEGACY_KEY}:${userId}`)
  return legacy ? projectState(legacy) : null
}

export function persistOperationalCache(storage, userId, role, state) {
  if (!["admin", "employee"].includes(role)) return
  try {
    sanitizeAppCaches(storage)
    write(storage, operationalCacheKey(userId, role), {
      version: 2, userId, ...projectState(state),
    })
  } catch {
    // A storage failure must not prevent normal online operation.
  }
}
