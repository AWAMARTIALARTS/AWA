const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });

  if (req.method === 'GET') {
    const { topic } = req.query;
    let query = supabase.from('academy_content').select('*').order('topic').order('sort_order');
    if (topic) query = query.eq('topic', topic);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ content: data });
  }

  if (req.method === 'POST') {
    const { topic, title, body, video_url, sort_order } = req.body || {};
    if (!topic || !title) return res.status(400).json({ error: 'Topic and title are required.' });

    const { data, error } = await supabase
      .from('academy_content')
      .insert({ topic, title, body: body || null, video_url: video_url || null, sort_order: sort_order || 0 })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, content: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    const { error } = await supabase.from('academy_content').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
