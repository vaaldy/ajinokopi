import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import yaml from 'js-yaml';
import {
  SCA_DIMS, validateBrews, newBrewDoc, mergeBrews, loadStore, saveStore, noteColorOf, ink,
  fingerprintTones, ringOrder,
} from './lib.js';
import { Fingerprint, Wheel } from './wheel.jsx';

// A brew is a file in this fiction, so its name has to survive as one, and the date it was
// brewed is its extension — one filename carries both facts the header used to spread over two.
const iso = ts => new Date(ts).toISOString().slice(0, 10);

// A brew is a file in this fiction, so its name has to survive as one.
const slug = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';

// The file tree as a flat row list: year > month > day > coffees, newest first, folded branches
// contribute nothing. Rows carry their depth; the renderer only indents and draws.
function brewRows(brews, open) {
  const tree = {};
  brews.forEach(b => {
    const [y, m, d] = iso(b.createdAt).split('-');
    (((tree[y] ??= {})[m] ??= {})[d] ??= []).push(b);
  });
  const newest = o => Object.keys(o).sort().reverse();
  const rows = [];
  newest(tree).forEach(y => {
    rows.push({ k: y, lvl: 0, label: y + '/' });
    if (!open[y]) return;
    newest(tree[y]).forEach(m => {
      rows.push({ k: `${y}-${m}`, lvl: 1, label: m + '/' });
      if (!open[`${y}-${m}`]) return;
      newest(tree[y][m]).forEach(d => {
        rows.push({ k: `${y}-${m}-${d}`, lvl: 2, label: d + '/' });
        if (!open[`${y}-${m}-${d}`]) return;
        tree[y][m][d].forEach(b => rows.push({ b, lvl: 3 }));
      });
    });
  });
  return rows;
}

// The coffee line: one field per part, read left to right as "washed natural ethiopia".
const TRIO = [['process', 'Process'], ['origin', 'Origin'], ['varietal', 'Varietal']];

