"use client"
import { supabase } from "@/lib/supabase"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  initialTasks,
} from "@/data/mockData"

import { normalizeOrder, parseCurrency } from "@/utils/formatters"
import {
  loadOperationalCache, persistOperationalCache, sanitizeAppCaches,
  projectOrders, projectProducts,
} from "@/utils/operationalCache"

import {
  getOrders,
  createOrder,
  updateOrder,
  transitionOrderSeparation,
  removeOrder,
  getProducts,
  createProduct,
  updateProduct,
  moveProductStock,
  removeProduct,
  getStockMovements,
} from "@/services/backend"

const AppContext = createContext(null)

export function AppProvider({ children }) {

  const [hydrated, setHydrated] =
    useState(false)

  const [orders, setOrders] =
    useState([])

  const [inventory, setInventory] =
    useState([])

  const [users, setUsers] =
    useState([])

  const [tasks, setTasks] =
    useState([])

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState(null)
  const [
    authUser,
    setAuthUser,
  ] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [backendError, setBackendError] = useState(null)
  const [stockMovements, setStockMovements] = useState([])
  const authVersion = useRef(0)
  const dataVersion = useRef(0)
  const authenticatedId = useRef(null)
  const authenticatedRole = useRef(null)
  const profileValidating = useRef(true)
  const loginPending = useRef(false)

  const applyAuthUser = useCallback((user) => {
    if (authenticatedId.current !== (user?.id ?? null) ||
        authenticatedRole.current !== (user?.role ?? null) || !user) {
      // Invalidate pending reads/mutations before React renders the new session.
      dataVersion.current += 1
      authenticatedId.current = user?.id ?? null
      authenticatedRole.current = user?.role ?? null
      setOrders([])
      setInventory([])
      setStockMovements([])
      setUsers([])
      setTasks([])
      setCurrentUserId(null)
      setBackendError(null)
      setOrdersLoading(false)
      setHydrated(false)
    }
    profileValidating.current = false
    setAuthUser(user)
    setAuthLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    let timer
    // Sanitize all known app copies before any cache can be restored.
    try { sanitizeAppCaches(window.localStorage || localStorage, window.sessionStorage) } catch { /* storage unavailable */ }

    function validateProfile(expectedId) {
      if (!active || loginPending.current) return
      const version = ++authVersion.current
      clearTimeout(timer)
      if (expectedId !== authenticatedId.current) {
        applyAuthUser(null)
      }
      profileValidating.current = true
      setAuthLoading(true)
      // Keep the auth callback synchronous: SDK calls run outside its lock.
      timer = setTimeout(async () => {
        const isCurrent = () => active && version === authVersion.current
        try {
          const { data, error } = await supabase.auth.getUser()
          if (!isCurrent()) return
          if (error || !data.user || data.user.id !== expectedId) {
            applyAuthUser(null)
            return
          }
          const { data: profile, error: profileError } = await supabase
            .from("profiles").select("name, role, status").eq("id", data.user.id).single()
          if (!isCurrent()) return
          if (profileError || profile?.status !== "active" ||
              !["admin", "employee"].includes(profile.role)) {
            applyAuthUser(null)
            return
          }
          applyAuthUser({
            id: data.user.id, email: data.user.email, name: profile.name,
            role: profile.role, type: profile.role, status: profile.status,
          })
        } catch {
          if (isCurrent()) applyAuthUser(null)
        }
      }, 0)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || (loginPending.current && event !== "SIGNED_OUT")) return
      if (!session) {
        authVersion.current += 1
        clearTimeout(timer)
        applyAuthUser(null)
      } else {
        validateProfile(session.user.id)
      }
    })
    // Database role changes don't themselves emit an Auth event. Recheck on focus.
    const onFocus = () => {
      try { sanitizeAppCaches(window.localStorage || localStorage, window.sessionStorage) } catch { /* storage unavailable */ }
      if (authenticatedId.current) validateProfile(authenticatedId.current)
    }
    const onStorage = () => {
      try { sanitizeAppCaches(window.localStorage || localStorage, window.sessionStorage) } catch { /* storage unavailable */ }
    }
    window.addEventListener("focus", onFocus)
    window.addEventListener("storage", onStorage)
    return () => {
      active = false
      authVersion.current += 1
      dataVersion.current += 1
      clearTimeout(timer)
      subscription.unsubscribe()
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("storage", onStorage)
    }
  }, [applyAuthUser])
  function isCurrentSession(version) {
    return version === dataVersion.current && Boolean(authenticatedId.current) &&
      authUser?.id === authenticatedId.current && authUser?.role === authenticatedRole.current
  }

  function captureSession() {
    const version = dataVersion.current
    if (profileValidating.current || !isCurrentSession(version)) throw new Error("Sessão alterada. Entre novamente.")
    return version
  }

  async function loadStockMovements() {
    const version = captureSession()
    try {
      const movements = await getStockMovements()

      if (isCurrentSession(version)) setStockMovements(movements)

      return movements
    } catch (error) {
      console.error(
        "Erro ao carregar histórico de movimentações:",
        error
      )

      throw error
    }
  }

  /*
   * ========================================
   * INICIALIZAÇÃO DO SISTEMA
   * ========================================
   *
   * Dados privados só são carregados após validar sessão e perfil.
   * O cache é separado por usuário; o cache legado não é reutilizado.
   */

  useEffect(() => {
    if (!authUser?.id || authUser.status !== "active") return
    const userId = authUser.id
    const role = authUser.role
    const version = dataVersion.current
    let active = true
    const isCurrent = () => active && version === dataVersion.current &&
      userId === authenticatedId.current && role === authenticatedRole.current
    async function initialize() {
      if (!isCurrent()) return
      setOrdersLoading(true)
      setHydrated(false)
      let saved = null
      try { saved = loadOperationalCache(localStorage, userId, role) } catch { /* storage unavailable */ }
      const results = await Promise.allSettled([
        getProducts(), getOrders(), getStockMovements(),
      ])
      if (!isCurrent()) return
      const failures = results.filter((result) => result.status === "rejected")
      const denied = failures.find(({ reason }) => [401, 403].includes(reason.status))
      if (denied) {
        // Authentication/authorization errors never restore private cached data.
        setOrders([])
        setInventory([])
        setStockMovements([])
        setUsers([])
        setTasks([])
        setBackendError(denied.reason.message)
        setOrdersLoading(false)
        return
      }
      const [productsResult, ordersResult, movementsResult] = results
      setInventory(productsResult.status === "fulfilled"
        ? role === "admin" ? productsResult.value : projectProducts(productsResult.value)
        : saved?.inventory || [])
      const loadedOrders = ordersResult.status === "fulfilled"
        ? role === "admin" ? ordersResult.value : projectOrders(ordersResult.value)
        : saved?.orders || []
      setOrders(loadedOrders.map(normalizeOrder))
      setStockMovements(movementsResult.status === "fulfilled" ? movementsResult.value : [])
      // There is no users-list API yet. Do not present local seed data as
      // Supabase accounts while administrative provisioning is being added.
      setUsers([])
      setTasks(saved?.tasks || initialTasks)
      setBackendError(failures[0]?.reason.message || null)
      setOrdersLoading(false)
      setHydrated(true)
    }
    // Defer so Strict Mode's setup/cleanup replay doesn't duplicate requests.
    const timer = setTimeout(initialize, 0)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [authUser?.id, authUser?.role, authUser?.status])


  /*
   * ========================================
   * CACHE LOCAL
   * ========================================
   *
   * O backend é a fonte principal
   * dos pedidos.
   *
   * localStorage continua sendo usado como
   * cache e para os módulos ainda sem API.
   */

  useEffect(() => {

    if (!hydrated || authLoading || !authUser?.id ||
        authenticatedId.current !== authUser.id || authenticatedRole.current !== authUser.role) {
      return
    }

    try {
      persistOperationalCache(localStorage, authUser.id, authUser.role, { orders, inventory, tasks })
    } catch { /* storage unavailable */ }

  }, [
    orders,
    inventory,
    tasks,
    hydrated,
    authLoading,
    authUser?.id,
    authUser?.role,
  ])


  const currentUser = authUser


  /*
   * ========================================
   * PEDIDOS
   * ========================================
   */


  /*
   * Cria ou atualiza um pedido.
   *
   * BACKEND:
   *
   * POST /api/orders
   *
   * ou
   *
   * PUT /api/orders/{id}
   */


  async function saveOrder(data) {
    const version = captureSession()
    const normalized = normalizeOrder(data)
    // Operational offline cache is never a source of administrative prices.
    if (parseCurrency(normalized.total) === undefined ||
        normalized.items.some(item => parseCurrency(item.unitPrice) === undefined)) {
      throw new Error("Atualize os dados ou informe preços e total válidos antes de salvar o pedido.")
    }

    const exists = orders.some(
      (order) => order.id === normalized.id
    )

    try {
      let savedOrder

      // 1. Cria ou atualiza o pedido no FastAPI
      if (exists) {
        savedOrder = await updateOrder(normalized)
      } else {
        savedOrder = await createOrder(normalized)
      }

      const finalOrder = normalizeOrder(savedOrder)
      if (!isCurrentSession(version)) return finalOrder

      // 2. Atualiza a lista de pedidos
      setOrders((current) => {
        const alreadyExists = current.some(
          (order) => order.id === finalOrder.id
        )

        if (alreadyExists) {
          return current.map((order) =>
            order.id === finalOrder.id
              ? finalOrder
              : order
          )
        }

        return [finalOrder, ...current]
      })

      setBackendError(null)

      // 3. Recarrega os produtos e o histórico após salvar
      try {

        const updatedProducts = await getProducts()
        if (!isCurrentSession(version)) return finalOrder

        setInventory(updatedProducts)

        await loadStockMovements()

      } catch (refreshError) {
        console.error(
          "Pedido salvo, mas não foi possível atualizar o estoque ou o histórico:",
          refreshError
        )
      }

      return finalOrder
    } catch (error) {
      console.error(
        "Erro ao salvar pedido:",
        error
      )

      if (isCurrentSession(version)) setBackendError(error.message)

      throw error
    }
  }

  /*
   * DELETE /api/orders/{id}
   */

  async function deleteOrder(id) {
    const version = captureSession()
    try {

      await removeOrder(id)
      if (!isCurrentSession(version)) return

      setOrders(
        (current) =>
          current.filter(
            (order) =>
              order.id !== id
          )
      )

      setBackendError(null)

    } catch (error) {

      console.error(
        "Erro ao excluir pedido:",
        error
      )

      if (isCurrentSession(version)) setBackendError(
        error.message
      )

      throw error
    }
  }


  /*
   * Mudança de status utilizada,
   * principalmente, pela tela de
   * separação.
   *
   * Utiliza o PATCH exclusivo de separação, enviando somente a ação.
   */

  async function updateOrderStatus(
    id,
    action
  ) {
    const version = captureSession()
    const existing =
      orders.find(
        (order) =>
          order.id === id
      )

    if (!existing) {
      return
    }

    try {
      const result = await transitionOrderSeparation(id, action)
      if (!isCurrentSession(version)) return result

      setOrders((current) =>
        current.map(
          (order) =>
            order.id === id
              ? { ...order, status: result.status }
              : order
        )
      )

      setBackendError(null)

      return result

    } catch (error) {

      console.error(
        "Erro ao atualizar status:",
        error
      )

      if (isCurrentSession(version)) setBackendError(
        error.message
      )

      throw error
    }
  }


  /*
   * ========================================
   * ESTOQUE
   * ========================================
   *
   * BACKEND PYTHON:
   *
   * ainda usa localStorage.
   *
   * Futuramente:
   *
   * GET    /api/products
   * POST   /api/products
   * PUT    /api/products/{id}
   * DELETE /api/products/{id}
   */

  async function saveProduct(data) {
    const version = captureSession()
    const unitPrice = parseCurrency(data.unitPrice)
    if (unitPrice === undefined) {
      throw new Error("Atualize os dados ou informe um preço válido antes de salvar o produto.")
    }
    const product = {
      ...data,

      id:
        data.id ||
        `P${Date.now().toString().slice(-6)}`,

      quantity: Math.max(
        0,
        Number(data.quantity) || 0
      ),

      max: Math.max(
        1,
        Number(data.max) || 1
      ),

      min: Math.max(
        0,
        Number(data.min) || 0
      ),

      unitPrice: Math.max(
        0,
        unitPrice
      ),

      active: data.active !== false,
    }

    const exists = inventory.some(
      (item) => item.id === product.id
    )

    if (exists) {
      try {
        const updatedProduct = await updateProduct(product)
        if (!isCurrentSession(version)) return updatedProduct

        setInventory((current) =>
          current.map((item) =>
            item.id === updatedProduct.id
              ? updatedProduct
              : item
          )
        )

        return updatedProduct
      } catch (error) {
        console.error(
          "Erro ao atualizar produto:",
          error
        )

        throw error
      }
    }

    // Ainda não integramos a edição ao FastAPI.
    // Impedimos que ela seja tratada como uma alteração salva.
    if (exists) {
      throw new Error(
        "A edição de produtos ainda não está integrada ao backend."
      )
    }

    try {
      const savedProduct = await createProduct(product)
      if (!isCurrentSession(version)) return savedProduct

      setInventory((current) => [
        ...current,
        savedProduct,
      ])

      return savedProduct

    } catch (error) {
      console.error(
        "Erro ao cadastrar produto:",
        error
      )

      throw error
    }
  }


  async function deleteProduct(id) {
    const version = captureSession()
    try {
      await removeProduct(id)
      if (!isCurrentSession(version)) return true

      setInventory((current) =>
        current.filter((item) => item.id !== id)
      )

      return true

    } catch (error) {
      console.error(
        "Erro ao excluir produto:",
        error
      )

      throw error
    }
  }



  async function changeStock(id, delta) {
    const version = captureSession()
    try {
      // 1. Envia a movimentação ao FastAPI
      const result = await moveProductStock(id, delta)
      if (!isCurrentSession(version)) return result

      const newQuantity = Number(result.newQuantity)

      if (!Number.isFinite(newQuantity)) {
        throw new Error(
          "O backend retornou uma quantidade inválida."
        )
      }

      // 2. Atualiza a quantidade do produto na interface
      setInventory((current) =>
        current.map((item) =>
          item.id === id
            ? {
              ...item,
              quantity: newQuantity,
            }
            : item
        )
      )

      // 3. Atualiza o histórico de movimentações
      try {
        await loadStockMovements()
      } catch (historyError) {
        console.error(
          "Estoque atualizado, mas não foi possível atualizar o histórico:",
          historyError
        )
      }

      return result
    } catch (error) {
      console.error(
        "Erro ao movimentar estoque:",
        error
      )

      throw error
    }
  }



  /*
   * ========================================
   * AUTENTICAÇÃO
   * ========================================
   *
   * BACKEND PYTHON FUTURO:
   *
   * POST /api/auth/login
   *
   * POST /api/auth/register
   */

  async function login(email, password, type) {
    if (loginPending.current) return { ok: false, message: "Login em andamento." }
    loginPending.current = true
    const version = ++authVersion.current
    applyAuthUser(null)
    setAuthLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (version !== authVersion.current) {
        return { ok: false, message: "Sessão alterada. Tente entrar novamente." }
      }

      if (error || !data.user) {
        return {
          ok: false,
          message: "E-mail ou senha inválidos.",
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name, role, status")
        .eq("id", data.user.id)
        .single()

      if (version !== authVersion.current) {
        return { ok: false, message: "Sessão alterada. Tente entrar novamente." }
      }

      if (profileError || !profile) {
        await supabase.auth.signOut()

        return {
          ok: false,
          message: "Perfil do usuário não encontrado.",
        }
      }

      if (profile.status !== "active" || !["admin", "employee"].includes(profile.role)) {
        await supabase.auth.signOut()

        return {
          ok: false,
          message: "Este usuário está desativado.",
        }
      }

      if (type && profile.role !== type) {
        await supabase.auth.signOut()

        return {
          ok: false,
          message: "O perfil selecionado não corresponde a este usuário.",
        }
      }

      const user = {
        id: data.user.id,
        email: data.user.email,
        name: profile.name,
        role: profile.role,
        type: profile.role,
        status: profile.status,
      }

      if (version !== authVersion.current) {
        return { ok: false, message: "Sessão alterada. Tente entrar novamente." }
      }
      applyAuthUser(user)
      setCurrentUserId(null)

      return {
        ok: true,
        user,
      }
    } finally {
      loginPending.current = false
      if (version === authVersion.current) setAuthLoading(false)
    }
  }


  async function logout() {
    authVersion.current += 1
    applyAuthUser(null)
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error("Erro ao encerrar sessão:", error)
      throw new Error("Não foi possível encerrar a sessão.")
    }

    authVersion.current += 1
    applyAuthUser(null)
    setCurrentUserId(null)
  }


  function register(data) {

    if (
      users.some(
        (user) =>
          user.email
            .toLowerCase() ===
          data.email
            .trim()
            .toLowerCase()
      )
    ) {

      return {
        ok: false,
        message:
          "Já existe um usuário com este e-mail.",
      }
    }

    const user = {

      id:
        `U${Date.now()
          .toString()
          .slice(-6)}`,

      name:
        data.name.trim(),

      email:
        data.email
          .trim()
          .toLowerCase(),

      phone: "",

      role:
        data.type === "admin"
          ? "Administrador"
          : "Funcionário",

      type:
        data.type,

      status: "active",

      password:
        data.password,
    }

    setUsers(
      (current) => [
        ...current,
        user,
      ]
    )

    setCurrentUserId(
      user.id
    )

    return {
      ok: true,
      user,
    }
  }


  function updateUser(
    id,
    patch
  ) {

    setUsers((current) =>
      current.map(
        (user) =>
          user.id === id

            ? {
              ...user,
              ...patch,
            }

            : user
      )
    )
  }


  function deleteUser(id) {

    setUsers(
      (current) =>
        current.filter(
          (user) =>
            user.id !== id
        )
    )

    if (
      currentUserId === id
    ) {

      setCurrentUserId(null)

    }
  }


  function saveUser(data) {

    const user = {

      id:
        data.id ||
        `U${Date.now()
          .toString()
          .slice(-6)}`,

      name:
        data.name.trim(),

      email:
        data.email
          .trim()
          .toLowerCase(),

      phone:
        data.phone || "",

      role:
        data.role ||
        (
          data.type === "admin"
            ? "Administrador"
            : "Funcionário"
        ),

      type:
        data.type ||
        "employee",

      status:
        data.status ||
        "active",

      password:
        data.password ||
        "123456",
    }

    setUsers((current) =>
      current.some(
        (item) =>
          item.id === user.id
      )

        ? current.map(
          (item) =>
            item.id === user.id

              ? {
                ...item,
                ...user,
              }

              : item
        )

        : [
          ...current,
          user,
        ]
    )

    return user
  }


  function resetPassword(
    email,
    newPassword
  ) {

    const user =
      users.find(
        (item) =>
          item.email
            .toLowerCase() ===
          email
            .trim()
            .toLowerCase()
      )

    if (!user) {

      return {
        ok: false,

        message:
          "E-mail não encontrado.",
      }
    }

    updateUser(
      user.id,
      {
        password:
          newPassword,
      }
    )

    return {
      ok: true,
    }
  }


  /*
   * ========================================
   * TAREFAS
   * ========================================
   */

  function addTask(title) {

    const clean =
      title.trim()

    if (!clean) {
      return
    }

    setTasks((current) => [
      ...current,

      {
        id:
          `T${Date.now()}`,

        title:
          clean,

        done:
          false,
      },
    ])
  }


  function toggleTask(id) {

    setTasks((current) =>
      current.map(
        (task) =>
          task.id === id

            ? {
              ...task,
              done:
                !task.done,
            }

            : task
      )
    )
  }


  function deleteTask(id) {

    setTasks(
      (current) =>
        current.filter(
          (task) =>
            task.id !== id
        )
    )
  }


  const value = {

    hydrated,

    /*
     * Backend
     */

    backendError,

    ordersLoading,

    /*
     * Pedidos
     */

    orders,

    saveOrder,

    deleteOrder,

    updateOrderStatus,

    /*
     * Estoque
     */

    inventory,

    saveProduct,

    deleteProduct,

    stockMovements,

    loadStockMovements,

    changeStock,

    /*
     * Usuários
     */

    users,

    saveUser,

    updateUser,

    deleteUser,

    /*
     * Sessão
     */

    authLoading,

    
    currentUser,

    login,

    logout,

    register,

    resetPassword,

    /*
     * Tarefas
     */

    tasks,

    addTask,

    toggleTask,

    deleteTask,
  }


  return (
    <AppContext.Provider
      value={value}
    >
      {children}
    </AppContext.Provider>
  )
}


export function useApp() {

  const context =
    useContext(
      AppContext
    )

  if (!context) {

    throw new Error(
      "useApp deve ser usado dentro de AppProvider"
    )
  }

  return context
}
