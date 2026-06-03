import { useState } from 'react'
import toast from 'react-hot-toast'
import { hasReachedLimit, incrementUsage, getRemainingUses } from './usageLimit'
import { downloadBlob } from './helpers'

/**
 * useConvert — shared hook for all tool pages.
 * Premium users (logged in + active subscription) bypass the daily limit.
 * isPremium is passed in from useAuth() in the tool page, or fetched internally.
 */
export function useConvert(isPremiumOverride = false) {
  const [loading, setLoading] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)

  // Try to read isPremium from auth context if available (SSR-safe)
  const checkPremium = () => {
    if (isPremiumOverride) return true
    // Also check a localStorage flag set after successful payment
    try {
      const flag = localStorage.getItem('desipdf_premium')
      if (flag === 'true') return true
    } catch {}
    return false
  }

  const convert = async (apiPath, formData, downloadFilename) => {
    const premium = checkPremium()

    // 1. Check client-side limit (skip for premium users)
    if (!premium && hasReachedLimit()) {
      setShowLimitModal(true)
      return false
    }

    setLoading(true)
    const toastId = toast.loading('Processing…')

    try {
      const res = await fetch(apiPath, { method: 'POST', body: formData })

      // 2. Server returned 429 (IP limit exceeded) — not for premium
      if (res.status === 429 && !premium) {
        toast.error('Daily limit reached.', { id: toastId })
        setShowLimitModal(true)
        return false
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Something went wrong' }))
        throw new Error(err.error || 'Conversion failed')
      }

      // 3. Success — increment usage (only for free users)
      if (!premium) {
        incrementUsage()
        const remaining = getRemainingUses()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('desipdf-usage-updated'))
        }
        const msg = remaining === 0
          ? 'Done! ⚠️ That was your last free conversion today.'
          : `Done! ${remaining} free use${remaining !== 1 ? 's' : ''} remaining today.`
        toast.success(msg, { id: toastId, duration: 5000 })
      } else {
        toast.success('Done!', { id: toastId })
      }

      const blob = await res.blob()
      downloadBlob(blob, downloadFilename)
      return true
    } catch (err) {
      toast.error(err.message || 'An error occurred', { id: toastId })
      return false
    } finally {
      setLoading(false)
    }
  }

  const runClientSide = async (actionFn, downloadFilename) => {
    const premium = checkPremium()

    // 1. Check client-side limit (skip for premium users)
    if (!premium && hasReachedLimit()) {
      setShowLimitModal(true)
      return false
    }

    setLoading(true)
    const toastId = toast.loading('Processing in your browser…')

    try {
      const result = await actionFn()
      if (!result) throw new Error('Processing failed')

      // 2. Success — increment usage (only for free users)
      if (!premium) {
        incrementUsage()
        const remaining = getRemainingUses()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('desipdf-usage-updated'))
        }
        const msg = remaining === 0
          ? 'Done! ⚠️ That was your last free conversion today.'
          : `Done! ${remaining} free use${remaining !== 1 ? 's' : ''} remaining today.`
        toast.success(msg, { id: toastId, duration: 5000 })
      } else {
        toast.success('Done!', { id: toastId })
      }

      const blob = result instanceof Blob ? result : new Blob([result])
      downloadBlob(blob, downloadFilename)
      return true
    } catch (err) {
      toast.error(err.message || 'An error occurred', { id: toastId })
      return false
    } finally {
      setLoading(false)
    }
  }

  return { convert, runClientSide, loading, showLimitModal, setShowLimitModal }
}

