# IHCO Guide – Hitchhiker's Guide to the [IHCO] Galaxy

> *"Don't Panic."* – Douglas Adams

## ⚠️ Disclaimer
Privates Fan-Projekt, nicht affiliiert mit Frontier Developments.
Elite Dangerous ist ein Trademark von Frontier Developments.

## 📋 Produktvision

> Ein Tool für die Unterstützung von BGS- und Kolonisierungs-Aktivitäten einer einzelnen Squad – mit Einblick in das weitere Umfeld.

### 🌍 Szenario 1: Clusterbildung
- Systeme in Cluster unterteilen zur besserern Aufgabenteilung und Planung
- Anzeige von kontrollierenden und anwesenden Fraktionen

### 🌍 Szenario 2: Internationalisierung (i18n)
- Die IHCO vereint Spieler aus aller Welt
- **Standardsprache:** Englisch
- Weitere Sprachen nach Bedarf der Squad
- Alle UI-Texte müssen externalisiert werden – keine hardcodierten Strings im Code
- Spracherkennung via `navigator.language`, Fallback immer Englisch
- Geplante Struktur:
```
ihco-guide/
└── locales/
    ├── en.json    # Englisch (Standard)
    ├── de.json    # Deutsch
    └── ...
```

### 🌍 Szenario 3: Orientierung
- Zur besseren Orientierung ein Gitternetz einblenden mit 10^n Angabe der Koordinaten für x und z

---

## 🏗️ Architektur

```
BACKEND (Datenpipeline)
  ihco_filter.py
  • Spansh API → factions.json.gz (~14 MB)
  • Spansh API → systems_1week.json.gz (~26 MB)
  • Delta-Merge → ihco_systems.json ("Datenbank")
  • Trigger: Cron (dienstags 06:00 UTC) / manuell
        │
        ▼ ihco_systems.json
BUILD (Seitengenerator)
  embed_map.py
  • Liest ihco_map.html / .css / .js
  • Bettet JSON ein → index.html (portable)
  • Trigger: Push auf main
        │
        ▼ index.html
FRONTEND (Webseite)
  ihco_map.html + ihco_map.css + ihco_map.js
  • Three.js 3D-Sternenkarte
  • Suche, Toggle, Hover
  • Gehostet auf GitHub Pages
```

---

## 🗺️ Systemstatus & BGS-Aktionen

| Systemstatus | IHCO Präsenz | Aktion |
|-------------|--------------|--------|
| 🌑 Unkolonisiert | – | 🚀 Kolonisierungsziel |
| 🤖 NPC kontrolliert | ✅ präsent | ⚔️ Konflikt auslösen |
| 🤖 NPC kontrolliert | ❌ nicht präsent | 📍 Expansionsziel |
| 🏴 Spielerfraktion kontrolliert | ✅ präsent | ⚠️ Squadleitung entscheidet |
| 🏴 Spielerfraktion kontrolliert | ❌ nicht präsent | ⚠️ Squadleitung entscheidet |
| 🟢 IHCO kontrolliert | ✅ | 🛡️ Verteidigen |

> ⚠️ **Wichtig:** Keine Konflikte oder aggressive Expansion in spielerkontrollierte Systeme ohne Entscheidung der Squadleitung.

---

## 📁 Projektstruktur

```
ihco-guide/
├── .github/workflows/
│   ├── update.yml      # Wöchentlicher Daten-Download & Merge
│   └── deploy.yml      # Deploy auf GitHub Pages bei Push
├── py/
│   ├── ihco_filter.py  # Backend: Datenpipeline & Delta-Merge
│   └── embed_map.py    # Build: Generiert portable index.html
├── ihco_map.html       # Frontend: HTML-Template
├── ihco_map.css        # Frontend: Styles
├── ihco_map.js         # Frontend: Three.js Logik
├── ihco_systems.json   # Datenbank: Gefilterte IHCO-Systemdaten
├── index.html          # Output: Generierte Webseite (nicht manuell bearbeiten)
├── start_map.bat       # Lokaler Build & Start (Windows)
├── .gitignore
└── README.md
```

---

## 🚀 Lokaler Workflow

```bash
# 1. Spansh Dumps herunterladen (lokal, nie ins Repo!)
#    https://downloads.spansh.co.uk/factions.json.gz    → data/
#    https://downloads.spansh.co.uk/systems_1week.json.gz → data/

# 2. Pipeline ausführen
start_map.bat

# 3. Pushen
git add ihco_systems.json ihco_map.html ihco_map.css ihco_map.js
git commit -m "Update"
git push
```

---

## 🗓️ Roadmap

- [x] 3D-Sternenkarte (Three.js)
- [x] GitHub Pages Hosting
- [x] Automatische wöchentliche Datenaktualisierung
- [x] Delta-Merge Datenbanklogik
- [ ] Cluster-Definition & Verwaltung
- [ ] BGS-Tracker (Einfluss, Konflikte)
- [ ] Kolonisations-Planer (Hops, Warenlisten, Fortschritt)
- [ ] Fremdfraktionen & Spielerfraktionen in Clustern
- [ ] Aktionsempfehlungen pro System

---

## 🔗 Links

- **Live:** https://vonstackelberg-hell.github.io/ihco-guide/
- **Spansh Data Dumps:** https://spansh.co.uk/dumps
- **EDSM:** https://www.edsm.net
- **Inara:** https://inara.cz
