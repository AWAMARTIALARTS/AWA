const supabase = require('../lib/supabase');
const { stripe } = require('../lib/stripe');
const { getService } = require('../lib/services');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { service_type, name, email, phone, slot_id, slot_ids } = req.body;
    if (!service_type || !name || !email) return res.status(400).json({ error: 'Missing required fields' });

    const priceInfo = await getService(service_type);
    if (!priceInfo || !['personal_training', 'group_training', 'combat_fitness'].includes(priceInfo.category)) {
      return res.status(400).json({ error: 'Unknown service_type' });
    }

    // Combat Fitness has no calendar — everything else needs at least one slot chosen up front
    const isBlockBooking = service_type === 'block4';
    const needsSlots = priceInfo.category !== 'combat_fitness';
    const chosenSlotIds = isBlockBooking ? (slot_ids || []) : (slot_id ? [slot_id] : []);

    if (needsSlots && !chosenSlotIds.length) {
      return res.status(400).json({ error: 'Please choose a session time first.' });
    }
    if (isBlockBooking && chosenSlotIds.length !== 4) {
      return res.status(400).json({ error: 'Please choose exactly 4 sessions for the 4-week block.' });
    }

    // Validate every chosen slot still has room, and reserve it now so nobody
    // else can take it while this customer is paying
    const reservedSlots = [];
    for (const id of chosenSlotIds) {
      const { data: slot, error: slotErr } = await supabase.from('slots').select('*').eq('id', id).single();
      if (slotErr || !slot) return res.status(404).json({ error: 'One of the chosen sessions could not be found.' });
      if (slot.booked_count >= slot.capacity || slot.blocked) {
        return res.status(409).json({ error: 'One of the chosen sessions just filled up. Please pick another.' });
      }
      reservedSlots.push(slot);
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
      chargeAmount = priceInfo.fee;
      deposit = null;
      balance = 0;
    }

    const productLabel = priceInfo.mode === 'deposit'
      ? `${priceInfo.label} — 50% deposit (non-refundable)`
      : `${priceInfo.label} — full payment`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customer.id,
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      expires_at: Math.floor(Date.now() / 1000) + 40 * 60, // 40 minutes — safely clears Stripe's 30-min minimum
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
      success_url: `${siteUrl}/#pt?paid=1`,
      cancel_url: `${siteUrl}/#pt`,
      metadata: { service_type, customer_name: name, customer_phone: phone || '' }
    });

    // Reserve every chosen slot now, and create one booking row per slot
    // (a 4-week block becomes 4 linked booking rows sharing the same
    // checkout session id, so the webhook can mark them all paid together)
    for (const slot of reservedSlots) {
      await supabase.from('slots').update({ booked_count: slot.booked_count + 1 }).eq('id', slot.id);
      await supabase.from('bookings').insert({
        slot_id: slot.id,
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
    }

    // Combat Fitness has no slot — still needs its one booking row
    if (!needsSlots) {
      await supabase.from('bookings').insert({
        slot_id: null,
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
    }

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message ? `Something went wrong: ${err.message}` : 'Something went wrong creating checkout.' });
  }
};
