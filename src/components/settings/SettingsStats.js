"use client"
import { useEffect, useState } from "react"
import { ShieldCheck, UserCheck } from "lucide-react"
import { getAdminUserStats } from "@/services/backend"

export default function SettingsStats({ user, revision = 0, onRetry }) {
  const [state, setState] = useState(null)
  useEffect(() => {
    if (user?.role !== "admin" || user?.status !== "active") return
    let active = true
    const controller = new AbortController()
    getAdminUserStats(controller.signal).then(value => {
      if (active) setState({ ...value, revision, owner: user.id })
    }).catch(() => {
      if (active) setState({ error: true, revision, owner: user.id })
    })
    return () => { active = false; controller.abort() }
  }, [user?.id, user?.role, user?.status, revision])
  if (user?.role !== "admin" || user?.status !== "active") return null
  const current = state?.revision === revision && state?.owner === user.id
  const stats = [
    { label: "Administradores ativos", key: "admins", Icon: ShieldCheck, color: "from-purple-500 to-purple-600" },
    { label: "Funcionários ativos", key: "employees", Icon: UserCheck, color: "from-orange-500 to-orange-600" },
  ]
  return <div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{stats.map(({ label, key, Icon, color }) =>
      <div key={key} className="bg-white rounded-xl p-4 shadow-sm border"><div className="flex items-center gap-3">
        <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center`}><Icon className="w-5 h-5 text-white" /></div>
        <div><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-bold text-gray-900">{current ? state.error ? "—" : state[key] : "Carregando..."}</p></div>
      </div></div>)}</div>
    {current && state.error && <div className="mt-2 text-sm text-red-600"><p role="alert">Não foi possível consultar os indicadores de usuários.</p><button type="button" onClick={onRetry} className="underline">Tentar novamente</button></div>}
  </div>
}
