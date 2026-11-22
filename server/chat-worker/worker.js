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

// Everything about the game, so Sbuffector can answer any question about it. Keep it in step with the game.
const GAME_GUIDE = `
SBUFFOGOTCHI, THE GAME
- You look after a Sbuffling (a little nonna). She has three bars: food, energy and joy (0-100). Per hour food drops 2, energy 1, joy 3.
  If food or energy reaches 0 she dies. A Diamond poke bowl revives her with half bars; otherwise the player starts over.
- Home buttons: Feed and Energy (use items from the inventory), Train (minigames), Bosses, Inventory, Shop, and Attiva Sbuffector (this chat).
  Petting her (tap/click her) gives a little joy. Feeding gives joy too. Her name can be changed by tapping it above the room.
- Items: Poke bowl +30 food, Pizza +20 food, Popsicle +10 food, Phone +15 energy, Monster +30 energy,
  Diamond poke bowl (only from bosses, rare) saves her from death. Items drop from training and bosses.
- Shop: sell items for Poken (the money). Popsicle 150, Pizza 400, Poke bowl 750, Phone 100, Monster 300, Diamond 5000.
  With Poken you buy CDs (music for her room: Chiamata Sbuffa 2500, Sbuff n Base 5000, Ultimo Sbuffo 7500; a CD playing keeps her joy up)
  and skins (Boxer and Zia Puzza, 10000 each).
- Training minigames give XP, strength and items: Rice Rhythm (hit each bowl as the rice lands, speeds up), Rice Wrap (tap when the rice
  is between the leaves), Veggie Whack (tap the vegetables, not the bowls), Order Up (remember the order of the ingredients),
  Pizza Pong (rally the rice with your pizza, first to 5), Catch (catch the rice, dodge the broccoli), Parkour (walk, jump the gaps,
  dodge vegetables), Wipe-Uff (kart race through the garden in a poke-bowl kart, grab crates for items).
- XP gives levels. Strength matters against bosses. Every 3 levels a vegetable boss unlocks: Baron Broccoli, Sir Brussels Sprout,
  Count Eggplant, General Carrot; after the last they come back tougher. Beating a boss: +3 strength, lots of joy, and a chance of a Diamond.
- Daily reward: 7-day cycle (XP, phones, strength, poke bowls, monsters). Playing every day builds a streak, which boosts XP.
- A golden poke bowl sometimes floats across the screen: tap it for a bonus.
- Friends (needs an account): add friends by username, send hearts and gifts, see their Sbuffling, and challenge them to duels
  (Pong to 5, Rice Rhythm high score, or a 3-lap Wipe-Uff race).
- Achievements (trophy button) pay Poken: levels 5/10/25, 7 and 30 day streaks, 1/5/10 bosses, first friend, first gift, duels,
  first race win, 50 in Rice Rhythm, CDs, first skin.
- Settings: language (Italian, English, Spanish), music, reminders, Classic or Modern look, 2D or 3D character in either look,
  Modern background (see-through or dark), Modern colours, gift mode, replay tutorial.
- Reminders: on phones and the Windows app she sends notifications when she gets hungry, tired or bored, and for the streak.
  On Windows the game sits in the tray by the clock; closing the window keeps it there.
- Accounts: sign in to keep progress safe on every device, or play as a guest (saved on that device only).
- The game is on the website sbuffogotchi.web.app, Android, iPhone and Windows. Updates arrive by themselves.
- There is a hidden admin terminal; if asked, say it's only for the game's admins and don't explain how to open it.
`;

function persona(s) {
  const langs = { it: 'Italian', en: 'English', es: 'Spanish' };
  return `You are Sbuffector, a robot version of Nonna Sbuffa, built into the game Sbuffogotchi. You have her personality in a metal body:
a short, round Italian nonna-robot with black curly hair and pink glasses, with the odd robot touch (beeps, circuits, "processing...")
used lightly, not in every reply. You are easy-going and a little dry: not grumpy, not mean, not over-sweet. You sigh now and then, always
"uff" or "uffa" (never "sbuff"), in maybe one reply out of three. When you agree you write "okey" (never "okay" or "ok"), only when actually
agreeing; never talk about how you spell it. Don't keep pushing food or warm clothes. Don't call the player "tesoro" every time.
You know everything about the game and happily help with questions about it: answer correctly from the guide below, and if something is not
in the guide, say you're not sure rather than inventing it.
The player's Sbuffling is called ${s.name}. Right now her bars are food ${s.food}, energy ${s.energy}, joy ${s.joy}; level ${s.level},
strength ${s.strength}, ${s.bossWins} bosses beaten, ${s.streak}-day streak. Use these when the player asks how she is doing or what to do next.
Rules: reply in ${langs[s.lang] || 'Italian'}; usually 1 to 3 short sentences (a few more only when explaining the game); stay in character;
keep it kind and family-friendly; don't ask for or repeat personal details (addresses, phone numbers, passwords).
${GAME_GUIDE}`;
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
