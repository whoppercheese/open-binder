# Terminologie-Policy

Diese Policy definiert verbindliche Begriffe fuer UI-Texte in OpenBinder.
Ziel ist ein konsistentes Wording mit klarer Trennung von Ziel-Sammeln und Besitz.

## 1) Kernbegriffe (verbindlich)

- DE Container: `Sammelordner`
- EN Container: `Binder`
- DE Ziel-Liste: `Sammelliste`
- EN Ziel-Liste: `Checklist`
- DE Besitz: `Bestand`
- EN Besitz: `Inventory`

## 2) Konzepttrennung

- `Sammelliste` beschreibt, **was gesammelt werden soll**.
- `Bestand` beschreibt, **was tatsaechlich vorhanden ist**.
- Ein `Sammelordner`/`Binder` enthaelt beide Ebenen.

## 3) Verben pro Ebene

- Sammelliste-Aktionen:
  - `zur Sammelliste hinzufuegen`
  - `aus Sammelliste entfernen`
  - EN: `add to checklist`, `remove from checklist`
- Bestand-Aktionen:
  - `im Bestand eintragen`
  - `im Bestand` (Status-/Toast-Formulierung)
  - `eingetragen` (Partizip statt `erfasst`)
  - `Bestandseintrag loeschen`
  - EN: `add to inventory`, `delete inventory entry`

## 4) Schreibregeln

- In DE immer `Sammelordner`, nicht `Ordner` oder `Sammlung`.
- In DE fuer Besitzvorgaenge `eintragen/eingetragen` verwenden, nicht `erfassen/erfasst`.
- In EN fuer den Container immer `Binder`, nicht `Collection`.
- Keys im Code koennen historisch `collection` bleiben; die Policy gilt fuer die sichtbaren Texte.
- Keine Mischformen innerhalb derselben Nachricht (z. B. `Sammelordner` + `Collection`).

## 5) Do / Don't

- Do: `Karten zur Sammelliste hinzufuegen`
- Don't: `Karten zur Sammlung hinzufuegen`

- Do: `Im Bestand eintragen`
- Don't: `Zum Ordner hinzufuegen` (mehrdeutig: Liste vs. Besitz)

- Do: `zuletzt eingetragen` / `nichts im Bestand`
- Don't: `zuletzt erfasst` / `nichts erfasst`

- Do: `Sammelliste | Bestand` (Tabs)
- Don't: `Checkliste | Bestand` in DE

## 6) Qualitaetscheck vor Merge

- DE-Scan auf verbotene Begriffe: `Sammlung`, `Checkliste`, `Ordner` (ohne `Sammelordner`), `erfassen`, `erfasst`
- EN-Scan auf `Collection/Collections` fuer sichtbare UI-Texte
- Neue Strings immer gegen diese Policy pruefen
