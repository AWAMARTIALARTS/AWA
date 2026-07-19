const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Please enter a valid email and a password of at least 8 characters.' });
  }

  // Check for an existing account
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    return res.status(400).json({ error: 'An account with that email already exists. Try logging in instead.' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data: member, error } = await supabase
    .from('members')
    .insert({ email: email.toLowerCase(), password_hash, active: false })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Create the Stripe subscription checkout, tagging it with the member's id
  const site = process.env.SITE_URL || 'https://awa-martial-arts.vercel.app';
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_MEMBERSHIP_PRICE_ID, quantity: 1 }],
    customer_email: email,
    metadata: { member_id: member.id },
    success_url: `${site}/academy.html#login?joined=1`,
    cancel_url: `${site}/academy.html#join`,
  });

  res.status(200).json({ url: session.url });
};
