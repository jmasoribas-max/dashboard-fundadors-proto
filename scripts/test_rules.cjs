"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const R = require("../assets/rules.js");

const root = path.resolve(__dirname, "..");

function fund(partial) {
  return R.normalizeFundacio(Object.assign({ isin: "XX0000000000" }, partial));
}

assert.strictEqual(R.parseData(null).label, "no consta");
assert.strictEqual(R.parseData("").kind, "absent");
assert.strictEqual(R.parseData("1990").kind, "any");
assert.ok(R.parseData("1990").label.indexOf("només any") !== -1);
assert.ok(R.parseData("1990").label.indexOf("01-01") === -1);
assert.strictEqual(R.parseData("2016-05").kind, "mes");
assert.strictEqual(R.parseData("2016-05-23").kind, "dia");
assert.strictEqual(R.parseData("2016-05-23").label, "2016-05-23");
assert.strictEqual(R.parseData(1997).kind, "any");

assert.deepStrictEqual(R.splitCeos("John-Eric Bertrand / Piet Dejonghe"), [
  "John-Eric Bertrand",
  "Piet Dejonghe"
]);
assert.strictEqual(R.normalizeName("Dr. Tobias Meyer"), R.normalizeName("tobias meyer"));
assert.notStrictEqual(R.normalizeName("Meyer"), R.normalizeName("Tobias Meyer"));

const directa = fund({
  estat_final: "resolta_cerca",
  categoria_origen: "persona",
  data_fundacio: "1990",
  precisio_data: "any",
  fundadors: ["Luc Bertrand", { nom: "Dr. Alícia Font", tipus: "persona" }],
  familia_fundadora: ["Jan Bertrand"]
});
const conj = R.conjuntDe(directa, "calculat");
assert.strictEqual(R.etiquetaPersona("Luc Bertrand", conj), "fundador");
assert.strictEqual(R.etiquetaPersona("Alícia Font", conj), "fundador");
assert.strictEqual(R.etiquetaPersona("Jan Bertrand", conj), "familia");
assert.strictEqual(R.etiquetaPersona("Piet Dejonghe", conj), "professional");
assert.strictEqual(R.etiquetaGrup("Luc Bertrand / Piet Dejonghe", conj), "fundador");
assert.strictEqual(R.etiquetaGrup("", conj), "pendent");

assert.strictEqual(R.etiquetaPersona("Qualsevol", R.conjuntDe(null, "calculat")), "pendent");
const resoltaBuida = fund({ estat_final: "resolta_cerca", fundadors: [] });
assert.strictEqual(R.conjuntDe(resoltaBuida, "calculat").usable, false);
assert.strictEqual(R.etiquetaPersona("Un CEO", R.conjuntDe(resoltaBuida, "calculat")), "pendent");

const parcial = fund({
  estat_final: "no_trobat",
  motiu: "falta l'any",
  fundadors_json: "[\"Anna Costa\"]"
});
const conjP = R.conjuntDe(parcial, "calculat");
assert.strictEqual(R.etiquetaPersona("Anna Costa", conjP), "fundador");
assert.strictEqual(R.etiquetaPersona("Una Altra", conjP), "pendent");

const estatal = fund({ estat_final: "estat", categoria_origen: "Estat", fundadors: [] });
assert.strictEqual(estatal.cas.id, "estat");
assert.strictEqual(R.etiquetaPersona("Un CEO", R.conjuntDe(estatal, "calculat")), "professional");

const fusio = fund({
  cas: "fusio",
  decisio: null,
  estat_final: "criteri_pendent",
  parts: [
    { entitat: "A", fundadors: [{ nom: "Fundador A", tipus: "persona" }] },
    { entitat: "B", fundadors: ["Fundador B"] }
  ]
});
assert.strictEqual(fusio.cas.id, "fusio");
assert.strictEqual(fusio.parts[0].fundadors[0].bandera, "D1");
assert.strictEqual(R.etiquetaPersona("Fundador A", R.conjuntDe(fusio, "calculat")), "pendent");
assert.strictEqual(R.etiquetaPersona("Fundador A", R.conjuntDe(fusio, "previsualitzacio")), "fundador");
const aplicada = fund({
  cas: "fusio",
  decisio: "aplicada",
  estat_final: "resolta_cerca",
  parts: [{ entitat: "A", fundadors: ["Fundador A"] }]
});
assert.strictEqual(R.etiquetaPersona("Fundador A", R.conjuntDe(aplicada, "calculat")), "fundador");
assert.strictEqual(R.etiquetaPersona("Professional", R.conjuntDe(aplicada, "calculat")), "professional");

