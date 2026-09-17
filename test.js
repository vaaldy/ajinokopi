// Pure-function checks for src/lib.js — run with `npm test` (plain Node, no framework).
import { readFileSync } from 'fs';
import {
  ORIGIN, norm, angDist, polar, sectorPath, capsulePath, arcPath, flipped,
  hexToHsl, shades, ink, colorMapper, noteColors,
  ringOrder, radialGroups, noteFan, wheelGeom, viewBoxFor, hitWheel,
  layoutPills, layoutWheel, dragPillAngle, fingerprintTones, mixWeightFor,
  uuid, validateBrews, newBrewDoc, fillBrew, mergeBrews, defaultScores, noteColorOf, UNKNOWN_COLOR,
  validateFlavorTree, validateFlavorProfile, flavorTreeToDraft, flavorDraftToTree,
  DEFAULT_FLAVOR_PROFILE_ID, toRgb, mixColors,
} from './src/lib.js';

const results = [];
const t = (name, cond) => results.push([name, !!cond]);

const O = [ORIGIN.x, ORIGIN.y];

// ---------- geometry ----------
t('sectorPath is a closed path', /^M[\s\S]*Z$/.test(sectorPath(...O, 0, 90, 84, 126)));
t('sectorPath no NaN', !sectorPath(...O, 0, 90, 84, 126).includes('NaN'));
t('sectorPath handles negative angles', !sectorPath(...O, -46, -19, 132, 178).includes('NaN'));
t('sectorPath renders a full 360-degree annulus', (sectorPath(...O, 30, 390, 84, 126).match(/A/g) || []).length === 4);
t('polar 0deg points up', polar(...O, 100, 0)[1] === 95);
t('polar 90deg points right', polar(...O, 100, 90)[0] === 295);
t('capsulePath is closed and clean', /^M[\s\S]*Z$/.test(capsulePath(...O, 0, 40, 61, 79)));
t('capsulePath degenerates to a dot below cap width', capsulePath(...O, 0, 1, 61, 79).includes('a9'));
t('arcPath reverses on the lower half', arcPath(...O, 70, 0, 40, true).endsWith('0 ' + polar(...O, 70, 0).map(v => v.toFixed(2)).join(' ')));
t('flipped only on the lower half', !flipped(0) && !flipped(89) && flipped(180) && !flipped(271));
t('norm handles negative angles', norm(-30) === 330);
t('angDist wraps the seam', angDist(350, 10) === 20);

// ---------- colours ----------
t('shades: n colors for n notes', shades('#aabbcc', 5).length === 5);
t('shades: single note no div-by-zero', !shades('#aabbcc', 1)[0].includes('NaN'));
t('hexToHsl: red hue', hexToHsl('#ff0000').h === 0 && hexToHsl('#ff0000').s === 100);
t('ink: dark on pale fills, light on dark ones', ink('#f7d7a2') === '#3a2f28' && ink('#3a2f28') === '#fff');
t('ink: reads an hsl() shade too, not just hex',
  ink('hsl(30 40% 78%)') === '#3a2f28' && ink('hsl(30 40% 22%)') === '#fff');
const citrus = { color: '#f7d7a2', notes: ['lemon', 'lime'], noteColors: { lemon: '#f7e79a' } };
t('colorMapper: authored note colour wins', colorMapper.note('Citrus', citrus, 0, 2) === '#f7e79a');
t('colorMapper: unauthored note falls back to a shade', colorMapper.note('Citrus', citrus, 1, 2).startsWith('hsl('));
t('noteColors: one colour per note', noteColors('Citrus', citrus).length === 2);
t('noteColorOf: resolves a known note', noteColorOf({ Citrus: citrus }, 'Citrus', 'lemon') === '#f7e79a');
t('noteColorOf: a family flavors.yaml dropped still gets a colour', noteColorOf({}, 'Spice', 'clove') === UNKNOWN_COLOR);

