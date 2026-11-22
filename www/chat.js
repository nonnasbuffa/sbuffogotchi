// Chat with her: a terminal-style window where the player talks to their Sbuffling.
// Replies come from a small server (server/chat-worker) that asks Google's Gemini with her personality.
// Until that server is set up, or when it can't be reached, she answers from a few lines of her own.
const Chat = (() => {
  // The address of the chat server once it's deployed (see server/chat-worker/README.md).
  const CHAT_URL = 'https://sbuffogotchi-chat.pistacchiogustopistacchio.workers.dev';
  const MAX_HISTORY = 12; // how many past messages she remembers in one chat
  const $ = (id) => document.getElementById(id);
  // Game and I18n are top-level consts in other scripts, so they aren't on window.
  const G = () => (typeof Game !== 'undefined' ? Game : null);
  const L = () => (typeof I18n !== 'undefined' ? I18n : null);
  let history = [];
  let busy = false;

  const name = () => (G()?.petName?.() || 'Sbuffling');
  const lang = () => L()?.current?.() || 'it';
  const tr = (k, v) => (L() ? L().t(k, v) : k);

  function line(who, text, cls = '') {
    const row = document.createElement('div');
    row.className = `chatMsg ${who} ${cls}`;
    if (who === 'her') {
      const face = document.createElement('img');
      face.src = 'sprites/chat_face.png'; face.alt = '';
      row.append(face);
    }
    const bubble = document.createElement('div');
    bubble.className = 'chatBubble';
    bubble.textContent = text;
    row.append(bubble);
    $('chatOut').append(row);
    $('chatOut').scrollTop = $('chatOut').scrollHeight;
    return bubble;
  }

  // What she knows about herself right now, sent along with every message.
  function stats() {
    const S = G()?.state?.() || {};
    const r = (v) => Math.round(v ?? 0);
    return { name: name(), food: r(S.food), energy: r(S.energy), joy: r(S.joy), level: S.level || 1, strength: S.str || 1, streak: S.streak || 0, bossWins: S.bossWins || 0, lang: lang() };
  }

  // Her own lines, for when there's no server or no connection. (She says "uff"/"uffa" and "okey", never "okay".)
  const OFFLINE = {
    it: { hungry: ['Uff... ho una fame! Prima mi dai da mangiare, poi parliamo.'], tired: ['Uffa, sono stanchissima... lasciami riposare un po\'.'],
      hello: ['Ciao tesoro!', 'Ah, eccoti finalmente!', 'Ciao! Hai mangiato?'], how: ['Eh, si tira avanti... uff.'],
      other: ['Uff... adesso non ho la testa per parlare.', 'Eh? Parla più forte, tesoro.', 'Mangia, che sei sciupato!', 'Okey, okey... uffa.'] },
    en: { hungry: ["Uff... I'm starving! Feed me first, then we talk."], tired: ["Uffa, I'm so tired... let me rest a bit."],
      hello: ['Hello, dear!', 'Ah, there you are!', 'Hi! Have you eaten?'], how: ['Eh, getting by... uff.'],
      other: ["Uff... I can't think straight right now.", 'Eh? Speak up, dear.', 'Eat something, you look thin!', 'Okey, okey... uffa.'] },
    es: { hungry: ['Uff... ¡tengo un hambre! Primero dame de comer y luego hablamos.'], tired: ['Uffa, estoy cansadísima... déjame descansar un poco.'],
      hello: ['¡Hola, cariño!', '¡Ah, por fin llegas!', '¡Hola! ¿Has comido?'], how: ['Eh, ahí vamos... uff.'],
      other: ['Uff... ahora no tengo cabeza para hablar.', '¿Eh? Habla más fuerte, cariño.', '¡Come algo, que estás muy flaco!', 'Okey, okey... uffa.'] },
  };
  function offlineReply(text) {
    const s = stats();
    const L2 = OFFLINE[lang()] || OFFLINE.it;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (s.food < 30) return pick(L2.hungry);
    if (s.energy < 30) return pick(L2.tired);
    if (/ciao|hello|\bhi\b|hola|buongiorno|salve/i.test(text)) return pick(L2.hello);
    if (/come stai|how are you|c[oó]mo est[aá]s/i.test(text)) return pick(L2.how);
    return pick(L2.other);
  }

  // Her way of talking: "okey" (closed e), never "okay"; "uff"/"uffa", never "sbuff".
  const herWords = (s) => s.replace(/\bokay\b/gi, (w) => (w[0] === 'O' ? 'Okey' : 'okey')).replace(/\bsbuff(?=[\s.,!?…]|$)/gi, (w) => (w[0] === 'S' ? 'Uff' : 'uff'));
  async function send(text) {
    text = text.trim().slice(0, 300);
    if (!text || busy) return;
    busy = true;
    line('me', text);
    history.push({ role: 'user', text });
    const bubble = line('her', '…', 'typing');
    let reply = '';
    try {
      if (!CHAT_URL) throw new Error('no server');
      const res = await fetch(CHAT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY), stats: stats() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) reply = tr('chatBusy');
      else if (!res.ok || !data.reply) throw new Error(data.error || res.status);
      else reply = herWords(data.reply);
    } catch {
      reply = offlineReply(text);
    }
    bubble.parentElement.classList.remove('typing');
    bubble.textContent = reply;
    history.push({ role: 'model', text: reply });
    $('chatOut').scrollTop = $('chatOut').scrollHeight;
    busy = false;
  }

  function open() {
    $('chatTitle').textContent = `Sbuffector · ${name()}`;
    $('chatWin').classList.add('on');
    if (!$('chatOut').childElementCount) {
      const note = document.createElement('p');
      note.className = 'chatNote';
      note.textContent = tr('chatNote');
      $('chatOut').append(note);
    }
    // The player writes first; the hint and note follow the current language.
    $('chatIn').placeholder = tr('chatPh', { name: name() });
    $('chatOut').querySelector('.chatNote').textContent = tr('chatNote');
    setTimeout(() => $('chatIn').focus(), 30);
  }
  const close = () => { $('chatWin').classList.remove('on'); $('chatIn').blur(); };

  function start() {
    $('btnChat').onclick = open;
    $('btnChatClose').onclick = close;
    $('chatIn').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value; e.target.value = ''; send(v); }
      if (e.key === 'Escape') close();
    });
    $('btnChatSend').onclick = () => { const v = $('chatIn').value; $('chatIn').value = ''; send(v); $('chatIn').focus(); };
  }
  return { start, open, close, send };
})();
