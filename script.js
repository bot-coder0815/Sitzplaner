let activeT = null, rightT = null, rotating = false;
let isPanning = false;
let startX, startY;
let pan = { x: -4500, y: -4500 }; // Start-Offset (Zentrum)

const canvas = document.getElementById('canvas');
const viewport = document.getElementById('viewport');

// Initialisierung
canvas.style.left = pan.x + 'px';
canvas.style.top = pan.y + 'px';

// --- PANNING LOGIK (FIXED) ---
viewport.addEventListener('mousedown', (e) => {
    // Wenn Klick auf Viewport oder das Grid-Overlay erfolgt
    if (e.target === viewport || e.target.classList.contains('grid-overlay')) {
        isPanning = true;
        startX = e.clientX - pan.x;
        startY = e.clientY - pan.y;
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        pan.x = e.clientX - startX;
        pan.y = e.clientY - startY;
        canvas.style.left = pan.x + 'px';
        canvas.style.top = pan.y + 'px';
    } else if (activeT) {
        const rect = canvas.getBoundingClientRect();
        // Position im Canvas berechnen
        let x = e.clientX - rect.left - (activeT.offsetWidth / 2);
        let y = e.clientY - rect.top - (activeT.offsetHeight / 2);
        activeT.style.left = x + 'px';
        activeT.style.top = y + 'px';
    }
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    activeT = null;
});

// --- TISCH LOGIK ---
function addTable(isV, n1 = "", n2 = "", x = 5000, y = 5000, rot = 0) {
    const t = document.createElement('div');
    t.className = 'table' + (isV ? ' vertical' : '');
    t.style.left = x + 'px';
    t.style.top = y + 'px';
    t.dataset.rotation = rot;
    t.style.transform = `rotate(${rot}deg)`;

    [n1, n2].forEach(name => {
        const seat = document.createElement('div');
        seat.className = 'seat';
        const area = document.createElement('textarea');
        area.value = name;
        area.placeholder = "Name";
        area.onmousedown = (e) => e.stopPropagation();
        area.oninput = () => { area.style.height = 'auto'; area.style.height = area.scrollHeight + 'px'; };
        seat.appendChild(area);
        t.appendChild(seat);
    });

    t.onmousedown = (e) => {
        if (e.button === 2) {
            e.preventDefault();
            rightT = t;
            const menu = document.getElementById('tableContextMenu');
            menu.style.display = 'block';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
        } else {
            if (rotating) return;
            activeT = t;
        }
        e.stopPropagation();
    };

    t.onwheel = (e) => {
        if (rotating && rightT === t) {
            e.preventDefault();
            let r = parseInt(t.dataset.rotation) + (e.deltaY > 0 ? 5 : -5);
            t.dataset.rotation = r;
            t.style.transform = `rotate(${r}deg)`;
        }
    };

    canvas.appendChild(t);
}

// --- SYSTEM FUNKTIONEN ---
function showLoader(msg, time, cb) {
    const l = document.getElementById('loader');
    document.getElementById('loaderMsg').innerText = msg;
    l.style.display = 'flex';
    setTimeout(() => { l.style.display = 'none'; if(cb) cb(); }, time);
}

function toggleDrop(e) {
    e.stopPropagation();
    document.getElementById('dropMenu').classList.toggle('show');
}

window.onclick = () => {
    document.getElementById('dropMenu').classList.remove('show');
    document.getElementById('tableContextMenu').style.display = 'none';
};

function changeTheme() {
    const h = document.documentElement;
    h.setAttribute('data-theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

function serialize() {
    return Array.from(document.querySelectorAll('.table')).map(t => ({
        n1: t.querySelectorAll('textarea')[0].value,
        n2: t.querySelectorAll('textarea')[1].value,
        x: parseInt(t.style.left), y: parseInt(t.style.top),
        r: t.dataset.rotation, v: t.classList.contains('vertical')
    }));
}

function saveLocal() {
    showLoader("Speichern...", 500, () => {
        localStorage.setItem('sitzplan_v3', JSON.stringify(serialize()));
        alert("Plan gesichert!");
    });
}

function exportJSON() {
    const data = JSON.stringify(serialize());
    const blob = new Blob([data], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sitzplan.json';
    a.click();
}

function triggerImport() { document.getElementById('importFile').click(); }

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            clearAll(true);
            data.forEach(d => addTable(d.v, d.n1, d.n2, d.x, d.y, d.r));
            showLoader("Import erfolgreich!", 600);
        } catch(err) { alert("Fehler beim Lesen der Datei!"); }
    };
    reader.readAsText(file);
}

function clearAll(force = false) {
    if (force || confirm("Sicher? Alles wird gelöscht.")) {
        canvas.querySelectorAll('.table').forEach(t => t.remove());
    }
}

function runGenerate() {
    showLoader("Mische Namen...", 800, () => {
        const names = document.getElementById('nameList').value.split('\n').filter(n => n.trim() !== "");
        const shuffled = names.sort(() => 0.5 - Math.random());
        const seats = document.querySelectorAll('.seat textarea');
        seats.forEach((s, i) => s.value = shuffled[i] || "");
    });
}

function runShare() {
    showLoader("Erstelle Link...", 500, () => {
        const encoded = btoa(encodeURIComponent(JSON.stringify(serialize())));
        const url = window.location.origin + window.location.pathname + "?p=" + encoded;
        navigator.clipboard.writeText(url).then(() => alert("Link kopiert!"));
    });
}

function startRotation() { rotating = true; rightT.style.borderColor = "#ffcc00"; document.getElementById('rotIndicator').style.display = 'flex'; }
function deleteTable() { if(rightT) rightT.remove(); }
function duplicateTable() {
    const d = rightT;
    addTable(d.classList.contains('vertical'), d.querySelectorAll('textarea')[0].value, d.querySelectorAll('textarea')[1].value, parseInt(d.style.left)+40, parseInt(d.style.top)+40, d.dataset.rotation);
}
function resetRotation() { if(rightT) { rightT.dataset.rotation = 0; rightT.style.transform = "rotate(0deg)"; } }

// Autoload bei Share-Link
window.onload = () => {
    const p = new URLSearchParams(window.location.search).get('p');
    if(p) {
        try {
            const data = JSON.parse(decodeURIComponent(atob(p)));
            data.forEach(d => addTable(d.v, d.n1, d.n2, d.x, d.y, d.r));
        } catch(e) {}
    }
};
