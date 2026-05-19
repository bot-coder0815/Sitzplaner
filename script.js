let activeT = null, rightT = null, rotating = false;
let isPanning = false;
let startX, startY;
let pan = { x: -4500, y: -4500 }; 
let isPresentation = false;
let isSnapActive = false;

// Touch Drag Hilfsvariablen
let touchStartPos = { x: 0, y: 0 };
let tableStartPos = { x: 0, y: 0 };

const canvas = document.getElementById('canvas');
const viewport = document.getElementById('viewport');

function updateCanvas() {
    canvas.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
}
updateCanvas();

// Erkennung ob Mobilgerät
function isMobile() { return window.innerWidth <= 768; }

// --- MOUSE & PANNING EVENTS (DESKTOP) ---
viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.table')) return;
    isPanning = true;
    startX = e.clientX - pan.x;
    startY = e.clientY - pan.y;
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        pan.x = e.clientX - startX;
        pan.y = e.clientY - startY;
        requestAnimationFrame(updateCanvas);
    } else if (activeT && !isMobile()) {
        moveTableLogic(e.clientX, e.clientY, activeT);
    }
});

window.addEventListener('mouseup', () => { isPanning = false; if(!isMobile()) activeT = null; });

// --- TOUCH & PANNING EVENTS (MOBILE UPGRADE) ---
viewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('.table')) return; // Tisch Logik fängt das ab
    isPanning = true;
    startX = e.touches[0].clientX - pan.x;
    startY = e.touches[0].clientY - pan.y;
}, { passive: true });

viewport.addEventListener('touchmove', (e) => {
    if (isPanning) {
        pan.x = e.touches[0].clientX - startX;
        pan.y = e.touches[0].clientY - startY;
        requestAnimationFrame(updateCanvas);
    } else if (activeT && isMobile()) {
        const touch = e.touches[0];
        moveTableLogic(touch.clientX, touch.clientY, activeT);
    }
}, { passive: false });

viewport.addEventListener('touchend', () => { isPanning = false; });

function moveTableLogic(clientX, clientY, targetTable) {
    const rect = canvas.getBoundingClientRect();
    let x = clientX - rect.left - (targetTable.offsetWidth / 2);
    let y = clientY - rect.top - (targetTable.offsetHeight / 2);

    if (isSnapActive) {
        // Wenn Haken aktiv ist: Sofortiges Klatschen/Einrasten auf 40px Raster
        x = Math.round(x / 40) * 40;
        y = Math.round(y / 40) * 40;
    }

    targetTable.style.left = x + 'px';
    targetTable.style.top = y + 'px';
}

// --- TISCH SPAWN & MANAGEMENT ---
function addTable(type, isV, names = [], x = null, y = null, rot = 0) {
    if (x === null) {
        const v = viewport.getBoundingClientRect();
        x = (v.width / 2) - pan.x - 70;
        y = (v.height / 2) - pan.y - 35;
    }

    const t = document.createElement('div');
    t.className = `table ${type}` + (isV ? ' vertical' : '');
    t.style.left = x + 'px'; t.style.top = y + 'px';
    t.dataset.rotation = rot;
    t.dataset.type = type;
    t.style.transform = `rotate(${rot}deg)`;

    let seatCount = (type === 'double') ? 2 : 1;
    for(let i=0; i < seatCount; i++) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        const area = document.createElement('textarea');
        area.value = names[i] || "";
        area.placeholder = "Name";
        
        // Verhindert Text-Fehlverhalten bei Bewegung
        area.onmousedown = (e) => e.stopPropagation();
        area.ontouchstart = (e) => e.stopPropagation();
        
        seat.appendChild(area);
        t.appendChild(seat);
    }

    // DESKTOP KLICK
    t.onmousedown = (e) => {
        if (isMobile()) return;
        if (e.button === 2) {
            e.preventDefault();
            rightT = t;
            const menu = document.getElementById('tableContextMenu');
            menu.style.display = 'block';
            menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
        } else {
            if (rotating) { stopRotation(); return; }
            activeT = t;
        }
        e.stopPropagation();
    };

    // MOBILE TOUCH DRAG & AKTIONSLEISTE
    t.ontouchstart = (e) => {
        if (!isMobile()) return;
        e.stopPropagation();
        deselectAll();
        
        activeT = t;
        rightT = t; // Für Duplizieren/Löschen auf Mobile spiegeln
        t.classList.add('selected-mobile');
        
        document.getElementById('mobileActionBar').style.display = 'flex';
        
        const touch = e.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        tableStartPos = { x: parseInt(t.style.left), y: parseInt(t.style.top) };
    };

    t.onwheel = (e) => {
        if (rotating && rightT === t) {
            e.preventDefault();
            let r = (parseInt(t.dataset.rotation) || 0) + (e.deltaY > 0 ? 5 : -5);
            t.dataset.rotation = r;
            t.style.transform = `rotate(${r}deg)`;
        }
    };
    canvas.appendChild(t);
}

function deselectAll() {
    document.querySelectorAll('.table').forEach(t => t.classList.remove('selected-mobile'));
    document.getElementById('mobileActionBar').style.display = 'none';
    activeT = null;
}

// --- NEU: PRÄSENTATIONSMODUS FUNKTIONEN ---
function togglePresentationMode() {
    isPresentation = !isPresentation;
    document.body.classList.toggle('presentation-mode', isPresentation);
    
    const textOverlay = document.getElementById('presTextOverlay');
    const controls = document.getElementById('presControls');
    
    if (isPresentation) {
        textOverlay.style.display = 'block';
        controls.style.display = 'flex';
        deselectAll();
        
        // Karte automatisch so zentrieren, dass Tische sichtbar sind
        pan = { x: -4300, y: -4400 };
        updateCanvas();
    } else {
        textOverlay.style.display = 'none';
        controls.style.display = 'none';
    }
}

