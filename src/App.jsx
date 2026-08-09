import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient.js';
import PENELOPE_SCHEDULE from './data/penelopeSchedule.json';
import AUBREY_SCHEDULE from './data/aubreySchedule.json';

const PRESET_SCHEDULES = {
  penelope: PENELOPE_SCHEDULE,
  aubrey: AUBREY_SCHEDULE,
};

const EMPTY_SCHEDULE = { days: [], elaLessons: {}, mathLessons: {}, totalHistoryDays: 0 };

const PALETTE = ['#3D6E99', '#4C7A5B', '#B9863A', '#8A5A9C', '#C1554D', '#4A7C82', '#A16E4B'];

const SUBJECT_COLORS = {
  ELA: '#3D6E99',
  MATH: '#4C7A5B',
  IXL: '#8A5A9C',
  HISTORY: '#B9863A',
  REVIEW: '#8C8570',
  'SOC ST': '#A16E4B',
  SCIENCE: '#4A7C82',
};

function initials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ============================================================
// Auth screen — one shared family login
// ============================================================
function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError('Account created! Check your email to confirm, then sign in.');
        setMode('signin');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-root">
      <style>{globalStyles}</style>
      <div className="auth-card">
        <div className="auth-title font-display">Family Homeschool Planner</div>
        <div className="auth-sub">
          {mode === 'signin' ? 'Sign in with your family account' : 'Create your family account'}
        </div>
        <form onSubmit={submit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary" style={{ width: '100%', padding: '11px 0', marginTop: 6 }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div className="auth-toggle">
          {mode === 'signin' ? (
            <>First time? <a onClick={() => setMode('signup')}>Create the family account</a></>
          ) : (
            <>Already set up? <a onClick={() => setMode('signin')}>Sign in</a></>
          )}
        </div>
        <div className="auth-hint">
          Everyone in the family uses this same email &amp; password on their own device — that's what keeps everyone's checkmarks in sync.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main planner (shown once signed in)
// ============================================================
function Planner({ session }) {
  const [students, setStudents] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [completion, setCompletion] = useState({});
  const [notes, setNotes] = useState({});
  const [noteDraft, setNoteDraft] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [syncError, setSyncError] = useState(false);
  const noteSaveTimer = useRef(null);

  const active = students.find(s => s.id === activeId) || students[0];
  const schedule = active ? (PRESET_SCHEDULES[active.preset_key] || EMPTY_SCHEDULE) : EMPTY_SCHEDULE;
  const days = schedule.days || [];
  const elaLessons = schedule.elaLessons || {};
  const mathLessons = schedule.mathLessons || {};
  const totalHistoryDays = schedule.totalHistoryDays || 0;

  // ---- Load students from Supabase ----
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: true });
      if (error) { setSyncError(true); setLoadingStudents(false); return; }
      setStudents(data || []);
      if (data && data.length && !activeId) setActiveId(data[0].id);
      setLoadingStudents(false);
    })();
  }, []);

  // ---- Load completions + notes for the active student, and subscribe to live changes ----
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;

    (async () => {
      const [{ data: comp }, { data: noteRows }] = await Promise.all([
        supabase.from('completions').select('item_key, done').eq('student_id', activeId),
        supabase.from('notes').select('date, body').eq('student_id', activeId),
      ]);
      if (cancelled) return;
      const compMap = {};
      (comp || []).forEach(r => { compMap[`${activeId}::${r.item_key}`] = r.done; });
      setCompletion(compMap);
      const noteMap = {};
      (noteRows || []).forEach(r => { noteMap[r.date] = r.body; });
      setNotes(noteMap);
    })();

    const channel = supabase
      .channel(`student-${activeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions', filter: `student_id=eq.${activeId}` }, (payload) => {
        const row = payload.new?.item_key ? payload.new : payload.old;
        if (!row) return;
        setCompletion(prev => ({ ...prev, [`${activeId}::${row.item_key}`]: payload.new ? payload.new.done : false }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `student_id=eq.${activeId}` }, (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        setNotes(prev => ({ ...prev, [row.date]: payload.new ? payload.new.body : '' }));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [activeId]);

  // ---- Toggle a checkbox (writes straight to Supabase; realtime updates local + other devices) ----
  const toggleItem = async (dateStr, key) => {
    const itemKey = `${dateStr}|${key}`;
    const fullKey = `${activeId}::${itemKey}`;
    const nextDone = !completion[fullKey];
    setCompletion(prev => ({ ...prev, [fullKey]: nextDone }));
    const { error } = await supabase.from('completions').upsert(
      { student_id: activeId, item_key: itemKey, done: nextDone, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,item_key' }
    );
    if (error) setSyncError(true);
  };

  // ---- Jump to today on student switch / load ----
  useEffect(() => {
    if (!days.length) { setDayIndex(0); return; }
    const todayStr = new Date().toISOString().slice(0, 10);
    let idx = days.findIndex(d => d.date >= todayStr);
    if (idx === -1) idx = 0;
    setDayIndex(idx);
  }, [activeId, days.length]);

  const currentDay = days[dayIndex];

  useEffect(() => {
    setNoteDraft(currentDay ? (notes[currentDay.date] || '') : '');
  }, [currentDay?.date, notes]);

  const saveNote = (dateStr, body) => {
    setNotes(prev => ({ ...prev, [dateStr]: body }));
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from('notes').upsert(
        { student_id: activeId, date: dateStr, body, updated_at: new Date().toISOString() },
        { onConflict: 'student_id,date' }
      );
      if (error) setSyncError(true);
    }, 600);
  };

  const progress = useMemo(() => {
    if (!days.length) return { done: 0, total: 0 };
    let done = 0;
    days.forEach(d => {
      const keys = itemKeysForDay(d);
      const allDone = keys.length > 0 && keys.every(k => completion[`${activeId}::${d.date}|${k}`]);
      if (allDone) done++;
    });
    return { done, total: days.length };
  }, [days, completion, activeId]);

  function itemKeysForDay(d) {
    const keys = [];
    if (d.lesson) { keys.push('ELA'); keys.push('MATH'); }
    else if (d.review) { keys.push('REVIEW'); }
    (d.ixl || []).forEach((_, i) => keys.push(`IXL${i}`));
    if (d.history) keys.push('HISTORY');
    return keys;
  }

  const goPrev = () => setDayIndex(i => Math.max(0, i - 1));
  const goNext = () => setDayIndex(i => Math.min(days.length - 1, i + 1));
  const goToday = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let idx = days.findIndex(d => d.date >= todayStr);
    if (idx === -1) idx = 0;
    setDayIndex(idx);
  };

  const addStudent = async () => {
    if (!newName.trim()) return;
    const id = newName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36);
    const color = PALETTE[students.length % PALETTE.length];
    const row = { id, name: newName.trim(), grade: newGrade.trim(), color, preset_key: null };
    const { error } = await supabase.from('students').insert(row);
    if (error) { setSyncError(true); return; }
    setStudents(prev => [...prev, row]);
    setActiveId(id);
    setNewName('');
    setNewGrade('');
    setShowAddModal(false);
  };

  const signOut = async () => { await supabase.auth.signOut(); };
  
  if (loadingStudents) {
    return <div className="planner-root" style={{ alignItems: 'center', justifyContent: 'center' }}><style>{globalStyles}</style><div className="date-sub font-mono">Loading…</div></div>;
  }

  return (
    <div className="planner-root">
      <style>{globalStyles}</style>

      <nav className="rail">
        {students.map(s => (
          <button
            key={s.id}
            className={`tab-btn font-display ${s.id === activeId ? 'active' : ''}`}
            style={{ background: s.color }}
            onClick={() => setActiveId(s.id)}
            aria-label={`Switch to ${s.name}`}
          >
            <span className="tab-initial">{initials(s.name)}</span>
            <span className="tab-name">{s.name.split(' ')[0]}</span>
          </button>
        ))}
        <button className="add-tab" onClick={() => setShowAddModal(true)} aria-label="Add student">+</button>
        <button className="signout-tab" onClick={signOut} aria-label="Sign out" title="Sign out">&#x23FB;</button>
      </nav>

      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="header-name font-display">{active ? `${active.name}'s Planner` : 'Planner'}</div>
            {active?.grade && <div className="header-grade">{active.grade}</div>}
          </div>
          <div className="sync-pill font-mono">{session.user.email}</div>
        </div>

        {days.length > 0 && (
          <div className="progress-wrap">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${(progress.done / Math.max(progress.total,1)) * 100}%`, background: active?.color }} />
            </div>
            <div className="date-sub font-mono">{progress.done}/{progress.total} days complete</div>
          </div>
        )}

        {days.length === 0 ? (
          <div className="empty-state">
            <h3 className="font-display">No schedule loaded yet</h3>
            <p>{active ? `${active.name} doesn't have a curriculum loaded yet.` : 'Add a student to get started.'} Ask whoever set up the planner to add a schedule for this child.</p>
          </div>
        ) : (
          <>
            <div className="nav-row">
              <button className="nav-btn" onClick={goPrev} disabled={dayIndex === 0} aria-label="Previous day">&#8592;</button>
              <div className="date-block">
                <div className="date-main font-display">{currentDay && fmtDateLong(currentDay.date)}</div>
                <button className="today-btn" onClick={goToday} style={{ marginTop: 6 }}>Jump to Today</button>
              </div>
              <button className="nav-btn" onClick={goNext} disabled={dayIndex === days.length - 1} aria-label="Next day">&#8594;</button>
            </div>

            <div style={{ textAlign: 'center' }}>
              {currentDay?.lp && <span className="lp-badge">{currentDay.lp}</span>}
            </div>

            <div className="cards">
              {currentDay && renderDayCards(currentDay, elaLessons, mathLessons, totalHistoryDays, completion, toggleItem, activeId)}
            </div>

            <div className="notes-block">
              <div className="notes-label font-display">Notes for this day</div>
              <textarea
                className="notes-area"
                placeholder="Add a note — e.g. 'skip lesson, sick day' or 'loved the art project today'"
                value={noteDraft}
                onChange={e => { setNoteDraft(e.target.value); saveNote(currentDay.date, e.target.value); }}
              />
            </div>
          </>
        )}

        {syncError && <div className="save-warning">Some changes may not have synced — check your internet connection.</div>}
      </main>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="font-display">Add a Student</h3>
            <input placeholder="Student's name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            <input placeholder="Grade (optional)" value={newGrade} onChange={e => setNewGrade(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={addStudent}>Add Student</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderDayCards(day, elaLessons, mathLessons, totalHistoryDays, completion, toggleItem, activeId) {
  const cards = [];
  const isDone = (key) => !!completion[`${activeId}::${day.date}|${key}`];

  const Check = ({ checked, onClick, color }) => (
    <div className="checkbox" onClick={onClick} style={checked ? { background: color, borderColor: color } : {}}>
      {checked ? '\u2713' : ''}
    </div>
  );

  if (day.lesson) {
    const ela = elaLessons[String(day.lesson)];
    const math = mathLessons[String(day.lesson)];
    cards.push(
      <div key="ela" className={`card ${isDone('ELA') ? 'done' : ''}`} style={{ borderLeftColor: SUBJECT_COLORS.ELA }}>
        <Check checked={isDone('ELA')} onClick={() => toggleItem(day.date, 'ELA')} color={SUBJECT_COLORS.ELA} />
        <div className="card-body">
          <div className="card-label" style={{ color: SUBJECT_COLORS.ELA }}>
            ELA
            {ela && ela.project && <span className="pill" style={{ background: '#F3E9F6', color: SUBJECT_COLORS.IXL }}>Project Lesson</span>}
          </div>
          <div className="card-title">
            Good and the Beautiful Language Arts — Lesson {day.lesson}
            {ela && ela.title ? `: ${ela.title}` : ''}
          </div>
          {ela && (ela.unit || ela.part) && (
            <div className="card-sub">
              {ela.unit ? `Unit ${ela.unit}` : ''}{ela.unit && ela.part ? ' \u00b7 ' : ''}{ela.part ? `Course Book Part ${ela.part}` : ''}
            </div>
          )}
        </div>
      </div>
    );
    cards.push(
      <div key="math" className={`card ${isDone('MATH') ? 'done' : ''}`} style={{ borderLeftColor: SUBJECT_COLORS.MATH }}>
        <Check checked={isDone('MATH')} onClick={() => toggleItem(day.date, 'MATH')} color={SUBJECT_COLORS.MATH} />
        <div className="card-body">
          <div className="card-label" style={{ color: SUBJECT_COLORS.MATH }}>Math</div>
          <div className="card-title">Lesson {day.lesson}{math ? `: ${math}` : ''}</div>
          <div className="card-sub">+ Mental Math Mysteries — Lesson {day.lesson}</div>
        </div>
      </div>
    );
  } else if (day.review) {
    cards.push(
      <div key="review" className={`card ${isDone('REVIEW') ? 'done' : ''}`} style={{ borderLeftColor: SUBJECT_COLORS.REVIEW, borderLeftStyle: 'dashed' }}>
        <Check checked={isDone('REVIEW')} onClick={() => toggleItem(day.date, 'REVIEW')} color={SUBJECT_COLORS.REVIEW} />
        <div className="card-body">
          <div className="card-label" style={{ color: SUBJECT_COLORS.REVIEW }}>Review Day</div>
          <div className="card-title">Catch-up, Spelling App, and extra IXL practice</div>
        </div>
      </div>
    );
  }

  (day.ixl || []).forEach((item, i) => {
    const key = `IXL${i}`;
    cards.push(
      <div key={key} className={`card ${isDone(key) ? 'done' : ''}`} style={{ borderLeftColor: SUBJECT_COLORS.IXL }}>
        <Check checked={isDone(key)} onClick={() => toggleItem(day.date, key)} color={SUBJECT_COLORS.IXL} />
        <div className="card-body">
          <div className="card-label" style={{ color: SUBJECT_COLORS.IXL }}>IXL &middot; {item.subject}</div>
          <div className="card-title font-mono" style={{ fontSize: 13 }}>{item.code}</div>
          <a className="ixl-link" href={item.link} target="_blank" rel="noopener noreferrer">
            Open IXL &#8599;
          </a>
        </div>
      </div>
    );
  });

  if (day.history) {
    cards.push(
      <div key="history" className={`card ${isDone('HISTORY') ? 'done' : ''}`} style={{ borderLeftColor: SUBJECT_COLORS.HISTORY }}>
        <Check checked={isDone('HISTORY')} onClick={() => toggleItem(day.date, 'HISTORY')} color={SUBJECT_COLORS.HISTORY} />
        <div className="card-body">
          <div className="card-label" style={{ color: SUBJECT_COLORS.HISTORY }}>History</div>
          <div className="card-title">Beautiful Feet — Reading Day {day.history} of {totalHistoryDays}</div>
          <div className="card-sub">Use your physical book/guide for today's reading</div>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    cards.push(
      <div key="none" className="card" style={{ borderLeftColor: '#DCD2B8' }}>
        <div className="card-body"><div className="card-title">No assignments scheduled today</div></div>
      </div>
    );
  }

  return cards;
}

