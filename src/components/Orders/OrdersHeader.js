import { Plus } from 'lucide-react';

export function OrdersHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-gray-900 mb-1 text-2xl font-bold">Pedidos</h1>
        <p className="text-gray-500 text-sm">Gerenciamento e fluxo de entregas</p>
      </div>

      <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#F97316] to-[#FB923C] hover:from-[#EA580C] hover:to-[#F97316] text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-medium">
        <Plus className="w-5 h-5" />
        <span>Novo Pedido</span>
      </button>
    </div>
  );
}
