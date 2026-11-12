import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('dist');
const read = async path => readFile(resolve(root, path));
const manifest = JSON.parse((await read('manifest.webmanifest')).toString());
assert.equal(manifest.name, 'Violin Studio');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.theme_color, '#a34b29');
for (const size of [192, 512]) {
  const icon = manifest.icons.find(item => item.sizes === `${size}x${size}` && item.type === 'image/png');
  assert(icon, `${size}px PNG icon missing from manifest`);
  const png = await read(icon.src.slice(1));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
assert(manifest.icons.some(item => item.purpose.includes('maskable')));
const maskable = manifest.icons.find(item => item.src === '/icons/icon-maskable-512.png' && item.purpose === 'maskable');
assert(maskable);
const maskablePng = await read('icons/icon-maskable-512.png');
assert.equal(maskablePng.readUInt32BE(16), 512);
assert.equal(maskablePng.readUInt32BE(20), 512);
const html = (await read('index.html')).toString();
assert(html.includes('manifest.webmanifest'));
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1].slice(1));
assert(assets.some(asset => asset.endsWith('.js')) && assets.some(asset => asset.endsWith('.css')));
const sw = (await read('sw.js')).toString();
for (const asset of ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', ...assets]) assert(sw.includes(asset), `${asset} missing from precache`);
assert(sw.includes('SKIP_WAITING') && sw.includes('cleanupOutdatedCaches'));
assert(!sw.includes('microphone') && !sw.includes('getUserMedia'));
await stat(resolve(root, '_headers'));
await stat(resolve(root, '_redirects'));
console.log('PWA manifest, icons, precache, update hook, and Pages files verified.');
