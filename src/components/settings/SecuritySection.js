"use client"

import { useState } from "react"
import {
  Shield,
  Monitor,
  Clock,
  LogOut,
  X,
  Check
} from "lucide-react"

export default function SecuritySection({ onUpdatePassword }) {
  // Estado para controlar se o formulário de alterar senha está aberto
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  // Estados para os inputs das senhas
  const [currentPasswordInput, setCurrentPasswordInput] = useState("")
  const [newPasswordInput, setNewPasswordInput] = useState("")

  const handlePasswordSubmit = (e) => {
    e.preventDefault()

    if (!currentPasswordInput || !newPasswordInput.trim()) {
      alert("⚠️ Preencha todos os campos de senha!")
      return
    }

    // Executa a função do arquivo pai (page.js)
    if (onUpdatePassword) {
      const success = onUpdatePassword(currentPasswordInput, newPasswordInput)
      
      if (success) {
        // Se deu certo, limpa os campos e fecha o formulário
        setCurrentPasswordInput("")
        setNewPasswordInput("")
        setIsChangingPassword(false)
      }
    }
  }

  const handleLogoutOthers = () => {
    alert("✅ Outras sessões encerradas com sucesso!")
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
          <Shield className="w-5 h-5 text-white" />
        </div>

        <div>
          <h3 className="text-gray-900 font-semibold">
            Segurança
          </h3>
          <p className="text-sm text-gray-500">
            Informações de acesso
          </p>
        </div>
      </div>

      {/* Condicional: Exibe as informações normais OU o formulário de senha */}
      {!isChangingPassword ? (
        <>
          {/* Informações normais */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Último Acesso</p>
                <p className="text-sm text-gray-900">Hoje, 14:23</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Monitor className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Dispositivo</p>
                <p className="text-sm text-gray-900">Chrome - Windows 11</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Senha Alterada</p>
                <p className="text-sm text-gray-900">Recentemente</p>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsChangingPassword(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl shadow-lg transition-all duration-300 cursor-pointer font-medium"
            >
              <Shield className="w-4 h-4" />
              <span className="text-sm">Alterar Senha</span>
            </button>

            <button
              type="button"
              onClick={handleLogoutOthers}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl transition-all duration-300 cursor-pointer font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Encerrar Outras Sessões</span>
            </button>
          </div>
        </>
      ) : (
        /* Formulário Inline de Alterar Senha */
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Senha Atual</label>
            <input
              type="password"
              placeholder="Digite a senha atual"
              value={currentPasswordInput}
              onChange={(e) => setCurrentPasswordInput(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nova Senha</label>
            <input
              type="password"
              placeholder="Digite a nova senha"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsChangingPassword(false)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all cursor-pointer text-sm font-medium"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl shadow-lg transition-all cursor-pointer text-sm font-medium"
            >
              <Check className="w-4 h-4" /> Confirmar
            </button>
          </div>
        </form>
      )}

    </div>
  )
}