// Main frontend logic
lucide.createIcons();
let globalData = null; // Aquí guardaremos la respuesta del backend

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
    
    // Título dinámico
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

// --- LÓGICA DE CARGA Y COMUNICACIÓN CON FLASK ---

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
            updateOccupancyTable(globalData.stats);
            populateRoomSelector(globalData.stats);
            switchTab('occupancy');
            
            // Inicializar gráfico
            renderOccupancyChart();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión con el servidor Flask.');
    }
}

// --- NUEVO: Añadir Sala Manualmente ---
async function handleAddRoom() {
    const name = prompt("Ingrese el nombre de la nueva sala (Ej: Z900):");
    if(!name) return;

    try {
        const res = await fetch('/add_room', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ room_name: name })
        });
        const json = await res.json();
        if(json.success) {
            alert("Sala añadida. Vuelva a procesar el archivo para actualizar tablas.");
        }
    } catch(e) {
        alert("Error añadiendo sala");
    }
}

// --- ACTUALIZACIÓN DE DOM CON DATOS REALES ---

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
        tr.className = "hover:bg-slate-50 transition"; 
        tr.innerHTML = `
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
                 <span class="px-2 py-1 rounded border ${room.porcentaje >= 70 ? 'bg-red-50 border-red-200 text-red-700' : room.porcentaje >= 20 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}">
                    ${room.status_text}
                 </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
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

// --- RENDERIZADO DE HORARIO ---
function renderTimetable(salaName) {
    if (!salaName || !globalData) return;

    // 1. Limpiar cuadrícula
    const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    for (let i = 1; i <= 8; i++) {
        days.forEach(day => {
            const cell = document.getElementById(`cell-${day}-${i}`);
            if (cell) cell.innerHTML = ''; 
        });
    }

    // 2. Filtrar clases
    const classes = globalData.schedule.filter(c => c.ubicacion === salaName);

    // 3. Llenar celdas
    classes.forEach(cls => {
        const cellId = `cell-${cls.dia_norm}-${cls.modulo}`;
        const cell = document.getElementById(cellId);

        if (cell) {
            cell.innerHTML = `
                <div class="bg-blue-100 border-l-4 border-blue-600 p-2 rounded text-xs shadow-sm h-full overflow-hidden">
                    <div class="font-bold text-blue-900 truncate" title="${cls.materia}">${cls.materia}</div>
                    <div class="text-slate-600 mt-1 truncate">Grp: ${cls.grupo}</div>
                </div>
            `;
        }
    });
}

// --- GRÁFICOS ---
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
            labels: ['Saturadas (>70%)', 'Normal', 'Libres (<20%)'],
            datasets: [{
                data: [saturadas, normal, libres],
                backgroundColor: ['#ef4444', '#eab308', '#22c55e'],
                borderWidth: 0
            }]
        }
    });
}

// Fecha
document.getElementById('date-display').innerText = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });