// Phone reminders, scheduled on the device with Capacitor's Local Notifications plugin.
// The website has no plugin, so everything here quietly does nothing there.
const Notify = (() => {
  const KEY = 'sbuffogotchi.notify';
  const ASKED_KEY = 'sbuffogotchi.notifyAsked';
  const IDS = [101, 102, 103, 104, 105, 106, 107];
  const plugin = () => (window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.LocalNotifications : null);
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
    const p = plugin();
    if (!p) return;
    try {
      await p.cancel({ notifications: IDS.map((id) => ({ id })) });
      await p.removeAllDeliveredNotifications?.();
    } catch { /* nothing scheduled */ }
  }
  // Replaces every pending reminder with this list of { id, title, body, at }.
  async function plan(list) {
    const p = plugin();
    if (!p) return;
    await clear();
    if (!enabled || !(await granted(false).catch(() => false))) return;
    const now = Date.now();
    const notifications = list.filter((n) => n.at > now + 60000).map((n) => ({
      id: n.id, title: n.title, body: n.body,
      // Reminders don't need to the minute: inexact alarms avoid Android 12+ asking for the 'Alarms & reminders' permission.
      schedule: { at: new Date(n.at), allowWhileIdle: true }, isExactNotification: false,
      smallIcon: 'ic_stat_sbuffo', iconColor: '#ffc857',
    }));
    if (notifications.length) await p.schedule({ notifications }).catch(() => { /* tried again next time */ });
  }
  async function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* lasts until the app closes */ }
    if (on) await granted(true).catch(() => false);
    else await clear();
  }
  return { available: () => !!plugin(), enabled: () => enabled, setEnabled, askOnce, plan, clear };
})();
