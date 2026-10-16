
"use client"

import { useMemo, useState } from "react"
import { useApp } from "@/context/AppContext"
import {
  ArrowDown,
  ArrowUp,
  History,
  Search,
  FilterX,
} from "lucide-react"

export default function StockMovementHistory() {
  const {
    stockMovements = [],
    inventory = [],
  } = useApp()

  // ============================================================
  // ESTADOS DOS FILTROS
  // ============================================================

  const [search, setSearch] = useState("")
  const [movementType, setMovementType] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // ============================================================
  // FUNÇÕES AUXILIARES
  // ============================================================

  function getProductName(productId) {
    const product = inventory.find(
      (item) => item.id === productId
    )

    return product?.name || productId
  }

  function formatDate(date) {
    const parsedDate = new Date(date)

    if (Number.isNaN(parsedDate.getTime())) {
      return "Data indisponível"
    }

    return parsedDate.toLocaleString("pt-BR")
  }

  function clearFilters() {
    setSearch("")
    setMovementType("all")
    setStartDate("")
    setEndDate("")
  }

  // ============================================================
  // FILTRAGEM DAS MOVIMENTAÇÕES
  // ============================================================

  const filteredMovements = useMemo(() => {
    const query = search.trim().toLowerCase()

    return stockMovements.filter((movement) => {
      const productId = String(
        movement.product_id ?? ""
      )

      const product = inventory.find(
        (item) => item.id === productId
      )

      const productName = String(
        product?.name ?? ""
      ).toLowerCase()

      // Filtro por nome ou ID do produto
      const matchesSearch =
        !query ||
        productId.toLowerCase().includes(query) ||
        productName.includes(query)

      // Filtro por tipo de movimentação
      const matchesType =
        movementType === "all" ||
        (movementType === "entry" && movement.delta > 0) ||
        (movementType === "exit" && movement.delta < 0)

      // Filtro por período
      const movementDate = new Date(movement.created_at)

      if (Number.isNaN(movementDate.getTime())) {
        return false
      }

      const dateString = [
        movementDate.getFullYear(),
        String(movementDate.getMonth() + 1).padStart(2, "0"),
        String(movementDate.getDate()).padStart(2, "0"),
      ].join("-")

      const matchesStartDate =
        !startDate || dateString >= startDate

      const matchesEndDate =
        !endDate || dateString <= endDate

      return (
        matchesSearch &&
        matchesType &&
        matchesStartDate &&
        matchesEndDate
      )
    })
  }, [
    stockMovements,
    inventory,
    search,
    movementType,
    startDate,
    endDate,
  ])

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

      {/* CABEÇALHO */}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-purple-600" />

          <div>
            <h2 className="font-semibold text-gray-900">
              Histórico de movimentações
            </h2>

            <p className="text-sm text-gray-500">
              Entradas e saídas registradas no estoque
            </p>
          </div>
        </div>

        <span className="text-sm text-gray-500">
          {filteredMovements.length} de {stockMovements.length} movimentações
        </span>
      </div>

      {/* FILTROS */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-6">

        {/* PESQUISA POR PRODUTO */}

        <div className="relative xl:col-span-2">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto ou ID..."
            aria-label="Buscar produto ou ID"
            className="w-full border border-gray-200 rounded-lg py-2 pl-10 pr-3 text-sm text-gray-900 bg-white"
          />
        </div>

        {/* TIPO DE MOVIMENTAÇÃO */}

        <select
          value={movementType}
          onChange={(event) => setMovementType(event.target.value)}
          aria-label="Tipo de movimentação"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
        >
          <option value="all">Todas</option>
          <option value="entry">Entradas</option>
          <option value="exit">Saídas</option>
        </select>

        {/* DATA INICIAL */}

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Data inicial
          </label>

          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
          />
        </div>

        {/* DATA FINAL */}

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Data final
          </label>

          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
          />
        </div>
      </div>

      {/* LIMPAR FILTROS */}

      <div className="flex justify-end mb-5">
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800"
        >
          <FilterX className="w-4 h-4" />
          Limpar filtros
        </button>
      </div>

      {/* LISTA DE MOVIMENTAÇÕES */}

      {filteredMovements.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
          <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />

          <p className="text-sm font-medium text-gray-700">
            Nenhuma movimentação encontrada
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Ajuste os filtros para visualizar outros registros.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMovements.map((movement) => {
            const isEntry = movement.delta > 0

            return (
              <div
                key={movement.id}
                className="flex flex-wrap items-center justify-between gap-4 border border-gray-200 rounded-xl p-4"
              >
                {/* IDENTIFICAÇÃO */}

                <div className="flex items-center gap-3">
                  {isEntry ? (
                    <ArrowUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <ArrowDown className="w-5 h-5 text-red-600" />
                  )}

                  <div>
                    <p className="font-medium text-gray-900">
                      {getProductName(movement.product_id)}
                    </p>

                    <p className="text-xs text-gray-500">
                      ID: {movement.product_id}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(movement.created_at)}
                    </p>
                  </div>
                </div>

                {/* QUANTIDADES */}

                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      isEntry
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {isEntry ? "+" : ""}
                    {movement.delta} un
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {movement.previous_quantity} →{" "}
                    {movement.new_quantity} un
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    {isEntry ? "Entrada" : "Saída"}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
