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

const ACTIVE_COLUMN = {
  solo_challenge: 'solo_challenge_active',
  fitness: 'fitness_active',
};

const SUBSCRIPTION_ID_COLUMN = {
  solo_challenge: 'stripe_solo_subscription_id',
  fitness: 'stripe_fitness_subscription_id',
};

// Releases the slot(s) tied to an abandoned/unpaid booking checkout, so
// someone else can book them again
async function releaseBookingSlots(sessionId) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, slot_id')
    .eq('stripe_checkout_session_id', sessionId)
    .eq('payment_status', 'awaiting_payment');

  if (!bookings || !bookings.length) return;

  for (const booking of bookings) {
    if (booking.slot_id) {
      const { data: slot } = await supabase.from('slots').select('booked_count').eq('id', booking.slot_id).single();
      if (slot && slot.booked_count > 0) {
        await supabase.from('slots').update({ booked_count: slot.booked_count - 1 }).eq('id', booking.slot_id);
      }
    }
  }
  await supabase.from('bookings').update({ payment_status: 'abandoned' }).eq('stripe_checkout_session_id', sessionId);
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
    const product = session.metadata && session.metadata.product;
    const serviceType = session.metadata && session.metadata.service_type;

    if (memberId && ACTIVE_COLUMN[product]) {
      // Membership subscription checkout (Solo Challenge / Fitness Subscription)
      await supabase
        .from('members')
        .update({
          [ACTIVE_COLUMN[product]]: true,
          stripe_customer_id: session.customer,
          [SUBSCRIPTION_ID_COLUMN[product]]: session.subscription,
        })
        .eq('id', memberId);
    } else if (serviceType) {
      // Personal Training / Group / Combat Fitness booking checkout —
      // mark every booking row tied to this session as paid
      await supabase
        .from('bookings')
        .update({ payment_status: 'paid' })
        .eq('stripe_checkout_session_id', session.id);
    }
  }

  // If a booking checkout expires without payment, release its reserved slot(s)
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object;
    if (session.metadata && session.metadata.service_type) {
      await releaseBookingSlots(session.id);
    }
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    const isActive = sub.status === 'active' || sub.status === 'trialing';

    await supabase.from('members').update({ solo_challenge_active: isActive }).eq('stripe_solo_subscription_id', sub.id);
    await supabase.from('members').update({ fitness_active: isActive }).eq('stripe_fitness_subscription_id', sub.id);
  }

  res.status(200).json({ received: true });
};

// Vercel needs the raw body to verify the Stripe signature —
// this must come AFTER module.exports is set to the handler above
module.exports.config = { api: { bodyParser: false } };
