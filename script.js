// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = 'https://jxkupplncsmextsfrlbz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4a3VwcGxuY3NtZXh0c2ZybGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTY3NjcsImV4cCI6MjA4OTY3Mjc2N30.32M4Pf1-w_9qSE4e9ALpzYdYzyWCeOM_hc_LA1OARJs';

let db = null;
try {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Supabase konnte nicht geladen werden:', e);
}

// ============================================================
// LOCALSTORAGE KEYS
// ============================================================
const VOCABULARIES_KEY = 'latin-vocab-vocabularies';
const PRACTICE_RESULTS_KEY = 'latin-vocab-practice-results';
const THEME_KEY = 'latin-vocab-theme';
const USER_KEY = 'latin-vocab-user';

// ============================================================
// STATE
// ============================================================
let vocabularies = [];
let practiceResults = [];
let currentUser = null;

// Flashcard state
let selectedLessons = [];
let currentPracticeCards = [];
let currentCardIndex = 0;
let sessionResults = { known: 0, unknown: 0, wrongCards: [] };

// Probe test state
let probeSelectedLessons = [];
let probeCards = [];
let probeIndex = 0;
let probeAnswers = [];

// Teacher state
let currentClassId = null;
let currentClassName = '';
let currentTestId = null;

// Test creation state
let testSelectedLessons = [];

// Student state
let studentTestData = null;
let studentCards = [];
let studentIndex = 0;
let studentAnswers = [];
let studentResultId = null;

// ============================================================
// INIT (page-aware)
// ============================================================
const PAGE = (document.body && document.body.dataset.page) || 'login';

document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  setupThemeToggle();

  if (PAGE === 'info') {
    // info ist jetzt teil des app-shell (geschützt). Wenn nicht eingeloggt, geht's nur auf die alte Variante.
    const u = (() => { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } })();
    if (u) currentUser = u;
    return;
  }

  loadData();

  const savedUser = (() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { localStorage.removeItem(USER_KEY); return null; }
  })();

  if (PAGE === 'login') {
    if (savedUser) {
      // Bereits eingeloggt → weiterleiten
      window.location.href = savedUser.rolle === 'lehrer' ? 'lehrer.html' : 'schueler.html';
      return;
    }
    showView('login-view');
    setupLoginListeners();
    return;
  }

  // Geschützte Seiten (schueler/lehrer/analyse)
  if (!savedUser) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = savedUser;

  // Falsche Rolle → richtige Seite
  if (PAGE === 'lehrer' && currentUser.rolle !== 'lehrer') {
    window.location.href = 'schueler.html';
    return;
  }
  if (PAGE === 'schueler' && currentUser.rolle === 'lehrer') {
    window.location.href = 'lehrer.html';
    return;
  }

  showLoggedInState();
  if (PAGE === 'schueler' || PAGE === 'lehrer') showView('home-view');
  if (PAGE === 'schueler') {
    updateStats();
    loadPresetVocabularies();
    setupSchuelerListeners();
    setGreeting();
  } else if (PAGE === 'lehrer') {
    loadPresetVocabularies();
    setupLehrerListeners();
    loadTeacherDashboard();
    setGreeting();
  } else if (PAGE === 'analyse') {
    setupAnalyseListeners();
  } else if (PAGE === 'profil') {
    initProfilePage();
  } else if (PAGE === 'statistik') {
    initStatistikPage();
  }
});

function setupThemeToggle() {
  const t = document.getElementById('theme-toggle');
  if (t) t.addEventListener('click', toggleTheme);
}

// ============================================================
// NAVIGATION
// ============================================================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  window.scrollTo(0, 0);
}

function goHome() {
  showView('home-view');
  if (PAGE === 'schueler') updateStats();
  if (PAGE === 'lehrer') loadTeacherDashboard();
}

function redirectToRoleHome() {
  if (!currentUser) { window.location.href = 'index.html'; return; }
  window.location.href = currentUser.rolle === 'lehrer' ? 'lehrer.html' : 'schueler.html';
}

// ============================================================
// THEME
// ============================================================
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    updateThemeIcon(true);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (window.__themeIcons) {
    icon.innerHTML = isDark ? window.__themeIcons.sun : window.__themeIcons.moon;
  } else {
    icon.innerHTML = isDark ? '&#9728;' : '&#9790;';
  }
}

// ============================================================
// AUTH
// ============================================================
let selectedRole = 'schueler';

function switchAuthTab(tab) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  if (tab === 'login') {
    document.querySelectorAll('.tabs .tab')[0].classList.add('active');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
  } else {
    document.querySelectorAll('.tabs .tab')[1].classList.add('active');
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  }
  showError('auth-error', '');
}

const TEACHER_REGISTRATION_CODE = 'fabian2026';

function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.role-btn[data-role="${role}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  const codeGroup = document.getElementById('teacher-code-group');
  const codeInput = document.getElementById('reg-teacher-code');
  if (codeGroup) codeGroup.classList.toggle('hidden', role !== 'lehrer');
  if (codeInput && role !== 'lehrer') codeInput.value = '';
}

async function login() {
  if (!db) return showError('auth-error', 'Datenbankverbindung fehlgeschlagen.');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!username || !password) return showError('auth-error', 'Bitte alle Felder ausfüllen.');

  const { data, error } = await db.from('users').select('*').eq('benutzername', username).eq('passwort', password).single();
  if (error || !data) return showError('auth-error', 'Ungültiger Benutzername oder Passwort.');

  currentUser = data;
  localStorage.setItem(USER_KEY, JSON.stringify(data));
  showError('auth-error', '');
  redirectToRoleHome();
}

async function register() {
  if (!db) return showError('auth-error', 'Datenbankverbindung fehlgeschlagen.');
  const vorname = document.getElementById('reg-vorname').value.trim();
  const nachname = document.getElementById('reg-nachname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim() || '0000';

  if (!vorname || !nachname || !username) return showError('auth-error', 'Bitte alle Felder ausfüllen.');

  if (selectedRole === 'lehrer') {
    const code = document.getElementById('reg-teacher-code').value.trim();
    if (!code) return showError('auth-error', 'Bitte gib den Lehrer-Code ein.');
    if (code !== TEACHER_REGISTRATION_CODE) return showError('auth-error', 'Ungültiger Lehrer-Code.');
  }

  const { data, error } = await db.from('users').insert({
    vorname, nachname, benutzername: username, passwort: password, rolle: selectedRole
  }).select().single();

  if (error) {
    if (error.code === '23505') return showError('auth-error', 'Benutzername bereits vergeben.');
    return showError('auth-error', 'Fehler bei der Registrierung.');
  }

  currentUser = data;
  localStorage.setItem(USER_KEY, JSON.stringify(data));
  showError('auth-error', '');
  redirectToRoleHome();
}

function logout() {
  currentUser = null;
  localStorage.removeItem(USER_KEY);
  window.location.href = 'index.html';
}

function showLoggedInState() {
  const badge = document.getElementById('logged-in-user');
  if (badge && currentUser) {
    badge.textContent = currentUser.vorname + ' ' + currentUser.nachname;
    badge.classList.remove('hidden');
  }
  const lo = document.getElementById('logout-btn');
  if (lo) lo.style.display = '';
}

// ============================================================
// DATA (localStorage)
// ============================================================
function loadData() {
  const v = localStorage.getItem(VOCABULARIES_KEY);
  const r = localStorage.getItem(PRACTICE_RESULTS_KEY);
  vocabularies = v ? JSON.parse(v) : [];
  practiceResults = r ? JSON.parse(r) : [];
}

function saveVocabularies() { localStorage.setItem(VOCABULARIES_KEY, JSON.stringify(vocabularies)); }
function savePracticeResults() { localStorage.setItem(PRACTICE_RESULTS_KEY, JSON.stringify(practiceResults)); }

// ============================================================
// STATS
// ============================================================
function updateStats() {
  const total = vocabularies.length;
  const practiced = practiceResults.length;
  const known = practiceResults.filter(r => r.known).length;
  const pct = practiced > 0 ? Math.round((known / practiced) * 100) : 0;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total', total);
  set('stat-practiced', practiced);
  set('stat-known', known);
  set('stat-percentage', pct + '%');
  const hasVocabs = total > 0;
  const sb = document.getElementById('start-btn'); if (sb) sb.disabled = !hasVocabs;
  const pb = document.getElementById('probe-btn'); if (pb) pb.disabled = !hasVocabs;
}

function showStatsModal() {
  document.getElementById('stats-modal').classList.remove('hidden');
  renderBarChart();
}

function hideStatsModal() { document.getElementById('stats-modal').classList.add('hidden'); }

function renderBarChart() {
  const chartContainer = document.getElementById('bar-chart');
  const lessonMap = new Map();
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) lessonMap.set(v.lesson_number, { total: 0, known: 0, unknown: 0 });
    lessonMap.get(v.lesson_number).total++;
  });
  practiceResults.forEach(r => {
    const vocab = vocabularies.find(v => v.id === r.vocabulary_id);
    if (vocab && lessonMap.has(vocab.lesson_number)) {
      const s = lessonMap.get(vocab.lesson_number);
      if (r.known) s.known++; else s.unknown++;
    }
  });
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  if (lessons.length === 0) { chartContainer.innerHTML = '<p class="no-stats">Noch keine Vokabeln geladen.</p>'; return; }
  const maxVal = Math.max(...lessons.map(([_, s]) => s.known + s.unknown), 1);
  chartContainer.innerHTML = `
    <div class="chart-container">
      <div class="chart-y-axis"><span>${maxVal}</span><span>${Math.round(maxVal / 2)}</span><span>0</span></div>
      <div class="chart-bars">
        ${lessons.map(([num, s]) => {
          const kh = (s.known / maxVal) * 100;
          const uh = (s.unknown / maxVal) * 100;
          return `<div class="bar-group"><div class="bar-stack" title="Lektion ${num}: ${s.known} gewusst, ${s.unknown} nicht gewusst"><div class="bar known" style="height:${kh}%"></div><div class="bar unknown" style="height:${uh}%"></div></div><span class="bar-label">L${num}</span></div>`;
        }).join('')}
      </div>
    </div>`;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function on(id, evt, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, fn);
}

