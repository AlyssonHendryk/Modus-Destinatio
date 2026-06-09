"use client"

import { useState, useEffect } from "react"
import {
  Palette,
  Globe,
  Bell,
  Save,
  RotateCcw,
  CheckCircle
} from "lucide-react"

export default function SystemPreferences() {
  const defaultPreferences = {
    theme: "light",
    language: "pt",
    notifications: {
      lowStock: true,
      newOrders: true,
      separation: false,
      reports: true
    }
  }

  // Substituído o hook do Context pelo estado local do React
  const [theme, setTheme] = useState("light")
  const [language, setLanguage] = useState("pt")
  const [notifications, setNotifications] = useState({
    lowStock: true,
    newOrders: true,
    separation: false,
    reports: true
  })

  const [saved, setSaved] = useState(false)

  // Carrega as preferências salvas no navegador ao abrir a página
  useEffect(() => {
    const preferences = localStorage.getItem("stockflow_preferences")

    if (preferences) {
      const data = JSON.parse(preferences)
      setTheme(data.theme || "light")
      setLanguage(data.language || "pt")
      setNotifications(data.notifications || defaultPreferences.notifications)
    }
  }, [])

  const handleSave = () => {
    const preferences = {
      theme,
      language,
      notifications
    }

    localStorage.setItem(
      "stockflow_preferences",
      JSON.stringify(preferences)
    )

    setSaved(true)

    setTimeout(() => {
      setSaved(false)
    }, 3000)
  }

  const handleReset = () => {
    setTheme(defaultPreferences.theme)
    setLanguage(defaultPreferences.language)
    setNotifications(defaultPreferences.notifications)

    localStorage.setItem(
      "stockflow_preferences",
      JSON.stringify(defaultPreferences)
    )
  }

  const toggleNotification = (key) => {
    setNotifications({
      ...notifications,
      [key]: !notifications[key]
    })
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
          <Palette className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Preferências
          </h3>
          <p className="text-sm text-gray-700">
            Personalize sua experiência no sistema
          </p>
        </div>
      </div>

      <div className="space-y-6">

        {/* Tema */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-800">
              Tema
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`py-3 rounded-xl border font-medium transition-all cursor-pointer ${
                theme === "light"
                  ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-600 shadow-lg"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
              }`}
            >
              ☀️ Claro
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={`py-3 rounded-xl border font-medium transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-600 shadow-lg"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
              }`}
            >
              🌙 Escuro
            </button>
          </div>
        </div>

        {/* Idioma */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-800">
              Idioma
            </label>
          </div>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Notificações */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-gray-600" />
            <label className="text-sm font-medium text-gray-800">
              Notificações
            </label>
          </div>

          <div className="space-y-3">
            {[
              { key: "lowStock", label: "Alertas de estoque baixo" },
              { key: "newOrders", label: "Novos pedidos" },
              { key: "separation", label: "Separação de pedidos" },
              { key: "reports", label: "Relatórios semanais" }
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
              >
                <span className="text-sm font-medium text-gray-800">
                  {item.label}
                </span>

                <button
                  type="button"
                  onClick={() => toggleNotification(item.key)}
                  className={`relative w-12 h-6 rounded-full transition-all cursor-pointer ${
                    notifications[item.key]
                      ? "bg-gradient-to-r from-purple-500 to-purple-600"
                      : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                      notifications[item.key] ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Mensagem de sucesso */}
        {saved && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">
              Preferências salvas com sucesso!
            </span>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-medium shadow-lg transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Salvar Preferências
          </button>

          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 text-gray-800 hover:bg-gray-50 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar
          </button>
        </div>

      </div>
    </div>
  )
}