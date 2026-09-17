import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import yaml from 'js-yaml';
import {
  SCA_DIMS, validateBrews, newBrewDoc, mergeBrews, loadStore, saveStore, noteColorOf, ink,
  fingerprintTones, ringOrder, uuid, shades, validateFlavorTree, loadFlavorProfiles, saveFlavorProfiles,
  flavorTreeToDraft, flavorDraftToTree, DEFAULT_FLAVOR_PROFILE_ID,
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

const moved = (items, index, delta) => {
  const next = [...items], target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

const uniqueLabel = (stem, used) => {
  let i = 1, name = stem;
  while (used.has(name)) name = `${stem} ${i++}`;
  return name;
};

// Preview tolerates a half-typed blank or duplicate. Save remains strict.
const previewFlavorTree = families => {
  const tree = {}, usedFamilies = new Set();
  families.forEach((family, fi) => {
    const base = family.name.trim() || `Family ${fi + 1}`;
    const familyName = uniqueLabel(base, usedFamilies); usedFamilies.add(familyName);
    const usedNotes = new Set();
    const notes = family.notes.map((note, ni) => {
      const label = uniqueLabel(note.name.trim() || `note ${ni + 1}`, usedNotes);
      usedNotes.add(label); return label;
    });
    const noteColors = Object.fromEntries(family.notes.flatMap((note, i) => note.color ? [[notes[i], note.color]] : []));
    tree[familyName] = { color: family.color, notes, ...(Object.keys(noteColors).length && { noteColors }) };
  });
  return tree;
};

function SpectrumCard({ brew, flavors, fingerprint, compact = false, onOpen, animated = false }) {
  const press = useRef(null);
  const ring = ringOrder(Object.keys(flavors), flavors);
  const colorOf = (category, note) => noteColorOf(flavors, category, note);
  const fallback = fingerprintTones({ notes: brew.notes, colorOf, ringSegs: ring, cx: 195, cy: 195, r: 195 });
  const fp = fingerprint || fallback;
  const openOnTap = e => {
    const start = press.current;
    if (!start || start.id !== e.pointerId || start.moved) return;
    press.current = null;
    onOpen?.(brew);
  };
  return (
    <article className={'shareCard' + (compact ? ' archiveCard' : '')} style={{ background: fp.baseCol }}
             {...(onOpen && {
               role: 'button', tabIndex: 0,
               onPointerDown: e => { if (e.isPrimary) press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; },
               onPointerMove: e => {
                 const start = press.current;
                 if (start?.id === e.pointerId && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) start.moved = true;
               },
               onPointerCancel: () => { press.current = null; },
               onPointerUp: openOnTap,
               onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(brew); } },
             })}>
      <svg className="cardFingerprint" viewBox="0 0 390 390" preserveAspectRatio="none" aria-hidden="true">
        <Fingerprint cx={195} cy={195} r={195} tones={fp.tones} baseCol={fp.baseCol}
                     sat="saturate(1)" idPrefix={'cardfp-' + brew._id} decorations={false}
                     clipDisc={false} motion={animated} />
      </svg>
      <div className="shareCardShade">
        <div className="shareCardHead"><span className="shareCardDate">{iso(brew.createdAt)}</span></div>
        <h2>{brew.name || 'Untitled brew'}</h2>
        <p className="shareCardMeta">{[brew.process, brew.origin, brew.varietal].filter(Boolean).join(' · ') || 'unclassified coffee'}</p>
        <p className="shareCardNotes">{brew.notes.map(n => n.note).join(' · ') || 'no notes logged'}</p>
        {brew.remark && (
          <p className="shareCardRemark">
            {brew.remark.split('\n').map((line, i) => (
              <Fragment key={i}>{i > 0 && <br />}{line.replace(/^\s*\/\/\s?/, '')}</Fragment>
            ))}
          </p>
        )}
      </div>
    </article>
  );
}