function setupLoginListeners() {
  on('login-password', 'keydown', e => { if (e.key === 'Enter') login(); });
}

function setupCommonAppListeners() {
  // CSV-Upload wurde entfernt – Vokabeln nur noch über Bücher wählbar.
}

function setupSchuelerListeners() {
  setupCommonAppListeners();
  on('show-stats-btn', 'click', showStatsModal);
  on('close-stats-btn', 'click', hideStatsModal);
  on('stats-modal-overlay', 'click', hideStatsModal);
  on('select-all-btn', 'click', selectAllLessons);
  on('deselect-all-btn', 'click', deselectAllLessons);
  on('flashcard', 'click', flipCard);
  on('known-btn', 'click', () => answerCard(true));
  on('unknown-btn', 'click', () => answerCard(false));
  on('practice-again-btn', 'click', () => {
    if (selectedLessons.length === 0) { showView('select-view'); renderLessons(); }
    else startPractice();
  });
  on('practice-wrong-btn', 'click', practiceWrongCards);
  on('back-home-btn', 'click', goHome);
  on('probe-input', 'keydown', e => { if (e.key === 'Enter') submitProbeAnswer(); });
  on('student-input', 'keydown', e => { if (e.key === 'Enter') submitStudentAnswer(); });
  on('student-test-id', 'keydown', e => { if (e.key === 'Enter') studentJoinTest(); });
}

function setupLehrerListeners() {
  setupCommonAppListeners();
  on('new-class-name', 'keydown', e => { if (e.key === 'Enter') createClass(); });
  setupStudentSearch();
}

// ============================================================
// CSV PROCESSING
// ============================================================
function processCSVText(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const startIndex = lines[0].toLowerCase().includes('latein') ? 1 : 0;
  const newVocabs = [];
  for (let i = startIndex; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i].trim());
    if (parts.length >= 4) {
      const lessonNum = parseInt(parts[parts.length - 1].trim(), 10);
      if (isNaN(lessonNum)) continue;
      const germanParts = parts.slice(2, parts.length - 1);
      newVocabs.push({
        id: generateId(),
        latin_word: parts[0].trim(),
        forms: parts[1].trim() || null,
        german_translation: germanParts.join('; ').trim(),
        lesson_number: lessonNum,
        created_at: new Date().toISOString()
      });
    }
  }
  return newVocabs;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if ((c === ',' || c === ';') && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += c;
  }
  if (current.length > 0 || result.length > 0) result.push(current.trim());
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

function showUploadStatus(message, type) {
  const el = document.getElementById('upload-status');
  if (!el) return;
  el.textContent = message; el.className = type;
}

function generateId() { return Math.random().toString(36).substr(2, 9) + Date.now().toString(36); }

// ============================================================
// PRESET VOCABULARIES
// ============================================================
function loadPresetVocabularies() {
  const container = document.getElementById('preset-container');
  if (!container) return;
  fetch('vocabs/manifest.json')
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(presets => {
      if (!presets || presets.length === 0) {
        container.innerHTML = '<p class="text-muted">Keine Bücher verfügbar.</p>';
        return;
      }
      container.innerHTML = presets.map((p, i) => {
        const initials = (p.name || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 3).toUpperCase();
        const coverHtml = p.cover
          ? `<img class="book-cover" src="vocabs/${esc(p.cover)}" alt="${esc(p.name)}" onerror="this.outerHTML='<div class=\\'book-cover-fallback\\'>${esc(initials)}</div>'">`
          : `<div class="book-cover-fallback">${esc(initials)}</div>`;
        return `
          <button class="book-card" data-idx="${i}">
            ${coverHtml}
            <div class="book-info">
              <div class="book-title">${esc(p.name)}</div>
              ${p.description ? `<div class="book-desc">${esc(p.description)}</div>` : ''}
            </div>
          </button>`;
      }).join('');
      container.querySelectorAll('.book-card').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const preset = presets[idx];
          loadPresetFile(preset.file, preset.name, btn);
        });
      });
    })
    .catch(() => { container.innerHTML = '<p class="text-muted">Keine Bücher gefunden.</p>'; });
}

function loadPresetFile(filename, name, btn) {
  if (btn) btn.disabled = true;
  fetch('vocabs/' + filename)
    .then(res => { if (!res.ok) throw new Error(); return res.text(); })
    .then(text => {
      const nv = processCSVText(text);
      if (nv.length > 0) {
        vocabularies = nv; practiceResults = []; selectedLessons = [];
        saveVocabularies(); savePracticeResults(); updateStats();
        showUploadStatus(nv.length + " Vokabeln aus '" + (name || filename) + "' geladen!", 'success');
      } else showUploadStatus('Keine gültigen Vokabeln in dieser Datei.', 'error');
      if (btn) btn.disabled = false;
    })
    .catch(() => { showUploadStatus('Fehler beim Laden der Datei.', 'error'); if (btn) btn.disabled = false; });
}

// ============================================================
// FLASHCARD PRACTICE
// ============================================================
function renderLessons() {
  const grid = document.getElementById('lessons-grid');
  const map = new Map();
  vocabularies.forEach(v => { map.set(v.lesson_number, (map.get(v.lesson_number) || 0) + 1); });
  const lessons = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  grid.innerHTML = lessons.map(([num, count]) => `
    <div class="lesson-item ${selectedLessons.includes(num) ? 'selected' : ''}" onclick="toggleLesson(${num})">
      <div class="lesson-number">L${num}</div>
      <div class="lesson-count">${count} Vokabeln</div>
    </div>`).join('');
  document.getElementById('start-practice-btn').disabled = selectedLessons.length === 0;
}

function toggleLesson(num) {
  const i = selectedLessons.indexOf(num);
  if (i > -1) selectedLessons.splice(i, 1); else selectedLessons.push(num);
  renderLessons();
}
function selectAllLessons() { selectedLessons = [...new Set(vocabularies.map(v => v.lesson_number))]; renderLessons(); }
function deselectAllLessons() { selectedLessons = []; renderLessons(); }

function startPractice() {
  currentPracticeCards = vocabularies.filter(v => selectedLessons.includes(v.lesson_number)).sort(() => Math.random() - 0.5);
  if (currentPracticeCards.length === 0) { alert('Keine Vokabeln gefunden.'); return; }
  currentCardIndex = 0;
  sessionResults = { known: 0, unknown: 0, wrongCards: [] };
  showView('practice-view');
  document.getElementById('practice-container').classList.remove('hidden');
  document.getElementById('results-view').classList.add('hidden');
  showCard();
}

function showCard() {
  if (currentCardIndex >= currentPracticeCards.length) { showFlashcardResults(); return; }
  const card = currentPracticeCards[currentCardIndex];
  const fc = document.getElementById('flashcard');
  fc.classList.remove('flipped');
  document.getElementById('answer-buttons').classList.add('hidden');
  document.getElementById('latin-word').textContent = card.latin_word;
  document.getElementById('german-word').textContent = card.german_translation;
  document.getElementById('german-forms').textContent = card.forms || '';
  document.getElementById('progress-text').textContent = `Karte ${currentCardIndex + 1} von ${currentPracticeCards.length}`;
  document.getElementById('progress-fill').style.width = ((currentCardIndex + 1) / currentPracticeCards.length * 100) + '%';
}

function flipCard() {
  const fc = document.getElementById('flashcard');
  if (!fc.classList.contains('flipped')) {
    fc.classList.add('flipped');
    document.getElementById('answer-buttons').classList.remove('hidden');
  }
}

