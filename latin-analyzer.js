// ============================================================
// LATIN FORMS ANALYZER
// Regelbasierte Analyse flektierter lateinischer Formen.
// Liefert mögliche grammatische Bestimmungen + Lemma-Kandidaten.
// Mehrdeutigkeiten werden absichtlich ALLE zurückgegeben.
// ============================================================

(function (global) {
  'use strict';

  // ---------- Hilfsfunktionen ----------
  const norm = (s) => (s || '').toLowerCase().trim()
    .replace(/[āăáà]/g, 'a').replace(/[ēĕéè]/g, 'e')
    .replace(/[īĭíì]/g, 'i').replace(/[ōŏóò]/g, 'o')
    .replace(/[ūŭúù]/g, 'u').replace(/[ȳ]/g, 'y');

  const uniq = (arr) => {
    const seen = new Set(); const out = [];
    for (const a of arr) {
      const k = JSON.stringify(a);
      if (!seen.has(k)) { seen.add(k); out.push(a); }
    }
    return out;
  };

  // ---------- Endungstabellen ----------
  const PERS_ACTIVE = [
    { end: 'o',   p: 1, n: 'Sg' }, { end: 'm',   p: 1, n: 'Sg' },
    { end: 's',   p: 2, n: 'Sg' }, { end: 't',   p: 3, n: 'Sg' },
    { end: 'mus', p: 1, n: 'Pl' }, { end: 'tis', p: 2, n: 'Pl' },
    { end: 'nt',  p: 3, n: 'Pl' }
  ];
  const PERS_PASSIVE = [
    { end: 'r',    p: 1, n: 'Sg' }, { end: 'ris', p: 2, n: 'Sg' },
    { end: 'tur',  p: 3, n: 'Sg' }, { end: 'mur', p: 1, n: 'Pl' },
    { end: 'mini', p: 2, n: 'Pl' }, { end: 'ntur', p: 3, n: 'Pl' }
  ];

  // Perfekt Aktiv Endungen
  const PERF_ACT = [
    { end: 'i',     p: 1, n: 'Sg' },
    { end: 'isti',  p: 2, n: 'Sg' },
    { end: 'it',    p: 3, n: 'Sg' },
    { end: 'imus',  p: 1, n: 'Pl' },
    { end: 'istis', p: 2, n: 'Pl' },
    { end: 'erunt', p: 3, n: 'Pl' },
    { end: 'ere',   p: 3, n: 'Pl' }
  ];

  // ---------- Unregelmäßige Verben ----------
  // Mapping: Form (normalisiert) -> Array von Analysen
  const IRREG = {
    // esse
    'sum':   [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'es':    [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'est':   [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'sumus': [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Ind', voice: 'Akt', p: 1, n: 'Pl' }],
    'estis': [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Ind', voice: 'Akt', p: 2, n: 'Pl' }],
    'sunt':  [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Ind', voice: 'Akt', p: 3, n: 'Pl' }],
    'eram':  [{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'eras':  [{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'erat':  [{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'eramus':[{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 1, n: 'Pl' }],
    'eratis':[{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 2, n: 'Pl' }],
    'erant': [{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 3, n: 'Pl' }],
    'ero':   [{ lemma: 'esse', trans: 'sein', tempus: 'Futur I',   modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'eris':  [{ lemma: 'esse', trans: 'sein', tempus: 'Futur I',   modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'erit':  [{ lemma: 'esse', trans: 'sein', tempus: 'Futur I',   modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'erimus':[{ lemma: 'esse', trans: 'sein', tempus: 'Futur I',   modus: 'Ind', voice: 'Akt', p: 1, n: 'Pl' }],
    'eritis':[{ lemma: 'esse', trans: 'sein', tempus: 'Futur I',   modus: 'Ind', voice: 'Akt', p: 2, n: 'Pl' }],
    'erunt': [{ lemma: 'esse', trans: 'sein', tempus: 'Futur I',   modus: 'Ind', voice: 'Akt', p: 3, n: 'Pl' }],
    'sim':   [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Konj', voice: 'Akt', p: 1, n: 'Sg' }],
    'sis':   [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Konj', voice: 'Akt', p: 2, n: 'Sg' }],
    'sit':   [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Konj', voice: 'Akt', p: 3, n: 'Sg' }],
    'simus': [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Konj', voice: 'Akt', p: 1, n: 'Pl' }],
    'sitis': [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Konj', voice: 'Akt', p: 2, n: 'Pl' }],
    'sint':  [{ lemma: 'esse', trans: 'sein', tempus: 'Präsens',   modus: 'Konj', voice: 'Akt', p: 3, n: 'Pl' }],
    'essem': [{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Konj', voice: 'Akt', p: 1, n: 'Sg' }],
    'esses': [{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Konj', voice: 'Akt', p: 2, n: 'Sg' }],
    'esset': [{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Konj', voice: 'Akt', p: 3, n: 'Sg' }],
    'essemus':[{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Konj', voice: 'Akt', p: 1, n: 'Pl' }],
    'essetis':[{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Konj', voice: 'Akt', p: 2, n: 'Pl' }],
    'essent':[{ lemma: 'esse', trans: 'sein', tempus: 'Imperfekt', modus: 'Konj', voice: 'Akt', p: 3, n: 'Pl' }],
    'fui':   [{ lemma: 'esse', trans: 'sein', tempus: 'Perfekt',   modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'fuisti':[{ lemma: 'esse', trans: 'sein', tempus: 'Perfekt',   modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'fuit':  [{ lemma: 'esse', trans: 'sein', tempus: 'Perfekt',   modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'fuimus':[{ lemma: 'esse', trans: 'sein', tempus: 'Perfekt',   modus: 'Ind', voice: 'Akt', p: 1, n: 'Pl' }],
    'fuistis':[{ lemma: 'esse', trans: 'sein', tempus: 'Perfekt',  modus: 'Ind', voice: 'Akt', p: 2, n: 'Pl' }],
    'fuerunt':[{ lemma: 'esse', trans: 'sein', tempus: 'Perfekt',  modus: 'Ind', voice: 'Akt', p: 3, n: 'Pl' }],
    // posse
    'possum':  [{ lemma: 'posse', trans: 'können', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'potes':   [{ lemma: 'posse', trans: 'können', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'potest':  [{ lemma: 'posse', trans: 'können', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'possumus':[{ lemma: 'posse', trans: 'können', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 1, n: 'Pl' }],
    'potestis':[{ lemma: 'posse', trans: 'können', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 2, n: 'Pl' }],
    'possunt': [{ lemma: 'posse', trans: 'können', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 3, n: 'Pl' }],
    'poteram': [{ lemma: 'posse', trans: 'können', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'poteras': [{ lemma: 'posse', trans: 'können', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'poterat': [{ lemma: 'posse', trans: 'können', tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'potui':   [{ lemma: 'posse', trans: 'können', tempus: 'Perfekt', modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'potuit':  [{ lemma: 'posse', trans: 'können', tempus: 'Perfekt', modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    // ferre
    'fero':   [{ lemma: 'ferre', trans: 'tragen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'fers':   [{ lemma: 'ferre', trans: 'tragen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'fert':   [{ lemma: 'ferre', trans: 'tragen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'ferimus':[{ lemma: 'ferre', trans: 'tragen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 1, n: 'Pl' }],
    'fertis': [{ lemma: 'ferre', trans: 'tragen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 2, n: 'Pl' }],
    'ferunt': [{ lemma: 'ferre', trans: 'tragen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 3, n: 'Pl' }],
    'tuli':   [{ lemma: 'ferre', trans: 'tragen', tempus: 'Perfekt', modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'tulit':  [{ lemma: 'ferre', trans: 'tragen', tempus: 'Perfekt', modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    // ire
    'eo':   [{ lemma: 'ire', trans: 'gehen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'is':   [{ lemma: 'ire', trans: 'gehen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'it':   [{ lemma: 'ire', trans: 'gehen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'imus': [{ lemma: 'ire', trans: 'gehen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 1, n: 'Pl' }],
    'itis': [{ lemma: 'ire', trans: 'gehen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 2, n: 'Pl' }],
    'eunt': [{ lemma: 'ire', trans: 'gehen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 3, n: 'Pl' }],
    // velle
    'volo':    [{ lemma: 'velle', trans: 'wollen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 1, n: 'Sg' }],
    'vis':     [{ lemma: 'velle', trans: 'wollen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 2, n: 'Sg' }],
    'vult':    [{ lemma: 'velle', trans: 'wollen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 3, n: 'Sg' }],
    'volumus': [{ lemma: 'velle', trans: 'wollen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 1, n: 'Pl' }],
    'vultis':  [{ lemma: 'velle', trans: 'wollen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 2, n: 'Pl' }],
    'volunt':  [{ lemma: 'velle', trans: 'wollen', tempus: 'Präsens', modus: 'Ind', voice: 'Akt', p: 3, n: 'Pl' }]
  };

  // ---------- Formatierung ----------
  function fmtVerb(a) {
    const parts = [];
    parts.push('Verb');
    if (a.tempus) parts.push(a.tempus);
    if (a.modus) parts.push(a.modus === 'Konj' ? 'Konjunktiv' : (a.modus === 'Ind' ? 'Indikativ' : a.modus));
    if (a.voice) parts.push(a.voice === 'Akt' ? 'Aktiv' : 'Passiv');
    if (a.p && a.n) parts.push(a.p + '. Pers. ' + a.n);
    return parts.join(' · ');
  }

  function fmtNomen(a) {
    const cases = { Nom: 'Nominativ', Gen: 'Genitiv', Dat: 'Dativ', Akk: 'Akkusativ', Abl: 'Ablativ', Vok: 'Vokativ' };
    const parts = ['Nomen/Adj'];
    if (a.case) parts.push(cases[a.case] || a.case);
    if (a.n) parts.push(a.n);
    if (a.decl) parts.push(a.decl + '. Dekl.');
    return parts.join(' · ');
  }

  // ---------- Verb-Analyse (regelbasiert) ----------
  function analyzeVerbRules(form) {
    const f = norm(form);
    const out = [];

    // Imperativ Präsens
    // -a / -e / -i (Sg), -ate / -ete / -ite (Pl)
    if (/[aei]$/.test(f) && f.length >= 2 && !/ae$/.test(f)) {
      const stem = f.slice(0, -1);
      out.push({ kind: 'verb', stem, tempus: 'Präsens', modus: 'Imp', voice: 'Akt', p: 2, n: 'Sg',
        infinitiveGuess: stem + 're' });
    }
    if (/(ate|ete|ite)$/.test(f)) {
      const stem = f.slice(0, -2);
      out.push({ kind: 'verb', stem, tempus: 'Präsens', modus: 'Imp', voice: 'Akt', p: 2, n: 'Pl',
        infinitiveGuess: stem + 're' });
    }

    // Perfekt Aktiv (Indikativ)
    for (const pe of PERF_ACT) {
      if (f.endsWith(pe.end) && f.length > pe.end.length) {
        const perfStem = f.slice(0, -pe.end.length);
        out.push({ kind: 'verb', perfStem, tempus: 'Perfekt', modus: 'Ind', voice: 'Akt',
          p: pe.p, n: pe.n });
      }
    }

    // Plusquamperfekt Indikativ -era-
    // Konj Plusquamperfekt -isse-
    // Konj Perfekt -eri-
    // Futur II -eri- / -er-
    const pqpMatch = f.match(/^(.+?)(era|eri|isse)(m|s|t|mus|tis|nt)$/);
    if (pqpMatch) {
      const [, stem, tmark, pend] = pqpMatch;
      const pmap = { m: [1,'Sg'], s:[2,'Sg'], t:[3,'Sg'], mus:[1,'Pl'], tis:[2,'Pl'], nt:[3,'Pl'] };
      const [p, n] = pmap[pend];
      if (tmark === 'era') {
        out.push({ kind: 'verb', perfStem: stem, tempus: 'Plusquamperfekt', modus: 'Ind', voice: 'Akt', p, n });
      } else if (tmark === 'isse') {
        out.push({ kind: 'verb', perfStem: stem, tempus: 'Plusquamperfekt', modus: 'Konj', voice: 'Akt', p, n });
      } else if (tmark === 'eri') {
        // mehrdeutig
        out.push({ kind: 'verb', perfStem: stem, tempus: 'Futur II', modus: 'Ind', voice: 'Akt', p, n });
        out.push({ kind: 'verb', perfStem: stem, tempus: 'Perfekt', modus: 'Konj', voice: 'Akt', p, n });
      }
    }

    // Imperfekt Indikativ Aktiv: -ba- + Endung
    const impfA = f.match(/^(.+?)(ba)(m|s|t|mus|tis|nt)$/);
    if (impfA) {
      const [, stem, , pend] = impfA;
      const pmap = { m: [1,'Sg'], s:[2,'Sg'], t:[3,'Sg'], mus:[1,'Pl'], tis:[2,'Pl'], nt:[3,'Pl'] };
      const [p, n] = pmap[pend];
      out.push({ kind: 'verb', presStem: stem, tempus: 'Imperfekt', modus: 'Ind', voice: 'Akt', p, n,
        infinitiveGuess: stem + 're' });
    }
    // Imperfekt Passiv: -ba- + Passivendung
    const impfP = f.match(/^(.+?)(ba)(r|ris|tur|mur|mini|ntur)$/);
    if (impfP) {
      const [, stem, , pend] = impfP;
      const pp = PERS_PASSIVE.find(x => x.end === pend);
      if (pp) out.push({ kind: 'verb', presStem: stem, tempus: 'Imperfekt', modus: 'Ind', voice: 'Pas',
        p: pp.p, n: pp.n, infinitiveGuess: stem + 'ri' });
    }

    // Imperfekt Konjunktiv: Infinitiv + Endung (amarem, viderem, caperem, audirem)
    const konjImpf = f.match(/^(.+?re)(m|s|t|mus|tis|nt)$/);
    if (konjImpf) {
      const [, inf, pend] = konjImpf;
      const pmap = { m: [1,'Sg'], s:[2,'Sg'], t:[3,'Sg'], mus:[1,'Pl'], tis:[2,'Pl'], nt:[3,'Pl'] };
      const [p, n] = pmap[pend];
      out.push({ kind: 'verb', infinitiveGuess: inf, tempus: 'Imperfekt', modus: 'Konj', voice: 'Akt', p, n });
    }

    // Futur I: 1./2. Konjug.: -bo, -bis, -bit, -bimus, -bitis, -bunt
    const futB = f.match(/^(.+?)b(o|is|it|imus|itis|unt)$/);
    if (futB) {
      const [, stem, suf] = futB;
      const pmap = { o:[1,'Sg'], is:[2,'Sg'], it:[3,'Sg'], imus:[1,'Pl'], itis:[2,'Pl'], unt:[3,'Pl'] };
      const [p, n] = pmap[suf];
      out.push({ kind: 'verb', presStem: stem, tempus: 'Futur I', modus: 'Ind', voice: 'Akt', p, n,
        infinitiveGuess: stem + 're' });
    }

    // Präsens Konjunktiv (a→e, e→ea, i→ia) — heuristisch über Endungen -em/-eam/-iam
    const konjPres = f.match(/^(.+?)(e|ea|ia)(m|s|t|mus|tis|nt)$/);
    if (konjPres) {
      const [, stem, vowel, pend] = konjPres;
      const pmap = { m: [1,'Sg'], s:[2,'Sg'], t:[3,'Sg'], mus:[1,'Pl'], tis:[2,'Pl'], nt:[3,'Pl'] };
      const [p, n] = pmap[pend];
      let guessed;
      if (vowel === 'e') guessed = stem + 'are';   // a-Konj
      else if (vowel === 'ea') guessed = stem + 'ere'; // e-Konj
      else guessed = stem + 'ere'; // i-/gem.
      out.push({ kind: 'verb', presStem: stem, tempus: 'Präsens', modus: 'Konj', voice: 'Akt', p, n,
        infinitiveGuess: guessed });
    }

    // Präsens Indikativ Aktiv
    for (const pe of PERS_ACTIVE) {
      if (f.endsWith(pe.end) && f.length > pe.end.length + 1) {
        const stem = f.slice(0, -pe.end.length);
        // Basisform-Vermutung je nach Endvokal
        let inf;
        if (/a$/.test(stem)) inf = stem + 're';
        else if (/e$/.test(stem)) inf = stem + 're';
        else if (/i$/.test(stem)) inf = stem + 're';
        else inf = stem + 'ere';
        out.push({ kind: 'verb', presStem: stem, tempus: 'Präsens', modus: 'Ind', voice: 'Akt',
          p: pe.p, n: pe.n, infinitiveGuess: inf });
      }
    }
    // Präsens Indikativ Passiv
    for (const pe of PERS_PASSIVE) {
      if (f.endsWith(pe.end) && f.length > pe.end.length + 1) {
        const stem = f.slice(0, -pe.end.length);
        out.push({ kind: 'verb', presStem: stem, tempus: 'Präsens', modus: 'Ind', voice: 'Pas',
          p: pe.p, n: pe.n, infinitiveGuess: stem + 'ri' });
      }
    }

    // Infinitiv Präsens Aktiv (-are, -ere, -ire)
    if (/(are|ere|ire)$/.test(f)) {
      out.push({ kind: 'verb', tempus: 'Präsens', modus: 'Inf', voice: 'Akt', infinitiveGuess: f });
    }
    // Infinitiv Präsens Passiv (-ari, -eri, -iri)
    if (/(ari|eri|iri)$/.test(f)) {
      out.push({ kind: 'verb', tempus: 'Präsens', modus: 'Inf', voice: 'Pas',
        infinitiveGuess: f.slice(0, -1) + 'e' });
    }

    // Partizipien
    if (/ns$/.test(f)) {
      out.push({ kind: 'participle', sub: 'PPA', infinitiveGuess: f.slice(0, -2) + 're' });
    }
    if (/(tus|ta|tum|ti|tae|ta)$/.test(f)) {
      out.push({ kind: 'participle', sub: 'PPP' });
    }

    return out;
  }

  // ---------- Nomen-/Adjektiv-Analyse ----------
  const NOM_ENDINGS = [
    // a-Deklination
    { end: 'a',   decl: 1, cases: [['Nom','Sg'], ['Abl','Sg'], ['Nom','Pl'], ['Vok','Sg']] },
    { end: 'ae',  decl: 1, cases: [['Gen','Sg'], ['Dat','Sg'], ['Nom','Pl']] },
    { end: 'am',  decl: 1, cases: [['Akk','Sg']] },
    { end: 'as',  decl: 1, cases: [['Akk','Pl']] },
    { end: 'arum',decl: 1, cases: [['Gen','Pl']] },
    { end: 'is',  decl: 1, cases: [['Dat','Pl'], ['Abl','Pl']] },
    // o-Deklination
    { end: 'us',  decl: 2, cases: [['Nom','Sg']] },
    { end: 'i',   decl: 2, cases: [['Gen','Sg'], ['Nom','Pl'], ['Vok','Pl']] },
    { end: 'o',   decl: 2, cases: [['Dat','Sg'], ['Abl','Sg']] },
    { end: 'um',  decl: 2, cases: [['Akk','Sg'], ['Nom','Sg (n)']] },
    { end: 'os',  decl: 2, cases: [['Akk','Pl']] },
    { end: 'orum',decl: 2, cases: [['Gen','Pl']] },
    // 3. Dekl.
    { end: 'is',  decl: 3, cases: [['Gen','Sg']] },
    { end: 'em',  decl: 3, cases: [['Akk','Sg']] },
    { end: 'e',   decl: 3, cases: [['Abl','Sg']] },
    { end: 'es',  decl: 3, cases: [['Nom','Pl'], ['Akk','Pl']] },
    { end: 'um',  decl: 3, cases: [['Gen','Pl']] },
    { end: 'ium', decl: 3, cases: [['Gen','Pl (i-St.)']] },
    { end: 'ibus',decl: 3, cases: [['Dat','Pl'], ['Abl','Pl']] }
  ];

  function analyzeNounRules(form) {
    const f = norm(form);
    const out = [];
    // längste Endung zuerst
    const sorted = NOM_ENDINGS.slice().sort((a, b) => b.end.length - a.end.length);
    const seenStems = new Map();
    for (const ne of sorted) {
      if (f.endsWith(ne.end) && f.length > ne.end.length) {
        const stem = f.slice(0, -ne.end.length);
        for (const [c, n] of ne.cases) {
          out.push({ kind: 'noun', stem, decl: ne.decl, case: c, n });
        }
        seenStems.set(stem, true);
      }
    }
    return out;
  }

  // ---------- Lemma-Matching aus Vokabelliste ----------
  // vocabList: Array von { latin_word, forms, german_translation, lesson_number, book? }
  function matchLemmas(analyses, vocabList) {
    const matches = [];
    for (const v of vocabList) {
      const lemma = norm(v.latin_word);
      const lemmaBase = lemma.replace(/[,;\s].*$/, '').trim();
      // "amare" → Stamm "ama"
      for (const a of analyses) {
        let hit = false;
        if (a.kind === 'verb') {
          if (a.infinitiveGuess && a.infinitiveGuess === lemmaBase) hit = true;
          if (a.presStem && lemmaBase.startsWith(a.presStem) && lemmaBase.length - a.presStem.length <= 3) hit = true;
          if (a.perfStem && lemma.includes(a.perfStem) && a.perfStem.length >= 3) hit = true;
          if (a.lemma && a.lemma === lemmaBase) hit = true;
        } else if (a.kind === 'noun' || a.kind === 'participle') {
          if (a.stem && lemmaBase.startsWith(a.stem) && a.stem.length >= 2) hit = true;
        }
        // Direktmatch
        if (lemmaBase === norm(a.form || '')) hit = true;
        if (hit) matches.push({ vocab: v, analysis: a });
      }
      // exakter Lemma-Treffer
      if (lemmaBase === norm(window.__CURRENT_QUERY__ || '')) {
        matches.push({ vocab: v, analysis: { kind: 'lemma', note: 'Grundform' } });
      }
    }
    // duplikate entfernen (pro vocab+label)
    const seen = new Set(); const uniqM = [];
    for (const m of matches) {
      const k = m.vocab.latin_word + '|' + (m.analysis.kind === 'verb' ? fmtVerb(m.analysis) : (m.analysis.kind === 'noun' ? fmtNomen(m.analysis) : (m.analysis.note || m.analysis.kind)));
      if (!seen.has(k)) { seen.add(k); uniqM.push(m); }
    }
    return uniqM;
  }

  // ---------- Hauptfunktion ----------
  function analyze(form) {
    const f = norm(form);
    if (!f) return { analyses: [] };
    const analyses = [];

    // 1. Unregelmäßige Verben
    if (IRREG[f]) {
      IRREG[f].forEach(a => analyses.push(Object.assign({ kind: 'verb' }, a)));
    }

    // 2. Regelbasiert Verben
    analyses.push(...analyzeVerbRules(f));
    // 3. Nomen/Adjektive
    analyses.push(...analyzeNounRules(f));

    return { form: f, analyses: uniq(analyses) };
  }

  function formatAnalysis(a) {
    if (a.kind === 'verb') return fmtVerb(a);
    if (a.kind === 'noun') return fmtNomen(a);
    if (a.kind === 'participle') return a.sub === 'PPA' ? 'Partizip Präsens Aktiv' : 'Partizip Perfekt Passiv';
    if (a.kind === 'lemma') return 'Grundform';
    return a.kind;
  }

  global.LatinAnalyzer = { analyze, matchLemmas, formatAnalysis, norm };
})(window);
