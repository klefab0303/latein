// =============================================
// CONFIGURATION - Supabase
// =============================================
// WICHTIG: Trage hier deine Supabase-Daten ein!
const SUPABASE_URL = "DEINE_SUPABASE_URL";  // z.B. https://abcdef.supabase.co
const SUPABASE_ANON_KEY = "DEIN_SUPABASE_ANON_KEY";

let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient && typeof supabase !== "undefined" && SUPABASE_URL !== "DEINE_SUPABASE_URL") {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// =============================================
// LocalStorage Keys
// =============================================
const VOCABULARIES_KEY = "latin-vocab-vocabularies";
const PRACTICE_RESULTS_KEY = "latin-vocab-practice-results";
const THEME_KEY = "latin-vocab-theme";

// =============================================
// State
// =============================================
let vocabularies = [];
let practiceResults = [];
let selectedLessons = [];
let currentPracticeCards = [];
let currentCardIndex = 0;
let sessionResults = { known: 0, unknown: 0, wrongCards: [] };

// Probe-Test State
let probeSelectedLessons = [];
let probeTestCards = [];
let probeCardIndex = 0;
let probeAnswers = [];

// Lehrer-Test State
let createSelectedLessons = [];
let lehrerTestCards = [];
let lehrerCardIndex = 0;
let lehrerAnswers = [];
let currentLehrerTest = null;
let currentStudentName = "";
let currentResultId = null;

// =============================================
// DOM Elements
// =============================================
let homeView, selectView, practiceView, resultsView;

const ALL_VIEWS = [
  "home-view", "select-view", "practice-view",
  "probe-test-home", "probe-test-view", "probe-results-view",
  "lehrer-home", "create-test-view", "take-test-view",
  "lehrer-test-active", "lehrer-test-results", "dashboard-view"
];

// =============================================
// Initialize
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  homeView = document.getElementById("home-view");
  selectView = document.getElementById("select-view");
  practiceView = document.getElementById("practice-view");
  resultsView = document.getElementById("results-view");

  loadData();
  loadTheme();
  updateStats();
  setupEventListeners();
  loadPresetVocabularies();
});

// =============================================
// Navigation
// =============================================
function showView(viewId) {
  ALL_VIEWS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  const target = document.getElementById(viewId);
  if (target) target.classList.remove("hidden");

  // Update nav
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.view === viewId);
  });
}

function showHomeView() {
  showView("home-view");
  updateStats();
}

function showSelectView() {
  showView("select-view");
  renderLessons();
}

function showPracticeView() {
  showView("practice-view");
}

// =============================================
// Theme
// =============================================
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") {
    document.documentElement.classList.add("dark");
    updateThemeIcon(true);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById("theme-icon");
  if (icon) icon.innerHTML = isDark ? "&#9728;" : "&#9790;";
}

// =============================================
// Data
// =============================================
function loadData() {
  const vocabData = localStorage.getItem(VOCABULARIES_KEY);
  const resultsData = localStorage.getItem(PRACTICE_RESULTS_KEY);
  vocabularies = vocabData ? JSON.parse(vocabData) : [];
  practiceResults = resultsData ? JSON.parse(resultsData) : [];
}

function saveVocabularies() {
  localStorage.setItem(VOCABULARIES_KEY, JSON.stringify(vocabularies));
}

function savePracticeResults() {
  localStorage.setItem(PRACTICE_RESULTS_KEY, JSON.stringify(practiceResults));
}

// =============================================
// Stats
// =============================================
function updateStats() {
  const total = vocabularies.length;
  const practiced = practiceResults.length;
  const known = practiceResults.filter(r => r.known).length;
  const percentage = practiced > 0 ? Math.round((known / practiced) * 100) : 0;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-practiced").textContent = practiced;
  document.getElementById("stat-known").textContent = known;
  document.getElementById("stat-percentage").textContent = percentage + "%";

  document.getElementById("start-btn").disabled = total === 0;
}

function showStatsModal() {
  document.getElementById("stats-modal").classList.remove("hidden");
  renderBarChart();
}