const spin = fund({
  cas: "spin_off",
  decisio: null,
  estat_final: "criteri_pendent",
  matriu: { entitat: "Mare", fundadors: [{ nom: "Fundador Mare", tipus: "persona" }] },
  robustesa_d10: "sense_fundador"
});
assert.strictEqual(spin.matriu.fundadors[0].bandera, "D10");
assert.strictEqual(R.etiquetaPersona("Fundador Mare", R.conjuntDe(spin, "calculat")), "pendent");
assert.strictEqual(R.etiquetaPersona("Fundador Mare", R.conjuntDe(spin, "previsualitzacio")), "fundador");
assert.strictEqual(R.etiquetaPersona("Fundador Mare", R.conjuntDe(spin, "robustesa_d10")), "professional");

const buit = R.seleccionaFundacio(null, { isin: "XX0000000000", notes: "res" });
assert.strictEqual(buit.noReconegut, true);
assert.strictEqual(R.seleccionaFundacio({ isin: "DE", ceos: [] }, null), null);

assert.strictEqual(R.classeArxiu({
  url: "https://exemple.invalid/a.pdf",
  url_arxivada: "https://web.archive.org/web/20261107091154/https://exemple.invalid/a.pdf",
  arxiu_durable: true
}), "durable");
assert.strictEqual(R.classeArxiu({
  url: "https://exemple.invalid/a.pdf",
  url_arxivada: "https://exemple.invalid/a.pdf",
  arxiu_durable: false
}), "nomes_viva");
assert.strictEqual(R.esWayback("https://exemple.invalid/a.pdf"), false);
assert.strictEqual(R.capturaPendent({ url: "https://exemple.invalid/a.pdf", arxiu_durable: false }), true);
assert.strictEqual(R.capturaPendent({
  url: "https://exemple.invalid/a.pdf",
  url_arxivada: "https://web.archive.org/web/2020/https://exemple.invalid/a.pdf",
  arxiu_durable: true
}), false);

const limits = R.limitsGantt([
  { inici: "1990", fi: "2016-05-23" },
  { inici: "2022-05-23", fi: null }
]);
assert.strictEqual(limits.start, 1990);
assert.strictEqual(limits.open, true);
const seg = R.segmentsPeriode({ inici: "1990", fi: "2016-05-23", fi_exclusiva: true }, limits.start, limits.end);
assert.strictEqual(seg.inici.kind, "any");
assert.strictEqual(seg.fi.kind, "dia");
assert.ok(seg.segments.some(function (s) { return s.style === "ratllat" && s.a === 1990 && s.b === 1991; }));
assert.ok(seg.segments.some(function (s) { return s.style === "solid"; }));
assert.strictEqual(seg.fiExclusiva, true);
const obert = R.segmentsPeriode({ inici: "2023-05-04", fi: null }, 2008, 2026);
assert.strictEqual(obert.open, true);
assert.ok(obert.segments.every(function (s) { return s.style !== "ratllat"; }));
const senseDia = R.segmentsPeriode({ inici: "no consta el dia", fi: "2010" }, 2000, 2016);
assert.strictEqual(senseDia.posicionable, false);

