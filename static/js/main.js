// Main frontend logic
lucide.createIcons();
let globalData = null;
let sortDirection = 'asc'; 
// Variable para recordar qué celda resaltar al cambiar de pestaña
let currentHighlight = null; 

// --- LÓGICA DE INTERFAZ ---
function handleLogin(e) {
    e.preventDefault();
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('main-layout').classList.remove('hidden');
}

function switchTab(tabId) {
    // Limpiar highlight si no vamos a timetable
    if (tabId !== 'timetable') {
        currentHighlight = null;
    }

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
        'occupancy': 'Monitor de Ocupación',
        'finder': 'Buscador de Salas'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = titles[tabId] || '';

    if(tabId === 'occupancy' && globalData) {
        renderOccupancyChart();
    }
}

// --- NUEVA LÓGICA: BUSCADOR ---
function searchRooms() {
    if (!globalData) {
        alert("Primero debes subir un archivo Excel.");
        return;
    }

    const day = document.getElementById('find-day').value; // lunes, martes...
    const mod = parseInt(document.getElementById('find-mod').value); // 1, 2...
    const cat = document.getElementById('find-cat').value; // all, Sala...

    console.log(`Buscando: Día=${day}, Mod=${mod}, Cat=${cat}`);

    // 1. Encontrar salas ocupadas en ese bloque
    const busyRooms = globalData.schedule
        .filter(c => c.dia_norm === day && c.modulo === mod)
        .map(c => c.ubicacion);

    // 2. Filtrar salas disponibles (stats tiene todas las salas)
    let availableRooms = globalData.stats.filter(room => {
        // Filtro de Categoría
        if (cat !== 'all' && room.categoria !== cat) return false;
        
        // Filtro de Disponibilidad: La sala NO debe estar en la lista de ocupadas
        return !busyRooms.includes(room.sala);
    });

    // 3. Renderizar resultados
    const container = document.getElementById('finder-results');
    const tbody = document.getElementById('finder-table-body');
    const countLabel = document.getElementById('finder-count');
    
    tbody.innerHTML = '';
    container.classList.remove('hidden'); // Mostrar contenedor
    countLabel.innerText = `${availableRooms.length} encontrados`;

    if (availableRooms.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-500">No hay salas disponibles con esos criterios.</td></tr>`;
        return;
    }

    availableRooms.forEach(room => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="px-6 py-3 font-bold text-slate-700">${room.sala}</td>
            <td class="px-6 py-3">
                <span class="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                    ${room.categoria}
                </span>
            </td>
            <td class="px-6 py-3 text-slate-500">${room.capacidad_max}</td>
            <td class="px-6 py-3 text-right">
                <button onclick="viewRoomSchedule('${room.sala}', '${day}', ${mod})" class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded shadow-sm transition">
                    Ver Disponibilidad
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODIFICADO: CLIC EN SALA CON HIGHLIGHT ---
function viewRoomSchedule(roomName, highlightDay = null, highlightMod = null) {
    switchTab('timetable');
    const selector = document.getElementById('room-selector');
    if (selector) {
        selector.value = roomName;
        
        // Guardamos el highlight para renderizarlo
        if(highlightDay && highlightMod) {
            currentHighlight = { day: highlightDay, mod: highlightMod };
        } else {
            currentHighlight = null;
        }

        renderTimetable(roomName);
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
            
            // Reset filtros y orden
            sortDirection = 'asc';
            if(document.getElementById('filter-category')) {
                 document.getElementById('filter-category').value = 'all';
            }
            applyFiltersAndSort(); 
            
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

// --- GESTIÓN DEL MODAL ---
function toggleAddRoomModal(show) {
    const modal = document.getElementById('modal-add-room');
    if (!modal) return;
    if(show) {
        modal.classList.remove('hidden');
        const input = document.getElementById('input-room-name');
        if(input) input.focus();
    } else {
        modal.classList.add('hidden');
    }
}

async function submitNewRoom() {
    const name = document.getElementById('input-room-name').value;
    const cap = document.getElementById('input-room-cap').value;
    const cat = document.getElementById('input-room-cat').value;

    if(!name) { alert("Debes poner un nombre"); return; }

    try {
        const res = await fetch('/add_room', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                room_name: name,
                capacity: cap,
                category: cat
            })
        });
        const json = await res.json();
        if(json.success) {
            alert("Sala creada exitosamente. Vuelve a procesar el archivo para ver los cambios en la tabla.");
            toggleAddRoomModal(false);
            document.getElementById('input-room-name').value = '';
        } else {
            alert("Error: " + json.error);
        }
    } catch(e) { alert("Error conectando con servidor"); }
}

async function deleteRoom(roomName) {
    if(!confirm(`¿Estás seguro de eliminar la sala ${roomName}?`)) return;
    try {
        const res = await fetch('/delete_room', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ room_name: roomName })
        });
        const json = await res.json();
        if(json.success) {
            globalData.stats = globalData.stats.filter(r => r.sala !== roomName);
            applyFiltersAndSort();
            renderOccupancyChart();
            populateRoomSelector(globalData.stats);
        } else { alert("Error: " + json.error); }
    } catch(e) { alert("Error de conexión al eliminar."); }
}

