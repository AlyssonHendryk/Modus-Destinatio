"use client"
import { Users, ShieldCheck, UserCheck, Clock } from "lucide-react"
export default function SettingsStats({ users = [] }) {
  const active=users.filter(u=>u.status==="active").length
  const admins=users.filter(u=>u.type==="admin").length
  const employees=users.filter(u=>u.type==="employee").length
  const stats=[{label:"Usuários Ativos",value:active,icon:Users,color:"from-blue-500 to-blue-600"},{label:"Administradores",value:admins,icon:ShieldCheck,color:"from-purple-500 to-purple-600"},{label:"Funcionários",value:employees,icon:UserCheck,color:"from-orange-500 to-orange-600"},{label:"Sessão",value:"Ativa",icon:Clock,color:"from-green-500 to-green-600"}]
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">{stats.map(s=>{const Icon=s.icon;return <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border"><div className="flex items-center gap-3"><div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-lg flex items-center justify-center`}><Icon className="w-5 h-5 text-white"/></div><div><p className="text-xs text-gray-500">{s.label}</p><p className="text-lg font-bold text-gray-900">{s.value}</p></div></div></div>})}</div>
}
