// Which model plays which part, and how much each call may spend. Shared by server.js (local) and
// worker/index.js (hosted), so the two can't drift apart.
export const MODELS = {
  karla: 'claude-opus-5-5',      // Karla's decision-making
  debrief: 'claude-opus-5-5',    // the after-action analysis
  voice: 'claude-haiku-5-5',     // agents' voices in the morning reports
};
export const MAX_TOKENS = { karla: 8000, debrief: 6000, voice: 2500 };
export const EFFORT = { karla: 'medium', debrief: 'medium', voice: 'low' };
