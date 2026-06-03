import { useState, useEffect, useContext, createContext } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext({
  user: null,
  session: null,
  isPremium: false,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkPremium = async (userId) => {
    if (!userId) { setIsPremium(false); return }
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single()
      setIsPremium(!!data)
      // Cache in localStorage so useConvert can read it without async
      if (typeof window !== 'undefined') {
        localStorage.setItem('desipdf_premium', data ? 'true' : 'false')
      }
    } catch {
      setIsPremium(false)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      checkPremium(session?.user?.id)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      checkPremium(session?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setIsPremium(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('desipdf_premium')
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, isPremium, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
