// ─────────────────────────────────────────────
// grid.js – Infinite Grid (XZ-Ebene)
// Autor-Technik: Fyrestar / discourse.threejs.org/t/8377
// Koordinaten: scene-units × 2 = Ly
// ─────────────────────────────────────────────

class InfiniteGrid {
    constructor(scene) {
        this.scene = scene;
        this.labels = [];
        this.mesh = this._createMesh();
        this.mesh.visible = IHCO_CONFIG.gridVisible;
        scene.add(this.mesh);
        this._buildLabels();
    }

    _createMesh() {
        const geo = new THREE.PlaneBufferGeometry(2, 2, 1, 1);
        const mat = new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            uniforms: {
                uSize1:    { value: IHCO_CONFIG.gridSize1 / 2 },
                uSize2:    { value: IHCO_CONFIG.gridSize2 / 2 },
                uColor:    { value: new THREE.Color(0.2, 0.5, 0.2) },
                uDistance: { value: 3000 }
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

    _makeLabelTexture(text) {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 256, 64);
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = 'rgba(100,180,100,0.75)';
        ctx.fillText(text, 8, 44);
        return new THREE.CanvasTexture(c);
    }

    _buildLabels() {
        // Alte Labels entfernen
        this.labels.forEach(s => this.scene.remove(s));
        this.labels = [];

        const LABEL_STEP  = 250;
        const LABEL_RANGE = 2000;

        for (let xi = -LABEL_RANGE; xi <= LABEL_RANGE; xi += LABEL_STEP) {
            for (let zi = -LABEL_RANGE; zi <= LABEL_RANGE; zi += LABEL_STEP) {
                const isOrigin = xi === 0 && zi === 0;
                const label = isOrigin
                    ? '0,0 Ly'
                    : `${Math.round(xi * 2)},${Math.round(zi * 2)}`;
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: this._makeLabelTexture(label),
                    transparent: true,
                    depthWrite: false,
                    opacity: isOrigin ? 0.8 : 0.6
                }));
                sprite.position.set(xi, 0, zi);
                sprite.scale.set(isOrigin ? 80 : 60, isOrigin ? 20 : 15, 1);
                sprite.visible = IHCO_CONFIG.gridVisible;
                this.scene.add(sprite);
                this.labels.push(sprite);
            }
        }
    }

    toggle() {
        const show = !this.mesh.visible;
        this.mesh.visible = show;
        this.labels.forEach(s => s.visible = show);
        document.getElementById('btnGrid').classList.toggle('off', !show);
    }

    get visible() {
        return this.mesh.visible;
    }
}