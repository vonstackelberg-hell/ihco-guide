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

// Hintergrundsterne
new BackgroundStars(scene);

// IHCO-Systemschicht
const layers = new SystemLayer(scene);

// Grid
const grid = new InfiniteGrid(scene);

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
raycaster.params.Points.threshold = raycaster.params.Points.threshold = spherical.radius * 0.005;
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
    raycaster.setFromCamera(mouse, camera);

    const hoverDiv = document.getElementById('hover');
    const intersects = raycaster.intersectObjects(layers.getRaycastTargets());

    if (intersects.length > 0) {
        const s = intersects[0].object.userData[intersects[0].index];
        if (s) {
            hoverDiv.innerHTML = `${s.name}<br>
                <span style="color:#33ff3388">
                ${s.controlled ? '● Kontrolliert' : '● Präsent'}<br>
                x: ${s.x.toFixed(1)} y: ${s.y.toFixed(1)} z: ${s.z.toFixed(1)} Ly
                ${s.updateTime ? '<br>🕒 ' + s.updateTime.substring(0, 10) : ''}
                </span>`;
            layers.setHoverHighlight(s);
        }
    } else {
        hoverDiv.innerHTML = '';
        layers.setHoverHighlight(null);
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

// ─────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────
function toggleGroup(group) {
    if (group === 'controlled' || group === 'present') {
        layers.toggle(group);
    }
    if (group === 'grid') {
        grid.toggle();
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