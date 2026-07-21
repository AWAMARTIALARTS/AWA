const { getAuthedMember } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const member = await getAuthedMember(req);
  if (!member) return res.status(401).json({ error: 'Please log in.' });

  res.status(200).json({
    solo_challenge_active: member.solo_challenge_active,
    fitness_active: member.fitness_active,
    current_level: member.current_level,
  });
};
