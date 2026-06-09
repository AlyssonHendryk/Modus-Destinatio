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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">

          <div>
            <h3 className="text-gray-900 font-semibold mb-1">
              Gerenciamento de Usuários
            </h3>

            <p className="text-sm text-gray-500">
              Controle de acesso e permissões
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="
              flex items-center gap-2
              px-4 py-2
              bg-gradient-to-r from-purple-500 to-purple-600
              hover:from-purple-600 hover:to-purple-700
              text-white rounded-xl shadow-lg transition-all
            "
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">
              Novo Usuário
            </span>
          </button>

        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">

          <table className="w-full">

            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">

                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase">
                  Nome
                </th>

                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase">
                  E-mail
                </th>

                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase">
                  Cargo
                </th>

                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase">
                  Tipo
                </th>

                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase">
                  Status
                </th>

                <th className="text-left py-4 px-6 text-xs text-gray-500 uppercase">
                  Ações
                </th>

              </tr>
            </thead>

            <tbody>

              {users.map((user) => (

                <tr
                  key={user.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >

                  <td className="py-4 px-6">

                    <div className="flex items-center gap-3">

                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center text-white font-medium">
                        {user.name.charAt(0)}
                      </div>

                      <span className="text-gray-900 font-medium">{user.name}</span>

                    </div>

                  </td>

                  <td className="py-4 px-6 text-gray-900 font-medium">
                    {user.email}
                  </td>

                  <td className="py-4 px-6 text-gray-900 font-medium">
                    {user.role}
                  </td>

                  <td className="py-4 px-6">

                    {user.type === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs">
                        <User className="w-3 h-3" />
                        Funcionário
                      </span>
                    )}

                  </td>

                  <td className="py-4 px-6">

                    {user.status === "active" ? (
                      <span className="inline-flex px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs">
                        Inativo
                      </span>
                    )}

                  </td>

                  <td className="py-4 px-6">

                    <div className="flex gap-2">

                      <button
                        onClick={() => setViewUser(user)}
                        className="p-2 hover:bg-blue-50 text-blue-700 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 hover:bg-purple-50 text-purple-700 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => toggleStatus(user.id)}
                        className="p-2 hover:bg-red-50 text-red-700 rounded-lg"
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

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

          <div className="bg-white rounded-2xl w-full max-w-lg p-6">

            <div className="flex justify-between items-center mb-6">

              <h2 className="text-xl font-semibold">
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </h2>

              <button onClick={() => setShowModal(false)}>
                <X />
              </button>

            </div>

            <div className="space-y-4">

              <input
                type="text"
                placeholder="Nome"
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value
                  })
                }
                className="w-full border rounded-xl p-3"
              />

              <input
                type="email"
                placeholder="E-mail"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value
                  })
                }
                className="w-full border rounded-xl p-3"
              />

              <input
                type="text"
                placeholder="Cargo"
                value={formData.role}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    role: e.target.value
                  })
                }
                className="w-full border rounded-xl p-3"
              />

              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value
                  })
                }
                className="w-full border rounded-xl p-3"
              >
                <option value="employee">Funcionário</option>
                <option value="admin">Administrador</option>
              </select>

            </div>

            <button
              onClick={handleSave}
              className="mt-6 w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl"
            >
              Salvar
            </button>

          </div>

        </div>

      )}

      {/* Modal Visualização */}

      {viewUser && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

          <div className="bg-white rounded-2xl p-6 w-full max-w-md">

            <h2 className="text-xl font-semibold mb-4">
              Dados do Usuário
            </h2>

            <div className="space-y-2">
              <p><strong>Nome:</strong> {viewUser.name}</p>
              <p><strong>Email:</strong> {viewUser.email}</p>
              <p><strong>Cargo:</strong> {viewUser.role}</p>
              <p><strong>Tipo:</strong> {viewUser.type}</p>
              <p><strong>Status:</strong> {viewUser.status}</p>
            </div>

            <button
              onClick={() => setViewUser(null)}
              className="mt-6 w-full py-3 bg-gray-200 rounded-xl"
            >
              Fechar
            </button>

          </div>

        </div>

      )}
    </>
  )
}