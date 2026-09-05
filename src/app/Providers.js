"use client"
import { AppProvider } from "@/context/AppContext"

export default function Providers({ children }) {
  return <AppProvider>{children}</AppProvider>
}
