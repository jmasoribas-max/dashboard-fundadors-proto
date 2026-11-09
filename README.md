# Dashboard Fundadors

Prototip estàtic (GitHub Pages) de la base de fundadors i CEO a l'STOXX Europe 600. Jordi Masó Ribas, Universitat de Girona. La interfície és en català.

La graella de pertinença a l'ETF ve de `members.json` (un ISIN de referència per fila, talls del 31 d'octubre de 2015 a 2025). Els fitxers d'empresa i de fundadors, quan s'hi afegeixen, omplen la fitxa, la vista agregada i la qualitat. No hi ha servidor ni serveis de pagament.

## Veure'l en local

```bash
python3 -m http.server 8765
```

Obre `http://127.0.0.1:8765/`. Cal servir-lo per HTTP: el navegador no llegeix els JSON amb `file://`.

## Contracte de dades

Després d'afegir o treure un JSON:

```bash
python3 scripts/build_index.py
```

L'script escriu `data/index.json`. Comprova que l'arrel és un objecte i que el camp `isin` (o `isin_cua`, als fundadors) coincideix amb el nom del fitxer. Si no, s'atura i no publica un índex a mitges.

### Empresa (CEO)

Camí: `data/empreses/{ISIN}.json`

És el dossier de CEO, amb les claus que ja porten els fitxers de mostra: `isin`, `nom`, `informe_mes_recent`, `periodes_tinenca`, `ceos`, `cerques_fetas`, `notes_metodologiques`. Dins de cada any de `ceos`: `any`, `a_mostra`, `ceo_31_10`, `ceo_tancament_fy`, `proxy_tancament`, `canvi_entre_31_10_i_tancament`, `fy_que_cobreix`, `ceo_since`, `estat`, `nivell_max`, `fonts`.

Un camp que falti es mostra com a pendent o no consta. No es completa cap data, ni es calcula un SHA-256, ni es marca una URL viva com a Wayback.

Els tres fitxers actuals són una mostra real (Deutsche Post, Ackermans & van Haaren, ACS). La resta de l'univers segueix sense fitxer.

### Fundadors

Camí preferit: `data/fundadors/{ISIN}.json`

També s'accepta un bloc `fundacio` dins el JSON d'empresa. Si hi ha els dos, es llegeix el fitxer de `data/fundadors/` i no es mescla amb el bloc.

Camps que el dashboard reconeix, els del pack de cerca:

- `fundadors` o `fundadors_json` (llista de noms, o objectes `{nom, tipus}`)
- `familia_fundadora` o `familia_fundadora_json`
- `data_fundacio` o `any_fundacio`, i `precisio_data` (`any` si només hi ha l'any)
- `estat_final`: `resolta_cerca`, `estat`, `sense_persona`, `no_trobat`, `criteri_pendent`
- `categoria_origen`: `persona`, `Estat`, `sense_persona`
- `cas` o `cas_tipus`: `fusio`, `spin_off`, `estat`
- `parts` o `parts_fusio`: `{entitat, isin, fundadors}` per a D1
- `matriu` o `matriu_spinoff`: `{entitat, isin, fundadors}` per a D10
- `decisio`: es deixa buit fins que Jordi i el doctorat l'apliquin. Només `aplicada` fa servir els fundadors de les parts o de la matriu en el càlcul.
- `robustesa_d10`: `sense_fundador` quan pertoqui
- evidència: `url`, `url_arxivada`, `http_status`, `cita_literal`, `pagina` o `localitzador`, `data_document`, `sha256` (o `sha256_document` / `sha256_extracte`), `tipus_font`, `nivell`, `arxiu_durable`, `captura_pendent`, `error_acces`
- llistes `evidencies`, `evidencies_fundador_json`, `evidencies_any_json`

`fundadors_json` pot ser una llista o un text JSON. Un nom sense `tipus` es mostra com a tipus pendent.

Mentre `decisio` no sigui `aplicada`, una fusió (D1) o un spin-off (D10) no transfereix fundadors a l'etiqueta de l'ISIN. La vista agregada té una previsualització, etiquetada com a tal, i una robustesa D10 «sense fundador».

## Què es calcula

- La mostra: cel·la C o C+V. V sola no hi entra.
- Recomptes per any i per país sobre tota la mostra, no només sobre els fitxers ja fets.
- Etiqueta del CEO al 31/10, només si hi ha fundadors utilitzables: fundador, família fundadora, professional o pendent. Sense fitxer, pendent.
- La coincidència de noms és pel nom sencer, sense deduir cognoms.
- Si hi ha co-CEO i un és fundador, l'empresa-any compta com a fundador. Si algú queda pendent i cap és fundador, l'empresa-any queda pendent. És una regla d'aquest dashboard, citada a la pàgina de metodologia com a provisional.
- Qualitat: estat dels anys (`verificada_A`, `verificada_B`, `reculada_per_tinenca`, `no_trobat`, no clar), proxy, canvi, i si la URL arxivada és una captura de Wayback amb `arxiu_durable` cert.

## Què no fa

No inventa fundadors, anys, hashes ni URL. No recalcula el CEO del 31/10 a partir de la tinença. No aplica D1 ni D10 sense `decisio: aplicada`. No dóna per verificada una URL viva. Els tres JSON de CEO de la mostra no porten SHA-256: la fitxa ho diu.

`node scripts/test_rules.cjs` comprova aquestes regles, amb casos sintètics i amb els tres fitxers reals.
