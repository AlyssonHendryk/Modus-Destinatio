"use client"

import { useState } from "react"
import {
  Plus,
  Edit,
  Eye,
  UserX,
  Shield,
  User,
  X
} from "lucide-react"

export default function UsersManagement() {

  const [users, setUsers] = useState([
    {
      id: 1,
      name: "Bruno Silva",
      email: "bruno@stockflow.com",
      role: "Administrador",
      type: "admin",
      status: "active"
    },
    {
      id: 2,
      name: "Ana Santos",
      email: "ana@stockflow.com",
      role: "Funcionário",
      type: "employee",
      status: "active"
    },
    {
      id: 3,
      name: "Carlos Lima",
      email: "carlos@stockflow.com",
      role: "Funcionário",
      type: "employee",
      status: "active"
    },
    {
      id: 4,
      name: "Maria Costa",
      email: "maria@stockflow.com",
      role: "Administrador",
      type: "admin",
      status: "active"
    }
  ])

  const [showModal, setShowModal] = useState(false)
  const [viewUser, setViewUser] = useState(null)
  const [editingUser, setEditingUser] = useState(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    type: "employee"
  })

  function handleOpenCreate() {
    setEditingUser(null)

    setFormData({
      name: "",
      email: "",
      role: "",
      type: "employee"
    })

    setShowModal(true)
  }

  function handleEdit(user) {
    setEditingUser(user)

    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      type: user.type
    })

    setShowModal(true)
  }

  function handleSave() {
    if (
      !formData.name ||
      !formData.email ||
      !formData.role
    ) {
      alert("Preencha todos os campos.")
      return
    }

    if (editingUser) {
      setUsers(
        users.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                ...formData
              }
            : user
        )
      )
    } else {
      const newUser = {
        id: Date.now(),
        ...formData,
        status: "active"
      }

      setUsers([...users, newUser])
    }

    setShowModal(false)
  }

  function toggleStatus(id) {
    setUsers(
      users.map((user) =>
        user.id === id
          ? {
              ...user,
              status:
                user.status === "active"
                  ? "inactive"
                  : "active"
            }
          : user
      )
    )
  }

  return (
    <>
      {/* Contêiner principal da Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-colors duration-200">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-gray-900 font-bold text-lg mb-1">
              Gerenciamento de Usuários
            </h3>
            <p className="text-sm text-gray-500">
              Controle de acesso e permissões
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl shadow-md transition-all cursor-pointer font-medium"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Novo Usuário</span>
          </button>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Nome
                </th>
                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  E-mail
                </th>
                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Cargo
                </th>
                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Tipo
                </th>
                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Status
                </th>
                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center text-white font-semibold shadow-sm">
                        {user.name.charAt(0)}
                      </div>
                      <span className="text-gray-900 font-semibold">{user.name}</span>
                    </div>
                  </td>

                  <td className="py-4 px-6 text-gray-700 font-medium">
                    {user.email}
                  </td>

                  <td className="py-4 px-6 text-gray-700 font-medium">
                    {user.role}
                  </td>

                  <td className="py-4 px-6">
                    {user.type === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40 rounded-full text-xs font-semibold">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40 rounded-full text-xs font-semibold">
                        <User className="w-3 h-3" />
                        Funcionário
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-6">
                    {user.status === "active" ? (
                      <span className="inline-flex px-3 py-1 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/40 rounded-full text-xs font-semibold">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex px-3 py-1 bg-gray-100 border border-gray-300 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Inativo
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-6">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setViewUser(user)}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-lg cursor-pointer transition-colors"
                        title="Visualizar Usuário"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(user)}
                        className="p-2 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-700 dark:text-purple-400 rounded-lg cursor-pointer transition-colors"
                        title="Editar Usuário"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleStatus(user.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg cursor-pointer transition-colors"
                        title="Alternar Status"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastro / Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 border border-gray-200 shadow-2xl transition-colors">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </h2>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 🛠️ MUDANÇA: Inputs usam bg-transparent para o CSS global não jogar cinza escuro no modo claro */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Nome</label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-transparent text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">E-mail</label>
                <input
                  type="email"
                  placeholder="exemplo@dominio.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-transparent text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Cargo</label>
                <input
                  type="text"
                  placeholder="Ex: Supervisor Administrativo"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-transparent text-gray-900 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 font-medium"
                />
              </div>

              {/* 🛠️ MUDANÇA: Select usa bg-transparent e borda explícita no claro */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Nível de Permissão</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-transparent text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/30 cursor-pointer font-semibold"
                >
                  <option value="employee" className="dark:bg-gray-800 text-gray-900 dark:text-white">Funcionário</option>
                  <option value="admin" className="dark:bg-gray-800 text-gray-900 dark:text-white">Administrador</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="mt-6 w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg cursor-pointer transition-all"
            >
              Salvar Usuário
            </button>
          </div>
        </div>
      )}

      {/* Modal Visualização */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-gray-200 shadow-2xl transition-colors">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Dados do Usuário
            </h2>

            <div className="space-y-3 text-sm text-gray-700 font-medium">
              <p><strong className="text-gray-900 font-bold">Nome:</strong> {viewUser.name}</p>
              <p><strong className="text-gray-900 font-bold">Email:</strong> {viewUser.email}</p>
              <p><strong className="text-gray-900 font-bold">Cargo:</strong> {viewUser.role}</p>
              <p><strong className="text-gray-900 font-bold">Tipo:</strong> {viewUser.type === "admin" ? "Administrador" : "Funcionário"}</p>
              <p>
                <strong className="text-gray-900 font-bold">Status:</strong>{" "}
                <span className={viewUser.status === "active" ? "text-green-600 dark:text-green-400 font-semibold" : "text-gray-500 font-semibold"}>
                  {viewUser.status === "active" ? "Ativo" : "Inativo"}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setViewUser(null)}
              className="mt-6 w-full py-3 bg-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition-all cursor-pointer"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}
    </>
  )
}