function hideStatsModal() {
  document.getElementById("stats-modal").classList.add("hidden");
}

function renderBarChart() {
  const chartContainer = document.getElementById("bar-chart");
  const lessonMap = new Map();
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) lessonMap.set(v.lesson_number, { total: 0, known: 0, unknown: 0 });
    lessonMap.get(v.lesson_number).total++;
  });
  practiceResults.forEach(r => {
    const vocab = vocabularies.find(v => v.id === r.vocabulary_id);
    if (vocab && lessonMap.has(vocab.lesson_number)) {
      const stats = lessonMap.get(vocab.lesson_number);
      if (r.known) stats.known++; else stats.unknown++;
    }
  });
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  if (lessons.length === 0) {
    chartContainer.innerHTML = '<p class="no-stats">Noch keine Vokabeln geladen.</p>';
    return;
  }
  const maxValue = Math.max(...lessons.map(([_, s]) => s.known + s.unknown), 1);
  chartContainer.innerHTML = `
    <div class="chart-container">
      <div class="chart-y-axis">
        <span class="y-label">${maxValue}</span>
        <span class="y-label">${Math.round(maxValue / 2)}</span>
        <span class="y-label">0</span>
      </div>
      <div class="chart-bars">
        ${lessons.map(([num, s]) => {
          const kH = (s.known / maxValue) * 100;
          const uH = (s.unknown / maxValue) * 100;
          return `<div class="bar-group">
            <div class="bar-stack" title="Lektion ${num}: ${s.known} gewusst, ${s.unknown} nicht gewusst">
              <div class="bar known" style="height:${kH}%"></div>
              <div class="bar unknown" style="height:${uH}%"></div>
            </div>
            <span class="bar-label">L${num}</span>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}

// =============================================
// Event Listeners
// =============================================
function setupEventListeners() {
  // Navigation
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      const view = link.dataset.view;
      if (view === "home") showHomeView();
      else if (view === "probe-test-home") { showView("probe-test-home"); renderProbeLessons(); }
      else if (view === "lehrer-home") showView("lehrer-home");
    });
  });

  // Home
  document.getElementById("start-btn").addEventListener("click", showSelectView);
  document.getElementById("show-stats-btn").addEventListener("click", showStatsModal);
  document.getElementById("close-stats-btn").addEventListener("click", hideStatsModal);
  document.getElementById("stats-modal-overlay").addEventListener("click", hideStatsModal);
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  document.getElementById("csv-input").addEventListener("change", handleCSVUpload);

  // Flashcard practice
  document.getElementById("back-to-home").addEventListener("click", showHomeView);
  document.getElementById("back-to-select").addEventListener("click", showSelectView);
  document.getElementById("select-all-btn").addEventListener("click", selectAllLessons);
  document.getElementById("deselect-all-btn").addEventListener("click", deselectAllLessons);
  document.getElementById("start-practice-btn").addEventListener("click", startPractice);
  document.getElementById("flashcard").addEventListener("click", flipCard);
  document.getElementById("known-btn").addEventListener("click", () => answerCard(true));
  document.getElementById("unknown-btn").addEventListener("click", () => answerCard(false));
  document.getElementById("practice-again-btn").addEventListener("click", () => {
    if (selectedLessons.length === 0) showSelectView(); else startPractice();
  });
  document.getElementById("practice-wrong-btn").addEventListener("click", practiceWrongCards);
  document.getElementById("back-home-btn").addEventListener("click", showHomeView);

  // Probe-Test
  document.getElementById("probe-select-all").addEventListener("click", () => {
    probeSelectedLessons = [...new Set(vocabularies.map(v => v.lesson_number))];
    renderProbeLessons();
  });
  document.getElementById("probe-deselect-all").addEventListener("click", () => {
    probeSelectedLessons = [];
    renderProbeLessons();
  });
  document.getElementById("start-probe-test-btn").addEventListener("click", startProbeTest);
  document.getElementById("probe-submit-btn").addEventListener("click", submitProbeAnswer);
  document.getElementById("probe-answer-input").addEventListener("keydown", e => {
    if (e.key === "Enter") submitProbeAnswer();
  });
  document.getElementById("probe-again-btn").addEventListener("click", () => {
    showView("probe-test-home");
    renderProbeLessons();
  });
  document.getElementById("probe-back-home-btn").addEventListener("click", showHomeView);

  // Lehrer-Test
  document.getElementById("go-create-test").addEventListener("click", () => {
    showView("create-test-view");
    renderCreateLessons();
  });
  document.getElementById("go-take-test").addEventListener("click", () => showView("take-test-view"));
  document.getElementById("go-dashboard").addEventListener("click", () => showView("dashboard-view"));
  document.getElementById("back-to-lehrer-home").addEventListener("click", () => showView("lehrer-home"));
  document.getElementById("back-to-lehrer-home2").addEventListener("click", () => showView("lehrer-home"));
  document.getElementById("back-to-lehrer-home3").addEventListener("click", () => showView("lehrer-home"));

  document.getElementById("create-select-all").addEventListener("click", () => {
    createSelectedLessons = [...new Set(vocabularies.map(v => v.lesson_number))];
    renderCreateLessons();
  });
  document.getElementById("create-deselect-all").addEventListener("click", () => {
    createSelectedLessons = [];
    renderCreateLessons();
  });
  document.getElementById("create-test-btn").addEventListener("click", createTest);
  document.getElementById("start-lehrer-test-btn").addEventListener("click", startLehrerTest);
  document.getElementById("lehrer-submit-btn").addEventListener("click", submitLehrerAnswer);
  document.getElementById("lehrer-answer-input").addEventListener("keydown", e => {
    if (e.key === "Enter") submitLehrerAnswer();
  });
  document.getElementById("lehrer-results-home-btn").addEventListener("click", showHomeView);
  document.getElementById("load-dashboard-btn").addEventListener("click", loadDashboard);
}