// --- LÓGICA DE FILTRADO Y ORDENAMIENTO (Ocupación) ---

function toggleSortDirection() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    
    const btn = document.getElementById('sort-dir-btn');
    const isAlpha = document.getElementById('sort-criteria').value === 'alpha';
    btn.innerHTML = '';
    const iconName = isAlpha 
        ? (sortDirection === 'asc' ? 'arrow-up-a-z' : 'arrow-down-z-a')
        : (sortDirection === 'asc' ? 'arrow-up-0-1' : 'arrow-down-1-0');

    const i = document.createElement('i');
    i.setAttribute('data-lucide', iconName);
    i.className = "w-4 h-4";
    btn.appendChild(i);
    lucide.createIcons();

    applyFiltersAndSort();
}

function applyFiltersAndSort() {
    // Esta función se usa en la pestaña Ocupación, pero debemos verificar que existan los elementos
    if (!globalData || !globalData.stats) return;
    if (!document.getElementById('filter-category')) return; // Si estamos en otra vista que no tiene estos filtros

    let processedStats = [...globalData.stats]; 

    // 1. FILTRAR
    const catFilter = document.getElementById('filter-category').value;
    if (catFilter !== 'all') {
        processedStats = processedStats.filter(r => r.categoria === catFilter);
    }

    // 2. ORDENAR
    const criteria = document.getElementById('sort-criteria').value;
    const multiplier = sortDirection === 'asc' ? 1 : -1;

    processedStats.sort((a, b) => {
        if (criteria === 'alpha') {
            return multiplier * a.sala.localeCompare(b.sala, undefined, {numeric: true, sensitivity: 'base'});
        } else if (criteria === 'occupancy') {
            return multiplier * (a.ocupados - b.ocupados);
        } else if (criteria === 'capacity') {
            return multiplier * (a.capacidad_max - b.capacidad_max);
        }
    });

    updateOccupancyTable(processedStats);
}

// --- ACTUALIZACIÓN DE DOM ---

function updateDashboard(data) {
    document.getElementById('stat-total-courses').innerText = data.total_courses;
    document.getElementById('stat-total-rooms').innerText = data.total_rooms;
    document.getElementById('empty-state').classList.add('hidden');
}

function updateOccupancyTable(stats) {
    const tbody = document.getElementById('occupancy-table-body');
    if(!tbody) return;
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
            
            <td class="px-6 py-4 font-bold text-slate-700">
                <button onclick="viewRoomSchedule('${room.sala}')" class="text-blue-600 hover:text-blue-800 hover:underline text-left font-bold">
                    ${room.sala}
                </button>
            </td>
            
            <td class="px-6 py-4">
                <span class="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                    ${room.categoria}
                </span>
            </td>
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
    if(!selector) return;
    selector.innerHTML = '<option value="">-- Seleccione una Sala --</option>';
    stats.forEach(room => {
        const option = document.createElement('option');
        option.value = room.sala;
        option.innerText = room.sala;
        selector.appendChild(option);
    });
}

