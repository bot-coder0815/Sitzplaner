let activeT = null, rightT = null, rotating = false;
let isPanning = false;
let startX, startY;
let pan = { x: -4500, y: -4500 }; 
let zoom = 1;
let isPresentation = false;
let isSnapActive = false;

let touchTimeout = null;
let isLongPressActive = false;

const canvas = document.getElementById('canvas');
const viewport = document.getElementById('viewport');

function updateCanvas() {
    canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
}
updateCanvas();

function isMobile() { return window.innerWidth <= 768; }

// VOLLSTÄNDIGES SCREEN-FITTING (Passt Tische an JEDE Bildschirmgröße an)
function fitTablesInView() {
    const tables = document.querySelectorAll('.table');
    if (tables.length === 0) {
        pan = { x: -4500, y: -4500 }; zoom = 1;
        updateCanvas(); return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    tables.forEach(t => {
        const x = parseInt(t.style.left), y = parseInt(t.style.top);
        if (x < minX) minX = x; if (x > maxX) maxX = x + t.offsetWidth;
        if (y < minY) minY = y; if (y > maxY) maxY = y + t.offsetHeight;
    });

    const padding = isMobile() ? 50 : 120;
    const planW = (maxX - minX) + padding * 2;
    const planH = (maxY - minY) + padding * 2;
    const viewRect = viewport.getBoundingClientRect();

    zoom = Math.min(viewRect.width / planW, viewRect.height / planH, 1.4);

    pan.x = (viewRect.width / 2) - ((minX + (maxX - minX) / 2) * zoom);
    pan.y = (viewRect.height / 2) - ((minY + (maxY - minY) / 2) * zoom);
    updateCanvas();
}

window.addEventListener('resize', () => { if (isPresentation) fitTablesInView(); });

// --- DRAG LOGIK DESKTOP ---
viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.table') || e.target.closest('.pres-controls')) return;
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

// --- DRAG LOGIK MOBILE ---
viewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('.table') || e.target.closest('.pres-controls')) return;
    isPanning = true;
    startX = e.touches[0].clientX - pan.x;
    startY = e.touches[0].clientY - pan.y;
}, { passive: true });

viewport.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (isPanning) {
        pan.x = touch.clientX - startX;
        pan.y = touch.clientY - startY;
        requestAnimationFrame(updateCanvas);
    } else if (activeT && isLongPressActive && isMobile()) {
        e.preventDefault(); 
        moveTableLogic(touch.clientX, touch.clientY, activeT);
    }
}, { passive: false });

viewport.addEventListener('touchend', () => {
    isPanning = false;
    if (touchTimeout) clearTimeout(touchTimeout);
    if (isLongPressActive) {
        isLongPressActive = false;
    }
});

function moveTableLogic(clientX, clientY, targetTable) {
    const rect = canvas.getBoundingClientRect();
    let x = (clientX - rect.left) / zoom - (targetTable.offsetWidth / 2);
    let y = (clientY - rect.top) / zoom - (targetTable.offsetHeight / 2);

    if (isSnapActive) {
        x = Math.round(x / 40) * 40;
        y = Math.round(y / 40) * 40;
    }

    targetTable.style.left = x + 'px';
    targetTable.style.top = y + 'px';
}

// --- TISCH-CREATION & EVENTS ---
function addTable(type, isV, names = [], x = null, y = null, rot = 0) {
    if (x === null) { x = 4820; y = 4900; }

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
        
        area.onmousedown = (e) => e.stopPropagation();
        area.ontouchstart = (e) => e.stopPropagation();
        
        seat.appendChild(area);
        t.appendChild(seat);
    }

    t.onmousedown = (e) => {
        if (isMobile()) return;
        if (e.button === 2) {
            e.preventDefault(); rightT = t;
            const menu = document.getElementById('tableContextMenu');
            menu.style.display = 'block';
            menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
        } else {
            if (rotating) { stopRotation(); return; }
            activeT = t;
        }
        e.stopPropagation();
    };

    t.ontouchstart = (e) => {
        if (!isMobile()) return;
        e.stopPropagation();
        if (touchTimeout) clearTimeout(touchTimeout);

        touchTimeout = setTimeout(() => {
            isLongPressActive = true;
            activeT = t; rightT = t;
            isPanning = false; 
            
            document.querySelectorAll('.table').forEach(tbl => tbl.classList.remove('selected-mobile'));
            t.classList.add('selected-mobile');
            
            if (navigator.vibrate) navigator.vibrate(40);
            document.getElementById('mobileActionBar').style.display = 'flex';
        }, 400); 
    };

    t.ontouchend = () => { if (touchTimeout) clearTimeout(touchTimeout); };

    t.onwheel = (e) => {
        if (rotating && rightT === t) {
            e.preventDefault();
            let r = (parseInt(t.dataset.rotation) || 0) + (e.deltaY > 0 ? 5 : -5);
            t.dataset.rotation = r; t.style.transform = `rotate(${r}deg)`;
        }
    };
    
    canvas.appendChild(t);
    if (!isPresentation) fitTablesInView();
}

function deselectAll() {
    document.querySelectorAll('.table').forEach(t => t.classList.remove('selected-mobile'));
    document.getElementById('mobileActionBar').style.display = 'none';
    activeT = null;
}

// --- PRÄSENTATIONSMODUS ENGINE ---
function togglePresentationMode() {
    isPresentation = !isPresentation;
    document.body.classList.toggle('presentation-mode', isPresentation);
    
    const textOverlay = document.getElementById('presTextOverlay');
    const controls = document.getElementById('presControls');
    
    if (isPresentation) {
        textOverlay.style.display = 'block';
        controls.style.display = 'flex';
        deselectAll();
        setTimeout(fitTablesInView, 100); 
    } else {
        textOverlay.style.display = 'none';
        controls.style.display = 'none';
        zoom = 1; 
        fitTablesInView();
    }
}

