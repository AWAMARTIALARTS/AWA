const supabase = require('../lib/supabase');
const { getAuthedMember } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const member = await getAuthedMember(req);
  if (!member) return res.status(401).json({ error: 'Please log in with an active membership to view this content.' });

  const { topic } = req.query;
  if (!topic) return res.status(400).json({ error: 'Missing topic.' });

  const { data, error } = await supabase
    .from('academy_content')
    .select('id, title, body, video_url, sort_order')
    .eq('topic', topic)
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ content: data });
};
