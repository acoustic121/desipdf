import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../utils/useAuth'
import toast from 'react-hot-toast'

const FREE_FEATURES = [
  { label: 'All PDF Tools', free: '15/day', premium: 'Unlimited' },
  { label: 'File size limit', free: '50 MB', premium: '4 GB' },
  { label: 'Files per merge/batch', free: '10 files', premium: 'Unlimited' },
  { label: 'Merge PDF', free: '✓', premium: '✓' },
  { label: 'Split PDF', free: '✓', premium: '✓' },
  { label: 'Compress PDF', free: '✓', premium: '✓' },
  { label: 'Rotate PDF', free: '✓', premium: '✓' },
  { label: 'PDF to JPG', free: '✓', premium: '✓' },
  { label: 'JPG to PDF', free: '✓', premium: '✓' },
  { label: 'Word to PDF', free: '✓', premium: '✓' },
  { label: 'PDF to Word', free: '✓', premium: '✓' },
  { label: 'Excel to PDF', free: '✓', premium: '✓' },
  { label: 'PDF to Excel', free: '✓', premium: '✓' },
  { label: 'PPT to PDF', free: '✓', premium: '✓' },
  { label: 'Add Watermark', free: '✓', premium: '✓' },
  { label: 'Sign PDF', free: '✓', premium: '✓' },
  { label: 'Protect / Unlock PDF', free: '✓', premium: '✓' },
  { label: 'OCR PDF', free: '✓', premium: '✓' },
  { label: 'AI Summarizer', free: '–', premium: '✓ (Coming soon)' },
  { label: 'Translate PDF', free: '–', premium: '✓ (Coming soon)' },
  { label: 'Priority processing', free: '–', premium: '✓' },
  { label: 'Ad-free experience', free: '–', premium: '✓' },
  { label: 'Email support', free: '–', premium: '✓' },
]

const MONTHLY_PRICE = 51
const YEARLY_PRICE = 499

