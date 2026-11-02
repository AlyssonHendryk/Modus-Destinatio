"use client"

import { useMemo, useState } from "react"
import { useApp } from "@/context/AppContext"
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, FilterX, History, Search } from "lucide-react"
import { INITIAL_MOVEMENT_LIMIT, filterStockMovements, visibleStockMovements } from "@/utils/stockMovementPresentation"

export default function StockMovementHistory() {
  const { stockMovements = [], inventory = [] } = useApp()
  const [search, setSearch] = useState("")
  const [movementType, setMovementType] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [expanded, setExpanded] = useState(false)

  function updateFilter(setter, value) {
    setter(value)
    setExpanded(false)
  }

  function getProductName(productId) {
    return inventory.find((item) => item.id === productId)?.name || productId
  }

  function formatDate(date) {
    const parsedDate = new Date(date)
    return Number.isNaN(parsedDate.getTime()) ? "Data indisponível" : parsedDate.toLocaleString("pt-BR")
  }

  function clearFilters() {
    setSearch("")
    setMovementType("all")
    setStartDate("")
    setEndDate("")
    setExpanded(false)
  }

  const filteredMovements = useMemo(
    () => filterStockMovements(stockMovements, inventory, { search, movementType, startDate, endDate }),
    [stockMovements, inventory, search, movementType, startDate, endDate]
  )
  const visibleMovements = useMemo(
    () => visibleStockMovements(filteredMovements, expanded),
    [filteredMovements, expanded]
  )
  const hasMore = filteredMovements.length > INITIAL_MOVEMENT_LIMIT
  const hasActiveFilters = Boolean(search || movementType !== "all" || startDate || endDate)
  const counter = hasActiveFilters
    ? `${visibleMovements.length} de ${filteredMovements.length} resultados filtrados exibidos (${stockMovements.length} registros carregados)`
    : `${visibleMovements.length} de ${stockMovements.length} registros carregados exibidos`

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><History className="h-5 w-5 text-purple-600" /><div><h2 className="font-semibold text-gray-900">Histórico de movimentações</h2><p className="text-sm text-gray-500">Entradas e saídas registradas no estoque</p></div></div>
        <p className="text-sm text-gray-500 sm:text-right" aria-live="polite">{counter}</p>
      </header>

      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]">
        <div className="space-y-1"><label htmlFor="movement-search" className="block text-sm font-medium text-gray-700">Buscar produto ou ID</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input id="movement-search" type="text" value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Nome ou ID do produto" className="form-control h-11 w-full rounded-lg py-2 pl-10 pr-3 text-sm text-gray-900" /></div></div>
        <div className="space-y-1"><label htmlFor="movement-type" className="block text-sm font-medium text-gray-700">Tipo de movimentação</label><select id="movement-type" value={movementType} onChange={(event) => updateFilter(setMovementType, event.target.value)} className="form-control h-11 w-full rounded-lg px-3 text-sm text-gray-900"><option value="all">Todas</option><option value="entry">Entradas</option><option value="exit">Saídas</option></select></div>
        <div className="space-y-1"><label htmlFor="movement-start-date" className="block text-sm font-medium text-gray-700">Data inicial</label><input id="movement-start-date" type="date" value={startDate} onChange={(event) => updateFilter(setStartDate, event.target.value)} className="form-control h-11 w-full rounded-lg px-3 text-sm text-gray-900" /></div>
        <div className="space-y-1"><label htmlFor="movement-end-date" className="block text-sm font-medium text-gray-700">Data final</label><input id="movement-end-date" type="date" value={endDate} min={startDate || undefined} onChange={(event) => updateFilter(setEndDate, event.target.value)} className="form-control h-11 w-full rounded-lg px-3 text-sm text-gray-900" /></div>
      </div>

      <div className="mb-5 mt-3 flex justify-end"><button type="button" onClick={clearFilters} disabled={!hasActiveFilters} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-purple-700 hover:bg-purple-50 hover:text-purple-800 focus-visible:outline-2 focus-visible:outline-purple-600 disabled:cursor-not-allowed disabled:opacity-50"><FilterX className="h-4 w-4" />Limpar filtros</button></div>

      {filteredMovements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center"><History className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p className="text-sm font-medium text-gray-700">Nenhuma movimentação encontrada</p><p className="mt-1 text-xs text-gray-500">Ajuste os filtros para visualizar outros registros.</p></div>
      ) : (
        <div className="space-y-3">
          {visibleMovements.map((movement) => {
            const isEntry = movement.delta > 0
            return <article key={movement.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 p-4"><div className="flex min-w-0 items-center gap-3">{isEntry ? <ArrowUp className="h-5 w-5 shrink-0 text-green-600" /> : <ArrowDown className="h-5 w-5 shrink-0 text-red-600" />}<div className="min-w-0"><p className="truncate font-medium text-gray-900">{getProductName(movement.product_id)}</p><p className="text-xs text-gray-500">ID: {movement.product_id}</p><p className="mt-1 text-xs text-gray-500">{formatDate(movement.created_at)}</p></div></div><div className="text-right"><p className={`font-semibold ${isEntry ? "text-green-600" : "text-red-600"}`}>{isEntry ? "+" : ""}{movement.delta} un</p><p className="mt-1 text-xs text-gray-500">{movement.previous_quantity} → {movement.new_quantity} un</p><p className="mt-1 text-xs text-gray-400">{isEntry ? "Entrada" : "Saída"}</p></div></article>
          })}
          {hasMore && <div className="flex justify-center pt-1"><button type="button" onClick={() => setExpanded((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-purple-600">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{expanded ? "Ver menos" : "Ver mais movimentações"}</button></div>}
        </div>
      )}
    </section>
  )
}