const flavorTree = {
  Floral: { color: '#f0e7dc', notes: ['jasmine', 'rose'] },
  Sweet: { color: '#e8c79a', notes: ['honey', 'caramel'], groups: [1, 1] },
};
t('flavor profiles: default keeps a stable bundled id', DEFAULT_FLAVOR_PROFILE_ID === 'bundled:default');
t('validateFlavorTree: accepts families, notes and matching groups', validateFlavorTree(flavorTree));
t('validateFlavorTree: rejects invalid family colour', !validateFlavorTree({ F: { color: 'red', notes: ['a'] } }));
t('validateFlavorTree: rejects duplicate notes', !validateFlavorTree({ F: { color: '#ffffff', notes: ['a', 'a'] } }));
t('validateFlavorTree: rejects mismatched groups', !validateFlavorTree({ F: { color: '#ffffff', notes: ['a'], groups: [2] } }));
t('validateFlavorTree: rejects invalid note colours', !validateFlavorTree({ F: { color: '#ffffff', notes: ['a'], noteColors: { a: 'red' } } }));
t('validateFlavorProfile: accepts imported profile', validateFlavorProfile({ _id: 'p1', name: 'Mine', flavors: flavorTree }));
t('validateFlavorProfile: rejects missing identity', !validateFlavorProfile({ name: 'Mine', flavors: flavorTree }));
const flavorDraft = flavorTreeToDraft(flavorTree, (() => { let i = 0; return () => `k${i++}`; })());
t('flavor draft: tree round-trips without losing order', JSON.stringify(flavorDraftToTree(flavorDraft)) === JSON.stringify(flavorTree));
flavorDraft[0].notes[1].color = '#abcdef';
t('flavor draft: later note color stays on that note', flavorDraftToTree(flavorDraft).Floral.noteColors.rose === '#abcdef');
t('flavor draft: family rename preserves position', (() => {
  flavorDraft[0].name = 'Flowers';
  return Object.keys(flavorDraftToTree(flavorDraft))[0] === 'Flowers';
})());
t('flavor draft: rejects duplicate family names', (() => {
  flavorDraft[1].name = 'Flowers';
  return flavorDraftToTree(flavorDraft) === null;
})());

// ---------- wheel layout ----------
const FLAVORS = {
  Big: { color: '#d5bba2', groups: [1, 2], notes: ['a', 'b', 'c'] },
  Mid: { color: '#f7d7a2', notes: ['d', 'e'] },
  Small: { color: '#cfdcbe', notes: ['f'] },
};
const ring = ringOrder(Object.keys(FLAVORS), FLAVORS);
t('ringOrder: one segment per family, seams meet', ring.length === 3 && ring.every(s => Math.abs((s.a1 - s.a0) - 120) < 1e-9));
t('ringOrder: mid is the segment centre', ring.every(s => s.mid === (s.a0 + s.a1) / 2));
t('ringOrder: preserves YAML family order', ring.map(s => s.cat).join() === 'Big,Mid,Small');
t('ringOrder: rotation shifts every family by the same amount',
  ringOrder(Object.keys(FLAVORS), FLAVORS, 0).every((s, i) => s.a0 === ring[i].a0 - 210));
t('ringOrder: stable for the same input', JSON.stringify(ringOrder(Object.keys(FLAVORS), FLAVORS)) === JSON.stringify(ring));

const groups = radialGroups(FLAVORS.Big, 132, 178);
t('radialGroups: one band per group, notes split in order',
  groups.length === 2 && groups[0].notes.join() === 'a' && groups[1].notes.join() === 'b,c');
t('radialGroups: bands stay inside the band and leave a gap',
  groups[0].rIn === 132 && groups[1].rOut === 178 && groups[1].rIn - groups[0].rOut === 3);
t('radialGroups: no groups = one full-width band', radialGroups(FLAVORS.Mid, 132, 178)[0].rOut === 178);

t('noteFan: 27deg each, centred on the parent bearing', noteFan(90, 4).per === 27 && noteFan(90, 4).start === 90 - 54);
t('noteFan: many notes shrink to fit 360', noteFan(0, 20).per === 18);

