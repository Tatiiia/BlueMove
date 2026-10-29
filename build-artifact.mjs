// Construit une page HTML autonome (JS, CSS et données intégrés) publiable comme artefact Claude.
// Usage : node build-artifact.mjs [chemin de sortie]
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

const outPath = process.argv[2] ?? 'dist-artifact/bluemove-recharge.html';
const res = await build({
  entryPoints: ['src/main.tsx'], bundle: true, write: false, outdir: 'out', format: 'esm', target: ['es2020'],
  jsx: 'automatic', minify: true, legalComments: 'none', loader: { '.json': 'json' },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const js = res.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = res.outputFiles.find((f) => f.path.endsWith('.css')).text.replace(/<\/style/gi, '<\\/style');
const html = `<title>BlueMove Recharge Planner</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<noscript>Cette démonstration nécessite JavaScript.</noscript>
<script type="module">${js}</script>
`;
const { mkdirSync } = await import('node:fs');
mkdirSync(outPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
writeFileSync(outPath, html);
console.log(`${outPath} — ${(html.length / 1024 / 1024).toFixed(2)} Mo`);
