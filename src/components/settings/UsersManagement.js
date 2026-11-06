"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Trash2, User, X } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { createAdminUser, deleteEmployee, getAdminUsers, updateEmployeeStatus } from "@/services/backend"

const EMPTY_FORM = { name: "", email: "", password: "", role: "employee" }
const USERS_PER_PAGE = 25

export default function UsersManagement({ onUsersChanged }) {
  const { currentUser } = useApp()
  const userId = currentUser?.id ?? null
  const userType = currentUser?.status === "active" ? currentUser?.role : null
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
  const [statusOperation, setStatusOperation] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deleteOperation, setDeleteOperation] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [deleteMessage, setDeleteMessage] = useState(null)
  const submissionPending = useRef(false)
  const statusPending = useRef(false)
  const deletePending = useRef(false)
  const directoryRequest = useRef(0)
  const statusRequest = useRef(0)
  const deleteRequest = useRef(0)
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
      setDirectoryOwnerId(userId)
      setUsersError(requestError?.message || "Não foi possível carregar os usuários.")
      return false
    } finally {
      if (requestId === directoryRequest.current) setUsersLoading(false)
    }
  }, [userId, userType])

  useEffect(() => {
    if (userType !== "admin") {
      directoryRequest.current += 1
      statusRequest.current += 1
      deleteRequest.current += 1
      statusPending.current = false
      deletePending.current = false
      return undefined
    }

    // Deferring avoids a synchronous state update during the effect itself.
    const timer = setTimeout(() => { void loadUsers(1) }, 0)
    return () => {
      // Ignore a response begun by a previous user, role or component instance.
      clearTimeout(timer)
      directoryRequest.current += 1
      statusRequest.current += 1
      deleteRequest.current += 1
      statusPending.current = false
      deletePending.current = false
      authenticatedIdentity.current = { id: null, type: null }
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
      const employee = await createAdminUser({ name, email, password: form.password, role: form.role })
      if (authenticatedIdentity.current.id !== userId || authenticatedIdentity.current.type !== "admin") return
      setCreatedEmployee({ id: employee.id, name: employee.name, role: employee.role, ownerId: userId })
      onUsersChanged?.()
      resetForm()
      setShowForm(false)
      await loadUsers(1)
    } catch (requestError) {
      // The service exposes only a sanitized server message.
      if (authenticatedIdentity.current.id !== userId || authenticatedIdentity.current.type !== "admin") return
      setForm((current) => ({ ...current, password: "" }))
      setFormError(requestError?.message || "Não foi possível cadastrar o funcionário.")
    } finally {
      submissionPending.current = false
      setSubmitting(false)
    }
  }

  async function changeEmployeeStatus(employee) {
    if (statusPending.current || userType !== "admin" || !userId ||
        authenticatedIdentity.current.id !== userId || authenticatedIdentity.current.type !== "admin") return

    const nextStatus = employee.status === "active" ? "inactive" : "active"
    const action = nextStatus === "inactive" ? "desativar" : "reativar"
    const confirmation = nextStatus === "inactive"
      ? `Desativar ${employee.name}? O funcion\u00e1rio perder\u00e1 acesso ao sistema.`
      : `Reativar ${employee.name}? O funcion\u00e1rio voltar\u00e1 a acessar o sistema.`
    if (!window.confirm(confirmation)) return

    const requestId = ++statusRequest.current
    statusPending.current = true
    setStatusOperation({ id: employee.id, ownerId: userId })
    setStatusError(null)
    setStatusMessage(null)
    try {
      await updateEmployeeStatus(employee.id, nextStatus)
      if (requestId !== statusRequest.current || authenticatedIdentity.current.id !== userId ||
          authenticatedIdentity.current.type !== "admin") return
      onUsersChanged?.()
      const refreshed = await loadUsers(page)
      if (refreshed && requestId === statusRequest.current && authenticatedIdentity.current.id === userId &&
          authenticatedIdentity.current.type === "admin") {
        setStatusMessage({ ownerId: userId, text: `Funcion\u00e1rio ${action === "desativar" ? "desativado" : "reativado"} com sucesso.` })
      }
    } catch (requestError) {
      if (requestId !== statusRequest.current || authenticatedIdentity.current.id !== userId ||
          authenticatedIdentity.current.type !== "admin") return
      setStatusError({ ownerId: userId, text: requestError?.message || "N\u00e3o foi poss\u00edvel atualizar o status do funcion\u00e1rio." })
    } finally {
      if (requestId === statusRequest.current) {
        statusPending.current = false
        setStatusOperation(null)
      }
    }
  }

  function openDeleteConfirmation(employee) {
    if (deletePending.current || statusPending.current || userType !== "admin" ||
        employee.role !== "employee" || employee.status !== "inactive") return
    setDeleteCandidate({ id: employee.id, name: employee.name, ownerId: userId })
    setDeleteConfirmation("")
    setDeleteError(null)
  }

  function closeDeleteConfirmation() {
    if (deletePending.current) return
    setDeleteCandidate(null)
    setDeleteConfirmation("")
    setDeleteError(null)
  }

  async function confirmEmployeeDeletion(event) {
    event.preventDefault()
    const candidate = deleteCandidate
    if (!candidate || deletePending.current || userType !== "admin" || !userId ||
        candidate.ownerId !== userId || authenticatedIdentity.current.id !== userId ||
        authenticatedIdentity.current.type !== "admin") return
    if (deleteConfirmation !== "EXCLUIR") {
      setDeleteError({ ownerId: userId, text: "Digite EXCLUIR para confirmar a exclusão permanente." })
      return
    }

    const requestId = ++deleteRequest.current
    deletePending.current = true
    setDeleteOperation({ id: candidate.id, ownerId: userId })
    setDeleteError(null)
    setDeleteMessage(null)
    try {
      await deleteEmployee(candidate.id)
      if (requestId !== deleteRequest.current || authenticatedIdentity.current.id !== userId ||
          authenticatedIdentity.current.type !== "admin") return
      onUsersChanged?.()
      // Avoid an empty stale page after deleting its last confirmed record.
      const requestedPage = page > 1 && users.length === 1 ? page - 1 : page
      const refreshed = await loadUsers(requestedPage)
      if (refreshed && requestId === deleteRequest.current && authenticatedIdentity.current.id === userId &&
          authenticatedIdentity.current.type === "admin") {
        setDeleteCandidate(null)
        setDeleteConfirmation("")
        setDeleteMessage({ ownerId: userId, text: "Funcionário excluído permanentemente." })
      }
    } catch (requestError) {
      if (requestId !== deleteRequest.current || authenticatedIdentity.current.id !== userId ||
          authenticatedIdentity.current.type !== "admin") return
      const uncertain = [502, 503].includes(requestError?.status)
      const fallback = "Não foi possível excluir o funcionário."
      setDeleteError({
        ownerId: userId,
        text: uncertain
          ? `${requestError?.message || fallback} O resultado da exclusão pode ser incerto. Atualize a lista antes de tentar novamente.`
          : requestError?.message || fallback,
      })
    } finally {
      if (requestId === deleteRequest.current) {
        deletePending.current = false
        setDeleteOperation(null)
      }
    }
  }

  if (userType !== "admin") return null

  const directoryIsCurrent = directoryOwnerId === userId
  const formIsCurrent = formOwnerId === userId
  const creationIsCurrent = createdEmployee?.ownerId === userId
  const statusMessageIsCurrent = statusMessage?.ownerId === userId
  const statusErrorIsCurrent = statusError?.ownerId === userId
  const statusOperationIsCurrent = statusOperation?.ownerId === userId
  const deleteCandidateIsCurrent = deleteCandidate?.ownerId === userId
  const deleteErrorIsCurrent = deleteError?.ownerId === userId
  const deleteMessageIsCurrent = deleteMessage?.ownerId === userId
  const deleteOperationIsCurrent = deleteOperation?.ownerId === userId
  const visibleTotal = directoryIsCurrent ? total : 0
  const totalPages = Math.max(1, Math.ceil(visibleTotal / perPage))

  return (
    <div className="min-w-0 max-w-full bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h3 className="font-semibold text-gray-900">Gerenciamento de Usuários</h3>
          <p className="text-sm text-gray-500">Contas reais vinculadas ao Supabase Auth.</p>
        </div>
        <button onClick={openCreate} disabled={submitting} className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl disabled:opacity-60">
          <Plus className="w-4 h-4" />Novo Usuário
        </button>
      </div>

      {showForm && formIsCurrent && (
        <form onSubmit={submit} className="p-5 bg-gray-50 border-b grid md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label htmlFor="new-user-role" className="block text-xs font-medium text-gray-700">Perfil</label>
            <select id="new-user-role" value={form.role} disabled={submitting} onChange={event => setForm({ ...form, role: event.target.value })} className="form-control w-full rounded-lg p-2 text-gray-900">
              <option value="employee">Funcionário</option><option value="admin">Administrador</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="employee-name" className="block text-xs font-medium text-gray-700">Nome completo</label>
            <input id="employee-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}
              disabled={submitting} placeholder="Nome do funcionário" autoComplete="name" className="form-control w-full rounded-lg p-2 text-gray-900" />
          </div>
          <div className="space-y-1">
            <label htmlFor="employee-email" className="block text-xs font-medium text-gray-700">E-mail</label>
            <input id="employee-email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}
              disabled={submitting} type="email" placeholder="nome@empresa.com" autoComplete="email" className="form-control w-full rounded-lg p-2 text-gray-900" />
          </div>
          <div className="space-y-1">
            <label htmlFor="employee-password" className="block text-xs font-medium text-gray-700">Senha inicial</label>
            <input id="employee-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}
              disabled={submitting} type="password" placeholder="Defina uma senha inicial" autoComplete="new-password" className="form-control w-full rounded-lg p-2 text-gray-900" />
          </div>
          <div className="flex gap-2">
            <button disabled={submitting} className="flex-1 bg-purple-600 text-white rounded-lg disabled:opacity-60">
              {submitting ? "Cadastrando..." : "Cadastrar usuário"}
            </button>
            <button type="button" onClick={closeForm} disabled={submitting} aria-label="Fechar formulário"
              className="p-2 border rounded-lg disabled:opacity-50"><X className="w-4 h-4" /></button>
          </div>
          {formError && <p className="md:col-span-4 text-sm text-red-600">{formError}</p>}
        </form>
      )}

      {creationIsCurrent && (
        <div className="m-5 p-4 rounded-xl border border-green-200 bg-green-50 text-green-900" role="status">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4" />Usuário cadastrado com sucesso</div>
          <p className="mt-1 text-sm">{createdEmployee.name} — {createdEmployee.role === "admin" ? "administrador" : "funcionário"} ativo.</p>
        </div>
      )}

      {deleteCandidateIsCurrent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-employee-title">
          <form onSubmit={confirmEmployeeDeletion} className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <h4 id="delete-employee-title" className="text-lg font-semibold text-gray-900">Excluir funcionário permanentemente</h4>
            <p className="mt-2 text-sm text-gray-700 [overflow-wrap:anywhere]">Você está prestes a excluir permanentemente <strong>{deleteCandidate.name}</strong>. Esta ação não pode ser desfeita.</p>
            <label className="mt-4 block text-sm font-medium text-gray-800" htmlFor="delete-confirmation">Digite <strong>EXCLUIR</strong> para confirmar</label>
            <input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={deleteOperationIsCurrent} autoComplete="off" className="mt-2 w-full rounded-lg border p-2 text-gray-900 disabled:bg-gray-100" />
            {deleteErrorIsCurrent && <p className="mt-3 text-sm text-red-600" role="alert">{deleteError.text}</p>}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              {deleteErrorIsCurrent && <button type="button" onClick={() => loadUsers(page)} disabled={deleteOperationIsCurrent} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Atualizar lista</button>}
              <button type="button" onClick={closeDeleteConfirmation} disabled={deleteOperationIsCurrent} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={deleteOperationIsCurrent} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                <Trash2 className="h-4 w-4" />{deleteOperationIsCurrent ? "Excluindo..." : "Excluir permanentemente"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[40rem]">
          <thead><tr className="bg-gray-50 border-y">
            {['Nome', 'E-mail', 'Perfil', 'Status', 'Ações'].map((heading) => (
              <th key={heading} className="text-left p-4 text-xs text-gray-500 uppercase">{heading}</th>
            ))}
          </tr></thead>
          <tbody>
            {(usersLoading || !directoryIsCurrent) && <tr><td colSpan="5" className="p-6 text-center text-sm text-gray-500">Carregando usuários...</td></tr>}
            {!usersLoading && directoryIsCurrent && usersError && <tr><td colSpan="5" className="p-6 text-center text-sm text-red-600">
              <p>{usersError}</p><button onClick={() => loadUsers(page)} className="mt-2 text-purple-700 underline">Tentar novamente</button>
            </td></tr>}
            {!usersLoading && directoryIsCurrent && !usersError && users.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-sm text-gray-500">Nenhum usuário encontrado.</td></tr>}
            {!usersLoading && directoryIsCurrent && !usersError && users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="p-4 font-medium text-gray-900">{user.name}</td>
                <td className="p-4 text-gray-700">{user.email}</td>
                <td className="p-4"><span className={user.role === "admin" ? "text-purple-700" : "text-orange-700"}>{user.role === "admin" ? "Administrador" : "Funcionário"}</span></td>
                <td className="p-4"><span className={user.status === "active" ? "text-green-600" : "text-gray-500"}>{user.status === "active" ? "Ativo" : "Inativo"}</span></td>
                <td className="p-4">
                  {user.role === "employee" && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => changeEmployeeStatus(user)}
                        disabled={statusOperationIsCurrent || deleteOperationIsCurrent || usersLoading}
                        aria-label={`${user.status === "active" ? "Desativar" : "Reativar"} ${user.name}`}
                        className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${user.status === "active" ? "border border-red-200 text-red-700" : "border border-green-200 text-green-700"}`}>
                        {statusOperationIsCurrent && statusOperation.id === user.id ? "Atualizando..." : user.status === "active" ? "Desativar" : "Reativar"}
                      </button>
                      {user.status === "inactive" && (
                        <button type="button" onClick={() => openDeleteConfirmation(user)}
                          disabled={statusOperationIsCurrent || deleteOperationIsCurrent || usersLoading}
                          aria-label={`Excluir permanentemente ${user.name}`}
                          className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                          <Trash2 className="h-4 w-4" />{deleteOperationIsCurrent && deleteOperation.id === user.id ? "Excluindo..." : "Excluir"}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center text-sm text-gray-600">
        <span>{visibleTotal} usuário{visibleTotal === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => loadUsers(page - 1)} disabled={usersLoading || page <= 1}
            aria-label="Página anterior" className="p-2 border rounded-lg disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          <span>Página {page} de {totalPages}</span>
          <button type="button" onClick={() => loadUsers(page + 1)} disabled={usersLoading || page >= totalPages}
            aria-label="Próxima página" className="p-2 border rounded-lg disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {statusMessageIsCurrent && <p className="mx-6 mb-4 text-sm text-green-700" role="status">{statusMessage.text}</p>}
      {statusErrorIsCurrent && <p className="mx-6 mb-4 text-sm text-red-600" role="alert">{statusError.text}</p>}
      {deleteMessageIsCurrent && <p className="mx-6 mb-4 text-sm text-green-700" role="status">{deleteMessage.text}</p>}
      {deleteErrorIsCurrent && !deleteCandidateIsCurrent && <p className="mx-6 mb-4 text-sm text-red-600" role="alert">{deleteError.text} <button onClick={() => loadUsers(page)} className="underline">Atualizar lista</button></p>}
      <p className="px-6 pb-6 text-sm text-gray-500"><User className="inline w-4 h-4 mr-1" />Edição e redefinição de senha ainda não estão disponíveis.</p>
    </div>
  )
}
