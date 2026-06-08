import { OrdersHeader } from '@/components/Orders/OrdersHeader';
import { OrdersStats } from '@/components/Orders/OrdersStats';
import { OrdersTable } from '@/components/Orders/OrdersTable';

export default function PedidosPage() {
  return (
    
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto w-full">
      
     
      <OrdersHeader />
      
     
      <OrdersStats />
      
      
      <OrdersTable />
      
    </div>
  );
}
