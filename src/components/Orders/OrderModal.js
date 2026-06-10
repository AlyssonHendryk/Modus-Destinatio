"use client";

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, XCircle, Clock, Truck, ChevronDown } from 'lucide-react';

// 🛠️ MUDANÇA: Agora recebe 'availableSuppliers' vindo do estado do Dashboard pai
export default function OrderModal({ isOpen, onClose, onSave, orderToEdit, availableProducts = [], availableSuppliers = [] }) {
  if (!isOpen) return null;

  const [id, setId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [operation, setOperation] = useState('Venda');
  const [status, setStatus] = useState('Aguardando');
  const [items, setItems] = useState([]);

  // Estados para gerenciar a abertura dos menus de seleção customizados
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isOperationOpen, setIsOperationOpen] = useState(false);


  useEffect(() => {
    // Garante que temos um fornecedor padrão caso a lista venha do pai
    const defaultSupplier = availableSuppliers[0] || "Nenhum fornecedor cadastrado";

    if (orderToEdit) {
      setId(orderToEdit.id);
      setSupplier(orderToEdit.supplier || defaultSupplier);
      setOperation(orderToEdit.operation);
      setStatus(orderToEdit.status);
      setItems(orderToEdit.items || []);
    } else {
      setId(`#${Math.floor(1000 + Math.random() * 9000)}`);
      setSupplier(defaultSupplier); 
      setOperation('Venda');
      setStatus('Aguardando');
      setItems([]);
    }
  }, [orderToEdit, isOpen, availableSuppliers]);

  const handleAddItem = () => {
    const defaultProduct = availableProducts[0] || { id: "101", name: "Item Padrão" };
    setItems([...items, { 
      productId: String(defaultProduct.id), 
      product: defaultProduct.name, 
      quantity: 1, 
      price: 'R$ 0,00' 
    }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    setItems(updatedItems);
  };

  const handleProductSelect = (index, productId) => {
    const selected = availableProducts.find(p => String(p.id) === String(productId));
    if (selected) {
      const updatedItems = [...items];
      updatedItems[index].productId = String(selected.id);
      updatedItems[index].product = selected.name;
      setItems(updatedItems);
    }
  };

  // 🎨 CONFIGURAÇÃO DE ESTILO E CORES PARA OS DROPDOWNS CUSTOMIZADOS
  const getStatusStyles = (targetStatus) => {
    switch (targetStatus) {
      case "Concluído":
        return { text: "text-green-600 dark:text-green-400", border: "border-green-300 dark:border-green-800/60", icon: CheckCircle };
      case "Cancelado":
        return { text: "text-red-600 dark:text-red-400", border: "border-red-300 dark:border-red-800/60", icon: XCircle };
      case "Em rota":
        return { text: "text-blue-600 dark:text-blue-400", border: "border-blue-300 dark:border-blue-800/60", icon: Truck };
      default:
        return { text: "text-amber-500 dark:text-amber-400", border: "border-amber-300 dark:border-amber-800/60", icon: Clock };
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

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

  const currentStatusConfig = getStatusStyles(status);
  const StatusIcon = currentStatusConfig.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 transition-colors duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {orderToEdit ? `Editar Movimentação ${id}` : 'Registrar Fluxo de Estoque'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 rounded-xl transition-colors cursor-pointer group">
            <X className="w-5 h-5 group-hover:text-gray-700 dark:group-hover:text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Seletor de Parceiro Comercial / Fornecedor Dinâmico */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Entidade / Fornecedor</label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-4 py-2.5 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium cursor-pointer"
              >
                {availableSuppliers.length === 0 ? (
                  <option value="">Nenhum fornecedor cadastrado</option>
                ) : (
                  availableSuppliers.map((sup) => (
                    <option key={sup} value={sup} className="dark:bg-gray-800">{sup}</option>
                  ))
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              
              {/* Seletor Estilizado de Operação */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Operação</label>
                <button
                  type="button"
                  onClick={() => { setIsOperationOpen(!isOperationOpen); setIsStatusOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <span className={operation === "Compra" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"}>
                    {operation}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {isOperationOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    {["Venda", "Compra"].map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => { setOperation(op); setIsOperationOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${op === "Compra" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"}`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Seletor Estilizado de Status */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Status</label>
                <button
                  type="button"
                  onClick={() => { setIsStatusOpen(!isStatusOpen); setIsOperationOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-transparent ${currentStatusConfig.text} ${currentStatusConfig.border}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {status}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {isStatusOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-1 space-y-1">
                    {["Aguardando", "Em rota", "Concluído", "Cancelado"].map((st) => {
                      const cfg = getStatusStyles(st);
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => { setStatus(st); setIsStatusOpen(false); }}
                          className="w-full flex items-center px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-transparent ${cfg.text} ${cfg.border}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {st}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Seção Itens do Pedido */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lotes Movimentados</h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-bold border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Vincular Item
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 bg-transparent rounded-xl border border-dashed border-gray-300 dark:border-gray-700 font-medium">
                Nenhum sku ou insumo vinculado a esta movimentação.
              </p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 bg-transparent p-2 border border-gray-200 dark:border-gray-700 rounded-xl">
                    
                    <select
                      value={item.productId}
                      onChange={(e) => handleProductSelect(index, e.target.value)}
                      className="flex-1 min-w-[140px] px-3 py-1.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 transition-all font-medium cursor-pointer"
                    >
                      {availableProducts.length === 0 ? (
                        <option value="">Nenhum produto cadastrado</option>
                      ) : (
                        availableProducts.map(prod => (
                          <option key={prod.id} value={prod.id} className="dark:bg-gray-800">
                            [{prod.id}] - {prod.name}
                          </option>
                        ))
                      )}
                    </select>

                    <input
                      type="number"
                      placeholder="Qtd"
                      min="1"
                      required
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 transition-all text-center font-bold"
                    />
                    <input
                      type="text"
                      placeholder="R$ 0,00"
                      required
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      className="w-24 px-2 py-1.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 transition-all text-right font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Ações */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-transparent border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all text-sm cursor-pointer"
            >
              Salvar Operação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 