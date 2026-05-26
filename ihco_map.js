// Scene Setup
const canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(0, 200, 500);

// SVG-Overlay für Verbindungslinien
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svg.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
document.body.appendChild(svg);

// Hintergrundsterne
new BackgroundStars(scene);

// IHCO-Systemschicht
const layers = new SystemLayer(scene);

// Zuletzt gehoverten Stern merken (für Linien-Update beim Zoom)
let lastHovered = null;

// 3D-Position → 2D Bildschirmkoordinaten
function toScreenPos(x, y, z) {
    const vec = new THREE.Vector3(x * 0.5, y * 0.5, z * 0.5);
    vec.project(camera);
    return {
        x: ( vec.x * 0.5 + 0.5) * window.innerWidth,
        y: (-vec.y * 0.5 + 0.5) * window.innerHeight
    };
}

// SVG-Linien und Hover-Div aktualisieren
function updateHoverUI(hoveredSystem, neighbors) {

    // SVG leeren
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    if (!hoveredSystem) {
		document.getElementById('hover').innerHTML = '';
        return;
    }

    // Hover-Div: gehoverten Stern
    const color = hoveredSystem.controlled ? '#33ff33' : '#3399ff';
    let html = `${hoveredSystem.name}<br>
        <span style="color:${color}88">
        ${hoveredSystem.controlled ? '● Kontrolliert' : '● Präsent'}<br>
        x: ${hoveredSystem.x.toFixed(1)} y: ${hoveredSystem.y.toFixed(1)} z: ${hoveredSystem.z.toFixed(1)} Ly
        ${hoveredSystem.updateTime ? '<br>🕒 ' + hoveredSystem.updateTime.substring(0, 10) : ''}
        </span>`;

    // Nachbarn anhängen mit ID für Linien-Ankerpunkt
    if (neighbors.length > 0) {
        html += `<hr style="border-color:#33ff3344;margin:6px 0;">`;
        neighbors.forEach((n, i) => {
            const nc = n.controlled ? '#33ff33' : '#3399ff';
            html += `<span id="neighbor-${i}" style="color:${nc}99">● ${n.name}</span><br>`;
        });
    }
    document.getElementById('hover').innerHTML = html;

    // SVG-Linien: von jedem Namenseintrag zu seinem Stern
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
                svg.appendChild(line);
            });
        });
    }
}

// ─────────────────────────────────────────────
// Infinite Grid (XZ-Ebene, anti-aliased Shader)
// Autor-Technik: Fyrestar / discourse.threejs.org/t/8377
// Koordinaten: scene-units × 2 = Ly
// ─────────────────────────────────────────────

function makeGridLabelTexture(text) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = 'rgba(100,180,100,0.75)';
    ctx.fillText(text, 8, 44);
    return new THREE.CanvasTexture(c);
}

function createInfiniteGrid(size1, size2, color, distance) {
    const geo = new THREE.PlaneBufferGeometry(2, 2, 1, 1);
    const mat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: {
            uSize1:    { value: size1 },
            uSize2:    { value: size2 },
            uColor:    { value: color },
            uDistance: { value: distance }
        },
        transparent: true,
        depthWrite: false,
        vertexShader: `
            varying vec3 worldPosition;
            uniform float uDistance;
            void main() {
                vec3 pos = position.xzy * uDistance;
                pos.xz += cameraPosition.xz;
                worldPosition = pos;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 worldPosition;
            uniform float uSize1;
            uniform float uSize2;
            uniform vec3 uColor;
            uniform float uDistance;

            float getGrid(float size) {
                vec2 r = worldPosition.xz / size;
                vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
                float line = min(grid.x, grid.y);
                return 1.0 - min(line, 1.0);
            }

            void main() {
                float d = 1.0 - min(distance(cameraPosition.xz, worldPosition.xz) / uDistance, 1.0);
                float g1 = getGrid(uSize1);
                float g2 = getGrid(uSize2);
                gl_FragColor = vec4(uColor.rgb, mix(g2, g1, g1) * pow(d, 3.0));
                gl_FragColor.a = mix(0.5 * gl_FragColor.a, gl_FragColor.a, g2);
                if (gl_FragColor.a <= 0.0) discard;
            }
        `,
        extensions: { derivatives: true }
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
}

