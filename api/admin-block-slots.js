const supabase = require('../lib/supabase');

function checkAdmin(req) {
  return req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
}

// Parses "7:15am" / "12:00pm" style strings into minutes since midnight,
// so hour-range blocking can compare times regardless of format quirks.
function toMinutes(timeStr) {
  const match = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;
  let [, h, m, ampm] = match;
  h = parseInt(h, 10);
  m = parseInt(m, 10);
  ampm = ampm.toLowerCase();
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + m;
}

module.exports = async (req, res) => {
  if (!checkAdmin(req)) return res.status(401).json({ error: 'Incorrect admin password.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { slot_date, category, start_time, end_time, blocked } = req.body || {};
  if (!slot_date || typeof blocked !== 'boolean') {
    return res.status(400).json({ error: 'slot_date and blocked (true/false) are required.' });
  }

  let query = supabase.from('slots').select('id, slot_time').eq('slot_date', slot_date);
  if (category) query = query.eq('category', category);

  const { data: candidates, error: fetchError } = await query;
  if (fetchError) return res.status(500).json({ error: fetchError.message });

  let targetIds = candidates.map(s => s.id);

  // If an hour range was given, narrow down to only slots starting within it
  if (start_time && end_time) {
    const startMin = toMinutes(start_time);
    const endMin = toMinutes(end_time);
    targetIds = candidates
      .filter(s => {
        const t = toMinutes(s.slot_time);
        return t !== null && startMin !== null && endMin !== null && t >= startMin && t <= endMin;
      })
      .map(s => s.id);
  }

  if (!targetIds.length) {
    return res.status(200).json({ success: true, updated: 0, message: 'No matching slots found for that day/range.' });
  }

  const { error: updateError } = await supabase.from('slots').update({ blocked }).in('id', targetIds);
  if (updateError) return res.status(500).json({ error: updateError.message });

  res.status(200).json({ success: true, updated: targetIds.length });
};
