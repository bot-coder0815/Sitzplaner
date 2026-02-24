let activeT = null, rightT = null, rotating = false;
let isPanning = false;
let startX, startY;
let pan = { x: -4500, y: -4500 }; 

const canvas = document.getElementById('canvas');
const viewport = document.getElementById('viewport');

function updateCanvas() {
    canvas.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
}
updateCanvas();

// PANNING
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
    } else if (activeT) {
        const rect = canvas.getBoundingClientRect();
        activeT.style.left = (e.clientX - rect.left - (activeT.offsetWidth / 2)) + 'px';
        activeT.style.top = (e.clientY - rect.top - (activeT.offsetHeight / 2)) + 'px';
    }
});

window.addEventListener('mouseup', () => { isPanning = false; activeT = null; });

// TISCH SPAWN & LOGIK
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
        area.onmousedown = (e) => e.stopPropagation();
        seat.appendChild(area);
        t.appendChild(seat);
    }

    t.onmousedown = (e) => {
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

// DATEN ERFASSEN (Für Speichern/Export/Share)
function collectData() {
    return Array.from(document.querySelectorAll('.table')).map(t => ({
        n: Array.from(t.querySelectorAll('textarea')).map(a => a.value),
        x: parseInt(t.style.left),
        y: parseInt(t.style.top),
        r: t.dataset.rotation,
        v: t.classList.contains('vertical'),
        type: t.dataset.type
    }));
}

// SPEICHERN & EXPORT FIX
function saveLocal() {
    const data = JSON.stringify(collectData());
    localStorage.setItem('sitzplan_final_v7', data);
    alert("Plan erfolgreich im Browser gespeichert!");
}

function exportJSON() {
    const data = JSON.stringify(collectData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mein_sitzplan.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function triggerImport() { document.getElementById('importFile').click(); }

document.getElementById('importFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            canvas.querySelectorAll('.table').forEach(t => t.remove());
            data.forEach(d => addTable(d.type || 'double', d.v, d.n, d.x, d.y, d.r));
        } catch(err) { alert("Fehler beim Laden der Datei!"); }
        e.target.value = ""; 
    };
    reader.readAsText(file);
});

// WEITERE FUNKTIONEN
function runShare() {
    const btn = document.getElementById('shareBtn');
    const txt = document.getElementById('shareText');
    const ldr = document.getElementById('shareLoader');
    txt.style.opacity = '0.5'; ldr.style.display = 'block';

    setTimeout(() => {
        const data = btoa(encodeURIComponent(JSON.stringify(collectData())));
        const url = window.location.origin + window.location.pathname + "?p=" + data;
        navigator.clipboard.writeText(url).then(() => {
            txt.innerText = "✅ Link kopiert!";
            ldr.style.display = 'none';
            setTimeout(() => { txt.innerText = "🔗 Link zum Teilen kopieren"; txt.style.opacity = '1'; }, 2000);
        });
    }, 600);
}

function showLoader(msg, time, cb) {
    const l = document.getElementById('loader');
    document.getElementById('loaderMsg').innerText = msg;
    l.style.display = 'flex';
    setTimeout(() => { l.style.display = 'none'; if(cb) cb(); }, time);
}

function runGenerate() {
    const names = document.getElementById('nameList').value.split('\n').filter(n => n.trim() !== "").sort(() => 0.5 - Math.random());
    const seats = document.querySelectorAll('.seat textarea');
    seats.forEach((s, i) => s.value = names[i] || "");
}

function toggleDrop(e) { e.stopPropagation(); document.getElementById('dropMenu').classList.toggle('show'); }
window.onclick = () => { 
    document.getElementById('dropMenu').classList.remove('show'); 
    document.getElementById('tableContextMenu').style.display = 'none'; 
};

function changeTheme() { 
    const h = document.documentElement;
    h.setAttribute('data-theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

function startRotation() { rotating = true; rightT.style.borderColor = "var(--accent)"; document.getElementById('rotIndicator').style.display = 'flex'; }
function stopRotation() { rotating = false; if(rightT) rightT.style.borderColor = ""; document.getElementById('rotIndicator').style.display = 'none'; }
function deleteTable() { if(rightT) rightT.remove(); }
function resetRotation() { if(rightT) { rightT.dataset.rotation = 0; rightT.style.transform = `rotate(0deg)`; } }
function duplicateTable() {
    const d = rightT;
    const names = Array.from(d.querySelectorAll('textarea')).map(a => a.value);
    addTable(d.dataset.type, d.classList.contains('vertical'), names, parseInt(d.style.left)+30, parseInt(d.style.top)+30, d.dataset.rotation);
}
function clearAll() { if(confirm("Alles löschen?")) canvas.querySelectorAll('.table').forEach(t => t.remove()); }

window.onload = () => {
    const p = new URLSearchParams(window.location.search).get('p');
    if(p) {
        try { 
            const data = JSON.parse(decodeURIComponent(atob(p)));
            data.forEach(d => addTable(d.type, d.v, d.n, d.x, d.y, d.r)); 
        } catch(e) {}
    } else {
        const local = localStorage.getItem('sitzplan_final_v7');
        if(local) JSON.parse(local).forEach(d => addTable(d.type, d.v, d.n, d.x, d.y, d.r));
    }
};