const gridMesh = createInfiniteGrid(
    IHCO_CONFIG.gridSize1 / 2,
    IHCO_CONFIG.gridSize2 / 2,
    new THREE.Color(0.2, 0.5, 0.2),
    3000
);
gridMesh.visible = IHCO_CONFIG.gridVisible;
scene.add(gridMesh);

const gridLabels = [];
const LABEL_STEP  = 250;
const LABEL_RANGE = 2000;

function buildGridLabels() {
    gridLabels.forEach(s => scene.remove(s));
    gridLabels.length = 0;

    for (let xi = -LABEL_RANGE; xi <= LABEL_RANGE; xi += LABEL_STEP) {
        for (let zi = -LABEL_RANGE; zi <= LABEL_RANGE; zi += LABEL_STEP) {
            if (xi === 0 && zi === 0) continue;
            const label = `${Math.round(xi * 2)},${Math.round(zi * 2)}`;
            const tex = makeGridLabelTexture(label);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: tex, transparent: true, depthWrite: false, opacity: 0.6
            }));
            sprite.position.set(xi, 0, zi);
            sprite.scale.set(60, 15, 1);
            sprite.visible = IHCO_CONFIG.gridVisible;
            scene.add(sprite);
            gridLabels.push(sprite);
        }
    }

    // Ursprungs-Label
    const originSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGridLabelTexture('0,0 Ly'), transparent: true, depthWrite: false, opacity: 0.8
    }));
    originSprite.position.set(0, 0, 0);
    originSprite.scale.set(80, 20, 1);
    originSprite.visible = IHCO_CONFIG.gridVisible;
    scene.add(originSprite);
    gridLabels.push(originSprite);
}
buildGridLabels();

// ─────────────────────────────────────────────
// JSON laden
// ─────────────────────────────────────────────
fetch('ihco_systems.json')
    .then(r => r.json())
    .then(data => {
        const systems = data[0].systems;
        document.getElementById('count').textContent = `${systems.length} Systeme geladen`;

        const panic = document.getElementById('panic');
        panic.style.opacity = '1';
        setTimeout(() => panic.style.opacity = '0', 1500);

        const controlled = { verts: [], data: [] };
        const present    = { verts: [], data: [] };

        systems.forEach(s => {
            const x = s.coords.x * 0.5;
            const y = s.coords.y * 0.5;
            const z = s.coords.z * 0.5;
            const bucket = s.isControllingFaction ? controlled : present;
            bucket.verts.push(x, y, z);
            bucket.data.push({
                name: s.systemName,
                x: s.coords.x, y: s.coords.y, z: s.coords.z,
                controlled: !!s.isControllingFaction,
                updateTime: s.updateTime || null
            });
        });

        layers.load(controlled, present);
    });

// ─────────────────────────────────────────────
// Orbit Controls (manual)
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let isDragging = false, isRightDrag = false;
let prevMouse = { x: 0, y: 0 };
let spherical = { theta: 0, phi: Math.PI / 3, radius: 500 };
raycaster.params.Points.threshold = IHCO_CONFIG.hoverThreshold;
let target = new THREE.Vector3(0, 0, 0);

