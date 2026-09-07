"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  initialInventory,
  initialOrders,
  initialTasks,
  initialUsers,
} from "@/data/mockData"

import { normalizeOrder } from "@/utils/formatters"

import {
  getOrders,
  createOrder,
  updateOrder,
  removeOrder,
} from "@/services/backend"

const STORAGE_KEY = "modusdestinatio_state_v1"

const AppContext = createContext(null)

function loadState() {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const saved =
      localStorage.getItem(STORAGE_KEY)

    return saved
      ? JSON.parse(saved)
      : null

  } catch {
    return null
  }
}

export function AppProvider({ children }) {

  const [hydrated, setHydrated] =
    useState(false)

  const [orders, setOrders] =
    useState(
      initialOrders.map(normalizeOrder)
    )

  const [inventory, setInventory] =
    useState(initialInventory)

  const [users, setUsers] =
    useState(initialUsers)

  const [tasks, setTasks] =
    useState(initialTasks)

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState(null)

  // Indica comunicação com o backend
  const [
    ordersLoading,
    setOrdersLoading,
  ] = useState(true)

  const [
    backendError,
    setBackendError,
  ] = useState(null)


  /*
   * ========================================
   * INICIALIZAÇÃO DO SISTEMA
   * ========================================
   *
   * Usuários, estoque e tarefas:
   * continuam vindo do localStorage.
   *
   * Pedidos:
   * passam a vir do backend Python.
   */

  useEffect(() => {

    async function initialize() {

      const saved = loadState()

      if (saved) {

        setInventory(
          saved.inventory ||
          initialInventory
        )

        setUsers(
          saved.users ||
          initialUsers
        )

        setTasks(
          saved.tasks ||
          initialTasks
        )

        setCurrentUserId(
          saved.currentUserId ||
          null
        )
      }

      /*
       * ==================================
       * BACKEND PYTHON - GET /api/orders
       * ==================================
       */

      try {

        setOrdersLoading(true)

        const backendOrders =
          await getOrders()

        setOrders(
          backendOrders.map(
            normalizeOrder
          )
        )

        setBackendError(null)

      } catch (error) {

        console.error(
          "Erro ao carregar pedidos:",
          error
        )

        setBackendError(
          error.message
        )

        /*
         * FALLBACK
         *
         * Se o Python estiver desligado,
         * usamos a última cópia local.
         */

        if (saved?.orders) {

          setOrders(
            saved.orders.map(
              normalizeOrder
            )
          )

        } else {

          setOrders(
            initialOrders.map(
              normalizeOrder
            )
          )
        }

      } finally {

        setOrdersLoading(false)
        setHydrated(true)

      }
    }

    initialize()

  }, [])


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

    if (!hydrated) {
      return
    }

    localStorage.setItem(
      STORAGE_KEY,

      JSON.stringify({
        orders,
        inventory,
        users,
        tasks,
        currentUserId,
      })
    )

  }, [
    orders,
    inventory,
    users,
    tasks,
    currentUserId,
    hydrated,
  ])


  const currentUser = useMemo(
    () =>
      users.find(
        (user) =>
          user.id === currentUserId
      ) || null,

    [users, currentUserId]
  )


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

    const normalized =
      normalizeOrder(data)

    const exists =
      orders.some(
        (order) =>
          order.id === normalized.id
      )

    try {

      let savedOrder

      if (exists) {

        savedOrder =
          await updateOrder(
            normalized
          )

      } else {

        savedOrder =
          await createOrder(
            normalized
          )

      }

      const finalOrder =
        normalizeOrder(savedOrder)

      setOrders((current) => {

        const alreadyExists =
          current.some(
            (order) =>
              order.id ===
              finalOrder.id
          )

        if (alreadyExists) {

          return current.map(
            (order) =>
              order.id ===
              finalOrder.id

                ? finalOrder

                : order
          )
        }

        return [
          finalOrder,
          ...current,
        ]
      })

      setBackendError(null)

      return finalOrder

    } catch (error) {

      console.error(
        "Erro ao salvar pedido:",
        error
      )

      setBackendError(
        error.message
      )

      throw error
    }
  }


  /*
   * DELETE /api/orders/{id}
   */

  async function deleteOrder(id) {

    try {

      await removeOrder(id)

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

      setBackendError(
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
   * Utiliza o mesmo PUT do pedido.
   */

  async function updateOrderStatus(
    id,
    status
  ) {

    const existing =
      orders.find(
        (order) =>
          order.id === id
      )

    if (!existing) {
      return
    }

    const updated = {
      ...existing,
      status,
    }

    try {

      const saved =
        await updateOrder(
          updated
        )

      const normalized =
        normalizeOrder(saved)

      setOrders((current) =>
        current.map(
          (order) =>
            order.id === id
              ? normalized
              : order
        )
      )

      setBackendError(null)

      return normalized

    } catch (error) {

      console.error(
        "Erro ao atualizar status:",
        error
      )

      setBackendError(
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

  function saveProduct(data) {

    const product = {

      ...data,

      id:
        data.id ||
        `P${Date.now()
          .toString()
          .slice(-6)}`,

      quantity:
        Math.max(
          0,
          Number(data.quantity) || 0
        ),

      max:
        Math.max(
          1,
          Number(data.max) || 1
        ),

      min:
        Math.max(
          0,
          Number(data.min) || 0
        ),

      unitPrice:
        Math.max(
          0,
          Number(data.unitPrice) || 0
        ),

      active:
        data.active !== false,
    }

    setInventory((current) =>
      current.some(
        (item) =>
          item.id === product.id
      )

        ? current.map(
            (item) =>
              item.id === product.id
                ? product
                : item
          )

        : [
            ...current,
            product,
          ]
    )

    return product
  }


  function deleteProduct(id) {

    setInventory(
      (current) =>
        current.filter(
          (item) =>
            item.id !== id
        )
    )
  }


  function changeStock(
    id,
    delta
  ) {

    setInventory((current) =>
      current.map(
        (item) =>
          item.id === id

            ? {
                ...item,

                quantity:
                  Math.max(
                    0,
                    item.quantity +
                      delta
                  ),
              }

            : item
      )
    )
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

  function login(
    email,
    password,
    type
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

    if (
      !user ||
      user.password !== password
    ) {

      return {
        ok: false,
        message:
          "E-mail ou senha inválidos.",
      }
    }

    if (
      user.status !== "active"
    ) {

      return {
        ok: false,
        message:
          "Este usuário está desativado.",
      }
    }

    if (
      type &&
      user.type !== type
    ) {

      return {
        ok: false,

        message:
          "O perfil selecionado não corresponde a este usuário.",
      }
    }

    setCurrentUserId(
      user.id
    )

    return {
      ok: true,
      user,
    }
  }


  function logout() {

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