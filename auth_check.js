// ============================================================
// Auth-Check: Session über Supabase Auth prüfen.
// Läuft auf allen geschützten Seiten direkt nach Layout-Init.
// ============================================================
(function () {
  const PAGE = (document.body && document.body.dataset.page) || '';
  const PROTECTED = ['schueler', 'lehrer', 'analyse', 'profil', 'statistik', 'info', 'admin'];
  if (!PROTECTED.includes(PAGE)) return;

  // Wartet, bis supabase-Client verfügbar ist.
  function check() {
    if (!window.supabase) { setTimeout(check, 50); return; }
    let db;
    try {
      db = window.supabase.createClient(
        'https://jxkupplncsmextsfrlbz.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4a3VwcGxuY3NtZXh0c2ZybGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTY3NjcsImV4cCI6MjA4OTY3Mjc2N30.32M4Pf1-w_9qSE4e9ALpzYdYzyWCeOM_hc_LA1OARJs'
      );
    } catch { return; }

    db.auth.getSession().then(({ data }) => {
      if (!data?.session?.user) {
        try { sessionStorage.removeItem('latin-vocab-user'); } catch {}
        try { localStorage.removeItem('latin-vocab-user'); } catch {}
        window.location.replace('index.html');
        return;
      }
      // Bei Sign-out / Token-Refresh-Fehler ebenfalls rauswerfen.
      db.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          try { sessionStorage.removeItem('latin-vocab-user'); } catch {}
          window.location.replace('index.html');
        }
      });
    });
  }
  check();
})();
