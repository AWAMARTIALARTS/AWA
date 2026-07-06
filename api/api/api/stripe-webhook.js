const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');
const { getService } = require('../lib/services');

module.exports.config = {
  api: { bodyParser: false }
};

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
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    if (session.metadata && session.metadata.service_type) {
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
      const paymentMethodId = paymentIntent.payment_method;
      const customerId = session.customer;
      const serviceType = session.metadata.service_type;
      const service = await getService(serviceType);
      const isFullPayment = service && (service.mode === 'full' || service.category === 'group_training');

      await supabase
        .from('bookings')
        .update({
          payment_status: isFullPayment ? 'paid_full' : 'deposit_paid',
          stripe_customer_id: customerId,
          stripe_payment_method_id: paymentMethodId
        })
        .eq('stripe_checkout_session_id', session.id);

      if (isFullPayment && session.metadata.slot_id) {
        const { data: slot } = await supabase
          .from('slots').select('booked_count').eq('id', session.metadata.slot_id).single();
        if (slot) {
          await supabase.from('slots')
            .update({ booked_count: slot.booked_count + 1 })
            .eq('id', session.metadata.slot_id);
        }
      }
    }
  }

  res.status(200).json({ received: true });
};
