import { Fragment, useEffect, useRef, useState } from 'react';
import yaml from 'js-yaml';
import {
  SCA_DIMS, validateBrews, newBrewDoc, mergeBrews, loadStore, saveStore, noteColorOf, ink,
} from './lib.js';
import { Wheel } from './wheel.jsx';

// A brew is a file in this fiction, so its name has to survive as one, and the date it was
// brewed is its extension — one filename carries both facts the header used to spread over two.
const iso = ts => new Date(ts).toISOString().slice(0, 10);

// A brew is a file in this fiction, so its name has to survive as one.
const slug = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';

// The coffee line: one field per part, read left to right as "washed natural ethiopia".
const TRIO = [['process', 'Process'], ['origin', 'Origin'], ['varietal', 'Varietal']];

export default function App() {
  const [flavors, setFlavors] = useState(null);
  const [store, setStore] = useState(loadStore);
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
      {/* The top pane of a terminal: session block, then the path of the one file open in it —
          brews/<date>/<name>, each day its own directory. Renaming the cup renames the file. */}
      <div className="pane">
        <span className="app">brews/</span>
        <span className="punc">{iso(cur.createdAt)}/</span>
        {/* contenteditable, not an <input>: an input is single-line by spec, so a long name could
            only scroll or push the row — this wraps like text and the whole bar grows taller.
            Uncontrolled on purpose (keyed by brew, ref sets initial text): feeding the state back
            through React each keystroke resets the caret to the start. */}
        <span className="typing">
          <span className="handle" contentEditable suppressContentEditableWarning
                key={cur._id} role="textbox" aria-label="Brew name"
                ref={el => { if (el && document.activeElement !== el && el.textContent !== cur.name) el.textContent = cur.name; }}
                onInput={e => setField('name', e.currentTarget.textContent.replace(/\n/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
          <span className="cursor" />
        </span>
        {/* the picker is a real <select> laid transparent over the caret: native list on a phone,
            nothing on screen but the glyph */}
        <span className="picker">
          {'\u25be'}
          <select value={store.currentId} aria-label="Open brew"
                  onChange={e => setStore(s => ({ ...s, currentId: e.target.value }))}>
            {store.brews.map(b => (
              <option key={b._id} value={b._id}>{iso(b.createdAt)}/{slug(b.name)}</option>
            ))}
          </select>
        </span>
      </div>

      <div className="actions">
        <button className="act" onClick={() => fileRef.current.click()}>import</button>
        <button className="act" onClick={newBrew}>new</button>
        <button className="act" onClick={copy}>{copied ? 'copied!' : 'copy'}</button>
        <button className="act" onClick={exportJson}>export</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importJson} />
      </div>

      <Wheel key={cur._id} flavors={flavors} notes={cur.notes} intensity={cur.scores.Intensity}
             onAdd={(category, note) =>
               updateCur(b => ({ ...b, notes: [...b.notes, { category, note, ts: new Date().toISOString() }] }))}
             onRemove={i => updateCur(b => ({ ...b, notes: b.notes.filter((_, j) => j !== i) }))} />

      {/* The whole sheet as one function: the coffee is the signature, everything measured about
          the cup is its body. Punctuation is decoration — nothing here is parsed, and every value
          is a plain input sized to what it holds. */}
      <div className="sheet">
        <div className="sig">
          <span className="kw">func</span> coffee(
          {TRIO.map(([k, ph], i) => (
            <Fragment key={k}>
              {i > 0 && ' '}
              {/* argument and its trailing punctuation share a nowrap span: browsers may break a
                  line between two inline-blocks even with no space, which stranded `) {` alone on
                  its own row. Punctuation now travels with its argument. */}
              <span className="arg">
                <input className="field" style={fieldStyle(cur[k], ph, noteCols[i])}
                       value={cur[k]} placeholder={ph}
                       onChange={e => setField(k, e.target.value)} />
                {i < TRIO.length - 1
                  ? <span className="punc">,</span>
                  : <span className="brace">{') {'}</span>}
              </span>
            </Fragment>
          ))}
        </div>

        <div className="body">
          <div className="line">
            <span className="kw">let</span> brew = <input
              className="field" style={fieldStyle(cur.brewMethod, 'V60 1:16', brewCol)}
              value={cur.brewMethod} placeholder="V60 1:16"
              onChange={e => setField('brewMethod', e.target.value)} /><span className="brace">;</span>
          </div>

          {/* scores as a nested block, one key per line. A bar in mono is a grid, so ten cells
              line up under each other without measuring anything. */}
          <div className="scores">
            <div className="line"><span className="kw">let</span> scores = <span className="brace">{'{'}</span></div>
            {SCA_DIMS.map((k, i) => {
              const v = cur.scores[k], col = noteCols[(TRIO.length + 1 + i) % noteCols.length];
              const on = Math.round(v);
              return (
                <div className="score" key={k}>
                  <span className="key">{k.toLowerCase()}</span>
                  <span className="bar">
                    <span style={col ? { color: col } : null}>{'\u2588'.repeat(on)}</span>
                    <span className="rest">{'\u2591'.repeat(10 - on)}</span>
                    {/* the real control, laid transparent over its own drawing: native range keeps
                        the touch behaviour and the keyboard, the glyphs do the looking */}
                    <input type="range" min="0" max="10" step="0.25" value={v} aria-label={k}
                           onChange={e => setField('scores', { ...cur.scores, [k]: +e.target.value })} />
                  </span>
                  <span className="val">{v.toFixed(1)}</span>
                </div>
              );
            })}
            <div className="line"><span className="brace">{'};'}</span></div>
          </div>

          {/* remarks are the comments. The `//` down the gutter is a repeating background, not
              text — the stored remark stays clean prose, so an export never carries syntax. */}
          <div className="remark">
            <textarea rows="2" value={cur.remark} onChange={e => setField('remark', e.target.value)}
                      placeholder="texture, finish, how it changed as it cooled" />
          </div>
        </div>

        <div className="brace">{'}'}</div>
      </div>

    </>
  );
}