export default function Pricing() {
  const [billing, setBilling] = useState('yearly') // 'monthly' | 'yearly'
  const [paying, setPaying] = useState(false)
  const { user, isPremium } = useAuth()
  const router = useRouter()

  const price = billing === 'monthly' ? MONTHLY_PRICE : YEARLY_PRICE
  const perMonth = billing === 'yearly' ? Math.round(YEARLY_PRICE / 12) : MONTHLY_PRICE
  const savings = billing === 'yearly' ? Math.round(100 - (YEARLY_PRICE / (MONTHLY_PRICE * 12)) * 100) : 0

  const handleSubscribe = async () => {
    if (!user) {
      router.push('/login?redirect=/pricing')
      return
    }
    if (isPremium) {
      toast.success('You are already on Premium!')
      return
    }

    setPaying(true)
    try {
      // Get session token for auth
      const { data: { session: currentSession } } = await (await import('../utils/supabase')).supabase.auth.getSession()
      const token = currentSession?.access_token
      if (!token) {
        toast.error('Session expired. Please log in again.')
        router.push('/login?redirect=/pricing')
        return
      }

      // Create Razorpay order
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ billing, amount: price * 100 }), // amount in paise
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error || 'Could not create order')

      // Load Razorpay script
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      document.body.appendChild(script)
      script.onload = () => {
        const rzp = new window.Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: 'INR',
          name: 'DesiPDF',
          description: `DesiPDF Premium – ${billing === 'monthly' ? '1 Month' : '1 Year'}`,
          order_id: order.id,
          prefill: { email: user.email, name: user.user_metadata?.full_name || '' },
          theme: { color: '#0066FF' },
          handler: async (response) => {
            // Verify payment server-side
            const verify = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...response, billing, userId: user.id }),
            })
            const result = await verify.json()
            if (verify.ok && result.success) {
              toast.success('🎉 Welcome to DesiPDF Premium!')
              router.push('/')
            } else {
              toast.error('Payment verification failed. Contact support.')
            }
          },
        })
        rzp.open()
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPaying(false)
    }
  }

  return (
    <>
      <Head>
        <title>Pricing – DesiPDF</title>
        <meta name="description" content="DesiPDF free and premium plans. Get unlimited PDF conversions for ₹50/month." />
      </Head>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">Simple, honest pricing</h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">Start free. Upgrade when you need more.</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium ${billing === 'monthly' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>Monthly</span>
          <button
            onClick={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-12 h-6 rounded-full transition-colors ${billing === 'yearly' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${billing === 'yearly' ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm font-medium ${billing === 'yearly' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
            Yearly
            {savings > 0 && <span className="ml-2 text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-semibold">Save {savings}%</span>}
          </span>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {/* Basic / Free */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-100 dark:border-gray-800 p-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📄</span>
              <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">Basic</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Best for occasional use</p>
            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">Free</span>
              <p className="text-sm text-gray-400 mt-1">Always free · No credit card</p>
            </div>
            <Link href="/signup" className="block w-full text-center py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors mb-6">
              {user ? 'Current Plan' : 'Start for Free'}
            </Link>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              {[
                '15 conversions per day',
                'Files up to 50 MB',
                'Up to 10 files per merge',
                'All PDF tools included',
                'All 29 languages supported',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="text-gray-400">✓</span> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Premium */}
          <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl border-2 border-blue-500 p-8 text-white shadow-xl shadow-blue-200 dark:shadow-blue-900">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                ⭐ MOST POPULAR
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚡</span>
              <span className="font-bold text-white text-lg">Premium</span>
            </div>
            <p className="text-sm text-blue-200 mb-6">Best for regular use</p>
            <div className="mb-2">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-white">₹{perMonth}</span>
                <span className="text-blue-200 text-sm mb-1.5">/month</span>
              </div>
              {billing === 'yearly' && (
                <p className="text-sm text-blue-200">₹{YEARLY_PRICE} billed yearly · Save ₹{MONTHLY_PRICE * 12 - YEARLY_PRICE}</p>
              )}
              {billing === 'monthly' && (
                <p className="text-sm text-blue-200">₹{MONTHLY_PRICE} billed monthly</p>
              )}
            </div>
            <button
              onClick={handleSubscribe}
              disabled={paying || isPremium}
              className="block w-full text-center py-3 rounded-xl bg-white text-blue-700 font-bold hover:bg-blue-50 transition-colors mb-6 mt-4 disabled:opacity-70"
            >
              {paying ? '⏳ Processing…' : isPremium ? '✓ Current Plan' : user ? `Subscribe for ₹${price}` : 'Get Premium'}
            </button>
            <div className="space-y-3 text-sm text-blue-100">
              {[
                'Unlimited conversions per day',
                'Files up to 4 GB',
                'Unlimited files per merge',
                'All PDF tools included',
                'AI Summarizer & Translate (coming soon)',
                'Priority processing',
                'Ad-free experience',
                'Email support',
              ].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="text-cyan-300">✓</span> {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature comparison table */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">Compare plans</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 px-6 py-3">
              <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Feature</div>
              <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 text-center">Basic (Free)</div>
              <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 text-center">Premium</div>
            </div>
            {FREE_FEATURES.map((row, i) => (
              <div key={row.label} className={`grid grid-cols-3 px-6 py-3.5 border-b border-gray-50 dark:border-gray-800 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                <div className="text-sm text-gray-700 dark:text-gray-300">{row.label}</div>
                <div className={`text-sm text-center ${row.free === '–' ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-400'}`}>{row.free}</div>
                <div className={`text-sm text-center font-medium ${row.premium === '–' ? 'text-gray-300 dark:text-gray-600' : 'text-blue-600 dark:text-blue-400'}`}>{row.premium}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Questions? Email us at{' '}
            <a href="mailto:aman2sangam@gmail.com" className="text-blue-600 dark:text-blue-400 hover:underline">aman2sangam@gmail.com</a>
          </p>
        </div>
      </div>
    </>
  )
}
