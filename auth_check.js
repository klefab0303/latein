// ============================================================
// Auth-Check: einmalige Account-Existenzprüfung pro Sitzung
// Läuft auf allen geschützten Seiten direkt nach Layout-Init
// ============================================================
(function () {
  const PAGE = (document.body && document.body.dataset.page) || '';
  const PROTECTED = ['schueler', 'lehrer', 'analyse', 'profil', 'statistik', 'info'];
  if (!PROTECTED.includes(PAGE)) return;

  let user = null;
  try { user = JSON.parse(sessionStorage.getItem('latin-vocab-user') || 'null'); } catch {}
  // Falls Reste in localStorage liegen (alte Version), wegräumen.
  try { localStorage.removeItem('latin-vocab-user'); } catch {}
  if (!user || !user.id) {
    // Keine Session in diesem Tab → sofort zum Login
    window.location.replace('index.html');
    return;
  }

  // Wartet bis supabase-Client verfügbar ist
  function check() {
    if (!window.supabase) { setTimeout(check, 50); return; }
    let db;
    try { db = window.supabase.createClient(
      'https://jxkupplncsmextsfrlbz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4a3VwcGxuY3NtZXh0c2ZybGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTY3NjcsImV4cCI6MjA4OTY3Mjc2N30.32M4Pf1-w_9qSE4e9ALpzYdYzyWCeOM_hc_LA1OARJs'
    ); } catch { return; }

    db.from('users').select('id').eq('id', user.id).maybeSingle().then(({ data, error }) => {
      if (error) return; // Netzwerkfehler: nicht ausloggen
      if (!data) {
        // Account existiert nicht mehr
        sessionStorage.removeItem('latin-vocab-user');
        try { localStorage.removeItem('latin-vocab-user'); } catch {}
        alert('Dein Account existiert nicht mehr. Bitte melde dich erneut an.');
        window.location.replace('index.html');
        return;
      }
    });
  }
  check();
})();
