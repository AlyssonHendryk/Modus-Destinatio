import "./globals.css"
import Providers from "./Providers"

export const metadata = {
  title: "Modus Destinatio",
  description: "Sistema ERP para pequenas empresas e e-commerces",
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body><Providers>{children}</Providers></body>
    </html>
  )
}
