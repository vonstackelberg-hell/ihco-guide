import gzip
import json
import os

# Pfade immer relativ zum Script - funktioniert egal von wo gestartet
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(BASE_DIR, '..')
DATA_DIR = os.path.join(ROOT_DIR, 'data')
DB_FILE  = os.path.join(ROOT_DIR, 'ihco_systems.json')

FACTION_NAME = "Intergalactic Hitchhiker's Coalition"

# --- Schritt 1: Fraktionsdaten laden (Quelle der Wahrheit) ---
print("Lade factions.json.gz...")
with gzip.open(os.path.join(DATA_DIR, 'factions.json.gz'), 'rb') as f:
    data = json.load(f)

ihco = [f for f in data if f['name'] == FACTION_NAME]
if not ihco:
    print("FEHLER: Fraktion nicht gefunden!")
    exit(1)

# Duplikate bereinigen - isControllingFaction: true hat Vorrang
fresh_systems = {}
for entry in ihco[0]['systems']:
    name = entry['systemName']
    if name not in fresh_systems or entry.get('isControllingFaction', False):
        fresh_systems[name] = entry

print(f"Aktuelle Systemliste: {len(fresh_systems)} Systeme")

# --- Schritt 2: Historische updateTimes aus bestehender DB übernehmen ---
db_update_times = {}
if os.path.exists(DB_FILE):
    print("Lade historische updateTimes aus ihco_systems.json...")
    with open(DB_FILE, 'r', encoding='utf-8') as f:
        db_data = json.load(f)
    for entry in db_data[0]['systems']:
        if 'updateTime' in entry:
            db_update_times[entry['systemName']] = entry['updateTime']

    old_count = len(db_data[0]['systems'])
    new_count = len(fresh_systems)
    lost = [s for s in db_data[0]['systems'] if s['systemName'] not in fresh_systems]
    gained = [s for s in fresh_systems if s not in db_update_times]

    if lost:
        print(f"⚠️  Verlorene Systeme ({len(lost)}): {', '.join(e['systemName'] for e in lost)}")
    if gained:
        print(f"✅ Neue Systeme ({len(gained)}): {', '.join(gained)}")
    print(f"Vorher: {old_count} → Nachher: {new_count} Systeme")
else:
    print("Keine bestehende Datenbank - Erstanlage")

# Historische updateTimes in frische Daten übertragen
for name, entry in fresh_systems.items():
    if name in db_update_times:
        entry['updateTime'] = db_update_times[name]

# --- Schritt 3: updateTime mit systems_1week.json.gz aktualisieren ---
ihco_ids = {entry.get('systemId64') for entry in fresh_systems.values()}

print("Lade systems_1week.json.gz (Delta)...")
with gzip.open(os.path.join(DATA_DIR, 'systems_1week.json.gz'), 'rb') as f:
    spansh_data = json.load(f)

matched = 0
for s in spansh_data:
    if s['id64'] in ihco_ids:
        # System anhand ID finden und updateTime setzen
        for entry in fresh_systems.values():
            if entry.get('systemId64') == s['id64']:
                entry['updateTime'] = s['updateTime']
                matched += 1
                break

print(f"updateTime aktualisiert: {matched} Systeme")

# --- Schritt 4: Datenbank speichern ---
ihco[0]['systems'] = list(fresh_systems.values())

with open(DB_FILE, 'w', encoding='utf-8') as f:
    json.dump(ihco, f, indent=2)

print(f"\nFertig! Datenbank: {len(fresh_systems)} Systeme gesamt")
