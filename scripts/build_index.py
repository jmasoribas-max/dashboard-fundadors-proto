#!/usr/bin/env python3
"""Construeix data/index.json a partir dels JSON aprovats.

No inventa camps. Comprova que l'ISIN del contingut coincideix amb el nom
del fitxer. S'ha de tornar a executar després d'afegir o treure un JSON.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EMPRESES = ROOT / "data" / "empreses"
FUNDADORS = ROOT / "data" / "fundadors"
OUT = ROOT / "data" / "index.json"


def load(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def collect(directory: Path, kind: str) -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    errors: list[str] = []
    if not directory.exists():
        return rows, errors
    for path in sorted(directory.glob("*.json")):
        try:
            data = load(path)
        except json.JSONDecodeError as exc:
            errors.append(f"{kind}/{path.name}: JSON invàlid ({exc})")
            continue
        if not isinstance(data, dict):
            errors.append(f"{kind}/{path.name}: l'arrel ha de ser un objecte")
            continue
        isin = data.get("isin") or data.get("isin_cua")
        if isin != path.stem:
            errors.append(
                f"{kind}/{path.name}: l'ISIN ({isin}) no coincideix amb el nom del fitxer"
            )
            continue
        nom = data.get("nom") or data.get("empresa") or data.get("nom_cua") or ""
        rows.append(
            {
                "isin": isin,
                "nom": nom,
                "path": f"data/{kind}/{path.name}",
            }
        )
    return rows, errors


def main() -> int:
    empreses, err_e = collect(EMPRESES, "empreses")
    fundadors, err_f = collect(FUNDADORS, "fundadors")
    errors = err_e + err_f
    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        return 1
    payload = {
        "generat_per": "scripts/build_index.py",
        "nota": (
            "Índex dels fitxers presents. No conté fundadors ni evidències. "
            "Torna a executar l'script després d'afegir o treure un JSON."
        ),
        "empreses": empreses,
        "fundadors": fundadors,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(empreses)} empreses, {len(fundadors)} fundadors -> {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
