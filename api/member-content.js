const supabase = require('../lib/supabase');
const { getAuthedMember } = require('../lib/auth');

// Which membership each topic belongs to
const SOLO_TOPICS = ['stance-guard', 'movement', 'punch-technique', 'head-movement'];
const FITNESS_TOPICS = ['bag-work', 'fitness-workouts', 'circuit-training', 'nutrition'];

function hasAccess(member, topic) {
  if (SOLO_TOPICS.includes(topic)) return !!member.solo_challenge_active;
  // Fitness Subscription AND Hybrid members both see the same fitness content
  if (FITNESS_TOPICS.includes(topic)) return !!member.fitness_active || !!member.membership_active;
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const member = await getAuthedMember(req);
  if (!member) return res.status(401).json({ error: 'Please log in to view this content.' });

  const { topic } = req.query;
  if (!topic) return res.status(400).json({ error: 'Missing topic.' });

  if (!hasAccess(member, topic)) {
    return res.status(403).json({ error: 'Your membership for this content isn\'t currently active. Please check your payment status or renew to regain access.' });
  }

  const { data, error } = await supabase
    .from('academy_content')
    .select('id, title, body, video_url, sort_order')
    .eq('topic', topic)
    .order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ content: data });
};
