import gzip
import json
import os

# Pfade immer relativ zum Script selbst - funktioniert egal von wo gestartet
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, '..', 'data')
OUT_DIR  = os.path.join(BASE_DIR, '..', 'data')

with gzip.open(os.path.join(DATA_DIR, 'factions.json.gz'), 'rb') as f:
    data = json.load(f)

ihco = [f for f in data if f['name'] == 'Intergalactic Hitchhiker\'s Coalition']

# Duplikate bereinigen - isControllingFaction: true hat Vorrang
systems = {}
for entry in ihco[0]['systems']:
    name = entry['systemName']
    if name not in systems or entry.get('isControllingFaction', False):
        systems[name] = entry

# IDs der IHCO Systeme als Lookup vorbereiten
ihco_ids = {entry.get('systemId64') for entry in systems.values()}

# updateTime aus systems_1month.json.gz - nur IHCO Systeme mergen
print("Lade Spansh Systemdaten...")
spansh_lookup = {}
with gzip.open(os.path.join(DATA_DIR, 'systems_1month.json.gz'), 'rb') as f:
    spansh_data = json.load(f)

for s in spansh_data:
    if s['id64'] in ihco_ids:
        spansh_lookup[s['id64']] = s['updateTime']

matched = 0
for entry in systems.values():
    sid = entry.get('systemId64')
    if sid and sid in spansh_lookup:
        entry['updateTime'] = spansh_lookup[sid]
        matched += 1

ihco[0]['systems'] = list(systems.values())

with open(os.path.join(OUT_DIR, '..', 'ihco_systems.json'), 'w') as f:
    json.dump(ihco, f, indent=2)

print(f"Systeme gesamt: {len(systems)}")
print(f"updateTime ergänzt: {matched}")
