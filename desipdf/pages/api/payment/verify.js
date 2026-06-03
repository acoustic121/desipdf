import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Uses service role key to write to DB (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    billing,
    userId,
  } = req.body

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
    return res.status(400).json({ error: 'Missing required payment fields' })
  }

  try {
    // 1. Verify Razorpay signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature', success: false })
    }

    // 2. Fetch actual order details from Razorpay to get the amount paid
    const Razorpay = require('razorpay')
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
    const order = await instance.orders.fetch(razorpay_order_id)
    const finalAmount = order.amount // paid amount in paise (INR)

    // 3. Calculate expiry
    const now = new Date()
    const expiresAt = new Date(now)
    if (billing === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    }

    // 4. Write subscription to Supabase
    const { error } = await supabaseAdmin.from('subscriptions').insert({
      user_id: userId,
      plan: 'premium',
      status: 'active',
      billing_period: billing,
      amount: finalAmount, // actual amount paid in paise
      expires_at: expiresAt.toISOString(),
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    })

    if (error) throw error

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Payment verify error:', err)
    res.status(500).json({ error: err.message, success: false })
  }

}
