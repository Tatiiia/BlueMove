"""Régénère src/ui/bundled.ts à partir des index de scénarios (après sim/generate.py)."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sc = json.loads((root / 'data/scenarios/index.json').read_text(encoding='utf-8'))
bm = json.loads((root / 'data/benchmark/index.json').read_text(encoding='utf-8'))
lines = ['// Fichier généré par scripts/gen-bundled.py — importe les scénarios simulés dans le build.']
lines += [f"import {e['id']} from '../../data/scenarios/{e['file']}';" for e in sc]
lines += [f"import {e['id']} from '../../data/benchmark/{e['file']}';" for e in bm]
lines.append('export const SCENARIOS: Record<string, unknown> = { ' + ', '.join(e['id'] for e in sc) + ' };')
lines.append('export const BENCHMARK: Record<string, unknown> = { ' + ', '.join(e['id'] for e in bm) + ' };')
(root / 'src/ui/bundled.ts').write_text('\n'.join(lines) + '\n', encoding='utf-8')
