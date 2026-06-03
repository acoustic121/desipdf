// Supabase OAuth callback handler
// After Google OAuth, Supabase redirects here with a code param.
// The client-side supabase.auth.onAuthStateChange() handles the session automatically.
// This route just redirects back to the app.
export default function handler(req, res) {
  res.redirect('/')
}
