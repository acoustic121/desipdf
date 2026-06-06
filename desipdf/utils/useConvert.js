import { useState } from 'react'
import toast from 'react-hot-toast'
import { incrementUsage } from './usageLimit'
import { downloadBlob } from './helpers'
import { event } from './analytics'

// Shared conversion hook. Premium/account integrations are kept for future
// product use, but conversions are currently unlimited for every visitor.
export function useConvert(isPremiumOverride = false) {
  const [loading, setLoading] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)

  // Try to read isPremium from auth context if available (SSR-safe)
  const checkPremium = () => {
    if (isPremiumOverride) return true
    // Also check a localStorage flag set after successful payment
    try {
      const flag = localStorage.getItem('pdfchampion_premium')
      if (flag === 'true') return true
    } catch {}
    return false
  }

  const beginConversion = () => {
    return true
  }

  const finishConversion = (toastId) => {
    incrementUsage()
    toast.success('Done! Unlimited free conversions, no signup required.', { id: toastId, duration: 5000 })
  }

  const convert = async (apiPath, formData, downloadFilename) => {
    const premium = checkPremium()

    setLoading(true)
    const toastId = toast.loading('Processing…')

    try {
      const res = await fetch(apiPath, { method: 'POST', body: formData })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Something went wrong' }))
        throw new Error(err.error || 'Conversion failed')
      }

      incrementUsage()
      toast.success('Done! Unlimited free conversions, no signup required.', { id: toastId, duration: 5000 })

      // Track successful serverless conversion
      try {
        event({
          action: 'convert_api_success',
          category: 'conversion',
          label: apiPath,
          value: 1,
          is_premium: premium ? 'true' : 'false',
          filename: downloadFilename,
        })
      } catch (err) {
        console.error('Failed to log event', err)
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

    setLoading(true)
    const toastId = toast.loading('Processing in your browser…')

    try {
      const result = await actionFn()
      if (!result) throw new Error('Processing failed')

      incrementUsage()
      toast.success('Done! Unlimited free conversions, no signup required.', { id: toastId, duration: 5000 })

      // Track successful client-side conversion
      try {
        event({
          action: 'convert_client_success',
          category: 'conversion',
          label: downloadFilename,
          value: 1,
          is_premium: premium ? 'true' : 'false',
        })
      } catch (err) {
        console.error('Failed to log event', err)
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

  return { convert, runClientSide, loading, setLoading, showLimitModal, setShowLimitModal, beginConversion, finishConversion }
}