// =============================================
// CSV Processing
// =============================================
function processCSVText(text) {
  const lines = text.split("\n").filter(line => line.trim());
  const startIndex = lines[0].toLowerCase().includes("latein") ? 1 : 0;
  const newVocabs = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = parseCSVLine(line);
    if (parts.length >= 4) {
      const lessonNum = parseInt(parts[parts.length - 1].trim(), 10);
      if (isNaN(lessonNum)) continue;
      const germanParts = parts.slice(2, parts.length - 1);
      newVocabs.push({
        id: generateId(),
        latin_word: parts[0].trim(),
        forms: parts[1].trim() || null,
        german_translation: germanParts.join("; ").trim(),
        lesson_number: lessonNum,
        created_at: new Date().toISOString()
      });
    }
  }
  return newVocabs;
}

function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const newVocabs = processCSVText(e.target.result);
      if (newVocabs.length > 0) {
        vocabularies = newVocabs;
        practiceResults = [];
        selectedLessons = [];
        saveVocabularies();
        savePracticeResults();
        updateStats();
        showUploadStatus(newVocabs.length + " Vokabeln erfolgreich hochgeladen!", "success");
      } else {
        showUploadStatus("Keine gültigen Vokabeln gefunden.", "error");
      }
    } catch (error) {
      showUploadStatus("Fehler beim Lesen der Datei.", "error");
    }
  };
  reader.readAsText(file);
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.length > 0 || result.length > 0) result.push(current.trim());
  return result.map(s => s.replace(/^"|"$/g, "").trim());
}

function showUploadStatus(message, type) {
  const status = document.getElementById("upload-status");
  status.textContent = message;
  status.className = type;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// =============================================
// Preset Vocabularies
// =============================================
function loadPresetVocabularies() {
  const container = document.getElementById("preset-container");
  fetch("vocabs/manifest.json")
    .then(res => { if (!res.ok) throw new Error(); return res.json(); })
    .then(presets => {
      if (presets.length === 0) {
        container.innerHTML = '<p class="text-muted">Keine Sammlungen verfügbar.</p>';
        return;
      }
      container.innerHTML = presets.map(p =>
        `<button class="preset-btn" data-file="${p.file}">${p.name}</button>`
      ).join("");
      container.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", () => loadPresetFile(btn.dataset.file, btn));
      });
    })
    .catch(() => {
      container.innerHTML = '<p class="text-muted">Keine voreingestellten Sammlungen gefunden.</p>';
    });
}