export default function App() {
  const [bundledFlavors, setBundledFlavors] = useState(null);
  const [profileStore, setProfileStore] = useState(loadFlavorProfiles);
  const [store, setStore] = useState(loadStore);
  const [copied, setCopied] = useState(false);
  const [screen, setScreen] = useState('wheel'); // wheel | card | fingerprint | archive | profiles | profile-editor
  const [editingDraft, setEditingDraft] = useState(null);
  const [openFamilies, setOpenFamilies] = useState({});
  const [armedDelete, setArmedDelete] = useState(null);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wheelFingerprint, setWheelFingerprint] = useState(null);
  // one open menu at a time: 'brews' drops the file tree, 'sys' the import/copy/export ops
  const [menu, setMenu] = useState(null);
  // which directories of the file tree are unfolded, keyed '2026', '2026-09', '2026-09-01'
  const [open, setOpen] = useState({});
  const [nameCompact, setNameCompact] = useState(false);
  const fileRef = useRef();
  const profileFileRef = useRef();
  const typingRef = useRef();
  const handleRef = useRef();
  const menuRef = useRef();
  const screenTimer = useRef();
  const archiveRef = useRef();
  const archiveScroll = useRef(0);
  const draftInitial = useRef('');
  const deleteTimer = useRef();

  useEffect(() => {
    fetch('flavors.yaml').then(r => r.text()).then(t => {
      const tree = yaml.load(t);
      if (validateFlavorTree(tree)) setBundledFlavors(tree);
    });
  }, []);
  useEffect(() => saveStore(store), [store]);
  useEffect(() => saveFlavorProfiles(profileStore), [profileStore]);
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const cur = store.brews.find(b => b._id === store.currentId);
  const ran = screen === 'card', fingerprintView = screen === 'fingerprint';
  const browsing = screen === 'archive', managingProfiles = screen === 'profiles';
  const editingProfile = screen === 'profile-editor';
  const localProfile = profileStore.profiles.find(p => p._id === profileStore.activeId);
  const flavors = localProfile?.flavors || bundledFlavors;
  useEffect(() => {
    clearTimeout(screenTimer.current);
    setScreen('wheel'); setWheelFingerprint(null);
  }, [cur?._id]);
  useEffect(() => setWheelFingerprint(null), [profileStore.activeId]);
  useEffect(() => () => {
    clearTimeout(screenTimer.current); clearTimeout(deleteTimer.current);
  }, []);
  useEffect(() => {
    if (menu === 'brews') menuRef.current?.querySelector('.current-date')?.scrollIntoView({ block: 'nearest' });
  }, [menu, cur?.createdAt]);
  useLayoutEffect(() => {
    if (!browsing && !managingProfiles && !editingProfile) return undefined;
    document.activeElement?.blur();
    if (browsing) archiveRef.current.scrollTop = archiveScroll.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [browsing, managingProfiles, editingProfile]);

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
  const spectrumCard = <SpectrumCard brew={cur} flavors={flavors} fingerprint={activeFingerprint} />;
  const openableSpectrumCard = <SpectrumCard brew={cur} flavors={flavors} fingerprint={activeFingerprint}
                                                animated={fingerprintView}
                                                onOpen={() => setScreen(fingerprintView ? 'card' : 'fingerprint')} />;
  const sortedBrews = [...store.brews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const flavorProfiles = [
    { _id: DEFAULT_FLAVOR_PROFILE_ID, name: 'Ajinokopi default', flavors: bundledFlavors, bundled: true },
    ...profileStore.profiles,
  ];
  const draftTree = editingDraft && flavorDraftToTree(editingDraft.families);
  const draftValid = !!(editingDraft?.name.trim() && draftTree);
  const previewTree = editingDraft && previewFlavorTree(editingDraft.families);

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

  const exportCardJpg = async () => {
    const card = document.querySelector('.finalCardOverlay .shareCard');
    if (!card) return;
    await document.fonts?.ready;
    const rect = card.getBoundingClientRect();
    const sourceSvg = card.querySelector('.cardFingerprint').cloneNode(true);
    sourceSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    sourceSvg.setAttribute('width', rect.width);
    sourceSvg.setAttribute('height', rect.height);
    const svgUrl = URL.createObjectURL(new Blob(
      [new XMLSerializer().serializeToString(sourceSvg)], { type: 'image/svg+xml;charset=utf-8' }
    ));
    const image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve; image.onerror = reject; image.src = svgUrl;
      });
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = getComputedStyle(card).backgroundColor;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(image, 0, 0, rect.width, rect.height);

      const drawText = el => {
        if (!el) return;
        const box = el.getBoundingClientRect(), style = getComputedStyle(el);
        const size = parseFloat(style.fontSize), lineHeight = parseFloat(style.lineHeight) || size * 1.2;
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color; ctx.textBaseline = 'top';
        const x = box.left - rect.left, maxWidth = box.width;
        let y = box.top - rect.top;
        (el.innerText || el.textContent).split('\n').forEach(paragraph => {
          let line = '';
          paragraph.split(/\s+/).filter(Boolean).forEach(word => {
            const next = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(next).width > maxWidth) {
              ctx.fillText(line, x, y); y += lineHeight; line = word;
            } else line = next;
          });
          if (line) ctx.fillText(line, x, y);
          y += lineHeight;
        });
      };
      ['.shareCardDate', 'h2', '.shareCardMeta', '.shareCardNotes', '.shareCardRemark']
        .forEach(selector => drawText(card.querySelector(selector)));

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.94));
      if (!blob) throw new Error('JPEG export failed');
      const filename = `${slug(cur.name)}-fingerprint.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: cur.name || 'Coffee fingerprint' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 0);
      }
    } catch (error) {
      if (error.name !== 'AbortError') alert('Could not save this fingerprint as JPG');
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
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

  const importFlavorProfile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = yaml.load(await file.text());
      const tree = parsed?.flavors || parsed;
      if (!validateFlavorTree(tree)) throw new Error('schema');
      const fallbackName = file.name.replace(/\.(ya?ml|json)$/i, '') || 'Imported profile';
      const profile = {
        _id: uuid(),
        name: typeof parsed?.name === 'string' && parsed.name.trim() ? parsed.name.trim() : fallbackName,
        flavors: tree, fileName: file.name, importedAt: new Date().toISOString(),
      };
      setProfileStore(s => ({ profiles: [...s.profiles, profile], activeId: profile._id }));
    } catch {
      alert('Not a valid flavor profile');
    }
    e.target.value = '';
  };

  const exportFlavorProfile = async profile => {
    const body = JSON.stringify({ name: profile.name, flavors: profile.flavors }, null, 2);
    const filename = `${slug(profile.name)}.json`;
    const blob = new Blob([body], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: profile.name }); } catch (error) {
        if (error.name !== 'AbortError') alert('Could not share this flavor profile');
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const selectFlavorProfile = id => {
    localStorage.setItem('activeFlavorProfileId', id);
    setProfileStore(s => ({ ...s, activeId: id }));
  };

  const rmFlavorProfile = profile => {
    if (!window.confirm(`rm ${slug(profile.name)} — delete this flavor profile?`)) return;
    setProfileStore(s => ({
      profiles: s.profiles.filter(p => p._id !== profile._id),
      activeId: s.activeId === profile._id ? DEFAULT_FLAVOR_PROFILE_ID : s.activeId,
    }));
  };

  const startProfileEditor = (profile, copy = false, name) => {
    const draft = {
      _id: copy ? uuid() : profile._id,
      name: name || (copy ? `${profile.name} copy` : profile.name),
      families: flavorTreeToDraft(profile.flavors), isNew: copy,
    };
    draftInitial.current = JSON.stringify(draft);
    setEditingDraft(draft); setOpenFamilies({}); setArmedDelete(null); setScreen('profile-editor');
  };

  const cancelProfileEditor = () => {
    if (JSON.stringify(editingDraft) !== draftInitial.current && !window.confirm('Discard flavor profile edits?')) return;
    setEditingDraft(null); setScreen('profiles');
  };

  const saveProfileDraft = () => {
    if (!draftValid) return;
    const saved = {
      _id: editingDraft._id, name: editingDraft.name.trim(), flavors: draftTree,
      updatedAt: new Date().toISOString(),
    };
    setProfileStore(s => ({
      profiles: s.profiles.some(p => p._id === saved._id)
        ? s.profiles.map(p => p._id === saved._id ? { ...p, ...saved } : p)
        : [...s.profiles, saved],
      activeId: saved._id,
    }));
    setEditingDraft(null); setScreen('profiles');
  };

  const updateFamily = (index, change) => setEditingDraft(d => ({
    ...d, families: d.families.map((family, i) => i === index ? change(family) : family),
  }));
  const updateNote = (familyIndex, noteIndex, change) => updateFamily(familyIndex, family => ({
    ...family, notes: family.notes.map((note, i) => i === noteIndex ? change(note) : note),
  }));
  const armDelete = (key, remove) => {
    clearTimeout(deleteTimer.current);
    if (armedDelete === key) { setArmedDelete(null); remove(); return; }
    setArmedDelete(key);
    deleteTimer.current = setTimeout(() => setArmedDelete(null), 3500);
  };

  const addFamily = () => {
    const used = new Set(editingDraft.families.map(f => f.name));
    const name = uniqueLabel('New family', used), key = uuid();
    setEditingDraft(d => ({ ...d, families: [...d.families, {
      _key: key, name, color: '#d9a066', notes: [{ _key: uuid(), name: 'note 1', color: null }],
    }] }));
    setOpenFamilies(o => ({ ...o, [key]: true }));
  };

  const addNote = familyIndex => updateFamily(familyIndex, family => {
    const name = uniqueLabel('new note', new Set(family.notes.map(n => n.name)));
    return { ...family, groups: undefined, notes: [...family.notes, { _key: uuid(), name, color: null }] };
  });

  return (
    <div className={'appShell' + ((browsing || managingProfiles || editingProfile) ? ' archiveMode' : '') + (fingerprintView ? ' fingerprintCardMode' : '')}>
      {/* The top pane of a terminal: session block, then the path of the one file open in it —
          brews/<date>/<name>, each day its own directory. Renaming the cup renames the file. */}
      <header className={'pane' + ((browsing || managingProfiles || editingProfile) ? ' browsing' : '') + ((ran || fingerprintView || browsing || managingProfiles || editingProfile) ? ' overlayScreen' : '') + (fingerprintView ? ' fingerprintCardHeader' : '') + (managingProfiles ? ' profileManagerHeader' : '') + (editingProfile ? ' profileEditorHeader' : '')}>
        {editingProfile ? (
          <>
            <button className="peCancel" onClick={cancelProfileEditor}>&lt; cancel</button>
            <input className="peProfileName" value={editingDraft.name} aria-label="Flavor profile name"
                   onChange={e => setEditingDraft(d => ({ ...d, name: e.target.value }))} />
            <button className="peSave" disabled={!draftValid} onClick={saveProfileDraft}>save</button>
          </>
        ) : (browsing || managingProfiles) ? (
          <button className="archivePaneBack" onClick={() => {
            if (browsing) archiveScroll.current = archiveRef.current?.scrollTop || 0;
            setScreen('wheel');
          }}>&lt; back to wheel + terminal</button>
        ) : <>
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
            <button className="row" onClick={() => { setScreen('profiles'); setMenu(null); }}>flavor profiles...</button>
            <button className="row" onClick={() => { fileRef.current.click(); setMenu(null); }}>import</button>
            <button className="row" onClick={copy}>{copied ? 'copied!' : 'copy'}</button>
            <button className="row" onClick={() => { exportJson(); setMenu(null); }}>export</button>
            <button className="row rm" onClick={rmBrew}>rm {slug(cur.name)}</button>
          </div>
        )}
        </>}
      </header>

      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importJson} />
      <input ref={profileFileRef} type="file"
             accept=".yaml,.yml,.json,application/yaml,application/json,text/yaml,text/x-yaml,application/x-yaml,text/plain"
             hidden onChange={importFlavorProfile} />

      {browsing ? (
        <main className="archiveScreen" ref={archiveRef}
              onScroll={e => { archiveScroll.current = e.currentTarget.scrollTop; }}>
          {sortedBrews.map(b => (
            <SpectrumCard key={b._id} brew={b} flavors={flavors} compact
                          onOpen={brew => {
                            archiveScroll.current = archiveRef.current?.scrollTop || 0;
                            setStore(s => ({ ...s, currentId: brew._id }));
                            setScreen('wheel');
                          }} />
          ))}
        </main>
      ) : managingProfiles ? (
        <main className="profilesScreen">
          <div className="profilesTitle">~/flavor-profiles</div>
          <p className="profilesHelp">select bundled wheel or import YAML / JSON from this browser</p>
          <div className="profileList">
            {flavorProfiles.map(profile => {
              const familyCount = Object.keys(profile.flavors).length;
              const noteCount = Object.values(profile.flavors).reduce((n, family) => n + family.notes.length, 0);
              const active = profile._id === profileStore.activeId;
              return (
                <div className={'profileRow' + (active ? ' active' : '')} key={profile._id}>
                  <button className="profilePick" aria-pressed={active}
                          onClick={() => selectFlavorProfile(profile._id)}>
                    <span>{active ? '[x]' : '[ ]'} {profile.name}</span>
                    <small>{profile.bundled ? 'bundled' : 'browser'} · {familyCount} families · {noteCount} notes</small>
                  </button>
                  <button className="profileAction" onClick={() => startProfileEditor(profile, profile.bundled)}>
                    {profile.bundled ? 'copy + edit' : 'edit'}
                  </button>
                  <button className="profileAction" onClick={() => exportFlavorProfile(profile)}>export</button>
                  {!profile.bundled && <button className="profileAction rm" onClick={() => rmFlavorProfile(profile)}>rm</button>}
                </div>
              );
            })}
          </div>
          <div className="profileCreateActions">
            <button className="importProfile" onClick={() => startProfileEditor(flavorProfiles[0], true, 'Custom profile')}>+ new profile</button>
            <button className="importProfile" onClick={() => profileFileRef.current?.click()}>+ import profile...</button>
          </div>
        </main>
      ) : editingProfile ? (
        <main className="profileEditorScreen">
          <section className="peStage" aria-label="Live flavor wheel preview">
            <Wheel key={JSON.stringify(previewTree)} flavors={previewTree} notes={[]} intensity={5}
                   onAdd={() => {}} onRemove={() => {}} />
          </section>
          <section className="peDeck">
            <div className="peDeckIntro">
              <h1>Customize your flavor wheel</h1>
              {!draftValid && <p className="peError">Names must be filled and unique before saving.</p>}
            </div>
            {editingDraft.families.map((family, fi) => {
              const expanded = !!openFamilies[family._key];
              return (
                <article className="peFamilyCard" key={family._key}>
                  <div className="peFamilyMain">
                    <label className="peColorWell" style={{ background: family.color }}>
                      <span className="srOnly">Color for {family.name || `family ${fi + 1}`}</span>
                      <input type="color" value={family.color}
                             onChange={e => updateFamily(fi, f => ({ ...f, color: e.target.value }))} />
                    </label>
                    <input className="peName" value={family.name} aria-label={`Family ${fi + 1} name`}
                           onChange={e => updateFamily(fi, f => ({ ...f, name: e.target.value }))} />
                    <span className="peCount">{family.notes.length}</span>
                    <button className="peIcon" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${family.name}`}
                            onClick={() => setOpenFamilies(o => ({ ...o, [family._key]: !expanded }))}>
                      {expanded ? '▾' : '▸'}
                    </button>
                  </div>
                  <div className="peFamilyTools">
                    <button disabled={fi === 0} onClick={() => setEditingDraft(d => ({ ...d, families: moved(d.families, fi, -1) }))}>↑ move</button>
                    <button disabled={fi === editingDraft.families.length - 1}
                            onClick={() => setEditingDraft(d => ({ ...d, families: moved(d.families, fi, 1) }))}>↓ move</button>
                    <button className={armedDelete === `family:${family._key}` ? 'armed' : ''}
                            disabled={editingDraft.families.length === 1}
                            onClick={() => armDelete(`family:${family._key}`, () =>
                              setEditingDraft(d => ({ ...d, families: d.families.filter(f => f._key !== family._key) })))}>
                      {armedDelete === `family:${family._key}` ? 'confirm?' : 'remove'}
                    </button>
                  </div>
                  {expanded && (
                    <div className="peNotes">
                      {family.notes.map((note, ni) => {
                        const inherited = shades(family.color, family.notes.length)[ni];
                        return (
                          <div className="peNote" key={note._key}>
                            <div className="peNoteMain">
                              <label className="peColorWell note" style={{ background: note.color || inherited }}>
                                <span className="srOnly">Color for {note.name || `note ${ni + 1}`}</span>
                                <input type="color" value={note.color || inherited}
                                       onChange={e => updateNote(fi, ni, n => ({ ...n, color: e.target.value }))} />
                              </label>
                              <input className="peName" value={note.name} aria-label={`Note ${ni + 1} name`}
                                     onChange={e => updateNote(fi, ni, n => ({ ...n, name: e.target.value }))} />
                              <button className={'peNoteRemove' + (armedDelete === `note:${note._key}` ? ' armed' : '')}
                                      disabled={family.notes.length === 1}
                                      onClick={() => armDelete(`note:${note._key}`, () => updateFamily(fi, f => ({
                                        ...f, groups: undefined, notes: f.notes.filter(n => n._key !== note._key),
                                      })))}>
                                {armedDelete === `note:${note._key}` ? 'confirm?' : 'remove'}
                              </button>
                            </div>
                            <div className="peNoteTools">
                              <button disabled={ni === 0} onClick={() => updateFamily(fi, f => ({ ...f, notes: moved(f.notes, ni, -1) }))}>↑</button>
                              <button disabled={ni === family.notes.length - 1}
                                      onClick={() => updateFamily(fi, f => ({ ...f, notes: moved(f.notes, ni, 1) }))}>↓</button>
                            </div>
                          </div>
                        );
                      })}
                      <button className="peAdd" onClick={() => addNote(fi)}>+ add note</button>
                    </div>
                  )}
                </article>
              );
            })}
            <button className="peAdd family" onClick={addFamily}>+ add family</button>
          </section>
        </main>
      ) : (
      <main className={'workspace' + ((ran || fingerprintView) ? ' resultMode' : '') + (running ? ' running' : '')}>
      <section className="wheelStage">
        <Wheel key={`${cur._id}:${profileStore.activeId}`} flavors={flavors} notes={cur.notes} intensity={cur.scores.Intensity}
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
        {(ran || fingerprintView) && <div className="runCardOverlay finalCardOverlay">{openableSpectrumCard}</div>}
        {fingerprintView && <button className="saveFingerprint" onClick={exportCardJpg}>save jpg</button>}
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

      <div className="editorActions">
        <button className="browseBrews" onClick={() => {
          clearTimeout(screenTimer.current);
          if (browsing) setScreen('wheel');
          else { setScreen('archive'); setRunning(false); }
        }}>&lt; list of brews</button>
        <button className={'run' + (ran ? ' edit' : '')} onClick={() => {
          if (ran) {
            clearTimeout(screenTimer.current);
            setScreen('wheel'); setRestoring(true);
            screenTimer.current = setTimeout(() => setRestoring(false), 650);
          } else {
            clearTimeout(screenTimer.current);
            document.activeElement?.blur();
            window.scrollTo(0, 0);
            setScreen('wheel'); setRunning(true);
            screenTimer.current = setTimeout(() => { setRunning(false); setScreen('card'); }, 650);
          }
        }}>{ran ? 'edit' : running ? 'running...' : 'run'}</button>
      </div>
      </div>
      </main>
      )}
    </div>
  );
}
