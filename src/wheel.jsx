import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  norm, polar, sectorPath, capsulePath, arcPath, flipped, ink, noteColors,
  ringOrder, radialGroups, noteFan, viewBoxFor, hitWheel, layoutWheel, dragPillAngle,
  fingerprintTones, mixWeightFor, noteColorOf,
} from './lib.js';

// feTurbulence is the most expensive primitive in SVG and on phones it is not GPU-accelerated.
// Nothing here depends on state, so the element is built once at module scope: a stable element
// reference lets React skip the subtree entirely instead of rebuilding the filter every render.
const GRAIN = (
  <filter id="fpgrain">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" result="noise" />
    <feColorMatrix type="saturate" values="0" result="grey" />
    {/* clip the noise to the source circle — otherwise the turbulence fills the
        filter's rectangular region and paints a visible square behind the disc */}
    <feComposite in="grey" in2="SourceGraphic" operator="in" />
  </filter>
);

// The hub is the cup itself: one soft tone per logged note, each sitting just outside the
// disc on its own bearing so only its inner arc shows, the whole stack blurred and clipped.
// Pulling a tone inward (its handle, drawn by <Wheel>) grows its share of the blend.
function Fingerprint({ cx, cy, r, tones, baseCol, dragging, sat }) {
  const gid = k => 'fpg-' + k.replace(/[^a-z0-9]/gi, '');
  const glide = { transition: dragging ? 'none' : 'all 1s cubic-bezier(.2,.8,.2,1)' };
  // Drift is animated with SVG-native <animateTransform> rather than a CSS transform: a CSS
  // animation here escapes the ancestor's clip-path + filter in some renderers and lets the
  // blobs bleed past the disc edge.
  const drift = (i, mag) => (
    <animateTransform attributeName="transform" type="translate" additive="sum"
      values={`0 0; ${mag} ${-mag * 0.8}; ${-mag * 0.7} ${mag}; 0 0`}
      dur={`${13 + i * 3.5}s`} begin={`${i * -1.3}s`} repeatCount="indefinite" />
  );
  return (
    <g style={{ pointerEvents: 'none', filter: sat }}>
      <defs>
        <clipPath id="fpclip"><circle cx={cx} cy={cy} r={r} /></clipPath>
        {GRAIN}
        <radialGradient id={gid('base')} cx="50%" cy="38%" r="78%">
          <stop offset="0%" stopColor={baseCol} stopOpacity="1" />
          <stop offset="100%" stopColor={baseCol} stopOpacity="0.72" />
        </radialGradient>
        {tones.map(l => (
          <radialGradient key={l.note} id={gid(l.note)} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={l.col} stopOpacity="0.98" />
            <stop offset="55%" stopColor={l.col} stopOpacity="0.72" />
            <stop offset="100%" stopColor={l.col} stopOpacity="0" />
          </radialGradient>
        ))}
        <radialGradient id={gid('hi')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath="url(#fpclip)">
        <circle cx={cx} cy={cy} r={r * 1.6} fill={`url(#${gid('base')})`}
                style={{ transition: 'fill 1.1s cubic-bezier(.2,.8,.2,1)' }} />
        {tones.length > 1 && tones.map((l, i) => (
          <g key={l.note}>
            <circle cx={l.bx} cy={l.by} r={l.R * 1.35} fill={`url(#${gid(l.note)})`} style={glide}>
              {drift(i, r * 0.05)}
            </circle>
            <circle cx={l.bx + r * 0.1} cy={l.by - r * 0.12} r={l.R * 0.55} fill={`url(#${gid('hi')})`}
                    style={{ ...glide, mixBlendMode: 'screen' }}>
              {drift(i + 1, r * 0.05)}
            </circle>
          </g>
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r} filter="url(#fpgrain)"
              style={{ opacity: 0.12, mixBlendMode: 'overlay' }} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={r * 0.16}
              style={{ opacity: 0.5 }} />
    </g>
  );
}

// Full-circle wheel. Tier 1 is the family ring, always visible; pressing a family fans its
// notes radially outward on that family's own bearing (tier 2). Logged notes leave the drill
// entirely and orbit the hub as draggable pills. Press-drag-release and tap-tap both work:
// a drag commits on release, a tap leaves the fan open ("sticky") so the next tap logs.
export function Wheel({ flavors, notes, intensity, onAdd, onRemove }) {
  const [cat, setCat] = useState(null);      // open family, as an index into the ring
  const [note, setNote] = useState(null);    // hot note under the pointer
  const [closing, setClosing] = useState(false);
  const [pillAng, setPillAng] = useState({});  // hand-dragged pill positions, by note index
  const [mix, setMix] = useState({});          // hand-dragged fingerprint shares, by note name
  const [dying, setDying] = useState(null);    // pill mid delete animation
  const [fpDrag, setFpDrag] = useState(null);  // tone whose handle is being dragged

  const svgRef = useRef();
  const press = useRef(false), sticky = useRef(false), noteAt = useRef(0);
  const pillDrag = useRef(null), closeT = useRef(), dieT = useRef();
  const prevRing = useRef({});
  const rect = useRef(null);   // svg bounds, read once per gesture instead of once per move
  const pillEl = useRef({});   // pill <g> nodes by note index, for the imperative drag

  useEffect(() => () => { clearTimeout(closeT.current); clearTimeout(dieT.current); }, []);
  useEffect(() => {
    const drop = () => { rect.current = null; };
    addEventListener('resize', drop);
    addEventListener('orientationchange', drop);
    return () => { removeEventListener('resize', drop); removeEventListener('orientationchange', drop); };
  }, []);

  const catNames = Object.keys(flavors);
  const ring = ringOrder(catNames, flavors);
  const open = cat != null;
  const openCat = open ? ring[cat].cat : null;
  const tiered = open ? !!flavors[openCat].groups : false;
  const colorOf = (c, nt) => noteColorOf(flavors, c, nt);

  const { F, pills, overflow } = layoutWheel({ notes, pillAng, open, tiered, ringSegs: ring, colorOf });
  const { tones, baseCol } = fingerprintTones({
    notes: notes.filter((_, j) => j !== dying), mix, colorOf, ringSegs: ring, pills,
    cx: F.ox, cy: F.oy, r: F.hub,
  });
  const vb = viewBoxFor(open, tiered);

  // ---- pointer plumbing: everything is resolved to (r, ang) around the origin first ----
  const at = e => {
    // getBoundingClientRect forces a style+layout flush, so it is read at pointerdown and
    // reused for the rest of the gesture rather than re-measured on every move.
    const rc = rect.current || (rect.current = svgRef.current.getBoundingClientRect());
    const ux = vb[0] + (e.clientX - rc.left) / rc.width * vb[2];
    const uy = vb[1] + (e.clientY - rc.top) / rc.height * vb[3];
    const dx = ux - F.ox, dy = F.oy - uy;
    return { ux, uy, r: Math.hypot(dx, dy), ang: Math.atan2(dx, dy) * 180 / Math.PI };
  };
  const hit = e => {
    const p = at(e);
    return hitWheel({ r: p.r, ang: norm(p.ang), F, ringSegs: ring, flavors, openIdx: cat, curNote: note });
  };
  const grab = e => {
    rect.current = svgRef.current.getBoundingClientRect();
    try { svgRef.current.setPointerCapture(e.pointerId); } catch { /* mouse */ }
  };

  // A drag's rotation is written straight to the DOM; this folds it back into React state so
  // the pill re-renders at its true bearing and its label re-flips if it crossed the line.
  const commitPill = () => {
    const d = pillDrag.current;
    if (!d || d.a0 == null) return;
    if (d.el) d.el.removeAttribute('transform');
    d.base = d.a0;
    d.flip = flipped(d.a0 + d.span / 2);
    setPillAng(p => ({ ...p, [d.i]: d.a0 }));
  };

  // Closing runs an outward fade first, so the fan does not just blink away.
  const closeDrill = () => {
    if (cat == null || closing) { setCat(null); setNote(null); setClosing(false); return; }
    setClosing(true);
    clearTimeout(closeT.current);
    closeT.current = setTimeout(() => { setCat(null); setNote(null); setClosing(false); }, 200);
  };

  const onDown = e => {
    e.preventDefault();
    grab(e);
    press.current = true;
    sticky.current = cat != null;
    const h = hit(e);
    if (!h || h.kind === 'hub') { closeDrill(); return; }
    if (h.kind === 'c') { setCat(h.a); setNote(null); setClosing(false); }
    if (h.kind === 'n') setNote(h.b);
  };

  const onMove = e => {
    if (pillDrag.current) {
      const d = pillDrag.current;
      // the slop test only gates the FIRST move — once past it, dragging back near the start
      // is still a drag, not a tap
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 14) return;
      d.moved = true;
      const others = pills.filter(x => x.i !== d.i && x.inRing1 === d.ring);
      const a0 = dragPillAngle({ ang: at(e).ang, span: d.span, others });
      if (a0 == null) return; // fully boxed in: hold the last valid position
      d.a0 = a0;
      // Sliding a pill along the rim is a pure rotation about the origin — same capsule, same
      // label arc, just a different bearing. So a move is ONE attribute write: no re-layout, no
      // React render, and above all no dirtying of the hub, whose blur + grain filters would
      // otherwise re-rasterise every frame. State catches up once, on release.
      if (flipped(a0 + d.span / 2) !== d.flip) commitPill();   // crossed the label-flip line
      else if (d.el) d.el.setAttribute('transform', `rotate(${a0 - d.base} ${F.ox} ${F.oy})`);
      return;
    }
    if (fpDrag) {
      const { ux, uy } = at(e);
      const l = tones.find(x => x.note === fpDrag);
      if (!l) return;
      // project the pointer onto this tone's bearing; nearer the centre = larger share
      const rad = (l.bearing - 90) * Math.PI / 180;
      const proj = (ux - F.ox) * Math.cos(rad) + (uy - F.oy) * Math.sin(rad);
      setMix(m => mixWeightFor({ proj, hubR: F.hub, tone: fpDrag, tones, mix: m }));
      return;
    }
    if (!press.current) return;
    const h = hit(e);
    if (!h) return;
    if (h.kind === 'hub') { closeDrill(); return; }
    if (h.kind === 'c' && h.a !== cat) { setCat(h.a); setNote(null); setClosing(false); }
    if (h.kind === 'n' && h.b !== note) { setNote(h.b); noteAt.current = Date.now(); }
  };

  const onUp = () => {
    if (pillDrag.current) {
      const { i, moved } = pillDrag.current;
      if (moved) commitPill();
      pillDrag.current = null;
      if (!moved) { // tap a pill to delete it; a moved pill is already collision-free, no snap-back
        setDying(i);
        clearTimeout(dieT.current);
        dieT.current = setTimeout(() => {
          onRemove(i); setPillAng({}); setMix({}); setDying(null); // indices shift — re-lay everything out
        }, 460);
      }
      return;
    }
    if (fpDrag) { setFpDrag(null); return; }
    press.current = false;
    // dwell guard: a drag-release commits only after >=80ms on the note; sticky taps always commit
    if (cat != null && note != null && (sticky.current || Date.now() - noteAt.current >= 80)) {
      onAdd(openCat, flavors[openCat].notes[note]);
      setCat(null); setNote(null);
    } else setNote(null);
  };

  // Intensity is the cup's strength, so it drives saturation — but applied per layer, never
  // once around everything: a filter forces its whole subtree into one offscreen buffer, so a
  // shared one makes a dragged pill re-rasterise the hub's blur and grain along with it.
  const sat = `saturate(${0.35 + (intensity / 10) * 1.35})`;

  // ---- tier 1: the family ring ----
  const settled = open && !closing; // recede only while genuinely open, not on the way out
  const tier1 = (
    <g style={{ transform: settled ? 'scale(0.88)' : 'scale(1)', transformOrigin: `${F.ox}px ${F.oy}px`,
                transition: 'transform .42s cubic-bezier(.2,.8,.2,1)', filter: sat }}>
      {ring.map((seg, i) => {
        const def = flavors[seg.cat], flip = flipped(seg.mid), fg = ink(def.color);
        // Compact dot-joined single line ONLY while the outer pill ring is active (the tier 1
        // band is thinnest then); otherwise a slashed family name stacks on concentric lines.
        const words = seg.cat.includes('/') ? seg.cat.split('/') : [seg.cat];
        const stacked = !overflow && words.length > 1;
        const lines = stacked ? words : [overflow && words.length > 1 ? words.join(' · ') : words[0]];
        const lineR = stacked ? words.map((_, w) => F.cLbl + (w - (words.length - 1) / 2) * 9) : [F.cLbl];
        return (
          <g key={seg.cat} opacity={open ? (cat === i ? 1 : 0.32) : 1} style={{ transition: 'opacity .3s' }}>
            <defs>
              {lineR.map((r, li) => (
                <path key={li} id={`fc${i}-${li}`} d={arcPath(F.ox, F.oy, r, seg.a0, seg.a1, flip)} fill="none" />
              ))}
            </defs>
            <path d={sectorPath(F.ox, F.oy, seg.a0, seg.a1, F.cIn, F.cOut)} fill={def.color}
                  style={{ stroke: cat === i ? '#fff' : '#1c1917', strokeWidth: cat === i ? 2.2 : 0.8, cursor: 'pointer' }} />
            {lines.map((w, li) => (
              <text key={li} dominantBaseline="central"
                    style={{ fontSize: stacked ? 8 : w.includes('·') ? 8 : 10, fill: fg, pointerEvents: 'none', letterSpacing: '0.01em' }}>
                <textPath href={`#fc${i}-${li}`} startOffset="50%" style={{ textAnchor: 'middle' }}>{w}</textPath>
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );

  // ---- tier 2: the open family's notes, fanned on its bearing ----
  let tier2 = null;
  if (open) {
    const seg = ring[cat], def = flavors[openCat], cols = noteColors(openCat, def);
    let fanIdx = 0; // inner band fans out first, then outer — clockwise within each
    tier2 = (
      <g style={{ transformOrigin: `${F.ox}px ${F.oy}px`,
                  transition: 'transform .2s cubic-bezier(.4,0,.6,1), opacity .2s ease-in',
                  transform: closing ? 'scale(.5)' : 'scale(1)', opacity: closing ? 0 : 1, filter: sat }}>
        {radialGroups(def, F.nIn, F.nOut).flatMap(g => {
          const { per, start } = noteFan(seg.mid, g.notes.length);
          return g.notes.map((nt, gi) => {
            const j = g.idx0 + gi, delay = fanIdx++ * 22;
            const a0 = start + gi * per, a1 = a0 + per, hot = note === j;
            const flip = flipped(a0 + per / 2);
            const arcLen = per * Math.PI / 180 * g.lr;
            const longest = Math.max(...nt.split(' ').map(w => w.length));
            const fs = Math.max(6.2, Math.min(11.5, (arcLen - 14) / (longest * 0.62)));
            // A flipped (bottom-half) sector reads outward-in, so swap which word sits on
            // which ring to keep the reading order matching the actual word order.
            const raw = nt.includes(' ') ? nt.split(' ') : [nt];
            const words = flip ? [...raw].reverse() : raw;
            const lineRs = words.length > 1
              ? words.map((_, w) => g.lr + (w - (words.length - 1) / 2) * (fs * 1.05))
              : [g.lr];
            return (
              <g key={nt} style={{ transformOrigin: `${F.ox}px ${F.oy}px`,
                                   animation: `fpFanIn .22s cubic-bezier(.2,.8,.2,1) ${delay}ms backwards` }}>
                <defs>
                  {lineRs.map((rr, li) => (
                    <path key={li} id={`fn${j}-${li}`} d={arcPath(F.ox, F.oy, rr, a0, a1, flip)} fill="none" />
                  ))}
                </defs>
                <path d={sectorPath(F.ox, F.oy, a0 + F.nGap, a1 - F.nGap, g.rIn, g.rOut)} fill={cols[j]}
                      style={{ stroke: hot ? '#fff' : 'none', strokeWidth: hot ? 2.2 : 0, cursor: 'pointer' }} />
                <text dominantBaseline="central"
                      style={{ fontSize: fs, fill: ink(cols[j]), pointerEvents: 'none', letterSpacing: '0.01em' }}>
                  {words.map((w, li) => (
                    <textPath key={li} href={`#fn${j}-${li}`} startOffset="50%" style={{ textAnchor: 'middle' }}>{w}</textPath>
                  ))}
                </text>
              </g>
            );
          });
        })}
      </g>
    );
  }

  // ---- the pill orbit: logged notes, draggable around the rim, tap to delete ----
  const nextRing = {};
  const orbit = (
    <g style={{ filter: sat }}>
      {pills.map(p => {
        const pad = 1.4, mid = p.a0 + (p.a1 - p.a0) / 2;
        const [pcx, pcy] = polar(F.ox, F.oy, p.rMid, mid);
        // A ring switch pops rather than glides: an arc's own `d` cannot be CSS-transitioned,
        // so a quick scale + fade sells the jump between the inner and outer rim.
        const switched = prevRing.current[p.key] != null && prevRing.current[p.key] !== p.inRing1;
        nextRing[p.key] = p.inRing1;
        const gone = dying === p.i;
        return (
          // Outer <g> carries nothing but the drag rotation, written directly to the DOM. The
          // inner one keeps the CSS transform for the delete / ring-switch animations, because a
          // CSS `transform` overrides the SVG `transform` attribute outright — they cannot share.
          <g key={p.key} ref={el => { if (el) pillEl.current[p.i] = el; else delete pillEl.current[p.i]; }}>
          <g style={{ cursor: 'grab', transformOrigin: `${pcx}px ${pcy}px`,
                      transform: gone ? 'scale(.15)' : 'scale(1)', opacity: gone ? 0 : 1,
                      animation: switched ? 'fpRingPop .32s cubic-bezier(.2,.8,.2,1)' : 'none',
                      transition: 'transform .34s cubic-bezier(.55,0,.65,.3), opacity .3s ease-in .04s' }}
             onPointerDown={e => {
               e.stopPropagation(); grab(e);
               pillDrag.current = { i: p.i, moved: false, sx: e.clientX, sy: e.clientY,
                                    el: pillEl.current[p.i], base: p.a0, a0: p.a0,
                                    span: p.a1 - p.a0, flip: p.flip, ring: p.inRing1 };
             }}>
            <defs>
              <path id={`fpill${p.i}`}
                    d={arcPath(F.ox, F.oy, p.rMid, p.a0 + pad, p.a1 - pad, p.flip)} fill="none" />
            </defs>
            <path d={capsulePath(F.ox, F.oy, p.a0, p.a1, p.rIn, p.rOut)} fill={p.col} stroke="#1c1917" strokeWidth="1.2" />
            <text dominantBaseline="central"
                  style={{ fontSize: Math.max(5.8, 8.4 * p.fscale), fill: ink(p.col), pointerEvents: 'none', letterSpacing: '0.01em' }}>
              <textPath href={`#fpill${p.i}`} startOffset="50%" style={{ textAnchor: 'middle' }}>{p.nn.note}</textPath>
            </text>
          </g>
          </g>
        );
      })}
    </g>
  );
  useLayoutEffect(() => { prevRing.current = nextRing; });

  return (
    <svg ref={svgRef} viewBox={vb.join(' ')} className="wheel"
         onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <g>
        {tier2}
        {tier1}
        <circle cx={F.ox} cy={F.oy} r={F.hub} fill="#221d1b"
                style={{ pointerEvents: 'none', transition: 'r .38s cubic-bezier(.2,.8,.2,1)' }} />
        <Fingerprint cx={F.ox} cy={F.oy} r={F.hub} sat={sat} tones={tones} baseCol={baseCol} dragging={!!fpDrag} />
        {orbit}
        <g>
          {tones.length > 1 && tones.map(l => (
            <circle key={l.note} cx={l.hx} cy={l.hy} r="6" fill={l.col}
                    stroke="rgba(255,255,255,.55)" strokeWidth="1" style={{ cursor: 'grab' }}
                    onPointerDown={e => { e.stopPropagation(); grab(e); setFpDrag(l.note); }} />
          ))}
        </g>
        <text x={F.ox} y={F.oy} className="hubText"
              style={{ fontSize: Math.min(15, 150 / ((openCat || ' ').length * 0.6)) }}>
          {open ? openCat : ''}
        </text>
      </g>
    </svg>
  );
}