function loadPresetFile(filename, btn) {
  const originalText = btn.textContent;
  btn.textContent = "Laden...";
  btn.disabled = true;
  fetch("vocabs/" + filename)
    .then(res => { if (!res.ok) throw new Error(); return res.text(); })
    .then(text => {
      const newVocabs = processCSVText(text);
      if (newVocabs.length > 0) {
        vocabularies = newVocabs;
        practiceResults = [];
        selectedLessons = [];
        saveVocabularies();
        savePracticeResults();
        updateStats();
        showUploadStatus(newVocabs.length + " Vokabeln aus '" + originalText + "' geladen!", "success");
      } else {
        showUploadStatus("Keine gültigen Vokabeln in dieser Datei.", "error");
      }
      btn.textContent = originalText;
      btn.disabled = false;
    })
    .catch(() => {
      showUploadStatus("Fehler beim Laden der Datei.", "error");
      btn.textContent = originalText;
      btn.disabled = false;
    });
}

// =============================================
// Lesson Selection (Flashcard)
// =============================================
function renderLessons() {
  const grid = document.getElementById("lessons-grid");
  const lessonMap = new Map();
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) lessonMap.set(v.lesson_number, 0);
    lessonMap.set(v.lesson_number, lessonMap.get(v.lesson_number) + 1);
  });
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  grid.innerHTML = lessons.map(([num, count]) => `
    <div class="lesson-item ${selectedLessons.includes(num) ? 'selected' : ''}" data-lesson="${num}">
      <div class="lesson-number">L${num}</div>
      <div class="lesson-count">${count} Vokabeln</div>
    </div>
  `).join("");
  grid.querySelectorAll(".lesson-item").forEach(item => {
    item.addEventListener("click", () => {
      const n = parseInt(item.dataset.lesson);
      const idx = selectedLessons.indexOf(n);
      if (idx > -1) selectedLessons.splice(idx, 1); else selectedLessons.push(n);
      renderLessons();
    });
  });
  document.getElementById("start-practice-btn").disabled = selectedLessons.length === 0;
}

function selectAllLessons() {
  selectedLessons = [...new Set(vocabularies.map(v => v.lesson_number))];
  renderLessons();
}

function deselectAllLessons() {
  selectedLessons = [];
  renderLessons();
}

// =============================================
// Flashcard Practice
// =============================================
function startPractice() {
  currentPracticeCards = vocabularies
    .filter(v => selectedLessons.includes(v.lesson_number))
    .sort(() => Math.random() - 0.5);
  if (currentPracticeCards.length === 0) { alert("Keine Vokabeln gefunden."); return; }
  currentCardIndex = 0;
  sessionResults = { known: 0, unknown: 0, wrongCards: [] };
  showPracticeView();
  document.querySelector(".practice-container").classList.remove("hidden");
  document.getElementById("results-view").classList.add("hidden");
  showCard();
}

function showCard() {
  if (currentCardIndex >= currentPracticeCards.length) { showResults(); return; }
  const card = currentPracticeCards[currentCardIndex];
  document.getElementById("flashcard").classList.remove("flipped");
  document.getElementById("answer-buttons").classList.add("hidden");
  document.getElementById("latin-word").textContent = card.latin_word;
  document.getElementById("german-word").textContent = card.german_translation;
  document.getElementById("german-forms").textContent = card.forms || "";
  const progress = ((currentCardIndex + 1) / currentPracticeCards.length) * 100;
  document.getElementById("progress-text").textContent = `Karte ${currentCardIndex + 1} von ${currentPracticeCards.length}`;
  document.getElementById("progress-fill").style.width = progress + "%";
}

