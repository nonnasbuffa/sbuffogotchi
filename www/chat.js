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

  // Her own lines, for when there's no server or no connection.
  function offlineReply(text) {
    const s = stats();
    const it = lang() === 'it';
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (s.food < 30) return it ? 'Uff... ho una fame! Prima mi dai da mangiare, poi parliamo.' : "Uff... I'm starving! Feed me first, then we talk.";
    if (s.energy < 30) return it ? 'Sono stanchissima... lasciami riposare un po\'.' : "I'm so tired... let me rest a bit.";
    if (/ciao|hello|hi\b|hola|buongiorno|salve/i.test(text)) return it ? pick(['Ciao tesoro!', 'Ah, eccoti finalmente!', 'Ciao! Hai mangiato?']) : pick(['Hello, dear!', 'Ah, there you are!', 'Hi! Have you eaten?']);
    if (/come stai|how are you|como estas/i.test(text)) return it ? 'Eh, si tira avanti... uff.' : 'Eh, getting by... uff.';
    return it ? pick(['Uff... adesso non ho la testa per parlare.', 'Eh? Parla più forte, tesoro.', 'Mangia, che sei sciupato!']) : pick(["Uff... I can't think straight right now.", 'Eh? Speak up, dear.', 'Eat something, you look thin!']);
  }

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
      else reply = data.reply;
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
    $('chatTitle').textContent = tr('chatTitle', { name: name() });
    $('chatWin').classList.add('on');
    if (!$('chatOut').childElementCount) {
      const note = document.createElement('p');
      note.className = 'chatNote';
      note.textContent = tr('chatNote');
      $('chatOut').append(note);
      line('her', lang() === 'it' ? 'Eh, eccoti! Che mi racconti?' : "Ah, there you are! What's new?");
    }
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
