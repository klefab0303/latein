// ============================================================
// LATIN FORMS ANALYZER (vereinfacht)
// Liefert: Verb (Person, Numerus, Tempus, Modus, Genus Verbi)
//          Nomen (Kasus, Numerus, Genus)
// Keine Deklinations-Nummer mehr.
// ============================================================
(function (global) {
  'use strict';

  const norm = (s) => (s || '').toLowerCase().trim()
    .replace(/[āăáà]/g, 'a').replace(/[ēĕéè]/g, 'e')
    .replace(/[īĭíì]/g, 'i').replace(/[ōŏóò]/g, 'o')
    .replace(/[ūŭúù]/g, 'u');

  const PMAP = { m: [1,'Sg'], s:[2,'Sg'], t:[3,'Sg'], mus:[1,'Pl'], tis:[2,'Pl'], nt:[3,'Pl'] };

  // Unregelmäßige Verben (häufige Formen)
  const IRREG = {
    'sum':   { lemma:'esse', tempus:'Präsens', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'es':    { lemma:'esse', tempus:'Präsens', p:2,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'est':   { lemma:'esse', tempus:'Präsens', p:3,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'sumus': { lemma:'esse', tempus:'Präsens', p:1,n:'Pl', modus:'Indikativ', voice:'Aktiv' },
    'estis': { lemma:'esse', tempus:'Präsens', p:2,n:'Pl', modus:'Indikativ', voice:'Aktiv' },
    'sunt':  { lemma:'esse', tempus:'Präsens', p:3,n:'Pl', modus:'Indikativ', voice:'Aktiv' },
    'eram':  { lemma:'esse', tempus:'Imperfekt', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'eras':  { lemma:'esse', tempus:'Imperfekt', p:2,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'erat':  { lemma:'esse', tempus:'Imperfekt', p:3,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'eramus':{ lemma:'esse', tempus:'Imperfekt', p:1,n:'Pl', modus:'Indikativ', voice:'Aktiv' },
    'eratis':{ lemma:'esse', tempus:'Imperfekt', p:2,n:'Pl', modus:'Indikativ', voice:'Aktiv' },
    'erant': { lemma:'esse', tempus:'Imperfekt', p:3,n:'Pl', modus:'Indikativ', voice:'Aktiv' },
    'sim':   { lemma:'esse', tempus:'Präsens', p:1,n:'Sg', modus:'Konjunktiv', voice:'Aktiv' },
    'sit':   { lemma:'esse', tempus:'Präsens', p:3,n:'Sg', modus:'Konjunktiv', voice:'Aktiv' },
    'essem': { lemma:'esse', tempus:'Imperfekt', p:1,n:'Sg', modus:'Konjunktiv', voice:'Aktiv' },
    'esset': { lemma:'esse', tempus:'Imperfekt', p:3,n:'Sg', modus:'Konjunktiv', voice:'Aktiv' },
    'fui':   { lemma:'esse', tempus:'Perfekt', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'fuit':  { lemma:'esse', tempus:'Perfekt', p:3,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'possum':{ lemma:'posse', tempus:'Präsens', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'potest':{ lemma:'posse', tempus:'Präsens', p:3,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'potui': { lemma:'posse', tempus:'Perfekt', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'eo':    { lemma:'ire', tempus:'Präsens', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'it':    { lemma:'ire', tempus:'Präsens', p:3,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'volo':  { lemma:'velle', tempus:'Präsens', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'vult':  { lemma:'velle', tempus:'Präsens', p:3,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'fero':  { lemma:'ferre', tempus:'Präsens', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'fert':  { lemma:'ferre', tempus:'Präsens', p:3,n:'Sg', modus:'Indikativ', voice:'Aktiv' },
    'tuli':  { lemma:'ferre', tempus:'Perfekt', p:1,n:'Sg', modus:'Indikativ', voice:'Aktiv' }
  };

  function fmtVerb(a) {
    const parts = ['Verb'];
    if (a.tempus) parts.push(a.tempus);
    if (a.modus) parts.push(a.modus);
    if (a.voice) parts.push(a.voice);
    if (a.p && a.n) parts.push(a.p + '. Pers. ' + (a.n === 'Sg' ? 'Singular' : 'Plural'));
    return parts.join(' · ');
  }
  function fmtNomen(a) {
    const cases = { Nom:'Nominativ', Gen:'Genitiv', Dat:'Dativ', Akk:'Akkusativ', Abl:'Ablativ', Vok:'Vokativ' };
    const parts = ['Nomen / Adjektiv'];
    if (a.case) parts.push(cases[a.case] || a.case);
    if (a.n) parts.push(a.n === 'Sg' ? 'Singular' : 'Plural');
    if (a.gender) parts.push(a.gender);
    return parts.join(' · ');
  }

  // ---------- Verb-Analyse ----------
  function analyzeVerb(f) {
    const out = [];

    // Imperfekt Indikativ Aktiv (-bam, -bas, ...)
    let m = f.match(/^(.+?)ba(m|s|t|mus|tis|nt)$/);
    if (m) {
      const [p, n] = PMAP[m[2]];
      out.push({ kind:'verb', tempus:'Imperfekt', modus:'Indikativ', voice:'Aktiv', p, n });
    }
    // Imperfekt Indikativ Passiv (-bar, -baris, -batur, -bamur, -bamini, -bantur)
    m = f.match(/^(.+?)ba(r|ris|tur|mur|mini|ntur)$/);
    if (m) {
      const map = { r:[1,'Sg'], ris:[2,'Sg'], tur:[3,'Sg'], mur:[1,'Pl'], mini:[2,'Pl'], ntur:[3,'Pl'] };
      const [p, n] = map[m[2]];
      out.push({ kind:'verb', tempus:'Imperfekt', modus:'Indikativ', voice:'Passiv', p, n });
    }
    // Plusquamperfekt Indikativ (-eram)
    m = f.match(/^(.+?)era(m|s|t|mus|tis|nt)$/);
    if (m && f !== 'eram' && f !== 'eras' && f !== 'erat' && f !== 'eramus' && f !== 'eratis' && f !== 'erant') {
      const [p, n] = PMAP[m[2]];
      out.push({ kind:'verb', tempus:'Plusquamperfekt', modus:'Indikativ', voice:'Aktiv', p, n });
    }
    // Plusquamperfekt Konjunktiv / Präsens Konjunktiv von esse
    m = f.match(/^(.+?)isse(m|s|t|mus|tis|nt)$/);
    if (m) {
      const [p, n] = PMAP[m[2]];
      out.push({ kind:'verb', tempus:'Plusquamperfekt', modus:'Konjunktiv', voice:'Aktiv', p, n });
    }
    // Imperfekt Konjunktiv (Infinitiv + Endung)
    m = f.match(/^(.+?)re(m|s|t|mus|tis|nt)$/);
    if (m) {
      const [p, n] = PMAP[m[2]];
      out.push({ kind:'verb', tempus:'Imperfekt', modus:'Konjunktiv', voice:'Aktiv', p, n });
    }
    // Futur I (1./2. Konj): -bo/-bis/-bit/-bimus/-bitis/-bunt
    m = f.match(/^(.+?)b(o|is|it|imus|itis|unt)$/);
    if (m) {
      const map = { o:[1,'Sg'], is:[2,'Sg'], it:[3,'Sg'], imus:[1,'Pl'], itis:[2,'Pl'], unt:[3,'Pl'] };
      const [p, n] = map[m[2]];
      out.push({ kind:'verb', tempus:'Futur I', modus:'Indikativ', voice:'Aktiv', p, n });
    }
    // Perfekt Indikativ Aktiv: -i, -isti, -it, -imus, -istis, -erunt/-ere
    const perfEnds = [
      ['isti',2,'Sg'], ['istis',2,'Pl'], ['erunt',3,'Pl']
    ];
    for (const [end, p, n] of perfEnds) {
      if (f.endsWith(end) && f.length > end.length + 1) {
        out.push({ kind:'verb', tempus:'Perfekt', modus:'Indikativ', voice:'Aktiv', p, n });
      }
    }
    // Infinitiv Präsens Aktiv
    if (/^(.+)(are|ere|ire)$/.test(f) && f.length >= 4) {
      out.push({ kind:'verb', tempus:'Präsens', modus:'Infinitiv', voice:'Aktiv' });
    }
    // Infinitiv Präsens Passiv (-ari, -eri, -iri)
    if (/^(.+)(ari|eri|iri)$/.test(f) && f.length >= 4) {
      out.push({ kind:'verb', tempus:'Präsens', modus:'Infinitiv', voice:'Passiv' });
    }

    return out;
  }

  // ---------- Nomen-Analyse (vereinfacht, mit Genus-Hinweis) ----------
  // Nur sehr eindeutige Endungen, um False-Positives zu reduzieren.
  const NOM_RULES = [
    // a-Dekl. (meist femininum)
    { end:'arum', cases:[['Gen','Pl','f.']] },
    { end:'abus', cases:[['Dat','Pl','f.'],['Abl','Pl','f.']] },
    { end:'ae',   cases:[['Gen','Sg','f.'],['Dat','Sg','f.'],['Nom','Pl','f.']] },
    { end:'am',   cases:[['Akk','Sg','f.']] },
    // o-Dekl. (m./n.)
    { end:'orum', cases:[['Gen','Pl','m./n.']] },
    { end:'us',   cases:[['Nom','Sg','m.']] },
    { end:'um',   cases:[['Akk','Sg','m.'],['Nom','Sg','n.'],['Akk','Sg','n.'],['Gen','Pl','—']] },
    { end:'os',   cases:[['Akk','Pl','m.']] },
    // 3. Dekl.
    { end:'ibus', cases:[['Dat','Pl','—'],['Abl','Pl','—']] },
    { end:'ium',  cases:[['Gen','Pl','—']] },
    { end:'em',   cases:[['Akk','Sg','m./f.']] },
    { end:'es',   cases:[['Nom','Pl','—'],['Akk','Pl','—']] },
    // mehrdeutige Kurzendungen
    { end:'is',   cases:[['Gen','Sg','—'],['Dat','Pl','—'],['Abl','Pl','—']] },
    { end:'i',    cases:[['Gen','Sg','m./n.'],['Nom','Pl','m.']] },
    { end:'o',    cases:[['Dat','Sg','m./n.'],['Abl','Sg','m./n.']] },
    { end:'a',    cases:[['Nom','Sg','f.'],['Abl','Sg','f.'],['Nom','Pl','n.']] }
  ];

  function analyzeNoun(f) {
    const out = [];
    const sorted = NOM_RULES.slice().sort((a, b) => b.end.length - a.end.length);
    let matched = false;
    for (const r of sorted) {
      if (f.endsWith(r.end) && f.length > r.end.length) {
        for (const [c, n, g] of r.cases) {
          out.push({ kind:'noun', case:c, n, gender:g });
        }
        matched = true;
        // Stoppen nach längstem Treffer, um Mehrfachausgabe zu reduzieren
        if (r.end.length >= 2) break;
      }
    }
    return out;
  }

  function uniq(arr) {
    const seen = new Set(); const out = [];
    for (const a of arr) {
      const k = JSON.stringify(a);
      if (!seen.has(k)) { seen.add(k); out.push(a); }
    }
    return out;
  }

  function analyze(form) {
    const f = norm(form);
    if (!f) return { form:'', analyses:[] };
    const analyses = [];
    if (IRREG[f]) analyses.push(Object.assign({ kind:'verb' }, IRREG[f]));
    analyses.push(...analyzeVerb(f));
    analyses.push(...analyzeNoun(f));
    return { form:f, analyses: uniq(analyses) };
  }

  function formatAnalysis(a) {
    if (a.kind === 'verb') return fmtVerb(a);
    if (a.kind === 'noun') return fmtNomen(a);
    return a.kind;
  }

  // Lemma-Suche: Schüler-Modus = exakte Grundformsuche (substring match auf latin_word)
  function searchLemma(query, vocabList) {
    const q = norm(query);
    if (!q) return [];
    const out = [];
    for (const v of vocabList) {
      const head = norm(v.latin_word).split(/[,;\s]/)[0];
      const full = norm(v.latin_word);
      if (head === q || full.includes(q)) {
        out.push(v);
      }
    }
    return out;
  }

  global.LatinAnalyzer = { analyze, formatAnalysis, searchLemma, norm };
})(window);