const Fclosed = wheelGeom({}), Fopen = wheelGeom({ open: true });
t('wheelGeom: drilling bites tier 1 inward and shrinks the hub', Fopen.cIn < Fclosed.cIn && Fopen.hub < Fclosed.hub);
t('wheelGeom: overflow leaves room for two pill rings', wheelGeom({ overflow: true }).hub < Fclosed.hub);
t('wheelGeom: a tiered family gets a wider note band', wheelGeom({ open: true, tiered: true }).nOut > Fopen.nOut);
t('viewBoxFor: closed crops tighter than open', viewBoxFor(false, false)[2] < viewBoxFor(true, false)[2]);

// ---------- hit testing ----------
const hitAt = (r, ang, openIdx = null, curNote = null) =>
  hitWheel({ r, ang, F: wheelGeom({ open: openIdx != null }), ringSegs: ring, flavors: FLAVORS, openIdx, curNote });
t('hit: centre is the hub', hitAt(5, 0).kind === 'hub');
t('hit: the dead zone between hub and tier 1 hits nothing', hitAt(50, 0) === null);
t('hit: tier 1 resolves to the family under the bearing', hitAt(100, ring[1].mid).a === 1);
t('hit: tier 2 is inert while closed', hitAt(150, ring[0].mid) === null);
const openIdx = ring.findIndex(s => s.cat === 'Mid');
t('hit: tier 2 resolves to a note of the open family', hitAt(150, ring[openIdx].mid, openIdx).kind === 'n');
t('hit: past the note ring hits nothing', hitAt(300, ring[openIdx].mid, openIdx) === null);
t('hit: hysteresis holds the open family just past its edge',
  hitAt(100, ring[openIdx].a1 + 3, openIdx).a === openIdx);
t('hit: a clearly different family still wins', hitAt(100, ring[openIdx].mid + 120, openIdx).a !== openIdx);

// ---------- pill orbit ----------
const colorOf = (c, nt) => colorMapper.note(c, FLAVORS[c], FLAVORS[c].notes.indexOf(nt), FLAVORS[c].notes.length);
const mk = n => Array.from({ length: n }, (_, i) => ({ category: 'Mid', note: 'note' + i }));
const overlap = pills => pills.some((p, i) => pills.some((q, j) =>
  i !== j && p.inRing1 === q.inRing1 &&
  [-360, 0, 360].some(off => Math.min(p.a1, q.a1 + off) - Math.max(p.a0, q.a0 + off) > 0.01)));

const few = layoutWheel({ notes: mk(3), pillAng: {}, open: false, tiered: false, ringSegs: ring, colorOf });
t('pills: a light cup stays on one rim', !few.overflow && few.pills.every(p => !p.inRing1));
t('pills: no two pills overlap', !overlap(few.pills));
t('pills: each pill carries a stable key and a colour',
  new Set(few.pills.map(p => p.key)).size === 3 && few.pills.every(p => p.col));
t('pills: a note flavors.yaml no longer lists still gets its family colour',
  few.pills.every(p => p.col === FLAVORS.Mid.color));
t('pills: spawn near their family bearing', angDist(few.pills[0].mid, ring[openIdx].mid) < 40);

const many = layoutWheel({ notes: mk(22), pillAng: {}, open: false, tiered: false, ringSegs: ring, colorOf });
t('pills: a heavy cup spawns the outer rim', many.overflow && many.pills.some(p => p.inRing1));
t('pills: still no overlaps once the outer rim is in play', !overlap(many.pills));
t('pills: overflow geometry gives the rings room inside tier 1',
  many.pills.every(p => p.rOut < wheelGeom({ overflow: true }).cIn * 0.88));
t('pills: every note is placed', many.pills.length === 22);

// Real note names are wide: a very full cup exhausts both rims, and must crowd rather than vanish.
const wide = Array.from({ length: 40 }, (_, i) => ({ category: 'Mid', note: 'dark chocolate ' + i }));
const packed = layoutWheel({ notes: wide, pillAng: {}, open: false, tiered: false, ringSegs: ring, colorOf });
t('pills: a cup too full for both rims still shows every note', packed.pills.length === 40);
t('pills: the crowded fallback never overlaps', !overlap(packed.pills));
t('pills: the crowded fallback splits across both rims',
  packed.pills.some(p => p.inRing1) && packed.pills.some(p => !p.inRing1));