// --- RENDERIZADO DE HORARIO (CON HIGHLIGHT) ---
function renderTimetable(salaName) {
    if (!salaName || !globalData) return;

    // 1. Limpiar cuadrícula
    const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    for (let i = 1; i <= 8; i++) {
        days.forEach(day => {
            const cell = document.getElementById(`cell-${day}-${i}`);
            if (cell) {
                cell.innerHTML = ''; 
                // Limpiar estilo previo de highlight
                cell.classList.remove('bg-green-50', 'ring-2', 'ring-green-500', 'ring-inset');
            }
        });
    }

    // 2. Aplicar Highlight si existe (Efecto "Iluminado")
    if (currentHighlight) {
        const hlCell = document.getElementById(`cell-${currentHighlight.day}-${currentHighlight.mod}`);
        if (hlCell) {
            hlCell.classList.add('bg-green-50', 'ring-2', 'ring-green-500', 'ring-inset');
            hlCell.innerHTML = `
                <div class="h-full w-full flex items-center justify-center">
                    <span class="text-green-700 font-bold text-xs bg-green-100 px-2 py-1 rounded-full border border-green-200 shadow-sm animate-pulse">
                        DISPONIBLE
                    </span>
                </div>
            `;
        }
    }

    // 3. Llenar clases
    const classes = globalData.schedule.filter(c => c.ubicacion === salaName);
    classes.forEach(cls => {
        const cellId = `cell-${cls.dia_norm}-${cls.modulo}`;
        const cell = document.getElementById(cellId);
        if (cell) {
            // Si hay clase, quitamos el highlight de disponible por seguridad
            cell.classList.remove('bg-green-50', 'ring-2', 'ring-green-500', 'ring-inset');
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

// --- NUEVA LÓGICA: BUSCADOR (Con soporte "Cualquiera") ---
function searchRooms() {
    if (!globalData) {
        alert("Primero debes subir un archivo Excel.");
        return;
    }

    const selectedDay = document.getElementById('find-day').value; // 'any', 'lunes', etc.
    const mod = parseInt(document.getElementById('find-mod').value);
    const cat = document.getElementById('find-cat').value;

    const allDays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    
    // Si seleccionó "Cualquiera", revisamos todos. Si no, solo el seleccionado.
    const daysToCheck = (selectedDay === 'any') ? allDays : [selectedDay];

    // 1. Filtrar salas disponibles
    let availableRooms = globalData.stats.filter(room => {
        // Filtro de Categoría (Igual que antes)
        if (cat !== 'all' && room.categoria !== cat) return false;
        
        // Filtro de Disponibilidad:
        // Verificamos si la sala está libre en AL MENOS UNO de los días seleccionados
        const isFreeInAtLeastOneDay = daysToCheck.some(day => {
            // Buscamos si existe una clase en esta sala, este día y este módulo
            const hasClass = globalData.schedule.find(c => 
                c.ubicacion === room.sala && 
                c.dia_norm === day && 
                c.modulo === mod
            );
            return !hasClass; // Si NO tiene clase, está libre => true
        });

        return isFreeInAtLeastOneDay;
    });

    // 2. Renderizar resultados
    const container = document.getElementById('finder-results');
    const tbody = document.getElementById('finder-table-body');
    const countLabel = document.getElementById('finder-count');
    
    tbody.innerHTML = '';
    container.classList.remove('hidden');
    countLabel.innerText = `${availableRooms.length} encontrados`;

    if (availableRooms.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-500">No hay salas disponibles con esos criterios.</td></tr>`;
        return;
    }

    availableRooms.forEach(room => {
        // Calcular qué día iluminar al hacer click
        // Si eligió "Cualquiera", buscamos el primer día libre para mandarlo a la función viewRoomSchedule
        let dayToHighlight = selectedDay;
        
        if (dayToHighlight === 'any') {
            dayToHighlight = allDays.find(day => {
                const hasClass = globalData.schedule.find(c => 
                    c.ubicacion === room.sala && 
                    c.dia_norm === day && 
                    c.modulo === mod
                );
                return !hasClass;
            });
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="px-6 py-3 font-bold text-slate-700">${room.sala}</td>
            <td class="px-6 py-3">
                <span class="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                    ${room.categoria}
                </span>
            </td>
            <td class="px-6 py-3 text-slate-500">${room.capacidad_max}</td>
            <td class="px-6 py-3 text-right">
                <button onclick="viewRoomSchedule('${room.sala}', '${dayToHighlight}', ${mod})" class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded shadow-sm transition flex items-center gap-1 ml-auto">
                    Ver Disponibilidad
                    ${selectedDay === 'any' ? `<span class="text-[10px] opacity-75">(${dayToHighlight})</span>` : ''}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('date-display').innerText = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });