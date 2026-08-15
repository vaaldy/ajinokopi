import { useEffect, useRef, useState } from 'react';
import yaml from 'js-yaml';
import { SCA_DIMS, validateBrews, newBrewDoc, mergeBrews, loadStore, saveStore } from './lib.js';
import { Wheel } from './wheel.jsx';

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
        {editing
          ? <input className="title" value={cur.name} autoFocus
                   onChange={e => setField('name', e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }}
                   onBlur={() => setEditing(false)} />
          : <span className="title">{cur.name}</span>}
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
        <div className="pair">
          <label>Origin
            <input value={cur.origin} placeholder="Nyeri, KE" onChange={e => setField('origin', e.target.value)} />
          </label>
          <label>Method
            <input value={cur.brewMethod} placeholder="V60 · 1:16" onChange={e => setField('brewMethod', e.target.value)} />
          </label>
        </div>
        <div className="sliders">
          {SCA_DIMS.map(k => (
            <div className="slider" key={k}>
              <span className="name">{k}</span>
              <input type="range" min="0" max="10" step="0.25" value={cur.scores[k]}
                     onChange={e => setField('scores', { ...cur.scores, [k]: +e.target.value })} />
              <span className="val">{cur.scores[k].toFixed(1)}</span>
            </div>
          ))}
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