function flipCard() {
  const fc = document.getElementById("flashcard");
  if (!fc.classList.contains("flipped")) {
    fc.classList.add("flipped");
    document.getElementById("answer-buttons").classList.remove("hidden");
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

function showResults() {
  document.querySelector(".practice-container").classList.add("hidden");
  document.getElementById("results-view").classList.remove("hidden");
  const total = sessionResults.known + sessionResults.unknown;
  const pct = total > 0 ? Math.round((sessionResults.known / total) * 100) : 0;
  document.getElementById("result-total").textContent = total;
  document.getElementById("result-known").textContent = sessionResults.known;
  document.getElementById("result-unknown").textContent = sessionResults.unknown;
  document.getElementById("result-percentage").textContent = pct + "%";
  const wrongBtn = document.getElementById("practice-wrong-btn");
  if (sessionResults.wrongCards.length > 0) {
    wrongBtn.classList.remove("hidden");
    wrongBtn.textContent = "Falsche wiederholen (" + sessionResults.wrongCards.length + ")";
  } else { wrongBtn.classList.add("hidden"); }
  updateStats();
}

function practiceWrongCards() {
  if (sessionResults.wrongCards.length === 0) return;
  currentPracticeCards = [...sessionResults.wrongCards].sort(() => Math.random() - 0.5);
  currentCardIndex = 0;
  sessionResults = { known: 0, unknown: 0, wrongCards: [] };
  showPracticeView();
  document.querySelector(".practice-container").classList.remove("hidden");
  document.getElementById("results-view").classList.add("hidden");
  showCard();
}

// =============================================
// PROBE-TEST
// =============================================
function renderProbeLessons() {
  const grid = document.getElementById("probe-lessons-grid");
  const lessonMap = new Map();
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) lessonMap.set(v.lesson_number, 0);
    lessonMap.set(v.lesson_number, lessonMap.get(v.lesson_number) + 1);
  });
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  grid.innerHTML = lessons.map(([num, count]) => `
    <div class="lesson-item ${probeSelectedLessons.includes(num) ? 'selected' : ''}" data-lesson="${num}">
      <div class="lesson-number">L${num}</div>
      <div class="lesson-count">${count} Vokabeln</div>
    </div>
  `).join("");
  grid.querySelectorAll(".lesson-item").forEach(item => {
    item.addEventListener("click", () => {
      const n = parseInt(item.dataset.lesson);
      const idx = probeSelectedLessons.indexOf(n);
      if (idx > -1) probeSelectedLessons.splice(idx, 1); else probeSelectedLessons.push(n);
      renderProbeLessons();
    });
  });
  document.getElementById("start-probe-test-btn").disabled = probeSelectedLessons.length === 0;
}

function normalizeAnswer(str) {
  return str.toLowerCase().trim().replace(/[.,;:!?'"()\-]/g, "").replace(/\s+/g, " ");
}

function checkAnswer(userAnswer, germanTranslation) {
  const normalized = normalizeAnswer(userAnswer);
  const translations = germanTranslation.split(";").map(t => normalizeAnswer(t));
  return translations.some(t => t === normalized);
}

function startProbeTest() {
  const pool = vocabularies.filter(v => probeSelectedLessons.includes(v.lesson_number));
  if (pool.length === 0) { alert("Keine Vokabeln in den gewählten Lektionen."); return; }
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  probeTestCards = shuffled.slice(0, Math.min(10, shuffled.length));
  probeCardIndex = 0;
  probeAnswers = [];
  showView("probe-test-view");
  showProbeCard();
}

function showProbeCard() {
  if (probeCardIndex >= probeTestCards.length) { showProbeResults(); return; }
  const card = probeTestCards[probeCardIndex];
  document.getElementById("probe-latin-word").textContent = card.latin_word;
  document.getElementById("probe-forms-hint").textContent = card.forms ? "Formen: " + card.forms : "";
  document.getElementById("probe-answer-input").value = "";
  document.getElementById("probe-answer-input").focus();
  const progress = ((probeCardIndex + 1) / probeTestCards.length) * 100;
  document.getElementById("probe-progress-text").textContent = `Frage ${probeCardIndex + 1} von ${probeTestCards.length}`;
  document.getElementById("probe-progress-fill").style.width = progress + "%";
}

function submitProbeAnswer() {
  const input = document.getElementById("probe-answer-input");
  const answer = input.value.trim();
  if (!answer) return;
  const card = probeTestCards[probeCardIndex];
  const correct = checkAnswer(answer, card.german_translation);
  probeAnswers.push({ card, answer, correct });
  probeCardIndex++;
  showProbeCard();
}

function showProbeResults() {
  showView("probe-results-view");
  const correctCount = probeAnswers.filter(a => a.correct).length;
  document.getElementById("probe-result-score").textContent = correctCount + " / " + probeAnswers.length;
  const tbody = document.getElementById("probe-results-body");
  tbody.innerHTML = probeAnswers.map((a, i) => `
    <tr class="${a.correct ? 'correct' : 'wrong'}">
      <td>${a.card.latin_word}</td>
      <td>${a.answer}</td>
      <td>${a.card.german_translation}</td>
      <td>${!a.correct ? `<button class="mark-correct-btn" data-index="${i}">Als richtig markieren</button>` : ''}</td>
    </tr>
  `).join("");
  tbody.querySelectorAll(".mark-correct-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.textContent = "Markiert";
      btn.classList.add("marked");
      btn.disabled = true;
    });
  });
}

