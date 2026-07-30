const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');
const { getService } = require('../lib/services');

// How often each membership bills. Solo Challenge is monthly; the
// Fitness Subscription and Hybrid are both billed every 4 weeks.
const BILLING_INTERVAL = {
  solo_challenge: { interval: 'month', interval_count: 1 },
  fitness_subscription: { interval: 'week', interval_count: 4 },
  membership: { interval: 'week', interval_count: 4 }, // Hybrid (1-to-1 + content)
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password, product } = req.body || {};

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Please enter a valid email and a password of at least 8 characters.' });
  }
  if (!BILLING_INTERVAL[product]) {
    return res.status(400).json({ error: 'Unknown membership option.' });
  }

  // Pull the live price/label from the services table, same pattern as
  // Personal Training and Combat Fitness use
  const priceInfo = await getService(product);
  if (!priceInfo) {
    return res.status(400).json({ error: 'That membership option is not currently available.' });
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

  const site = process.env.SITE_URL || 'https://awa-martial-arts.vercel.app';
  const { interval, interval_count } = BILLING_INTERVAL[product];

  // Build the subscription checkout dynamically from the live price,
  // instead of relying on a single fixed Stripe Price ID for everyone
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{
      price_data: {
        currency: 'gbp',
        unit_amount: Math.round(priceInfo.fee * 100),
        recurring: { interval, interval_count },
        product_data: { name: priceInfo.label },
      },
      quantity: 1,
    }],
    // Tagging both the session and the subscription itself with which
    // product this is — the webhook needs this to activate the right
    // membership afterward
    metadata: { member_id: member.id, product },
    subscription_data: { metadata: { member_id: member.id, product } },
    success_url: `${site}/academy.html#login?joined=1`,
    cancel_url: `${site}/academy.html#join`,
  });

  res.status(200).json({ url: session.url });
};
