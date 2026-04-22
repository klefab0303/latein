// ============================================================
// LAYOUT: Sidebar + Header (injected into all app pages)
// ============================================================
(function () {
  const PAGE = (document.body && document.body.dataset.page) || '';
  // Pages that get the app shell (everything except login & info)
  const APP_PAGES = ['schueler', 'lehrer', 'analyse', 'profil', 'statistik'];
  if (!APP_PAGES.includes(PAGE)) return;

  const SIDEBAR_KEY = 'latein-sidebar-collapsed';

  // Read currentUser from localStorage to know role for nav items
  let user = null;
  try { user = JSON.parse(localStorage.getItem('latin-vocab-user') || 'null'); } catch {}
  const role = user && user.rolle === 'lehrer' ? 'lehrer' : 'schueler';

  const navItems = role === 'lehrer'
    ? [
        { label: 'Übersicht', icon: '⌂', href: 'lehrer.html', match: ['lehrer'] },
        { label: 'Formen-Check', icon: '⚙', href: 'analyse.html', match: ['analyse'] },
        { label: 'Profil', icon: '◉', href: 'profil.html', match: ['profil'] },
      ]
    : [
        { label: 'Übersicht', icon: '⌂', href: 'schueler.html', match: ['schueler'] },
        { label: 'Statistik', icon: '◧', href: 'statistik.html', match: ['statistik'] },
        { label: 'Formen-Check', icon: '⚙', href: 'analyse.html', match: ['analyse'] },
        { label: 'Profil', icon: '◉', href: 'profil.html', match: ['profil'] },
      ];

  const titleByPage = {
    schueler: 'Übersicht', lehrer: 'Übersicht',
    analyse: 'Formen-Check', profil: 'Profil', statistik: 'Statistik'
  };

  const initials = user
    ? ((user.vorname || '?')[0] + (user.nachname || '')[0] || '').toUpperCase()
    : '?';
  const fullName = user ? (user.vorname + ' ' + user.nachname) : 'Gast';
  const roleLabel = role === 'lehrer' ? 'Lehrer' : 'Schüler';

  // Build markup
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
        <div class="nav-section-label">Hilfe</div>
        <a class="nav-link" href="info.html">
          <span class="nav-icon">?</span>
          <span>Info & Hilfe</span>
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
        <button class="icon-btn" id="__sidebar-toggle" title="Menü" aria-label="Menü umschalten">☰</button>
        <span class="header-title">${titleByPage[PAGE] || ''}</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn theme-toggle" id="theme-toggle" title="Hell/Dunkel">
          <span class="theme-icon" id="theme-icon">☾</span>
        </button>
        <button class="icon-btn" id="__logout" title="Abmelden" aria-label="Abmelden">⏻</button>
      </div>
    </header>
  `;

  // Wrap existing <main> content. We expect HTML body to already have
  // the page content inside <main class="container"> or similar.
  // We replace the body structure.
  const existingMain = document.querySelector('main');
  const mainHTML = existingMain ? existingMain.innerHTML : '';

  // Hidden user badge & logout button (kept for legacy references in script.js)
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

  // Restore collapsed state (desktop)
  const shell = document.getElementById('__app-shell');
  if (localStorage.getItem(SIDEBAR_KEY) === '1') shell.classList.add('sidebar-collapsed');

  // Sidebar toggle: mobile = open/close, desktop = collapse
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

  // Logout button
  document.getElementById('__logout').addEventListener('click', () => {
    if (typeof window.logout === 'function') window.logout();
    else { localStorage.removeItem('latin-vocab-user'); window.location.href = 'index.html'; }
  });
})();
