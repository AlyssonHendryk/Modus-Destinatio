"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Clock, FilterX, History, Search } from "lucide-react"
import { ORDER_STATUS } from "@/utils/formatters"
import { INITIAL_HISTORY_ORDER_LIMIT, filterHistoricalOrders, getHistoricalOrderDateLabel, splitSeparationOrders, visibleHistoricalOrders } from "@/utils/orderSeparationPresentation"

export default function OrderSeparationHistory({ orders = [] }) {
  const [search, setSearch] = useState("")
  const [period, setPeriod] = useState("all")
  const [expanded, setExpanded] = useState(false)
  const [detailsOrderId, setDetailsOrderId] = useState(null)
  const historyCount = splitSeparationOrders(orders).history.length
  const filteredOrders = useMemo(() => filterHistoricalOrders(orders, { search, period }), [orders, search, period])
  const visibleOrders = useMemo(() => visibleHistoricalOrders(filteredOrders, expanded), [filteredOrders, expanded])
  const hasMore = filteredOrders.length > INITIAL_HISTORY_ORDER_LIMIT
  const hasFilters = Boolean(search || period !== "all")
  const usesUpdatedAt = filteredOrders.some((order) => Boolean(order.updated_at))

  function updateSearch(value) {
    setSearch(value)
    setExpanded(false)
    setDetailsOrderId(null)
  }

  function updatePeriod(value) {
    setPeriod(value)
    setExpanded(false)
    setDetailsOrderId(null)
  }

  function clearFilters() {
    setSearch("")
    setPeriod("all")
    setExpanded(false)
    setDetailsOrderId(null)
  }

  const counter = hasFilters
    ? `${visibleOrders.length} de ${filteredOrders.length} pedidos filtrados exibidos (${historyCount} carregados)`
    : `${visibleOrders.length} de ${historyCount} pedidos carregados exibidos`

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><History className="h-5 w-5 text-purple-600" /><div><h2 className="font-semibold text-gray-900">Histórico de pedidos</h2><p className="text-sm text-gray-500">Pedidos concluídos, cancelados e enviados já carregados.</p></div></div><p className="text-sm text-gray-500 sm:text-right" aria-live="polite">{counter}</p></header>

      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)]"><div className="space-y-1"><label htmlFor="history-order-search" className="block text-sm font-medium text-gray-700">Pesquisar pedido</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input id="history-order-search" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="ID, cliente, fornecedor ou produto" className="form-control h-11 w-full rounded-lg py-2 pl-10 pr-3 text-sm text-gray-900" /></div></div><div className="space-y-1"><label htmlFor="history-order-period" className="block text-sm font-medium text-gray-700">Período</label><select id="history-order-period" value={period} onChange={(event) => updatePeriod(event.target.value)} className="form-control h-11 w-full rounded-lg px-3 text-sm text-gray-900"><option value="all">Todos</option><option value="last7days">Últimos 7 dias</option><option value="lastMonth">Último mês</option></select></div></div>
      <div className="mb-5 mt-3 flex justify-end"><button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-purple-700 hover:bg-purple-50 hover:text-purple-800 focus-visible:outline-2 focus-visible:outline-purple-600 disabled:cursor-not-allowed disabled:opacity-50"><FilterX className="h-4 w-4" />Limpar filtros</button></div>

      {!usesUpdatedAt && historyCount > 0 && <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">Ordenação e período usam a data do pedido disponível. A API atual não fornece a data da última atualização.</p>}

      {historyCount === 0 ? <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center"><History className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p className="text-sm font-medium text-gray-700">Nenhum pedido no histórico</p><p className="mt-1 text-xs text-gray-500">Pedidos concluídos, cancelados ou enviados aparecerão aqui.</p></div> : filteredOrders.length === 0 ? <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center"><Search className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p className="text-sm font-medium text-gray-700">Nenhum pedido encontrado com estes filtros</p><button type="button" onClick={clearFilters} className="mt-3 text-sm font-medium text-purple-700 hover:underline">Limpar filtros</button></div> : <div className="space-y-2">{visibleOrders.map((order) => { const detailsOpen = detailsOrderId === order.id; return <article key={order.id} className="rounded-xl border border-gray-200"><button type="button" onClick={() => setDetailsOrderId((current) => current === order.id ? null : order.id)} aria-expanded={detailsOpen} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-purple-600"><div className="min-w-0"><p className="font-medium text-gray-900">Pedido {order.id}</p><p className="text-sm text-gray-700">{order.customer || "Cliente não informado"}</p>{order.supplier && <p className="text-xs text-gray-500">Fornecedor: {order.supplier}</p>}<p className="mt-1 text-xs text-gray-500">{getHistoricalOrderDateLabel(order)}</p></div><div className="flex items-center gap-3"><span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">{ORDER_STATUS[order.status] || order.status}</span>{detailsOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}</div></button>{detailsOpen && <div className="border-t border-gray-200 px-4 py-3"><p className="mb-2 text-xs font-medium uppercase text-gray-500">Produtos e quantidades</p>{(order.items || []).length === 0 ? <p className="text-sm text-gray-500">Itens indisponíveis.</p> : <ul className="space-y-1">{order.items.map((item, index) => <li key={`${item.productId}-${index}`} className="flex justify-between gap-3 text-sm text-gray-700"><span>{item.product}</span><span className="font-medium">{item.quantity} un</span></li>)}</ul>}</div>}</article>})}{hasMore && <div className="flex justify-center pt-2"><button type="button" onClick={() => setExpanded((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-purple-600">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{expanded ? "Ver menos" : "Ver mais pedidos"}</button></div>}</div>}
    </section>
  )
}
