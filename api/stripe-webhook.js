const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const memberId = session.metadata && session.metadata.member_id;
    if (memberId) {
      await supabase
        .from('members')
        .update({
          active: true,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        })
        .eq('id', memberId);
    }
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const isActive = sub.status === 'active' || sub.status === 'trialing';
    await supabase
      .from('members')
      .update({ active: isActive })
      .eq('stripe_subscription_id', sub.id);
  }

  res.status(200).json({ received: true });
};

// Vercel needs the raw body to verify the Stripe signature —
// this must come AFTER module.exports is set to the handler above
module.exports.config = { api: { bodyParser: false } };
