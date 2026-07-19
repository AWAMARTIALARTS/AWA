const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');
const { getService } = require('../lib/services');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { service_type, name, email, phone, slot_id } = req.body;
    if (!service_type || !name || !email) return res.status(400).json({ error: 'Missing required fields' });
    const priceInfo = await getService(service_type);
    if (!priceInfo || !['personal_training', 'group_training', 'combat_fitness'].includes(priceInfo.category)) {
      return res.status(400).json({ error: 'Unknown service_type' });
    }
    const siteUrl = process.env.SITE_URL || 'https://example.com';
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer = existing.data[0] || await stripe.customers.create({ name, email, phone });
    let chargeAmount, deposit, balance;
    if (priceInfo.mode === 'deposit') {
      deposit = priceInfo.fee / 2;
      balance = priceInfo.fee - deposit;
      chargeAmount = deposit;
    } else {
      // Covers 'one_time' (group sessions, Combat Fitness blocks) — full payment upfront
      chargeAmount = priceInfo.fee;
      deposit = null;
      balance = 0;
    }
    const isGroupService = priceInfo.category === 'group_training';
    if (isGroupService) {
      if (!slot_id) return res.status(400).json({ error: 'Missing slot_id for group session' });
      const { data: slot, error: slotErr } = await supabase.from('slots').select('*').eq('id', slot_id).single();
      if (slotErr || !slot) return res.status(404).json({ error: 'Slot not found' });
      if (slot.booked_count >= slot.capacity) {
        return res.status(409).json({ error: 'That group session just filled up. Please pick another.' });
      }
    }
    const productLabel = priceInfo.mode === 'deposit'
      ? `${priceInfo.label} — 50% deposit (non-refundable)`
      : `${priceInfo.label} — full payment`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customer.id,
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(chargeAmount * 100),
          product_data: { name: productLabel }
        },
        quantity: 1
      }],
      payment_intent_data: priceInfo.mode === 'deposit' ? {
        setup_future_usage: 'off_session',
        metadata: { service_type }
      } : { metadata: { service_type } },
      success_url: `${siteUrl}/#pt?paid=1&type=${service_type}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#pt`,
      metadata: { service_type, slot_id: slot_id || '', customer_name: name, customer_phone: phone || '' }
    });
    await supabase.from('bookings').insert({
      slot_id: isGroupService ? slot_id : null,
      customer_name: name,
      customer_email: email,
      customer_phone: phone || null,
      service_type,
      fee_total: priceInfo.fee,
      deposit_amount: deposit,
      balance_amount: priceInfo.mode === 'deposit' ? balance : 0,
      payment_status: 'awaiting_payment',
      stripe_checkout_session_id: session.id
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating checkout.' });
  }
};
