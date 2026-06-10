"use client";

import dynamic from 'next/dynamic';

// Carrega o Dashboard apenas no cliente, evitando o erro de renderização do servidor
const Dashboard = dynamic(() => import('@/components/Dashboard'), { 
  ssr: false 
});

export default function DashboardPage() {
  return <Dashboard />;
}