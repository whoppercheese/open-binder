# README-Screenshots aktualisieren

Vollautomatisierter Ablauf: **Daten vorbereiten per Skript**, **Screenshots per Browser-Automation**. Keine manuellen Sync-Schritte, keine Collection-IDs abtippen.

---

## Einmalige Voraussetzung

Nur diese zwei Prozesse müssen laufen (Port standardmäßig **3000**):

```bash
npm run dev
npm run worker
```

Optional: `APP_URL=http://localhost:3000` setzen, falls abweichend.

---

## Schritt 0 — Next.js Dev-Indikatoren ausblenden (temporär)

Vor den Screenshots den Next.js-Dev-Badge (z. B. „N“ unten links) ausblenden, sonst landet er auf den PNGs.

In `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  devIndicators: false,
  // …
};
```

**Dev-Server neu starten** (`npm run dev`), damit die Änderung greift.

Nach den Screenshots **`devIndicators: false` wieder entfernen** (oder auf den vorherigen Wert zurücksetzen) und erneut neu starten — die Einstellung ist nur für die Aufnahme gedacht.

---

## Schritt 1 — Daten automatisch vorbereiten

```bash
node scripts/prepare-readme-screenshots.mjs
```

Das Skript erledigt **alles** in dieser Reihenfolge:

1. **App erreichbar?** — wartet bis `GET /api/sync/active` antwortet
2. **Catalog-Sets** — startet Catalog-Sync falls nötig; prüft dass diese Sets existieren:
   - `me02.5`, `gym2`, `gym1`, `base3`, `base2`, `base1`
3. **Karten laden** — queued/fehlt Cards-Sync für alle obigen Sets; wartet bis `cardsSyncedAt` gesetzt ist
4. **Demo-Daten seeden** — ruft `scripts/seed-readme-demo.mjs` auf (Collections + Inventory laut Definition dort)
5. **Manifest schreiben** — `docs/screenshots/manifest.json` mit URLs, Collection-IDs und Screenshot-Aktionen

Bei Timeout: Worker läuft vermutlich nicht (`npm run worker`).

Falls Sets nach Catalog-Sync fehlen: `CATALOG_SET_IDS` in `.env` ergänzen (Worker neu starten). Das Skript meldet welche IDs fehlen.

### Geseedete Demo-Daten (Definition in `seed-readme-demo.mjs`)

| Collection | Typ | Set | Ziel |
| --- | --- | --- | --- |
| Base Set Master | set | `base1` | ~24/102 (24 %) |
| Gym Heroes | set | `gym1` | ~7/132 (5 %) |
| Ascended Heroes | set | `me02.5` | ~42 % |
| Graded Chase Cards | custom | — | 3/3 (100 %) |

Charizard (`base1-4`) erhält zwei Inventory-Einträge (Holo + 1st Ed) mit Notizen — relevant für Screenshots 07–09.

---

## Schritt 2 — Screenshots aufnehmen (Browser-Automation)

**Voraussetzung:** Schritt 0 erledigt (`devIndicators: false`, Dev-Server neu gestartet).

Manifest lesen: `docs/screenshots/manifest.json`

### Technische Vorgaben (aus Manifest)

| Einstellung | Wert |
| --- | --- |
| Viewport | iPhone 16: `393x852x3,mobile,touch` |
| PNG-Größe | **1179 × 2556 px** (viewport-only, kein fullPage) |
| Sprache | Englisch (`ui_language=en` Cookie via `initScript`) |
| Ausgabe | `docs/screenshots/<file>` |

### Ablauf pro Screenshot

Für jeden Eintrag in `manifest.screenshots`:

1. Viewport + Dark Mode setzen (falls noch nicht aktiv)
2. `initScript` aus Manifest ausführen
3. Optional `clearSessionStorage`-Keys leeren
4. Zu `appUrl + url` navigieren
5. `actions` der Reihe nach ausführen (Klicks, Suche, Warten)
6. Viewport-Screenshot nach `docs/screenshots/<file>` speichern
7. Prüfen: `1179×2556 px`

