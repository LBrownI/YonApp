// Main frontend logic
lucide.createIcons();
let globalData = null;
let sortDirection = 'asc'; // Estado inicial: Ascendente

// --- LÓGICA DE INTERFAZ ---
function handleLogin(e) {
    e.preventDefault();
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('main-layout').classList.remove('hidden');
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-white');
        btn.classList.add('text-slate-300');
    });
    const activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) activeBtn.classList.add('bg-slate-800', 'text-white');
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const view = document.getElementById('tab-' + tabId);
    if (view) view.classList.remove('hidden');
    
    const titles = {
        'dashboard': 'Dashboard General',
        'upload': 'Importación de Datos',
        'timetable': 'Visualizador de Horarios',
        'occupancy': 'Monitor de Ocupación'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = titles[tabId] || '';

    if(tabId === 'occupancy' && globalData) {
        renderOccupancyChart();
    }
}

function previewFile() {
    const input = document.getElementById('excelFile');
    const display = document.getElementById('file-name-display');
    if(input && input.files.length > 0) {
        display.innerText = input.files[0].name;
        document.getElementById('upload-preview').classList.remove('hidden');
    }
}

async function uploadFileToBackend() {
    const input = document.getElementById('excelFile');
    const formData = new FormData();
    formData.append('file', input.files[0]);

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.success) {
            globalData = result.data;
            alert('¡Datos procesados correctamente!');
            updateDashboard(globalData);
            
            // Ordenamiento inicial
            sortDirection = 'asc';
            applySort(); 
            
            populateRoomSelector(globalData.stats);
            switchTab('occupancy');
            renderOccupancyChart();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión con el servidor Flask.');
    }
}

async function handleAddRoom() {
    const name = prompt("Ingrese el nombre de la nueva sala (Ej: Z900):");
    if(!name) return;
    try {
        const res = await fetch('/add_room', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ room_name: name })
        });
        const json = await res.json();
        if(json.success) alert("Sala añadida. Vuelva a procesar el archivo.");
    } catch(e) { alert("Error añadiendo sala"); }
}

async function deleteRoom(roomName) {
    if(!confirm(`¿Estás seguro de eliminar la sala ${roomName}?`)) return;

    try {
        const res = await fetch('/delete_room', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ room_name: roomName })
        });
        const json = await res.json();
        
        if(json.success) {
            globalData.stats = globalData.stats.filter(r => r.sala !== roomName);
            applySort(); // Re-aplicar orden actual
            renderOccupancyChart();
            populateRoomSelector(globalData.stats);
        } else {
            alert("Error: " + json.error);
        }
    } catch(e) {
        alert("Error de conexión al eliminar.");
    }
}

// --- NUEVA LÓGICA DE ORDENAMIENTO CON DIRECCIÓN ---

function toggleSortDirection() {
    // 1. Cambiar estado
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    
    // 2. Cambiar icono visualmente
    const btn = document.getElementById('sort-dir-btn');
    const isAlpha = document.getElementById('sort-criteria').value === 'alpha';
    
    // Limpiar contenido del botón
    btn.innerHTML = '';
    
    // Crear nuevo icono dependiendo de si es texto o número y dirección
    const iconName = isAlpha 
        ? (sortDirection === 'asc' ? 'arrow-up-a-z' : 'arrow-down-z-a')
        : (sortDirection === 'asc' ? 'arrow-up-0-1' : 'arrow-down-1-0');

    const i = document.createElement('i');
    i.setAttribute('data-lucide', iconName);
    i.className = "w-4 h-4";
    btn.appendChild(i);
    
    lucide.createIcons(); // Renderizar el nuevo icono

    // 3. Aplicar orden
    applySort();
}

function applySort() {
    if (!globalData || !globalData.stats) return;
    
    const criteria = document.getElementById('sort-criteria').value;
    const stats = globalData.stats;
    const multiplier = sortDirection === 'asc' ? 1 : -1;

    stats.sort((a, b) => {
        let valA, valB;

        if (criteria === 'alpha') {
            // Orden alfabético
            return multiplier * a.sala.localeCompare(b.sala, undefined, {numeric: true, sensitivity: 'base'});
        } else if (criteria === 'occupancy') {
            // Orden por ocupación (bloques)
            return multiplier * (a.ocupados - b.ocupados);
        } else if (criteria === 'capacity') {
            // Orden por capacidad
            return multiplier * (a.capacidad_max - b.capacidad_max);
        }
    });

    updateOccupancyTable(stats);
}


