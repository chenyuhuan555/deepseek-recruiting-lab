import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
if (!resolve(fileURLToPath(output)).startsWith(resolve(fileURLToPath(root)) + sep)) throw new Error('Invalid output directory');
await rm(output, { recursive: true, force: true });
const assets = {};
for (const [file, type] of [['index.html', 'text/html; charset=utf-8'], ['style.css', 'text/css; charset=utf-8'], ['app.mjs', 'text/javascript; charset=utf-8'], ['rules.mjs', 'text/javascript; charset=utf-8'], ['data.mjs', 'text/javascript; charset=utf-8'], ['draft-ui.mjs', 'text/javascript; charset=utf-8'], ['memory-map.svg', 'image/svg+xml']]) {
  assets['/' + file] = { type, content: await readFile(new URL('web/' + file, root), 'utf8') };
}
assets['/'] = assets['/index.html'];
assets['/draft-domain.mjs'] = { type: 'text/javascript; charset=utf-8', content: await readFile(new URL('server/draft-domain.mjs', root), 'utf8') };
await mkdir(new URL('worker/', root), { recursive: true });
await writeFile(new URL('worker/assets.generated.mjs', root), 'export default ' + JSON.stringify(assets) + ';\n');
await mkdir(new URL('dist/server/', root), { recursive: true });
await mkdir(new URL('dist/.openai/', root), { recursive: true });
const manifest = JSON.parse(await readFile(new URL('.openai/hosting.json', root), 'utf8'));
if (manifest.static) throw new Error('Worker manifest must not declare static output');
await writeFile(new URL('dist/.openai/hosting.json', root), JSON.stringify(manifest));
await build({ entryPoints: [fileURLToPath(new URL('worker/index.mjs', root))], outfile: fileURLToPath(new URL('dist/server/index.js', root)), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true });
console.log('Worker built with', Object.keys(assets).length, 'static routes');