function answerCard(known) {
  const card = currentPracticeCards[currentCardIndex];
  practiceResults.push({ id: generateId(), vocabulary_id: card.id, known, practiced_at: new Date().toISOString() });
  savePracticeResults();
  if (known) sessionResults.known++; else { sessionResults.unknown++; sessionResults.wrongCards.push(card); }
  currentCardIndex++;
  // Karte erst zurückdrehen, dann nach der Animation neuen Inhalt zeigen
  const fc = document.getElementById('flashcard');
  fc.classList.remove('flipped');
  document.getElementById('answer-buttons').classList.add('hidden');
  setTimeout(() => showCard(), 450);
}

function showFlashcardResults() {
  document.getElementById('practice-container').classList.add('hidden');
  document.getElementById('results-view').classList.remove('hidden');
  const total = sessionResults.known + sessionResults.unknown;
  const pct = total > 0 ? Math.round((sessionResults.known / total) * 100) : 0;
  document.getElementById('result-total').textContent = total;
  document.getElementById('result-known').textContent = sessionResults.known;
  document.getElementById('result-unknown').textContent = sessionResults.unknown;
  document.getElementById('result-percentage').textContent = pct + '%';
  const wrongBtn = document.getElementById('practice-wrong-btn');
  if (sessionResults.wrongCards.length > 0) {
    wrongBtn.classList.remove('hidden');
    wrongBtn.textContent = 'Falsche wiederholen (' + sessionResults.wrongCards.length + ')';
  } else wrongBtn.classList.add('hidden');
  updateStats();
}

function practiceWrongCards() {
  if (sessionResults.wrongCards.length === 0) return;
  currentPracticeCards = [...sessionResults.wrongCards].sort(() => Math.random() - 0.5);
  currentCardIndex = 0;
  sessionResults = { known: 0, unknown: 0, wrongCards: [] };
  document.getElementById('practice-container').classList.remove('hidden');
  document.getElementById('results-view').classList.add('hidden');
  showCard();
}

// ============================================================
// PROBE TEST
// ============================================================
function showProbeSelect() {
  probeSelectedLessons = [];
  showView('probe-select-view');
  renderProbeLessons();
}

function renderProbeLessons() {
  const grid = document.getElementById('probe-lessons-grid');
  const map = new Map();
  vocabularies.forEach(v => { map.set(v.lesson_number, (map.get(v.lesson_number) || 0) + 1); });
  const lessons = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  grid.innerHTML = lessons.map(([num, count]) => `
    <div class="lesson-item ${probeSelectedLessons.includes(num) ? 'selected' : ''}" onclick="toggleProbeLesson(${num})">
      <div class="lesson-number">L${num}</div>
      <div class="lesson-count">${count} Vokabeln</div>
    </div>`).join('');
  document.getElementById('start-probe-btn').disabled = probeSelectedLessons.length === 0;
}

function toggleProbeLesson(num) {
  const i = probeSelectedLessons.indexOf(num);
  if (i > -1) probeSelectedLessons.splice(i, 1); else probeSelectedLessons.push(num);
  renderProbeLessons();
}
function probeSelectAll() { probeSelectedLessons = [...new Set(vocabularies.map(v => v.lesson_number))]; renderProbeLessons(); }
function probeDeselectAll() { probeSelectedLessons = []; renderProbeLessons(); }

function startProbeTest() {
  const pool = vocabularies.filter(v => probeSelectedLessons.includes(v.lesson_number));
  probeCards = pool.sort(() => Math.random() - 0.5).slice(0, 10);
  probeIndex = 0; probeAnswers = [];
  showView('probe-test-view');
  showProbeCard();
}

function showProbeCard() {
  if (probeIndex >= probeCards.length) { showProbeResults(); return; }
  const card = probeCards[probeIndex];
  document.getElementById('probe-latin-word').textContent = card.latin_word;
  document.getElementById('probe-forms').textContent = '';
  const formsInput = document.getElementById('probe-forms-input');
  if (card.forms && card.forms !== '-') {
    formsInput.style.display = '';
    formsInput.value = '';
  } else {
    formsInput.style.display = 'none';
  }
  document.getElementById('probe-input').value = '';
  document.getElementById('probe-forms-input').focus();
  document.getElementById('probe-progress-text').textContent = `Frage ${probeIndex + 1} von ${probeCards.length}`;
  document.getElementById('probe-progress-fill').style.width = ((probeIndex + 1) / probeCards.length * 100) + '%';
}

