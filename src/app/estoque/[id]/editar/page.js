import { redirect } from "next/navigation"

// Legacy URL from the short-lived page-based editor. Product editing now uses a modal.
export default function LegacyProductEditPage() {
  redirect("/estoque")
}
