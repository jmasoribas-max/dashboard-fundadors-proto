/* Dashboard estàtic. Llegeix members.json, data/index.json i els JSON que l'índex apunta.
   No inventa fundadors, dates, hashes ni URL. */
(function () {
  "use strict";
  var R = window.FundRules;
  var YEARS = R.YEARS;
  var PS = 50;
  var PAIS = {
    GB: "Regne Unit", DE: "Alemanya", FR: "França", SE: "Suècia", CH: "Suïssa",
    NL: "Països Baixos", IT: "Itàlia", ES: "Espanya", DK: "Dinamarca", BE: "Bèlgica",
    FI: "Finlàndia", NO: "Noruega", JE: "Jersey", IE: "Irlanda", AT: "Àustria",
    LU: "Luxemburg", PL: "Polònia", BM: "Bermudes", GR: "Grècia", PT: "Portugal",
    ZA: "Sud-àfrica", CZ: "Txèquia", IM: "Illa de Man", US: "Estats Units",
    FO: "Illes Fèroe", CY: "Xipre", IL: "Israel", AU: "Austràlia"
  };
  var ETIQUETA = { fundador: "fundador", familia: "família fundadora", professional: "professional", pendent: "pendent" };
  var NF = new Intl.NumberFormat("ca-ES");
  var PF = new Intl.NumberFormat("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var S = {
    members: [], byIsin: new Map(), dossiers: new Map(), fund: new Map(), fundSource: new Map(),
    refByAlt: {}, errors: [], index: null, ev: [], view: "graella", isin: "",
    q: "", pais: "", dossier: "", any: "", sortKey: "nom", sortDir: 1, page: 0, rows: [],
    qFitxa: "", agPais: "", agAny: "2025", agCas: "", agMode: "calculat",
    qEstat: "revisar", qFont: "pendent", lastView: "", lastScrollYear: ""
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(id) { return document.getElementById(id); }
  function nfmt(n) { return NF.format(n); }
  function pctTxt(part, total) {
    if (!total) return "0%";
    return PF.format(R.pct(part, total)) + "%";
  }
  function paisLabel(code) {
    if (!code) return "sense país";
    return (PAIS[code] || code) + " (" + code + ")";
  }
  function safeUrl(v) {
    try {
      var u = new URL(String(v));
      if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    } catch (e) { /* no és una URL absoluta */ }
    return "";
  }
  function siNo(v) {
    if (v === true) return "sí";
    if (v === false) return "no";
    if (v == null || v === "") return "no consta";
    return String(v);
  }
  function triLabel(v) {
    var t = R.tri(v);
    if (t === "si") return "sí";
    if (t === "no") return "no";
    return "no consta";
  }
  function etLabel(id) { return ETIQUETA[id] || id || "pendent"; }
  function tipusLabel(t) {
    var k = String(t || "").toLowerCase();
    if (!k || k === "pendent") return "tipus pendent";
    if (k === "persona") return "persona";
    if (k === "familia" || k === "família") return "família";
    if (k === "institucio" || k === "institució") return "institució";
    return String(t);
  }
  function mark(v) {
    if (v === "C") return '<span class="mk C" title="Cartera el 31 d\'octubre">C</span>';
    if (v === "V") return '<span class="mk V" title="Sortida entre maig i octubre, absent de la cartera final">V</span>';
    if (v === "C+V") return '<span class="mk CV" title="Línia C i línia V el mateix any">C+V</span>';
    return '<span class="mk E" title="Sense evidència admissible">·</span>';
  }
  function fundView(isin) {
    var d = S.dossiers.get(isin);
    var f = S.fund.get(isin);
    var base = { any: "pendent", fund: "pendent", estat: "pendent", nev: 0, dossier: d ? "CEO" : "pendent" };
    if (!f || f.noReconegut) return base;
    if (f.data_fundacio != null && f.data_fundacio !== "") base.any = R.parseData(f.data_fundacio).label;
    var especial = f.cas && (f.cas.id === "fusio" || f.cas.id === "spin_off");
    if (especial && !R.decisioAplicada(f)) {
      base.fund = "pendent (" + f.cas.label + ", atribució no aplicada)";
    } else {
      var noms = (R.conjuntDe(f, "calculat").persones || []).map(function (p) { return p.nom; });
      if (!noms.length) noms = (f.fundadors || []).map(function (p) { return p.nom; });
      if (noms.length) base.fund = noms.join("; ");
    }
    if (f.estat_final) base.estat = String(f.estat_final);
    base.nev = (f.evidencies ? f.evidencies.length : 0) + (f.principal ? 1 : 0);
    return base;
  }
  function nFundReconeguts() {
    var n = 0;
    S.fund.forEach(function (f) { if (f && !f.noReconegut) n += 1; });
    return n;
  }
  function perIsin() {
    var o = {};
    S.dossiers.forEach(function (d, isin) {
      o[isin] = { teDossier: true, fundacio: S.fund.get(isin) || null, ceosByYear: R.ceoPerAny(d) };
    });
    S.fund.forEach(function (f, isin) {
      if (!o[isin]) o[isin] = { teDossier: false, fundacio: f, ceosByYear: {} };
    });
    return o;
  }
  function sampleYears(r) { return YEARS.filter(function (y) { return R.aMostra(r[y]); }); }

  function stash(rec) {
    var id = S.ev.length;
    S.ev.push(rec);
    return id;
  }
  function btn(text, id) {
    return '<button type="button" class="datum" data-ev="' + id + '">' + esc(text) + "</button>";
  }
  function btnHtml(html, id) {
    return '<button type="button" class="datum" data-ev="' + id + '">' + html + "</button>";
  }
  function resetEv() {
    S.ev = [];
    closeDrawer();
  }

  function banner() {
    var n = S.dossiers.size;
    var u = S.members.length;
    var f = nFundReconeguts();
    var links = [];
    S.dossiers.forEach(function (d, isin) {
      var nom = d.nom || (S.byIsin.get(isin) || {}).nom || isin;
      links.push('<a href="#fitxa/' + encodeURIComponent(isin) + '">' + esc(nom) + "</a>");
    });
    var cap = n < u
      ? "<strong>Mostra incompleta.</strong> Hi ha " + nfmt(n) + " fitxers reals d'empresa, de " + nfmt(u) + " ISIN. Fundadors reconeguts: " + nfmt(f) + ". La resta és pendent. Cap fundador, hash o URL d'exemple."
      : "<strong>Tots els ISIN tenen fitxer d'empresa</strong> (" + nfmt(n) + "). Fundadors reconeguts: " + nfmt(f) + ".";
    var err = S.errors.length ? "<p>Incidències de càrrega: " + esc(S.errors.join(" ")) + "</p>" : "";
    el("banner").innerHTML = '<div class="inner"><p>' + cap + " Amb fitxer: " + (links.join(" · ") || "cap") + '. <a href="#metodologia">Com es llegeix una dada</a>.</p>' + err + "</div>";
  }

  async function pool(items, n, fn) {
    var ret = new Array(items.length);
    var i = 0;
    async function worker() {
      while (i < items.length) {
        var k = i++;
        ret[k] = await fn(items[k], k);
      }
    }
    var workers = [];
    var c = Math.min(n, items.length);
    for (var w = 0; w < c; w++) workers.push(worker());
    await Promise.all(workers);
    return ret;
  }

  async function boot() {
    try {
      var pair = await Promise.all([fetch("members.json"), fetch("data/index.json")]);
      if (!pair[0].ok) throw new Error("No s'ha pogut llegir members.json (" + pair[0].status + ").");
      if (!pair[1].ok) throw new Error("No s'ha pogut llegir data/index.json (" + pair[1].status + "). Executa python3 scripts/build_index.py.");
      S.members = await pair[0].json();
      S.index = await pair[1].json();
      if (!Array.isArray(S.members)) throw new Error("members.json no és una llista.");
    } catch (e) {
      el("contingut").innerHTML = '<p class="empty">' + esc(e.message) + "</p>";
      el("banner").innerHTML = '<div class="inner"><p>No s\'han pogut carregar les dades.</p></div>';
      return;
    }
    S.byIsin = new Map(S.members.map(function (r) { return [r.isin, r]; }));
    S.members.forEach(function (r) {
      String(r.altres_isin || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (a) {
        S.refByAlt[a] = r.isin;
      });
    });
    var empreses = (S.index && S.index.empreses) || [];
    var fundadors = (S.index && S.index.fundadors) || [];
    await pool(empreses, 6, async function (item) {
      try {
        var res = await fetch(item.path);
        if (!res.ok) throw new Error(item.path + " ha respost " + res.status);
        var data = await res.json();
        var isin = data.isin || item.isin;
        if (data.isin && data.isin !== item.isin) S.errors.push(item.path + " porta un ISIN diferent del nom.");
        S.dossiers.set(isin, data);
        var emb = R.seleccionaFundacio(data, null);
        if (emb) {
          S.fund.set(isin, emb);
          S.fundSource.set(isin, "embedded");
        }
      } catch (e) {
        S.errors.push(e.message);
      }
    });
    await pool(fundadors, 6, async function (item) {
      try {
        var res = await fetch(item.path);
        if (!res.ok) throw new Error(item.path + " ha respost " + res.status);
        var data = await res.json();
        var isin = data.isin || data.isin_cua || item.isin;
        S.fund.set(isin, R.seleccionaFundacio(null, data));
        S.fundSource.set(isin, "sidecar");
      } catch (e) {
        S.errors.push(e.message);
      }
    });
    banner();
    route();
  }

  function parseHash() {
    var h = (location.hash || "#graella").replace(/^#/, "");
    var bits = h.split("/");
    var view = bits[0] || "graella";
    var known = { graella: 1, fitxa: 1, agregada: 1, qualitat: 1, metodologia: 1 };
    if (!known[view]) view = "graella";
    return { view: view, isin: bits[1] ? decodeURIComponent(bits.slice(1).join("/")) : "" };
  }
  function route() {
    var p = parseHash();
    S.view = p.view;
    S.isin = p.isin;
    document.querySelectorAll("#nav a").forEach(function (a) {
      a.setAttribute("aria-current", a.getAttribute("data-view") === S.view ? "page" : "false");
    });
    var changed = S.lastView !== S.view;
    S.lastView = S.view;
    if (S.view === "graella") renderGraella();
    else if (S.view === "fitxa") renderFitxa();
    else if (S.view === "agregada") renderAgregada();
    else if (S.view === "qualitat") renderQualitat();
    else renderMetodologia();
    if (changed) window.scrollTo(0, 0);
  }

  function optionsPais(selected) {
    var ps = [];
    var seen = {};
    S.members.forEach(function (r) { if (r.pais && !seen[r.pais]) { seen[r.pais] = 1; ps.push(r.pais); } });
    ps.sort(function (a, b) { return paisLabel(a).localeCompare(paisLabel(b), "ca"); });
    return '<option value="">Tots els països</option>' + ps.map(function (p) {
      return '<option value="' + esc(p) + '"' + (p === selected ? " selected" : "") + ">" + esc(paisLabel(p)) + "</option>";
    }).join("");
  }
  function optionsAny(selected, tots) {
    var html = tots ? '<option value="">Tots els anys</option>' : "";
    YEARS.forEach(function (y) {
      html += '<option value="' + y + '"' + (String(selected) === y ? " selected" : "") + ">" + y + "</option>";
    });
    return html;
  }

  function renderGraella() {
    if (!el("tb")) {
      resetEv();
      el("contingut").innerHTML =
        '<div class="kpis">' +
          '<div class="kpi"><b id="k1"></b><span>Empreses</span></div>' +
          '<div class="kpi"><b id="k5"></b><span id="k5s">A la mostra</span></div>' +
          '<div class="kpi"><b id="k2"></b><span>Amb fitxer de CEO</span></div>' +
          '<div class="kpi"><b id="k3"></b><span>Amb fundadors</span></div>' +
          '<div class="kpi"><b id="k4"></b><span>Països (ISIN)</span></div>' +
        "</div>" +
        '<div class="ctl">' +
          '<label class="f">Cerca<input id="q" placeholder="Nom, ISIN o nom històric" value="' + esc(S.q) + '"></label>' +
          '<label class="f">País<select id="fp">' + optionsPais(S.pais) + "</select></label>" +
          '<label class="f">Fitxer<select id="fd"><option value="">Tots</option><option value="amb"' + (S.dossier === "amb" ? " selected" : "") + '>Amb fitxer de CEO</option><option value="sense"' + (S.dossier === "sense" ? " selected" : "") + ">Sense fitxer</option></select></label>" +
          '<label class="f">Any de la mostra<select id="fy">' + optionsAny(S.any, true) + "</select></label>" +
          '<button type="button" class="solid" id="csv">Descarrega CSV</button>' +
        "</div>" +
        '<p class="hint"><span class="mk C">C</span> cartera el 31/10. <span class="mk V">V</span> sortida entre maig i octubre, fora de la cartera final. <span class="mk CV">C+V</span> les dues línies. La cel·la buida no és una absència provada. El filtre d\'any deixa C o C+V. Sense fitxer de fundadors, fundació i fundadors es mostren pendents.</p>' +
        '<div class="wrap"><table><thead><tr>' +
          '<th class="pin pin1" data-k="isin">ISIN</th>' +
          '<th class="pin pin2" data-k="nom">Empresa</th>' +
          '<th data-k="pais">País</th>' +
          '<th class="num" data-k="primer_any">Primer any</th>' +
          '<th class="num" data-k="darrer_any">Darrer any</th>' +
          '<th class="num" data-k="anys_observats">Anys obs.</th>' +
          YEARS.map(function (y) { return '<th class="y" data-k="' + y + '">' + y + "</th>"; }).join("") +
          '<th data-k="any">Fundació</th><th data-k="fund">Fundadors</th><th data-k="estat">Estat fundació</th><th data-k="dossier">Dossier</th><th class="num" data-k="nev">Evidències fundació</th>' +
        '</tr></thead><tbody id="tb"></tbody></table></div>' +
        '<div class="pg"><button type="button" class="solid" id="prev">Anterior</button><span id="pi"></span><button type="button" class="solid" id="next">Següent</button></div>';
      el("q").addEventListener("input", function () { S.q = el("q").value; S.page = 0; paintGraella(); });
      el("fp").addEventListener("change", function () { S.pais = el("fp").value; S.page = 0; paintGraella(); });
      el("fd").addEventListener("change", function () { S.dossier = el("fd").value; S.page = 0; paintGraella(); });
      el("fy").addEventListener("change", function () { S.any = el("fy").value; S.page = 0; paintGraella(); });
      el("prev").addEventListener("click", function () { if (S.page > 0) { S.page -= 1; paintGraella(); } });
      el("next").addEventListener("click", function () {
        var n = Math.max(1, Math.ceil(S.rows.length / PS));
        if (S.page < n - 1) { S.page += 1; paintGraella(); }
      });
      el("csv").addEventListener("click", descarregaCsv);
      document.querySelectorAll("#contingut th").forEach(function (th) {
        th.addEventListener("click", function () {
          var k = th.getAttribute("data-k");
          if (!k) return;
          S.sortDir = S.sortKey === k ? -S.sortDir : 1;
          S.sortKey = k;
          paintGraella();
        });
      });
      el("tb").addEventListener("click", function (e) {
        var tr = e.target.closest("tr");
        if (!tr || !tr.getAttribute("data-i")) return;
        location.hash = "#fitxa/" + encodeURIComponent(tr.getAttribute("data-i"));
      });
    }
    paintGraella();
  }

  function textOf(r) {
    var d = S.dossiers.get(r.isin);
    return [r.nom, r.isin, r.altres_isin, r.altres_noms, r.nota_identitat, d && d.nom].join("\n").toLowerCase();
  }
  function sortValue(r, key) {
    if (key === "any" || key === "fund" || key === "estat" || key === "nev" || key === "dossier") return fundView(r.isin)[key];
    return r[key];
  }
  function paintGraella() {
    var q = S.q.trim().toLowerCase();
    S.rows = S.members.filter(function (r) {
      if (q && textOf(r).indexOf(q) === -1) return false;
      if (S.pais && r.pais !== S.pais) return false;
      if (S.dossier === "amb" && !S.dossiers.get(r.isin)) return false;
      if (S.dossier === "sense" && S.dossiers.get(r.isin)) return false;
      if (S.any && !R.aMostra(r[S.any])) return false;
      return true;
    });
    S.rows.sort(function (a, b) {
      var x = sortValue(a, S.sortKey);
      var y = sortValue(b, S.sortKey);
      var ex = x == null || x === "";
      var ey = y == null || y === "";
      if (ex && ey) return 0;
      if (ex) return 1;
      if (ey) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * S.sortDir;
      var xs = String(x);
      var ys = String(y);
      return (xs > ys ? 1 : xs < ys ? -1 : 0) * S.sortDir;
    });
    var n = Math.max(1, Math.ceil(S.rows.length / PS));
    S.page = Math.min(S.page, n - 1);
    document.querySelectorAll("#contingut th").forEach(function (th) {
      var k = th.getAttribute("data-k");
      var markSort = k === S.sortKey ? (S.sortDir > 0 ? " ↑" : " ↓") : "";
      if (th.getAttribute("data-base") == null) th.setAttribute("data-base", th.textContent);
      th.textContent = th.getAttribute("data-base") + markSort;
      th.classList.toggle("yon", k === S.any);
    });
    el("tb").innerHTML = S.rows.slice(S.page * PS, S.page * PS + PS).map(function (r) {
      var fv = fundView(r.isin);
      return '<tr class="r" data-i="' + esc(r.isin) + '">' +
        '<td class="pin pin1">' + esc(r.isin) + "</td>" +
        '<td class="pin pin2" title="' + esc(r.nom) + '"><span class="nm">' + esc(r.nom) + "</span></td>" +
        "<td>" + esc(r.pais || "") + "</td>" +
        '<td class="num">' + (r.primer_any == null ? "no consta" : esc(r.primer_any)) + "</td>" +
        '<td class="num">' + (r.darrer_any == null ? "no consta" : esc(r.darrer_any)) + "</td>" +
        '<td class="num">' + (r.anys_observats == null ? "no consta" : esc(r.anys_observats)) + "</td>" +
        YEARS.map(function (y) { return '<td class="y' + (y === S.any ? " yon" : "") + '">' + mark(r[y]) + "</td>"; }).join("") +
        "<td>" + esc(fv.any) + "</td><td>" + esc(fv.fund) + '</td><td><span class="tag pendent">' + esc(fv.estat) + "</span></td><td>" + esc(fv.dossier) + '</td><td class="num">' + esc(fv.nev) + "</td></tr>";
    }).join("");
    el("pi").textContent = "Pàgina " + (S.page + 1) + " de " + n + " · " + nfmt(S.rows.length) + " resultats";
    var paisos = {};
    S.members.forEach(function (r) { if (r.pais) paisos[r.pais] = 1; });
    el("k1").textContent = nfmt(S.members.length);
    el("k2").textContent = nfmt(S.dossiers.size);
    el("k3").textContent = nfmt(nFundReconeguts());
    el("k4").textContent = nfmt(Object.keys(paisos).length);
    if (S.any) {
      el("k5").textContent = nfmt(S.members.filter(function (r) { return R.aMostra(r[S.any]); }).length);
      el("k5s").textContent = "A la mostra " + S.any;
    } else {
      el("k5").textContent = nfmt(S.members.filter(function (r) { return sampleYears(r).length; }).length);
      el("k5s").textContent = "Amb algun any C o C+V";
    }
    if (S.any !== S.lastScrollYear) {
      S.lastScrollYear = S.any;
      var wrap = document.querySelector(".wrap");
      var grid = document.querySelector('th[data-k="2015"]');
      var pin = document.querySelector("th.pin2");
      if (S.any && wrap && grid && pin && getComputedStyle(pin).position === "sticky") {
        wrap.scrollLeft += grid.getBoundingClientRect().left - pin.getBoundingClientRect().right;
      } else if (wrap) wrap.scrollLeft = 0;
    }
  }

  function descarregaCsv() {
    var cols = ["isin", "nom", "pais", "moneda", "primer_any", "darrer_any", "anys_observats"].concat(YEARS).concat(["altres_isin", "altres_noms", "nota_identitat", "data_informe", "fitxer_font", "pagina", "linia_txt", "any", "fund", "estat", "nev", "dossier"]);
    function cell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
    var lines = [cols.join(",")].concat(S.rows.map(function (r) {
      var fv = fundView(r.isin);
      return cols.map(function (k) {
        if (k === "any" || k === "fund" || k === "estat" || k === "nev" || k === "dossier") return cell(fv[k]);
        return cell(r[k]);
      }).join(",");
    }));
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "fundadors_stoxx600.csv";
    a.click();
  }

  function renderFitxa() {
    if (!el("finder")) {
      el("contingut").innerHTML =
        '<div class="sheet"><aside class="finder" id="finder">' +
          '<label class="f">Cerca d\'empresa<input id="fq" placeholder="Nom o ISIN" value="' + esc(S.qFitxa) + '"></label>' +
          "<h3>Fitxers carregats</h3><ul id=\"f-loaded\"></ul>" +
          "<h3>Univers</h3><ul id=\"f-hits\"></ul>" +
        '</aside><article class="sheet-body" id="article"></article></div>';
      el("fq").addEventListener("input", function () { S.qFitxa = el("fq").value; paintFinder(); });
    }
    paintFinder();
    paintArticle();
  }
  function paintFinder() {
    var cur = S.isin;
    var loaded = [];
    S.dossiers.forEach(function (d, isin) { loaded.push({ isin: isin, nom: d.nom || isin }); });
    loaded.sort(function (a, b) { return a.nom.localeCompare(b.nom, "ca"); });
    el("f-loaded").innerHTML = loaded.map(function (r) {
      return '<li><a href="#fitxa/' + encodeURIComponent(r.isin) + '"' + (r.isin === cur ? ' aria-current="true"' : "") + ">" + esc(r.nom) + "<small>" + esc(r.isin) + "</small></a></li>";
    }).join("") || "<li class=\"empty\">Cap fitxer a l'índex.</li>";
    var q = S.qFitxa.trim().toLowerCase();
    if (!q) {
      el("f-hits").innerHTML = '<li class="empty">Escriu un nom o un ISIN. L\'univers en té ' + nfmt(S.members.length) + ".</li>";
      return;
    }
    var hits = S.members.filter(function (r) { return textOf(r).indexOf(q) !== -1; }).slice(0, 40);
    el("f-hits").innerHTML = hits.map(function (r) {
      return '<li><a href="#fitxa/' + encodeURIComponent(r.isin) + '"' + (r.isin === cur ? ' aria-current="true"' : "") + ">" + esc(r.nom) + "<small>" + esc(r.isin) + (S.dossiers.get(r.isin) ? " · fitxer" : " · pendent") + "</small></a></li>";
    }).join("") || '<li class="empty">Cap coincidència.</li>';
  }

  function fundacioFonts(f) {
    if (!f) return [];
    var fonts = [];
    if (f.principal) fonts.push({ heading: "Evidència principal del fitxer", obj: f.principal });
    (f.evidencies || []).forEach(function (ev, i) {
      fonts.push({ heading: "Evidència " + (i + 1) + (ev.camp_sostingut ? " · " + ev.camp_sostingut : ""), obj: ev });
    });
    return fonts;
  }
  function fontsAny(c) {
    return ((c && c.fonts) || []).map(function (f, i) { return { heading: "Font " + (i + 1), obj: f }; });
  }
  function fontsPeriode(p) {
    var fonts = [];
    if (p) fonts.push({ heading: "Període de tinença", obj: p });
    if (p && p.font_inici) fonts.push({ heading: "Font de l'inici", obj: p.font_inici });
    if (p && p.font_fi) fonts.push({ heading: "Font de la fi", obj: p.font_fi });
    return fonts;
  }

  function paintArticle() {
    resetEv();
    var isin = S.isin;
    var box = el("article");
    if (!isin) {
      box.innerHTML = "<h2>Fitxa d'empresa</h2><p>Tria una empresa. Les que tenen fitxer són a la llista de dalt. La resta de l'univers s'obre per la cerca i es mostra com a pendent, sense omplir cap CEO ni cap fundador.</p>";
      return;
    }
    var member = S.byIsin.get(isin) || null;
    var d = S.dossiers.get(isin) || null;
    if (!member && !d) {
      box.innerHTML = "<h2>ISIN desconegut</h2><p class=\"empty\">" + esc(isin) + " no és a la graella ni té fitxer.</p>";
      return;
    }
    var nomDossier = d && d.nom;
    var nomEtf = member && member.nom;
    var nom = nomDossier || nomEtf || isin;
    var f = S.fund.get(isin) || null;
    var html = "";
    html += '<p class="kicker">' + (d ? "Fitxer d'empresa carregat" : "Sense fitxer d'empresa") + (f && !f.noReconegut ? " · fundadors carregats" : " · fundadors pendents") + "</p>";
    html += "<h2>" + esc(nom) + "</h2>";
    if (nomEtf && nomDossier && nomEtf !== nomDossier) html += "<p>Nom a la graella de l'ETF: " + esc(nomEtf) + "</p>";
    html += '<div class="meta">';
    html += meta("ISIN", isin);
    html += meta("País de l'ISIN", member && member.pais ? paisLabel(member.pais) : "no consta");
    html += meta("Moneda", member && member.moneda ? member.moneda : "no consta");
    html += meta("Protocol del fitxer", d && d.protocol_version ? d.protocol_version : "no consta");
    html += meta("Fase del fitxer", d && d.fase ? d.fase : "no consta");
    html += meta("Primer any a l'ETF", member && member.primer_any != null ? String(member.primer_any) : "no consta");
    html += meta("Darrer any a l'ETF", member && member.darrer_any != null ? String(member.darrer_any) : "no consta");
    html += "</div>";
    if (d) html += '<p><a class="ext" href="data/empreses/' + encodeURIComponent(isin) + '.json">Obre el JSON de l\'empresa</a></p>';
    html += seccioEtf(member, isin);
    html += seccioFundacio(f, isin);
    html += seccioCeo(d, member, f);
    box.innerHTML = html;
  }
  function meta(k, v) { return "<div><b>" + esc(k) + "</b>" + esc(v) + "</div>"; }

  function seccioEtf(member, isin) {
    var html = "<h3>Pertinença a l'ETF</h3>";
    if (!member) return html + '<p class="empty">Aquest ISIN té fitxer d\'empresa però no és a members.json.</p>';
    var ref = S.refByAlt[isin];
    var refRow = ref ? S.byIsin.get(ref) : null;
    var src = stash({
      title: "Font de la graella ETF",
      lines: [
        ["Fitxer", member.fitxer_font || "no consta"],
        ["Data de l'informe", member.data_informe || "no consta"],
        ["Pàgina", member.pagina == null ? "no consta" : String(member.pagina)],
        ["Línia", member.linia_txt == null ? "no consta" : String(member.linia_txt)],
        ["URL", "no consta"],
        ["SHA-256", "no consta"]
      ],
      fonts: [],
      note: "La graella no porta URL ni hash. No se n'ha fabricat cap. La cel·la buida no és una prova d'absència."
    });
    html += '<div class="chips">' + YEARS.map(function (y) {
      return '<div class="chip"><span class="yr">' + y + "</span>" + btnHtml(mark(member[y]), src) + "</div>";
    }).join("") + "</div>";
    var anys = sampleYears(member);
    html += "<p><b>A la mostra (C o C+V):</b> " + (anys.length ? esc(anys.join(", ")) : "cap any") + "</p>";
    if (member.nota_identitat) html += '<p class="note"><b>Nota d\'identitat.</b> ' + esc(member.nota_identitat) + "</p>";
    if (member.altres_noms) html += "<p><b>Altres noms als informes:</b> " + esc(member.altres_noms) + "</p>";
    if (member.altres_isin) html += "<p><b>Altres ISIN observats:</b> " + esc(String(member.altres_isin).split("\n").join(", ")) + "</p>";
    if (refRow) {
      html += '<p class="note">Aquest ISIN no és l\'ISIN de referència. La graella de l\'empresa és a <a href="#fitxa/' + encodeURIComponent(refRow.isin) + '">' + esc(refRow.nom) + " (" + esc(refRow.isin) + ")</a>. No s'ha copiat la pertinença en aquesta fila.</p>";
    } else if (member.primer_any == null) {
      html += '<p class="note">Aquest ISIN no és un ISIN de referència de l\'extracte. Les cel·les anuals es deixen buides.</p>';
    }
    html += "<p>" + btn("Font de la graella", src) + "</p>";
    return html;
  }

  function seccioFundacio(f, isin) {
    var html = "<h3>Fundació i fundadors</h3>";
    if (!f) {
      return html + '<p class="empty">Pendent. No hi ha <span class="mono">data/fundadors/' + esc(isin) + '.json</span> ni un bloc <span class="mono">fundacio</span> dins el fitxer d\'empresa. No s\'ha inferit cap fundador ni cap any.</p>' +
        '<div class="meta">' + meta("Data de fundació", "pendent") + meta("Fundadors", "pendent") + meta("Tipus", "pendent") + meta("Cas D1 / D10 / Estat", "desconegut") + meta("Estat final", "pendent") + "</div>";
    }
    if (f.noReconegut) {
      return html + '<p class="empty">Hi ha un fitxer de fundadors, però no s\'hi ha reconegut cap camp del pack (fundadors, data_fundacio, estat_final, cas). Es tracta com a pendent.</p>';
    }
    var fonts = fundacioFonts(f);
    var origen = S.fundSource.get(isin) === "sidecar" ? "Fitxer data/fundadors/" + isin + ".json." : "Bloc fundacio dins el JSON d'empresa.";
    html += '<p class="note">' + esc(origen) + (f.aprovacio_jordi ? " Aprovació de Jordi: " + esc(String(f.aprovacio_jordi)) + "." : " Aprovació de Jordi: no consta.") + "</p>";
    var data = R.parseData(f.data_fundacio);
    var idData = stash({ title: "Data de fundació", lines: [["Valor al fitxer", data.raw || "no consta"], ["Lectura", data.label], ["Precisió declarada", f.precisio_data || "no consta"]], fonts: fonts, note: "Si el valor és només un any, no es converteix en una data completa." });
    html += '<div class="meta">';
    html += "<div><b>Data de fundació</b>" + btn(data.label, idData) + "</div>";
    html += meta("Precisió declarada", f.precisio_data || "no consta");
    html += meta("Estat final", f.estat_final || "pendent");
    html += meta("Categoria d'origen", f.categoria_origen || "no consta");
    html += meta("Cas", f.cas ? f.cas.label : "no consta");
    html += meta("Decisió D1/D10", f.decisio == null || f.decisio === "" ? "no aplicada" : String(f.decisio));
    html += meta("Robustesa D10", f.robustesa_d10 || "no consta");
    html += "</div>";
    html += "<h3>Persones i banderes</h3>";
    html += "<p>Fundadors directes del fitxer</p>" + llistaPersones(f.fundadors, fonts, "Cap fundador directe. Pendent o no aplicable.");
    if (f.parts && f.parts.length) {
      html += "<p>Parts d'una fusió (D1). Són fets del fitxer, no una atribució automàtica a l'ISIN.</p>";
      f.parts.forEach(function (part) {
        html += "<p><b>" + esc(part.entitat || "Part sense nom") + "</b>" + (part.isin ? " · " + esc(part.isin) : "") + "</p>";
        html += llistaPersones(part.fundadors, fonts, "Aquesta part no porta fundadors.");
      });
    }
    if (f.matriu) {
      html += "<p>Matriu del spin-off (D10)" + (f.matriu.entitat ? ": " + esc(f.matriu.entitat) : "") + (f.matriu.isin ? " · " + esc(f.matriu.isin) : "") + "</p>";
      html += llistaPersones(f.matriu.fundadors, fonts, "La matriu no porta fundadors.");
    }
    html += "<p>Família fundadora citada</p>" + llistaPersones(f.familia, fonts, "No consta.");
    if (f.motiu) html += '<p class="note"><b>Motiu.</b> ' + esc(f.motiu) + "</p>";
    if (f.notes) html += '<p class="note pre">' + esc(f.notes) + "</p>";
    if (!fonts.length) html += '<p class="empty">El fitxer de fundadors no porta URL, cita ni SHA-256. Es mostra no consta, sense calcular-ne cap.</p>';
    else html += "<p>" + btn("Evidència de la fundació", stash({ title: "Evidència de la fundació", lines: [], fonts: fonts, note: "" })) + "</p>";
    return html;
  }
  function llistaPersones(list, fonts, buit) {
    if (!list || !list.length) return '<p class="empty">' + esc(buit) + "</p>";
    return "<ul>" + list.map(function (p) {
      var id = stash({
        title: "Persona documentada",
        lines: [["Nom", p.nom], ["Tipus", tipusLabel(p.tipus)], ["Bandera", p.bandera || "cap"], ["Origen", p.origen || "no consta"]],
        fonts: fonts,
        note: "La coincidència amb un CEO, quan es calcula, és pel nom sencer normalitzat. No s'infereix un cognom."
      });
      return "<li>" + btn(p.nom, id) + ' <span class="tag">' + esc(tipusLabel(p.tipus)) + "</span> " + (p.bandera ? '<span class="badge">' + esc(p.bandera) + "</span> " : "") + (p.origen ? esc(p.origen) : "") + "</li>";
    }).join("") + "</ul>";
  }

  function seccioCeo(d, member, f) {
    var html = "<h3>CEO, 2015-2025</h3>";
    if (!d) {
      var isin = member ? member.isin : "";
      return html + '<p class="empty">Pendent. Quan existeixi <span class="mono">data/empreses/' + esc(isin) + '.json</span> i s\'actualitzi l\'índex, aquesta fitxa mostrarà el CEO de cada 31/10 i la tinença. Ara no hi ha cap nom.</p>';
    }
    var by = R.ceoPerAny(d);
    var conj = R.conjuntDe(f, "calculat");
    html += '<p class="hint">L\'etiqueta fundador, família fundadora o professional només es calcula amb un fitxer de fundadors utilitzable. El nom del CEO no es recalcula a partir de la tinença: és el camp <span class="mono">ceo_31_10</span>. Cada valor subratllat obre l\'evidència. La taula es desplaça de costat si no hi cap.</p>';
    if (f && f.cas && (f.cas.id === "fusio" || f.cas.id === "spin_off") && !R.decisioAplicada(f)) {
      html += '<p class="note">El cas és ' + esc(f.cas.label) + ' i la decisió no està aplicada. L\'etiqueta de lideratge queda pendent. La vista agregada pot previsualitzar la regla, marcada com a previsualització.</p>';
    }
    html += '<div class="wrap"><table class="dense"><thead><tr><th>Any</th><th>Mostra ETF</th><th>a_mostra</th><th>CEO al 31/10</th><th>Etiqueta</th><th>Proxy de tancament</th><th>Canvi fins al tancament</th><th>CEO al tancament</th><th>Des de</th><th>Exercici</th><th>Estat</th><th>Nivell</th></tr></thead><tbody>';
    YEARS.forEach(function (y) {
      var c = by[y];
      var mostra = member ? member[y] : "";
      if (!c) {
        html += "<tr><td>" + y + "</td><td>" + mark(mostra) + '</td><td colspan="10" class="empty">Sense registre d\'aquest any al bloc ceos.</td></tr>';
        return;
      }
      var fonts = fontsAny(c);
      function camp(titol, valor, nota) {
        var id = stash({ title: titol + " · " + y, lines: [["Valor", valor]], fonts: fonts, note: nota });
        return btn(valor, id);
      }
      var noms = R.splitCeos(c.ceo_31_10);
      var persones = noms.map(function (nom) {
        var et = R.etiquetaPersona(nom, conj);
        return {
          nom: nom,
          et: et,
          idNom: stash({ title: "CEO al 31/10 de " + y, lines: [["Nom", nom], ["Camp", "ceo_31_10"]], fonts: fonts, note: "El nom és el del fitxer. Les fonts de sota el documenten." }),
          idEt: stash({
            title: "Etiqueta de " + nom + " · " + y,
            lines: [["Etiqueta", etLabel(et)], ["Mode", "calculat"]],
            fonts: fonts,
            note: et === "pendent"
              ? "Pendent: o no hi ha fitxer de fundadors utilitzable, o el nom no es pot classificar sense completar la llista. Les fonts documenten el càrrec, no la condició de fundador."
              : "Coincidència pel nom sencer normalitzat amb el fitxer de fundadors. Les fonts de sota documenten el càrrec de CEO."
          })
        };
      });
      var nomsHtml = persones.length
        ? persones.map(function (p) { return btn(p.nom, p.idNom); }).join("<br>")
        : btn("no consta", stash({ title: "CEO al 31/10 de " + y, lines: [["Valor", "no consta"]], fonts: fonts, note: "El camp ceo_31_10 és buit." }));
      var mateixa = persones.length > 0 && persones.every(function (p) { return p.et === persones[0].et; });
      var etHtml = !persones.length
        ? btn("pendent", stash({ title: "Etiqueta de l'any " + y, lines: [["Etiqueta", "pendent"]], fonts: fonts, note: "Sense nom de CEO no es calcula etiqueta." }))
        : (mateixa
          ? '<span class="tag ' + persones[0].et + '">' + btn(etLabel(persones[0].et), persones[0].idEt) + "</span>"
          : persones.map(function (p) { return esc(p.nom) + ': <span class="tag ' + p.et + '">' + btn(etLabel(p.et), p.idEt) + "</span>"; }).join("<br>"));
      var grup = R.etiquetaGrup(c.ceo_31_10, conj);
      var since = R.parseData(c.ceo_since);
      html += "<tr><td>" + esc(y) + "</td><td>" + mark(mostra) + "</td><td>" +
        camp("a_mostra", triLabel(c.a_mostra), "Valor del camp a_mostra. La mostra de la tesi és la cel·la C o C+V de la graella.") + "</td><td>" +
        nomsHtml + "</td><td>" + etHtml + (persones.length > 1 ? "<br><span class=\"hint\">Empresa-any: " + btn(etLabel(grup), stash({ title: "Etiqueta de l'empresa-any " + y, lines: [["Etiqueta", etLabel(grup)]], fonts: fonts, note: "Si hi ha co-CEO i un és fundador, l'empresa-any compta com a fundador. Si algú queda pendent i cap és fundador, l'empresa-any queda pendent. És una regla de càlcul d'aquest dashboard, amb la literatura encara per citar." })) + "</span>" : "") +
        "</td><td>" + camp("Proxy de tancament", triLabel(c.proxy_tancament), "És el camp proxy_tancament. El dashboard no el recalcula.") +
        "</td><td>" + camp("Canvi entre el 31/10 i el tancament", triLabel(c.canvi_entre_31_10_i_tancament), "És el camp canvi_entre_31_10_i_tancament. Un valor buit es mostra com a no consta, no com a no.") +
        "</td><td>" + camp("CEO al tancament de l'exercici", R.isBlank(c.ceo_tancament_fy) ? "no consta" : String(c.ceo_tancament_fy), "Camp ceo_tancament_fy.") +
        "</td><td>" + camp("CEO des de", since.label, "Camp ceo_since, amb la precisió que tingui el text. No s'ha completat cap dia.") +
        "</td><td>" + camp("Exercici que cobreix la font", R.isBlank(c.fy_que_cobreix) ? "no consta" : String(c.fy_que_cobreix), "Camp fy_que_cobreix.") +
        '</td><td><span class="st ' + esc(R.classeEstat(c.estat)) + '">' + camp("Estat", c.estat ? String(c.estat) : "no consta", R.motiuAny(c) ? "Motiu al registre: " + R.motiuAny(c) : "El registre d'aquest any no porta camp motiu.") + "</span></td><td>" +
        camp("Nivell màxim", c.nivell_max ? String(c.nivell_max) : "no consta", "Camp nivell_max.") + "</td></tr>";
    });
    html += "</tbody></table></div>";
    html += ganttHtml(d.periodes_tinenca || []);
    if (d.informe_mes_recent) {
      var idI = stash({ title: "Informe més recent", lines: [], fonts: [{ heading: "Informe més recent", obj: d.informe_mes_recent }], note: "" });
      html += "<h3>Informe més recent</h3><p>" + btn(d.informe_mes_recent.titol || d.informe_mes_recent.titol_pagina || "Obre l'evidència", idI) + "</p>";
    }
    if (d.fonts_context && d.fonts_context.length) {
      html += "<h3>Context d'identitat</h3><ul>";
      d.fonts_context.forEach(function (font, i) {
        var id = stash({ title: "Context " + (i + 1), lines: [], fonts: [{ heading: "Context", obj: font }], note: "Context del fitxer, no una dada de fundació." });
        html += "<li>" + btn(font.titol_pagina || font.cita_literal || ("Context " + (i + 1)), id) + "</li>";
      });
      html += "</ul>";
    }
    if (d.notes_metodologiques) html += '<h3>Notes del fitxer</h3><div class="note pre">' + esc(d.notes_metodologiques) + "</div>";
    if (d.cerques_fetas && d.cerques_fetas.length) {
      html += "<details class=\"cerques\"><summary>Cerques registrades (" + d.cerques_fetas.length + ")</summary><p class=\"hint\">És el registre de cerca del fitxer. No es presenta com a evidència citada.</p>";
      d.cerques_fetas.forEach(function (item) {
        if (typeof item === "string") html += "<p>" + esc(item) + "</p>";
        else if (item && typeof item === "object") {
          html += '<div class="ev"><p>' + (item.consulta ? esc(item.consulta) : "") + "</p>";
          if (item.url) html += "<p>URL: " + (safeUrl(item.url) ? '<a class="ext" href="' + esc(safeUrl(item.url)) + '" target="_blank" rel="noopener">' + esc(item.url) + "</a>" : esc(item.url)) + "</p>";
          html += "<p>HTTP: " + esc(item.http_status == null ? "no consta" : item.http_status) + " · document obert: " + esc(siNo(item.document_obert)) + "</p>";
          if (item.error_acces) html += "<p>" + esc(item.error_acces) + "</p>";
          html += "</div>";
        }
      });
      html += "</details>";
    }
    return html;
  }

  function frac3110(y) {
    var leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    var doy = leap ? 305 : 304;
    var diy = leap ? 366 : 365;
    return y + (doy - 1) / diy;
  }
  function ganttHtml(periodes) {
    var html = "<h3>Tinença</h3>";
    html += '<p class="hint">Cada tram surt de <span class="mono">periodes_tinenca</span>. Un any sense dia es ratlla sencer i no es converteix en l\'1 de gener. Si la fi no consta, el tram s\'obre fins al marge del gràfic: aquell marge no és una data de sortida. Una fi marcada exclusiva es mostra tal com està escrita.</p>';
    if (!periodes.length) return html + '<p class="empty">El fitxer no porta períodes de tinença.</p>';
    var lim = R.limitsGantt(periodes);
    var span = lim.end - lim.start;
    function pct(pt) { return ((pt - lim.start) / span) * 100; }
    var labels = [];
    var y0 = Math.ceil(lim.start);
    for (var y = y0; y <= 2025; y++) {
      if (y === y0 || y % 5 === 0 || y === 2015 || y === 2025) labels.push(y);
    }
    html += '<div class="gantt-wrap"><div class="gantt">';
    html += '<div class="axis">' + labels.map(function (yy) {
      return '<span style="left:' + pct(yy).toFixed(3) + '%">' + yy + "</span>";
    }).join("") + "</div>";
    var winA = Math.max(2015, lim.start);
    var winB = Math.min(2026, lim.end);
    var ticks = "";
    for (var t = 2015; t <= 2025; t++) {
      var pt = frac3110(t);
      if (pt >= lim.start && pt <= lim.end) ticks += '<i class="tick" style="left:' + pct(pt).toFixed(3) + '%" title="31/10/' + t + '"></i>';
    }
    var windowHtml = '<i class="win" style="left:' + pct(winA).toFixed(3) + "%;width:" + Math.max(0, pct(winB) - pct(winA)).toFixed(3) + '%"></i>';
    var lanes = [];
    var index = {};
    periodes.forEach(function (p, i) {
      var key = R.normalizeName(p && p.nom) || ("#" + i);
      if (index[key] == null) { index[key] = lanes.length; lanes.push({ nom: (p && p.nom) || "no consta", items: [] }); }
      lanes[index[key]].items.push(p || {});
    });
    lanes.forEach(function (lane) {
      var bars = "";
      var whens = "";
      lane.items.forEach(function (p) {
        var seg = R.segmentsPeriode(p, lim.start, lim.end);
        var id = stash({
          title: "Tinença de " + (p.nom || "sense nom"),
          lines: [
            ["Inici", seg.inici.label],
            ["Fi", seg.open ? "no consta" : seg.fi.label],
            ["Fi exclusiva", p.fi_exclusiva === true ? "sí, segons el fitxer" : siNo(p.fi_exclusiva)]
          ],
          fonts: fontsPeriode(p),
          note: "Les dates es mostren amb la precisió del fitxer. No s'ha inventat ni el dia que falta ni el dia de sortida d'un mandat obert."
        });
        whens += '<p class="when">' + btn((p.nom || "sense nom") + ": " + seg.inici.label + " → " + (seg.open ? "fi no consta" : seg.fi.label) + (p.fi_exclusiva === true ? " · fi exclusiva" : ""), id) + "</p>";
        if (!seg.posicionable) return;
        var a = Math.min.apply(null, seg.segments.map(function (s) { return s.a; }));
        var b = Math.max.apply(null, seg.segments.map(function (s) { return s.b; }));
        var left = pct(a);
        var width = Math.max(pct(b) - pct(a), 0.6);
        var inner = seg.segments.map(function (s) {
          var il = ((s.a - a) / (b - a)) * 100;
          var iw = ((s.b - s.a) / (b - a)) * 100;
          return '<span class="seg ' + s.style + '" style="left:' + il.toFixed(3) + "%;width:" + iw.toFixed(3) + '%"></span>';
        }).join("");
        var etiquetaBarra = seg.inici.label + " → " + (seg.open ? "fi no consta" : seg.fi.label);
        bars += '<button type="button" class="bar" data-ev="' + id + '" style="left:' + left.toFixed(3) + "%;width:" + width.toFixed(3) + '%" title="' + esc(etiquetaBarra) + '" aria-label="' + esc(etiquetaBarra) + '">' + inner + "</button>";
      });
      html += '<div class="lane"><div class="lane-name">' + esc(lane.nom) + '</div><div><div class="track">' + windowHtml + ticks + bars + "</div>" + whens + "</div></div>";
    });
    html += "</div></div>";
    html += '<ul class="legend"><li><i class="sw" style="background:#0e6b64"></i>Data completa</li><li><i class="seg ratllat" style="position:static;display:inline-block;width:28px;height:14px"></i> Només any o mes</li><li><i class="seg obert" style="position:static;display:inline-block;width:28px;height:14px"></i> Fi no consta</li><li>Banda clara: finestra 2015-2025. Línies: 31 d\'octubre.</li></ul>';
    return html;
  }

  function chartHtml(rows, aria) {
    if (!rows.length) return '<p class="empty">Cap empresa amb aquests filtres.</p>';
    var labelW = 168;
    var barW = 560;
    var rowH = 30;
    var w = labelW + barW + 78;
    var h = rows.length * rowH + 8;
    var max = 1;
    rows.forEach(function (r) { if (r.n > max) max = r.n; });
    var colors = { fundador: "#1f7a4d", familia: "#b7791f", professional: "#1d4e89", pendent: "#6f6a62" };
    var s = '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(aria) + '">';
    rows.forEach(function (r, i) {
      var y = 8 + i * rowH;
      s += '<text x="0" y="' + (y + 14) + '" font-size="12">' + esc(r.curt) + "</text>";
      var x = labelW;
      if (r.color) {
        var wone = (r.n / max) * barW;
        s += '<rect x="' + x.toFixed(2) + '" y="' + y + '" width="' + Math.max(wone, 0.4).toFixed(2) + '" height="18" fill="' + r.color + '"></rect>';
      } else {
        R.CLASSES.forEach(function (cl) {
          var seg = r[cl] || 0;
          if (!seg) return;
          var wseg = (seg / max) * barW;
          s += '<rect x="' + x.toFixed(2) + '" y="' + y + '" width="' + Math.max(wseg, 0.4).toFixed(2) + '" height="18" fill="' + colors[cl] + '"><title>' + esc(etLabel(cl) + ": " + seg) + "</title></rect>";
          x += wseg;
        });
      }
      s += '<text x="' + (labelW + (r.n / max) * barW + 8).toFixed(2) + '" y="' + (y + 14) + '" font-size="12">' + esc(nfmt(r.n)) + "</text>";
    });
    return s + "</svg>";
  }
  function curt(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
  function filesDe(map, labelFn) {
    return Object.keys(map).map(function (k) {
      var r = map[k];
      return { key: k, label: labelFn(k), curt: curt(labelFn(k), 22), n: r.n, fundador: r.fundador, familia: r.familia, professional: r.professional, pendent: r.pendent, ambDossier: r.ambDossier, ambFundacio: r.ambFundacio };
    }).filter(function (r) { return r.n > 0; });
  }
  function taulaParts(files, primera) {
    var head = "<tr><th>" + primera + "</th><th class=\"num\">Mostra</th><th class=\"num\">Fundador</th><th class=\"num\">Família</th><th class=\"num\">Professional</th><th class=\"num\">Pendent</th><th class=\"num\">Amb CEO</th><th class=\"num\">Amb fundadors</th></tr>";
    var body = files.map(function (r) {
      return "<tr><td>" + esc(r.label) + '</td><td class="num">' + nfmt(r.n) + '</td><td class="num">' + nfmt(r.fundador) + " · " + pctTxt(r.fundador, r.n) + '</td><td class="num">' + nfmt(r.familia) + " · " + pctTxt(r.familia, r.n) + '</td><td class="num">' + nfmt(r.professional) + " · " + pctTxt(r.professional, r.n) + '</td><td class="num">' + nfmt(r.pendent) + " · " + pctTxt(r.pendent, r.n) + '</td><td class="num">' + nfmt(r.ambDossier) + '</td><td class="num">' + nfmt(r.ambFundacio) + "</td></tr>";
    }).join("");
    return '<div class="wrap"><table><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>";
  }
  function llegenda() {
    return '<ul class="legend"><li><i class="sw fundador"></i>Fundador</li><li><i class="sw familia"></i>Família fundadora</li><li><i class="sw professional"></i>Professional</li><li><i class="sw pendent"></i>Pendent</li></ul>';
  }

  function renderAgregada() {
    if (!el("ag-out")) {
      el("contingut").innerHTML =
        "<h2>Vista agregada</h2>" +
        '<p>Quota, dins la mostra de l\'any (cel·la C o C+V), d\'empreses liderades per un fundador, per la família fundadora, per un CEO professional, o encara pendents. El denominador no es retalla a les empreses que ja tenen fitxer.</p>' +
        '<div class="ctl">' +
          '<label class="f">País<select id="ag-pais">' + optionsPais(S.agPais) + "</select></label>" +
          '<label class="f">Any del gràfic de país<select id="ag-any">' + optionsAny(S.agAny, true) + "</select></label>" +
          '<label class="f">Cas<select id="ag-cas">' +
            '<option value="">Tots els casos</option>' +
            '<option value="fusio">Fusió (D1)</option>' +
            '<option value="spin_off">Spin-off (D10)</option>' +
            '<option value="estat">Estat</option>' +
            '<option value="criteri_pendent">Criteri pendent</option>' +
            '<option value="sense_cas">Sense cas informat</option>' +
            '<option value="sense_fitxer">Sense fitxer de fundadors</option>' +
          "</select></label>" +
        "</div>" +
        '<div class="radios" id="ag-mode">' +
          radioMode("calculat", "Calculat") +
          radioMode("previsualitzacio", "Previsualització D1 i D10") +
          radioMode("robustesa_d10", "Robustesa D10: sense fundador") +
        "</div>" +
        '<p class="hint">El mode calculat no atribueix fundadors d\'una fusió o d\'un spin-off mentre <span class="mono">decisio</span> no sigui <span class="mono">aplicada</span>. La previsualització aplica la regla i queda marcada com a tal. La robustesa D10 tracta el spin-off com si no tingués fundador. Sense fitxers de fundadors, els tres modes deixen tothom en pendent.</p>' +
        '<div id="ag-out"></div>';
      el("ag-pais").addEventListener("change", function () { S.agPais = el("ag-pais").value; paintAgregada(); });
      el("ag-any").addEventListener("change", function () { S.agAny = el("ag-any").value; paintAgregada(); });
      el("ag-cas").value = S.agCas;
      el("ag-cas").addEventListener("change", function () { S.agCas = el("ag-cas").value; paintAgregada(); });
      el("ag-mode").addEventListener("change", function (e) {
        if (e.target.name === "mode") { S.agMode = e.target.value; paintAgregada(); }
      });
    }
    paintAgregada();
  }
  function radioMode(v, label) {
    return '<label><input type="radio" name="mode" value="' + v + '"' + (S.agMode === v ? " checked" : "") + "> " + label + "</label>";
  }
  function paintAgregada() {
    var ag = R.resumAgregat({
      members: S.members,
      perIsin: perIsin(),
      country: S.agPais,
      cas: S.agCas,
      mode: S.agMode,
      any: S.agAny
    });
    var anys = filesDe(ag.byYear, function (k) { return k; });
    anys.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    var paisos = filesDe(ag.byCountry, paisLabel);
    paisos.sort(function (a, b) { return b.n - a.n || a.label.localeCompare(b.label, "ca"); });
    var modeTxt = S.agMode === "calculat" ? "Mode calculat." : (S.agMode === "previsualitzacio" ? "Previsualització. No és una decisió presa." : "Robustesa D10, lectura sense fundador. No substitueix la codificació principal.");
    var anyTxt = S.agAny
      ? "El gràfic de país és la mostra de " + S.agAny + "."
      : "Sense any concret, el gràfic de país suma empreses-any: una empresa a la mostra vuit anys hi compta vuit vegades. El gràfic d'anys continua sent una fila per any.";
    el("ag-out").innerHTML =
      "<p><b>" + esc(modeTxt) + "</b> " + esc(anyTxt) + " La longitud de la barra és el nombre d'empreses (o d'empreses-any). El color en parteix la classe. Avui, sense fundadors, el color és el de pendent.</p>" +
      llegenda() +
      "<h3>Per any</h3>" + chartHtml(anys, "Mostra per any, partida per tipus de lideratge") +
      taulaParts(anys, "Any") +
      "<h3>Per país</h3>" + chartHtml(paisos, "Mostra per país, partida per tipus de lideratge") +
      taulaParts(paisos, "País");
  }

  function renderQualitat() {
    if (!el("q-out")) {
      el("contingut").innerHTML =
        "<h2>Qualitat de les dades</h2>" +
        "<p>Recompte fet només amb els fitxers carregats i amb la graella. Una font única és una parella URL oficial + URL arxivada. El mateix document citat diversos anys compta una vegada al bloc de fonts úniques.</p>" +
        '<div class="ctl">' +
          '<label class="f">Anys-empresa<select id="q-estat">' +
            '<option value="revisar">Fora de verificada A</option><option value="tots">Tots</option>' +
            '<option value="verificada_A">Verificada A</option><option value="verificada_B">Verificada B</option>' +
            '<option value="reculada_per_tinenca">Reculada per tinença</option><option value="no_trobat">No trobat</option>' +
            '<option value="unclear">No clar</option><option value="proxy">Proxy de tancament</option>' +
          "</select></label>" +
          '<label class="f">Fonts úniques<select id="q-font">' +
            '<option value="pendent">Sense Wayback durable</option><option value="totes">Totes</option>' +
            '<option value="durable">Wayback durable</option><option value="nomes_viva">Només URL viva</option>' +
            '<option value="wayback_sense_marca">Wayback sense marca durable</option>' +
          "</select></label>" +
        "</div>" +
        '<div id="q-out"></div>';
      el("q-estat").value = S.qEstat;
      el("q-font").value = S.qFont;
      el("q-estat").addEventListener("change", function () { S.qEstat = el("q-estat").value; paintQualitat(); });
      el("q-font").addEventListener("change", function () { S.qFont = el("q-font").value; paintQualitat(); });
    }
    paintQualitat();
  }
  function paintQualitat() {
    var companies = [];
    S.dossiers.forEach(function (d) { companies.push(d); });
    var members = {};
    S.members.forEach(function (m) { members[m.isin] = m; });
    var q = R.resumQualitat(companies, members);
    var coberturaAnys = 0;
    S.members.forEach(function (m) { YEARS.forEach(function (y) { if (R.aMostra(m[y])) coberturaAnys += 1; }); });
    var ambDossierAMostra = 0;
    q.anys.forEach(function (a) {
      var m = members[a.isin];
      if (m && R.aMostra(m[String(a.any)])) ambDossierAMostra += 1;
    });
    function kpi(n, label) { return '<div class="kpi"><b>' + esc(n) + "</b><span>" + esc(label) + "</span></div>"; }
    var estatsChart = ["verificada_A", "verificada_B", "reculada_per_tinenca", "no_trobat", "unclear", "sense_estat", "altre"].filter(function (k) {
      return q.estats[k];
    }).map(function (k) {
      var color = k === "verificada_A" || k === "verificada_B" ? "#1f7a4d" : (k === "reculada_per_tinenca" ? "#b7791f" : "#8a3b32");
      return { curt: curt(k, 22), label: k, n: q.estats[k], color: color };
    });
    var fontChart = [
      { curt: "Wayback durable", label: "Wayback durable", n: q.uniques.durable, color: "#1f7a4d" },
      { curt: "Només URL viva", label: "Només URL viva", n: q.uniques.nomes_viva, color: "#6f6a62" },
      { curt: "Wayback sense marca", label: "Wayback sense marca", n: q.uniques.wayback_sense_marca, color: "#b7791f" }
    ].filter(function (r) { return r.n > 0; });
    var anys = q.anys.filter(function (a) {
      if (S.qEstat === "tots") return true;
      if (S.qEstat === "revisar") return a.classe !== "verificada_A";
      if (S.qEstat === "proxy") return a.proxy === "si";
      return a.classe === S.qEstat;
    });
    var filesFont = Object.keys(q.uniq).map(function (k) { return q.uniq[k]; }).filter(function (u) {
      if (S.qFont === "totes") return true;
      if (S.qFont === "pendent") return u.classe !== "durable";
      return u.classe === S.qFont;
    });
    filesFont.sort(function (a, b) { return (a.classe > b.classe ? 1 : -1) || String(a.isin).localeCompare(b.isin); });
    var discrep = q.discrep.length
      ? q.discrep.map(function (d) {
        return "<li><a href=\"#fitxa/" + encodeURIComponent(d.isin) + "\">" + esc(d.isin) + "</a> · " + esc(d.any) + " · " + esc(d.text) + " Cel·la: " + esc(d.cel || "buida") + ".</li>";
      }).join("")
      : '<li class="empty">Cap discrepància entre a_mostra i la cel·la C o C+V, en els anys on el dossier informa a_mostra.</li>';
    el("q-out").innerHTML =
      '<div class="kpis">' +
        kpi(nfmt(S.members.length), "ISIN a la graella") +
        kpi(nfmt(S.dossiers.size), "Fitxers de CEO") +
        kpi(nfmt(nFundReconeguts()), "Fitxers de fundadors") +
        kpi(nfmt(coberturaAnys), "Empreses-any a la mostra") +
        kpi(nfmt(q.anys.length), "Anys als dossiers") +
        kpi(nfmt(q.estats.verificada_A || 0), "Verificada A") +
        kpi(nfmt(q.estats.verificada_B || 0), "Verificada B") +
        kpi(nfmt(q.proxy.si), "Proxy de tancament") +
        kpi(nfmt(q.estats.reculada_per_tinenca || 0), "Reculada per tinença") +
        kpi(nfmt((q.estats.no_trobat || 0) + (q.estats.unclear || 0)), "No trobat o no clar") +
        kpi(nfmt(q.uniques.durable), "Fonts amb Wayback") +
        kpi(nfmt(q.uniques.pendent), "Captures pendents") +
      "</div>" +
      "<p>Dels anys escrits als dossiers, " + nfmt(ambDossierAMostra) + " cauen en un any en què la graella té C o C+V. Proxy sí: " + nfmt(q.proxy.si) + ", no: " + nfmt(q.proxy.no) + ", no consta: " + nfmt(q.proxy.no_consta) + ". Canvi entre el 31/10 i el tancament: sí " + nfmt(q.canvi.si) + ", no " + nfmt(q.canvi.no) + ", no consta " + nfmt(q.canvi.no_consta) + ".</p>" +
      "<p>Fonts citades, amb repetició d'anys: " + nfmt(q.fonts.length) + ". Fonts úniques: " + nfmt(q.uniques.n) + ", de les quals Wayback durable " + nfmt(q.uniques.durable) + " i sense captura durable " + nfmt(q.uniques.pendent) + ". Classificacions mixtes de la mateixa URL: " + nfmt(q.uniques.mixt) + ".</p>" +
      "<h3>Estat dels anys</h3>" + chartHtml(estatsChart, "Anys dels dossiers segons l'estat") +
      "<h3>Arxiu de les fonts úniques</h3>" + chartHtml(fontChart, "Fonts úniques segons la captura") +
      "<p class=\"hint\">Wayback durable vol dir <span class=\"mono\">arxiu_durable</span> cert i una URL de web.archive.org. Si la URL arxivada és la URL viva, o Wayback ha fallat, la font compta com a captura pendent. El SHA-256 es mira a la fitxa: aquests JSON de CEO no el porten.</p>" +
      "<h3>Anys-empresa</h3>" +
      (anys.length ? '<div class="wrap"><table><thead><tr><th>Empresa</th><th>Any</th><th>Estat</th><th>CEO</th><th>Proxy</th><th>Canvi</th><th>Motiu</th></tr></thead><tbody>' + anys.map(function (a) {
        var motiu = a.motiu || "No consta al registre de l'any. La nota lliure del fitxer, si n'hi ha, és a la fitxa i no es copia aquí com si fos un motiu estructurat.";
        return '<tr><td><a href="#fitxa/' + encodeURIComponent(a.isin) + '">' + esc(a.nom || a.isin) + '</a></td><td>' + esc(a.any) + '</td><td><span class="st ' + esc(a.classe) + '">' + esc(a.estat || a.classe) + "</span></td><td>" + esc(a.ceo || "no consta") + "</td><td>" + esc(a.proxy) + "</td><td>" + esc(a.canvi) + "</td><td>" + esc(motiu) + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<p class="empty">Cap any amb aquest filtre.</p>') +
      "<h3>Fonts</h3>" +
      (filesFont.length ? '<div class="wrap"><table><thead><tr><th>ISIN</th><th>Classe</th><th>Cites</th><th>HTTP</th><th>Error d\'accés</th><th>URL</th></tr></thead><tbody>' + filesFont.map(function (u) {
        var o = u.obj || {};
        var href = safeUrl(o.url);
        var arx = safeUrl(o.url_arxivada);
        return "<tr><td><a href=\"#fitxa/" + encodeURIComponent(u.isin) + "\">" + esc(u.isin) + "</a></td><td>" + esc(u.classe) + (u.mixt ? " · mixta" : "") + "</td><td class=\"num\">" + nfmt(u.n) + "</td><td>" + esc(o.http_status == null ? "no consta" : o.http_status) + "</td><td>" + esc(o.error_acces || "no consta") + "</td><td>" +
          (href ? '<a class="ext" href="' + esc(href) + '" target="_blank" rel="noopener">oficial</a>' : "URL oficial no consta") + " · " +
          (arx ? '<a class="ext" href="' + esc(arx) + '" target="_blank" rel="noopener">' + (R.esWayback(o.url_arxivada) ? "Wayback" : "arxivada, no és Wayback") + "</a>" : "sense URL arxivada") +
          "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<p class="empty">Cap font amb aquest filtre.</p>') +
      "<h3>Mostra del dossier i graella</h3><ul>" + discrep + "</ul>" +
      "<p>Empreses de la graella sense fitxer de CEO: " + nfmt(S.members.length - S.members.filter(function (m) { return S.dossiers.get(m.isin); }).length) + ".</p>";
  }

  function renderMetodologia() {
    resetEv();
    el("contingut").innerHTML = '<article class="method"><h2>Metodologia</h2>' +
      '<p>Aquesta pàgina recull decisions ja escrites al protocol v1.2.5 i al pack de cerca de fundadors del 9 de novembre de 2026. No n\'hi afegeix de noves. On la tesi encara ha de citar literatura, l\'espai queda buit a posta.</p>' +
      '<div class="hole">Referència bibliogràfica pendent: marc teòric de founder-CEO i de family-led que adoptarà la tesi.</div>' +
      '<h2>Univers i tall del 31 d\'octubre</h2>' +
      '<p>L\'univers és la composició de l\'iShares STOXX Europe 600 UCITS ETF (DE) als informes semestrals que tanquen el 31 d\'octubre, de 2015 a 2025. Hi ha una fila per ISIN de referència.</p>' +
      '<ul><li><span class="mk C">C</span> L\'empresa és a la cartera el 31 d\'octubre.</li>' +
      '<li><span class="mk V">V</span> Hi ha una sortida a la finestra de maig a octubre i l\'empresa no és a la cartera final.</li>' +
      '<li><span class="mk CV">C+V</span> Aquell any hi ha una línia C i una línia V.</li>' +
      '<li>Cel·la buida: no hi ha evidència admissible aquell any. No vol dir que l\'empresa hagi estat absent els dotze mesos.</li></ul>' +
      '<p>La mostra de l\'any t són les empreses amb C o C+V. V sola no entra a la mostra. El CEO que es fa servir per a l\'etiqueta de lideratge és el del 31 d\'octubre (<span class="mono">ceo_31_10</span>). Els camps de proxy de tancament i de canvi fins al tancament es mostren tal com vénen al fitxer. Aquest dashboard no els recalcula, ni reconstrueix el nom del 31 d\'octubre a partir dels períodes de tinença.</p>' +
      '<div class="hole">Referència bibliogràfica pendent: per què el tall de mesura és el 31 d\'octubre i no el tancament de l\'exercici.</div>' +
      '<h2>Clau ISIN</h2>' +
      '<p>L\'ISIN és la clau. No es fusionen ISIN i no es dedueix continuïtat pel nom. Si hi ha dubte de títol o de predecessora, es conserven les dues entitats. Els altres ISIN observats als informes es mostren com a àlies i no hereten la filera de pertinença.</p>' +
      '<h2>Fundadors, Estat, fusions i spin-offs</h2>' +
      '<p>Els fundadors arribaran en fitxers separats, o en un bloc <span class="mono">fundacio</span>, amb els camps del pack: fundadors, data de fundació, estat final, URL, URL arxivada, cita literal, SHA-256 i tipus de font. Avui no n\'hi ha cap de carregat.</p>' +
      '<ul><li>Persona: fundador identificat com a persona física. Fundador, comprador, president, primer CEO, hereu i accionista no es tracten com a sinònims.</li>' +
      '<li>Família fundadora: una família citada sense convertir-la en noms de persona que la font no dóna.</li>' +
      '<li>Estat: origen estatal acreditat i sense persona fundadora original. Només en aquest cas equival a l\'absència de fundador. Una privatització no esborra un fundador privat anterior. Una contradicció entre persona i Estat queda en criteri pendent.</li>' +
      '<li>Sense persona: fundació institucional sense persona, amb evidència positiva de l\'acte. No trobar un nom no acredita que no hi hagi fundador.</li></ul>' +
      '<p>D1, fusions. La codificació prevista atribueix a l\'ISIN els fundadors de totes les parts. El pack diu que això no s\'aplica sol: ho han de revisar Jordi i el doctorat. Mentre <span class="mono">decisio</span> no sigui <span class="mono">aplicada</span>, la fitxa ensenya les parts i els seus fundadors com a fets, i l\'etiqueta de lideratge queda pendent.</p>' +
      '<p>D10, spin-offs. La codificació prevista atribueix els fundadors de la matriu, i en guarda una lectura de robustesa «sense fundador». Tampoc s\'aplica sola. A la vista agregada, la previsualització i la robustesa es poden mirar a part, sempre amb aquest nom.</p>' +
      '<p>Si la font només dóna l\'any, es desa l\'any i la precisió «any». No es fabrica l\'1 de gener. La data de fundació, la de constitució, la de sortida a borsa, la de canvi de nom, la de fusió i la d\'escissió no es barregen.</p>' +
      '<div class="hole">Referència bibliogràfica pendent: fundador en fusions, en spin-offs i en empreses d\'origen estatal.</div>' +
      '<h2>Etiqueta del CEO</h2>' +
      '<p>Sense fitxer de fundadors, l\'etiqueta és pendent. No es marca ningú com a professional per falta de dades.</p>' +
      '<ul><li>Fundador, si el nom sencer normalitzat coincideix amb un fundador. No n\'hi ha prou amb un cognom.</li>' +
      '<li>Família fundadora, si coincideix amb la llista familiar i no és a la de fundadors.</li>' +
      '<li>Professional, si l\'estat final tracta la llista com a tancada (resolta, Estat o sense persona) i el nom no hi coincideix.</li>' +
      '<li>Pendent, si l\'estat és no trobat o criteri pendent i el nom no coincideix. Una llista parcial no es converteix en «tots professionals».</li></ul>' +
      '<p>Co-CEO. Regla provisional d\'aquest dashboard, no del protocol: si un dels co-CEO és fundador, l\'empresa-any compta com a fundador. Si algun nom queda pendent i cap és fundador, l\'empresa-any queda pendent. Si tots són professionals, és professional.</p>' +
      '<div class="hole">Referència bibliogràfica pendent: definició operativa de founder-CEO, de family-led i tractament dels co-CEO.</div>' +
      '<h2>Evidència, de D24 a D29</h2>' +
      '<p>El fitxer de protocol adjunt a aquest prototip porta el text de D29. El pack de cerca resumeix D24 a D29 i és la guia d\'aquesta pàgina. No es reconstrueix aquí un redactat de D24 a D28 que el prototip no té.</p>' +
      '<p>Per a cada afirmació, el pack exigeix un document obert amb HTTP 200, la URL original, la cita literal en la llengua de la font, la pàgina o el localitzador, el tipus i el nivell, la data del document si hi consta, i la data de comprovació. Si la data no hi consta, el camp queda buit i no es confon amb la data d\'accés. Un 403, un temps d\'espera, un captcha o una pantalla de consentiment no són evidència, encara que el servidor respongui 200.</p>' +
      '<p>D29, durabilitat. La URL arxivada ha de ser una captura de Wayback Machine. La URL oficial viva no és durable: un regulador o una empresa poden retirar el document, sobretot després d\'una descotització o d\'una fusió. Si Wayback falla, es conserva la URL oficial, s\'explica l\'error i <span class="mono">arxiu_durable</span> és fals. Una còpia pròpia no substitueix una font que un tercer pugui obrir. El SHA-256 es mostra quan el fitxer el porta. Si no el porta, la fitxa diu «no consta» i no en calcula un.</p>' +
      '<p>Els mandats acabats es delimiten amb dates documentades. Wikis, directoris i fragments de cercador només són pistes, mai evidència final. Cal tornar a una font de nivell A o, si no n\'hi ha, a una de nivell B amb aquesta condició visible.</p>' +
      '<div class="hole">Referència bibliogràfica pendent: estàndards d\'evidència i de reproductibilitat que la tesi vulgui citar, a més del protocol intern.</div>' +
      '<h2>Què calcula aquesta pàgina, i què no</h2>' +
      '<p>Calculat: la pertinença C, V i C+V; la mostra; els recomptes per any i per país; la lectura dels fitxers d\'empresa; si una font té captura Wayback durable o només URL viva; l\'etiqueta de lideratge, només amb un fitxer de fundadors utilitzable.</p>' +
      '<p>Pendent: els fundadors de l\'univers; l\'etiqueta de les empreses que encara no tenen aquest fitxer; les captures que el JSON marca com a no durables; els SHA-256 absents; el text íntegre de D24 a D28; les referències bibliogràfiques.</p>' +
      '<h2>Com s\'afegeix una empresa</h2>' +
      '<p>Es desa <span class="mono">data/empreses/{ISIN}.json</span> amb l\'ISIN també a dins. Els fundadors, quan estiguin aprovats, van a <span class="mono">data/fundadors/{ISIN}.json</span> o dins la clau <span class="mono">fundacio</span>. Després, <span class="mono">python3 scripts/build_index.py</span>. En recarregar, la graella, la fitxa, l\'agregat i la qualitat agafen el fitxer nou. El contracte detallat és al README del repositori.</p>' +
      '</article>';
  }

  var HASH_KEYS = { sha256: "SHA-256", sha256_document: "SHA-256 del document", sha256_extracte: "SHA-256 de l'extracte", hash: "SHA-256", hash_objecte: "SHA-256 de l'objecte" };
  var CAMP = {
    url: "URL oficial", url_arxivada: "URL arxivada", url_llegida: "URL llegida", url_efectiva: "URL efectiva",
    http_status: "Estat HTTP", pagina: "Pàgina o localitzador", localitzador: "Localitzador",
    data_document: "Data del document", data_document_estat: "Estat de la data del document", data_document_tipus: "Tipus de data",
    data_captura: "Data de captura", data_comprovacio: "Data de comprovació",
    nivell: "Nivell", estat: "Estat", tipus_font: "Tipus de font", tipus_font_confirmat: "Tipus de font confirmat",
    arxiu_durable: "Arxiu durable", captura_pendent: "Captura pendent", error_acces: "Error d'accés",
    document_obert: "Document obert", organitzacio_emissora: "Organització emissora", titol_pagina: "Títol", titol: "Títol",
    agregador: "Agregador", literal_comprovat: "Cita comprovada al text", arxiu_estat: "Estat de l'arxiu",
    inici: "Inici", fi: "Fi", fi_exclusiva: "Fi exclusiva", nom: "Nom", source_id: "Identificador de font", camp_sostingut: "Camp sostingut", valor: "Valor"
  };

  function renderValor(k, v) {
    if (k === "url" || k === "url_arxivada" || k === "url_llegida" || k === "url_efectiva") {
      if (R.isBlank(v)) return "no consta";
      var href = safeUrl(v);
      return href ? '<a class="ext" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(v) + "</a>" : esc(v);
    }
    if (typeof v === "boolean") return esc(siNo(v));
    if (v == null || v === "") return "no consta";
    return esc(v);
  }
  function targetaFont(font) {
    var o = font.obj || {};
    var classe = R.classeArxiu(o);
    var badge = classe === "durable" ? '<span class="badge ok">Wayback durable</span>' : (classe === "wayback_sense_marca" ? '<span class="badge warn">Wayback sense marca durable</span>' : '<span class="badge warn">Captura pendent</span>');
    if (!R.isBlank(o.url_arxivada) && !R.esWayback(o.url_arxivada)) badge += ' <span class="badge warn">La URL arxivada no és de Wayback</span>';
    var hashes = [];
    Object.keys(HASH_KEYS).forEach(function (k) { if (!R.isBlank(o[k])) hashes.push([HASH_KEYS[k], o[k]]); });
    if (!hashes.length) hashes.push(["SHA-256", null]);
    var fixes = ["url", "url_arxivada", "http_status", "pagina", "localitzador", "data_document", "nivell", "estat"];
    var html = '<article class="ev"><h3>' + esc(font.heading || "Font") + "</h3>" + '<div class="badges">' + badge + "</div>" + '<div class="kv">';
    fixes.forEach(function (k) {
      html += "<b>" + esc(CAMP[k] || k) + "</b><div>" + renderValor(k, o[k]) + "</div>";
    });
    hashes.forEach(function (pair) {
      html += "<b>" + esc(pair[0]) + "</b><div class=\"mono\">" + (pair[1] == null ? "no consta" : esc(pair[1])) + "</div>";
    });
    ["data_document_estat", "data_captura", "data_comprovacio", "tipus_font", "tipus_font_confirmat", "arxiu_durable", "captura_pendent", "document_obert", "organitzacio_emissora", "titol", "titol_pagina", "agregador", "error_acces", "inici", "fi", "fi_exclusiva", "nom", "source_id", "camp_sostingut", "url_llegida", "url_efectiva", "literal_comprovat", "arxiu_estat", "data_document_tipus", "valor"].forEach(function (k) {
      if (o[k] == null || o[k] === "") return;
      html += "<b>" + esc(CAMP[k] || k) + "</b><div>" + renderValor(k, o[k]) + "</div>";
    });
    html += "</div>";
    html += "<h3>Cita literal</h3>" + (R.isBlank(o.cita_literal) ? '<p class="empty">No consta.</p>' : "<blockquote>" + esc(o.cita_literal) + "</blockquote>");
    if (!R.isBlank(o.extracte)) html += "<h3>Extracte de context</h3><p class=\"hint\">Pot ser una nota de lectura. No substitueix la cita literal.</p><blockquote>" + esc(o.extracte) + "</blockquote>";
    html += "</article>";
    return html;
  }
  var lastFocus = null;
  function openDrawer(rec) {
    if (!rec) return;
    lastFocus = document.activeElement;
    var html = '<button type="button" class="solid" id="tanca">Tanca</button><h2 id="drawer-title">' + esc(rec.title || "Dada") + "</h2>";
    if (rec.note) html += '<p class="note">' + esc(rec.note) + "</p>";
    if (rec.lines && rec.lines.length) {
      html += '<div class="kv">';
      rec.lines.forEach(function (pair) { html += "<b>" + esc(pair[0]) + "</b><div>" + esc(pair[1]) + "</div>"; });
      html += "</div>";
    }
    if (rec.fonts && rec.fonts.length) html += rec.fonts.map(targetaFont).join("");
    else html += '<p class="empty">Aquesta dada no porta un objecte de font. Els camps que falten es deixen en no consta.</p>';
    el("panel").innerHTML = html;
    el("drawer").hidden = false;
    el("tanca").focus();
    el("tanca").addEventListener("click", closeDrawer);
  }
  function closeDrawer() {
    var d = el("drawer");
    if (!d || d.hidden) return;
    d.hidden = true;
    el("panel").innerHTML = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ev]");
    if (b && S.ev[b.getAttribute("data-ev")]) {
      e.preventDefault();
      openDrawer(S.ev[b.getAttribute("data-ev")]);
      return;
    }
    if (e.target && e.target.id === "drawer") closeDrawer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  var proj = el("proj");
  try {
    if (localStorage.getItem("df-projector") === "1") {
      document.body.classList.add("projector");
      proj.setAttribute("aria-pressed", "true");
      proj.textContent = "Mode pantalla";
    }
  } catch (e) { /* sense magatzem */ }
  proj.addEventListener("click", function () {
    var on = !document.body.classList.contains("projector");
    document.body.classList.toggle("projector", on);
    proj.setAttribute("aria-pressed", on ? "true" : "false");
    proj.textContent = on ? "Mode pantalla" : "Mode projector";
    try { localStorage.setItem("df-projector", on ? "1" : "0"); } catch (err) { /* sense magatzem */ }
  });

  window.addEventListener("hashchange", route);
  boot();
})();
