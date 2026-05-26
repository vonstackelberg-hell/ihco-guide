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

// Background stars
const bgGeo = new THREE.BufferGeometry();
const bgVerts = [];
for (let i = 0; i < 5000; i++) {
    bgVerts.push((Math.random() - 0.5) * 8000);
    bgVerts.push((Math.random() - 0.5) * 8000);
    bgVerts.push((Math.random() - 0.5) * 8000);
}
bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(bgVerts, 3));
const bgMat = new THREE.PointsMaterial({ color: 0x334433, size: 0.8 });
scene.add(new THREE.Points(bgGeo, bgMat));

// --- Glowing Sprite Textur ---
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

const texControlled = createGlowTexture('rgb(51, 255, 51)');
const texPresent    = createGlowTexture('rgb(51, 153, 255)');

// Materials mit Glow + AdditiveBlending
const matControlled = new THREE.PointsMaterial({
    color: 0x33ff33,
    size: IHCO_CONFIG.matControlledSize,
    sizeAttenuation: false,
    map: texControlled,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const matPresent = new THREE.PointsMaterial({
    color: 0x3399ff,
    size: IHCO_CONFIG.matPresentSize,
    sizeAttenuation: false,
    map: texPresent,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

// Raycaster for hover
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 5;
const mouse = new THREE.Vector2();

let systemData = [];
let pointsControlled, pointsPresent;

// ─────────────────────────────────────────────
// Infinite Grid (XZ-Ebene, anti-aliased Shader)
// Autor-Technik: Fyrestar / discourse.threejs.org/t/8377
// Koordinaten: scene-units × 2 = Ly
// ─────────────────────────────────────────────

// Hilfsfunktion: Canvas-Textur für Grid-Labels
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

// Grid erstellen (standardmäßig unsichtbar)
// size1 = feines Gitter: 50 scene-units = 100 Ly
// size2 = grobes Gitter: 250 scene-units = 500 Ly
const gridMesh = createInfiniteGrid(
    IHCO_CONFIG.gridSize1 / 2,
    IHCO_CONFIG.gridSize2 / 2,
    new THREE.Color(0.2, 0.5, 0.2),
    3000
);
gridMesh.visible = IHCO_CONFIG.gridVisible;
scene.add(gridMesh);

// Grid-Achsen-Labels (X / Z, alle 500 Ly = 250 scene-units)
const gridLabels = [];
const LABEL_STEP = 250;   // scene-units
const LABEL_RANGE = 2000; // scene-units

function buildGridLabels() {
    // Alte Labels entfernen
    gridLabels.forEach(s => scene.remove(s));
    gridLabels.length = 0;

    for (let xi = -LABEL_RANGE; xi <= LABEL_RANGE; xi += LABEL_STEP) {
        for (let zi = -LABEL_RANGE; zi <= LABEL_RANGE; zi += LABEL_STEP) {
            if (xi === 0 && zi === 0) continue; // Ursprung überspringen
            const lx = Math.round(xi * 2);  // Ly
            const lz = Math.round(zi * 2);  // Ly
            const label = `${lx},${lz}`;
            const tex = makeGridLabelTexture(label);
            const spriteMat = new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                depthWrite: false,
                opacity: 0.6
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.set(xi, 0, zi);
            sprite.scale.set(60, 15, 1);
            sprite.visible = IHCO_CONFIG.gridVisible;
            scene.add(sprite);
            gridLabels.push(sprite);
        }
    }
}
buildGridLabels();

// Ursprungs-Label (0,0)
const originTex = makeGridLabelTexture('0,0 Ly');
const originSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: originTex, transparent: true, depthWrite: false, opacity: 0.8
}));
originSprite.position.set(0, 0, 0);
originSprite.scale.set(80, 20, 1);
originSprite.visible = IHCO_CONFIG.gridVisible;
scene.add(originSprite);
gridLabels.push(originSprite);

// Load JSON
fetch('ihco_systems.json')
    .then(r => r.json())
    .then(data => {
        const systems = data[0].systems;
        document.getElementById('count').textContent = `${systems.length} Systeme geladen`;

        // DON'T PANIC flash
        const panic = document.getElementById('panic');
        panic.style.opacity = '1';
        setTimeout(() => panic.style.opacity = '0', 1500);

        const controlled = { verts: [], data: [] };
        const present    = { verts: [], data: [] };

        systems.forEach(s => {
            const x = s.coords.x * 0.5;
            const y = s.coords.y * 0.5;
            const z = s.coords.z * 0.5;
            const target = s.isControllingFaction ? controlled : present;
            target.verts.push(x, y, z);
            target.data.push({
                name: s.systemName,
                x: s.coords.x, y: s.coords.y, z: s.coords.z,
                controlled: !!s.isControllingFaction,
                updateTime: s.updateTime || null
            });
        });

        // Controlled points
        const geoC = new THREE.BufferGeometry();
        geoC.setAttribute('position', new THREE.Float32BufferAttribute(controlled.verts, 3));
        pointsControlled = new THREE.Points(geoC, matControlled);
        pointsControlled.userData = controlled.data;
        scene.add(pointsControlled);

        // Present points
        const geoP = new THREE.BufferGeometry();
        geoP.setAttribute('position', new THREE.Float32BufferAttribute(present.verts, 3));
        pointsPresent = new THREE.Points(geoP, matPresent);
        pointsPresent.userData = present.data;
        scene.add(pointsPresent);

        systemData = [...controlled.data, ...present.data];
    });

// Orbit Controls (manual)
let isDragging = false, isRightDrag = false;
let prevMouse = { x: 0, y: 0 };
let spherical = { theta: 0, phi: Math.PI / 3, radius: 500 };
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
            const panSpeed = 0.5;
            target.x -= dx * panSpeed;
            target.y += dy * panSpeed;
        } else {
            spherical.theta -= dx * 0.005;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + dy * 0.005));
        }
        prevMouse = { x: e.clientX, y: e.clientY };
    }

    // Hover
    mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const hoverDiv = document.getElementById('hover');
    const targets = [];
	if (pointsControlled && pointsControlled.visible) targets.push(pointsControlled);
	if (pointsPresent && pointsPresent.visible)       targets.push(pointsPresent);
    const intersects = raycaster.intersectObjects(targets);

    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const idx = intersects[0].index;
        const s = obj.userData[idx];
        if (s) {
            hoverDiv.innerHTML = `${s.name}<br>
                <span style="color:#33ff3388">
                ${s.controlled ? '● Kontrolliert' : '● Präsent'}<br>
                x: ${s.x.toFixed(1)} y: ${s.y.toFixed(1)} z: ${s.z.toFixed(1)} Ly
                ${s.updateTime ? '<br>🕒 ' + s.updateTime.substring(0, 10) : ''}
                </span>`;
			// Hover-Highlight
			if (!hoverHighlight) {
				const hgeo = new THREE.SphereGeometry(IHCO_CONFIG.starHighlightSize, 8, 8);
				const hmat = new THREE.MeshBasicMaterial({ color: 0xffffff });
				hoverHighlight = new THREE.Mesh(hgeo, hmat);
				scene.add(hoverHighlight);
			}
			hoverHighlight.position.set(s.x * 0.5, s.y * 0.5, s.z * 0.5);
			hoverHighlight.visible = true;
        }
    } else {
        hoverDiv.innerHTML = '';
		if (hoverHighlight) hoverHighlight.visible = false;
    }
});

