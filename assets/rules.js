/* Regles de lectura del dashboard. No inventa dates, noms, hashes ni URL.
   Les etiquetes de lideratge només es calculen amb un fitxer de fundadors. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.FundRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var YEARS = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
  var CLASSES = ["fundador", "familia", "professional", "pendent"];

  function isBlank(v) {
    return v == null || (typeof v === "string" && v.trim() === "");
  }

  function parseData(v) {
    if (typeof v === "number" && isFinite(v)) v = String(v);
    if (isBlank(v)) return { kind: "absent", raw: "", label: "no consta" };
    if (typeof v !== "string" && typeof v !== "number") {
      return { kind: "text", raw: "", label: "format no reconegut" };
    }
    var s = String(v).trim();
    if (/^\d{4}$/.test(s)) {
      return { kind: "any", raw: s, label: s + " (només any)", y: +s };
    }
    var mes = /^(\d{4})-(\d{2})$/.exec(s);
    if (mes) {
      var m = +mes[2];
      if (m >= 1 && m <= 12) {
        return { kind: "mes", raw: s, label: s + " (any i mes, sense dia)", y: +mes[1], m: m };
      }
    }
    var dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (dia) {
      var mm = +dia[2];
      var dd = +dia[3];
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return { kind: "dia", raw: s, label: s, y: +dia[1], m: mm, d: dd };
      }
    }
    return { kind: "text", raw: s, label: s };
  }

  function daysInYear(y) {
    return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
  }

  function dayOfYear(y, m, d) {
    var dim = [31, daysInYear(y) === 366 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var n = d;
    var i;
    for (i = 0; i < m - 1; i++) n += dim[i];
    return n;
  }

  /* Punt a l'eix anual. Un any sencer ocupa [y, y+1). Un mes ocupa el seu dotzè.
     Una data completa es col·loca al dia que consta. No es fabrica el dia 1. */
  function axisPoint(parsed, edge) {
    if (!parsed) return null;
    if (parsed.kind === "dia") {
      return parsed.y + (dayOfYear(parsed.y, parsed.m, parsed.d) - 1) / daysInYear(parsed.y);
    }
    if (parsed.kind === "mes") {
      var left = parsed.y + (parsed.m - 1) / 12;
      return edge === "end" ? left + 1 / 12 : left;
    }
    if (parsed.kind === "any") return edge === "end" ? parsed.y + 1 : parsed.y;
    return null;
  }

  function normalizeName(s) {
    if (isBlank(s)) return "";
    var t = String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    t = t.toLowerCase().replace(/[.’'`´]/g, "");
    t = t.replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/^(dr|dra|prof|sir|lord|dame|mr|mrs|ms)\s+/, "");
    return t.trim();
  }

  function splitCeos(s) {
    if (Array.isArray(s)) {
      var out = [];
      s.forEach(function (item) { out = out.concat(splitCeos(item)); });
      return out;
    }
    if (isBlank(s)) return [];
    return String(s).split(/\s+\/\s+|\s+\|\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function asArray(v) {
    if (isBlank(v)) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === "string") {
      var t = v.trim();
      if (!t) return [];
      if (t.charAt(0) === "[" || t.charAt(0) === "{") {
        try {
          var j = JSON.parse(t);
          if (Array.isArray(j)) return j;
          if (j && typeof j === "object") return [j];
        } catch (e) { /* text pla */ }
      }
      return [t];
    }
    if (typeof v === "object") return [v];
    return [];
  }

  function personFrom(item, bandera, origen) {
    if (item == null) return null;
    if (typeof item === "string" || typeof item === "number") {
      var nom = String(item).trim();
      if (!nom) return null;
      return { nom: nom, tipus: "pendent", bandera: bandera || "", origen: origen || "" };
    }
    if (typeof item === "object") {
      var name = item.nom || item.nom_complet || item.name || item.persona || "";
      if (isBlank(name)) return null;
      var tipus = item.tipus || item.tipus_fundador || item.categoria || "";
      return {
        nom: String(name).trim(),
        tipus: isBlank(tipus) ? "pendent" : String(tipus),
        bandera: item.bandera || item.flag || bandera || "",
        origen: item.origen || item.entitat || origen || ""
      };
    }
    return null;
  }

  function collectPeople(list, bandera, origen) {
    var out = [];
    asArray(list).forEach(function (item) {
      var p = personFrom(item, bandera, origen);
      if (p) out.push(p);
    });
    return out;
  }

  function casDe(src) {
    if (!src || typeof src !== "object") return { id: "sense_fitxer", label: "sense fitxer de fundadors" };
    var token = String(src.cas || src.cas_tipus || src.tipus_cas || "").trim().toLowerCase();
    var estatFinal = String(src.estat_final || "").trim().toLowerCase();
    var categoria = String(src.categoria_origen || "").trim().toLowerCase();
    if (token === "fusio" || token === "fusió" || token === "d1" || src.d1 === true) {
      return { id: "fusio", label: "fusió (D1)" };
    }
    if (token === "spin_off" || token === "spin-off" || token === "spinoff" || token === "escissio" || token === "escissió" || token === "d10" || src.d10 === true) {
      return { id: "spin_off", label: "spin-off (D10)" };
    }
    if (token === "estat" || estatFinal === "estat" || categoria === "estat") {
      return { id: "estat", label: "Estat" };
    }
    if (estatFinal === "criteri_pendent" || token === "criteri_pendent") {
      return { id: "criteri_pendent", label: "criteri pendent" };
    }
    if (token) return { id: "altre", label: String(src.cas || src.cas_tipus || src.tipus_cas) };
    return { id: "sense_cas", label: "sense cas informat" };
  }

  function evidenciaPrincipal(src) {
    if (!src) return null;
    var keys = ["url", "url_arxivada", "url_llegida", "url_efectiva", "http_status", "cita_literal", "extracte", "pagina", "localitzador", "data_document", "data_document_estat", "sha256", "sha256_document", "sha256_extracte", "tipus_font", "nivell", "document_obert", "captura_pendent", "arxiu_durable", "error_acces", "data_captura", "data_comprovacio"];
    var o = {};
    var any = false;
    keys.forEach(function (k) {
      if (!isBlank(src[k]) || src[k] === false || src[k] === 0) {
        o[k] = src[k];
        any = true;
      }
    });
    return any ? o : null;
  }

  function collectEvidencies(src) {
    var lists = []
      .concat(asArray(src.evidencies))
      .concat(asArray(src.evidencies_fundador || src.evidencies_fundador_json))
      .concat(asArray(src.evidencies_any || src.evidencies_any_json))
      .concat(asArray(src.evidencies_familia || src.evidencies_familia_json));
    return lists.filter(function (item) { return item && typeof item === "object"; });
  }

  var FUND_KEYS = ["fundadors", "fundadors_json", "data_fundacio", "any_fundacio", "estat_final", "categoria_origen", "familia_fundadora", "familia_fundadora_json", "cas", "cas_tipus", "tipus_cas", "parts", "parts_fusio", "matriu", "matriu_spinoff", "d1", "d10"];

  function teCampsFundacio(src) {
    if (!src || typeof src !== "object") return false;
    return FUND_KEYS.some(function (k) { return src[k] != null && src[k] !== ""; });
  }

  function normalizeFundacio(raw) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
    var src = raw.fundacio && typeof raw.fundacio === "object" ? raw.fundacio : raw;
    if (!teCampsFundacio(src)) return null;
    var direct = collectPeople(src.fundadors != null ? src.fundadors : src.fundadors_json, "", "directe");
    var parts = asArray(src.parts || src.parts_fusio).map(function (part) {
      var entitat = part && (part.entitat || part.nom || part.empresa) || "";
      var isin = part && part.isin || "";
      return {
        entitat: entitat ? String(entitat) : "",
        isin: isin ? String(isin) : "",
        fundadors: collectPeople(part && (part.fundadors || part.fundadors_json), "D1", entitat || "part")
      };
    });
    var matriuRaw = src.matriu || src.matriu_spinoff || src.matriu_escissio || null;
    var matriu = null;
    if (matriuRaw && typeof matriuRaw === "object" && !Array.isArray(matriuRaw)) {
      matriu = {
        entitat: String(matriuRaw.entitat || matriuRaw.nom || ""),
        isin: String(matriuRaw.isin || ""),
        fundadors: collectPeople(matriuRaw.fundadors || matriuRaw.fundadors_json, "D10", matriuRaw.entitat || matriuRaw.nom || "matriu")
      };
    }
    var dataFont = src.data_fundacio != null && src.data_fundacio !== "" ? src.data_fundacio : src.any_fundacio;
    return {
      present: true,
      noReconegut: false,
      isin: src.isin || "",
      data_fundacio: dataFont == null ? null : dataFont,
      precisio_data: src.precisio_data || null,
      estat_final: src.estat_final || null,
      categoria_origen: src.categoria_origen || null,
      decisio: src.decisio == null ? null : src.decisio,
      aprovacio_jordi: src.aprovacio_jordi || null,
      robustesa_d10: src.robustesa_d10 || null,
      cas: casDe(src),
      fundadors: direct,
      parts: parts,
      matriu: matriu,
      familia: collectPeople(src.familia_fundadora != null ? src.familia_fundadora : src.familia_fundadora_json, "", "familia"),
      motiu: src.motiu || null,
      notes: src.notes || null,
      evidencies: collectEvidencies(src),
      principal: evidenciaPrincipal(src)
    };
  }

  function fundacioBuida() {
    return {
      present: true,
      noReconegut: true,
      data_fundacio: null,
      precisio_data: null,
      estat_final: null,
      categoria_origen: null,
      decisio: null,
      aprovacio_jordi: null,
      robustesa_d10: null,
      cas: { id: "sense_cas", label: "sense cas informat" },
      fundadors: [],
      parts: [],
      matriu: null,
      familia: [],
      motiu: null,
      notes: null,
      evidencies: [],
      principal: null
    };
  }

  function seleccionaFundacio(company, sidecar) {
    if (sidecar && typeof sidecar === "object") {
      return normalizeFundacio(sidecar) || fundacioBuida();
    }
    if (company && company.fundacio && typeof company.fundacio === "object") {
      return normalizeFundacio(company.fundacio) || fundacioBuida();
    }
    return null;
  }

  function decisioAplicada(f) {
    if (!f) return false;
    var d = f.decisio;
    if (d === true) return true;
    if (typeof d === "string" && /^(aplicada|aplicat)$/i.test(d.trim())) return true;
    return false;
  }

  function categoriaBuida(f) {
    if (!f) return false;
    var e = String(f.estat_final || "").toLowerCase();
    var c = String(f.categoria_origen || "").toLowerCase();
    return e === "estat" || e === "sense_persona" || c === "estat" || c === "sense_persona";
  }

  /* mode: calculat | previsualitzacio | robustesa_d10 */
  function conjuntDe(f, mode) {
    mode = mode || "calculat";
    if (!f || f.noReconegut) {
      return { mode: mode, usable: false, motiu: "sense_fitxer", persones: [], familia: [], exhaustiu: false, categoriaBuida: false, cas: "sense_fitxer" };
    }
    var cas = f.cas ? f.cas.id : "sense_cas";
    var especial = cas === "fusio" || cas === "spin_off";
    var applied = decisioAplicada(f);
    if (especial && !applied && mode === "calculat") {
      return { mode: mode, usable: false, motiu: "atribucio_no_aplicada", persones: [], familia: f.familia || [], exhaustiu: false, categoriaBuida: false, cas: cas };
    }
    if (cas === "spin_off" && mode === "robustesa_d10") {
      return { mode: mode, usable: true, motiu: "robustesa_sense_fundador", persones: [], familia: [], exhaustiu: true, categoriaBuida: true, cas: cas };
    }
    var persones = (f.fundadors || []).slice();
    if (cas === "fusio" && (applied || mode === "previsualitzacio")) {
      (f.parts || []).forEach(function (p) { persones = persones.concat(p.fundadors || []); });
    }
    if (cas === "spin_off" && (applied || mode === "previsualitzacio")) {
      if (f.matriu) persones = persones.concat(f.matriu.fundadors || []);
    }
    var buida = categoriaBuida(f);
    var estat = String(f.estat_final || "");
    var parcial = estat === "no_trobat" || estat === "criteri_pendent" || estat === "";
    var exhaustiu = estat === "resolta_cerca" || buida;
    if (estat === "resolta_cerca" && !persones.length && !(f.familia && f.familia.length)) {
      return { mode: mode, usable: false, motiu: "resolta_sense_noms", persones: [], familia: [], exhaustiu: false, categoriaBuida: false, cas: cas };
    }
    if (!persones.length && !(f.familia && f.familia.length) && !buida && !exhaustiu) {
      return { mode: mode, usable: false, motiu: "sense_noms", persones: persones, familia: f.familia || [], exhaustiu: false, categoriaBuida: false, cas: cas };
    }
    return {
      mode: mode,
      usable: true,
      motiu: parcial && !exhaustiu ? (estat || "parcial") : "ok",
      persones: persones,
      familia: f.familia || [],
      exhaustiu: exhaustiu,
      categoriaBuida: buida && persones.length === 0,
      cas: cas
    };
  }

  function etiquetaPersona(nom, conjunt) {
    if (!conjunt || !conjunt.usable) return "pendent";
    if (conjunt.motiu === "robustesa_sense_fundador") return "professional";
    var key = normalizeName(nom);
    if (!key) return "pendent";
    var hitF = (conjunt.persones || []).some(function (p) { return normalizeName(p.nom) === key; });
    if (hitF) return "fundador";
    var hitFam = (conjunt.familia || []).some(function (p) { return normalizeName(p.nom) === key; });
    if (hitFam) return "familia";
    if (conjunt.categoriaBuida) return "professional";
    if (conjunt.exhaustiu) return "professional";
    return "pendent";
  }

  /* Co-CEO: si algú és fundador, l'empresa-any és fundador.
     Si algú queda pendent i cap és fundador, l'empresa-any queda pendent. */
  function etiquetaGrup(noms, conjunt) {
    var llista = splitCeos(noms);
    if (!llista.length) return "pendent";
    var labs = llista.map(function (n) { return etiquetaPersona(n, conjunt); });
    if (labs.indexOf("fundador") !== -1) return "fundador";
    if (labs.indexOf("pendent") !== -1) return "pendent";
    if (labs.indexOf("familia") !== -1) return "familia";
    if (labs.every(function (x) { return x === "professional"; })) return "professional";
    return "pendent";
  }

  function aMostra(cell) {
    return cell === "C" || cell === "C+V";
  }

  function classeEstat(estat) {
    var s = String(estat || "").trim();
    if (!s) return "sense_estat";
    var l = s.toLowerCase().replace(/\s+/g, "_");
    if (l === "verificada_a") return "verificada_A";
    if (l === "verificada_b") return "verificada_B";
    if (l === "reculada_per_tinenca" || l === "reculada") return "reculada_per_tinenca";
    if (l === "no_trobat") return "no_trobat";
    if (l.indexOf("unclear") !== -1 || l.indexOf("no_clar") !== -1 || l === "dubtos" || l === "dubtosa") return "unclear";
    return "altre";
  }

  function motiuAny(c) {
    if (!c) return "";
    var m = c.motiu || c.rao || c.motiu_estat || c.notes;
    return isBlank(m) ? "" : String(m);
  }

  function tri(v) {
    if (v === true || v === 1 || v === "1") return "si";
    if (v === false || v === 0 || v === "0") return "no";
    return "no_consta";
  }

  function esWayback(url) {
    if (isBlank(url)) return false;
    return /https?:\/\/web\.archive\.org\//i.test(String(url).trim());
  }

  function classeArxiu(f) {
    if (!f || typeof f !== "object") return "absent";
    var wayback = esWayback(f.url_arxivada);
    var teUrl = !isBlank(f.url) || !isBlank(f.url_arxivada);
    if (f.arxiu_durable === true && wayback) return "durable";
    if (wayback && f.arxiu_durable !== true) return "wayback_sense_marca";
    if (teUrl) return "nomes_viva";
    return "absent";
  }

  function capturaPendent(f) {
    if (!f || typeof f !== "object") return false;
    if (classeArxiu(f) === "durable") return false;
    if (f.captura_pendent === true || f.arxiu_durable === false) return true;
    return !isBlank(f.url) && !esWayback(f.url_arxivada);
  }

  function limitsGantt(periodes) {
    var min = 2015;
    var max = 2025;
    var open = false;
    (periodes || []).forEach(function (p) {
      var i = parseData(p && p.inici);
      var f = parseData(p && p.fi);
      if (i.y) min = Math.min(min, i.y);
      if (f.y) max = Math.max(max, f.y);
      if (f.kind === "absent" && i.kind !== "absent") open = true;
    });
    return { start: min, end: Math.max(max, 2025) + (open ? 1 : 0.15), open: open };
  }

  function segmentsPeriode(p, chartStart, chartEnd) {
    var inici = parseData(p && p.inici);
    var fi = parseData(p && p.fi);
    if (inici.kind === "text" || fi.kind === "text") {
      return { inici: inici, fi: fi, segments: [], open: false, posicionable: false };
    }
    if (inici.kind === "absent" && fi.kind === "absent") {
      return { inici: inici, fi: fi, segments: [], open: false, posicionable: false };
    }
    var segs = [];
    var cursor = null;
    if (inici.kind === "any" || inici.kind === "mes") {
      segs.push({ a: axisPoint(inici, "start"), b: axisPoint(inici, "end"), style: "ratllat" });
      cursor = axisPoint(inici, "end");
    } else if (inici.kind === "dia") {
      cursor = axisPoint(inici, "start");
    } else if (inici.kind === "absent") {
      cursor = null;
    }
    var endPoint = null;
    var open = false;
    if (fi.kind === "absent") {
      endPoint = chartEnd;
      open = cursor != null;
    } else if (fi.kind === "dia") {
      endPoint = axisPoint(fi, "start");
    } else if (fi.kind === "any" || fi.kind === "mes") {
      endPoint = axisPoint(fi, "start");
    }
    if (cursor != null && endPoint != null && endPoint > cursor) {
      segs.push({ a: cursor, b: endPoint, style: open ? "obert" : "solid" });
    }
    if (fi.kind === "any" || fi.kind === "mes") {
      segs.push({ a: axisPoint(fi, "start"), b: axisPoint(fi, "end"), style: "ratllat" });
    }
    return { inici: inici, fi: fi, segments: segs, open: open, posicionable: segs.length > 0, fiExclusiva: !!(p && p.fi_exclusiva === true) };
  }

  function blankCounts() {
    return { n: 0, fundador: 0, familia: 0, professional: 0, pendent: 0, ambDossier: 0, ambFundacio: 0 };
  }

  function coincideixCas(filtre, cas) {
    if (!filtre) return true;
    var id = cas && cas.id ? cas.id : "sense_fitxer";
    return id === filtre;
  }

  function ceoPerAny(company) {
    var map = {};
    ((company && company.ceos) || []).forEach(function (c) {
      if (c && c.any != null) map[String(c.any)] = c;
    });
    return map;
  }

  function resumAgregat(opts) {
    var members = opts.members || [];
    var perIsin = opts.perIsin || {};
    var country = opts.country || "";
    var casFiltre = opts.cas || "";
    var mode = opts.mode || "calculat";
    var anyFocus = opts.any || "";
    var byYear = {};
    YEARS.forEach(function (y) { byYear[y] = blankCounts(); });
    var byCountry = {};
    function acumulaPais(pais, et, info, fund) {
      if (!byCountry[pais]) byCountry[pais] = blankCounts();
      byCountry[pais][et] += 1;
      byCountry[pais].n += 1;
      if (info && info.teDossier) byCountry[pais].ambDossier += 1;
      if (fund && !fund.noReconegut) byCountry[pais].ambFundacio += 1;
    }
    members.forEach(function (m) {
      if (country && m.pais !== country) return;
      var info = perIsin[m.isin] || null;
      var fund = info ? info.fundacio : null;
      var cas = fund ? fund.cas : { id: "sense_fitxer", label: "sense fitxer de fundadors" };
      if (!coincideixCas(casFiltre, cas)) return;
      var conjunt = conjuntDe(fund, mode);
      var pais = m.pais || "sense país";
      YEARS.forEach(function (y) {
        if (!aMostra(m[y])) return;
        var row = info && info.ceosByYear ? info.ceosByYear[y] : null;
        var et = row ? etiquetaGrup(row.ceo_31_10, conjunt) : "pendent";
        byYear[y][et] += 1;
        byYear[y].n += 1;
        if (info && info.teDossier) byYear[y].ambDossier += 1;
        if (fund && !fund.noReconegut) byYear[y].ambFundacio += 1;
        if (!anyFocus || String(anyFocus) === y) acumulaPais(pais, et, info, fund);
      });
    });
    return { byYear: byYear, byCountry: byCountry, anyFocus: anyFocus, mode: mode };
  }

  function pushFont(list, obj, meta) {
    if (!obj || typeof obj !== "object") return;
    var te = obj.url || obj.url_arxivada || obj.cita_literal || obj.nivell || obj.pagina;
    if (!te) return;
    list.push({
      obj: obj,
      isin: meta.isin,
      on: meta.on,
      classe: classeArxiu(obj),
      pendent: capturaPendent(obj)
    });
  }

  function fontsDe(company) {
    var list = [];
    if (!company) return list;
    var isin = company.isin || "";
    pushFont(list, company.informe_mes_recent, { isin: isin, on: "informe més recent" });
    (company.fonts_context || []).forEach(function (f, i) {
      pushFont(list, f, { isin: isin, on: "context " + (i + 1) });
    });
    (company.periodes_tinenca || []).forEach(function (p) {
      var nom = p && p.nom ? p.nom : "període";
      pushFont(list, p, { isin: isin, on: "tinença " + nom });
      if (p && p.font_inici) pushFont(list, p.font_inici, { isin: isin, on: "inici " + nom });
      if (p && p.font_fi) pushFont(list, p.font_fi, { isin: isin, on: "fi " + nom });
    });
    (company.ceos || []).forEach(function (c) {
      (c.fonts || []).forEach(function (f, i) {
        pushFont(list, f, { isin: isin, on: "CEO " + c.any + " · font " + (i + 1) });
      });
    });
    return list;
  }

  function clauFont(f) {
    var o = f.obj || {};
    return String(o.url || "") + " || " + String(o.url_arxivada || "");
  }

  function resumQualitat(companies, membersByIsin) {
    var estats = { verificada_A: 0, verificada_B: 0, reculada_per_tinenca: 0, no_trobat: 0, unclear: 0, sense_estat: 0, altre: 0 };
    var proxy = { si: 0, no: 0, no_consta: 0 };
    var canvi = { si: 0, no: 0, no_consta: 0 };
    var anys = [];
    var discrep = [];
    (companies || []).forEach(function (co) {
      var member = membersByIsin ? membersByIsin[co.isin] : null;
      (co.ceos || []).forEach(function (c) {
        var cl = classeEstat(c.estat);
        if (!estats[cl] && estats[cl] !== 0) estats[cl] = 0;
        estats[cl] += 1;
        var tp = tri(c.proxy_tancament);
        var tc = tri(c.canvi_entre_31_10_i_tancament);
        proxy[tp] += 1;
        canvi[tc] += 1;
        var rec = {
          isin: co.isin,
          nom: co.nom || "",
          any: c.any,
          estat: c.estat || "",
          classe: cl,
          proxy: tp,
          canvi: tc,
          motiu: motiuAny(c),
          ceo: c.ceo_31_10 || ""
        };
        anys.push(rec);
        if (member && (c.a_mostra === 0 || c.a_mostra === 1 || c.a_mostra === true || c.a_mostra === false)) {
          var inS = aMostra(member[String(c.any)]);
          var flag = c.a_mostra === 1 || c.a_mostra === true;
          if (flag !== inS) {
            discrep.push({
              isin: co.isin,
              any: c.any,
              a_mostra: c.a_mostra,
              cel: member[String(c.any)] || "",
              text: flag
                ? "El dossier marca a_mostra i la graella no és C ni C+V."
                : "La graella és C o C+V i el dossier marca a_mostra 0."
            });
          }
        }
      });
    });
    var fonts = [];
    (companies || []).forEach(function (co) { fonts = fonts.concat(fontsDe(co)); });
    var registres = { durable: 0, wayback_sense_marca: 0, nomes_viva: 0, absent: 0, pendent: 0 };
    fonts.forEach(function (f) {
      registres[f.classe] = (registres[f.classe] || 0) + 1;
      if (f.pendent) registres.pendent += 1;
    });
    var uniq = {};
    fonts.forEach(function (f) {
      var k = clauFont(f);
      if (!uniq[k]) uniq[k] = { classe: f.classe, mixt: false, n: 0, pendent: f.pendent, obj: f.obj, isin: f.isin, on: [f.on] };
      else {
        uniq[k].n += 0;
        if (uniq[k].classe !== f.classe) uniq[k].mixt = true;
        var rank = { absent: 0, nomes_viva: 1, wayback_sense_marca: 2, durable: 3 };
        if ((rank[f.classe] || 0) > (rank[uniq[k].classe] || 0)) uniq[k].classe = f.classe;
        if (f.pendent) uniq[k].pendent = true;
        uniq[k].on.push(f.on);
      }
      uniq[k].n += 1;
    });
    var uniques = { durable: 0, wayback_sense_marca: 0, nomes_viva: 0, absent: 0, pendent: 0, mixt: 0, n: 0 };
    Object.keys(uniq).forEach(function (k) {
      var u = uniq[k];
      uniques[u.classe] = (uniques[u.classe] || 0) + 1;
      uniques.n += 1;
      if (u.pendent) uniques.pendent += 1;
      if (u.mixt) uniques.mixt += 1;
    });
    return { estats: estats, proxy: proxy, canvi: canvi, anys: anys, discrep: discrep, registres: registres, uniques: uniques, fonts: fonts, uniq: uniq };
  }

  function pct(part, total) {
    if (!total) return 0;
    return 100 * part / total;
  }

  return {
    YEARS: YEARS,
    CLASSES: CLASSES,
    isBlank: isBlank,
    parseData: parseData,
    axisPoint: axisPoint,
    normalizeName: normalizeName,
    splitCeos: splitCeos,
    casDe: casDe,
    normalizeFundacio: normalizeFundacio,
    seleccionaFundacio: seleccionaFundacio,
    conjuntDe: conjuntDe,
    etiquetaPersona: etiquetaPersona,
    etiquetaGrup: etiquetaGrup,
    aMostra: aMostra,
    classeEstat: classeEstat,
    motiuAny: motiuAny,
    tri: tri,
    esWayback: esWayback,
    classeArxiu: classeArxiu,
    capturaPendent: capturaPendent,
    limitsGantt: limitsGantt,
    segmentsPeriode: segmentsPeriode,
    resumAgregat: resumAgregat,
    resumQualitat: resumQualitat,
    fontsDe: fontsDe,
    ceoPerAny: ceoPerAny,
    pct: pct,
    decisioAplicada: decisioAplicada
  };
});
