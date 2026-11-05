import { createClient } from "@supabase/supabase-js"
import { createPasswordRecovery } from "../utils/passwordRecovery.js"
import { supabase } from "../lib/supabase.js"

// In implicit flow this method sends email without signing in or replacing the
// current session. Do not create another Auth client for each request.
export function requestPasswordRecovery(email, origin) {
  return createPasswordRecovery(supabase).request(email, origin)
}

export function newPasswordRecovery() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      // Each callback owns its session and cleanup, including during navigation
      // or Fast Refresh. Never share locks/storage keys with another Auth client.
      storageKey: `modus-password-recovery-${globalThis.crypto.randomUUID()}` } },
  )
  return createPasswordRecovery(client)
}
