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

// Materials
const matControlled = new THREE.PointsMaterial({ color: 0x33ff33, size: 3, sizeAttenuation: true });
const matPresent    = new THREE.PointsMaterial({ color: 0x3399ff, size: 2, sizeAttenuation: true });

// Raycaster for hover
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 3;
const mouse = new THREE.Vector2();

let systemData = [];
let pointsControlled, pointsPresent;

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
    if (pointsControlled) targets.push(pointsControlled);
    if (pointsPresent)    targets.push(pointsPresent);
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
        }
    } else {
        hoverDiv.innerHTML = '';
    }
});

canvas.addEventListener('wheel', e => {
    spherical.radius = Math.max(50, Math.min(2000, spherical.radius + e.deltaY * 0.5));
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
}

// Highlight marker
let highlightMesh = null;

function highlightSystem(name) {
    const s = systemData.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!s) return;

    if (highlightMesh) { scene.remove(highlightMesh); highlightMesh = null; }

    const geo = new THREE.SphereGeometry(4, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
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
