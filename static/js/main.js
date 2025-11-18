// Main frontend logic moved from template to static JS
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
        // Petición al backend Python
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();

        if (result.success) {
            globalData = result.data; // Guardar datos en memoria
            alert('¡Datos procesados por Python correctamente!');
            updateDashboard(globalData);
            updateOccupancyTable(globalData.stats);
            populateRoomSelector(globalData.stats);
            switchTab('occupancy');
        } else {
            alert('Error: ' + result.error);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión con el servidor Flask.');
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
    tbody.innerHTML = ''; // Limpiar

    stats.forEach(room => {
        const tr = document.createElement('tr');
        tr.className = room.status_class; // Clase de color desde Python
        tr.innerHTML = `
            <td class="px-6 py-4 font-bold">${room.sala}</td>
            <td class="px-6 py-4">${room.ocupados} bloques / sem</td>
            <td class="px-6 py-4 font-bold">${room.porcentaje}%</td>
            <td class="px-6 py-4 font-bold flex items-center gap-2">
                <div class="w-3 h-3 rounded-full ${room.dot_color}"></div>
                ${room.status_text}
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
    const container = document.getElementById('timetable-container');
    if (!salaName || !globalData) return;

    // Filtrar clases solo para esta sala
    const classes = globalData.schedule.filter(c => c.ubicacion === salaName);

    // Crear tabla simple
    let html = `
        <h3 class="text-lg font-bold mb-4 text-slate-800">Horario: ${salaName}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    if (classes.length === 0) {
        html += `<p>No hay clases asignadas.</p>`;
    } else {
        classes.forEach(cls => {
            html += `
                <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded shadow-sm">
                    <div class="font-bold text-blue-900">${cls.materia}</div>
                    <div class="text-sm text-blue-700 mt-1">🕒 ${cls.tiempo}</div>
                    <div class="text-xs text-slate-500 mt-2">Grupo: ${cls.grupo || 'General'}</div>
                </div>
            `;
        });
    }
    html += `</div>`;
    container.innerHTML = html;
}

// --- GRÁFICOS ---
let chartInstance = null;
function renderOccupancyChart() {
    const ctx = document.getElementById('occupancyChart').getContext('2d');
    if (chartInstance) chartInstance.destroy(); // Reiniciar si existe

    // Contar estados
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
