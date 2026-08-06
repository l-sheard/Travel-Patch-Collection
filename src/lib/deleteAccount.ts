import { supabase } from './supabaseClient'

/** Permanently deletes the current user's account and everything they own,
 * via a Supabase Edge Function (needs the service-role key server-side —
 * see supabase/functions/delete-account/). Signs out locally on success. */
export async function deleteAccount(): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) return { error: 'Not signed in' }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    return { error: body?.error ?? `Failed to delete account (${response.status})` }
  }

  await supabase.auth.signOut()
  return { error: null }
}