// =============================================
// LEHRER-TEST - Create
// =============================================
function renderCreateLessons() {
  const grid = document.getElementById("create-lessons-grid");
  const lessonMap = new Map();
  vocabularies.forEach(v => {
    if (!lessonMap.has(v.lesson_number)) lessonMap.set(v.lesson_number, 0);
    lessonMap.set(v.lesson_number, lessonMap.get(v.lesson_number) + 1);
  });
  const lessons = Array.from(lessonMap.entries()).sort((a, b) => a[0] - b[0]);
  grid.innerHTML = lessons.map(([num, count]) => `
    <div class="lesson-item ${createSelectedLessons.includes(num) ? 'selected' : ''}" data-lesson="${num}">
      <div class="lesson-number">L${num}</div>
      <div class="lesson-count">${count} Vokabeln</div>
    </div>
  `).join("");
  grid.querySelectorAll(".lesson-item").forEach(item => {
    item.addEventListener("click", () => {
      const n = parseInt(item.dataset.lesson);
      const idx = createSelectedLessons.indexOf(n);
      if (idx > -1) createSelectedLessons.splice(idx, 1); else createSelectedLessons.push(n);
      renderCreateLessons();
    });
  });
}

function showFormStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = "block";
  el.style.background = type === "error" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)";
  el.style.color = type === "error" ? "var(--danger)" : "var(--success)";
}

async function createTest() {
  const sb = getSupabase();
  if (!sb) { showFormStatus("create-test-status", "Supabase nicht konfiguriert. Bitte SUPABASE_URL und SUPABASE_ANON_KEY in script.js eintragen.", "error"); return; }

  const name = document.getElementById("test-name-input").value.trim();
  const creator = document.getElementById("test-creator-input").value.trim();
  const count = parseInt(document.getElementById("test-count-input").value);

  if (!name || !creator) { showFormStatus("create-test-status", "Bitte Name und Ersteller angeben.", "error"); return; }
  if (createSelectedLessons.length === 0) { showFormStatus("create-test-status", "Bitte mindestens eine Lektion auswählen.", "error"); return; }

  // Get vocab pool for the selected lessons
  const pool = vocabularies.filter(v => createSelectedLessons.includes(v.lesson_number));
  if (pool.length === 0) { showFormStatus("create-test-status", "Keine Vokabeln in den gewählten Lektionen.", "error"); return; }

  // Select random vocabs
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  // Store vocab data in the test so students don't need local vocabs
  const vocabData = selected.map(v => ({
    latin_word: v.latin_word,
    forms: v.forms,
    german_translation: v.german_translation,
    lesson_number: v.lesson_number
  }));

  const { data, error } = await sb.from("tests").insert({
    name,
    lessons: createSelectedLessons,
    question_count: selected.length,
    creator,
    vocab_data: vocabData
  }).select().single();

  if (error) { showFormStatus("create-test-status", "Fehler: " + error.message, "error"); return; }

  showFormStatus("create-test-status", "Test erfolgreich erstellt!", "success");
  document.getElementById("created-test-info").classList.remove("hidden");
  document.getElementById("created-test-id").textContent = data.id;
}

