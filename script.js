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
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadData();

  // Check saved session
  const savedUser = localStorage.getItem(USER_KEY);
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showLoggedInState();
      showView('home-view');
      updateStats();
      loadPresetVocabularies();
    } catch (e) {
      localStorage.removeItem(USER_KEY);
      showView('login-view');
    }
  } else {
    showView('login-view');
  }

  setupEventListeners();
});

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
  updateStats();
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
  if (icon) icon.innerHTML = isDark ? '&#9728;' : '&#9790;';
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

function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.role-btn[data-role="${role}"]`).classList.add('active');
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
  showLoggedInState();
  showView('home-view');
  updateStats();
  loadPresetVocabularies();
}

async function register() {
  if (!db) return showError('auth-error', 'Datenbankverbindung fehlgeschlagen.');
  const vorname = document.getElementById('reg-vorname').value.trim();
  const nachname = document.getElementById('reg-nachname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim() || '0000';

  if (!vorname || !nachname || !username) return showError('auth-error', 'Bitte alle Felder ausfüllen.');

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
  showLoggedInState();
  showView('home-view');
  updateStats();
  loadPresetVocabularies();
}

function logout() {
  currentUser = null;
  localStorage.removeItem(USER_KEY);
  document.getElementById('logged-in-user').classList.add('hidden');
  document.getElementById('logout-btn').style.display = 'none';
  showView('login-view');
}

function showLoggedInState() {
  const badge = document.getElementById('logged-in-user');
  badge.textContent = currentUser.vorname + ' ' + currentUser.nachname;
  badge.classList.remove('hidden');
  document.getElementById('logout-btn').style.display = '';

  // Show/hide role-specific buttons
  const isTeacher = currentUser.rolle === 'lehrer';
  document.getElementById('teacher-dash-btn').style.display = isTeacher ? '' : 'none';
  document.getElementById('student-dash-btn').style.display = '';
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

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-practiced').textContent = practiced;
  document.getElementById('stat-known').textContent = known;
  document.getElementById('stat-percentage').textContent = pct + '%';

  const hasVocabs = total > 0;
  document.getElementById('start-btn').disabled = !hasVocabs;
  document.getElementById('probe-btn').disabled = !hasVocabs;
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
function setupEventListeners() {
  document.getElementById('csv-input').addEventListener('change', handleCSVUpload);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('show-stats-btn').addEventListener('click', showStatsModal);
  document.getElementById('close-stats-btn').addEventListener('click', hideStatsModal);
  document.getElementById('stats-modal-overlay').addEventListener('click', hideStatsModal);
  document.getElementById('select-all-btn').addEventListener('click', selectAllLessons);
  document.getElementById('deselect-all-btn').addEventListener('click', deselectAllLessons);
  document.getElementById('flashcard').addEventListener('click', flipCard);
  document.getElementById('known-btn').addEventListener('click', () => answerCard(true));
  document.getElementById('unknown-btn').addEventListener('click', () => answerCard(false));
  document.getElementById('practice-again-btn').addEventListener('click', () => {
    if (selectedLessons.length === 0) { showView('select-view'); renderLessons(); }
    else startPractice();
  });
  document.getElementById('practice-wrong-btn').addEventListener('click', practiceWrongCards);
  document.getElementById('back-home-btn').addEventListener('click', goHome);

  document.getElementById('probe-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitProbeAnswer(); });
  document.getElementById('student-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitStudentAnswer(); });
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  document.getElementById('student-test-id').addEventListener('keydown', e => { if (e.key === 'Enter') studentJoinTest(); });
  document.getElementById('new-class-name').addEventListener('keydown', e => { if (e.key === 'Enter') createClass(); });
  document.getElementById('add-student-username').addEventListener('keydown', e => { if (e.key === 'Enter') addStudentToClass(); });
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

function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const newVocabs = processCSVText(e.target.result);
      if (newVocabs.length > 0) {
        vocabularies = newVocabs; practiceResults = []; selectedLessons = [];
        saveVocabularies(); savePracticeResults(); updateStats();
        showUploadStatus(newVocabs.length + ' Vokabeln erfolgreich hochgeladen!', 'success');
      } else showUploadStatus('Keine gültigen Vokabeln gefunden.', 'error');
    } catch (err) { showUploadStatus('Fehler beim Lesen der Datei.', 'error'); }
  };
  reader.readAsText(file);
}

function showUploadStatus(message, type) {
  const el = document.getElementById('upload-status');
  el.textContent = message; el.className = type;
}

function generateId() { return Math.random().toString(36).substr(2, 9) + Date.now().toString(36); }

// ============================================================
// PRESET VOCABULARIES
// ============================================================
function loadPresetVocabularies() {
  const container = document.getElementById('preset-container');
  fetch('vocabs/manifest.json')
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(presets => {
      if (presets.length === 0) { container.innerHTML = '<p class="text-muted">Keine Sammlungen verfügbar.</p>'; return; }
      container.innerHTML = presets.map(p => `<button class="preset-btn" data-file="${p.file}">${p.name}</button>`).join('');
      container.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => loadPresetFile(btn.dataset.file, btn));
      });
    })
    .catch(() => { container.innerHTML = '<p class="text-muted">Keine voreingestellten Sammlungen gefunden.</p>'; });
}

function loadPresetFile(filename, btn) {
  const orig = btn.textContent; btn.textContent = 'Laden...'; btn.disabled = true;
  fetch('vocabs/' + filename)
    .then(res => { if (!res.ok) throw new Error(); return res.text(); })
    .then(text => {
      const nv = processCSVText(text);
      if (nv.length > 0) {
        vocabularies = nv; practiceResults = []; selectedLessons = [];
        saveVocabularies(); savePracticeResults(); updateStats();
        showUploadStatus(nv.length + " Vokabeln aus '" + orig + "' geladen!", 'success');
      } else showUploadStatus('Keine gültigen Vokabeln in dieser Datei.', 'error');
      btn.textContent = orig; btn.disabled = false;
    })
    .catch(() => { showUploadStatus('Fehler beim Laden der Datei.', 'error'); btn.textContent = orig; btn.disabled = false; });
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
  document.getElementById('flashcard').classList.remove('flipped');
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
  showCard();
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
  document.getElementById('probe-forms').textContent = card.forms || '';
  document.getElementById('probe-input').value = '';
  document.getElementById('probe-input').focus();
  document.getElementById('probe-progress-text').textContent = `Frage ${probeIndex + 1} von ${probeCards.length}`;
  document.getElementById('probe-progress-fill').style.width = ((probeIndex + 1) / probeCards.length * 100) + '%';
}

function normalizeAnswer(str) {
  return str.toLowerCase().trim().replace(/[.,;:!?'"()\-]/g, '').replace(/\s+/g, ' ');
}

function checkAnswer(input, germanTranslation) {
  const translations = germanTranslation.split(',').map(t => normalizeAnswer(t));
  return translations.some(t => t && normalizeAnswer(input) === t);
}

function submitProbeAnswer() {
  const input = document.getElementById('probe-input').value;
  if (!input.trim()) return;
  const card = probeCards[probeIndex];
  const correct = checkAnswer(input, card.german_translation);
  probeAnswers.push({ latin: card.latin_word, answer: input, correctAnswers: card.german_translation, isCorrect: correct });
  probeIndex++;
  showProbeCard();
}

function showProbeResults() {
  const score = probeAnswers.filter(a => a.isCorrect).length;
  document.getElementById('probe-score').textContent = `${score} / ${probeAnswers.length}`;
  document.getElementById('probe-results-body').innerHTML = probeAnswers.map(a => `
    <tr class="${a.isCorrect ? 'row-correct' : 'row-wrong'}">
      <td>${esc(a.latin)}</td><td>${esc(a.answer)}</td><td>${esc(a.correctAnswers)}</td>
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
      <button class="btn btn-danger btn-small" onclick="removeStudent('${m.id}')">Entfernen</button>
    </div>`).join('');
}

async function addStudentToClass() {
  const username = document.getElementById('add-student-username').value.trim();
  if (!username) return;
  showError('add-student-error', '');

  const { data: user, error: userErr } = await db.from('users')
    .select('*').eq('benutzername', username).eq('rolle', 'schueler').single();
  if (userErr || !user) return showError('add-student-error', 'Schüler "' + username + '" nicht gefunden.');

  const { error: insertErr } = await db.from('class_members').insert({ class_id: currentClassId, student_id: user.id });
  if (insertErr) {
    if (insertErr.code === '23505') return showError('add-student-error', 'Schüler bereits in der Klasse.');
    return showError('add-student-error', 'Fehler beim Hinzufügen.');
  }

  document.getElementById('add-student-username').value = '';
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
  document.getElementById('student-forms').textContent = card.forms || '';
  document.getElementById('student-input').value = '';
  document.getElementById('student-input').focus();
  document.getElementById('student-progress-text').textContent = `Frage ${studentIndex + 1} von ${studentCards.length}`;
  document.getElementById('student-progress-fill').style.width = ((studentIndex + 1) / studentCards.length * 100) + '%';
}

function submitStudentAnswer() {
  const input = document.getElementById('student-input').value;
  if (!input.trim()) return;
  const card = studentCards[studentIndex];
  const correct = checkAnswer(input, card.german_translation);
  studentAnswers.push({
    latin_word: card.latin_word, student_answer: input,
    correct_answers: card.german_translation, is_correct: correct
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
      <td>${esc(a.latin_word)}</td><td>${esc(a.student_answer)}</td><td>${esc(a.correct_answers)}</td>
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
