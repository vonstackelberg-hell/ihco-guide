import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(BASE_DIR, '..')

# Quelldateien einlesen
with open(os.path.join(ROOT_DIR, 'ihco_systems.json'), 'r', encoding='utf-8') as f:
    data = json.load(f)

with open(os.path.join(ROOT_DIR, 'ihco_map.html'), 'r', encoding='utf-8') as f:
    html = f.read()

with open(os.path.join(ROOT_DIR, 'ihco_map.css'), 'r', encoding='utf-8') as f:
    css = f.read()

with open(os.path.join(ROOT_DIR, 'ihco_map.js'), 'r', encoding='utf-8') as f:
    js = f.read()

# JSON direkt ins JS einbetten statt fetch()
js_embedded = js.replace(
    "fetch('ihco_systems.json')\n    .then(r => r.json())\n    .then(data => {",
    f"Promise.resolve({json.dumps(data)})\n    .then(data => {{"
)

# Alles in eine portable index.html zusammenbauen
html_out = html
html_out = html_out.replace('<link rel="stylesheet" href="ihco_map.css">', f'<style>\n{css}\n</style>')
html_out = html_out.replace('<script src="ihco_map.js"></script>', f'<script>\n{js_embedded}\n</script>')

with open(os.path.join(ROOT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html_out)

print("Fertig! index.html erstellt.")
