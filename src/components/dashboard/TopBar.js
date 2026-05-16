import { Search, Bell, User } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar pedidos, produtos..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2.5 hover:bg-gray-100 rounded-xl transition-all">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="text-right">
              <p className="text-sm text-gray-900">Bruno</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#F97316] rounded-full flex items-center justify-center">
              <span className="text-white">B</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