canvas.addEventListener('wheel', e => {
    spherical.radius = Math.max(IHCO_CONFIG.minRadius, Math.min(IHCO_CONFIG.maxRadius, spherical.radius + e.deltaY * IHCO_CONFIG.zoomSpeed));
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Toggle groups
function toggleGroup(group) {
    if (group === 'controlled' && pointsControlled) {
        pointsControlled.visible = !pointsControlled.visible;
        document.getElementById('btnControlled').classList.toggle('off', !pointsControlled.visible);
    }
    if (group === 'present' && pointsPresent) {
        pointsPresent.visible = !pointsPresent.visible;
        document.getElementById('btnPresent').classList.toggle('off', !pointsPresent.visible);
    }
    if (group === 'grid') {
        const show = !gridMesh.visible;
        gridMesh.visible = show;
        gridLabels.forEach(s => s.visible = show);
        document.getElementById('btnGrid').classList.toggle('off', !show);
    }
}

// Highlight marker
let highlightMesh = null;
let hoverHighlight = null;

function highlightSystem(name) {
    const s = systemData.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!s) return;

    if (highlightMesh) { scene.remove(highlightMesh); highlightMesh = null; }

    const geo = new THREE.SphereGeometry(IHCO_CONFIG.starHighlightSize, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    highlightMesh = new THREE.Mesh(geo, mat);
    highlightMesh.position.set(s.x * 0.5, s.y * 0.5, s.z * 0.5);
    scene.add(highlightMesh);

    target.set(s.x * 0.5, s.y * 0.5, s.z * 0.5);
    spherical.radius = 150;

    document.getElementById('hover').innerHTML = `${s.name}<br>
        <span style="color:#ffff0088">
        ${s.controlled ? '● Kontrolliert' : '● Präsent'}<br>
        x: ${s.x.toFixed(1)} y: ${s.y.toFixed(1)} z: ${s.z.toFixed(1)} Ly
        ${s.updateTime ? '<br>🕒 ' + s.updateTime.substring(0, 10) : ''}
        </span>`;
}

// Search / Autocomplete
const searchInput = document.getElementById('search');
const acDiv       = document.getElementById('autocomplete');

searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim().toLowerCase();
    acDiv.innerHTML = '';
    if (!val) {
        acDiv.style.display = 'none';
        if (highlightMesh) { scene.remove(highlightMesh); highlightMesh = null; }
        return;
    }
    const matches = systemData.filter(s => s.name.toLowerCase().includes(val)).slice(0, 10);
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
        if (highlightMesh) { scene.remove(highlightMesh); highlightMesh = null; }
        document.getElementById('hover').innerHTML = '';
    }
});

// Animate
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
