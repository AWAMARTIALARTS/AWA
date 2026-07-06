const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const passcode = req.headers['x-admin-passcode'];
  if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
    return res.status(401).json({ error: 'Incorrect passcode' });
  }

  try {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'Missing booking_id' });

    const { data: booking, error } = await supabase
      .from('bookings').select('*').eq('id', booking_id).single();
    if (error || !booking) return res.status(404).json({ error: 'Booking not found' });

    if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
      return res.status(400).json({ error: 'No saved card on file for this booking — it must be charged manually.' });
    }
    if (booking.payment_status === 'no_show_charged') {
      return res.status(400).json({ error: 'This booking has already been charged as a no-show.' });
    }

    const amount = Math.round((booking.balance_amount || booking.fee_total / 2) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'gbp',
      customer: booking.stripe_customer_id,
      payment_method: booking.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `No-show charge — ${booking.customer_name} (${booking.service_type})`
    });

    await supabase.from('bookings').update({
      payment_status: 'no_show_charged',
      no_show: true
    }).eq('id', booking_id);

    res.status(200).json({ success: true, payment_intent: paymentIntent.id });
  } catch (err) {
    if (err.code === 'authentication_required') {
      return res.status(402).json({
        error: 'The card requires the customer to re-authenticate — it could not be charged automatically. Send them a Stripe invoice or payment link to collect this instead.'
      });
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Charge failed.' });
  }
};
