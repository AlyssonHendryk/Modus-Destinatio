"use client"

import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"
import SettingsHeader from "@/components/settings/SettingsHeader"
import ProfileSection from "@/components/settings/ProfileSection"
import SecuritySection from "@/components/settings/SecuritySection"
import SystemPreferences from "@/components/settings/SystemPreferences"
import DangerZone from "@/components/settings/DangerZone"
import UsersManagement from "@/components/settings/UsersManagement"
import SettingsStats from "@/components/settings/SettingsStats"
import PermissionsSection from "@/components/settings/PermissionsSection"

export default function ConfiguracoesPage(){
  const router=useRouter();const{currentUser,updateUser,deleteUser,users}=useApp()
  const user=currentUser||{id:"local",name:"Visitante",email:"",phone:"",role:"Sessão local",password:""}
  function setCurrentUser(next){const value=typeof next==="function"?next(user):next;if(currentUser)updateUser(currentUser.id,value)}
  function updatePassword(currentPassword,newPassword){if(!currentUser)return false;if(currentPassword!==currentUser.password){alert("A senha atual está incorreta.");return false}if(newPassword.length<6){alert("A nova senha deve ter ao menos 6 caracteres.");return false}if(newPassword===currentPassword){alert("A nova senha deve ser diferente da atual.");return false}updateUser(currentUser.id,{password:newPassword});alert("Senha alterada com sucesso.");return true}
  function deleteAccount(){if(!currentUser)return;if(window.confirm("Excluir sua conta? Esta ação não pode ser desfeita.")){deleteUser(currentUser.id);router.push("/login")}}
  return <div className="min-h-screen bg-gray-50 p-6 space-y-6"><SettingsHeader title="Configurações do Sistema" description="Gerencie conta, usuários, segurança e preferências."/><SettingsStats users={users}/><div className="grid grid-cols-1 xl:grid-cols-2 gap-6"><ProfileSection currentUser={user} setCurrentUser={setCurrentUser}/><SecuritySection onUpdatePassword={updatePassword}/></div><PermissionsSection type={currentUser?.type || "employee"}/>{currentUser?.type==="admin"&&<UsersManagement/>}<SystemPreferences/><DangerZone onDeleteAccount={deleteAccount}/></div>
}
