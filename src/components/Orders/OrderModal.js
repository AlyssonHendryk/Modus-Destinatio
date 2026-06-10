"use client";

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, XCircle, Clock, Truck, ChevronDown } from 'lucide-react';

export default function OrderModal({ isOpen, onClose, onSave, orderToEdit, availableProducts = [], availableSuppliers = [] }) {
  if (!isOpen) return null;

  const [id, setId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [operation, setOperation] = useState('Venda');
  const [status, setStatus] = useState('Aguardando');
  const [items, setItems] = useState([]);

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isOperationOpen, setIsOperationOpen] = useState(false);

  useEffect(() => {
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
    setItems([...items, { productId: String(defaultProduct.id), product: defaultProduct.name, quantity: 1, price: 'R$ 0,00' }]);
  };

  const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));
  const handleItemChange = (index, field, value) => { const updatedItems = [...items]; updatedItems[index][field] = value; setItems(updatedItems); };
  const handleProductSelect = (index, productId) => {
    const selected = availableProducts.find(p => String(p.id) === String(productId));
    if (selected) {
      const updatedItems = [...items];
      updatedItems[index].productId = String(selected.id);
      updatedItems[index].product = selected.name;
      setItems(updatedItems);
    }
  };

  const getStatusStyles = (targetStatus) => {
    switch (targetStatus) {
      case "Concluído": return { text: "text-green-600 dark:text-green-400", border: "border-green-300 dark:border-green-800/60", icon: CheckCircle };
      case "Cancelado": return { text: "text-red-600 dark:text-red-400", border: "border-red-300 dark:border-red-800/60", icon: XCircle };
      case "Em rota": return { text: "text-blue-600 dark:text-blue-400", border: "border-blue-300 dark:border-blue-800/60", icon: Truck };
      default: return { text: "text-amber-500 dark:text-amber-400", border: "border-amber-300 dark:border-amber-800/60", icon: Clock };
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
    onSave({ id, supplier, operation, status, date: orderToEdit ? orderToEdit.date : today, total: totalCalculated !== "R$ 0,00" ? totalCalculated : (orderToEdit ? orderToEdit.total : "R$ 0,00"), items });
  };

  const currentStatusConfig = getStatusStyles(status);
  const StatusIcon = currentStatusConfig.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{orderToEdit ? `Editar ${id}` : 'Registrar Fluxo'}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Layout corrigido: Grid principal em 2 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Entidade / Fornecedor</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full px-4 py-2.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500/20">
                {availableSuppliers.map((sup) => <option key={sup} value={sup}>{sup}</option>)}
              </select>
            </div>

            {/* Sub-grid para Operação e Status ficarem alinhados lado a lado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Operação</label>
                <button type="button" onClick={() => setIsOperationOpen(!isOperationOpen)} className="w-full flex items-center justify-between px-3 py-2.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-sm">
                  <span className={operation === "Compra" ? "text-blue-600" : "text-purple-600"}>{operation}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {isOperationOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border rounded-xl shadow-xl z-50">
                    {["Venda", "Compra"].map(op => <button key={op} type="button" onClick={() => { setOperation(op); setIsOperationOpen(false); }} className="w-full text-left px-4 py-2 text-sm">{op}</button>)}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Status</label>
                <button type="button" onClick={() => setIsStatusOpen(!isStatusOpen)} className="w-full flex items-center justify-between px-3 py-2.5 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl text-sm">
                  <span className={`flex items-center gap-1 ${currentStatusConfig.text}`}><StatusIcon className="w-3.5 h-3.5"/> {status}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {isStatusOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border rounded-xl shadow-xl z-50 p-1">
                    {["Aguardando", "Em rota", "Concluído", "Cancelado"].map(st => <button key={st} type="button" onClick={() => { setStatus(st); setIsStatusOpen(false); }} className="w-full px-2 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">{st}</button>)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção Itens */}
          <div className="border-t pt-4">
             <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase">Lotes Movimentados</h3>
              <button type="button" onClick={handleAddItem} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">+ Vincular</button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2 mb-2 p-2 border rounded-xl">
                <select value={item.productId} onChange={(e) => handleProductSelect(index, e.target.value)} className="flex-1 bg-transparent text-sm border-none">
                  {availableProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-16 text-sm border-none text-center" />
                <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border rounded-xl text-sm">Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm">Salvar Operação</button>
          </div>
        </form>
      </div>
    </div>
  );
}