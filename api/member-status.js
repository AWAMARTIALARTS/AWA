const supabase = require('../lib/supabase');
module.exports = async (req, res) => {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['academy_training_live', 'solo_challenge_live', 'fitness_subscription_live', 'combat_fitness_live']);
  const flags = { academy_training: false, solo_challenge: false, fitness_subscription: false, combat_fitness: false };
  (data || []).forEach(row => {
    if (row.key === 'academy_training_live') flags.academy_training = row.value === 'true';
    if (row.key === 'solo_challenge_live') flags.solo_challenge = row.value === 'true';
    if (row.key === 'fitness_subscription_live') flags.fitness_subscription = row.value === 'true';
    if (row.key === 'combat_fitness_live') flags.combat_fitness = row.value === 'true';
  });
  res.status(200).json(flags);
};
