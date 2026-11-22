// Phone reminders, scheduled on the device with Capacitor's Local Notifications plugin.
// The website has no plugin, so everything here quietly does nothing there.
const Notify = (() => {
  const KEY = 'sbuffogotchi.notify';
  const ASKED_KEY = 'sbuffogotchi.notifyAsked';
  const IDS = Array.from({ length: 60 }, (_, i) => 101 + i);
  const plugin = () => (window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.LocalNotifications : null);
  // The Windows app: no plugin, but the game keeps running in the tray, so it fires its own timers.
  const desktop = () => window.Desktop || null;
  let timers = [];
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* stays on */ }

  async function granted(ask) {
    const p = plugin();
    if (!p) return false;
    let state = (await p.checkPermissions()).display;
    if (state !== 'granted' && ask) state = (await p.requestPermissions()).display;
    return state === 'granted';
  }
  // Asks for permission once, the first time it makes sense (after the tutorial, or on first launch).
  async function askOnce() {
    if (!plugin() || !enabled) return;
    try {
      if (localStorage.getItem(ASKED_KEY)) return;
      localStorage.setItem(ASKED_KEY, '1');
      await granted(true);
    } catch { /* the player can switch it on in Settings */ }
  }
  async function clear() {
    clearTimers();
    const p = plugin();
    if (!p) return;
    try {
      await p.cancel({ notifications: IDS.map((id) => ({ id })) });
      await p.removeAllDeliveredNotifications?.();
    } catch { /* nothing scheduled */ }
  }
  // Replaces every pending reminder with this list of { id, title, body, at }.
  async function plan(list) {
    if (desktop()) {
      clearTimers();
      if (!enabled) return;
      const now = Date.now();
      // Timers further away than ~24 days overflow, and the plan is rebuilt long before then anyway.
      for (const n of list.filter((x) => x.at > now + 60000 && x.at - now < 2e9)) {
        timers.push(setTimeout(() => desktop().notify(n.title, n.body), n.at - now));
      }
      return;
    }
    const p = plugin();
    if (!p) return;
    await clear();
    if (!enabled || !(await granted(false).catch(() => false))) return;
    const now = Date.now();
    const notifications = list.filter((n) => n.at > now + 60000).map((n) => ({
      id: n.id, title: n.title, body: n.body,
      // Reminders don't need to the minute: inexact alarms avoid Android 12+ asking for the 'Alarms & reminders' permission.
      schedule: { at: new Date(n.at), allowWhileIdle: true }, isExactNotification: false,
      smallIcon: 'ic_stat_sbuffo', iconColor: '#ffc857', largeIcon: 'ic_sbuffo_face', // her face beside the text
    }));
    if (notifications.length) await p.schedule({ notifications }).catch(() => { /* tried again next time */ });
  }
  async function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* lasts until the app closes */ }
    if (on && !desktop()) await granted(true).catch(() => false);
    else await clear();
  }
  return {
    available: () => !!plugin() || !!desktop(), enabled: () => enabled, setEnabled, askOnce, plan, clear,
    allowed: () => (desktop() ? Promise.resolve(true) : granted(false).catch(() => false)),
    ask: () => (desktop() ? Promise.resolve(true) : granted(true).catch(() => false)),
    pending: async () => (await plugin()?.getPending?.())?.notifications || [],
  };
})();
