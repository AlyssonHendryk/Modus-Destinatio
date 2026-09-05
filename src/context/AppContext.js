"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { initialInventory, initialOrders, initialTasks, initialUsers } from "@/data/mockData"
import { normalizeOrder } from "@/utils/formatters"

const STORAGE_KEY = "modusdestinatio_state_v1"
const AppContext = createContext(null)

function loadState() {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export function AppProvider({ children }) {
  const [hydrated, setHydrated] = useState(false)
  const [orders, setOrders] = useState(initialOrders.map(normalizeOrder))
  const [inventory, setInventory] = useState(initialInventory)
  const [users, setUsers] = useState(initialUsers)
  const [tasks, setTasks] = useState(initialTasks)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    const saved = loadState()
    if (saved) {
      setOrders((saved.orders || initialOrders).map(normalizeOrder))
      setInventory(saved.inventory || initialInventory)
      setUsers(saved.users || initialUsers)
      setTasks(saved.tasks || initialTasks)
      setCurrentUserId(saved.currentUserId || null)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    // BACKEND PYTHON: substitua esta persistência pelas chamadas de src/services/backend.js.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ orders, inventory, users, tasks, currentUserId }))
  }, [orders, inventory, users, tasks, currentUserId, hydrated])

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) || null,
    [users, currentUserId]
  )

  function saveOrder(data) {
    const normalized = normalizeOrder(data)
    setOrders((current) => {
      const exists = current.some((order) => order.id === normalized.id)
      return exists
        ? current.map((order) => (order.id === normalized.id ? normalized : order))
        : [normalized, ...current]
    })
    return normalized
  }

  function deleteOrder(id) {
    setOrders((current) => current.filter((order) => order.id !== id))
  }

  function updateOrderStatus(id, status) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order))
  }

  function saveProduct(data) {
    const product = {
      ...data,
      id: data.id || `P${Date.now().toString().slice(-6)}`,
      quantity: Math.max(0, Number(data.quantity) || 0),
      max: Math.max(1, Number(data.max) || 1),
      min: Math.max(0, Number(data.min) || 0),
      unitPrice: Math.max(0, Number(data.unitPrice) || 0),
      active: data.active !== false,
    }
    setInventory((current) => current.some((item) => item.id === product.id)
      ? current.map((item) => item.id === product.id ? product : item)
      : [...current, product])
    return product
  }

  function deleteProduct(id) {
    setInventory((current) => current.filter((item) => item.id !== id))
  }

  function changeStock(id, delta) {
    setInventory((current) => current.map((item) => item.id === id
      ? { ...item, quantity: Math.max(0, item.quantity + delta) }
      : item))
  }

  function login(email, password, type) {
    const user = users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase())
    if (!user || user.password !== password) return { ok: false, message: "E-mail ou senha inválidos." }
    if (user.status !== "active") return { ok: false, message: "Este usuário está desativado." }
    if (type && user.type !== type) return { ok: false, message: "O perfil selecionado não corresponde a este usuário." }
    setCurrentUserId(user.id)
    return { ok: true, user }
  }

  function logout() {
    setCurrentUserId(null)
  }

  function register(data) {
    if (users.some((user) => user.email.toLowerCase() === data.email.trim().toLowerCase())) {
      return { ok: false, message: "Já existe um usuário com este e-mail." }
    }
    const user = {
      id: `U${Date.now().toString().slice(-6)}`,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: "",
      role: data.type === "admin" ? "Administrador" : "Funcionário",
      type: data.type,
      status: "active",
      password: data.password,
    }
    setUsers((current) => [...current, user])
    setCurrentUserId(user.id)
    return { ok: true, user }
  }

  function updateUser(id, patch) {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, ...patch } : user))
  }

  function deleteUser(id) {
    setUsers((current) => current.filter((user) => user.id !== id))
    if (currentUserId === id) setCurrentUserId(null)
  }

  function saveUser(data) {
    const user = {
      id: data.id || `U${Date.now().toString().slice(-6)}`,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone || "",
      role: data.role || (data.type === "admin" ? "Administrador" : "Funcionário"),
      type: data.type || "employee",
      status: data.status || "active",
      password: data.password || "123456",
    }
    setUsers((current) => current.some((item) => item.id === user.id)
      ? current.map((item) => item.id === user.id ? { ...item, ...user } : item)
      : [...current, user])
    return user
  }

  function resetPassword(email, newPassword) {
    const user = users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase())
    if (!user) return { ok: false, message: "E-mail não encontrado." }
    updateUser(user.id, { password: newPassword })
    return { ok: true }
  }

  function addTask(title) {
    const clean = title.trim()
    if (!clean) return
    setTasks((current) => [...current, { id: `T${Date.now()}`, title: clean, done: false }])
  }

  function toggleTask(id) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task))
  }

  function deleteTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  const value = {
    hydrated,
    orders, saveOrder, deleteOrder, updateOrderStatus,
    inventory, saveProduct, deleteProduct, changeStock,
    users, saveUser, updateUser, deleteUser,
    currentUser, login, logout, register, resetPassword,
    tasks, addTask, toggleTask, deleteTask,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp deve ser usado dentro de AppProvider")
  return context
}
