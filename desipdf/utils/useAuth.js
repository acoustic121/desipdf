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
  const [premiumDaysRemaining, setPremiumDaysRemaining] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkPremium = async (userId) => {
    if (!userId) {
      setIsPremium(false)
      setPremiumDaysRemaining(null)
      return
    }
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('id, expires_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single()

      if (data) {
        setIsPremium(true)
        const expiry = new Date(data.expires_at)
        const diffTime = expiry - new Date()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        setPremiumDaysRemaining(diffDays)
      } else {
        setIsPremium(false)
        setPremiumDaysRemaining(null)
      }

      // Cache in localStorage so useConvert can read it without async
      if (typeof window !== 'undefined') {
        localStorage.setItem('pdfchampion_premium', data ? 'true' : 'false')
      }
    } catch {
      setIsPremium(false)
      setPremiumDaysRemaining(null)
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
    setPremiumDaysRemaining(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pdfchampion_premium')
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, isPremium, premiumDaysRemaining, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )

}

export function useAuth() {
  return useContext(AuthContext)
}
