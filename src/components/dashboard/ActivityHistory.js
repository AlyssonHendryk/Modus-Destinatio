"use client"

import { useEffect, useRef, useState } from "react"
import { getActivityLogs } from "@/services/backend"
import { ACTIVITY_ACTIONS, activityActorLabel, activityDetails, activityFilters } from "@/utils/activityPresentation"
import { ACTIVITY_POLL_INTERVAL, shouldPollActivityPage } from "@/utils/activityPolling"

const EMPTY = { user_id: "", action: "", start: "", end: "" }
const control = "form-control h-11 w-full rounded-lg px-3 text-sm text-gray-900"
const button = "rounded-lg border border-purple-200 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 disabled:opacity-50"

export default function ActivityHistory({ user }) {
  const [draft, setDraft] = useState(EMPTY)
  const [query, setQuery] = useState({ filters: {}, cursor: null })
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [validation, setValidation] = useState("")
  const [pollRevision, setPollRevision] = useState(0)
  const requestVersion = useRef(0)
  const requestInFlight = useRef(false)

  useEffect(() => {
    if (user.role !== "admin" || user.status !== "active") return
    const controller = new AbortController()
    const version = ++requestVersion.current
    let alive = true
    requestInFlight.current = true

    getActivityLogs(query.filters, query.cursor, controller.signal)
      .then(result => {
        if (alive && version === requestVersion.current) {
          setPage(result)
          setError("")
          setLoading(false)
        }
      })
      .catch(failure => {
        if (alive && version === requestVersion.current) {
          setPage(null)
          setError(failure.status === 422 ? "A consulta expirou ou é inválida. Atualize a listagem." : "Não foi possível carregar as atividades. Tente atualizar a listagem.")
          setLoading(false)
        }
      })
      .finally(() => {
        if (version === requestVersion.current) requestInFlight.current = false
      })

    return () => {
      alive = false
      controller.abort()
      requestInFlight.current = false
    }
  }, [pollRevision, query, user.id, user.role, user.status])

  useEffect(() => {
    if (user.role !== "admin" || user.status !== "active" || query.cursor !== null) return

    let timer = null
    const isHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden"
    const clearTimer = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
    }
    const schedule = () => {
      clearTimer()
      if (isHidden()) return
      timer = window.setTimeout(() => {
        if (shouldPollActivityPage({ cursor: query.cursor, hidden: isHidden(), inFlight: requestInFlight.current })) {
          setPollRevision(current => current + 1)
        }
        schedule()
      }, ACTIVITY_POLL_INTERVAL)
    }
    const handleVisibilityChange = () => schedule()

    document.addEventListener("visibilitychange", handleVisibilityChange)
    schedule()
    return () => {
      clearTimer()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [query.cursor, user.id, user.role, user.status])

  function load(filters, cursor = null) {
    setPage(null)
    setError("")
    setLoading(true)
    setQuery({ filters, cursor })
  }
  function apply(event) {
    event.preventDefault()
    try { const filters = activityFilters(draft); setValidation(""); load(filters) }
    catch (failure) { setValidation(failure.message) }
  }
  if (user.role !== "admin" || user.status !== "active") return null

  return <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="activity-title">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="activity-title" className="font-semibold text-gray-900">Histórico de atividades</h2><p className="text-sm text-gray-500">Ações administrativas e operacionais registradas</p></div>
      <button type="button" className={button} disabled={loading} onClick={() => load(query.filters)}>Atualizar listagem</button>
    </header>
    <form onSubmit={apply} className="mb-5 space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm text-gray-700">Usuário responsável (ID)<input className={control} value={draft.user_id} onChange={e => setDraft({ ...draft, user_id: e.target.value })} placeholder="Todos os usuários" /></label>
        <label className="text-sm text-gray-700">Ação<select className={control} value={draft.action} onChange={e => setDraft({ ...draft, action: e.target.value })}><option value="">Todas as ações</option>{Object.entries(ACTIVITY_ACTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm text-gray-700">Data inicial<input type="date" className={control} value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label>
        <label className="text-sm text-gray-700">Data final<input type="date" className={control} value={draft.end} min={draft.start || undefined} onChange={e => setDraft({ ...draft, end: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={loading}>Aplicar filtros</button><button type="button" className={button} disabled={loading} onClick={() => { setDraft(EMPTY); setValidation(""); load({}) }}>Limpar filtros</button></div>
      {validation && <p role="alert" className="text-sm text-red-600">{validation}</p>}
    </form>
    <div aria-live="polite" aria-busy={loading}>
      {loading && <p className="py-8 text-center text-sm text-gray-500">Carregando atividades…</p>}
      {error && <p role="alert" className="py-6 text-sm text-red-600">{error}</p>}
      {!loading && !error && page?.events.length === 0 && <p className="rounded-xl border border-dashed py-8 text-center text-sm text-gray-500">Nenhuma atividade encontrada para os filtros selecionados.</p>}
      <div className="space-y-3">{page?.events.map(event => {
        const date = new Date(event.occurred_at)
        const actor = activityActorLabel(event, user)
        const entity = { order: "Pedido", product: "Produto", profile: "Perfil" }[event.entity_type] || "Registro"
        return <article key={event.id} className="rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium text-gray-900">{ACTIVITY_ACTIONS[event.action] || "Atividade registrada"}</h3><time className="text-xs text-gray-500">{Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR")}</time></div>
          <p className="mt-1 break-words text-sm text-gray-600">Responsável: {actor}</p>
          <p className="break-words text-sm text-gray-600">{entity}{event.entity_id ? ` · ${event.entity_id}` : " · Identificação ainda não disponível"}</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">{activityDetails(event).map((line, index) => <li key={index} className="break-words">{line}</li>)}</ul>
        </article>
      })}</div>
    </div>
    {page && <footer className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-gray-500">{page.events.length} atividades nesta página</span>{page.has_more && <button type="button" className={button} disabled={loading} onClick={() => load(query.filters, page.next_cursor)}>Próxima página</button>}</footer>}
  </section>
}
