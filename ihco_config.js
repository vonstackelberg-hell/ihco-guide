// ─────────────────────────────────────────────
// IHCO Guide – Konfiguration
// Hier können Einstellungen ohne Code-Kenntnisse angepasst werden.
// ─────────────────────────────────────────────

const IHCO_CONFIG = {

    // Zoom-Grenzen und Geschwindigkeit
    // minRadius: wie nah man heranzoomen kann (kleinerer Wert = näher ran)
    // maxRadius: maximale Entfernung beim Herauszoomen
    // zoomSpeed: wie schnell das Mausrad zoomt (größerer Wert = schneller)
    minRadius:  5,
    maxRadius:  2000,
    zoomSpeed:  0.5,

    // Grid (Koordinatengitter)
    // gridVisible: true = Grid beim Start eingeblendet, false = ausgeblendet
    // gridSize1:   Abstand der feinen Gitterlinien in Ly
    // gridSize2:   Abstand der groben Gitterlinien in Ly
    gridVisible: true,
    gridSize1:   100,
    gridSize2:   500,

    // Highlight bei Hoover und Select)
    // starHighlightSize: Größe des Highlights bei ausgewählten Sternen oder Hoovereffekt
	starHighlightSize : 1,

	// Lables for hoovered starsystems
	labelNeighborRadius: 50,   // Ly — Nachbarn im Umkreis anzeigen
	labelMaxZoomRadius:  300,  // ab diesem spherical.radius keine Labels mehr
	labelMaxNeighbors:   5,     // Maximale Anzahl Nachbarn in der Liste
	hoverThresholdFactor: 0.005,
	hoverThreshold: 3,

	// StarSize
	matControlledSize : 8,
	matPresentSize: 6,
};