function toggleSnapToGrid(isActive) {
    isSnapActive = isActive;
    if (isActive) {
        document.querySelectorAll('.table').forEach(t => {
            let x = parseInt(t.style.left);
            let y = parseInt(t.style.top);
            t.style.left = (Math.round(x / 40) * 40) + 'px';
            t.style.top = (Math.round(y / 40) * 40) + 'px';
        });
    }
}

function downloadPresImage() {
    showLoader("Sitzplan wird fotografiert...", 1000, () => {
        const controls = document.getElementById('presControls');
        controls.style.display = 'none'; 
        
        html2canvas(viewport, {
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
            useCORS: true,
            scale: 2
        }).then(imgCanvas => {
            const link = document.createElement('a');
            link.download = 'sitzplan_export.png';
            link.href = imgCanvas.toDataURL();
            link.click();
            controls.style.display = 'flex';
        });
    });
}

// --- DATA ENGINE & REPARIERTER IMPORT ---
function collectData() {
    return Array.from(document.querySelectorAll('.table')).map(t => ({
        n: Array.from(t.querySelectorAll('textarea')).map(a => a.value),
        x: parseInt(t.style.left), y: parseInt(t.style.top),
        r: t.dataset.rotation, v: t.classList.contains('vertical'), type: t.dataset.type
    }));
}

function saveLocal() {
    localStorage.setItem('sitzplan_v12_core', JSON.stringify(collectData()));
    alert("Plan erfolgreich auf diesem Gerät gesichert!");
}

function exportJSON() {
    const data = JSON.stringify(collectData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sitzplan.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

function triggerImport() { 
    const fileInput = document.getElementById('importFile');
    if (fileInput) {
        fileInput.click(); 
    } else {
        console.error("Import-Button im HTML nicht gefunden!");
    }
}

// Zentrale Start- und Setup-Zentrale (DOM Ready)
window.onload = () => {
    const fileInput = document.getElementById('importFile');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if(!file) return;
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    
                    canvas.querySelectorAll('.table').forEach(t => t.remove());
                    deselectAll();
                    
                    data.forEach(d => {
                        addTable(d.type || 'double', d.v, d.n, d.x, d.y, d.r);
                    });
                    
                    setTimeout(fitTablesInView, 150);
                } catch(err) { 
                    alert("Format-Fehler oder beschädigte JSON-Datei!"); 
                }
                e.target.value = ""; 
            };
            reader.readAsText(file);
        });
    }

    const p = new URLSearchParams(window.location.search).get('p');
    if(p) {
        try { 
            const data = JSON.parse(decodeURIComponent(atob(p)));
            data.forEach(d => addTable(d.type, d.v, d.n, d.x, d.y, d.r)); 
        } catch(e) {}
    } else {
        const local = localStorage.getItem('sitzplan_v12_core');
        if(local) {
            try {
                JSON.parse(local).forEach(d => addTable(d.type, d.v, d.n, d.x, d.y, d.r));
            } catch(e) {
                localStorage.removeItem('sitzplan_v12_core');
            }
        } else {
            addTable('pult', false, ["Lehrer"], 4800, 4700, 0);
            addTable('double', false, ["", ""], 4650, 4850, 0);
            addTable('double', false, ["", ""], 4950, 4850, 0);
        }
    }
    
    setTimeout(fitTablesInView, 200);
};

// --- WEITERE HILFSFUNKTIONEN ---
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

function runGenerate() {
    const names = document.getElementById('nameList').value.split('\n').filter(n => n.trim() !== "").sort(() => 0.5 - Math.random());
    const seats = document.querySelectorAll('.seat textarea');
    seats.forEach((s, i) => s.value = names[i] || "");
}

function toggleDrop(e) { 
    e.stopPropagation(); 
    document.getElementById('dropMenu').classList.toggle('show'); 
}

window.addEventListener('click', (e) => {
    if (!e.target.matches('.drop-btn')) {
        document.getElementById('dropMenu').classList.remove('show');
    }
    document.getElementById('tableContextMenu').style.display = 'none';
});

function changeTheme() { 
    const h = document.documentElement;
    h.setAttribute('data-theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

function startRotation() { rotating = true; rightT.style.borderColor = "var(--accent)"; document.getElementById('rotIndicator').style.display = 'flex'; }
function stopRotation() { rotating = false; if(rightT) rightT.style.borderColor = ""; document.getElementById('rotIndicator').style.none = 'none'; }
function deleteTable() { if(rightT) rightT.remove(); deselectAll(); fitTablesInView(); }
function resetRotation() { if(rightT) { rightT.dataset.rotation = 0; rightT.style.transform = `rotate(0deg)`; } }
function duplicateTable() {
    const d = rightT;
    const names = Array.from(d.querySelectorAll('textarea')).map(a => a.value);
    addTable(d.dataset.type, d.classList.contains('vertical'), names, parseInt(d.style.left)+40, parseInt(d.style.top)+40, d.dataset.rotation);
    deselectAll();
}
function clearAll() { if(confirm("Gesamten Plan löschen?")) { canvas.querySelectorAll('.table').forEach(t => t.remove()); deselectAll(); fitTablesInView(); } }
function showLoader(msg, time, cb) {
    const l = document.getElementById('loader');
    document.getElementById('loaderMsg').innerText = msg; l.style.display = 'flex';
    setTimeout(() => { l.style.display = 'none'; if(cb) cb(); }, time);
}
