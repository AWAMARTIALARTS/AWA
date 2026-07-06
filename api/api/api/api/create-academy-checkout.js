const { stripe } = require('../lib/stripe');
const { getService } = require('../lib/services');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan, email } = req.body;
    const priceInfo = await getService(plan);
    if (!priceInfo || priceInfo.category !== 'academy' || !email) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }

    const siteUrl = process.env.SITE_URL || 'https://example.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(priceInfo.fee * 100),
          product_data: { name: `Academy Training — ${priceInfo.label}` }
        },
        quantity: 1
      }],
      success_url: `${siteUrl}/#ac?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#ac`,
      metadata: { plan }
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong creating checkout.' });
  }
};