### Screenshot-Übersicht

| # | Datei | Besonderheit |
| --- | --- | --- |
| 01 | `01-dashboard.png` | Dashboard mit Portfolio |
| 02 | `02-sets.png` | Keine Filter |
| 03 | `03-set-detail.png` | `/sets/base1` |
| 04 | `04-card-preview.png` | Charizard → Preview-Modal |
| 05 | `05-search.png` | **Search all sets** + Query `charizard` |
| 06 | `06-collections.png` | Alle 4 Collections |
| 07 | `07-collection-checklist.png` | Filter **In inventory** |
| 08 | `08-card-modal.png` | Charizard → Card-Modal |
| 09 | `09-collection-inventory.png` | Tab Inventory |
| 10 | `10-custom-collection.png` | Graded Chase Cards |

Alle Screenshots in **einer Browser-Session**.

**Danach:** `devIndicators: false` in `next.config.ts` rückgängig machen (Schritt 0).

---

## Schritt 3 — Qualitätskontrolle

```bash
python3 - <<'PY'
from pathlib import Path
from PIL import Image
sizes = {Image.open(p).size for p in Path("docs/screenshots").glob("[0-9]*.png")}
print("Einheitlich:", len(sizes) == 1, sizes)
PY
```

Erwartung: `{(1179, 2556)}`.

---

## AI-Prompt (Copy & Paste)

```markdown
Aktualisiere alle README-Screenshots für OpenBinder. Keine manuellen Schritte.

## 1. Voraussetzungen prüfen
- App auf http://localhost:3000 (npm run dev)
- Worker läuft (npm run worker)
- Falls nicht: starten und warten bis erreichbar

## 1b. Dev-Indikatoren aus (temporär)
- In `next.config.ts`: `devIndicators: false` setzen
- `npm run dev` neu starten
- Nach allen Screenshots: Einstellung wieder entfernen/zurücksetzen und Dev-Server neu starten

## 2. Daten vorbereiten (automatisch)

    node scripts/prepare-readme-screenshots.mjs

- Synced Catalog + Karten für: me02.5, gym2, gym1, base3, base2, base1
- Seeded Demo-Collections via seed-readme-demo.mjs
- Schreibt docs/screenshots/manifest.json

Bei Fehler: Fehlermeldung des Skripts beheben (meist Worker oder CATALOG_SET_IDS).

## 3. Screenshots (Browser-Automation)
- `docs/screenshots/manifest.json` lesen
- iPhone-16-Viewport: 393x852x3,mobile,touch, dark mode
- Alle Einträge in `manifest.screenshots` in **einer Session** abarbeiten
- Viewport-only Screenshots (1179×2556 px) nach docs/screenshots/
- `initScript`, `clearSessionStorage` und `actions` aus Manifest befolgen
- Search-Screenshot: Filter „Search all sets“ aktiv + Suche „charizard“ (steht im Manifest)

## 4. Abschluss
- PNG-Größen prüfen (alle 1179×2556)
- `devIndicators: false` in `next.config.ts` rückgängig machen
- README.md nur ändern wenn Pfade/Beschriftungen abweichen
- Kurz berichten was neu aufgenommen wurde
```

---

## Einzelne Screenshots

Immer zuerst `node scripts/prepare-readme-screenshots.mjs`, dann nur die gewünschten Einträge aus `manifest.screenshots` fotografieren.

Beispiel-Prompt:

```markdown
Bereite README-Screenshot-Daten vor (`node scripts/prepare-readme-screenshots.mjs`) und
aktualisiere nur 01-dashboard.png und 06-collections.png laut docs/update-readme-screenshots.md.
```

---

## README-Referenz

Screenshot-Tabelle in `README.md` — Layout **4 Spalten** pro Zeile:

```
01-dashboard.png      06-collections.png
02-sets.png           07-collection-checklist.png
03-set-detail.png     08-card-modal.png
04-card-preview.png   09-collection-inventory.png
05-search.png         10-custom-collection.png
```