const members = [
  { isin: "A", pais: "ES", 2015: "C", 2016: "V", 2017: "C+V", 2018: "", 2019: "C", 2020: "C", 2021: "C", 2022: "C", 2023: "C", 2024: "C", 2025: "C" },
  { isin: "B", pais: "DE", 2015: "C", 2016: "C", 2017: "C", 2018: "C", 2019: "C", 2020: "C", 2021: "C", 2022: "C", 2023: "C", 2024: "C", 2025: "C" }
];
const perIsin = {
  A: {
    teDossier: true,
    fundacio: directa,
    ceosByYear: { 2015: { ceo_31_10: "Luc Bertrand" }, 2017: { ceo_31_10: "Piet Dejonghe" }, 2025: { ceo_31_10: "Jan Bertrand" } }
  }
};
const ag = R.resumAgregat({ members: members, perIsin: perIsin, any: "2015", mode: "calculat" });
assert.strictEqual(ag.byYear["2015"].n, 2);
assert.strictEqual(ag.byYear["2015"].fundador, 1);
assert.strictEqual(ag.byYear["2015"].pendent, 1);
assert.strictEqual(ag.byYear["2016"].n, 1);
assert.strictEqual(ag.byCountry.ES.fundador, 1);
assert.strictEqual(ag.byCountry.ES.n, 1);
assert.strictEqual(ag.byCountry.DE.pendent, 1);
const agCas = R.resumAgregat({ members: members, perIsin: perIsin, cas: "fusio", mode: "calculat" });
assert.strictEqual(agCas.byYear["2015"].n, 0);

const files = ["DE0005552004", "BE0003764785", "ES0167050915"].map(function (isin) {
  return JSON.parse(fs.readFileSync(path.join(root, "data/empreses", isin + ".json"), "utf8"));
});
files.forEach(function (d) {
  assert.strictEqual(R.seleccionaFundacio(d, null), null);
  assert.ok(!JSON.stringify(d).match(/DADA D'EXEMPLE/));
  assert.ok(!JSON.stringify(d).match(/0000000000000000000000000000000000000000000000000000000000000000/));
});
const q = R.resumQualitat(files, {});
assert.strictEqual(q.anys.length, 33);
assert.strictEqual(q.estats.verificada_A, 29);
assert.strictEqual(q.estats.verificada_B, 0);
assert.strictEqual(q.estats.reculada_per_tinenca, 4);
assert.strictEqual(q.estats.no_trobat, 0);
assert.strictEqual(q.estats.unclear, 0);
assert.strictEqual(q.proxy.si, 20);
assert.strictEqual(q.proxy.no, 13);
assert.strictEqual(q.canvi.si, 0);
assert.strictEqual(q.canvi.no, 29);
assert.strictEqual(q.canvi.no_consta, 4);
assert.ok(q.uniques.durable > 0);
assert.ok(q.uniques.nomes_viva > 0);
assert.ok(q.uniques.pendent > 0);
const recul = q.anys.filter(function (a) { return a.classe === "reculada_per_tinenca"; });
assert.ok(recul.every(function (a) { return a.motiu === "" && a.isin === "BE0003764785"; }));

const perReal = {};
files.forEach(function (d) {
  perReal[d.isin] = { teDossier: true, fundacio: null, ceosByYear: R.ceoPerAny(d) };
});
const membresReals = files.map(function (d) {
  const row = { isin: d.isin, pais: "XX" };
  R.YEARS.forEach(function (y) { row[y] = "C"; });
  return row;
});
const agReal = R.resumAgregat({ members: membresReals, perIsin: perReal, any: "2024", mode: "calculat" });
assert.strictEqual(agReal.byYear["2024"].pendent, 3);
assert.strictEqual(agReal.byYear["2024"].fundador, 0);
assert.strictEqual(agReal.byYear["2024"].professional, 0);
assert.strictEqual(agReal.byYear["2024"].familia, 0);

const avh = files[1];
const luc = avh.periodes_tinenca[0];
assert.strictEqual(luc.inici, "1990");
assert.strictEqual(R.parseData(luc.inici).kind, "any");
const acs = files[2];
const y2021 = acs.ceos.filter(function (c) { return c.any === 2021; })[0];
assert.strictEqual(R.parseData(y2021.ceo_since).kind, "absent");

console.log("tests ok", {
  anys: q.anys.length,
  verificada_A: q.estats.verificada_A,
  reculada: q.estats.reculada_per_tinenca,
  proxy: q.proxy,
  uniques: q.uniques,
  registres: q.registres
});
