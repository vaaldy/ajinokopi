import { Fragment, useEffect, useRef, useState } from 'react';
import yaml from 'js-yaml';
import {
  SCA_DIMS, validateBrews, newBrewDoc, mergeBrews, loadStore, saveStore, noteColorOf, ink,
} from './lib.js';
import { Wheel } from './wheel.jsx';

// The coffee line: one field per part, read left to right as "washed natural ethiopia".
const TRIO = [['process', 'Process'], ['origin', 'Origin'], ['varietal', 'Varietal']];

export default function App() {
  const [flavors, setFlavors] = useState(null);
  const [store, setStore] = useState(loadStore);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    fetch('flavors.yaml').then(r => r.text()).then(t => setFlavors(yaml.load(t)));
  }, []);
  useEffect(() => saveStore(store), [store]);

  if (!flavors) return null;

  const cur = store.brews.find(b => b._id === store.currentId);
  const updateCur = fn =>
    setStore(s => ({ ...s, brews: s.brews.map(b => (b._id === s.currentId ? fn(b) : b)) }));
  const setField = (k, v) => updateCur(b => ({ ...b, [k]: v }));

  // Each part of the coffee line wears one of this cup's own note colours — first logged note to
  // process, second to origin, third to varietal, cycling when fewer than three are logged. No
  // notes yet, no highlight: there is nothing to borrow a colour from.
  const noteCols = TRIO.map((_, i) => {
    const n = cur.notes[i % cur.notes.length];
    return n && noteColorOf(flavors, n.category, n.note);
  });
  // Brew continues the cycle, but the cycle is only ever as long as the coffee line: with four
  // notes logged the coffee line shows three colours, and brew reuses one of those rather than
  // bringing a fourth on screen that nothing above it matches.
  const brewCol = noteCols[TRIO.length % noteCols.length];

  // Every field is as wide as what it holds (mono, so a char count is a width; +6px is the
  // highlight's own padding) and wears its note colour once it has something to show.
  const fieldStyle = (v, ph, col) => ({
    width: `calc(${Math.max(1, (v || ph).length)}ch + 6px)`,
    ...(v && col && { background: col, color: ink(col) }),
  });

  const newBrew = () => {
    const b = newBrewDoc('Untitled brew');
    setStore(s => ({ brews: [...s.brews, b], currentId: b._id }));
    setEditing(true);
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
    // named for the cup on screen + when it was dumped, so two exports never collide in ~/Downloads
    const p2 = n => String(n).padStart(2, '0'), d = new Date();
    const stamp = [d.getDate(), d.getMonth() + 1, d.getHours(), d.getMinutes()].map(p2).join('-');
    const name = (cur?.name || 'brews').replace(/[^\w -]+/g, '').trim() || 'brews';
    a.download = `${name} ${stamp}.json`;
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
        <div className="who">
          {editing
            ? <input className="title" value={cur.name} autoFocus
                     onChange={e => setField('name', e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }}
                     onBlur={() => setEditing(false)} />
            : <span className="title">{cur.name}</span>}
          <span className="date">
            {new Date(cur.createdAt).toLocaleDateString(undefined,
              { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <button className="icon" title="Rename" onClick={() => setEditing(t => !t)}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </header>

      <Wheel key={cur._id} flavors={flavors} notes={cur.notes} intensity={cur.scores.Intensity}
             onAdd={(category, note) =>
               updateCur(b => ({ ...b, notes: [...b.notes, { category, note, ts: new Date().toISOString() }] }))}
             onRemove={i => updateCur(b => ({ ...b, notes: b.notes.filter((_, j) => j !== i) }))} />

      <div className="sheet">
        <div className="pair one">
          <label><span className="name">coffee:</span>
            {/* three fields, one line: process, origin and varietal read as a line off a bag,
                braced like a block of code. The braces stretch to however many rows it wraps to. */}
            <div className="trio">
              {TRIO.map(([k, ph], i) => (
                <Fragment key={k}>
                  {/* comma hugs the field before it, then a real space — a real one, because two
                      inline-blocks with only margin between them give the row nowhere to wrap */}
                  {i > 0 && <><span className="sep">,</span>{' '}</>}
                  {/* `ch` width, not the `size` attribute: `size` pads by a couple of characters
                      per field, enough slack to push the empty row onto a second line */}
                  <input style={fieldStyle(cur[k], ph, noteCols[i])}
                         value={cur[k]} placeholder={ph}
                         onChange={e => setField(k, e.target.value)} />
                </Fragment>
              ))}
            </div>
          </label>
        </div>
        <div className="pair one">
          <label><span className="name">brew:</span>
            <div className="trio">
              <input style={fieldStyle(cur.brewMethod, 'V60 1:16', brewCol)}
                     value={cur.brewMethod} placeholder="V60 1:16"
                     onChange={e => setField('brewMethod', e.target.value)} />
            </div>
          </label>
        </div>
        {/* the scores as a nested block: one key per line, indented under their own brace. A bar
            in mono is a grid, so ten cells line up under each other without measuring anything. */}
        <div className="pair one">
          <label><span className="name">scores:</span>
            <div className="trio scores">
              {SCA_DIMS.map((k, i) => {
                const v = cur.scores[k], col = noteCols[(TRIO.length + 1 + i) % noteCols.length];
                const on = Math.round(v);
                return (
                  <div className="score" key={k}>
                    <span className="key">{k.toLowerCase()}</span>
                    <span className="bar">
                      <span style={col ? { color: col } : null}>{'\u2588'.repeat(on)}</span>
                      <span className="rest">{'\u2591'.repeat(10 - on)}</span>
                      {/* the real control, laid transparent over its own drawing: native range
                          keeps the touch behaviour and the keyboard, the glyphs do the looking */}
                      <input type="range" min="0" max="10" step="0.25" value={v} aria-label={k}
                             onChange={e => setField('scores', { ...cur.scores, [k]: +e.target.value })} />
                    </span>
                    <span className="val">{v.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </label>
        </div>
        <div className="remark">
          <textarea rows="2" value={cur.remark} onChange={e => setField('remark', e.target.value)}
                    placeholder="Remarks — texture, finish, how it changed as it cooled…" />
        </div>
      </div>

      <footer>
        <select value={store.currentId}
                onChange={e => setStore(s => ({ ...s, currentId: e.target.value }))}>
          {store.brews.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <button onClick={newBrew} title="New brew">＋</button>
        <button onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
        <button onClick={exportJson}>Export</button>
        <button onClick={() => fileRef.current.click()}>Import</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importJson} />
      </footer>
    </>
  );
}
