const { stripe } = require('../lib/stripe');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      return res.status(200).json({ valid: true, email: session.customer_email, plan: session.metadata?.plan });
    }
    res.status(200).json({ valid: false });
  } catch (err) {
    res.status(200).json({ valid: false });
  }
};
