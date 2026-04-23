// ============================================================
// LAYOUT: Sidebar + Header (injected into all app pages)
// ============================================================
(function () {
  const PAGE = (document.body && document.body.dataset.page) || '';
  const APP_PAGES = ['schueler', 'lehrer', 'analyse', 'profil', 'statistik', 'info'];
  if (!APP_PAGES.includes(PAGE)) return;

  const SIDEBAR_KEY = 'latein-sidebar-collapsed';

  let user = null;
  try { user = JSON.parse(localStorage.getItem('latin-vocab-user') || 'null'); } catch {}
  const role = user && user.rolle === 'lehrer' ? 'lehrer' : 'schueler';

  // Lucide-style inline SVG icons
  const I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Z"/><path d="M4 19h15"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14a5 5 0 0 1 5.5 5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="m10 17-5-5 5-5"/><path d="M5 12h11"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>'
  };

  const navItems = role === 'lehrer'
    ? [
        { label: 'Übersicht', icon: I.home, href: 'lehrer.html', match: ['lehrer'] },
        { label: 'Vokabelsuche', icon: I.search, href: 'analyse.html', match: ['analyse'] },
        { label: 'Profil', icon: I.user, href: 'profil.html', match: ['profil'] },
      ]
    : [
        { label: 'Übersicht', icon: I.home, href: 'schueler.html', match: ['schueler'] },
        { label: 'Statistik', icon: I.chart, href: 'statistik.html', match: ['statistik'] },
        { label: 'Vokabelsuche', icon: I.search, href: 'analyse.html', match: ['analyse'] },
        { label: 'Profil', icon: I.user, href: 'profil.html', match: ['profil'] },
      ];

  const titleByPage = {
    schueler: 'Übersicht', lehrer: 'Übersicht',
    analyse: 'Vokabelsuche', profil: 'Profil', statistik: 'Statistik', info: 'Hilfe'
  };

  const initials = user
    ? ((user.vorname || '?')[0] + (user.nachname || '')[0] || '').toUpperCase()
    : '?';
  const fullName = user ? (user.vorname + ' ' + user.nachname) : 'Gast';
  const roleLabel = role === 'lehrer' ? 'Lehrer' : 'Schüler';

  const sidebar = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-mark">VT</div>
        <span>Vokabeltrainer</span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Hauptmenü</div>
        ${navItems.map(it => `
          <a class="nav-link ${it.match.includes(PAGE) ? 'active' : ''}" href="${it.href}">
            <span class="nav-icon">${it.icon}</span>
            <span>${it.label}</span>
          </a>
        `).join('')}
        <div class="nav-section-label">Meine Klassen</div>
        <div id="__sidebar-classes" class="sidebar-classes">
          <span class="sidebar-classes-empty">Lade…</span>
        </div>
        <div class="nav-section-label">Hilfe</div>
        <a class="nav-link ${PAGE === 'info' ? 'active' : ''}" href="info.html">
          <span class="nav-icon">${I.help}</span>
          <span>Hilfe & FAQ</span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <a class="user-chip" href="profil.html">
          <div class="user-avatar">${initials}</div>
          <div class="user-chip-text">
            <span class="user-chip-name">${fullName}</span>
            <span class="user-chip-role">${roleLabel}</span>
          </div>
        </a>
      </div>
    </aside>
    <div class="mobile-overlay" id="__mobile-overlay"></div>
  `;

  const header = `
    <header class="app-header">
      <div class="header-left">
        <button class="icon-btn" id="__sidebar-toggle" title="Menü" aria-label="Menü umschalten">${I.menu}</button>
        <span class="header-title">${titleByPage[PAGE] || ''}</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn theme-toggle" id="theme-toggle" title="Hell/Dunkel">
          <span class="theme-icon" id="theme-icon">${I.moon}</span>
        </button>
        <button class="icon-btn" id="__logout" title="Abmelden" aria-label="Abmelden">${I.logout}</button>
      </div>
    </header>
  `;

  const existingMain = document.querySelector('main');
  const mainHTML = existingMain ? existingMain.innerHTML : '';

  const legacy = `
    <div class="hidden">
      <span id="logged-in-user"></span>
      <button id="logout-btn"></button>
    </div>
  `;

  document.body.innerHTML = `
    <div class="app-shell" id="__app-shell">
      ${sidebar}
      ${header}
      <main class="app-main"><div class="content">${mainHTML}</div></main>
    </div>
    ${legacy}
  `;

  // Override theme icon updater so it uses SVG
  window.__themeIcons = { sun: I.sun, moon: I.moon };

  const shell = document.getElementById('__app-shell');
  if (localStorage.getItem(SIDEBAR_KEY) === '1') shell.classList.add('sidebar-collapsed');

  document.getElementById('__sidebar-toggle').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      shell.classList.toggle('sidebar-open');
    } else {
      shell.classList.toggle('sidebar-collapsed');
      localStorage.setItem(SIDEBAR_KEY, shell.classList.contains('sidebar-collapsed') ? '1' : '0');
    }
  });
  document.getElementById('__mobile-overlay').addEventListener('click', () => {
    shell.classList.remove('sidebar-open');
  });

  document.getElementById('__logout').addEventListener('click', () => {
    if (typeof window.logout === 'function') window.logout();
    else { localStorage.removeItem('latin-vocab-user'); window.location.href = 'index.html'; }
  });

  // Load user's classes into sidebar
  loadSidebarClasses(user, role);

  async function loadSidebarClasses(user, role) {
    const el = document.getElementById('__sidebar-classes');
    if (!el || !user) return;
    function waitForSb(cb) {
      if (window.supabase) cb();
      else setTimeout(() => waitForSb(cb), 50);
    }
    waitForSb(async () => {
      let db;
      try {
        db = window.supabase.createClient(
          'https://jxkupplncsmextsfrlbz.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4a3VwcGxuY3NtZXh0c2ZybGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTY3NjcsImV4cCI6MjA4OTY3Mjc2N30.32M4Pf1-w_9qSE4e9ALpzYdYzyWCeOM_hc_LA1OARJs'
        );
      } catch { return; }
      let classes = [];
      try {
        if (role === 'lehrer') {
          const { data } = await db.from('classes').select('id,name').eq('teacher_id', user.id).order('created_at');
          classes = data || [];
        } else {
          const { data } = await db.from('class_members').select('classes(id,name)').eq('student_id', user.id);
          classes = (data || []).map(d => d.classes).filter(Boolean);
        }
      } catch {}
      if (classes.length === 0) {
        el.innerHTML = '<span class="sidebar-classes-empty">Keine Klassen</span>';
        return;
      }
      el.innerHTML = classes.map(c => `
        <a class="nav-link nav-link-sub" href="${role === 'lehrer' ? 'lehrer.html?class=' + encodeURIComponent(c.id) : 'profil.html#class-' + encodeURIComponent(c.id)}">
          <span class="nav-icon">${I.users}</span>
          <span>${escapeHtml(c.name)}</span>
        </a>
      `).join('');
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  }
})();
