/* ==========================================================================
   LetsDOiT — State
   Session: role, user id, AI mode, current course, quiz mode, etc.
   Persisted to localStorage so refreshes keep state.
   ========================================================================== */

window.LD = window.LD || {};

LD.state = (function () {
  const KEY = 'letsdoit.state.v1';

  const defaults = {
    role: null,                    // 'student' | 'teacher' | null
    userId: null,                  // studentId / teacherId
    aiMode: 'hybrid',              // 'offline' | 'online' | 'hybrid'
    activeCourseId: null,
    activeQuizMode: null,          // 'practice' | 'test' | null
    joinedCourses: ['c1','c2','c5'],
  };

  let s = Object.assign({}, defaults, LD.storage.get(KEY) || {});

  function persist() { LD.storage.set(KEY, s); }

  function get() { return Object.assign({}, s); }

  function set(patch) {
    Object.assign(s, patch);
    persist();
    LD.events.emit('state:change', s);
  }

  function reset() {
    s = Object.assign({}, defaults);
    persist();
    LD.events.emit('state:change', s);
  }

  function isAuthed() { return !!s.role && !!s.userId; }
  function isStudent() { return s.role === 'student'; }
  function isTeacher() { return s.role === 'teacher'; }

  return { get, set, reset, isAuthed, isStudent, isTeacher };
})();

LD.storage = (function () {
  function get(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
  }
  function set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  function del(k) {
    try { localStorage.removeItem(k); } catch (e) {}
  }
  return { get, set, del };
})();

LD.events = (function () {
  const listeners = {};
  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => off(evt, fn);
  }
  function off(evt, fn) {
    if (!listeners[evt]) return;
    listeners[evt] = listeners[evt].filter(f => f !== fn);
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }
  return { on, off, emit };
})();
