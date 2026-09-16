// Pure logic + storage. No React imports — test.js runs this file directly in Node.

// ---------- geometry ----------
// The wheel is authored in a fixed 390-unit user space centred on ORIGIN; the SVG
// viewBox crops and zooms around that origin instead of rescaling the geometry, so
// every radius below is absolute and comparable.
export const ORIGIN = { x: 195, y: 195 };

export const norm = d => ((d % 360) + 360) % 360;

export function angDist(a, b) {
  const d = Math.abs(norm(a) - norm(b));
  return Math.min(d, 360 - d);
}

// 0° points up, angles run clockwise.
export function polar(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

export function sectorPath(cx, cy, a0, a1, r0, r1) {
  const lg = a1 - a0 > 180 ? 1 : 0, p = (r, a) => polar(cx, cy, r, a).map(v => v.toFixed(2));
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${lg} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${lg} 0 ${x3} ${y3}Z`;
}

// Annular sector with semicircular ends — the logged-note pills that orbit the hub.
export function capsulePath(cx, cy, a0, a1, r0, r1) {
  const th = (r1 - r0) / 2, p = (r, a) => polar(cx, cy, r, a).map(v => v.toFixed(2));
  const capDeg = th / ((r0 + r1) / 2) * 57.2958; // each round cap eats this much off its end
  const b0 = a0 + capDeg, b1 = a1 - capDeg;
  if (b1 <= b0) { // shorter than its own caps: degenerate to a plain dot
    const [x, y] = p((r0 + r1) / 2, (a0 + a1) / 2);
    return `M${x} ${y}m${-th} 0a${th} ${th} 0 1 0 ${th * 2} 0a${th} ${th} 0 1 0 ${-th * 2} 0Z`;
  }
  const [xo0, yo0] = p(r1, b0), [xo1, yo1] = p(r1, b1), [xi1, yi1] = p(r0, b1), [xi0, yi0] = p(r0, b0);
  const large = b1 - b0 > 180 ? 1 : 0;
  return `M${xo0} ${yo0}A${r1} ${r1} 0 ${large} 1 ${xo1} ${yo1}` +
         `A${th} ${th} 0 0 1 ${xi1} ${yi1}` +
         `A${r0} ${r0} 0 ${large} 0 ${xi0} ${yi0}` +
         `A${th} ${th} 0 0 1 ${xo0} ${yo0}Z`;
}

// Bare arc used as a <textPath> baseline. Labels ride the arc instead of being
// rotated radially, so multi-word names stack on concentric lines.
export function arcPath(cx, cy, r, a0, a1, flip) {
  const p0 = polar(cx, cy, r, flip ? a1 : a0).map(v => v.toFixed(2));
  const p1 = polar(cx, cy, r, flip ? a0 : a1).map(v => v.toFixed(2));
  return `M${p0[0]} ${p0[1]}A${r} ${r} 0 0 ${flip ? 0 : 1} ${p1[0]} ${p1[1]}`;
}

// Lower half: reverse the baseline so text still reads left-to-right, not upside down.
export const flipped = mid => norm(mid) > 90 && norm(mid) < 270;

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

// Fallback ramp for notes with no colour of their own: lightness rises, saturation
// eases off and the hue drifts slightly across the fan.
export function shades(hex, n) {
  const { h, s } = hexToHsl(hex);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return `hsl(${norm(h + (t - 0.5) * 10)} ${Math.round(s * 0.55)}% ${Math.round(72 + t * 12)}%)`;
  });
}

// Parse either colour format the app produces (#hex from flavors.yaml, hsl() from shades()).
export function toRgb(col) {
  if (col[0] === '#') return [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16));
  const [h, s, l] = col.match(/-?[\d.]+/g).map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

// Weighted mix in linear-light sRGB — averaging gamma-encoded channels darkens the result.
export function mixColors(cols, weights) {
  const lin = c => Math.pow(c / 255, 2.2), gam = c => Math.round(255 * Math.pow(c, 1 / 2.2));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const acc = [0, 0, 0];
  cols.forEach((col, i) => toRgb(col).forEach((c, j) => { acc[j] += lin(c) * weights[i] / sum; }));
  return '#' + acc.map(c => gam(c).toString(16).padStart(2, '0')).join('');
}

// Dark ink on light fills, light ink on dark ones — the palette is pastel, so most
// sectors want the dark one.
export function ink(col) {
  if (typeof col !== 'string') return '#fff';
  // shades() hands back hsl() strings, so lightness is already the answer for those
  if (col.startsWith('hsl')) {
    const m = col.match(/-?[\d.]+/g);
    return m && +m[2] > 60 ? '#3a2f28' : '#fff';
  }
  if (col[0] !== '#') return '#fff';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16));
  return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#3a2f28' : '#fff';
}

// Components only ever call these; reassign the properties (e.g. from a future theme
// module) to swap in a different colour scheme.
export const colorMapper = {
  category: (name, def) => def.color,
  // i < 0 means a logged note that flavors.yaml no longer lists — an older brew still has to
  // render, so it falls back to its family's colour rather than to nothing.
  note: (catName, def, i, n) =>
    i < 0 ? def.color : (def.noteColors || {})[def.notes[i]] || shades(def.color, n)[i],
};

export const noteColors = (cat, def) =>
  def.notes.map((_, i) => colorMapper.note(cat, def, i, def.notes.length));

// ---------- flavor profiles ----------
export const DEFAULT_FLAVOR_PROFILE_ID = 'bundled:default';
const HEX = /^#[0-9a-f]{6}$/i;

export function validateFlavorTree(tree) {
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) return false;
  const families = Object.entries(tree);
  if (!families.length) return false;
  return families.every(([name, def]) => {
    if (!name.trim() || !def || typeof def !== 'object' || Array.isArray(def) || !HEX.test(def.color)) return false;
    if (!Array.isArray(def.notes) || !def.notes.length ||
        !def.notes.every(n => typeof n === 'string' && n.trim()) ||
        new Set(def.notes).size !== def.notes.length) return false;
    if (def.noteColors != null &&
        (!def.noteColors || typeof def.noteColors !== 'object' || Array.isArray(def.noteColors) ||
         !Object.values(def.noteColors).every(c => typeof c === 'string' && HEX.test(c)))) return false;
    if (def.groups != null &&
        (!Array.isArray(def.groups) || !def.groups.length ||
         !def.groups.every(n => Number.isInteger(n) && n > 0) ||
         def.groups.reduce((a, b) => a + b, 0) !== def.notes.length)) return false;
    return true;
  });
}

export function validateFlavorProfile(profile) {
  return !!(profile && typeof profile === 'object' &&
    typeof profile._id === 'string' && profile._id &&
    typeof profile.name === 'string' && profile.name.trim() &&
    validateFlavorTree(profile.flavors));
}

export function loadFlavorProfiles() {
  let profiles = [];
  try { profiles = JSON.parse(localStorage.getItem('flavorProfiles')) || []; } catch { /* fresh start */ }
  if (!Array.isArray(profiles)) profiles = [];
  profiles = profiles.filter(validateFlavorProfile);
  let activeId = localStorage.getItem('activeFlavorProfileId') || DEFAULT_FLAVOR_PROFILE_ID;
  if (activeId !== DEFAULT_FLAVOR_PROFILE_ID && !profiles.some(p => p._id === activeId)) {
    activeId = DEFAULT_FLAVOR_PROFILE_ID;
  }
  return { profiles, activeId };
}

export function saveFlavorProfiles({ profiles, activeId }) {
  localStorage.setItem('flavorProfiles', JSON.stringify(profiles));
  localStorage.setItem('activeFlavorProfileId', activeId);
}

// flavors.yaml is user-editable, so a saved brew can hold notes from a family that no longer
// exists. Those pills still have to draw, so resolve colour defensively rather than throwing.
export const UNKNOWN_COLOR = '#8d8177';
export function noteColorOf(flavors, cat, note) {
  const def = flavors[cat];
  return def ? colorMapper.note(cat, def, def.notes.indexOf(note), def.notes.length) : UNKNOWN_COLOR;
}

// ---------- wheel layout ----------
// Families keep YAML order. `rot` shifts the complete ring without changing that order.
export function ringOrder(catNames, _flavors, rot = 210) {
  const n = catNames.length, sweep = 360 / n;
  return catNames.map((cat, i) => {
    const a0 = -sweep / 2 + i * sweep + rot;
    return { cat, a0, a1: a0 + sweep, mid: a0 + sweep / 2 };
  });
}

// Divides a family's notes into concentric radial bands per def.groups (e.g. [3,3,5]);
// families without .groups render as one band spanning the whole rIn..rOut.
export function radialGroups(def, rIn, rOut) {
  if (!def.groups) return [{ notes: def.notes, idx0: 0, rIn, rOut, lr: (rIn + rOut) / 2 }];
  const total = def.groups.reduce((a, b) => a + b, 0), out = [];
  const gap = 3, n = def.groups.length, usable = rOut - rIn - gap * (n - 1);
  let idx0 = 0, rCursor = rIn;
  def.groups.forEach((count, gi) => {
    const rNext = rCursor + usable * (count / total);
    out.push({ notes: def.notes.slice(idx0, idx0 + count), idx0, rIn: rCursor, rOut: rNext, lr: (rCursor + rNext) / 2 });
    rCursor = rNext + (gi < n - 1 ? gap : 0);
    idx0 += count;
  });
  return out;
}

// A band's notes fan out on the family's own bearing, 27° each (shrinking if they'd wrap).
export function noteFan(midDeg, n) {
  const per = Math.min(27, 360 / n);
  return { per, start: midDeg - per * n / 2 };
}

// Radii for one wheel state. `open` (a family is drilled) bites tier 1 inward and
// shrinks the hub to match, so it is harder to fat-finger back to closed; `overflow`
// (a second pill ring exists) makes the hub give up more room still; `tiered` widens
// the note band so a multi-band family's sub-rings all fit their text.
export function wheelGeom({ open = false, tiered = false, overflow = false } = {}) {
  const shrink = open ? 22 : 0;
  const cIn = (overflow ? 108 : 84) - shrink, cOut = 126;
  return {
    ox: ORIGIN.x, oy: ORIGIN.y,
    cIn, cOut, cLbl: (cIn + cOut) / 2,
    nIn: 132, nOut: tiered ? 230 : 178, nLbl: 155, nGap: 1.6,
    hub: (overflow ? 62 : 70) - shrink * 1.15,
  };
}

// Closed the wheel is a tight crop; drilling zooms out to make room for tier 2.
export const viewBoxFor = (open, tiered) =>
  open ? (tiered ? [-46, -46, 476, 496] : [3, 3, 384, 384]) : [59, 59, 272, 272];

// Which target sits under a pointer already resolved to (r, ang) around the origin.
export function hitWheel({ r, ang, F, ringSegs, flavors, openIdx, curNote }) {
  const open = openIdx != null;
  if (r < F.cIn * 0.25) return { kind: 'hub' };
  if (r < F.cIn) return null;
  if (r <= F.cOut) {
    let idx = ringSegs.findIndex(s => {
      const w = s.a1 - s.a0, rel = norm(ang - s.a0);
      return rel >= 0 && rel < w;
    });
    if (idx < 0) return null;
    if (openIdx != null && idx !== openIdx) { // hysteresis: hold the open family until clearly outside it
      const s = ringSegs[openIdx], w = s.a1 - s.a0, rel = norm(ang - s.a0);
      const outBy = rel > w ? Math.min(rel - w, 360 - rel) : 0;
      if (outBy < w * 0.18) idx = openIdx;
    }
    return { kind: 'c', a: idx, b: null };
  }
  if (open && r > F.nIn && r <= F.nOut) {
    const seg = ringSegs[openIdx], def = flavors[seg.cat];
    const g = radialGroups(def, F.nIn, F.nOut).find(gr => r >= gr.rIn && r <= gr.rOut);
    if (!g) return null;
    const m = g.notes.length, { per, start } = noteFan(seg.mid, m);
    const pos = norm(ang - start) / per, gi = Math.floor(pos);
    if (gi < 0 || gi >= m) return null;
    const j = g.idx0 + gi;
    // same hysteresis on the note ring: a wobble near a border keeps the current note
    if (curNote != null && j !== curNote && Math.abs(pos - (curNote - g.idx0 + 0.5)) < 0.68)
      return { kind: 'n', a: openIdx, b: curNote };
    return { kind: 'n', a: openIdx, b: j };
  }
  return null;
}

// ---------- pill orbit ----------
// Logged notes ride the hub rim as capsules. Layout is recomputed from scratch on every
// render (spawn, drag and delete all reshuffle), so nothing can drift out of sync.
//
// `allowRing1: false` is the trial pass: it bails with {overflowed:true} the moment a
// pill cannot fit the inner ring, so the caller can rerun on the overflow geometry
// (smaller hub, two rings). `relaxStored` lets a hand-placed pill be nudged off its
// stored angle rather than exiled outward.
export function layoutPills({ notes, pillAng = {}, F, ringSegs, colorOf, allowRing1, relaxStored }) {
  const all = notes || [];
  const rimIn = F.hub - 9, rimOut = F.hub + 9, rimMid = F.hub;
  const tier1Inner = F.cIn * 0.88;
  const ring1Mid = Math.min(rimOut + 2 + 9, tier1Inner - 9 - 2);
  const ring1In = ring1Mid - 9, ring1Out = ring1Mid + 9;
  const degPerChar = 5.0 / rimMid * 57.2958;
  const reserve = 12; // ring 0 always keeps this much arc free
  const rawSpans = all.map(nn => Math.min(150, nn.note.length * degPerChar + 22));

  const hits = (ranges, a0, span) => {
    const pad = 2;
    const s = norm(a0) - pad, e = s + span + pad * 2;
    return ranges.some(([b0, bSpan]) => {
      for (const off of [-360, 0, 360]) {
        const t0 = b0 + off, t1 = t0 + bSpan;
        if (Math.min(e, t1) - Math.max(s, t0) > 0.01) return true;
      }
      return false;
    });
  };
  const findSlot = (ranges, base, span) => {
    if (!hits(ranges, base, span)) return norm(base);
    for (let k = 1; k <= 90; k++)
      for (const dir of [1, -1]) {
        const cand = base + dir * k * 2;
        if (!hits(ranges, cand, span)) return norm(cand);
      }
    return null;
  };

  const seen = {};
  const mkPill = (nn, i, a0, span, inRing1, squeeze) => {
    const mid = norm(a0 + span / 2);
    // stable identity: name + occurrence, NOT array index (indices shift on delete)
    const idKey = nn.category + '|' + nn.note;
    seen[idKey] = (seen[idKey] || 0) + 1;
    return {
      nn, i, key: idKey + '|' + seen[idKey], a0, a1: a0 + span, mid, flip: flipped(mid),
      rIn: inRing1 ? ring1In : rimIn, rOut: inRing1 ? ring1Out : rimOut,
      rMid: inRing1 ? ring1Mid : rimMid, inRing1, fscale: squeeze,
      col: colorOf(nn.category, nn.note),
    };
  };

  // Self-correcting: run a full placement attempt; if ANY pill fails to find a genuine
  // slot, retry the whole layout with every span (and label) squeezed smaller. Nothing is
  // estimated, so pad overhead and gap fragmentation can never silently overlap.
  const attempt = squeeze => {
    const placed0 = [], placed1 = [], pills = [];
    let used0 = 0;
    for (const k in seen) delete seen[k];
    for (let i = 0; i < all.length; i++) {
      const nn = all[i];
      const span = rawSpans[i] * squeeze;
      const stored = pillAng[i];
      const seg = ringSegs.find(s => s.cat === nn.category);
      const base = (seg ? seg.mid : 0) - span / 2;
      let a0, inRing1 = false;
      if (stored != null) {
        a0 = norm(stored);
        if (hits(placed0, a0, span)) {
          const renudged = relaxStored ? findSlot(placed0, stored, span) : null;
          if (renudged != null) a0 = renudged;
          else if (!allowRing1) return { overflowed: true };
          else inRing1 = true;
        }
      } else {
        const slot0 = used0 + span <= 360 - reserve ? findSlot(placed0, base, span) : null;
        if (slot0 != null) a0 = slot0;
        else if (!allowRing1) return { overflowed: true };
        else inRing1 = true;
      }
      if (inRing1) {
        const want = a0 != null ? a0 : base;
        if (a0 == null || hits(placed1, a0, span)) {
          const slot1 = findSlot(placed1, want, span);
          if (slot1 == null) return null; // genuine failure → caller retries with a smaller squeeze
          a0 = slot1;
        }
      }
      if (!inRing1) used0 += span;
      (inRing1 ? placed1 : placed0).push([norm(a0), span]);
      pills.push(mkPill(nn, i, a0, span, inRing1, squeeze));
    }
    return { pills, overflowed: false };
  };

  // Both rims packed solid — real note names ("dark chocolate") are wide enough that a very
  // full cup gets here. Lay every pill on a fixed pitch instead: overlap is impossible by
  // construction, so a heavy cup shows crowded pills rather than losing them all.
  const evenly = () => {
    const half = Math.ceil(all.length / 2);
    for (const k in seen) delete seen[k];
    return {
      pills: all.map((nn, i) => {
        const inRing1 = i >= half, k = inRing1 ? i - half : i;
        const per = 360 / (inRing1 ? all.length - half : half);
        const span = Math.max(4, per - 2);
        return mkPill(nn, i, norm(k * per), span, inRing1, Math.min(1, span / rawSpans[i]));
      }),
      overflowed: false,
    };
  };

  if (!allowRing1) {
    const res = attempt(1);
    return res === null || res.overflowed ? { pills: null, overflowed: true } : res;
  }
  for (let sq = 1; sq >= 0.22; sq *= 0.85) {
    const res = attempt(sq);
    if (res !== null) return res;
  }
  return evenly();
}

// Runs both passes: the outer ring only spawns when the inner one genuinely cannot hold
// every pill, and the geometry it needs comes with it.
export function layoutWheel({ notes, pillAng, open, tiered, ringSegs, colorOf }) {
  let F = wheelGeom({ open, tiered, overflow: false });
  let res = layoutPills({ notes, pillAng, F, ringSegs, colorOf, allowRing1: false, relaxStored: true });
  if (!res.overflowed) return { F, pills: res.pills, overflow: false };
  F = wheelGeom({ open, tiered, overflow: true });
  res = layoutPills({ notes, pillAng, F, ringSegs, colorOf, allowRing1: true, relaxStored: true });
  return { F, pills: res.pills, overflow: true };
}

// Where a pill lands while being dragged: B stays fixed, so the dragged pill clamps at a
// neighbour's edge instead of overlaying it, and only jumps to the far side once the
// cursor pushes past that neighbour's centre. Returns null when fully boxed in.
export function dragPillAngle({ ang, span, others }) {
  const pad = 2;
  const meMid = norm(ang);
  const signed = (a, b) => ((a - b + 540) % 360) - 180;
  const collides = a0c => others.some(o => {
    for (const off of [-360, 0, 360]) {
      const t0 = o.a0 + off, t1 = o.a1 + off;
      if (Math.min(norm(a0c) + span + pad, t1) - Math.max(norm(a0c) - pad, t0) > 0.01) return true;
    }
    return false;
  });
  let cand = ang - span / 2;
  for (let pass = 0; pass < 3 && collides(cand); pass++) {
    const candMid = norm(cand + span / 2);
    const blocker = others.find(o => angDist(o.mid, candMid) < ((o.a1 - o.a0) + span) / 2 + pad);
    if (!blocker) break;
    cand = signed(meMid, blocker.mid) < 0
      ? blocker.a0 - span - pad  // cursor before B's centre → clamp to B's near edge
      : blocker.a1 + pad;        // cursor pushed past B's centre → jump to the far side
  }
  return collides(cand) ? null : cand;
}

// ---------- taste fingerprint ----------
// The hub is the cup: every logged note contributes a tone, placed on its own bearing
// just outside the disc so only its inner arc shows. Share pulls a tone inward — that is
// the mix control, and the share→radius curve is logarithmic so small drags move a lot.
export const fpCurve = p => Math.log(1 + 9 * p) / Math.LN10;

export function fingerprintTones({ notes, mix = {}, colorOf, ringSegs, pills = [], cx, cy, r, style = 'all' }) {
  const w = {};
  notes.forEach(nn => { w[nn.note] = w[nn.note] || { n: 0, cat: nn.category }; w[nn.note].n++; });
  const nTones = style === 'duotone' ? 2 : style === 'tritone' ? 3 : 99; // "all" = every logged note
  const top = Object.entries(w).sort((a, b) => b[1].n - a[1].n).slice(-nTones);
  const N = top.length;
  const colOf = ([note, v]) => colorOf(v.cat, note);
  // Relational mix: raw weights are normalised, so pulling one tone back pushes the rest up.
  const raws = top.map((t, i) => Math.max(0.02, mix[t[0]] == null ? t[1].n : mix[t[0]]));
  const rawSum = raws.reduce((a, b) => a + b, 0) || 1;
  // Base coat = the cup's true blend: every tone's colour mixed by share, so dragging a
  // handle shifts the whole disc toward that note, not just its own gradient.
  const baseCol = N ? mixColors(top.map(colOf), raws) : '#221d1b';
  const tones = top.map((t, i) => {
    const p = raws[i] / rawSum;                            // this tone's share of the cup
    const u = Math.max(0.03, Math.min(1, fpCurve(p)));
    const d = r * (1.5 - 1.3 * u) * (N > 4 ? 0.92 : 1);
    const R = r * (1.3 - 0.5 * (d / r));
    const seg = ringSegs.find(s => s.cat === t[1].cat);
    const placed = pills.find(p2 => p2.nn.note === t[0]);  // sit under the note's own pill when it has one
    const bearing = placed ? placed.mid
      : seg ? seg.mid
      : (notes.findIndex(x => x.note === t[0]) / Math.max(1, notes.length)) * 360;
    const [bx, by] = polar(cx, cy, d, bearing);
    // the handle track stops short of the pill rim (rim inner edge is r-9; keep 6 handle + 2 clear)
    const hMax = Math.max(0.15, (r - 9 - 6 - 2) / r);
    const [hx, hy] = polar(cx, cy, r * Math.min(hMax, 0.1 + 0.68 * (1 - u)), bearing);
    // Tones pre-mixed toward the cup blend so overlapping gradients read as regions of one
    // liquid instead of contrasting stickers (seams between unrelated hues go muddy).
    return { note: t[0], col: mixColors([colOf(t), baseCol], [0.82, 0.18]), bearing, s: u, p, d, R, bx, by, hx, hy };
  });
  return { tones, baseCol };
}

// Dragging a handle toward the centre gives that tone a bigger share; the others are
// renormalised around it. `proj` is the pointer projected onto the tone's own bearing.
export function mixWeightFor({ proj, hubR, tone, tones, mix }) {
  const t = Math.max(0, Math.min(1, (proj / hubR - 0.1) / 0.68));
  const u = Math.max(0.03, Math.min(0.98, 1 - t));
  const share = Math.max(0.02, Math.min(0.94, (Math.pow(10, u) - 1) / 9)); // invert the log curve
  const others = tones.filter(x => x.note !== tone);
  const otherRaw = others.reduce((a, x) => a + (mix[x.note] ?? x.p * 10), 0) || 1;
  const next = { ...mix };
  others.forEach(x => { if (next[x.note] == null) next[x.note] = x.p * 10; });
  next[tone] = share / (1 - share) * otherRaw;
  return next;
}

// ---------- brew store (localStorage, MongoDB-shaped docs) ----------
export const SCA_DIMS = ['Fragrance', 'Acidity', 'Sweetness', 'Intensity'];
export const defaultScores = () => ({ Fragrance: 6, Acidity: 7, Sweetness: 6, Intensity: 5 });

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
  return {
    _id: uuid(), name, origin: '', process: '', varietal: '', brewMethod: '',
    createdAt: new Date().toISOString(),
    scores: defaultScores(), remark: '', notes: [],
  };
}

// Cupping fields arrived after v0.1, so docs written by the old build (and any
// hand-edited import) are filled in on read rather than rejected.
export function fillBrew(b) {
  const scores = { ...defaultScores() };
  // scores come back from JSON, which is happy to hand over strings, nulls or nothing at all
  Object.entries(b.scores || {}).forEach(([k, v]) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (typeof n === 'number' && Number.isFinite(n)) scores[k] = n;
  });
  return {
    origin: '', process: '', varietal: '', brewMethod: '', remark: '',
    createdAt: new Date().toISOString(), ...b, scores,
  };
}

// Merge by _id, imported wins — never silently drops existing brews.
export function mergeBrews(existing, imported) {
  const byId = new Map(existing.map(b => [b._id, b]));
  imported.forEach(b => byId.set(b._id, fillBrew(b)));
  return [...byId.values()];
}

// A future backend swaps these two functions for fetch calls; docs are Mongo-insertable as-is.
export function loadStore() {
  let brews = [];
  try { brews = JSON.parse(localStorage.getItem('brews')) || []; } catch { /* fresh start */ }
  if (!validateBrews(brews)) brews = [];
  brews = brews.map(fillBrew);
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
