const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return res.status(200).json({ valid: false });

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, service_type, customer_name, customer_email, slot_id')
      .eq('stripe_checkout_session_id', session_id)
      .single();

    if (!booking) return res.status(200).json({ valid: false });

    res.status(200).json({
      valid: true,
      booking_id: booking.id,
      service_type: booking.service_type,
      name: booking.customer_name,
      email: booking.customer_email,
      already_scheduled: !!booking.slot_id
    });
  } catch (err) {
    res.status(200).json({ valid: false });
  }
};
