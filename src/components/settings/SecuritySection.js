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
    /* Mantido o bg-white e borda padrão para a interceptação global funcionar de forma limpa */
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-colors duration-200">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-lg">
          <Shield className="w-5 h-5 text-white" />
        </div>

        <div>
          <h3 className="text-gray-900 font-bold text-lg">
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
          {/* Informações normais (Corrigido com bordas finas e ícones vivos) */}
          <div className="space-y-4 mb-6">
            
            {/* Último Acesso: Ícone Azul Forte */}
            <div className="flex items-start gap-3 p-4 bg-transparent border border-gray-100 rounded-xl transition-colors">
              <div className="w-10 h-10 border border-blue-200 dark:border-blue-900/40 rounded-lg flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Último Acesso</p>
                <p className="text-sm font-semibold text-gray-900">Hoje, 14:23</p>
              </div>
            </div>

            {/* Dispositivo: Ícone Roxo Forte */}
            <div className="flex items-start gap-3 p-4 bg-transparent border border-gray-100 rounded-xl transition-colors">
              <div className="w-10 h-10 border border-purple-200 dark:border-purple-900/40 rounded-lg flex items-center justify-center shrink-0">
                <Monitor className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Dispositivo</p>
                <p className="text-sm font-semibold text-gray-900">Chrome - Windows 11</p>
              </div>
            </div>

            {/* Senha Alterada: Ícone Laranja Forte */}
            <div className="flex items-start gap-3 p-4 bg-transparent border border-gray-100 rounded-xl transition-colors">
              <div className="w-10 h-10 border border-orange-200 dark:border-orange-900/40 rounded-lg flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Senha Alterada</p>
                <p className="text-sm font-semibold text-gray-900">Recentemente</p>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsChangingPassword(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl shadow-md transition-all duration-300 cursor-pointer font-semibold text-sm"
            >
              <Shield className="w-4 h-4" />
              <span>Alterar Senha</span>
            </button>

            {/* 🛠️ SOLUÇÃO DEFINITIVA: Mudado para o vermelho sólido de alerta idêntico ao Danger Zone.
               O texto e o ícone em branco agora saltam aos olhos e o CSS global não interfere mais. */}
            <button
              type="button"
              onClick={handleLogoutOthers}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer font-semibold text-sm"
            >
              <LogOut className="w-4 h-4 text-white" />
              <span>Encerrar Outras Sessões</span>
            </button>
          </div>
        </>
      ) : (
        /* Formulário Inline de Alterar Senha */
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Senha Atual</label>
            <input
              type="password"
              placeholder="Digite a senha atual (padrão: 123)"
              value={currentPasswordInput}
              onChange={(e) => setCurrentPasswordInput(e.target.value)}
              className="w-full p-3 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nova Senha</label>
            <input
              type="password"
              placeholder="Digite a nova senha"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-full p-3 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsChangingPassword(false)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl transition-all cursor-pointer text-sm font-semibold"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl shadow-md transition-all cursor-pointer text-sm font-semibold"
            >
              <Check className="w-4 h-4" /> Confirmar
            </button>
          </div>
        </form>
      )}

    </div>
  )
}