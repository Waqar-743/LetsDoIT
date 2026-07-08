/* ==========================================================================
   LetsDOiT — Hash router
   Routes look like:
     #/auth/welcome
     #/auth/student-signup
     #/student/overview
     #/student/course/c1
     #/student/course/c1/material/m2
     #/student/course/c1/quiz/q2/attempt
     #/teacher/overview
     #/teacher/course/c1
   ========================================================================== */

window.LD = window.LD || {};

LD.router = (function () {
  const routes = [];   // { pattern, handler, layout }
  let current = null;

  function on(pattern, handler, opts = {}) {
    // pattern can include :params; compile to regex
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
    routes.push({ re, keys, handler, layout: opts.layout || 'app', screen: opts.screen });
  }

  function resolve() {
    const hash = location.hash.replace(/^#/, '') || '/auth/welcome';
    return hash;
  }

  function navigate(path) {
    if (location.hash === '#' + path) {
      render();   // re-render same path
    } else {
      location.hash = '#' + path;
    }
  }

  function parse() {
    const path = resolve();
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { route: r, path, params };
      }
    }
    return null;
  }

  function render() {
    const r = parse();
    const root = document.getElementById('app-root');
    if (!root) return;

    // Auth gate: if no role and route is not /auth/*, send to welcome.
    if (!LD.state.isAuthed() && !r.path.startsWith('/auth')) {
      navigate('/auth/welcome'); return;
    }
    // Role mismatch: if teacher route and student role (or vice versa), send to that role's overview.
    if (LD.state.isAuthed()) {
      if (r.path.startsWith('/student') && !LD.state.isStudent()) { navigate('/teacher/overview'); return; }
      if (r.path.startsWith('/teacher') && !LD.state.isTeacher()) { navigate('/student/overview'); return; }
      if (r.path.startsWith('/auth') && r.path !== '/auth/role') { navigate(LD.state.isStudent() ? '/student/overview' : '/teacher/overview'); return; }
    }

    // Layout switch
    const layout = r.route.layout;
    root.className = layout === 'auth' ? 'auth-shell' : 'app-shell';

    // Sidebar/topbar (only on app layout)
    const sidebarMount = document.getElementById('sidebar-mount');
    const topbarMount  = document.getElementById('topbar-mount');
    if (layout === 'app') {
      LD.shell.renderSidebar(sidebarMount);
      LD.shell.renderTopbar(topbarMount);
    } else {
      sidebarMount.innerHTML = '';
      topbarMount.innerHTML = '';
    }

    // Main content
    const main = document.getElementById('main-mount');
    main.innerHTML = '';
    main.className = 'main';
    try {
      r.route.handler(r.params, main);
    } catch (e) {
      console.error('Render error:', e);
      main.innerHTML = `<div class="page"><div class="error-state"><div><strong>Something went wrong</strong>${e.message || ''}</div></div></div>`;
    }

    current = r;
    LD.events.emit('route:change', r);
    window.scrollTo(0, 0);
  }

  function init() {
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = '#/auth/welcome';
    render();
  }

  return { on, navigate, render, init, current: () => current };
})();
