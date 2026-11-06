# Arxiu d'evidència CEO (prova de 3 empreses)

Data d'arxiu: 6/11/2026 (Europe/Madrid). Protocol: v1.2.0. Fase: CEO (encara no FounderCEO).

Aquesta carpeta guarda **què s'ha preguntat i què s'ha trobat** per a les tres primeres empreses del lot de prova, de manera que es pugui auditar sense descarregar els PDF complets.

## Com està organitzat

```
evidencia/ceo/
  LLEGIRME.md                 ← aquest fitxer
  GB00B1YW4409/               ← una carpeta per ISIN de referència
    README.md                 ← resum humà: què s'ha fet, tinences, límits
    resultat.json             ← JSON rígid tornat per ChatGPT (sense retocar)
    resposta_chatgpt.raw.txt  ← text brut de la resposta
    extractes.json            ← catàleg d'extractes: URL, pàgina, cita, hash
    extractes/                ← només la pàgina o paràgraf citat (.txt)
  DK0010244508/
  IT0001233417/
```

La clau és l'`ISIN de referència`. El nom comercial pot canviar; l'ISIN no es duplica.

## Què és cada camp d'`extractes.json`

- `url`: enllaç a l'informe o comunicat complet (es deixa a la web de l'empresa; no es guarda l'PDF sencer).
- `pagina_citada` / `pagina_observada`: pàgina que va citar ChatGPT i pàgina on ho hem vist en baixar el document.
- `cita_literal`: frase reclamada.
- `data_captura`: dia en què vam baixar el document (aquí, 2026-11-06).
- `sha256`: SHA-256 del fitxer d'extracte (UTF-8), no de l'PDF sencer.
- `verificacio`: `cita_trobada_al_pdf` o `cita_trobada_al_html` si la cita hi era; `no_baixat_http_403` si no hem pogut baixar la font.

## Què no afirma aquest arxiu

- `verificada_A` a cada any de `resultat.json` vol dir que la identitat i la tinença tenen font A. No vol dir que s'hagi obert l'informe de cada exercici per comprovar un canvi entre el 31/10 i el tancament.
- Un any reculat per tinença (D21) cita l'informe més recent o el comunicat de nomenament, no necessàriament l'informe d'aquell any.
- Les cites de Maersk encara no tenen extracte propi (HTTP 403).

## Procedència
Cerques fetes a ChatGPT (projecte Fundadors) el 6/11/2026. Després, comprovació independent de les URL citades i arxiu d'extractes amb hash.
