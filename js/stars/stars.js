// ─────────────────────────────────────────────
// stars.js – Sterne und Systemschichten
// ─────────────────────────────────────────────

// Hilfsfunktion: Glow-Textur für IHCO-Systeme
function createGlowTexture(color) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0.0, color.replace(')', ', 1.0)').replace('rgb', 'rgba'));
    gradient.addColorStop(0.3, color.replace(')', ', 0.6)').replace('rgb', 'rgba'));
    gradient.addColorStop(0.5, color.replace(')', ', 0.1)').replace('rgb', 'rgba'));
    gradient.addColorStop(1.0, color.replace(')', ', 0.0)').replace('rgb', 'rgba'));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
}

// ─────────────────────────────────────────────
// BackgroundStars – dekorative Hintergrundsterne
// ─────────────────────────────────────────────
class BackgroundStars {
    constructor(scene) {
        const geo = new THREE.BufferGeometry();
        const verts = [];
        for (let i = 0; i < 5000; i++) {
            verts.push((Math.random() - 0.5) * 8000);
            verts.push((Math.random() - 0.5) * 8000);
            verts.push((Math.random() - 0.5) * 8000);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const mat = new THREE.PointsMaterial({ color: 0x334433, size: 0.8, sizeAttenuation: false });
        this.points = new THREE.Points(geo, mat);
        scene.add(this.points);
    }
}

// ─────────────────────────────────────────────
// SystemLayer – IHCO-Systeme (kontrolliert + präsent)
// Verwaltet Punkte, Toggle, Hover-Highlight, Such-Highlight
// ─────────────────────────────────────────────
class SystemLayer {
    constructor(scene) {
        this.scene = scene;
        this.pointsControlled = null;
        this.pointsPresent = null;
        this.hoverHighlight = null;
        this.searchHighlight = null;
        this.systemData = [];
    }

    // Daten laden und Punkte zur Scene hinzufügen
    load(controlled, present) {
        const texC = createGlowTexture('rgb(51, 255, 51)');
        const matC = new THREE.PointsMaterial({
            color: 0x33ff33,
            size: IHCO_CONFIG.matControlledSize,
            sizeAttenuation: false,
            map: texC,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const geoC = new THREE.BufferGeometry();
        geoC.setAttribute('position', new THREE.Float32BufferAttribute(controlled.verts, 3));
        this.pointsControlled = new THREE.Points(geoC, matC);
        this.pointsControlled.userData = controlled.data;
        this.scene.add(this.pointsControlled);

        const texP = createGlowTexture('rgb(51, 153, 255)');
        const matP = new THREE.PointsMaterial({
            color: 0x3399ff,
            size: IHCO_CONFIG.matPresentSize,
            sizeAttenuation: false,
            map: texP,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const geoP = new THREE.BufferGeometry();
        geoP.setAttribute('position', new THREE.Float32BufferAttribute(present.verts, 3));
        this.pointsPresent = new THREE.Points(geoP, matP);
        this.pointsPresent.userData = present.data;
        this.scene.add(this.pointsPresent);

        this.systemData = [...controlled.data, ...present.data];
    }

    // Toggle Sichtbarkeit einer Gruppe
    toggle(group) {
        if (group === 'controlled' && this.pointsControlled) {
            this.pointsControlled.visible = !this.pointsControlled.visible;
            document.getElementById('btnControlled').classList.toggle('off', !this.pointsControlled.visible);
        }
        if (group === 'present' && this.pointsPresent) {
            this.pointsPresent.visible = !this.pointsPresent.visible;
            document.getElementById('btnPresent').classList.toggle('off', !this.pointsPresent.visible);
        }
    }

    // Raycaster-Ziele (nur sichtbare)
    getRaycastTargets() {
        const targets = [];
        if (this.pointsControlled && this.pointsControlled.visible) targets.push(this.pointsControlled);
        if (this.pointsPresent && this.pointsPresent.visible)       targets.push(this.pointsPresent);
        return targets;
    }

    // Hover-Highlight setzen oder verstecken
    setHoverHighlight(systemOrNull) {
        if (!systemOrNull) {
            if (this.hoverHighlight) this.hoverHighlight.visible = false;
            return;
        }
        if (!this.hoverHighlight) {
            const geo = new THREE.SphereGeometry(IHCO_CONFIG.starHighlightSize, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            this.hoverHighlight = new THREE.Mesh(geo, mat);
            this.scene.add(this.hoverHighlight);
        }
        this.hoverHighlight.position.set(
            systemOrNull.x * 0.5,
            systemOrNull.y * 0.5,
            systemOrNull.z * 0.5
        );
        this.hoverHighlight.visible = true;
    }

    // Such-Highlight setzen (cyan, größer)
    setSearchHighlight(name) {
        const s = this.systemData.find(d => d.name.toLowerCase() === name.toLowerCase());
        if (!s) return null;

        if (this.searchHighlight) {
            this.scene.remove(this.searchHighlight);
            this.searchHighlight = null;
        }
        const geo = new THREE.SphereGeometry(IHCO_CONFIG.starHighlightSize, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        this.searchHighlight = new THREE.Mesh(geo, mat);
        this.searchHighlight.position.set(s.x * 0.5, s.y * 0.5, s.z * 0.5);
        this.scene.add(this.searchHighlight);
        return s;
    }

    clearSearchHighlight() {
        if (this.searchHighlight) {
            this.scene.remove(this.searchHighlight);
            this.searchHighlight = null;
        }
    }

    // ─────────────────────────────────────────────
    // Nachbarn im Umkreis zurückgeben
    // Fix 1: nur sichtbare Systeme (controlled/present toggle)
    // Fix 2: Maximum per Config begrenzt
    // ─────────────────────────────────────────────
    getNeighbors(hoveredSystem, sphericalRadius) {
        if (!hoveredSystem || sphericalRadius > IHCO_CONFIG.labelMaxZoomRadius) return [];

        const dist = (a, b) => Math.sqrt(
            Math.pow(a.x - b.x, 2) +
            Math.pow(a.y - b.y, 2) +
            Math.pow(a.z - b.z, 2)
        );

        // Nur sichtbare Gruppen berücksichtigen
        const showControlled = this.pointsControlled && this.pointsControlled.visible;
        const showPresent    = this.pointsPresent    && this.pointsPresent.visible;

        return this.systemData
            .filter(s => {
                if (s.name === hoveredSystem.name) return false;
                if (s.controlled  && !showControlled) return false;
                if (!s.controlled && !showPresent)    return false;
                return dist(s, hoveredSystem) <= IHCO_CONFIG.labelNeighborRadius;
            })
            .sort((a, b) => dist(a, hoveredSystem) - dist(b, hoveredSystem))
            .slice(0, IHCO_CONFIG.labelMaxNeighbors);
    }

    // System nach Name suchen
    find(name) {
        return this.systemData.find(d => d.name.toLowerCase() === name.toLowerCase()) || null;
    }
}