// "Aneinander-Klatschen" Feature
function toggleSnapToGrid(isActive) {
    isSnapActive = isActive;
    if (isActive) {
        document.querySelectorAll('.table').forEach(t => {
            let x = parseInt(t.style.left);
            let y = parseInt(t.style.top);
            // Mathematisch exakt auf das 40er Punktegitter runden
            t.style.left = (Math.round(x / 40) * 40) + 'px';
            t.style.top = (Math.round(y / 40) * 40) + 'px';
        });
    }
}

// Hochauflösender Foto-Download der Präsentation
function downloadPresImage() {
    showLoader("Generiere Bild...", 1200, () => {
        // Kontrollleiste temporär verstecken, um sie nicht auf dem Foto zu haben
        document.getElementById('presControls').style.display = 'none';
        
        html2canvas(viewport, {
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
            useCORS: true,
            scale: 2 // Verdoppelt die Schärfe des exportierten Bildes
        }).then(imgCanvas => {
            const link = document.createElement('a');
            link.download = 'sitzplan_praesentation.png';
            link.href = imgCanvas.toDataURL();
            link.click();
            
            document.getElementById('presControls').style.display = 'flex';
        });
    });
}

// --- KERN-FUNKTIONEN (SPEICHERN & EXPORT) ---
function collectData() {
    return Array.from(document.querySelectorAll('.table')).map(t => ({
        n: Array.from(t.querySelectorAll('textarea')).map(a => a.value),
        x: parseInt(t.style.left), y: parseInt(t.style.top),
        r: t.dataset.rotation, v: t.classList.contains('vertical'), type: t.dataset.type
    }));
}

function saveLocal() {
    localStorage.setItem('sitzplan_v8_final', JSON.stringify(collectData()));
    alert("Plan erfolgreich auf diesem Gerät gesichert!");
}

function exportJSON() {
    const data = JSON.stringify(collectData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sitzplan_export.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

document.getElementById('importFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            canvas.querySelectorAll('.table').forEach(t => t.remove());
            data.forEach(d => addTable(d.type || 'double', d.v, d.n, d.x, d.y, d.r));
        } catch(err) { alert("Format nicht unterstützt!"); }
        e.target.value = ""; 
    };
    reader.readAsText(file);
});

function runShare() {
    const btn = document.getElementById('shareBtn');
    const txt = document.getElementById('shareText');
    const ldr = document.getElementById('shareLoader');
    txt.style.opacity = '0.5'; ldr.style.display = 'block';

    setTimeout(() => {
        const data = btoa(encodeURIComponent(JSON.stringify(collectData())));
        const url = window.location.origin + window.location.pathname + "?p=" + data;
        navigator.clipboard.writeText(url).then(() => {
            txt.innerText = "✅ Link kopiert!"; ldr.style.display = 'none';
            setTimeout(() => { txt.innerText = "🔗 Link zum Teilen kopieren"; txt.style.opacity = '1'; }, 2000);
        });
    }, 600);
}

// --- UTILITIES ---
function runGenerate() {
    const names = document.getElementById('nameList').value.split('\n').filter(n => n.trim() !== "").sort(() => 0.5 - Math.random());
    const seats = document.querySelectorAll('.seat textarea');
    seats.forEach((s, i) => s.value = names[i] || "");
}

function toggleDrop(e) { e.stopPropagation(); document.getElementById('dropMenu').classList.toggle('show'); }
window.onclick = () => { 
    document.getElementById('dropMenu').classList.remove('remove'); 
    document.getElementById('tableContextMenu').style.display = 'none'; 
};

function changeTheme() { 
    const h = document.documentElement;
    h.setAttribute('data-theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

function triggerImport() { document.getElementById('importFile').click(); }
function startRotation() { rotating = true; rightT.style.borderColor = "var(--accent)"; document.getElementById('rotIndicator').style.display = 'flex'; }
function stopRotation() { rotating = false; if(rightT) rightT.style.borderColor = ""; document.getElementById('rotIndicator').style.display = 'none'; }
function deleteTable() { if(rightT) rightT.remove(); deselectAll(); }
function resetRotation() { if(rightT) { rightT.dataset.rotation = 0; rightT.style.transform = `rotate(0deg)`; } }
function duplicateTable() {
    const d = rightT;
    const names = Array.from(d.querySelectorAll('textarea')).map(a => a.value);
    addTable(d.dataset.type, d.classList.contains('vertical'), names, parseInt(d.style.left)+40, parseInt(d.style.top)+40, d.dataset.rotation);
    deselectAll();
}
function clearAll() { if(confirm("Gesamten Plan löschen?")) canvas.querySelectorAll('.table').forEach(t => t.remove()); }
function showLoader(msg, time, cb) {
    const l = document.getElementById('loader');
    document.getElementById('loaderMsg').innerText = msg; l.style.display = 'flex';
    setTimeout(() => { l.style.display = 'none'; if(cb) cb(); }, time);
}

window.onload = () => {
    const p = new URLSearchParams(window.location.search).get('p');
    if(p) {
        try { 
            const data = JSON.parse(decodeURIComponent(atob(p)));
            data.forEach(d => addTable(d.type, d.v, d.n, d.x, d.y, d.r)); 
        } catch(e) {}
    } else {
        const local = localStorage.getItem('sitzplan_v8_final');
        if(local) JSON.parse(local).forEach(d => addTable(d.type, d.v, d.n, d.x, d.y, d.r));
    }
};
