"use client"
import Link from "next/link"
import { Shield } from "lucide-react"

export default function SecuritySection() {
  return <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg"><Shield className="w-5 h-5 text-white" /></div>
      <div><h3 className="text-gray-900 font-semibold">Segurança</h3><p className="text-sm text-gray-500">Informações de acesso</p></div>
    </div>
    <p className="text-sm text-gray-600 mb-4">Para redefinir sua senha, solicite um link enviado ao seu e-mail cadastrado.</p>
    <Link href="/forgotPass" className="inline-block px-4 py-2 rounded-xl bg-purple-600 text-white text-sm">Redefinir senha por e-mail</Link>
  </div>
}