// =============================================
// LEHRER-TEST - Take Test
// =============================================
async function startLehrerTest() {
  const sb = getSupabase();
  if (!sb) { showFormStatus("take-test-status", "Supabase nicht konfiguriert.", "error"); return; }

  currentStudentName = document.getElementById("student-name-input").value.trim();
  const testId = document.getElementById("test-id-input").value.trim();

  if (!currentStudentName || !testId) { showFormStatus("take-test-status", "Bitte Name und Test-ID angeben.", "error"); return; }

  const { data: test, error } = await sb.from("tests").select("*").eq("id", testId).single();
  if (error || !test) { showFormStatus("take-test-status", "Test nicht gefunden.", "error"); return; }

  currentLehrerTest = test;

  // Use vocab_data from the test
  if (!test.vocab_data || test.vocab_data.length === 0) {
    showFormStatus("take-test-status", "Dieser Test enthält keine Vokabeln.", "error");
    return;
  }

  lehrerTestCards = [...test.vocab_data].sort(() => Math.random() - 0.5);
  lehrerCardIndex = 0;
  lehrerAnswers = [];

  showView("lehrer-test-active");
  showLehrerCard();
}

function showLehrerCard() {
  if (lehrerCardIndex >= lehrerTestCards.length) { finishLehrerTest(); return; }
  const card = lehrerTestCards[lehrerCardIndex];
  document.getElementById("lehrer-latin-word").textContent = card.latin_word;
  document.getElementById("lehrer-forms-hint").textContent = card.forms ? "Formen: " + card.forms : "";
  document.getElementById("lehrer-answer-input").value = "";
  document.getElementById("lehrer-answer-input").focus();
  const progress = ((lehrerCardIndex + 1) / lehrerTestCards.length) * 100;
  document.getElementById("lehrer-progress-text").textContent = `Frage ${lehrerCardIndex + 1} von ${lehrerTestCards.length}`;
  document.getElementById("lehrer-progress-fill").style.width = progress + "%";
}

function submitLehrerAnswer() {
  const input = document.getElementById("lehrer-answer-input");
  const answer = input.value.trim();
  if (!answer) return;
  const card = lehrerTestCards[lehrerCardIndex];
  const correct = checkAnswer(answer, card.german_translation);
  lehrerAnswers.push({ card, answer, correct });
  lehrerCardIndex++;
  showLehrerCard();
}

async function finishLehrerTest() {
  const sb = getSupabase();
  const correctCount = lehrerAnswers.filter(a => a.correct).length;
  const score = correctCount + " / " + lehrerAnswers.length;

  // Save result
  const { data: result, error: resErr } = await sb.from("results").insert({
    test_id: currentLehrerTest.id,
    student_name: currentStudentName,
    score
  }).select().single();

  if (resErr) { alert("Fehler beim Speichern: " + resErr.message); return; }
  currentResultId = result.id;

  // Save answers
  const answerRows = lehrerAnswers.map(a => ({
    result_id: result.id,
    latin_word: a.card.latin_word,
    user_answer: a.answer,
    correct_answers: a.card.german_translation,
    is_correct: a.correct
  }));
  await sb.from("answers").insert(answerRows);

  // Show results
  showView("lehrer-test-results");
  document.getElementById("lehrer-result-score").textContent = score;
  const tbody = document.getElementById("lehrer-results-body");
  tbody.innerHTML = lehrerAnswers.map((a, i) => `
    <tr class="${a.correct ? 'correct' : 'wrong'}">
      <td>${a.card.latin_word}</td>
      <td>${a.answer}</td>
      <td>${a.card.german_translation}</td>
      <td>${!a.correct ? `<button class="mark-correct-btn" data-index="${i}">Einspruch einreichen</button>` : ''}</td>
    </tr>
  `).join("");
  tbody.querySelectorAll(".mark-correct-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.index);
      const a = lehrerAnswers[idx];
      const { error } = await sb.from("appeals").insert({
        result_id: currentResultId,
        latin_word: a.card.latin_word,
        student_answer: a.answer,
        correct_answers: a.card.german_translation,
        student_name: currentStudentName,
        status: "pending"
      });
      if (!error) {
        btn.textContent = "Einspruch gesendet";
        btn.classList.add("marked");
        btn.disabled = true;
      } else {
        alert("Fehler: " + error.message);
      }
    });
  });
}