t('pills: labels shrink rather than pills colliding', packed.pills.every(p => p.fscale <= 1 && p.fscale > 0));

const dup = layoutWheel({ notes: [{ category: 'Mid', note: 'd' }, { category: 'Mid', note: 'd' }], pillAng: {}, open: false, tiered: false, ringSegs: ring, colorOf });
t('pills: the same note logged twice gets distinct keys', dup.pills[0].key !== dup.pills[1].key);

const trial = layoutPills({ notes: mk(22), pillAng: {}, F: wheelGeom({}), ringSegs: ring, colorOf, allowRing1: false, relaxStored: true });
t('pills: the one-rim trial pass reports overflow instead of overlapping', trial.overflowed && trial.pills === null);

const others = [{ a0: 100, a1: 130, mid: 115 }];
t('pillDrag: a free bearing is taken as-is', Math.abs(dragPillAngle({ ang: 20, span: 30, others }) - 5) < 1e-9);
t('pillDrag: clamps to a blocked neighbour near edge', dragPillAngle({ ang: 105, span: 30, others }) === 100 - 30 - 2);
t('pillDrag: jumps past the neighbour once the cursor clears its centre', dragPillAngle({ ang: 125, span: 30, others }) === 132);
t('pillDrag: boxed in returns null', dragPillAngle({ ang: 0, span: 30, others: [{ a0: -180, a1: 180, mid: 0 }] }) === null);

// ---------- taste fingerprint ----------
const fpNotes = [{ category: 'Mid', note: 'd' }, { category: 'Mid', note: 'd' }, { category: 'Small', note: 'f' }];
const fp = fingerprintTones({ notes: fpNotes, mix: {}, colorOf, ringSegs: ring, pills: [], cx: 195, cy: 195, r: 70 });
t('fingerprint: one tone per distinct note', fp.tones.length === 2);
t('fingerprint: shares sum to 1', Math.abs(fp.tones.reduce((a, x) => a + x.p, 0) - 1) < 1e-9);
t('fingerprint: a repeated note weighs more', fp.tones.find(x => x.note === 'd').p > fp.tones.find(x => x.note === 'f').p);
t('fingerprint: tones sit on their family bearing', Math.abs(fp.tones.find(x => x.note === 'f').bearing - ring.find(s => s.cat === 'Small').mid) < 1e-9);
t('fingerprint: an empty cup still has a base colour', fingerprintTones({ notes: [], colorOf, ringSegs: ring, cx: 195, cy: 195, r: 70 }).baseCol === '#221d1b');
t('fingerprint: a pill overrides the family bearing',
  fingerprintTones({ notes: fpNotes, colorOf, ringSegs: ring, pills: [{ nn: { note: 'f' }, mid: 12 }], cx: 195, cy: 195, r: 70 })
    .tones.find(x => x.note === 'f').bearing === 12);
const pulled = mixWeightFor({ proj: 60, hubR: 70, tone: 'f', tones: fp.tones, mix: {} });
const after = fingerprintTones({ notes: fpNotes, mix: pulled, colorOf, ringSegs: ring, pills: [], cx: 195, cy: 195, r: 70 });
t('mix: dragging a handle outward shrinks that tone and grows the rest',
  after.tones.find(x => x.note === 'f').p < fp.tones.find(x => x.note === 'f').p);
t('mix: shares still sum to 1 after a drag', Math.abs(after.tones.reduce((a, x) => a + x.p, 0) - 1) < 1e-9);

// ---------- colour blending ----------
t('mixColors: full weight returns the colour itself', mixColors(['#ff0000', '#0000ff'], [1, 0]) === '#ff0000');
t('mixColors: equal red+blue lands brighter than gamma-space average (linear-light)',
  parseInt(mixColors(['#ff0000', '#0000ff'], [1, 1]).slice(1, 3), 16) > 0x80);
