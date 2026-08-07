// Pure-function checks for src/lib.js — run with `npm test` (plain Node, no framework).
import { readFileSync } from 'fs';
import {
  polar, sectorPath, fanLayout, norm, splitLabel,
  hexToHsl, shades, colorMapper, uuid, validateBrews, newBrewDoc, mergeBrews,
} from './src/lib.js';

const results = [];
const t = (name, cond) => results.push([name, !!cond]);

t('sectorPath is a closed path', /^M[\s\S]*Z$/.test(sectorPath(0, 90, 16, 48)));
t('sectorPath no NaN', !sectorPath(0, 90, 16, 48).includes('NaN'));
t('sectorPath handles negative fan angles', !sectorPath(-15, 0, 31, 48).includes('NaN'));
t('polar 0deg points up', polar(48, 0)[1] === '2.00');

const f4 = fanLayout(45, 4); // Floral at 30-60deg -> 4 children fan 15-75
t('fan: 4 children x 15deg centered on 45 starts at 15', f4.per === 15 && f4.start === 15);
t('fan: many children shrink to fit 360', fanLayout(0, 30).per === 12);

t('norm handles negative angles', norm(-30) === 330);
t('splitLabel splits long two-word labels', JSON.stringify(splitLabel('orange blossom')) === '["orange","blossom"]');
t('splitLabel leaves short labels alone', JSON.stringify(splitLabel('lemon')) === '["lemon"]');

t('shades: n colors for n notes', shades('#aabbcc', 5).length === 5);
t('shades: single note no div-by-zero', !shades('#aabbcc', 1)[0].includes('NaN'));
t('hexToHsl: red hue', hexToHsl('#ff0000').h === 0 && hexToHsl('#ff0000').s === 100);
t('colorMapper default impl works', colorMapper.note('Citrus', { color: '#f2a531', notes: [] }, 0, 3).startsWith('hsl('));

t('uuid: string of hex', /^[0-9a-f-]{32,36}$/.test(uuid()));
const doc = newBrewDoc('test');
t('newBrewDoc is Mongo-shaped', typeof doc._id === 'string' && !isNaN(Date.parse(doc.createdAt)));
t('validateBrews: accepts good doc', validateBrews([doc]));
t('validateBrews: rejects bad doc', !validateBrews([{ name: 1 }]));
t('validateBrews: rejects non-array', !validateBrews({}));
t('export/import round-trip', JSON.stringify(JSON.parse(JSON.stringify([doc]))) === JSON.stringify([doc]));

const a = { ...newBrewDoc('a') }, b = { ...newBrewDoc('b') };
const merged = mergeBrews([a, b], [{ ...a, name: 'a2' }]);
t('mergeBrews: imported wins by _id', merged.find(x => x._id === a._id).name === 'a2');
t('mergeBrews: keeps existing not in import', merged.some(x => x._id === b._id));

const yamlText = readFileSync(new URL('./public/flavors.yaml', import.meta.url), 'utf8');
t('flavors.yaml: 9 categories', (yamlText.match(/^[A-Z][^\s:]*:/gm) || []).length === 9);

for (const [name, ok] of results) console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
const failed = results.filter(r => !r[1]).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
