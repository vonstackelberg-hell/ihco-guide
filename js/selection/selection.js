// ─────────────────────────────────────────────
// selection.js – Zentraler Selektions-State
// Einzige Wahrheit über hoveredSystem und selectedSystem.
// Alle UI-Updates laufen über diesen Manager.
// ─────────────────────────────────────────────

class SelectionManager {

    constructor(svg, hoverDiv, layers) {
        this.svg      = svg;
        this.hoverDiv = hoverDiv;
        this.layers   = layers;

        this.hoveredSystem  = null;
        this.selectedSystem = null;
    }

    // ─── Hover (Maus schwebt über System) ────────
    setHover(system, sphericalRadius) {
        this.hoveredSystem = system;
        this.layers.setHoverHighlight(system);
        this._render(sphericalRadius);
    }

    clearHover(sphericalRadius) {
        this.hoveredSystem = null;
        this.layers.setHoverHighlight(null);
        this._render(sphericalRadius);
    }

    // ─── Selektion (Klick oder Suche) ────────────
    select(system, sphericalRadius) {
        this.selectedSystem = system;
        this.layers.setSearchHighlight(system ? system.name : null);
        this._render(sphericalRadius);
    }

    clearSelection(sphericalRadius) {
        this.selectedSystem = null;
        this.layers.clearSearchHighlight();
        this._render(sphericalRadius);
    }

    // ─── Aktives System (Hover hat Vorrang) ──────
    getActive() {
        return this.hoveredSystem || this.selectedSystem || null;
    }

    // ─── Linien neu berechnen beim Zoomen ────────
    onZoom(sphericalRadius) {
        this._render(sphericalRadius);
    }

    // ─── Internes Rendering ──────────────────────
    _render(sphericalRadius) {
        const active = this.getActive();

        // SVG leeren
        while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

        if (!active) {
            this.hoverDiv.innerHTML = '';
            return;
        }

        const isSelected = !this.hoveredSystem && !!this.selectedSystem;
        const color      = active.controlled ? '#33ff33' : '#3399ff';
        const labelColor = isSelected ? '#ffff00' : color;

        // ─── Hover-Div aufbauen ───────────────────
        let html = `<span style="color:${labelColor}">${active.name}</span><br>
            <span style="color:${labelColor}88">
            ${active.controlled ? '● Kontrolliert' : '● Präsent'}<br>
            x: ${active.x.toFixed(1)} &nbsp;y: ${active.y.toFixed(1)} &nbsp;z: ${active.z.toFixed(1)} Ly
            ${active.updateTime ? '<br>🕒 ' + active.updateTime.substring(0, 10) : ''}
            </span>`;

        const neighbors = this.layers.getNeighbors(active, sphericalRadius);
        if (neighbors.length > 0) {
            html += `<hr style="border-color:#33ff3344;margin:6px 0;">`;
            neighbors.forEach((n, i) => {
                const nc = n.controlled ? '#33ff33' : '#3399ff';
                html += `<span id="neighbor-${i}" style="color:${nc}99">● ${n.name}</span><br>`;
            });
        }
        this.hoverDiv.innerHTML = html;

        // ─── SVG-Linien ───────────────────────────
        if (neighbors.length > 0) {
            requestAnimationFrame(() => {
                neighbors.forEach((n, i) => {
                    const el = document.getElementById(`neighbor-${i}`);
                    if (!el) return;
                    const r = el.getBoundingClientRect();
                    const originX = r.left;
                    const originY = r.top + r.height / 2;
                    const pos = toScreenPos(n.x, n.y, n.z);
                    if (pos.x < 0 || pos.x > window.innerWidth ||
                        pos.y < 0 || pos.y > window.innerHeight) return;
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', originX);
                    line.setAttribute('y1', originY);
                    line.setAttribute('x2', pos.x);
                    line.setAttribute('y2', pos.y);
                    line.setAttribute('stroke', n.controlled ? '#33ff3366' : '#3399ff66');
                    line.setAttribute('stroke-width', '1');
                    this.svg.appendChild(line);
                });
            });
        }
    }
}