// Articles and words to strip from translations
const STRIP_WORDS = ['der', 'die', 'das', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen'];

function normalizeTranslation(str) {
  // Remove all special chars except letters (incl. äöüß) and spaces
  return str.toLowerCase().replace(/[^a-zäöüß\s]/g, '').replace(/\s+/g, ' ').trim();
}

function extractValidAnswers(germanTranslation) {
  // Split by comma to get individual answer options
  const parts = germanTranslation.split(',');
  const answers = [];
  for (const part of parts) {
    let normalized = normalizeTranslation(part);
    // Remove articles/strip words from beginning
    const words = normalized.split(' ').filter(w => !STRIP_WORDS.includes(w));
    const cleaned = words.join(' ').trim();
    if (cleaned.length > 0) answers.push(cleaned);
  }
  return answers;
}

function checkAnswer(input, germanTranslation) {
  const validAnswers = extractValidAnswers(germanTranslation);
  const normalizedInput = normalizeTranslation(input);
  // Remove articles from input too
  const inputWords = normalizedInput.split(' ').filter(w => !STRIP_WORDS.includes(w));
  const cleanedInput = inputWords.join(' ');
  // Check if input contains at least one valid answer
  return validAnswers.some(answer => cleanedInput.includes(answer));
}

function normalizeForms(str) {
  // Remove spaces, commas, and special chars; lowercase
  return str.toLowerCase().replace(/[^a-zäöüß]/g, '');
}

function checkForms(input, correctForms) {
  if (!correctForms || correctForms === '-') return true; // No forms required
  return normalizeForms(input) === normalizeForms(correctForms);
}

function submitProbeAnswer() {
  const input = document.getElementById('probe-input').value;
  const formsInput = document.getElementById('probe-forms-input').value;
  if (!input.trim()) return;
  const card = probeCards[probeIndex];
  const translationCorrect = checkAnswer(input, card.german_translation);
  const formsCorrect = (!card.forms || card.forms === '-') ? true : checkForms(formsInput, card.forms);
  const correct = translationCorrect && formsCorrect;
  probeAnswers.push({
    latin: card.latin_word, answer: input, formsAnswer: formsInput,
    correctAnswers: card.german_translation, correctForms: card.forms || '-',
    isCorrect: correct, translationCorrect, formsCorrect
  });
  probeIndex++;
  showProbeCard();
}

function showProbeResults() {
  const score = probeAnswers.filter(a => a.isCorrect).length;
  document.getElementById('probe-score').textContent = `${score} / ${probeAnswers.length}`;
  document.getElementById('probe-results-body').innerHTML = probeAnswers.map(a => `
    <tr class="${a.isCorrect ? 'row-correct' : 'row-wrong'}">
      <td>${esc(a.latin)}</td>
      <td>${esc(a.formsAnswer || '')}${a.correctForms !== '-' ? ' <small>(richtig: ' + esc(a.correctForms) + ')</small>' : ''}</td>
      <td>${esc(a.answer)}</td><td>${esc(a.correctAnswers)}</td>
      <td>${a.isCorrect ? '&#10003;' : '&#10007;'}</td>
    </tr>`).join('');
  showView('probe-results-view');
}

// ============================================================
// TEACHER: DASHBOARD
// ============================================================
async function loadTeacherDashboard() {
  if (!db || !currentUser || currentUser.rolle !== 'lehrer') return;
  const { data } = await db.from('classes').select('*').eq('teacher_id', currentUser.id).order('created_at');
  const container = document.getElementById('classes-list');
  if (!data || data.length === 0) { container.innerHTML = '<p class="text-muted">Noch keine Klassen angelegt.</p>'; return; }
  container.innerHTML = data.map(c => `
    <div class="card-item" onclick="selectClass('${c.id}', '${esc(c.name)}')">
      <h4>${esc(c.name)}</h4>
      <p class="text-muted">Erstellt: ${new Date(c.created_at).toLocaleDateString('de-DE')}</p>
    </div>`).join('');
}

async function createClass() {
  if (!db || !currentUser) return;
  const name = document.getElementById('new-class-name').value.trim();
  if (!name) return;
  await db.from('classes').insert({ teacher_id: currentUser.id, name });
  document.getElementById('new-class-name').value = '';
  loadTeacherDashboard();
}

function selectClass(id, name) {
  currentClassId = id;
  currentClassName = name;
  document.getElementById('class-title').textContent = name;
  showView('class-view');
  loadClassData();
}

async function deleteClass() {
  if (!confirm('Klasse "' + currentClassName + '" und alle zugehörigen Daten löschen?')) return;
  await db.from('classes').delete().eq('id', currentClassId);
  showView('teacher-dashboard-view');
  loadTeacherDashboard();
}

// ============================================================
// TEACHER: CLASS DATA (Students + Tests)
// ============================================================
async function loadClassData() {
  await loadClassStudents();
  await loadClassTests();
}

async function loadClassStudents() {
  const { data: members } = await db.from('class_members')
    .select('*, users(*)')
    .eq('class_id', currentClassId);
  const container = document.getElementById('class-students-list');
  if (!members || members.length === 0) {
    container.innerHTML = '<p class="text-muted">Noch keine Schüler in dieser Klasse.</p>';
    return;
  }
  container.innerHTML = members.map(m => `
    <div class="student-list-item">
      <span>${esc(m.users.vorname)} ${esc(m.users.nachname)} (${esc(m.users.benutzername)})</span>
      <div style="display:flex; gap:0.4rem;">
        <button class="btn btn-secondary btn-small" onclick="resetStudentPassword('${m.users.id}', '${esc(m.users.vorname + ' ' + m.users.nachname)}')">Passwort zurücksetzen</button>
        <button class="btn btn-danger btn-small" onclick="removeStudent('${m.id}')">Entfernen</button>
      </div>
    </div>`).join('');
}

async function resetStudentPassword(studentId, name) {
  const newPw = prompt(`Neues temporäres Passwort für ${name} festlegen (mind. 4 Zeichen):`, 'start1234');
  if (!newPw) return;
  if (newPw.length < 4) { alert('Passwort braucht mindestens 4 Zeichen.'); return; }
  const { error } = await db.from('users').update({ passwort: newPw }).eq('id', studentId);
  if (error) { alert('Fehler beim Zurücksetzen.'); return; }
  alert(`Passwort für ${name} wurde auf „${newPw}" gesetzt. Bitte gib es weiter – der Schüler sollte es danach im Profil sofort selbst ändern.`);
}
window.resetStudentPassword = resetStudentPassword;

function setupStudentSearch() {
  const input = document.getElementById('student-search-input');
  const dropdown = document.getElementById('student-search-dropdown');
  if (!input || !dropdown) return;
  input.addEventListener('focus', () => renderStudentSearch(input.value));
  input.addEventListener('input', () => renderStudentSearch(input.value));
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

async function renderStudentSearch(query) {
  const dropdown = document.getElementById('student-search-dropdown');
  if (!dropdown) return;
  if (!db) {
    dropdown.innerHTML = '<div class="dropdown-empty">Keine Datenbankverbindung.</div>';
    dropdown.classList.remove('hidden');
    return;
  }
  if (!currentClassId) { dropdown.classList.add('hidden'); return; }

  // Alle Schüler laden
  const { data: students, error: studErr } = await db
    .from('users')
    .select('id, vorname, nachname, benutzername')
    .eq('rolle', 'schueler');

  if (studErr) {
    console.error('Schüler-Suche Fehler:', studErr);
    dropdown.innerHTML = `<div class="dropdown-empty">Fehler beim Laden: ${esc(studErr.message || 'Unbekannt')}</div>`;
    dropdown.classList.remove('hidden');
    return;
  }
  if (!students || students.length === 0) {
    dropdown.innerHTML = '<div class="dropdown-empty">Es sind keine Schüler registriert.</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  // Bereits in der Klasse: ausschließen
  const { data: members } = await db.from('class_members').select('student_id').eq('class_id', currentClassId);
  const inClass = new Set((members || []).map(m => m.student_id));

  const q = (query || '').toLowerCase().trim();
  const filtered = students
    .filter(s => !inClass.has(s.id))
    .filter(s => {
      if (!q) return true;
      return (s.vorname || '').toLowerCase().includes(q)
        || (s.nachname || '').toLowerCase().includes(q)
        || (s.benutzername || '').toLowerCase().includes(q);
    })
    .slice(0, 50);

  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="dropdown-empty">Keine passenden Schüler gefunden.</div>';
  } else {
    dropdown.innerHTML = filtered.map(s =>
      `<div class="dropdown-item" onclick="addStudentById('${s.id}')">
         <strong>${esc(s.vorname)} ${esc(s.nachname)}</strong>
         <span class="text-muted"> · ${esc(s.benutzername)}</span>
       </div>`
    ).join('');
  }
  dropdown.classList.remove('hidden');
}

async function addStudentById(studentId) {
  showError('add-student-error', '');
  const { error: insertErr } = await db.from('class_members').insert({ class_id: currentClassId, student_id: studentId });
  if (insertErr) {
    if (insertErr.code === '23505') return showError('add-student-error', 'Schüler bereits in der Klasse.');
    return showError('add-student-error', 'Fehler beim Hinzufügen.');
  }
  document.getElementById('student-search-input').value = '';
  document.getElementById('student-search-dropdown').classList.add('hidden');
  loadClassStudents();
}

async function removeStudent(memberId) {
  if (!confirm('Schüler aus der Klasse entfernen?')) return;
  await db.from('class_members').delete().eq('id', memberId);
  loadClassStudents();
}

async function loadClassTests() {
  const { data: tests } = await db.from('tests').select('*').eq('class_id', currentClassId).order('created_at', { ascending: false });
  const container = document.getElementById('tests-list');
  if (!tests || tests.length === 0) { container.innerHTML = '<p class="text-muted">Noch keine Tests erstellt.</p>'; return; }
  let html = '';
  for (const t of tests) {
    const { count } = await db.from('results').select('*', { count: 'exact', head: true }).eq('test_id', t.id);
    html += `
      <div class="card-item" onclick="openTestDetail('${t.id}')">
        <h4>${esc(t.name)}</h4>
        <p class="text-muted">ID: ${t.id} · ${t.question_count} Fragen · ${count || 0} Ergebnisse</p>
      </div>`;
  }
  container.innerHTML = html;
}

// ============================================================
// TEACHER: TEST CREATION
// ============================================================
function renderTestLessons() {
  testSelectedLessons = [];
  const grid = document.getElementById('test-lessons-grid');
  const map = new Map();
  vocabularies.forEach(v => { map.set(v.lesson_number, (map.get(v.lesson_number) || 0) + 1); });
  const lessons = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  if (lessons.length === 0) {
    grid.innerHTML = '<p class="text-muted">Bitte zuerst Vokabeln auf der Startseite laden.</p>';
    return;
  }
  grid.innerHTML = lessons.map(([num, count]) => `
    <div class="lesson-item" data-lesson="${num}" onclick="toggleTestLesson(${num})">
      <div class="lesson-number">L${num}</div>
      <div class="lesson-count">${count} Vokabeln</div>
    </div>`).join('');
}

function toggleTestLesson(num) {
  const i = testSelectedLessons.indexOf(num);
  if (i > -1) testSelectedLessons.splice(i, 1); else testSelectedLessons.push(num);
  document.querySelectorAll('#test-lessons-grid .lesson-item').forEach(el => {
    el.classList.toggle('selected', testSelectedLessons.includes(parseInt(el.dataset.lesson)));
  });
}
function testSelectAll() {
  testSelectedLessons = [...new Set(vocabularies.map(v => v.lesson_number))];
  document.querySelectorAll('#test-lessons-grid .lesson-item').forEach(el => el.classList.add('selected'));
}
function testDeselectAll() {
  testSelectedLessons = [];
  document.querySelectorAll('#test-lessons-grid .lesson-item').forEach(el => el.classList.remove('selected'));
}

async function createTest() {
  const name = document.getElementById('test-name').value.trim();
  const count = parseInt(document.getElementById('test-question-count').value);
  if (!name) return alert('Bitte einen Testnamen eingeben.');
  if (testSelectedLessons.length === 0) return alert('Bitte mindestens eine Lektion auswählen.');
  if (!count || count < 1) return alert('Ungültige Fragenanzahl.');

  const pool = vocabularies.filter(v => testSelectedLessons.includes(v.lesson_number));
  const selected = pool.sort(() => Math.random() - 0.5).slice(0, count);
  if (selected.length === 0) return alert('Keine Vokabeln in den gewählten Lektionen.');

  const testId = generateTestId();
  const { error } = await db.from('tests').insert({
    id: testId, class_id: currentClassId, name,
    lesson_numbers: testSelectedLessons, question_count: selected.length, vocab_data: selected
  });
  if (error) return alert('Fehler beim Erstellen des Tests.');

  alert('Test erstellt! Test-ID: ' + testId);
  document.getElementById('test-name').value = '';
  showView('class-view');
  loadClassData();
}

function generateTestId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ============================================================
// TEACHER: TEST DETAIL
// ============================================================
async function openTestDetail(testId) {
  currentTestId = testId;
  const { data: test } = await db.from('tests').select('*').eq('id', testId).single();
  if (!test) return alert('Test nicht gefunden.');
  document.getElementById('test-detail-title').textContent = test.name;
  document.getElementById('test-detail-id').textContent = testId;
  showView('test-detail-view');
  await loadTestResults();
  await loadAppeals();
}

async function loadTestResults() {
  const { data: results } = await db.from('results').select('*, users(vorname, nachname)').eq('test_id', currentTestId).order('created_at');
  const tbody = document.getElementById('test-results-body');
  if (!results || results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Noch keine Ergebnisse.</td></tr>';
    return;
  }
  tbody.innerHTML = results.map(r => {
    const name = r.users ? r.users.vorname + ' ' + r.users.nachname : 'Unbekannt';
    return `<tr>
      <td>${esc(name)}</td>
      <td>${r.score} / ${r.total}</td>
      <td>${new Date(r.created_at).toLocaleDateString('de-DE')}</td>
      <td><button class="btn btn-secondary btn-small" onclick="viewStudentAnswers('${r.id}', '${esc(name)}', ${r.score}, ${r.total})">Details</button></td>
    </tr>`;
  }).join('');
}

async function loadAppeals() {
  const { data: results } = await db.from('results').select('id').eq('test_id', currentTestId);
  if (!results || results.length === 0) {
    document.getElementById('appeals-body').innerHTML = '';
    document.getElementById('no-appeals').classList.remove('hidden');
    return;
  }
  const resultIds = results.map(r => r.id);
  const { data: appeals } = await db.from('appeals').select('*, answers(*), users(vorname, nachname)').in('result_id', resultIds);
  if (!appeals || appeals.length === 0) {
    document.getElementById('appeals-body').innerHTML = '';
    document.getElementById('no-appeals').classList.remove('hidden');
    return;
  }
  document.getElementById('no-appeals').classList.add('hidden');
  document.getElementById('appeals-body').innerHTML = appeals.map(a => {
    const name = a.users ? a.users.vorname + ' ' + a.users.nachname : 'Unbekannt';
    return `<tr>
      <td>${esc(name)}</td>
      <td>${a.answers ? esc(a.answers.latin_word) : '-'}</td>
      <td>${a.answers ? esc(a.answers.student_answer) : '-'}</td>
      <td>${a.answers ? esc(a.answers.correct_answers) : '-'}</td>
      <td>
        <button class="btn btn-success btn-small" onclick="approveAppeal('${a.id}','${a.answer_id}','${a.result_id}')">Ja</button>
        <button class="btn btn-danger btn-small" onclick="rejectAppeal('${a.id}')">Nein</button>
      </td>
    </tr>`;
  }).join('');
}

async function approveAppeal(appealId, answerId, resultId) {
  await db.from('answers').update({ is_correct: true }).eq('id', answerId);
  const { data: result } = await db.from('results').select('score').eq('id', resultId).single();
  if (result) await db.from('results').update({ score: result.score + 1 }).eq('id', resultId);
  await db.from('appeals').delete().eq('id', appealId);
  await loadTestResults();
  await loadAppeals();
}

async function rejectAppeal(appealId) {
  await db.from('appeals').delete().eq('id', appealId);
  await loadAppeals();
}

async function viewStudentAnswers(resultId, name, score, total) {
  document.getElementById('student-answers-name').textContent = name;
  document.getElementById('student-answers-score').textContent = `${score} / ${total}`;
  const { data: answers } = await db.from('answers').select('*').eq('result_id', resultId);
  const tbody = document.getElementById('student-answers-body');
  if (!answers || answers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Keine Antworten.</td></tr>';
  } else {
    tbody.innerHTML = answers.map(a => `
      <tr class="${a.is_correct ? 'row-correct' : 'row-wrong'}">
        <td>${esc(a.latin_word)}</td><td>${esc(a.student_answer)}</td><td>${esc(a.correct_answers)}</td>
        <td>${a.is_correct ? '&#10003;' : '&#10007;'}</td>
      </tr>`).join('');
  }
  showView('student-answers-view');
}

function backToTestDetail() {
  showView('test-detail-view');
  loadTestResults();
  loadAppeals();
}

async function deleteTest() {
  if (!confirm('Diesen Test und alle Ergebnisse unwiderruflich löschen?')) return;
  await db.from('tests').delete().eq('id', currentTestId);
  showView('class-view');
  loadClassData();
}

// ============================================================
// STUDENT: DASHBOARD
// ============================================================
async function loadStudentDashboard() {
  if (!db || !currentUser) return;
  const { data: results } = await db.from('results')
    .select('*, tests(name, id)')
    .eq('student_id', currentUser.id)
    .order('created_at', { ascending: false });
  const container = document.getElementById('student-results-list');
  if (!results || results.length === 0) {
    container.innerHTML = '<p class="text-muted">Noch keine Tests absolviert.</p>';
    return;
  }
  container.innerHTML = `<div class="table-wrap"><table class="results-table">
    <thead><tr><th>Test</th><th>Ergebnis</th><th>Datum</th></tr></thead>
    <tbody>${results.map(r => `
      <tr>
        <td>${r.tests ? esc(r.tests.name) : r.test_id}</td>
        <td>${r.score} / ${r.total}</td>
        <td>${new Date(r.created_at).toLocaleDateString('de-DE')}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

// ============================================================
// STUDENT: JOIN + TEST
// ============================================================
async function studentJoinTest() {
  if (!db || !currentUser) return;
  const testId = document.getElementById('student-test-id').value.trim().toUpperCase();
  if (!testId) return showError('student-join-error', 'Bitte die Test-ID eingeben.');

  const { data: test, error } = await db.from('tests').select('*').eq('id', testId).single();
  if (error || !test) return showError('student-join-error', 'Test nicht gefunden. Prüfe die ID.');

  showError('student-join-error', '');
  studentTestData = test;
  studentCards = [...test.vocab_data].sort(() => Math.random() - 0.5);
  studentIndex = 0;
  studentAnswers = [];
  showView('student-test-view');
  showStudentCard();
}

function showStudentCard() {
  if (studentIndex >= studentCards.length) { submitStudentTest(); return; }
  const card = studentCards[studentIndex];
  document.getElementById('student-latin-word').textContent = card.latin_word;
  document.getElementById('student-forms').textContent = '';
  const formsInput = document.getElementById('student-forms-input');
  if (card.forms && card.forms !== '-') {
    formsInput.style.display = '';
    formsInput.value = '';
  } else {
    formsInput.style.display = 'none';
  }
  document.getElementById('student-input').value = '';
  document.getElementById('student-forms-input').focus();
  document.getElementById('student-progress-text').textContent = `Frage ${studentIndex + 1} von ${studentCards.length}`;
  document.getElementById('student-progress-fill').style.width = ((studentIndex + 1) / studentCards.length * 100) + '%';
}

function submitStudentAnswer() {
  const input = document.getElementById('student-input').value;
  const formsInput = document.getElementById('student-forms-input').value;
  if (!input.trim()) return;
  const card = studentCards[studentIndex];
  const translationCorrect = checkAnswer(input, card.german_translation);
  const formsCorrect = (!card.forms || card.forms === '-') ? true : checkForms(formsInput, card.forms);
  const correct = translationCorrect && formsCorrect;
  studentAnswers.push({
    latin_word: card.latin_word, student_answer: input, forms_answer: formsInput,
    correct_answers: card.german_translation, correct_forms: card.forms || '-',
    is_correct: correct
  });
  studentIndex++;
  showStudentCard();
}

async function submitStudentTest() {
  const score = studentAnswers.filter(a => a.is_correct).length;
  const total = studentAnswers.length;

  const { data: result, error } = await db.from('results').insert({
    test_id: studentTestData.id, student_id: currentUser.id, score, total
  }).select().single();

  if (error || !result) { alert('Fehler beim Speichern.'); goHome(); return; }
  studentResultId = result.id;

  await db.from('answers').insert(studentAnswers.map(a => ({
    result_id: result.id, latin_word: a.latin_word,
    student_answer: a.student_answer, correct_answers: a.correct_answers, is_correct: a.is_correct
  })));

  showStudentResultsView(score, total);
}

function showStudentResultsView(score, total) {
  document.getElementById('student-score').textContent = `${score} / ${total}`;
  document.getElementById('student-results-body').innerHTML = studentAnswers.map((a, i) => `
    <tr class="${a.is_correct ? 'row-correct' : 'row-wrong'}">
      <td>${esc(a.latin_word)}</td>
      <td>${esc(a.forms_answer || '')}${a.correct_forms !== '-' ? ' <small>(richtig: ' + esc(a.correct_forms) + ')</small>' : ''}</td>
      <td>${esc(a.student_answer)}</td><td>${esc(a.correct_answers)}</td>
      <td>${a.is_correct ? '&#10003;' : '&#10007;'}</td>
      <td>${a.is_correct ? '' : '<button class="btn btn-warning btn-small" onclick="submitAppeal(' + i + ', this)">Einspruch</button>'}</td>
    </tr>`).join('');
  showView('student-results-view');
}

async function submitAppeal(index, btn) {
  const a = studentAnswers[index];
  const { data: answers } = await db.from('answers').select('id')
    .eq('result_id', studentResultId).eq('latin_word', a.latin_word).eq('student_answer', a.student_answer);
  if (!answers || answers.length === 0) return alert('Fehler beim Einreichen.');

  const { data: existing } = await db.from('appeals').select('id').eq('answer_id', answers[0].id);
  if (existing && existing.length > 0) { btn.textContent = 'Bereits eingereicht'; btn.disabled = true; return; }

  await db.from('appeals').insert({ answer_id: answers[0].id, result_id: studentResultId, student_id: currentUser.id });
  btn.textContent = 'Eingereicht';
  btn.disabled = true;
  btn.classList.remove('btn-warning');
  btn.classList.add('btn-secondary');
}

// ============================================================
// UTILITIES
// ============================================================
function showError(elementId, msg) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = msg;
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ============================================================
// ANALYSE PAGE
// ============================================================
function goAnalyseHome() {
  if (!currentUser) { window.location.href = 'index.html'; return; }
  window.location.href = currentUser.rolle === 'lehrer' ? 'lehrer.html' : 'schueler.html';
}

function setupAnalyseListeners() {
  on('analyse-input', 'keydown', e => { if (e.key === 'Enter') runAnalyse(); });
  // Bücher im Hintergrund laden, damit Suche funktioniert
  loadAllBooksForAnalysis();
  // Lehrer sehen Tabs (Suche + Formen-Check). Schüler nur Suche.
  if (currentUser && currentUser.rolle === 'lehrer') {
    const t = document.getElementById('analyse-tabs');
    if (t) t.classList.remove('hidden');
  }
  setAnalyseModeUI('search');
}

let ANALYSE_MODE = 'search';
function switchAnalyseMode(mode) {
  ANALYSE_MODE = mode;
  document.querySelectorAll('#analyse-tabs .tab').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  setAnalyseModeUI(mode);
  document.getElementById('analyse-results').innerHTML = '';
}

function setAnalyseModeUI(mode) {
  const sub = document.getElementById('analyse-subtitle');
  const hint = document.getElementById('analyse-hint');
  const input = document.getElementById('analyse-input');
  if (mode === 'forms') {
    if (sub) sub.textContent = 'Bestimmt eine flektierte Form. Diese Funktion ist noch in Entwicklung.';
    if (hint) hint.innerHTML = '<strong>Noch in Entwicklung.</strong> Beispiel: „amabam", „puellae", „sumus".';
    if (input) input.placeholder = 'z.B. amabam, puellae, sumus…';
  } else {
    if (sub) sub.textContent = 'Gib eine Vokabel (Grundform) ein und finde sie in den Büchern.';
    if (hint) hint.innerHTML = 'Tipp: Gib die Grundform ein (z.B. „videre"), nicht eine flektierte Form.';
    if (input) input.placeholder = 'z.B. videre, puella, amare…';
  }
}

let ALL_VOCABS_FOR_ANALYSIS = [];
async function loadAllBooksForAnalysis() {
  try {
    const res = await fetch('vocabs/manifest.json');
    const presets = await res.json();
    const all = [];
    for (const p of presets) {
      try {
        const txt = await (await fetch('vocabs/' + p.file)).text();
        const vs = processCSVText(txt).map(v => Object.assign({}, v, { book: p.name }));
        all.push(...vs);
      } catch {}
    }
    ALL_VOCABS_FOR_ANALYSIS = all;
  } catch {
    ALL_VOCABS_FOR_ANALYSIS = vocabularies.slice();
  }
}

function runAnalyse() {
  const input = document.getElementById('analyse-input');
  const out = document.getElementById('analyse-results');
  if (!input || !out) return;
  const query = input.value.trim();
  if (!query) { out.innerHTML = '<p class="analyse-empty">Bitte eine Eingabe machen.</p>'; return; }

  const isTeacher = currentUser && currentUser.rolle === 'lehrer';
  const vocabPool = ALL_VOCABS_FOR_ANALYSIS.length ? ALL_VOCABS_FOR_ANALYSIS : vocabularies;

  if (ANALYSE_MODE === 'forms' && isTeacher) {
    renderFormsCheck(query, vocabPool, out);
  } else {
    renderLemmaSearch(query, vocabPool, out, isTeacher);
  }
}

function renderLemmaSearch(query, vocabPool, out, showLesson) {
  if (typeof LatinAnalyzer === 'undefined') {
    out.innerHTML = '<p class="analyse-empty">Analyzer konnte nicht geladen werden.</p>'; return;
  }
  const hits = LatinAnalyzer.searchLemma(query, vocabPool);
  if (hits.length === 0) {
    out.innerHTML = `<div class="analyse-card"><p class="text-muted">Keine Vokabel zu „${esc(query)}" gefunden. Tipp: Gib die Grundform ein, z.B. „videre" statt „vidi".</p></div>`;
    return;
  }
  // Gruppieren nach Buch
  const byKey = new Map();
  for (const v of hits) {
    const k = (v.book || '') + '||' + v.latin_word + '||' + v.lesson_number;
    if (!byKey.has(k)) byKey.set(k, v);
  }
  let html = `<div class="analyse-card"><h4>Treffer (${byKey.size})</h4>`;
  for (const v of byKey.values()) {
    html += `<div class="vocab-hit">
      <div class="analyse-lemma">${esc(v.latin_word)}${v.forms && v.forms !== '-' ? ' <span class="text-muted" style="font-weight:400;">· ' + esc(v.forms) + '</span>' : ''}</div>
      <div class="analyse-trans">${esc(v.german_translation)}</div>
      ${showLesson ? `<div class="text-muted" style="font-size:0.8rem; margin-top:0.25rem;">${v.book ? esc(v.book) + ' · ' : ''}Lektion ${v.lesson_number}</div>` : (v.book ? `<div class="text-muted" style="font-size:0.8rem; margin-top:0.25rem;">${esc(v.book)}</div>` : '')}
    </div>`;
  }
  html += `</div>`;
  out.innerHTML = html;
}

function renderFormsCheck(query, vocabPool, out) {
  if (typeof LatinAnalyzer === 'undefined') {
    out.innerHTML = '<p class="analyse-empty">Analyzer konnte nicht geladen werden.</p>'; return;
  }
  const { analyses } = LatinAnalyzer.analyze(query);
  let html = `<div class="analyse-card" style="border-color: var(--warning);">
    <p style="margin:0; font-size:0.85rem; color: var(--warning);"><strong>Hinweis:</strong> Der Formen-Check ist noch in Entwicklung. Mehrdeutigkeiten und Falschbestimmungen sind möglich.</p>
  </div>`;
  html += `<div class="analyse-card"><h4>Bestimmung von „${esc(query)}"</h4>`;
  if (analyses.length === 0) {
    html += '<p class="text-muted">Keine Bestimmung gefunden. Bitte Schreibweise prüfen.</p>';
  } else {
    html += analyses.map(a => `<div style="margin: 0.4rem 0;"><span class="analyse-chip">${esc(LatinAnalyzer.formatAnalysis(a))}</span></div>`).join('');
  }
  html += `</div>`;
  // Auch Vokabeltreffer zeigen
  const hits = LatinAnalyzer.searchLemma(query, vocabPool);
  if (hits.length > 0) {
    const byKey = new Map();
    for (const v of hits) byKey.set((v.book || '') + '||' + v.latin_word, v);
    html += `<div class="analyse-card"><h4>Mögliche Vokabel-Treffer (${byKey.size})</h4>`;
    for (const v of byKey.values()) {
      html += `<div class="vocab-hit">
        <div class="analyse-lemma">${esc(v.latin_word)}</div>
        <div class="analyse-trans">${esc(v.german_translation)}</div>
        <div class="text-muted" style="font-size:0.8rem; margin-top:0.25rem;">${v.book ? esc(v.book) + ' · ' : ''}Lektion ${v.lesson_number}</div>
      </div>`;
    }
    html += `</div>`;
  }
  out.innerHTML = html;
}

window.switchAnalyseMode = switchAnalyseMode;

// ============================================================
// GREETING (personalisiert)
// ============================================================
function setGreeting() {
  const el = document.getElementById('greeting-title');
  if (!el || !currentUser) return;
  const h = new Date().getHours();
  const tod = h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  el.textContent = `${tod}, ${currentUser.vorname}`;
}

// ============================================================
// LERNFORTSCHRITT: Karteikarten gewichten (oft falsche zuerst)
// ============================================================
function getCardWeight(vocabId) {
  const rs = practiceResults.filter(r => r.vocabulary_id === vocabId);
  if (rs.length === 0) return 1; // neue Vokabeln normal
  const wrong = rs.filter(r => !r.known).length;
  // Mehr Fehler = höheres Gewicht
  return 1 + wrong * 1.5;
}
function weightedShuffle(arr) {
  return arr
    .map(v => ({ v, sortKey: Math.random() / getCardWeight(v.id) }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(x => x.v);
}

// Override startPractice to use weighted shuffle
const _origStartPractice = startPractice;
startPractice = function () {
  const pool = vocabularies.filter(v => selectedLessons.includes(v.lesson_number));
  if (pool.length === 0) { alert('Keine Vokabeln gefunden.'); return; }
  currentPracticeCards = weightedShuffle(pool);
  currentCardIndex = 0;
  sessionResults = { known: 0, unknown: 0, wrongCards: [] };
  showView('practice-view');
  document.getElementById('practice-container').classList.remove('hidden');
  document.getElementById('results-view').classList.add('hidden');
  showCard();
};

// ============================================================
// LEHRER-DASHBOARD: erweiterte Stats
// ============================================================
const _origLoadTeacherDashboard = loadTeacherDashboard;
loadTeacherDashboard = async function () {
  if (!db || !currentUser || currentUser.rolle !== 'lehrer') return;
  const { data: classes } = await db.from('classes').select('*').eq('teacher_id', currentUser.id).order('created_at');
  const container = document.getElementById('classes-list');
  if (!classes || classes.length === 0) {
    if (container) container.innerHTML = '<p class="text-muted">Noch keine Klassen angelegt.</p>';
  } else if (container) {
    container.innerHTML = classes.map(c => `
      <div class="card-item" onclick="selectClass('${c.id}', '${esc(c.name)}')">
        <h4>${esc(c.name)}</h4>
        <p class="text-muted">Erstellt: ${new Date(c.created_at).toLocaleDateString('de-DE')}</p>
      </div>`).join('');
  }
  // Stats
  const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setT('t-stat-classes', (classes || []).length);
  // Tests + Appeals zählen
  const classIds = (classes || []).map(c => c.id);
  if (classIds.length === 0) {
    setT('t-stat-tests', 0);
    setT('t-stat-appeals', 0);
    return;
  }
  const { data: tests } = await db.from('tests').select('id').in('class_id', classIds);
  setT('t-stat-tests', (tests || []).length);
  // Schüler insgesamt zählen (eindeutig)
  const { data: members } = await db.from('class_members').select('student_id').in('class_id', classIds);
  const uniqStudents = new Set((members || []).map(m => m.student_id));
  setT('t-stat-students', uniqStudents.size);
  const testIds = (tests || []).map(t => t.id);
  if (testIds.length === 0) { setT('t-stat-appeals', 0); return; }
  const { data: results } = await db.from('results').select('id').in('test_id', testIds);
  const resIds = (results || []).map(r => r.id);
  if (resIds.length === 0) { setT('t-stat-appeals', 0); return; }
  const { count } = await db.from('appeals').select('*', { count: 'exact', head: true }).in('result_id', resIds);
  setT('t-stat-appeals', count || 0);
};

// ============================================================
// PROFIL-SEITE
// ============================================================
function initProfilePage() {
  if (!currentUser) return;
  // Avatar + Name
  const av = document.getElementById('profil-avatar');
  const initials = ((currentUser.vorname || '?')[0] + (currentUser.nachname || '')[0]).toUpperCase();
  if (av) av.textContent = initials;
  const nm = document.getElementById('profil-name');
  if (nm) nm.textContent = `${currentUser.vorname} ${currentUser.nachname}`;
  const meta = document.getElementById('profil-meta');
  if (meta) meta.textContent = `${currentUser.benutzername} · ${currentUser.rolle === 'lehrer' ? 'Lehrer' : 'Schüler'}`;
  // Felder vorbelegen
  const v = document.getElementById('prof-vorname');
  const n = document.getElementById('prof-nachname');
  if (v) v.value = currentUser.vorname || '';
  if (n) n.value = currentUser.nachname || '';
  loadProfileClasses();
}

async function loadProfileClasses() {
  const el = document.getElementById('profil-classes-list');
  if (!el || !db || !currentUser) return;
  let classes = [];
  if (currentUser.rolle === 'lehrer') {
    const { data } = await db.from('classes').select('id,name').eq('teacher_id', currentUser.id).order('created_at');
    classes = data || [];
  } else {
    const { data } = await db.from('class_members').select('classes(id,name)').eq('student_id', currentUser.id);
    classes = (data || []).map(d => d.classes).filter(Boolean);
  }
  if (classes.length === 0) {
    el.innerHTML = '<p class="text-muted">Du bist in keiner Klasse.</p>';
    return;
  }

  // Für jede Klasse Tests + ggf. eigene Ergebnisse laden
  const classIds = classes.map(c => c.id);
  const { data: tests } = await db.from('tests').select('id,name,class_id,question_count,created_at').in('class_id', classIds).order('created_at', { ascending: false });
  const testsByClass = new Map();
  (tests || []).forEach(t => {
    if (!testsByClass.has(t.class_id)) testsByClass.set(t.class_id, []);
    testsByClass.get(t.class_id).push(t);
  });

  let myResults = new Map();
  if (currentUser.rolle !== 'lehrer' && tests && tests.length > 0) {
    const testIds = tests.map(t => t.id);
    const { data: results } = await db.from('results').select('test_id,score,total,created_at').eq('student_id', currentUser.id).in('test_id', testIds);
    (results || []).forEach(r => myResults.set(r.test_id, r));
  }

  el.innerHTML = classes.map(c => {
    const ts = testsByClass.get(c.id) || [];
    let inner;
    if (ts.length === 0) {
      inner = '<p class="text-muted" style="font-size:0.85rem; margin-top:0.5rem;">Noch keine Tests.</p>';
    } else {
      inner = `<ul class="profil-test-list">${ts.map(t => {
        const r = myResults.get(t.id);
        const status = r
          ? `<span class="badge badge-success">${r.score}/${r.total}</span>`
          : (currentUser.rolle === 'lehrer'
              ? `<span class="text-muted" style="font-size:0.8rem;">${t.question_count} Fragen</span>`
              : `<span class="badge">noch nicht geschrieben</span>`);
        return `<li><span>${esc(t.name)}</span> ${status}</li>`;
      }).join('')}</ul>`;
    }
    return `<div class="profil-class" id="class-${esc(c.id)}">
      <div class="profil-class-header">${esc(c.name)}</div>
      ${inner}
    </div>`;
  }).join('');
}

window.loadProfileClasses = loadProfileClasses;

async function saveName() {
  const v = document.getElementById('prof-vorname').value.trim();
  const n = document.getElementById('prof-nachname').value.trim();
  const msg = document.getElementById('name-msg');
  msg.textContent = ''; msg.className = 'success-msg';
  if (!v || !n) { msg.className = 'error-msg'; msg.textContent = 'Bitte beide Felder ausfüllen.'; return; }
  if (!db) { msg.className = 'error-msg'; msg.textContent = 'Keine Datenbankverbindung.'; return; }
  const { error } = await db.from('users').update({ vorname: v, nachname: n }).eq('id', currentUser.id);
  if (error) { msg.className = 'error-msg'; msg.textContent = 'Fehler beim Speichern.'; return; }
  currentUser.vorname = v; currentUser.nachname = n;
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  msg.textContent = 'Gespeichert. Lade die Seite neu, um den Namen überall zu sehen.';
  initProfilePage();
}

async function changePassword() {
  const oldPw = document.getElementById('pw-old').value;
  const newPw = document.getElementById('pw-new').value;
  const newPw2 = document.getElementById('pw-new2').value;
  const msg = document.getElementById('pw-msg');
  msg.textContent = ''; msg.className = 'success-msg';
  if (!oldPw || !newPw || !newPw2) { msg.className = 'error-msg'; msg.textContent = 'Bitte alle Felder ausfüllen.'; return; }
  if (newPw !== newPw2) { msg.className = 'error-msg'; msg.textContent = 'Die neuen Passwörter stimmen nicht überein.'; return; }
  if (newPw.length < 4) { msg.className = 'error-msg'; msg.textContent = 'Neues Passwort braucht mindestens 4 Zeichen.'; return; }
  if (oldPw !== currentUser.passwort) { msg.className = 'error-msg'; msg.textContent = 'Aktuelles Passwort ist falsch.'; return; }
  const { error } = await db.from('users').update({ passwort: newPw }).eq('id', currentUser.id);
  if (error) { msg.className = 'error-msg'; msg.textContent = 'Fehler beim Ändern.'; return; }
  currentUser.passwort = newPw;
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-new2').value = '';
  msg.textContent = 'Passwort geändert.';
}

async function deleteAccount() {
  if (!confirm('Account wirklich endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return;
  if (!confirm('Letzte Warnung: alle deine Daten werden gelöscht. Fortfahren?')) return;
  if (!db) return alert('Keine Datenbankverbindung.');
  const { error } = await db.from('users').delete().eq('id', currentUser.id);
  if (error) return alert('Fehler beim Löschen: ' + error.message);
  localStorage.removeItem(USER_KEY);
  sessionStorage.clear();
  alert('Dein Account wurde gelöscht.');
  window.location.href = 'index.html';
}

// ============================================================
// STATISTIK-SEITE
// ============================================================
async function initStatistikPage() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  const practiced = practiceResults.length;
  const known = practiceResults.filter(r => r.known).length;
  const pct = practiced > 0 ? Math.round((known / practiced) * 100) : 0;
  set('stat-practiced', practiced);
  set('stat-percentage', pct + '%');
  set('stat-streak', computeStreak(practiceResults));

  // Tests
  let tests = [];
  if (db && currentUser) {
    const { data } = await db.from('results').select('*, tests(name)').eq('student_id', currentUser.id).order('created_at', { ascending: true });
    tests = data || [];
  }
  set('stat-tests', tests.length);

  // Test-Historie (neueste zuerst)
  const histEl = document.getElementById('test-history');
  if (histEl) {
    const recent = tests.slice().reverse();
    if (recent.length === 0) {
      histEl.innerHTML = '<p class="text-muted">Noch keine Tests absolviert.</p>';
    } else {
      histEl.innerHTML = `<div class="table-wrap"><table class="results-table">
        <thead><tr><th>Test</th><th>Ergebnis</th><th>Quote</th><th>Datum</th></tr></thead>
        <tbody>${recent.map(r => {
          const q = r.total > 0 ? Math.round(r.score / r.total * 100) : 0;
          return `<tr>
            <td>${r.tests ? esc(r.tests.name) : esc(r.test_id)}</td>
            <td>${r.score} / ${r.total}</td>
            <td>${q}%</td>
            <td>${new Date(r.created_at).toLocaleDateString('de-DE')}</td>
          </tr>`;
        }).join('')}
        </tbody></table></div>`;
    }
  }

  // Lektionsfortschritt
  const lessonMap = new Map();
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) lessonMap.set(v.lesson_number, { total: 0, known: 0, unknown: 0, plays: 0 });
    lessonMap.get(v.lesson_number).total++;
  });
  practiceResults.forEach(r => {
    const vocab = vocabularies.find(v => v.id === r.vocabulary_id);
    if (vocab && lessonMap.has(vocab.lesson_number)) {
      const s = lessonMap.get(vocab.lesson_number);
      if (r.known) s.known++; else s.unknown++;
      s.plays++;
    }
  });
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  const lpEl = document.getElementById('lesson-progress');
  if (lpEl) {
    if (lessons.length === 0) lpEl.innerHTML = '<p class="text-muted">Noch keine Vokabeln geladen.</p>';
    else {
      lpEl.innerHTML = lessons.map(([num, s]) => {
        const tot = s.known + s.unknown;
        const p = tot > 0 ? Math.round((s.known / tot) * 100) : 0;
        return `<div class="lesson-progress-row">
          <span class="lp-label">L${num}</span>
          <div class="lp-bar"><div class="lp-bar-fill" style="width:${p}%"></div></div>
          <span class="lp-pct">${tot > 0 ? p + '% · ' + s.plays + 'x' : '–'}</span>
        </div>`;
      }).join('');
    }
  }

  // Heatmap (12 Wochen)
  renderHeatmap(practiceResults);

  // Schwierigste Vokabeln
  renderHardestWords();

  // Notenverlauf-Chart
  renderTestLineChart(tests);
}

function computeStreak(results) {
  if (!results || results.length === 0) return 0;
  const days = new Set(results.map(r => (r.practiced_at || '').slice(0, 10)).filter(Boolean));
  let streak = 0;
  const d = new Date();
  // Wenn heute keine Aktivität, prüfe ab gestern
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) { streak++; }
    else if (i > 0) break; // Tag ohne Aktivität bricht die Serie (außer heute selbst)
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function renderHeatmap(results) {
  const el = document.getElementById('heatmap');
  if (!el) return;
  const counts = new Map();
  results.forEach(r => {
    const k = (r.practiced_at || '').slice(0, 10);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  });
  const today = new Date();
  // 84 Tage = 12 Wochen, gehe rückwärts so dass letzte Spalte = aktuelle Woche
  const days = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  // Padding zu Wochenanfang (Mo=1, So=7)
  const firstDay = days[0];
  const dow = (firstDay.getDay() + 6) % 7; // Mo=0..So=6
  const pad = Array.from({ length: dow }, () => null);
  const cells = pad.concat(days);

  let html = '<div class="heatmap-grid">';
  cells.forEach(d => {
    if (!d) { html += '<div class="hm-cell hm-empty"></div>'; return; }
    const k = d.toISOString().slice(0, 10);
    const c = counts.get(k) || 0;
    let lvl = 0;
    if (c >= 1) lvl = 1;
    if (c >= 5) lvl = 2;
    if (c >= 15) lvl = 3;
    if (c >= 30) lvl = 4;
    const label = `${d.toLocaleDateString('de-DE')}: ${c} Karten`;
    html += `<div class="hm-cell hm-l${lvl}" title="${label}"></div>`;
  });
  html += '</div>';
  html += '<div class="heatmap-legend"><span>Weniger</span><span class="hm-cell hm-l0"></span><span class="hm-cell hm-l1"></span><span class="hm-cell hm-l2"></span><span class="hm-cell hm-l3"></span><span class="hm-cell hm-l4"></span><span>Mehr</span></div>';
  el.innerHTML = html;
}

function renderHardestWords() {
  const el = document.getElementById('hardest-words');
  if (!el) return;
  const stat = new Map();
  practiceResults.forEach(r => {
    if (!stat.has(r.vocabulary_id)) stat.set(r.vocabulary_id, { wrong: 0, total: 0 });
    const s = stat.get(r.vocabulary_id);
    s.total++;
    if (!r.known) s.wrong++;
  });
  const ranked = Array.from(stat.entries())
    .filter(([, s]) => s.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong || b[1].total - a[1].total)
    .slice(0, 10);
  if (ranked.length === 0) {
    el.innerHTML = '<p class="text-muted">Noch keine Fehler – weiter so.</p>';
    return;
  }
  el.innerHTML = `<div class="hardest-list">${ranked.map(([id, s]) => {
    const v = vocabularies.find(x => x.id === id);
    if (!v) return '';
    return `<div class="hardest-row">
      <div>
        <div style="font-weight:600;">${esc(v.latin_word)}</div>
        <div class="text-muted" style="font-size:0.82rem;">${esc(v.german_translation)} · L${v.lesson_number}</div>
      </div>
      <div class="badge" style="background: var(--danger-soft); color: var(--danger);">${s.wrong}× falsch</div>
    </div>`;
  }).join('')}</div>`;
}

function renderTestLineChart(tests) {
  const el = document.getElementById('test-line-chart');
  if (!el) return;
  if (!tests || tests.length === 0) {
    el.innerHTML = '<p class="text-muted">Noch keine Tests absolviert.</p>';
    return;
  }
  const W = 600, H = 180, PAD = 30;
  const pts = tests.map((t, i) => ({
    x: i, y: t.total > 0 ? (t.score / t.total) * 100 : 0, name: t.tests ? t.tests.name : t.test_id
  }));
  const n = pts.length;
  const xStep = n > 1 ? (W - PAD * 2) / (n - 1) : 0;
  const coords = pts.map(p => ({
    cx: PAD + p.x * xStep,
    cy: H - PAD - (p.y / 100) * (H - PAD * 2),
    val: Math.round(p.y),
    name: p.name
  }));
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c.cx + ' ' + c.cy).join(' ');
  let html = `<svg viewBox="0 0 ${W} ${H}" class="line-chart">`;
  // grid
  for (let g = 0; g <= 100; g += 25) {
    const y = H - PAD - (g / 100) * (H - PAD * 2);
    html += `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
    html += `<text x="${PAD - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="var(--text-muted)">${g}%</text>`;
  }
  html += `<path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2"/>`;
  coords.forEach(c => {
    html += `<circle cx="${c.cx}" cy="${c.cy}" r="4" fill="var(--primary)"><title>${esc(c.name)}: ${c.val}%</title></circle>`;
  });
  html += `</svg>`;
  el.innerHTML = html;
}

// Expose globally for inline onclick handlers
window.saveName = saveName;
window.changePassword = changePassword;
window.deleteAccount = deleteAccount;
window.logout = logout;
