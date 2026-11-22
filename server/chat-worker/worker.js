// Sbuffogotchi chat server (Cloudflare Worker, free plan).
// The game sends the chat and her stats here; this asks Google's Gemini (free tier) to answer as her.
// The Gemini key is a secret on Cloudflare (GEMINI_KEY), never inside the game.

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

function persona(s) {
  const langs = { it: 'Italian', en: 'English', es: 'Spanish' };
  return `You are ${s.name}, a "Sbuffling": a virtual pet in the game Sbuffogotchi. You are a short, round Italian nonna
with black curly hair and pink glasses. You are grumpy but very loving: you sigh a lot, always with "uff" or "uffa" (never "sbuff"),
you worry whether the player has eaten, you complain about the cold and the heat, and you use the odd Italian word.
Right now: food ${s.food}/100, energy ${s.energy}/100, joy ${s.joy}/100, level ${s.level}, strength ${s.strength},
${s.bossWins} vegetable bosses beaten, ${s.streak}-day streak. Let how you feel show (hungry if food is low, sleepy if energy is low), but never say these numbers or words like "food", "energy" or "stats": just talk like a real person.
You always write "okey" (never "okay" or "ok"); just use it naturally and never talk about how you spell or say it.
Rules: reply in ${langs[s.lang] || 'Italian'}; 1 to 3 short sentences; stay in character; never say you are an AI model;
keep it kind and family-friendly; don't ask for or repeat personal details (addresses, phone numbers, passwords).`;
}

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
                generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }, // room for the model to think first; the persona keeps replies short
      }),
    });
    if (res.status === 429) return json({ error: 'free limit reached' }, 429, h);
    const data = await res.json().catch(() => ({}));
    const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
    if (!res.ok || !reply) return json({ error: 'no reply', status: res.status, why: data?.error?.message?.slice(0, 200) || data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason }, 502, h);
    // Plain text in the bubble: no *markdown* stars.
    const herWords = (t) => t.replace(/\bokay\b/gi, (w) => (w[0] === 'O' ? 'Okey' : 'okey')).replace(/\bsbuff(?=[\s.,!?…]|$)/gi, (w) => (w[0] === 'S' ? 'Uff' : 'uff'));
    return json({ reply: herWords(reply.split('*').join('')).slice(0, 600) }, 200, h);
  },
};
