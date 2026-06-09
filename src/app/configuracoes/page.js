"use client"

import { useState } from "react"
import SettingsHeader from "@/components/settings/SettingsHeader"
import ProfileSection from "@/components/settings/ProfileSection"
import SecuritySection from "@/components/settings/SecuritySection"
import SystemPreferences from "@/components/settings/SystemPreferences"
import DangerZone from "@/components/settings/DangerZone"

export default function ConfiguracoesPage() {
  // 1. Estado Central do Usuário Conectado
  const [currentUser, setCurrentUser] = useState({
    name: "Bruno",
    email: "bruno@stockflow.com",
    phone: "(11) 99999-9999",
    role: "Administrador",
    password: "123" // Senha inicial simulada
  })

  // 2. Função Real para Alterar Senha
  const handleUpdatePassword = (currentPassword, newPassword) => {
    if (currentPassword !== currentUser.password) {
      alert("⚠️ A senha atual digitada está incorreta!")
      return false
    }
    
    setCurrentUser(prev => ({
      ...prev,
      password: newPassword
    }))
    alert("✅ Senha alterada com sucesso!")
    return true
  }

  // 3. Função Real para Excluir a Conta (Sua "excluir senha/conta")
  const handleDeleteAccount = () => {
    const confirmacao = confirm("🚨 ATENÇÃO: Você tem certeza que deseja excluir sua conta? Esta ação é irreversível!")
    
    if (confirmacao) {
      alert("Conta excluída com sucesso! Redirecionando para a tela de login...")
      // Aqui você poderia redirecionar o usuário: window.location.href = "/login"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      
      <SettingsHeader 
        title="Configurações do Sistema" 
        description="Gerencie as informações da sua conta, segurança e preferências."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Passando os estados e funções reais para os componentes filhos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <ProfileSection 
            currentUser={currentUser} 
            setCurrentUser={setCurrentUser} 
          />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <SecuritySection 
            onUpdatePassword={handleUpdatePassword} 
          />
        </div>

      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <SystemPreferences />
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
        <DangerZone 
          onDeleteAccount={handleDeleteAccount} 
        />
      </div>

    </div>
  )
}