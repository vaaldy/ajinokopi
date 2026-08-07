// Pure logic + storage. No React imports — test.js runs this file directly in Node.

// ---------- geometry ----------
export const R = { hub: 12, catIn: 13, catOut: 30, fanIn: 31, fanOut: 48, catLabel: 21.5, fanLabel: 39.5, perChild: 15 };

export const norm = d => ((d % 360) + 360) % 360;

export function polar(r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return [(50 + r * Math.cos(rad)).toFixed(2), (50 + r * Math.sin(rad)).toFixed(2)];
}

export function sectorPath(a0, a1, r0, r1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}` +
         `L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

// Fan sectors span perChild° each, centered on the parent's bearing (SCA-wheel style).
export function fanLayout(midDeg, n) {
  const per = Math.min(R.perChild, 360 / n);
  return { per, start: midDeg - per * n / 2 };
}

// Long labels split at the space nearest the middle instead of glyph-squeezing.
export function splitLabel(label) {
  if (label.length <= 9 || !label.includes(' ')) return [label];
  let best = -1;
  for (let i = 0; i < label.length; i++)
    if (label[i] === ' ' && (best < 0 || Math.abs(i - label.length / 2) < Math.abs(best - label.length / 2)))
      best = i;
  return [label.slice(0, best), label.slice(best + 1)];
}

// ---------- colors (swappable module) ----------
export function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function shades(hex, n) {
  const { h, s } = hexToHsl(hex);
  return Array.from({ length: n }, (_, i) =>
    `hsl(${h} ${s}% ${n === 1 ? 42 : Math.round(30 + (i / (n - 1)) * 26)}%)`);
}

// Components only ever call these two functions; reassign the properties
// (e.g. from a future theme module) to swap in a different color scheme.
export const colorMapper = {
  category: (name, def) => def.color,
  note: (catName, def, i, n) => shades(def.color, n)[i],
};

// ---------- brew store (localStorage, MongoDB-shaped docs) ----------
export function uuid() { // ponytail: crypto.randomUUID needs https; fallback for LAN-http testing
  return crypto.randomUUID ? crypto.randomUUID() :
    [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function validateBrews(a) {
  return Array.isArray(a) && a.every(b =>
    b && typeof b._id === 'string' && typeof b.name === 'string' &&
    Array.isArray(b.notes) &&
    b.notes.every(n => n && typeof n.category === 'string' && typeof n.note === 'string'));
}

export function newBrewDoc(name) {
  return { _id: uuid(), name, brewMethod: '', createdAt: new Date().toISOString(), notes: [] };
}

// Merge by _id, imported wins — never silently drops existing brews.
export function mergeBrews(existing, imported) {
  const byId = new Map(existing.map(b => [b._id, b]));
  imported.forEach(b => byId.set(b._id, b));
  return [...byId.values()];
}

// A future backend swaps these two functions for fetch calls; docs are Mongo-insertable as-is.
export function loadStore() {
  let brews = [];
  try { brews = JSON.parse(localStorage.getItem('brews')) || []; } catch { /* fresh start */ }
  if (!validateBrews(brews)) brews = [];
  let currentId = localStorage.getItem('currentBrewId');
  if (!brews.some(b => b._id === currentId)) currentId = brews[0] && brews[0]._id;
  if (!currentId) {
    const b = newBrewDoc('Untitled brew');
    brews = [...brews, b];
    currentId = b._id;
  }
  return { brews, currentId };
}

export function saveStore({ brews, currentId }) {
  localStorage.setItem('brews', JSON.stringify(brews));
  localStorage.setItem('currentBrewId', currentId);
}
