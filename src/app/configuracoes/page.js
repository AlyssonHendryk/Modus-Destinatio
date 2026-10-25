
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"

// Componentes de Configurações
import SettingsHeader from "@/components/settings/SettingsHeader"
import ProfileSection from "@/components/settings/ProfileSection"
import SecuritySection from "@/components/settings/SecuritySection"
import SystemPreferences from "@/components/settings/SystemPreferences"
import DangerZone from "@/components/settings/DangerZone"
import UsersManagement from "@/components/settings/UsersManagement"
import SettingsStats from "@/components/settings/SettingsStats"
import PermissionsSection from "@/components/settings/PermissionsSection"

export default function ConfiguracoesPage() {
  const router = useRouter()

  const {
    authLoading,
    currentUser,
    users,
  } = useApp()

  // ============================================================
  // VERIFICAÇÃO DE AUTENTICAÇÃO
  // ============================================================

  useEffect(() => {
    if (authLoading) return

    if (!currentUser) {
      router.replace("/login")
    }
  }, [authLoading, currentUser, router])

  // ============================================================
  // ALTERAÇÃO DE PERFIL
  // ============================================================

  function setCurrentUser() {
    alert(
      "A edição do perfil será disponibilizada após a integração com o Supabase."
    )
  }

  // ============================================================
  // ALTERAÇÃO DE SENHA
  // ============================================================

  function updatePassword() {
    alert(
      "A alteração de senha será disponibilizada após a integração com o Supabase Auth."
    )

    return false
  }

  // ============================================================
  // EXCLUSÃO DE CONTA
  // ============================================================

  function deleteAccount() {
    alert(
      "A exclusão de conta será disponibilizada após a integração segura com o Supabase."
    )
  }

  // ============================================================
  // CARREGAMENTO DA SESSÃO
  // ============================================================

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">
          Verificando sessão...
        </p>
      </div>
    )
  }

  // ============================================================
  // BLOQUEIO DE ACESSO SEM AUTENTICAÇÃO
  // ============================================================

  if (!currentUser) {
    return null
  }

  // ============================================================
  // RENDERIZAÇÃO DAS CONFIGURAÇÕES
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <SettingsHeader
        title="Configurações do Sistema"
        description="Gerencie conta, usuários, segurança e preferências."
      />

      <SettingsStats users={users} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ProfileSection
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
        />

        <SecuritySection
          onUpdatePassword={updatePassword}
        />
      </div>

      <PermissionsSection
        type={currentUser.type}
      />

      {currentUser.type === "admin" && (
        <UsersManagement />
      )}

      <SystemPreferences />

      <DangerZone
        onDeleteAccount={deleteAccount}
      />
    </div>
  )
}
