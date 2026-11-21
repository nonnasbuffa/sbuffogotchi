// In-app updates for the phone apps (Android and iPhone).
// The website always has the newest game, and publishes version.json next to it:
//   { "version": "1.9.2", "url": "https://sbuffogotchi.web.app/updates/sbuffogotchi-1.9.2.zip", "minNative": "1.9.2" }
// When it's newer than the game running here, a window offers the update. "Update" downloads the new game
// (the www folder, zipped) with the Capgo updater plugin and swaps it in. The app reloads into the new version,
// and her save stays where it is.
// If an update needs a newer app itself (minNative: new native plugins), "Update" opens the download page instead.
window.Updater = (() => {
  const SITE = 'https://sbuffogotchi.web.app';
  const RELEASES = 'https://github.com/nonnasbuffa/sbuffogotchi/releases/latest';
  const CHECK_EVERY_MS = 30 * 60000;
  const native = () => !!window.Capacitor?.isNativePlatform?.();
  const plugin = () => window.Capacitor?.Plugins?.CapacitorUpdater;
  const t = (k, v) => I18n.t(k, v);
  let lastCheck = 0;
  let open = false;

  // 1.10.0 > 1.9.2: compares number by number.
  function newer(a, b) {
    const pa = String(a).replace(/^v/, '').split('.').map(Number), pb = String(b).replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  }

  function popup(info, needsApp) {
    if (open) return;
    open = true;
    const box = document.createElement('div');
    box.className = 'updWrap';
    box.innerHTML = `<div class="updBox" role="dialog" aria-modal="true">
      <b class="updTitle"></b><p class="updText"></p>
      <div class="updBtns"><button class="updLater"></button><button class="updNow"></button></div></div>`;
    box.querySelector('.updTitle').textContent = t('upd_title', { v: info.version });
    box.querySelector('.updText').textContent = t(needsApp ? 'upd_needsApp' : 'upd_body');
    const later = box.querySelector('.updLater'), now = box.querySelector('.updNow');
    later.textContent = t('upd_later');
    now.textContent = t('upd_now');
    const close = () => { box.remove(); open = false; };
    later.onclick = close;
    now.onclick = async () => {
      if (needsApp) { window.open(RELEASES, '_system'); return close(); }
      now.disabled = later.disabled = true;
      now.textContent = t('upd_loading');
      try {
        const up = plugin();
        const listener = await up.addListener?.('download', (e) => { now.textContent = `${t('upd_loading')} ${Math.round(e.percent || 0)}%`; });
        const bundle = await up.download({ url: info.url, version: info.version });
        listener?.remove?.();
        await up.set({ id: bundle.id }); // reloads the app into the new version
      } catch (err) {
        console.warn('update failed', err);
        box.querySelector('.updText').textContent = t('upd_failed');
        now.textContent = t('upd_now');
        now.disabled = later.disabled = false;
      }
    };
    document.body.append(box);
  }

  async function check(force) {
    if (!native() || !plugin() || open) return;
    if (!force && Date.now() - lastCheck < CHECK_EVERY_MS) return;
    lastCheck = Date.now();
    try {
      const info = await (await fetch(`${SITE}/version.json?t=${Date.now()}`, { cache: 'no-store' })).json();
      if (!info?.version || !info.url || !newer(info.version, window.GAME_VERSION)) return;
      let needsApp = false;
      if (info.minNative) {
        const built = (await plugin().getBuiltinVersion().catch(() => ({})))?.version;
        needsApp = !!built && newer(info.minNative, built);
      }
      popup(info, needsApp);
    } catch { /* offline: try again later */ }
  }

  function start() {
    if (!native() || !plugin()) return;
    // Tells the plugin this version started fine. Without it, the plugin rolls back to the previous one.
    plugin().notifyAppReady?.().catch(() => {});
    setTimeout(() => check(true), 3000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
  }

  return { start, check, newer };
})();