t('mixColors: reads hsl() strings from shades()', /^#[0-9a-f]{6}$/.test(mixColors(shades('#c85a54', 3), [1, 2, 1])));
t('toRgb: hsl round-trip stays close', toRgb('hsl(0 100% 50%)').join(',') === '255,0,0');
t('fingerprint: baseCol is the blend, shifts when mix shifts', fp.baseCol !== after.baseCol);

// ---------- brew store ----------
t('uuid: string of hex', /^[0-9a-f-]{32,36}$/.test(uuid()));
const doc = newBrewDoc('test');
t('newBrewDoc is Mongo-shaped', typeof doc._id === 'string' && !isNaN(Date.parse(doc.createdAt)));
t('newBrewDoc carries the cupping fields', doc.origin === '' && doc.process === '' && doc.varietal === '' &&
  doc.brewMethod === '' && doc.remark === '' && doc.scores.Acidity === defaultScores().Acidity);
t('validateBrews: accepts good doc', validateBrews([doc]));
t('validateBrews: rejects bad doc', !validateBrews([{ name: 1 }]));
t('validateBrews: rejects non-array', !validateBrews({}));
t('export/import round-trip', JSON.stringify(JSON.parse(JSON.stringify([doc]))) === JSON.stringify([doc]));
const old = { _id: 'x', name: 'phase 1 brew', notes: [] };
t('fillBrew: a pre-v0.2 doc gains the cupping fields', validateBrews([fillBrew(old)]) && fillBrew(old).scores.Intensity === 5);
t('fillBrew: a doc without a date gets one, a doc with one keeps it',
  !isNaN(Date.parse(fillBrew(old).createdAt)) && fillBrew({ ...old, createdAt: 'x' }).createdAt === 'x');
t('fillBrew: never clobbers a stored score', fillBrew({ ...old, scores: { Acidity: 9 } }).scores.Acidity === 9);
t('fillBrew: coerces a score that came back from JSON as a string', fillBrew({ ...old, scores: { Acidity: '9' } }).scores.Acidity === 9);
t('fillBrew: drops a junk score rather than rendering NaN', fillBrew({ ...old, scores: { Acidity: null } }).scores.Acidity === 7);

const a = newBrewDoc('a'), b = newBrewDoc('b');
const merged = mergeBrews([a, b], [{ ...a, name: 'a2' }]);
t('mergeBrews: imported wins by _id', merged.find(x => x._id === a._id).name === 'a2');
t('mergeBrews: keeps existing not in import', merged.some(x => x._id === b._id));
t('mergeBrews: fills an old imported doc', mergeBrews([], [old])[0].scores.Sweetness === 6);

const yamlText = readFileSync(new URL('./public/flavors.yaml', import.meta.url), 'utf8');
t('flavors.yaml: 11 families', (yamlText.match(/^[A-Z][^:\n]*:/gm) || []).length === 11);
const malicBlock = yamlText.match(/^Malic:\n(?:(?:  .*\n)|\n)*/m)?.[0] || '';
t('flavors.yaml: grapes live in Tartaric, not Malic',
  /Tartaric:\n[\s\S]*?notes: \[white grape, red grape\]/.test(yamlText) && !malicBlock.includes('grape'));
const herbalTeaBlock = yamlText.match(/^Herbal \/ Tea:\n(?:(?:  .*\n)|\n)*/m)?.[0] || '';
t('flavors.yaml: Herbal / Tea has the chosen five-note outer band',
  herbalTeaBlock.includes('groups: [7, 5]') &&
  herbalTeaBlock.includes('notes: [green tea, oolong, black tea, white tea, pu-erh, matcha, hojicha, thyme, rhubarb, herbal, peppery, tomato]'));
const defectsBlock = yamlText.match(/^Defects:\n(?:(?:  .*\n)|\n)*/m)?.[0] || '';
t('flavors.yaml: roasty notes form dark inner Defects band',
  defectsBlock.includes('color: "#75685f"') && defectsBlock.includes('groups: [4, 7]') &&
  defectsBlock.includes('notes: [roasty, smoky, ashy, burnt, papery'));
t('flavors.yaml: every note colour is a hex triple', (yamlText.match(/^\s{4}[^\s:][^:]*: "#[0-9a-f]{6}"$/gm) || []).length >= 60);

for (const [name, ok] of results) console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
const failed = results.filter(r => !r[1]).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
