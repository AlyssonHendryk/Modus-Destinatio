"use client";

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

export default function OrderModal({ isOpen, onClose, onSave, orderToEdit }) {
  if (!isOpen) return null;

  const [id, setId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [operation, setOperation] = useState('Venda');
  const [status, setStatus] = useState('Aguardando');
  const [items, setItems] = useState([]);

  // Preenche se for edição
  useEffect(() => {
    if (orderToEdit) {
      setId(orderToEdit.id);
      setSupplier(orderToEdit.supplier);
      setOperation(orderToEdit.operation);
      setStatus(orderToEdit.status);
      setItems(orderToEdit.items || []);
    } else {
      setId(`#${Math.floor(1000 + Math.random() * 9000)}`); // Gera ID aleatório temporário
      setSupplier('');
      setOperation('Venda');
      setStatus('Aguardando');
      setItems([]);
    }
  }, [orderToEdit, isOpen]);

  const handleAddItem = () => {
    setItems([...items, { productId: String(Math.floor(100 + Math.random() * 900)), product: '', quantity: 1, price: 'R$ 0,00' }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    setItems(updatedItems);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Calcular valor total baseado nos itens inseridos (opcional/básico)
    let totalCalculated = "R$ 0,00";
    if (items.length > 0) {
      const sum = items.reduce((acc, item) => {
        const numericPrice = parseFloat(item.price.replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;
        return acc + (numericPrice * item.quantity);
      }, 0);
      totalCalculated = `R$ ${sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

    onSave({
      id,
      supplier,
      operation,
      status,
      date: orderToEdit ? orderToEdit.date : today,
      total: totalCalculated !== "R$ 0,00" ? totalCalculated : (orderToEdit ? orderToEdit.total : "R$ 0,00"),
      items
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {orderToEdit ? `Editar Pedido ${id}` : 'Criar Novo Pedido'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Fornecedor</label>
              <input
                type="text"
                required
                placeholder="Ex: Coca Cola"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Operação</label>
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                >
                  <option value="Venda">Venda</option>
                  <option value="Compra">Compra</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                >
                  <option value="Aguardando">Aguardando</option>
                  <option value="Em rota">Em rota</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Seção Itens do Pedido */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Itens do Pedido</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Nenhum item adicionado a este pedido ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-50/50 p-2 border border-gray-100 rounded-xl">
                    <input
                      type="text"
                      placeholder="Nome do produto"
                      required
                      value={item.product}
                      onChange={(e) => handleItemChange(index, 'product', e.target.value)}
                      className="flex-1 min-w-[120px] px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-all font-medium"
                    />
                    <input
                      type="number"
                      placeholder="Qtd"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-all text-center font-semibold"
                    />
                    <input
                      type="text"
                      placeholder="R$ 0,00"
                      required
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      className="w-24 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-all text-right font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Ações */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all text-sm"
            >
              Salvar Pedido
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}