canvas.addEventListener('mousedown', e => {
    isDragging = true;
    isRightDrag = e.button === 2;
    prevMouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mouseup', () => isDragging = false);

canvas.addEventListener('mousemove', e => {
    if (isDragging) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        if (isRightDrag) {
            target.x -= dx * 0.5;
            target.y += dy * 0.5;
        } else {
            spherical.theta -= dx * 0.005;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + dy * 0.005));
        }
        prevMouse = { x: e.clientX, y: e.clientY };
    }

    // Hover
    mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
	raycaster.params.Points.threshold = IHCO_CONFIG.hoverThreshold;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(layers.getRaycastTargets());
	console.log('intersects:', intersects.length, 'lastHovered:', lastHovered);

    if (intersects.length > 0) {
        const s = intersects[0].object.userData[intersects[0].index];
        if (s) {
            lastHovered = s;
            const neighbors = layers.getNeighbors(s, spherical.radius);
            updateHoverUI(s, neighbors);
            layers.setHoverHighlight(s);
        }
    } else {
        lastHovered = null;
        updateHoverUI(null, []);
        layers.setHoverHighlight(null);
    }
});

canvas.addEventListener('wheel', e => {
    spherical.radius = Math.max(IHCO_CONFIG.minRadius, Math.min(IHCO_CONFIG.maxRadius, spherical.radius + e.deltaY * IHCO_CONFIG.zoomSpeed));
    raycaster.params.Points.threshold = IHCO_CONFIG.hoverThreshold;
	
    // Linien neu berechnen beim Zoomen
    if (lastHovered) {
        const neighbors = layers.getNeighbors(lastHovered, spherical.radius);
        updateHoverUI(lastHovered, neighbors);
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// ─────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────
function toggleGroup(group) {
    if (group === 'controlled' || group === 'present') {
        layers.toggle(group);
    }
    if (group === 'grid') {
        const show = !gridMesh.visible;
        gridMesh.visible = show;
        gridLabels.forEach(s => s.visible = show);
        document.getElementById('btnGrid').classList.toggle('off', !show);
    }
}

// ─────────────────────────────────────────────
// Suche / Autocomplete
// ─────────────────────────────────────────────
const searchInput = document.getElementById('search');
const acDiv       = document.getElementById('autocomplete');

function highlightSystem(name) {
    const s = layers.setSearchHighlight(name);
    if (!s) return;

    target.set(s.x * 0.5, s.y * 0.5, s.z * 0.5);
    spherical.radius = 150;

    document.getElementById('hover').innerHTML = `${s.name}<br>
        <span style="color:#ffff0088">
        ${s.controlled ? '● Kontrolliert' : '● Präsent'}<br>
        x: ${s.x.toFixed(1)} y: ${s.y.toFixed(1)} z: ${s.z.toFixed(1)} Ly
        ${s.updateTime ? '<br>🕒 ' + s.updateTime.substring(0, 10) : ''}
        </span>`;
}

searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim().toLowerCase();
    acDiv.innerHTML = '';
    if (!val) {
        acDiv.style.display = 'none';
        layers.clearSearchHighlight();
        return;
    }
    const matches = layers.systemData.filter(s => s.name.toLowerCase().includes(val)).slice(0, 10);
    if (matches.length === 0) { acDiv.style.display = 'none'; return; }
    acDiv.style.display = 'block';
    matches.forEach(s => {
        const div = document.createElement('div');
        div.className = 'ac-item';
        div.textContent = s.name;
        div.addEventListener('click', () => {
            searchInput.value = s.name;
            acDiv.style.display = 'none';
            highlightSystem(s.name);
        });
        acDiv.appendChild(div);
    });
});

searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        acDiv.style.display = 'none';
        highlightSystem(searchInput.value.trim());
    }
    if (e.key === 'Escape') {
        acDiv.style.display = 'none';
        searchInput.value = '';
        layers.clearSearchHighlight();
        document.getElementById('hover').innerHTML = '';
    }
});

// ─────────────────────────────────────────────
// Animate
// ─────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    const x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    const y = spherical.radius * Math.cos(spherical.phi);
    const z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    camera.position.set(target.x + x, target.y + y, target.z + z);
    camera.lookAt(target);
    renderer.render(scene, camera);
}
animate();