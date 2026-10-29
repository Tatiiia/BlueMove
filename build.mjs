// Build de production (application statique) : node build.mjs   ·   développement : node build.mjs --serve
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist';
const serve = process.argv.includes('--serve');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
cpSync('index.html', join(out, 'index.html'));
cpSync('public', out, { recursive: true });
for (const folder of ['scenarios', 'benchmark']) {
  mkdirSync(join(out, 'data', folder), { recursive: true });
  for (const f of readdirSync(join('data', folder))) {
    if (f.endsWith('.json')) cpSync(join('data', folder, f), join(out, 'data', folder, f));
  }
}

const options = {
  entryPoints: { app: 'src/main.tsx' },
  bundle: true,
  outdir: join(out, 'assets'),
  format: 'esm',
  target: ['es2020'],
  jsx: 'automatic',
  minify: !serve,
  sourcemap: serve,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': JSON.stringify(serve ? 'development' : 'production') },
  loader: { '.json': 'json' },
  logLevel: 'info',
};

if (serve) {
  const ctx = await context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 5173 });
  console.log(`Serveur de développement : http://localhost:${port}`);
} else {
  await build(options);
  const size = (p) => (statSync(p).size / 1024).toFixed(0);
  writeFileSync(join(out, 'build-info.json'), JSON.stringify({ built_at_utc: new Date().toISOString(), data_origin: 'SIMULATION' }, null, 2));
  console.log(`dist/assets/app.js ${size(join(out, 'assets', 'app.js'))} Ko · app.css ${size(join(out, 'assets', 'app.css'))} Ko`);
}
