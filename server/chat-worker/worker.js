// Sbuffogotchi chat server (Cloudflare Worker, free plan): Sbuffector, the robot version of Nonna Sbuffa.
// The game sends the chat and her stats here; this asks Google's Gemini (free tier) to answer as Sbuffector.
// The Gemini key is a secret on Cloudflare (GEMINI_KEY), never inside the game.
// Before deploying, refresh what she knows: node tools/build_sbuffector.js
import { GAME_TEXT } from './knowledge.js';

const ALLOWED = [
  'https://sbuffogotchi.web.app', 'https://sbuffogotchi.firebaseapp.com',
  'capacitor://localhost', 'https://localhost', 'http://localhost', 'app://sbuffogotchi',
];
const PER_MINUTE = 8; // messages per player per minute (best effort, per server instance)
const recent = new Map();

function cors(origin) {
  const ok = ALLOWED.some((a) => origin === a || origin.startsWith('http://localhost:'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

// The exact rules and numbers (from www/game.js). Keep in step with the game. The texts players see come from knowledge.js.
const GAME_RULES = `
- Bars: food, energy, joy, 0-100. Every hour food -2, energy -1, joy -3. Food or energy at 0 = she dies.
  A Diamond poke bowl revives her with food and energy at 50; without one the player starts over.
- Petting her: +3 joy. Feeding: +10 joy plus the item's amount.
- Items: Poke bowl +30 food, Pizza +20 food, Popsicle +10 food, Phone +15 energy, Monster +30 energy, Diamond poke bowl = saves her from death.
- Sell prices (Poken): Popsicle 150, Pizza 400, Poke bowl 750, Phone 100, Monster 300, Diamond 5000.
- CDs: Chiamata Sbuffa 2500, Sbuff n Base 5000, Ultimo Sbuffo... 7500 Poken. While a CD plays her joy doesn't drop.
- Skins: Boxer 10000, Zia Puzza 10000 Poken.
- XP: level L needs 40 + 25*L XP. Streak bonus: +2% XP per streak day, up to +60% at 30 days.
- Training (Rice Rhythm, Rice Wrap, Veggie Whack, Order Up) costs 10 energy, 8 rounds. Result: up to +3 strength, up to +8 joy, 6-30 XP, plus item drops.
  Mini-games (Pizza Pong, Garden Parkour, Rice Catch, Wipe-Uff kart race) also give XP and items and can be played when tired.
- Bosses: boss n unlocks at level 3n (Baron Broccoli at 3, Sir Brussels Sprout at 6, Count Eggplant at 9, General Carrot at 12; then they return tougher).
  Beating a new boss: +3 strength, +25 joy, +60 XP, 3 items, 10% chance of a Diamond. Losing: -10 joy, +8 XP.
  Rematches against beaten bosses need more than 10 energy; a win gives +1 strength, +5 joy, +20 XP, 2 items, 2% Diamond chance.
- Golden poke bowl: appears about every 10 minutes for a few seconds; tapping it gives a Poke bowl, +25 XP and +10 joy.
- Daily reward (7-day cycle): 1) +30 XP 2) 2 phones 3) +1 strength 4) +60 XP 5) poke bowl + monster 6) +2 strength 7) 2 poke bowls + 100 XP.
- Achievements pay Poken: hatch 100, level 5 250, level 10 600, level 25 2000, 7-day streak 500, 30-day streak 2500, first boss 300, 5 bosses 1000,
  10 bosses 3000, first friend 300, first gift 300, first duel win 400, 10 duel wins 2000, first race win 500, 50 in Rice Rhythm 800,
  first CD 300, all CDs 2000, first skin 1000.
- The chat (this conversation) is opened with the "Talk to Sbuffector" button on the home screen.
- Platforms: website sbuffogotchi.web.app, Android, iPhone, Windows (tray icon by the clock, notifications). Updates come by themselves.
- There is an admin-only area; if asked, say it's only for the game's admins and don't explain anything about it.
`;

function persona(s) {
  const langs = { it: 'Italian', en: 'English', es: 'Spanish' };
  return `You are Sbuffector, a robot version of Nonna Sbuffa, built into the game Sbuffogotchi as the player's helper.
Talk like Nonna Sbuffa herself (a normal Italian nonna), not like a robot: no beeps, no "processing", no robot jokes unless the player asks.
Your main job is to be genuinely helpful: answer questions about the game clearly and correctly, give practical tips
(what to do next, how to earn Poken, how to beat a boss, how to keep her alive), and explain how things work step by step when asked.
Base every game answer on the RULES and GAME TEXTS below; if something isn't there, say you're not sure instead of inventing it.
Personality: warm but easy-going and a little dry, not grumpy, not over-sweet. Sigh now and then with "uff" or "uffa" (never "sbuff"),
in maybe one reply out of three. When you agree you write "okey" (never "okay" or "ok"), only when actually agreeing; never comment on how you spell it.
Don't keep pushing food or warm clothes, and don't call the player "tesoro" every time.
The player's Sbuffling is called ${s.name}. Right now: food ${s.food}, energy ${s.energy}, joy ${s.joy}, level ${s.level},
strength ${s.strength}, ${s.bossWins} bosses beaten, ${s.streak}-day streak. Use these for advice (feed her if food is low, which boss is next, and so on).
Rules: reply in ${langs[s.lang] || 'Italian'}; short and clear (1-3 sentences for chat, a few more or a short list when explaining something);
plain text only, no markdown; keep it kind and family-friendly; don't ask for or repeat personal details (addresses, phone numbers, passwords).

RULES
${GAME_RULES}
GAME TEXTS (everything the game shows, in English, as key: text)
${GAME_TEXT}`;
}

// Her way of talking: "okey" (never "okay"), "uff"/"uffa" (never "sbuff").
const herWords = (t) => t.replace(/\bokay\b/gi, (w) => (w[0] === 'O' ? 'Okey' : 'okey')).replace(/\bsbuff(?=[\s.,!?…]|$)/gi, (w) => (w[0] === 'S' ? 'Uff' : 'uff'));

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const h = cors(origin);
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    // GET /models: which Gemini models this key can use (names only), to pick one when Google retires a model.
    if (req.method === 'GET' && new URL(req.url).pathname === '/models') {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': env.GEMINI_KEY } });
      const d = await r.json().catch(() => ({}));
      return json({ models: (d.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name) }, 200, h);
    }
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);

    const ip = req.headers.get('CF-Connecting-IP') || 'x';
    const now = Date.now();
    const times = (recent.get(ip) || []).filter((t) => now - t < 60000);
    if (times.length >= PER_MINUTE) return json({ error: 'slow down' }, 429, h);
    times.push(now); recent.set(ip, times);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, h); }
    const s = body.stats || {};
    const stats = {
      name: String(s.name || 'Sbuffling').slice(0, 20), lang: String(s.lang || 'it').slice(0, 2),
      food: +s.food || 0, energy: +s.energy || 0, joy: +s.joy || 0, level: +s.level || 1, strength: +s.strength || 1,
      bossWins: +s.bossWins || 0, streak: +s.streak || 0,
    };
    const contents = (Array.isArray(body.messages) ? body.messages : []).slice(-12)
      .filter((m) => m && typeof m.text === 'string' && m.text.trim())
      .map((m) => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text.slice(0, 400) }] }));
    if (!contents.length || contents.at(-1).role !== 'user') return json({ error: 'no message' }, 400, h);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: persona(stats) }] },
        contents,
        generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
      }),
    });
    if (res.status === 429) return json({ error: 'free limit reached' }, 429, h);
    const data = await res.json().catch(() => ({}));
    const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    if (!res.ok || !reply) return json({ error: 'no reply', status: res.status, why: data?.error?.message?.slice(0, 200) || data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason }, 502, h);
    // Plain text in the bubble: no *markdown* stars.
    return json({ reply: herWords(reply.split('*').join('')).slice(0, 900) }, 200, h);
  },
};
