const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { booking_id, refund } = req.body || {};
  if (!booking_id) return res.status(400).json({ error: 'Missing booking_id.' });

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', booking_id)
    .single();

  if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found.' });

  if (booking.payment_status === 'cancelled' || booking.payment_status === 'refunded') {
    return res.status(400).json({ error: 'This booking is already cancelled.' });
  }

  let refundedAmount = null;

  if (refund) {
    if (!booking.stripe_checkout_session_id) {
      return res.status(400).json({ error: 'No Stripe session on file for this booking — cannot refund automatically.' });
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_session_id);
      if (!session.payment_intent) {
        return res.status(400).json({ error: 'No payment found for this session — cannot refund.' });
      }
      const refundResult = await stripe.refunds.create({ payment_intent: session.payment_intent });
      refundedAmount = refundResult.amount / 100;
    } catch (err) {
      return res.status(500).json({ error: 'Stripe refund failed: ' + err.message });
    }
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ payment_status: refund ? 'refunded' : 'cancelled' })
    .eq('id', booking_id);

  if (updateError) return res.status(500).json({ error: updateError.message });

  res.status(200).json({ success: true, refunded: !!refund, refundedAmount });
};