// --- ACTUALIZACIÓN DE DOM ---

function updateDashboard(data) {
    document.getElementById('stat-total-courses').innerText = data.total_courses;
    document.getElementById('stat-total-rooms').innerText = data.total_rooms;
    document.getElementById('empty-state').classList.add('hidden');
}

function updateOccupancyTable(stats) {
    const tbody = document.getElementById('occupancy-table-body');
    tbody.innerHTML = '';

    stats.forEach(room => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition group";
        tr.innerHTML = `
            <td class="px-4 py-4 text-center">
                <button onclick="deleteRoom('${room.sala}')" class="text-slate-400 hover:text-red-500 transition p-1 rounded hover:bg-red-50" title="Eliminar Sala">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
            <td class="px-6 py-4 font-bold text-slate-700">${room.sala}</td>
            <td class="px-6 py-4 text-slate-500">${room.capacidad_max} est.</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <span class="font-mono font-bold">${room.ocupados}</span>
                    <span class="text-xs text-slate-400">bloques</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="w-full bg-slate-200 rounded-full h-2.5">
                    <div class="${room.status_class.replace('ocup-high','bg-red-500').replace('ocup-med','bg-yellow-500').replace('ocup-low','bg-green-500')} h-2.5 rounded-full" style="width: ${room.porcentaje}%"></div>
                </div>
                <span class="text-xs font-bold mt-1 block text-right">${room.porcentaje}%</span>
            </td>
            <td class="px-6 py-4 font-bold text-xs">
                 <span class="px-2 py-1 rounded border ${
                     room.status_text === 'Saturada' ? 'bg-red-50 border-red-200 text-red-700' : 
                     room.status_text === 'Normal' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 
                     'bg-green-50 border-green-200 text-green-700'
                 }">
                    ${room.status_text}
                 </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function populateRoomSelector(stats) {
    const selector = document.getElementById('room-selector');
    selector.innerHTML = '<option value="">-- Seleccione una Sala --</option>';
    stats.forEach(room => {
        const option = document.createElement('option');
        option.value = room.sala;
        option.innerText = room.sala;
        selector.appendChild(option);
    });
}

function renderTimetable(salaName) {
    if (!salaName || !globalData) return;
    const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    for (let i = 1; i <= 8; i++) {
        days.forEach(day => {
            const cell = document.getElementById(`cell-${day}-${i}`);
            if (cell) cell.innerHTML = ''; 
        });
    }
    const classes = globalData.schedule.filter(c => c.ubicacion === salaName);
    classes.forEach(cls => {
        const cellId = `cell-${cls.dia_norm}-${cls.modulo}`;
        const cell = document.getElementById(cellId);
        if (cell) {
            cell.innerHTML = `
                <div class="bg-blue-100 border-l-4 border-blue-600 p-1.5 rounded text-xs shadow-sm h-full overflow-hidden flex flex-col justify-center items-center text-center">
                    <div class="font-bold text-blue-900 truncate w-full" title="NRC: ${cls.nrc} Sec: ${cls.seccion}">
                        NRC ${cls.nrc} – ${cls.seccion}
                    </div>
                </div>
            `;
        }
    });
}

let chartInstance = null;
function renderOccupancyChart() {
    const ctx = document.getElementById('occupancyChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    let saturadas = globalData.stats.filter(s => s.status_text === 'Saturada').length;
    let normal = globalData.stats.filter(s => s.status_text === 'Normal').length;
    let libres = globalData.stats.filter(s => s.status_text === 'Libre').length;

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Saturadas (≥30 blq)', 'Normal (≥15 blq)', 'Libres (<15 blq)'],
            datasets: [{
                data: [saturadas, normal, libres],
                backgroundColor: ['#ef4444', '#eab308', '#22c55e'],
                borderWidth: 0
            }]
        }
    });
}

document.getElementById('date-display').innerText = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });