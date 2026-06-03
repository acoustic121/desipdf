import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Get auth token from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' })

  const { billing, amount } = req.body
  if (!billing || !amount) return res.status(400).json({ error: 'Missing billing or amount' })

  try {
    const Razorpay = require('razorpay')
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })

    const order = await instance.orders.create({
      amount,
      currency: 'INR',
      receipt: `dp_${user.id.slice(0, 8)}_${Date.now().toString().slice(-8)}`,
      notes: { user_id: user.id, email: user.email, billing },
    })

    res.status(200).json(order)
  } catch (err) {
    console.error('Razorpay error:', err)
    res.status(500).json({ error: err.message || 'Could not create payment order' })
  }
}