export default function App() {
  const [flavors, setFlavors] = useState(null);
  const [store, setStore] = useState(loadStore);
  const [copied, setCopied] = useState(false);
  const [ran, setRan] = useState(false);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wheelFingerprint, setWheelFingerprint] = useState(null);
  // one open menu at a time: 'brews' drops the file tree, 'sys' the import/copy/export ops
  const [menu, setMenu] = useState(null);
  // which directories of the file tree are unfolded, keyed '2026', '2026-09', '2026-09-01'
  const [open, setOpen] = useState({});
  const [nameCompact, setNameCompact] = useState(false);
  const fileRef = useRef();
  const typingRef = useRef();
  const handleRef = useRef();
  const menuRef = useRef();

  useEffect(() => {
    fetch('flavors.yaml').then(r => r.text()).then(t => setFlavors(yaml.load(t)));
  }, []);
  useEffect(() => saveStore(store), [store]);
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const cur = store.brews.find(b => b._id === store.currentId);
  useEffect(() => { setRan(false); setWheelFingerprint(null); }, [cur?._id]);
  useEffect(() => {
    if (menu === 'brews') menuRef.current?.querySelector('.current-date')?.scrollIntoView({ block: 'nearest' });
  }, [menu, cur?.createdAt]);

  useLayoutEffect(() => {
    const cell = typingRef.current;
    if (!cell || !cur) return undefined;
    const fitName = () => {
      // Measure the default size even when the previous render was compact. React state only
      // changes when the result changes, so the measurement cannot oscillate on resize.
      const compact = cell.classList.contains('compact');
      if (compact) cell.classList.remove('compact');
      const overflows = cell.scrollWidth > cell.clientWidth;
      if (compact) cell.classList.add('compact');
      setNameCompact(prev => (prev === overflows ? prev : overflows));
    };
    fitName();
    const observer = new ResizeObserver(fitName);
    observer.observe(cell);
    return () => observer.disconnect();
  }, [flavors, cur?._id, cur?.name]);

  if (!flavors) return null;

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
  const cardRing = ringOrder(Object.keys(flavors), flavors);
  const cardColorOf = (category, note) => noteColorOf(flavors, category, note);
  const { tones: cardTones, baseCol: cardBase } = fingerprintTones({
    notes: cur.notes, colorOf: cardColorOf, ringSegs: cardRing, cx: 195, cy: 195, r: 195,
  });
  const activeFingerprint = wheelFingerprint || { tones: cardTones, baseCol: cardBase };
  const spectrumCard = (
    <article className="shareCard" style={{ background: activeFingerprint.baseCol }}>
      <svg className="cardFingerprint" viewBox="0 0 390 390" preserveAspectRatio="none" aria-hidden="true">
        <Fingerprint cx={195} cy={195} r={195} tones={activeFingerprint.tones} baseCol={activeFingerprint.baseCol}
                     sat="saturate(1)" idPrefix="cardfp" decorations={false} clipDisc={false} />
      </svg>
      <div className="shareCardShade">
        <div className="shareCardHead">
          <span className="shareCardDate">{iso(cur.createdAt)}</span>
        </div>
        <h2>{cur.name || 'Untitled brew'}</h2>
        <p className="shareCardMeta">{[cur.process, cur.origin, cur.varietal].filter(Boolean).join(' · ') || 'unclassified coffee'}</p>
        <p className="shareCardNotes">{cur.notes.map(n => n.note).join(' · ') || 'no notes logged'}</p>
        {cur.remark && (
          <p className="shareCardRemark">
            {cur.remark.split('\n').map((line, i) => (
              <Fragment key={i}>{i > 0 && <br />}{line.replace(/^\s*\/\/\s?/, '')}</Fragment>
            ))}
          </p>
        )}
      </div>
    </article>
  );

  // Every field is as wide as what it holds (mono, so a char count is a width; +6px is the
  // highlight's own padding) and wears its note colour once it has something to show.
  const fieldStyle = (v, ph, col) => ({
    width: `calc(${Math.max(1, (v || ph).length)}ch + 6px)`,
    ...(v && col && { background: col, color: ink(col) }),
  });

  const toggleBrews = () => {
    const opening = menu !== 'brews';
    if (opening) {
      const [y, m, d] = iso(cur.createdAt).split('-');
      setOpen({ [y]: true, [`${y}-${m}`]: true, [`${y}-${m}-${d}`]: true });
    }
    setMenu(opening ? 'brews' : null);
  };

  const rmBrew = () => {
    // native confirm: one mistap here erases a cup's notes, and the fiction does not get to
    // outrank a real guard
    if (!window.confirm(`rm ${slug(cur.name)} — delete this brew?`)) return;
    setStore(s => {
      const brews = s.brews.filter(b => b._id !== s.currentId);
      if (!brews.length) { const b = newBrewDoc('Untitled brew'); return { brews: [b], currentId: b._id }; }
      return { brews, currentId: brews[0]._id };
    });
    setMenu(null);
  };

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
        {/* the session block doubles as the system menu: tap it for the ops that act on the
            whole store rather than on one cup */}
        <button className="app act" aria-label="System menu" aria-expanded={menu === 'sys'}
                onClick={() => setMenu(m => (m === 'sys' ? null : 'sys'))}>/</button>
        <button className="datePicker punc" aria-label="Open date explorer" onClick={toggleBrews}>
          {iso(cur.createdAt)}/
        </button>
        {/* contenteditable, not an <input>: keeps the filename editable without React resetting
            the caret on every keystroke. The topbar stays one line; long names get a compact class.
            Uncontrolled on purpose (keyed by brew, ref sets initial text). */}
        <span ref={typingRef} className={'typing' + (nameCompact ? ' compact' : '')}
              onClick={() => handleRef.current?.focus()}>
          <span className="handle" contentEditable suppressContentEditableWarning
                key={cur._id} role="textbox" aria-label="Brew name"
                ref={el => {
                  handleRef.current = el;
                  if (el && document.activeElement !== el && el.textContent !== cur.name) el.textContent = cur.name;
                }}
                onInput={e => setField('name', e.currentTarget.textContent.replace(/\n/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
          <span className="cursor" />
        </span>
        {/* our own menu, not a <select>: the popup a select opens is OS-rendered and CSS cannot
            reach it, and this one should read as a completion list dropping out of the bar */}
        <button className="picker" aria-label="Open brew" aria-expanded={menu === 'brews'}
                onClick={toggleBrews}>{'\u25be'}</button>
        {/* same action as "+ new file..." in the tree, one tap instead of two */}
        <button className="picker" aria-label="New brew"
                onClick={() => { newBrew(); setMenu(null); }}>+</button>
        {menu === 'brews' && (
          <div className="menu" role="listbox" ref={menuRef}>
            {brewRows(store.brews, open).map(r =>
              r.b ? (
                <button key={r.b._id} role="option" aria-selected={r.b._id === store.currentId}
                        className={'row' + (r.b._id === store.currentId ? ' cur' : '')}
                        style={{ paddingLeft: `calc(14px + ${r.lvl * 2}ch)` }}
                        onClick={() => { setStore(s => ({ ...s, currentId: r.b._id })); setMenu(null); }}>
                  {slug(r.b.name)}
                </button>
              ) : (
                <button key={r.k} className={'row' + (r.k === iso(cur.createdAt) ? ' current-date' : '')}
                        style={{ paddingLeft: `calc(14px + ${r.lvl * 2}ch)` }}
                        onClick={() => setOpen(o => ({ ...o, [r.k]: !o[r.k] }))}>
                  {r.label}{open[r.k] ? '' : ' \u25b8'}
                </button>
              ))}
            <button className="row dim" onClick={() => { newBrew(); setMenu(null); }}>
              + new file...
            </button>
          </div>
        )}
        {menu === 'sys' && (
          <div className="menu">
            <button className="row" onClick={() => { fileRef.current.click(); setMenu(null); }}>import</button>
            <button className="row" onClick={copy}>{copied ? 'copied!' : 'copy'}</button>
            <button className="row" onClick={() => { exportJson(); setMenu(null); }}>export</button>
            <button className="row rm" onClick={rmBrew}>rm {slug(cur.name)}</button>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importJson} />

      <main className={'workspace' + (ran ? ' resultMode' : '')}>
      <section className="wheelStage">
        <Wheel key={cur._id} flavors={flavors} notes={cur.notes} intensity={cur.scores.Intensity}
               runAway={running} returning={restoring}
               onFingerprint={({ tones, baseCol, hubR, cx, cy }) => setWheelFingerprint(prev => {
                 const scale = 195 / hubR;
                 const next = {
                   baseCol,
                   tones: tones.map(t => ({ ...t, d: t.d * scale, R: t.R * scale,
                     bx: 195 + (t.bx - cx) * scale, by: 195 + (t.by - cy) * scale }))
                 };
                 return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
               })}
               onAdd={(category, note) =>
                 updateCur(b => ({ ...b, notes: [...b.notes, { category, note, ts: new Date().toISOString() }] }))}
               onRemove={i => updateCur(b => ({ ...b, notes: b.notes.filter((_, j) => j !== i) }))} />
        {running && <div className="runCardOverlay">{spectrumCard}</div>}
        {ran && <div className="runCardOverlay finalCardOverlay">{spectrumCard}</div>}
      </section>

      {/* The whole sheet as one function: the coffee is the signature, everything measured about
          the cup is its body. Punctuation is decoration — nothing here is parsed, and every value
          is a plain input sized to what it holds. */}
      <div className="editor">
      <div className="sheet" data-title={`~/brews/${iso(cur.createdAt)}/${slug(cur.name)}`}>
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
            {/* auto-grows to content: height reset then set to scrollHeight on every change,
                keyed by brew so switching cups re-measures. The // gutter is a repeat-y
                background, so each new line picks up its slashes for free. */}
            <textarea rows="2" key={cur._id} value={cur.remark}
                      ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                      onChange={e => {
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                        setField('remark', e.target.value);
                      }}
                      placeholder="texture, finish, how it changed as it cooled" />
          </div>
        </div>

        <div className="brace">{'}'}</div>
      </div>

      <button className={'run' + (ran ? ' edit' : '')} onClick={() => {
        if (ran) {
          setRan(false); setRestoring(true);
          setTimeout(() => setRestoring(false), 650);
        } else {
          setRunning(true); setTimeout(() => { setRunning(false); setRan(true); }, 650);
        }
      }}>{ran ? 'edit' : running ? 'running...' : 'run'}</button>
      </div>
      </main>
    </>
  );
}