// ============================================================
// Top-level App — decides Auth vs Planner
// ============================================================
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div style={{ minHeight: '100vh', background: '#F5F1E8' }} />;
  }
  if (!session) {
    return <AuthScreen />;
  }
  return <Planner session={session} />;
}

// ============================================================
// Shared styles (design preserved exactly from the original artifact)
// ============================================================
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Karla:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

  * { box-sizing: border-box; }
  body { margin: 0; }

  .planner-root, .auth-root {
    font-family: 'Karla', sans-serif;
    background: #F5F1E8;
    min-height: 100vh;
    color: #2B2A25;
    display: flex;
  }
  .font-display { font-family: 'Fredoka', sans-serif; }
  .font-mono { font-family: 'IBM Plex Mono', monospace; }

  .auth-root { align-items: center; justify-content: center; padding: 20px; }
  .auth-card { background: white; border-radius: 18px; padding: 34px 30px; width: 100%; max-width: 360px; box-shadow: 0 20px 50px rgba(0,0,0,0.08); border: 1.5px solid #E4DCC8; }
  .auth-title { font-size: 22px; font-weight: 700; text-align: center; }
  .auth-sub { font-size: 13.5px; color: #6B6558; text-align: center; margin: 6px 0 22px; }
  .auth-card input { width: 100%; padding: 11px 13px; border-radius: 10px; border: 1.5px solid #DCD2B8; font-family: 'Karla', sans-serif; font-size: 14px; margin-bottom: 10px; }
  .auth-card input:focus { outline: 2px solid #4C7A5B; border-color: transparent; }
  .auth-error { font-size: 12.5px; color: #C1554D; margin: -2px 0 10px; }
  .auth-toggle { text-align: center; font-size: 13px; margin-top: 16px; color: #6B6558; }
  .auth-toggle a { color: #3D6E99; cursor: pointer; font-weight: 600; }
  .auth-hint { font-size: 11.5px; color: #A39C89; text-align: center; margin-top: 18px; line-height: 1.5; }

  .rail {
    width: 88px; flex-shrink: 0; padding-top: 28px; display: flex; flex-direction: column;
    align-items: flex-start; gap: 14px; background: #EAE3D2; border-right: 2px solid #DCD2B8; min-height: 100vh;
  }  .tab-btn {
    width: 76px; height: 64px; border-top-right-radius: 14px; border-bottom-right-radius: 14px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: transform 0.15s ease, width 0.15s ease; color: white; position: relative;
  }
  .tab-btn:hover { transform: translateX(4px); }
  .tab-btn.active { width: 84px; box-shadow: 2px 2px 8px rgba(0,0,0,0.15); }
  .tab-initial { font-size: 22px; font-weight: 700; line-height: 1; }
  .tab-name { font-size: 9px; margin-top: 3px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.04em; }
  .add-tab, .signout-tab {
    width: 76px; height: 44px; border-top-right-radius: 14px; border-bottom-right-radius: 14px;
    background: transparent; border: 2px dashed #B9AF95; color: #8C8570; font-size: 20px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .signout-tab { margin-top: auto; margin-bottom: 24px; font-size: 16px; }
  .add-tab:hover, .signout-tab:hover { background: #DCD2B8; }

  .main { flex: 1; padding: 32px 40px 60px; max-width: 780px; }
  .header-name { font-size: 28px; font-weight: 600; }
  .header-grade { font-size: 14px; color: #6B6558; margin-top: 2px; }
  .sync-pill { font-size: 10.5px; color: #8C8570; background: #EAE3D2; padding: 5px 10px; border-radius: 100px; margin-top: 4px; }

  .progress-wrap { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
  .progress-bar-bg { flex: 1; height: 8px; background: #E4DCC8; border-radius: 5px; overflow: hidden; }
  .progress-bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s ease; }

  .nav-row { display: flex; align-items: center; justify-content: space-between; margin-top: 28px; margin-bottom: 8px; }
  .nav-btn {
    background: white; border: 1.5px solid #DCD2B8; border-radius: 10px; width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; color: #2B2A25;
  }
  .nav-btn:hover { background: #F0EBDC; }
  .nav-btn:disabled { opacity: 0.35; cursor: default; }
  .date-block { text-align: center; }
  .date-main { font-size: 16px; font-weight: 600; }
  .date-sub { font-size: 12px; color: #8C8570; margin-top: 2px; }
  .today-btn {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
    background: #2B2A25; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer;
  }
  .today-btn:hover { opacity: 0.85; }

  .lp-badge {
    display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    background: #E4DCC8; padding: 3px 9px; border-radius: 6px; color: #6B6558; margin-top: 10px;
  }

  .cards { margin-top: 22px; display: flex; flex-direction: column; gap: 12px; }
  .card {
    background: white; border-radius: 14px; border: 1.5px solid #E4DCC8; padding: 16px 18px;
    display: flex; gap: 14px; align-items: flex-start; border-left-width: 6px; transition: opacity 0.15s ease;
  }
  .card.done { opacity: 0.5; }
  .checkbox {
    width: 24px; height: 24px; border-radius: 7px; border: 2px solid #C9C1AA; flex-shrink: 0; margin-top: 2px;
    cursor: pointer; display: flex; align-items: center; justify-content: center; background: white;
    font-size: 15px; color: white; font-weight: 700;
  }
  .card-body { flex: 1; min-width: 0; }
  .card-label { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }
  .card-title { font-size: 15px; font-weight: 600; line-height: 1.35; }
  .card-sub { font-size: 13px; color: #6B6558; margin-top: 2px; }
  .pill { display: inline-block; font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 100px; margin-left: 8px; vertical-align: middle; }
  .ixl-link {
    display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; font-family: 'IBM Plex Mono', monospace;
    font-size: 12px; font-weight: 600; color: white; background: #8A5A9C; padding: 6px 12px; border-radius: 8px;
    text-decoration: none; cursor: pointer;
  }
  .ixl-link:hover { opacity: 0.88; }

  .notes-block { margin-top: 26px; }
  .notes-label { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #6B6558; }
  .notes-area {
    width: 100%; min-height: 70px; border-radius: 12px; border: 1.5px solid #E4DCC8; padding: 12px 14px;
    font-family: 'Karla', sans-serif; font-size: 14px; resize: vertical; background: white;
  }
  .notes-area:focus { outline: 2px solid #B9863A; border-color: transparent; }

  .empty-state { margin-top: 60px; text-align: center; color: #8C8570; }
  .empty-state h3 { font-size: 20px; color: #2B2A25; margin-bottom: 8px; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(43,42,37,0.4); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
  .modal { background: white; border-radius: 16px; padding: 28px; width: 100%; max-width: 320px; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
  .modal h3 { font-size: 19px; margin-bottom: 16px; }
  .modal input { width: 100%; padding: 10px 12px; border-radius: 9px; border: 1.5px solid #DCD2B8; font-family: 'Karla', sans-serif; font-size: 14px; margin-bottom: 12px; }
  .modal input:focus { outline: 2px solid #4C7A5B; border-color: transparent; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
  .btn-secondary { background: #EAE3D2; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Karla', sans-serif; font-weight: 600; font-size: 13px; }
  .btn-primary { background: #2B2A25; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Karla', sans-serif; font-weight: 600; font-size: 13px; }
  .save-warning { font-size: 11px; color: #B9863A; margin-top: 14px; font-family: 'IBM Plex Mono', monospace; }

  @media (max-width: 640px) {
    .main { padding: 20px 16px 50px; max-width: 100%; }
    .rail { width: 64px; }
    .tab-btn { width: 54px; height: 54px; }
    .tab-btn.active { width: 60px; }
    .tab-name { display: none; }
    .header-name { font-size: 22px; }
    .sync-pill { display: none; }
  }
`;

  


