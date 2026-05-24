import json

with open('ihco_systems.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

with open('ihco_map.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace(
    "fetch('ihco_systems.json')\n  .then(r => r.json())\n  .then(data => {",
    f"Promise.resolve({json.dumps(data)})\n  .then(data => {{"
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Fertig! Öffne index.html")
