module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password } = req.body || {};
  if (password === process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ valid: true });
  }
  res.status(401).json({ valid: false });
};
