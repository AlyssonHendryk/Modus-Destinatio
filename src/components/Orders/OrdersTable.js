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

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Concluído':
        return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle };
      case 'Em rota':
        return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: Truck };
      case 'Cancelado':
        return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle };
      case 'Aguardando':
        return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: Clock };
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', icon: Clock };
    }
  };

  const toggleExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Id. Pedido</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Fornecedor</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Operação</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Data</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Valor Total</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
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
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => order.items && order.items.length > 0 && toggleExpand(order.id)}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-medium">{order.id}</span>
                        {order.items && order.items.length > 0 && (
                          <button className="text-gray-400 hover:text-gray-600" type="button">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-900">{order.supplier}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-600">{order.operation}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-600 text-sm">{order.date}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-900 font-medium">{order.total}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {/* Editar */}
                        <button
                          type="button"
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
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
                          className="p-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-colors"
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

                  {isExpanded && order.items && order.items.length > 0 && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50/30 p-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                          <h4 className="text-gray-900 font-semibold mb-4 text-base">Itens do Pedido {order.id}</h4>

                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Id Produto</th>
                                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Produto</th>
                                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantidade</th>
                                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Preço</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item, index) => (
                                  <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/30">
                                    <td className="py-3 px-4 text-gray-900 font-mono text-sm">{item.productId}</td>
                                    <td className="py-3 px-4 text-gray-900">{item.product}</td>
                                    <td className="py-3 px-4 text-gray-600">{item.quantity}</td>
                                    <td className="py-3 px-4 text-gray-900 font-medium">{item.price}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-sm text-gray-500 mt-4">
                            Mostrando 1 até {order.items.length} de {order.items.length} registros
                          </p>
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

      <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/30">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Mostrando página <span className="font-medium text-gray-900">{currentPage}</span> de <span className="font-medium text-gray-900">{totalPages}</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
                  className="w-10 h-10 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-[#7C3AED] to-[#F97316] text-white shadow-md"
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-100 text-gray-400 cursor-not-allowed"
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