import { useEffect, useRef, useState } from 'react';
import yaml from 'js-yaml';
import {
  R, norm, polar, sectorPath, fanLayout, splitLabel, colorMapper,
  validateBrews, newBrewDoc, mergeBrews, loadStore, saveStore,
} from './lib.js';

// Radial label at (r, midDeg), flipped on the left half so it never reads upside down.
function Label({ label, r, midDeg }) {
  const m = norm(midDeg);
  const [x, y] = polar(r, midDeg);
  const rot = (m < 180 ? m - 90 : m + 90).toFixed(1);
  const lines = splitLabel(label);
  const longest = Math.max(...lines.map(l => l.length));
  const fs = Math.min(3, 15 / (longest * 0.6));
  return (
    <text x={x} y={y} style={{ fontSize: fs }} transform={`rotate(${rot} ${x} ${y})`}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? (lines.length > 1 ? '-0.6em' : '0') : '1.2em'}>{l}</tspan>
      ))}
    </text>
  );
}

// Two-tier wheel: inner pie = categories (always visible), outer ring = fan of
// the selected category's notes centered on its bearing. Phase 2's gesture
// layer will drive this same component; only input handling changes.
function Wheel({ cats, fan, hubLabel, onCat, onNote, onClose }) {
  const sweep = 360 / cats.length;
  const layout = fan && fanLayout(fan.midDeg, fan.items.length);
  const hubFs = Math.min(3.2, 20 / (hubLabel.length * 0.6));
  return (
    <svg viewBox="0 0 100 100" onClick={onClose}>
      {cats.map((c, i) => {
        const a0 = i * sweep, a1 = a0 + sweep - (cats.length === 1 ? 0.01 : 0);
        return (
          <g key={c.label} opacity={fan && fan.selected !== i ? 0.35 : 1}
             onClick={e => { e.stopPropagation(); onCat(i); }}>
            <path d={sectorPath(a0, a1, R.catIn, R.catOut)} fill={c.color} />
            <Label label={c.label} r={R.catLabel} midDeg={a0 + sweep / 2} />
          </g>
        );
      })}
      {fan && fan.items.map((it, i) => {
        const a0 = layout.start + i * layout.per;
        return (
          <g key={it.label} onClick={e => { e.stopPropagation(); onNote(i); }}>
            <path d={sectorPath(a0, a0 + layout.per, R.fanIn, R.fanOut)} fill={it.color} />
            <Label label={it.label} r={R.fanLabel} midDeg={a0 + layout.per / 2} />
          </g>
        );
      })}
      <circle id="hub" cx="50" cy="50" r={R.hub} />
      <text id="hubText" x="50" y="50" style={{ fontSize: hubFs }}>{hubLabel}</text>
    </svg>
  );
}

export default function App() {
  const [flavors, setFlavors] = useState(null);
  const [view, setView] = useState(null); // null = closed, or open category name
  const [store, setStore] = useState(loadStore);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    fetch('flavors.yaml').then(r => r.text()).then(t => setFlavors(yaml.load(t)));
  }, []);
  useEffect(() => saveStore(store), [store]);

  if (!flavors) return null;

  const catNames = Object.keys(flavors);
  const cats = catNames.map(c => ({ label: c, color: colorMapper.category(c, flavors[c]) }));
  const sweep = 360 / catNames.length;
  const cur = store.brews.find(b => b._id === store.currentId);

  let fan = null;
  if (view !== null) {
    const i = catNames.indexOf(view), def = flavors[view];
    fan = {
      midDeg: i * sweep + sweep / 2,
      selected: i,
      items: def.notes.map((nt, j) => ({ label: nt, color: colorMapper.note(view, def, j, def.notes.length) })),
    };
  }

  const updateCur = fn =>
    setStore(s => ({ ...s, brews: s.brews.map(b => (b._id === s.currentId ? fn(b) : b)) }));

  const addNote = i => {
    updateCur(b => ({
      ...b,
      notes: [...b.notes, { category: view, note: flavors[view].notes[i], ts: new Date().toISOString() }],
    }));
    setView(null);
  };

  const newBrew = () => {
    const name = prompt('New brew name', '');
    if (name === null) return;
    const b = newBrewDoc(name || 'Untitled brew');
    setStore(s => ({ brews: [...s.brews, b], currentId: b._id }));
    setView(null);
  };

  const rename = () => {
    const name = prompt('Brew name', cur.name);
    if (name) updateCur(b => ({ ...b, name }));
  };

  const copy = async () => {
    const text = cur.notes.map(n => n.note).join(', ');
    try { await navigator.clipboard.writeText(text); }
    catch { // ponytail: clipboard API needs https; execCommand fallback for LAN-http
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(store.brews, null, 2)], { type: 'application/json' }));
    a.download = 'brews.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async e => {
    const file = e.target.files[0];
    if (!file) return;
    let imported;
    try { imported = JSON.parse(await file.text()); } catch { alert('Not valid JSON'); return; }
    if (!validateBrews(imported)) { alert('Not a valid brews.json'); return; }
    setStore(s => ({ ...s, brews: mergeBrews(s.brews, imported) }));
    e.target.value = '';
  };

  return (
    <>
      <header>
        <select value={store.currentId}
                onChange={e => { setStore(s => ({ ...s, currentId: e.target.value })); setView(null); }}>
          {store.brews.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <button onClick={rename} title="Rename brew">✎</button>
        <button onClick={newBrew} title="New brew">＋</button>
      </header>
      <div id="wheelWrap">
        <Wheel cats={cats} fan={fan} hubLabel={view !== null ? view : '☕'}
               onCat={i => setView(v => (v === catNames[i] ? null : catNames[i]))}
               onNote={addNote} onClose={() => setView(null)} />
      </div>
      <div id="chips">
        {cur.notes.map((n, i) => (
          <span key={i} className="chip"
                onClick={() => updateCur(b => ({ ...b, notes: b.notes.filter((_, j) => j !== i) }))}>
            <span className="dot" style={{ background: (flavors[n.category] || {}).color || '#888' }} />
            {n.note}<span className="x">×</span>
          </span>
        ))}
      </div>
      <footer>
        <button onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
        <button onClick={exportJson}>Export</button>
        <button onClick={() => fileRef.current.click()}>Import</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importJson} />
      </footer>
    </>
  );
}
