const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');
const { getService } = require('../lib/services');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { session_id, slot_id, name, email } = req.body;
    if (!session_id || !slot_id || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not confirmed' });
    }

    const { data: slot, error: slotErr } = await supabase
      .from('slots').select('*').eq('id', slot_id).single();
    if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
    if (slot.booked_count >= slot.capacity) {
      return res.status(409).json({ error: 'That class is now full — please pick another time.' });
    }

    const plan = session.metadata?.plan;
    const priceInfo = (await getService(plan)) || { fee: 0, label: 'Academy' };

    await supabase.from('bookings').insert({
      slot_id,
      customer_name: name,
      customer_email: email,
      service_type: plan,
      fee_total: priceInfo.fee,
      payment_status: 'paid_full',
      stripe_checkout_session_id: session_id
    });

    await supabase.from('slots').update({ booked_count: slot.booked_count + 1 }).eq('id', slot_id);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong booking your slot.' });
  }
};
