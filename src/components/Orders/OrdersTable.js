"use client";

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export function OrdersTable({ orders, onEditClick, onDeleteClick, onSave }) {
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 1;

  // 🎨 SINALIZAÇÃO VIVA: Uso de bg-transparent para evitar o bug do fundo acinzentado do CSS global no Modo Claro
  const getStatusConfig = (status) => {
    switch (status) {
      case 'Concluído':
        return { bg: 'bg-transparent', text: 'text-green-600 dark:text-green-400', border: 'border-green-300 dark:border-green-800/60', icon: CheckCircle };
      case 'Em rota':
        return { bg: 'bg-transparent', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-800/60', icon: Truck };
      case 'Cancelado':
        return { bg: 'bg-transparent', text: 'text-red-600 dark:text-red-400', border: 'border-red-300 dark:border-red-800/60', icon: XCircle };
      case 'Aguardando':
      case 'Pendente':
        return { bg: 'bg-transparent', text: 'text-amber-500 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-800/60', icon: Clock };
      default:
        return { bg: 'bg-transparent', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-700', icon: Clock };
    }
  };

  const toggleExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  return (
    /* Wrapper principal limpo para o CSS global ler as tabelas nativamente */
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-colors duration-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Id. Pedido</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Fornecedor</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Operação</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Valor Total</th>
              <th className="text-left py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders && orders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const StatusIcon = statusConfig.icon;
              const isExpanded = expandedOrder === order.id;

              return (
                <React.Fragment key={order.id}>
                  <tr
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => order.items && order.items.length > 0 && toggleExpand(order.id)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-semibold">{order.id}</span>
                        {order.items && order.items.length > 0 && (
                          <button className="text-gray-400 hover:text-gray-600" type="button">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-900 font-medium">{order.supplier || order.customer}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-700 font-medium">{order.operation || 'Venda'}</span>
                    </td>
                    <td className="py-4 px-6">
                      {/* 🛠️ BADGES CORRIGIDOS: Texto em font-bold e sem fundo para não gerar manchas */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-600 text-sm font-medium">{order.date}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-900 font-bold">{order.total || order.amount}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1">
                        {/* Editar */}
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-100 text-purple-600 rounded-lg transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditClick(order);
                          }}
                          title="Editar Pedido"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Excluir */}
                        <button
                          type="button"
                          className="p-2 hover:bg-red-50 text-red-500 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick(order.id);
                          }}
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Sub-tabela de Itens Expansível */}
                  {isExpanded && order.items && order.items.length > 0 && (
                    <tr>
                      <td colSpan={7} className="bg-transparent p-6">
                        <div className="bg-transparent rounded-xl border border-gray-200 p-6 shadow-inner">
                          <h4 className="text-gray-900 font-bold mb-4 text-sm uppercase tracking-wide">Itens do Pedido {order.id}</h4>

                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-200 bg-gray-50/30">
                                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Id Produto</th>
                                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Produto</th>
                                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Quantidade</th>
                                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Preço</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item, index) => (
                                  <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                                    <td className="py-3 px-4 text-gray-900 font-mono text-sm font-semibold">{item.productId}</td>
                                    <td className="py-3 px-4 text-gray-700 font-medium">{item.product}</td>
                                    <td className="py-3 px-4 text-gray-600 font-bold">{item.quantity}</td>
                                    <td className="py-3 px-4 text-gray-900 font-bold">{item.price}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="border-t border-gray-200 px-6 py-4 bg-transparent">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 font-medium">
            Mostrando página <span className="font-bold text-gray-900">{currentPage}</span> de <span className="font-bold text-gray-900">{totalPages}</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <div className="flex items-center gap-1">
              {[1].map((page) => (
                <button
                  type="button"
                  key={page}
                  className="w-10 h-10 rounded-lg text-sm font-bold transition-all bg-gradient-to-r from-purple-500 to-orange-500 text-white shadow-md"
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}