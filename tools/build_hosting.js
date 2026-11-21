// Builds what the website serves (runs on its own before every `firebase deploy`, see firebase.json):
//   hosting/                     a copy of www/
//   hosting/updates/sbuffogotchi-<version>.zip   the whole game, for the phone apps' in-app update
//   hosting/version.json         { version, url, minNative } so the phone apps know there's something newer
// version comes from GAME_VERSION in www/game.js. minNative ("sbuffogotchi.minNative" in package.json) is the oldest
// installed app that can take this update. Raise it when a release adds a native plugin, so older apps get sent to
// the download page instead.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const www = path.join(root, 'www');
const out = path.join(root, 'hosting');
const SITE = 'https://sbuffogotchi.web.app';

const version = fs.readFileSync(path.join(www, 'game.js'), 'utf8').match(/GAME_VERSION = '([\d.]+)'/)[1];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const minNative = pkg.sbuffogotchi?.minNative || version;

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(www, out, { recursive: true });
fs.mkdirSync(path.join(out, 'updates'), { recursive: true });
const zip = `sbuffogotchi-${version}.zip`;
// Windows 10+ and macOS ship bsdtar, which writes zips with -a. index.html sits at the root of the zip.
// On Windows use its own bsdtar (Git Bash's GNU tar can't write zips).
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
execFileSync(tar, ['-a', '-c', '-f', path.join(out, 'updates', zip), '-C', www, ...fs.readdirSync(www)], { stdio: 'inherit' });
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ version, url: `${SITE}/updates/${zip}`, minNative }, null, 2));
console.log(`hosting ready: v${version}, update ${zip} (${(fs.statSync(path.join(out, 'updates', zip)).size / 1e6).toFixed(1)} MB), minNative ${minNative}`);
