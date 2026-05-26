class BackgroundStars {
    constructor() {
		const bgGeo = new THREE.BufferGeometry();
		const bgVerts = [];
		for (let i = 0; i < 5000; i++) {
		    bgVerts.push((Math.random() - 0.5) * 8000);
		    bgVerts.push((Math.random() - 0.5) * 8000);
		    bgVerts.push((Math.random() - 0.5) * 8000);
		}
		bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(bgVerts, 3));
		const bgMat = new THREE.PointsMaterial({ color: 0x334433, size: 0.8 });
		return new THREE.Points(bgGeo, bgMat);
	}
}

class ControlledStar {
	const texControlled = createGlowTexture('rgb(51, 255, 51)');	
	const matControlled = new THREE.PointsMaterial({
	    color: 0x33ff33,
	    size: IHCO_CONFIG.matControlledSize,
	    sizeAttenuation: false,
	    map: texControlled,
	    transparent: true,
	    depthWrite: false,
	    blending: THREE.AdditiveBlending
	});	const geoC = new THREE.BufferGeometry();
	geoC.setAttribute('position', new THREE.Float32BufferAttribute(controlled.verts, 3));
	pointsControlled = new THREE.Points(geoC, matControlled);
	pointsControlled.userData = controlled.data;
	return pointsControlled;
}

class PresentStar {
	const texPresent    = createGlowTexture('rgb(51, 153, 255)');
	const matPresent = new THREE.PointsMaterial({
	    color: 0x3399ff,
	    size: IHCO_CONFIG.matPresentSize,
	    sizeAttenuation: false,
	    map: texPresent,
	    transparent: true,
	    depthWrite: false,
	    blending: THREE.AdditiveBlending
	});
	const geoP = new THREE.BufferGeometry();
	geoP.setAttribute('position', new THREE.Float32BufferAttribute(present.verts, 3));
	pointsPresent = new THREE.Points(geoP, matPresent);
	pointsPresent.userData = present.data;
	return pointsPresent;
}