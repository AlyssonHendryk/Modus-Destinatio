"use client"

import { useState } from "react"
import {
  Mail,
  Phone,
  Calendar,
  Edit,
  Save,
  X,
  Camera
} from "lucide-react"

export default function ProfileSection({ currentUser, setCurrentUser }) {
  // Controle para saber se o usuário está editando ou apenas visualizando
  const [isEditing, setIsEditing] = useState(false)
  
  // Estados locais para controlar os inputs do formulário temporariamente
  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || ""
  })

  // Ativa o modo de edição carregando os dados atuais do usuário
  const startEditing = () => {
    setFormData({
      name: currentUser?.name || "",
      email: currentUser?.email || "",
      phone: currentUser?.phone || ""
    })
    setIsEditing(true)
  }

  // Cancela as alterações e fecha o formulário
  const cancelEditing = () => {
    setIsEditing(false)
  }

  // Salva os dados de verdade enviando para o estado global (page.js)
  const handleSave = (e) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert("O nome não pode ficar vazio!")
      return
    }

    setCurrentUser({
      ...currentUser,
      name: formData.name,
      email: formData.email,
      phone: formData.phone
    })
    
    setIsEditing(false)
  }

  const primeiraLetra = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"

  return (
    /* Contêiner principal estruturado para responder ao seu globals.css */
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-colors duration-200">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-500 via-purple-400 to-orange-400 h-24" />

      <div className="px-8 pb-8">
        {/* Perfil */}
        <div className="flex flex-col xl:flex-row xl:items-start gap-6 -mt-16 mb-6">
          <div className="relative">
            {/* Borda do avatar adaptável */}
            <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-orange-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold shadow-xl border-4 border-white dark:border-gray-800 select-none">
              {primeiraLetra}
            </div>
            {/* Botão da câmera com fundo transparente estrutural */}
            <button
              type="button"
              className="absolute bottom-0 right-0 w-10 h-10 bg-transparent border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
            >
              <Camera className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
            </button>
          </div>

          <div className="flex-1 xl:pt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {currentUser?.name}
            </h2>
            <p className="text-gray-500 font-semibold text-sm">
              {currentUser?.role || "Usuário"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 xl:pt-16">
            {!isEditing && (
              /* 🛠️ MUDANÇA: O botão agora usa preenchimento roxo completo com gradiente e shadow, 
                 garantindo contraste total no Modo Claro e se integrando visualmente ao botão de Alterar Senha. */
              <button
                type="button"
                onClick={startEditing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer text-sm"
              >
                <Edit className="w-4 h-4 text-white" />
                Editar Perfil
              </button>
            )}
          </div>
        </div>

        {/* Formulário de Edição */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-3 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Telefone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-3 bg-transparent border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-xl transition-all shadow-md cursor-pointer"
              >
                <Save className="w-4 h-4" /> Salvar Alterações
              </button>
            </div>
          </form>
        ) : (
          /* Modo de Visualização normal (Corrigido com bordas finas e ícones vivos) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Bloco de E-mail: Ícone Azul Forte */}
            <div className="flex items-start gap-3 p-4 bg-transparent border border-gray-100 rounded-xl transition-colors">
              <div className="w-10 h-10 border border-blue-200 dark:border-blue-900/40 rounded-lg flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 mb-1">E-mail</p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {currentUser?.email}
                </p>
              </div>
            </div>

            {/* Bloco de Telefone: Ícone Verde Forte */}
            <div className="flex items-start gap-3 p-4 bg-transparent border border-gray-100 rounded-xl transition-colors">
              <div className="w-10 h-10 border border-green-200 dark:border-green-900/40 rounded-lg flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Telefone</p>
                <p className="text-sm font-semibold text-gray-900">
                  {currentUser?.phone}
                </p>
              </div>
            </div>

            {/* Bloco de Data de Cadastro: Ícone Roxo Forte */}
            <div className="flex items-start gap-3 p-4 bg-transparent border border-gray-100 rounded-xl transition-colors">
              <div className="w-10 h-10 border border-purple-200 dark:border-purple-900/40 rounded-lg flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Data de Cadastro</p>
                <p className="text-sm font-semibold text-gray-900">15 de Janeiro, 2024</p>
              </div>
            </div>

            {/* Bloco de Último Acesso: Ícone Laranja Forte */}
            <div className="flex items-start gap-3 p-4 bg-transparent border border-gray-100 rounded-xl transition-colors">
              <div className="w-10 h-10 border border-orange-200 dark:border-orange-900/40 rounded-lg flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Último Acesso</p>
                <p className="text-sm font-semibold text-gray-900">Hoje, 14:23</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}