// Paris 27 — Nutrition tab.
// Self-contained: the main app calls P27N.attach(api) once signed in and P27N.view() to draw the tab.
// Data (table docs, same rules as everything else):
//   nutrition/foods    {items:[{n,b,p,c,f,k}]}   b = portion the numbers are for (100 g, or 1 piece when b <= 10)
//   nutrition/template {meals:[[{n,q}] x4]}       the usual day
//   nutrition/targets  {train|hard|rest:{k,p,c,f}, note}
//   meals/YYYY-MM-DD   {type?, meals:[[{n,q}] x4], tot:{k,p,c,f}, updatedAt}
//   body/YYYY-MM-DD    {weight, bfPct, bfMass, smm, lbm, water, seg:{}, source}
(function () {
  "use strict";
  const TX = {
    fr: { title: "Nutrition", train: "Entraînement", hard: "Intense", rest: "Repos", target: "objectif", prot: "Protéines", carb: "Glucides", fat: "Lipides",
      meals: ["Matin", "Midi", "Avant séance", "Soir"], meal: "Repas", empty: "Rien de saisi pour ce jour.", usual: "Comme d'habitude", blank: "Commencer vide",
      add: "+ Ajouter", food: "Aliment", qty: "Quantité", unknown: "Aliment inconnu. Ajoutez-le en bas de la page.", saveTpl: "Enregistrer comme journée type",
      useTpl: "Remplacer par la journée type", tplSaved: "Journée type enregistrée", last7: "7 derniers jours", avg: "Moyenne", days: "jours saisis", body: "Composition corporelle",
      weight7: "Poids (moy. 7 j)", waist: "Tour de taille", bf: "Masse grasse", lbm: "Masse maigre", smm: "Muscle squelettique", measured: "Mesure", noBody: "Aucune mesure pour l'instant.",
      newFood: "Ajouter ou corriger un aliment", name: "Nom", base: "Pour (g, ou 1 pièce)", save: "Enregistrer", cancel: "Annuler", foodSaved: "Aliment enregistré", remove: "Retirer",
      saved: "Enregistré", saving: "Enregistrement…", unsaved: "Non enregistré. Vérifiez la connexion.", offline: "Enregistré sur le téléphone. Synchronisation au retour du réseau.", loading: "Chargement…" },
    en: { title: "Nutrition", train: "Training", hard: "Hard", rest: "Rest", target: "target", prot: "Protein", carb: "Carbs", fat: "Fat",
      meals: ["Morning", "Lunch", "Pre-session", "Dinner"], meal: "Meal", empty: "Nothing logged for this day.", usual: "Same as usual", blank: "Start empty",
      add: "+ Add", food: "Food", qty: "Amount", unknown: "Unknown food. Add it at the bottom of the page.", saveTpl: "Save as usual day",
      useTpl: "Replace with usual day", tplSaved: "Usual day saved", last7: "Last 7 days", avg: "Average", days: "days logged", body: "Body composition",
      weight7: "Weight (7-day avg)", waist: "Waist", bf: "Body fat", lbm: "Lean mass", smm: "Skeletal muscle", measured: "Measured", noBody: "No measurement yet.",
      newFood: "Add or fix a food", name: "Name", base: "Per (g, or 1 piece)", save: "Save", cancel: "Cancel", foodSaved: "Food saved", remove: "Remove",
      saved: "Saved", saving: "Saving…", unsaved: "Not saved. Check your connection.", offline: "Saved on the phone. It will sync when the connection is back.", loading: "Loading…" }
  };
  const DEF_TARGETS = { train: { k: 2600, p: 165, c: 330, f: 65 }, hard: { k: 2800, p: 165, c: 380, f: 65 }, rest: { k: 2200, p: 165, c: 210, f: 70 } };
  const CSS = `.nz .bar{height:8px;border-radius:9999px;background:var(--paper-2);overflow:hidden}
.nz .bar i{display:block;height:100%;background:var(--seal);border-radius:9999px}
.nz .bar.over i{background:var(--ink)}
.nz .mac{display:flex;flex-direction:column;gap:6px}
.nz .mac div:first-child{display:flex;justify-content:space-between;font-size:14px;color:var(--graphite)}
.nz .mac b{color:var(--ink);font-weight:600}
.nz .fr{display:grid;grid-template-columns:1fr 104px 48px 32px;gap:8px;align-items:center}
.nz .fr .nm{min-width:0;font-size:15px;color:var(--ink);line-height:1.25;overflow-wrap:anywhere}
.nz .fr .kc{font-size:13px;color:var(--graphite);text-align:right}
.nz .fr .x{width:32px;height:32px;border-radius:50%;border:1px solid var(--taupe);background:transparent;color:var(--graphite);font-size:18px;line-height:1;padding:0}
.nz .addr{display:grid;grid-template-columns:1fr 104px;gap:8px}
.nz .mh{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.nz .mh small{font-size:13px;color:var(--graphite)}
.nz .seg3 button[aria-pressed="true"]{background:var(--seal);border-color:var(--seal);color:var(--parchment)}
.nz details summary{cursor:pointer;color:var(--seal);font-weight:600;font-size:15px;list-style:none}
.nz details summary::-webkit-details-marker{display:none}
.nz .nf-body{padding-top:14px}
.nz .nf-act{align-items:center;margin-top:8px}
.nz .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media (max-width:380px){.nz .fr{grid-template-columns:1fr 92px 42px 32px}}`;

  let A = null; // api from the main app
  const N = { date: null, foods: null, tpl: null, targets: null, meals: {}, body: {}, ready: false, msg: "" };
  const dirty = new Set(), timers = {}, writing = {};
  const L = () => A.lang, t = k => (TX[L()] || TX.fr)[k];
  const r0 = v => Math.round(v), r1 = v => Math.round(v * 10) / 10;
  const num = v => { const x = parseFloat(String(v).replace(",", ".")); return isNaN(x) ? null : x; };

  function foodMap() { const m = {}; ((N.foods && N.foods.items) || []).forEach(f => { m[f.n.toLowerCase()] = f; }); return m; }
  function unit(f) { return f && f.b <= 10 ? "pc" : "g"; }
  function itemVals(it, fm) {
    const f = fm[String(it.n).toLowerCase()]; if (!f || it.q == null) return null;
    const x = it.q / f.b; return { k: f.k * x, p: f.p * x, c: f.c * x, f: f.f * x };
  }
  function totals(doc, fm) {
    const s = { k: 0, p: 0, c: 0, f: 0 }; if (!doc || !doc.meals) return s;
    doc.meals.forEach(m => (m || []).forEach(it => { const v = itemVals(it, fm); if (v) for (const k in s) s[k] += v[k]; }));
    return s;
  }
  // Rest on "Repos"; hard on long runs, station days and race simulations; training otherwise.
  function planType(dateStr) {
    const S = A.S; if (!S.meta) return "train";
    const n = Math.round((A.parseISO(dateStr) - A.parseISO(S.meta.start)) / 864e5);
    if (n < 0 || n > 188) return "train";
    const day = A.dayData(Math.floor(n / 7) + 1, n % 7); if (!day) return "train";
    if (/^repos/i.test(day.session)) return "rest";
    if (/sortie longue|station|simulation|jour j/i.test(day.session)) return "hard";
    return "train";
  }
  const typeOf = d => (N.meals[d] && N.meals[d].type) || planType(d);
  const tgt = type => ((N.targets && N.targets[type]) || DEF_TARGETS[type]);
  const clone = o => JSON.parse(JSON.stringify(o));
  const shift = (d, n) => { const x = A.parseISO(d); x.setDate(x.getDate() + n); return A.ymd(x); };

  // ---------- saving ----------
  function setMsg(s) { N.msg = s; const el = document.getElementById("nsave"); if (el) el.textContent = s ? t(s) : ""; }
  function touch(d) { dirty.add(d); setMsg("saving"); clearTimeout(timers[d]); timers[d] = setTimeout(() => flush(d), 700); }
  async function flush(d) {
    if (writing[d]) { timers[d] = setTimeout(() => flush(d), 300); return; }
    writing[d] = true;
    const body = clone(N.meals[d]); const s = totals(body, foodMap());
    body.tot = { k: r0(s.k), p: r0(s.p), c: r0(s.c), f: r0(s.f) }; body.updatedAt = new Date().toISOString();
    try { const r = await A.db.collection("meals").doc(d).set(body); dirty.delete(d); if (!dirty.size) setMsg(r && r.synced === false ? "offline" : "saved"); }
    catch (e) { setMsg("unsaved"); } finally { writing[d] = false; }
  }
  function edit(d) { if (!N.meals[d]) N.meals[d] = { meals: [[], [], [], []] }; const m = N.meals[d]; while (m.meals.length < 4) m.meals.push([]); return m; }

  // ---------- view ----------
  function bar(label, v, goal) {
    const pct = goal ? Math.min(100, v / goal * 100) : 0;
    return `<div class="mac"><div><span>${label}</span><span class="num"><b>${r0(v)}</b> / ${r0(goal)} g</span></div><div class="bar${v > goal * 1.1 ? " over" : ""}"><i style="width:${pct}%"></i></div></div>`;
  }
  function totalsHtml(d) {
    const fm = foodMap(), s = totals(N.meals[d], fm), g = tgt(typeOf(d));
    return `<div class="metric num">${r0(s.k)}<small>/ ${g.k} kcal</small></div>${bar(t("prot"), s.p, g.p)}${bar(t("carb"), s.c, g.c)}${bar(t("fat"), s.f, g.f)}`;
  }
  function paintTotals(d) { const el = document.getElementById("ntot"); if (el) el.innerHTML = totalsHtml(d); }

  function view() {
    const V = A.V, esc = A.esc;
    if (!N.date) N.date = A.ymd(new Date());
    if (!N.ready) { V.innerHTML = `<div class="section"><p class="empty">${t("loading")}</p></div>`; return; }
    const d = N.date, doc = N.meals[d], type = typeOf(d), fm = foodMap(), loc = L() === "fr" ? "fr-FR" : "en-GB";
    const dt = A.parseISO(d), isToday = d === A.ymd(new Date());
    let h = `<div class="nz"><div class="dayhead"><div class="stack"><span class="eyebrow num">${isToday ? A.t("today") + " · " : ""}${dt.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}</span>
      <h1>${t("title")}</h1></div>
      <div class="nav"><button class="iconbtn" type="button" data-nz-nav="-1" aria-label="Previous day">${A.IC.l}</button><button class="iconbtn" type="button" data-nz-nav="1" aria-label="Next day">${A.IC.r}</button></div></div>
      <div class="section"><div class="seg seg3" role="group" aria-label="Day type">${["train", "hard", "rest"].map(k => `<button type="button" data-nz-type="${k}" aria-pressed="${type === k}">${t(k)}</button>`).join("")}</div>
      <div class="card" id="ntot">${totalsHtml(d)}</div><div class="save" id="nsave" aria-live="polite">${N.msg ? t(N.msg) : ""}</div></div>`;
    if (!doc) {
      h += `<div class="section"><div class="card"><p class="empty">${t("empty")}</p><div class="row2"><button class="btn" type="button" data-nz-usual="1" ${N.tpl ? "" : "hidden"}>${t("usual")}</button><button class="linkbtn" type="button" data-nz-blank="1">${t("blank")}</button></div></div></div>`;
    } else {
      h += `<div class="section"><div class="stack">`;
      doc.meals.forEach((m, mi) => {
        const mk = (m || []).reduce((a, it) => { const v = itemVals(it, fm); return a + (v ? v.k : 0); }, 0);
        h += `<div class="card"><div class="mh"><span class="eyebrow">${t("meal")} ${mi + 1} · ${t("meals")[mi] || ""}</span><small class="num">${r0(mk)} kcal</small></div>`;
        (m || []).forEach((it, ii) => {
          const f = fm[String(it.n).toLowerCase()], v = itemVals(it, fm);
          h += `<div class="fr"><span class="nm">${esc(it.n)}</span><label class="field"><input inputmode="decimal" id="nq-${d}-${mi}-${ii}" data-nz-q="${mi}:${ii}" value="${it.q ?? ""}" aria-label="${t("qty")} ${esc(it.n)}"><em>${unit(f)}</em></label>
            <span class="kc num">${v ? r0(v.k) : "?"}</span><button type="button" class="x" data-nz-rm="${mi}:${ii}" aria-label="${t("remove")} ${esc(it.n)}">×</button></div>`;
        });
        h += `<div class="addr"><span class="field"><input list="nz-foods" id="nn-${mi}" placeholder="${t("food")}" aria-label="${t("food")}" autocomplete="off"></span><span class="field"><input id="nqn-${mi}" inputmode="decimal" placeholder="${t("qty")}" aria-label="${t("qty")}"></span></div>
          <div class="row2"><button type="button" class="linkbtn" data-nz-add="${mi}">${t("add")}</button></div></div>`;
      });
      h += `</div><div class="row2"><button type="button" class="linkbtn" data-nz-savetpl="1">${t("saveTpl")}</button>${N.tpl ? `<button type="button" class="linkbtn mute" data-nz-usetpl="1">${t("useTpl")}</button>` : ""}</div><p class="save" id="nmsg2" aria-live="polite"></p></div>`;
    }
    h += `<datalist id="nz-foods">${((N.foods && N.foods.items) || []).map(f => `<option value="${esc(f.n)}"></option>`).join("")}</datalist>`;

    // last 7 days
    const days = []; for (let i = 0; i < 7; i++) { const k = shift(d, -i); if (N.meals[k]) days.push(k); }
    if (days.length) {
      const avg = { k: 0, p: 0, c: 0, f: 0 }, ag = { k: 0, p: 0, c: 0, f: 0 };
      days.forEach(k => { const s = totals(N.meals[k], fm), g = tgt(typeOf(k)); for (const x in avg) { avg[x] += s[x] / days.length; ag[x] += g[x] / days.length; } });
      h += `<div class="section"><h2>${t("last7")}</h2><div class="tablewrap"><table><thead><tr><th>${days.length} ${t("days")}</th><th class="r">${t("avg")}</th><th class="r">${t("target")}</th></tr></thead><tbody>
        ${[["kcal", "k", ""], [t("prot"), "p", " g"], [t("carb"), "c", " g"], [t("fat"), "f", " g"]].map(([lab, k, u]) => `<tr><td>${lab}</td><td class="r"><b>${r0(avg[k])}${u}</b></td><td class="r">${r0(ag[k])}${u}</td></tr>`).join("")}</tbody></table></div></div>`;
    }

    // body composition
    const cis = Object.entries(A.S.checkins).filter(([k]) => /^\d{4}-\d\d-\d\d$/.test(k) && k <= d).sort((a, b) => a[0] < b[0] ? -1 : 1);
    const w7 = cis.filter(([k, v]) => v.weight && k > shift(d, -7)).map(([, v]) => +v.weight);
    const waist = cis.filter(([, v]) => v.waist).pop();
    const bk = Object.keys(N.body).filter(k => k <= d).sort().pop(), b = bk && N.body[bk];
    h += `<div class="section"><h2>${t("body")}</h2><div class="stats" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat"><div class="metric num">${w7.length ? A.fmtNum(w7.reduce((a, x) => a + x, 0) / w7.length) : "–"}<small>kg</small></div><small>${t("weight7")}</small></div>
      <div class="stat"><div class="metric num">${waist ? A.fmtNum(+waist[1].waist) : "–"}<small>cm</small></div><small>${t("waist")}${waist ? " · " + waist[0].slice(5).split("-").reverse().join("/") : ""}</small></div></div>`;
    if (b) h += `<div class="tablewrap"><table><thead><tr><th>${t("measured")} · ${esc(b.source || "")} ${bk.slice(5).split("-").reverse().join("/")}</th><th class="r"></th></tr></thead><tbody>
        <tr><td>${A.t("weight")}</td><td class="r">${A.fmtNum(b.weight)} kg</td></tr><tr><td>${t("bf")}</td><td class="r">${A.fmtNum(b.bfPct)} % · ${A.fmtNum(b.bfMass)} kg</td></tr>
        <tr><td>${t("lbm")}</td><td class="r">${A.fmtNum(b.lbm)} kg</td></tr><tr><td>${t("smm")}</td><td class="r">${A.fmtNum(b.smm)} kg</td></tr></tbody></table></div>`;
    else h += `<p class="empty">${t("noBody")}</p>`;
    h += `</div>`;

    // add or fix a food
    // Safari does not lay out <details> as a flex box, so the spacing lives on an inner stack.
    h += `<div class="section"><details class="card" id="nf"><summary>${t("newFood")}</summary><div class="stack nf-body">
      <label class="lbl">${t("name")}<span class="field"><input id="nf-n" list="nz-foods" autocomplete="off"></span></label>
      <div class="grid2"><label class="lbl">${t("base")}<span class="field"><input id="nf-b" inputmode="decimal" placeholder="100"></span></label><label class="lbl">kcal<span class="field"><input id="nf-k" inputmode="decimal"></span></label></div>
      <div class="grid3"><label class="lbl">${t("prot")}<span class="field"><input id="nf-p" inputmode="decimal"><em>g</em></span></label><label class="lbl">${t("carb")}<span class="field"><input id="nf-c" inputmode="decimal"><em>g</em></span></label><label class="lbl">${t("fat")}<span class="field"><input id="nf-f" inputmode="decimal"><em>g</em></span></label></div>
      <div class="row2 nf-act"><button class="btn" type="button" data-nz-food="1">${t("save")}</button><button class="linkbtn mute" type="button" data-nz-cancel="1">${t("cancel")}</button></div><p class="save" id="nfmsg" aria-live="polite"></p></div></details></div></div>`;
    V.innerHTML = h;
  }

  // ---------- events ----------
  function onClick(e) {
    const b = e.target.closest("button"); if (!b || !b.closest(".nz")) return;
    const ds = b.dataset, d = N.date;
    if (ds.nzNav) { N.date = shift(d, +ds.nzNav); N.msg = ""; A.render(true); return; }
    if (ds.nzType) { const m = edit(d); if (ds.nzType === planType(d)) delete m.type; else m.type = ds.nzType; touch(d); A.render(true); return; }
    if (ds.nzUsual || ds.nzUsetpl) { const m = edit(d); m.meals = clone(N.tpl.meals); touch(d); A.render(true); return; }
    if (ds.nzBlank) { edit(d); touch(d); A.render(true); return; }
    if (ds.nzRm) { const [mi, ii] = ds.nzRm.split(":").map(Number); edit(d).meals[mi].splice(ii, 1); touch(d); A.render(true); return; }
    if (ds.nzAdd !== undefined) {
      const mi = +ds.nzAdd, nm = document.getElementById("nn-" + mi).value.trim(); if (!nm) return;
      const f = foodMap()[nm.toLowerCase()]; const m2 = document.getElementById("nmsg2");
      if (!f) { if (m2) m2.textContent = t("unknown"); return; }
      const q = num(document.getElementById("nqn-" + mi).value);
      edit(d).meals[mi].push({ n: f.n, q: q == null ? f.b : q }); touch(d); A.render(true); return;
    }
    if (ds.nzSavetpl) {
      const meals = clone(edit(d).meals); N.tpl = { meals };
      A.db.doc("nutrition/template").set({ meals, updatedAt: new Date().toISOString() }).then(() => { const m = document.getElementById("nmsg2"); if (m) m.textContent = t("tplSaved"); });
      return;
    }
    if (ds.nzCancel) { ["nf-n", "nf-b", "nf-k", "nf-p", "nf-c", "nf-f"].forEach(id => { document.getElementById(id).value = ""; }); document.getElementById("nfmsg").textContent = ""; document.getElementById("nf").open = false; return; }
    if (ds.nzFood) {
      const g = id => document.getElementById(id).value, n = g("nf-n").trim().replace(/\s+/g, " ");
      const it = { n, b: num(g("nf-b")) || 100, p: num(g("nf-p")) || 0, c: num(g("nf-c")) || 0, f: num(g("nf-f")) || 0, k: num(g("nf-k")) };
      if (!n) return; if (it.k == null) it.k = r0(it.p * 4 + it.c * 4 + it.f * 9);
      const items = ((N.foods && N.foods.items) || []).filter(x => x.n.toLowerCase() !== n.toLowerCase()); items.push(it);
      items.sort((a, b) => a.n.localeCompare(b.n, "vi")); N.foods = { items };
      A.db.doc("nutrition/foods").set({ items, updatedAt: new Date().toISOString() }).then(() => { const m = document.getElementById("nfmsg"); if (m) m.textContent = t("foodSaved"); });
      return;
    }
  }
  function onInput(e) {
    const el = e.target; if (!el.dataset || el.dataset.nzQ === undefined) return;
    const [mi, ii] = el.dataset.nzQ.split(":").map(Number), d = N.date, it = edit(d).meals[mi][ii];
    it.q = num(el.value); touch(d); paintTotals(d);
    const v = itemVals(it, foodMap()), kc = el.closest(".fr").querySelector(".kc"); if (kc) kc.textContent = v ? r0(v.k) : "?";
  }
  // When the user types into a food field, fill the form with the stored values so a typo can be fixed.
  function onChange(e) {
    if (e.target.id !== "nf-n") return;
    const f = foodMap()[e.target.value.trim().toLowerCase()]; if (!f) return;
    [["nf-b", "b"], ["nf-k", "k"], ["nf-p", "p"], ["nf-c", "c"], ["nf-f", "f"]].forEach(([id, k]) => { document.getElementById(id).value = f[k]; });
  }

  // ---------- data ----------
  function attach(api) {
    A = api;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    document.addEventListener("click", onClick); document.addEventListener("input", onInput); document.addEventListener("change", onChange);
    const got = new Set(); const ready = c => { got.add(c); if (got.size >= 3) N.ready = true; if (A.S.tab === "nutri") A.later(); };
    A.db.collection("nutrition").onSnapshot(s => { s.docs.forEach(x => { const v = x.data(); if (x.id === "foods") N.foods = v; if (x.id === "template") N.tpl = v; if (x.id === "targets") N.targets = v; }); ready("nutrition"); });
    A.db.collection("meals").onSnapshot(s => { s.docs.forEach(x => { if (!dirty.has(x.id) && !writing[x.id]) N.meals[x.id] = clone(x.data()); }); ready("meals"); });
    A.db.collection("body").onSnapshot(s => { const o = {}; s.docs.forEach(x => { o[x.id] = x.data(); }); N.body = o; ready("body"); });
  }

  window.P27N = { attach, view, planType };
})();
