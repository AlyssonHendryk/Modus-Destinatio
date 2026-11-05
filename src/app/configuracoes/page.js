
"use client"

import { useEffect, useState } from "react"
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
    saveProfileName,
  } = useApp()
  const [usersRevision, setUsersRevision] = useState(0)

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

  // ============================================================
  // ALTERAÇÃO DE SENHA
  // ============================================================


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

      <SettingsStats key={`${currentUser.id}:${currentUser.role}`} user={currentUser} revision={usersRevision} onRetry={() => setUsersRevision(value => value + 1)} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ProfileSection
          key={currentUser.id}
          currentUser={currentUser}
          onSaveName={saveProfileName}
        />

        <SecuritySection />
      </div>

      <PermissionsSection
        type={currentUser.type}
      />

      {currentUser.type === "admin" && (
        <UsersManagement key={currentUser.id} onUsersChanged={() => setUsersRevision(value => value + 1)} />
      )}

      <SystemPreferences />

      <DangerZone
        onDeleteAccount={deleteAccount}
      />
    </div>
  )
}
