// Paris 27 — Supabase data layer.
// Exposes the same small document API the app used on claude.ai:
//   db.doc("plan/meta").onSnapshot(next, err)
//   db.collection("logs").onSnapshot(next, err)
//   db.collection("logs").doc(id).set(body)
// All rows live in one table `docs (user_id, coll, id, data)` protected by row-level security.
(function () {
  "use strict";
  const CFG = window.P27_CONFIG || {};
  const L = () => { try { return localStorage.getItem("lang") || "fr"; } catch (e) { return "fr"; } };
  const TXT = {
    fr: { title: "Connexion", email: "E-mail", pw: "Mot de passe", in: "Se connecter", up: "Créer le compte",
      check: "Compte créé. Ouvrez le lien reçu par e-mail, puis revenez ici pour vous connecter.",
      bad: "E-mail ou mot de passe incorrect.", cfg: "L'application n'est pas encore reliée à sa base de données.", net: "Pas de connexion. Réessayez." },
    en: { title: "Sign in", email: "Email", pw: "Password", in: "Sign in", up: "Create account",
      check: "Account created. Open the link in your email, then come back here to sign in.",
      bad: "Wrong email or password.", cfg: "The app is not connected to its database yet.", net: "No connection. Try again." }
  };
  const tx = k => (TXT[L()] || TXT.fr)[k];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let sb = null, uid = null, resolveLogin = null, msg = "";
  const P27 = { ready: false };
  window.P27 = P27;

  P27.renderLogin = function (V) {
    if (!sb) { V.innerHTML = `<div class="section"><p class="banner">${tx("cfg")}</p></div>`; return; }
    V.innerHTML = `<div class="hero"><span class="eyebrow">Paris 27</span><h1>${tx("title")}</h1></div>
      <form class="section" id="login" novalidate>
        <label class="lbl">${tx("email")}<span class="field"><input id="li-email" type="email" autocomplete="username" inputmode="email" required></span></label>
        <label class="lbl">${tx("pw")}<span class="field"><input id="li-pw" type="password" autocomplete="current-password" required minlength="8"></span></label>
        <div class="row2"><button class="btn" type="submit">${tx("in")}</button><button class="linkbtn" type="button" id="li-up">${tx("up")}</button></div>
        <p class="save" id="li-msg" aria-live="polite">${esc(msg)}</p>
      </form>`;
    const form = document.getElementById("login");
    const creds = () => ({ email: document.getElementById("li-email").value.trim(), password: document.getElementById("li-pw").value });
    const say = m => { msg = m; document.getElementById("li-msg").textContent = m; };
    form.addEventListener("submit", async e => {
      e.preventDefault();
      try {
        const { data, error } = await sb.auth.signInWithPassword(creds());
        if (error) return say(tx("bad"));
        msg = ""; done(data.session);
      } catch (x) { say(tx("net")); }
    });
    document.getElementById("li-up").addEventListener("click", async () => {
      try {
        const { data, error } = await sb.auth.signUp(creds());
        if (error) return say(error.message);
        if (data.session) { msg = ""; done(data.session); } else say(tx("check"));
      } catch (x) { say(tx("net")); }
    });
  };

  function done(session) { uid = session.user.id; P27.ready = true; if (resolveLogin) resolveLogin(); }

  P27.signOut = async function () { if (sb) await sb.auth.signOut(); try { Object.keys(localStorage).filter(k => k.startsWith("p27:")).forEach(k => localStorage.removeItem(k)); } catch (e) {} location.reload(); };

  // Returns the db adapter once the viewer is signed in.
  P27.start = async function (rerender) {
    if (CFG.url && CFG.anonKey && window.supabase) {
      sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
      try { const { data } = await sb.auth.getSession(); if (data.session) done(data.session); } catch (e) {}
    }
    if (!P27.ready) { rerender(); await new Promise(r => { resolveLogin = r; }); }
    return adapter();
  };

  function adapter() {
    const cache = {}, subs = {};
    const key = c => "p27:" + uid + ":" + c;
    const QK = "p27:" + uid + ":pending";
    let queue = {};
    try { queue = JSON.parse(localStorage.getItem(QK) || "{}"); } catch (e) {}
    const saveQueue = () => { try { localStorage.setItem(QK, JSON.stringify(queue)); } catch (e) {} };
    let pushing = null;
    async function push() {
      if (pushing) return pushing;
      pushing = (async () => {
        for (const k of Object.keys(queue)) {
          const q = queue[k];
          const { error } = await sb.from("docs").upsert({ user_id: uid, coll: q.c, id: q.id, data: q.body, updated_at: q.at }, { onConflict: "user_id,coll,id" });
          if (error) throw error;
          if (queue[k] === q) { delete queue[k]; saveQueue(); }
        }
      })().finally(() => { pushing = null; });
      return pushing;
    }
    const retry = () => { if (Object.keys(queue).length) push().catch(() => {}); };
    window.addEventListener("online", retry);
    setInterval(retry, 30000);
    function emit(c) { (subs[c] || []).forEach(f => f(cache[c] || {})); }
    async function load(c) {
      const { data, error } = await sb.from("docs").select("id,data").eq("coll", c);
      if (error) throw error;
      const o = {}; data.forEach(r => { o[r.id] = r.data; });
      // Local edits not yet on the server win over what the server returned.
      Object.values(queue).forEach(q => { if (q.c === c) o[q.id] = q.body; });
      cache[c] = o;
      try { localStorage.setItem(key(c), JSON.stringify(o)); } catch (e) {}
      emit(c);
    }
    function subscribe(c, f, err) {
      (subs[c] = subs[c] || []).push(f);
      if (!cache[c]) { try { const s = localStorage.getItem(key(c)); if (s) cache[c] = JSON.parse(s); } catch (e) {} }
      if (cache[c]) setTimeout(() => f(cache[c]), 0);
      load(c).catch(e => err && err({ code: "unavailable", message: String(e && e.message) }));
      return () => { subs[c] = (subs[c] || []).filter(x => x !== f); };
    }
    const snapDoc = (id, d) => ({ id, exists: d !== undefined, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } });
    // Live updates from other devices, plus a refresh whenever the app comes back to the foreground.
    try {
      sb.channel("docs-" + uid).on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "user_id=eq." + uid }, p => {
        const c = (p.new && p.new.coll) || (p.old && p.old.coll);
        (c ? [c] : Object.keys(subs)).forEach(x => subs[x] && load(x).catch(() => {}));
      }).subscribe();
    } catch (e) {}
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { retry(); Object.keys(subs).forEach(c => load(c).catch(() => {})); } });
    retry();

    function collection(c) {
      return {
        onSnapshot(next, err) { return subscribe(c, o => next({ docs: Object.entries(o).map(([id, d]) => snapDoc(id, d)), size: Object.keys(o).length, empty: !Object.keys(o).length }), err); },
        doc(id) {
          return {
            id,
            // Saved on the phone first, then sent; without network it is retried later.
            async set(body) {
              cache[c] = Object.assign({}, cache[c], { [id]: body });
              try { localStorage.setItem(key(c), JSON.stringify(cache[c])); } catch (e) {}
              queue[c + "/" + id] = { c, id, body, at: new Date().toISOString() }; saveQueue();
              try { await push(); return { synced: true }; } catch (e) { return { synced: false }; }
            },
            onSnapshot(next, err) { return subscribe(c, o => next(snapDoc(id, o[id])), err); }
          };
        }
      };
    }
    // Bulk restore from a JSON backup: {collection: {docId: data}}.
    async function importAll(dump) {
      const rows = [];
      for (const [c, docs] of Object.entries(dump)) for (const [id, data] of Object.entries(docs)) rows.push({ user_id: uid, coll: c, id, data, updated_at: new Date().toISOString() });
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await sb.from("docs").upsert(rows.slice(i, i + 200), { onConflict: "user_id,coll,id" });
        if (error) throw error;
      }
      await Promise.all(Object.keys(subs).map(c => load(c)));
      return rows.length;
    }
    async function exportAll() {
      const { data, error } = await sb.from("docs").select("coll,id,data");
      if (error) throw error;
      const o = {}; data.forEach(r => { (o[r.coll] = o[r.coll] || {})[r.id] = r.data; });
      return o;
    }
    return {
      collection,
      doc(path) { const [c, id] = path.split("/"); return collection(c).doc(id); },
      importAll, exportAll,
      pending: () => Object.keys(queue).length
    };
  }
})();
