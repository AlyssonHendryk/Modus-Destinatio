"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, User, X } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { createEmployee, getAdminUsers } from "@/services/backend"

const EMPTY_FORM = { name: "", email: "", password: "" }
const USERS_PER_PAGE = 25

export default function UsersManagement() {
  const { currentUser } = useApp()
  const userId = currentUser?.id ?? null
  const userType = currentUser?.type ?? null
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [createdEmployee, setCreatedEmployee] = useState(null)
  const [formOwnerId, setFormOwnerId] = useState(null)
  const [users, setUsers] = useState([])
  const [directoryOwnerId, setDirectoryOwnerId] = useState(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(USERS_PER_PAGE)
  const [total, setTotal] = useState(0)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState("")
  const submissionPending = useRef(false)
  const directoryRequest = useRef(0)
  const authenticatedIdentity = useRef({ id: null, type: null })

  useEffect(() => {
    authenticatedIdentity.current = { id: userId, type: userType }
  }, [userId, userType])

  const loadUsers = useCallback(async (requestedPage = 1) => {
    if (userType !== "admin" || !userId || authenticatedIdentity.current.id !== userId ||
        authenticatedIdentity.current.type !== "admin") return false

    const requestId = ++directoryRequest.current
    setUsersLoading(true)
    setUsersError("")
    try {
      const directory = await getAdminUsers(requestedPage, USERS_PER_PAGE)
      if (requestId !== directoryRequest.current || authenticatedIdentity.current.id !== userId ||
          authenticatedIdentity.current.type !== "admin") return false
      setUsers(directory.users)
      setDirectoryOwnerId(userId)
      setPage(directory.page)
      setPerPage(directory.per_page)
      setTotal(directory.total)
      return true
    } catch (requestError) {
      if (requestId !== directoryRequest.current || authenticatedIdentity.current.id !== userId ||
          authenticatedIdentity.current.type !== "admin") return false
      setUsers([])
      setDirectoryOwnerId(userId)
      setTotal(0)
      setUsersError(requestError?.message || "Não foi possível carregar os usuários.")
      return false
    } finally {
      if (requestId === directoryRequest.current) setUsersLoading(false)
    }
  }, [userId, userType])

  useEffect(() => {
    if (userType !== "admin") {
      directoryRequest.current += 1
      return undefined
    }

    // Deferring avoids a synchronous state update during the effect itself.
    const timer = setTimeout(() => { void loadUsers(1) }, 0)
    return () => {
      // Ignore a response begun by a previous user, role or component instance.
      clearTimeout(timer)
      directoryRequest.current += 1
    }
  }, [userId, userType, loadUsers])

  function resetForm() {
    setForm(EMPTY_FORM)
    setFormError("")
  }

  function openCreate() {
    resetForm()
    setFormOwnerId(userId)
    setShowForm(true)
  }

  function closeForm() {
    if (submissionPending.current) return
    resetForm()
    setShowForm(false)
  }

  async function submit(event) {
    event.preventDefault()
    if (submissionPending.current) return

    const name = form.name.trim()
    const email = form.email.trim()
    if (!name || !email || !form.password) {
      setFormError("Preencha nome, e-mail e senha inicial.")
      return
    }

    submissionPending.current = true
    setSubmitting(true)
    setFormError("")
    try {
      const employee = await createEmployee({ name, email, password: form.password })
      if (authenticatedIdentity.current.id !== userId || authenticatedIdentity.current.type !== "admin") return
      setCreatedEmployee({ id: employee.id, name: employee.name, ownerId: userId })
      resetForm()
      setShowForm(false)
      await loadUsers(1)
    } catch (requestError) {
      // The service exposes only a sanitized server message.
      setForm((current) => ({ ...current, password: "" }))
      setFormError(requestError?.message || "Não foi possível cadastrar o funcionário.")
    } finally {
      submissionPending.current = false
      setSubmitting(false)
    }
  }

  if (userType !== "admin") return null

  const directoryIsCurrent = directoryOwnerId === userId
  const formIsCurrent = formOwnerId === userId
  const creationIsCurrent = createdEmployee?.ownerId === userId
  const visibleTotal = directoryIsCurrent ? total : 0
  const totalPages = Math.max(1, Math.ceil(visibleTotal / perPage))

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-6 border-b flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900">Gerenciamento de Usuários</h3>
          <p className="text-sm text-gray-500">Contas reais vinculadas ao Supabase Auth.</p>
        </div>
        <button onClick={openCreate} disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl disabled:opacity-60">
          <Plus className="w-4 h-4" />Novo Funcionário
        </button>
      </div>

      {showForm && formIsCurrent && (
        <form onSubmit={submit} className="p-5 bg-gray-50 border-b grid md:grid-cols-4 gap-3">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}
            disabled={submitting} placeholder="Nome" autoComplete="name" className="border rounded-lg p-2 text-gray-900 disabled:bg-gray-100" />
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}
            disabled={submitting} type="email" placeholder="E-mail" autoComplete="email" className="border rounded-lg p-2 text-gray-900 disabled:bg-gray-100" />
          <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}
            disabled={submitting} type="password" placeholder="Senha inicial" autoComplete="new-password" className="border rounded-lg p-2 text-gray-900 disabled:bg-gray-100" />
          <div className="flex gap-2">
            <button disabled={submitting} className="flex-1 bg-purple-600 text-white rounded-lg disabled:opacity-60">
              {submitting ? "Cadastrando..." : "Cadastrar funcionário"}
            </button>
            <button type="button" onClick={closeForm} disabled={submitting} aria-label="Fechar formulário"
              className="p-2 border rounded-lg disabled:opacity-50"><X className="w-4 h-4" /></button>
          </div>
          {formError && <p className="md:col-span-4 text-sm text-red-600">{formError}</p>}
        </form>
      )}

      {creationIsCurrent && (
        <div className="m-5 p-4 rounded-xl border border-green-200 bg-green-50 text-green-900" role="status">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4" />Funcionário cadastrado com sucesso</div>
          <p className="mt-1 text-sm">{createdEmployee.name} — funcionário ativo.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="bg-gray-50 border-y">
            {['Nome', 'E-mail', 'Perfil', 'Status'].map((heading) => (
              <th key={heading} className="text-left p-4 text-xs text-gray-500 uppercase">{heading}</th>
            ))}
          </tr></thead>
          <tbody>
            {(usersLoading || !directoryIsCurrent) && <tr><td colSpan="4" className="p-6 text-center text-sm text-gray-500">Carregando usuários...</td></tr>}
            {!usersLoading && directoryIsCurrent && usersError && <tr><td colSpan="4" className="p-6 text-center text-sm text-red-600">
              <p>{usersError}</p><button onClick={() => loadUsers(page)} className="mt-2 text-purple-700 underline">Tentar novamente</button>
            </td></tr>}
            {!usersLoading && directoryIsCurrent && !usersError && users.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-sm text-gray-500">Nenhum usuário encontrado.</td></tr>}
            {!usersLoading && directoryIsCurrent && !usersError && users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="p-4 font-medium text-gray-900">{user.name}</td>
                <td className="p-4 text-gray-700">{user.email}</td>
                <td className="p-4"><span className={user.role === "admin" ? "text-purple-700" : "text-orange-700"}>{user.role === "admin" ? "Administrador" : "Funcionário"}</span></td>
                <td className="p-4"><span className={user.status === "active" ? "text-green-600" : "text-gray-500"}>{user.status === "active" ? "Ativo" : "Inativo"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t flex items-center justify-between gap-3 text-sm text-gray-600">
        <span>{visibleTotal} usuário{visibleTotal === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => loadUsers(page - 1)} disabled={usersLoading || page <= 1}
            aria-label="Página anterior" className="p-2 border rounded-lg disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" onClick={() => loadUsers(page + 1)} disabled={usersLoading || page >= totalPages}
            aria-label="Próxima página" className="p-2 border rounded-lg disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <p className="px-6 pb-6 text-sm text-gray-500"><User className="inline w-4 h-4 mr-1" />Edição, desativação, redefinição de senha e exclusão ainda não estão disponíveis.</p>
    </div>
  )
}