// =============================================
// LEHRER DASHBOARD
// =============================================
async function loadDashboard() {
  const sb = getSupabase();
  if (!sb) { showFormStatus("dashboard-status", "Supabase nicht konfiguriert.", "error"); return; }

  const testId = document.getElementById("dashboard-test-id").value.trim();
  if (!testId) { showFormStatus("dashboard-status", "Bitte Test-ID eingeben.", "error"); return; }

  const { data: test, error: testErr } = await sb.from("tests").select("*").eq("id", testId).single();
  if (testErr || !test) { showFormStatus("dashboard-status", "Test nicht gefunden.", "error"); return; }

  document.getElementById("dashboard-test-name").textContent = test.name + " (von " + test.creator + ")";
  document.getElementById("dashboard-content").classList.remove("hidden");
  document.getElementById("dashboard-status").style.display = "none";

  // Load results
  const { data: results } = await sb.from("results").select("*").eq("test_id", testId).order("created_at", { ascending: false });
  const tbody = document.getElementById("dashboard-results-body");
  tbody.innerHTML = (results || []).map(r => `
    <tr>
      <td>${r.student_name}</td>
      <td><strong>${r.score}</strong></td>
      <td>${new Date(r.created_at).toLocaleString("de-DE")}</td>
    </tr>
  `).join("") || '<tr><td colspan="3" class="text-muted">Noch keine Ergebnisse.</td></tr>';

  // Load appeals
  const resultIds = (results || []).map(r => r.id);
  const appealsContainer = document.getElementById("dashboard-appeals-list");
  const emptyMsg = document.getElementById("dashboard-appeals-empty");

  if (resultIds.length === 0) {
    appealsContainer.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }

  const { data: appeals } = await sb.from("appeals").select("*").in("result_id", resultIds).order("created_at", { ascending: false });

  if (!appeals || appeals.length === 0) {
    appealsContainer.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }

  emptyMsg.style.display = "none";
  appealsContainer.innerHTML = appeals.map(a => `
    <div class="appeal-card" data-appeal-id="${a.id}">
      <div class="appeal-info">
        <strong>${a.student_name}</strong> - "${a.latin_word}"<br>
        Antwort: <strong>${a.student_answer}</strong> | Richtig: ${a.correct_answers}<br>
        Status: <span class="appeal-status ${a.status}">${a.status === "pending" ? "Ausstehend" : a.status === "approved" ? "Akzeptiert" : "Abgelehnt"}</span>
      </div>
      ${a.status === "pending" ? `
        <div class="appeal-actions">
          <button class="btn btn-success btn-sm approve-btn" data-id="${a.id}">Akzeptieren</button>
          <button class="btn btn-danger btn-sm reject-btn" data-id="${a.id}">Ablehnen</button>
        </div>
      ` : ""}
    </div>
  `).join("");

  appealsContainer.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", () => updateAppeal(btn.dataset.id, "approved", testId));
  });
  appealsContainer.querySelectorAll(".reject-btn").forEach(btn => {
    btn.addEventListener("click", () => updateAppeal(btn.dataset.id, "rejected", testId));
  });
}

async function updateAppeal(appealId, status, testId) {
  const sb = getSupabase();
  const { error } = await sb.from("appeals").update({ status }).eq("id", appealId);
  if (error) { alert("Fehler: " + error.message); return; }
  loadDashboard();
}
