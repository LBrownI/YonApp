// rooms.js - Lógica Específica del Módulo de Salas
let globalData = null;
let sortDirection = 'asc'; 
let currentHighlight = null; 
let roomPendingDelete = null; 
let blockToDelete = null; // Para seguimiento de bloque a eliminar

// --- UTILIDADES DEL MÓDULO ---
function handleRoomsClick() {
    if (globalData) {
        switchTab('occupancy');
    } else {
        switchTab('upload');
        // Asegurar que el sidebar esté en modo salas
        if(document.getElementById('nav-rooms').classList.contains('hidden')) {
             setSidebarMode('rooms');
        }
    }
}

function resetRoomHighlights() {
    currentHighlight = null;
    closeDetailsPanel();
}

// --- CARGA DE ARCHIVOS ---
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

    toggleLoading(true); // Llama a main.js

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error del Servidor (${response.status})`);
        }

        const result = await response.json();
        toggleLoading(false);

        if (result.success) {
            globalData = result.data;
            
            try {
                updateDashboard(globalData);
                sortDirection = 'asc';
                if(document.getElementById('filter-category')) document.getElementById('filter-category').value = 'all';
                applyFiltersAndSort(); 
                populateRoomSelector(globalData.stats);
                
                showStatusModal('success', '¡Carga Exitosa!', 'El archivo se procesó correctamente.');
                switchTab('occupancy');
                setTimeout(renderOccupancyChart, 100);

            } catch (uiError) {
                console.error("Error Renderizando UI:", uiError);
            }

        } else {
            showStatusModal('error', 'Error de Datos', result.error || 'Problema al leer el archivo.');
        }

    } catch (error) {
        toggleLoading(false);
        console.error("Error Fatal:", error);
        let msg = error.message || 'No se pudo conectar con el backend.';
        if(msg.includes('<html')) msg = 'Error interno del servidor. Revisa la consola.';
        showStatusModal('error', 'Error de Conexión', msg);
    }
}

// --- GESTIÓN DE SALAS (CRUD) ---
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
            body: JSON.stringify({ room_name: name, capacity: cap, category: cat })
        });
        const json = await res.json();
        if(json.success) {
            toggleAddRoomModal(false);
            document.getElementById('input-room-name').value = '';
            showStatusModal('success', 'Sala Creada', 'La sala se añadió correctamente.');
        } else {
            showStatusModal('error', 'Error', json.error);
        }
    } catch(e) { showStatusModal('error', 'Error', 'Error de conexión'); }
}

function deleteRoom(roomName) {
    roomPendingDelete = roomName;
    document.getElementById('delete-room-name').innerText = roomName;
    document.getElementById('modal-delete-confirm').classList.remove('hidden');
}

function closeRoomDeleteModal() {
    document.getElementById('modal-delete-confirm').classList.add('hidden');
    roomPendingDelete = null;
}

async function confirmDeleteRoom() {
    if (!roomPendingDelete) return;
    try {
        const res = await fetch('/delete_room', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ room_name: roomPendingDelete })
        });
        const json = await res.json();
        closeRoomDeleteModal();
        if(json.success) {
            globalData.stats = globalData.stats.filter(r => r.sala !== roomPendingDelete);
            applyFiltersAndSort();
            renderOccupancyChart();
            populateRoomSelector(globalData.stats);
        } else { 
            showStatusModal('error', 'Error', json.error);
        }
    } catch(e) { 
        closeRoomDeleteModal();
        showStatusModal('error', 'Error', 'Error de conexión al eliminar.'); 
    }
}

// --- BUSCADOR Y FILTROS ---
function toggleSortDirection() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    const btn = document.getElementById('sort-dir-btn');
    if(btn) {
        btn.innerHTML = '';
        const iconName = (document.getElementById('sort-criteria').value === 'alpha') 
            ? (sortDirection === 'asc' ? 'arrow-up-a-z' : 'arrow-down-z-a') 
            : (sortDirection === 'asc' ? 'arrow-up-0-1' : 'arrow-down-1-0');
        const i = document.createElement('i');
        i.setAttribute('data-lucide', iconName);
        i.className = "w-4 h-4";
        btn.appendChild(i);
        lucide.createIcons();
    }
    applyFiltersAndSort();
}

function applyFiltersAndSort() {
    if (!globalData || !globalData.stats) return;
    if (!document.getElementById('filter-category')) return;

    let processedStats = [...globalData.stats]; 
    const catFilter = document.getElementById('filter-category').value;
    if (catFilter !== 'all') processedStats = processedStats.filter(r => r.categoria === catFilter);
    
    const criteria = document.getElementById('sort-criteria').value;
    const multiplier = sortDirection === 'asc' ? 1 : -1;

    processedStats.sort((a, b) => {
        if (criteria === 'alpha') return multiplier * a.sala.localeCompare(b.sala, undefined, {numeric: true, sensitivity: 'base'});
        else if (criteria === 'occupancy') return multiplier * (a.ocupados - b.ocupados);
        else if (criteria === 'capacity') return multiplier * (a.capacidad_max - b.capacidad_max);
    });
    updateOccupancyTable(processedStats);
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
                <button onclick="deleteRoom('${room.sala}')" class="text-slate-400 hover:text-red-500 transition p-1 rounded hover:bg-red-50" title="Eliminar Sala"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
            <td class="px-6 py-4 font-bold text-slate-700">
                <button onclick="viewRoomSchedule('${room.sala}')" class="text-blue-600 hover:text-blue-800 hover:underline text-left font-bold">${room.sala}</button>
            </td>
            <td class="px-6 py-4"><span class="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">${room.categoria}</span></td>
            <td class="px-6 py-4 text-slate-500">${room.capacidad_max} est.</td>
            <td class="px-6 py-4"><div class="flex items-center gap-2"><span class="font-mono font-bold">${room.ocupados}</span><span class="text-xs text-slate-400">bloques</span></div></td>
            <td class="px-6 py-4"><div class="w-full bg-slate-200 rounded-full h-2.5"><div class="${room.status_class.replace('ocup-high','bg-red-500').replace('ocup-med','bg-yellow-500').replace('ocup-low','bg-green-500')} h-2.5 rounded-full" style="width: ${room.porcentaje}%"></div></div><span class="text-xs font-bold mt-1 block text-right">${room.porcentaje}%</span></td>
            <td class="px-6 py-4 font-bold text-xs"><span class="px-2 py-1 rounded border ${room.status_text === 'Saturada' ? 'bg-red-50 border-red-200 text-red-700' : room.status_text === 'Normal' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'}">${room.status_text}</span></td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function searchRooms() {
    if (!globalData) {
        showStatusModal('error', 'Sin Datos', 'Primero debes subir un archivo Excel.');
        return;
    }
    const selectedDay = document.getElementById('find-day').value; 
    const mod = parseInt(document.getElementById('find-mod').value);
    const cat = document.getElementById('find-cat').value;
    const allDays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const daysToCheck = (selectedDay === 'any') ? allDays : [selectedDay];

    let availableRooms = globalData.stats.filter(room => {
        if (cat !== 'all' && room.categoria !== cat) return false;
        return daysToCheck.some(day => !globalData.schedule.find(c => c.ubicacion === room.sala && c.dia_norm === day && c.modulo === mod));
    });

    const container = document.getElementById('finder-results');
    const tbody = document.getElementById('finder-table-body');
    const countLabel = document.getElementById('finder-count');
    tbody.innerHTML = '';
    container.classList.remove('hidden');
    countLabel.innerText = `${availableRooms.length} encontrados`;

    if (availableRooms.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-500">No hay salas disponibles.</td></tr>`;
        return;
    }

    availableRooms.forEach(room => {
        let dayToHighlight = selectedDay === 'any' ? allDays.find(day => !globalData.schedule.find(c => c.ubicacion === room.sala && c.dia_norm === day && c.modulo === mod)) : selectedDay;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="px-6 py-3 font-bold text-slate-700">${room.sala}</td>
            <td class="px-6 py-3 text-xs">${room.categoria}</td>
            <td class="px-6 py-3 text-slate-500">${room.capacidad_max}</td>
            <td class="px-6 py-3 text-right">
                <button onclick="viewRoomSchedule('${room.sala}', '${dayToHighlight}', ${mod})" class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded shadow-sm transition flex items-center gap-1 ml-auto">
                    Ver Disponibilidad ${selectedDay === 'any' ? `<span class="opacity-75 text-[10px]">(${dayToHighlight})</span>` : ''}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function viewRoomSchedule(roomName, highlightDay, highlightMod) {
    switchTab('timetable');
    const selector = document.getElementById('room-selector');
    if (selector) {
        selector.value = roomName;
        currentHighlight = (highlightDay && highlightMod) ? { day: highlightDay, mod: highlightMod } : null;
        renderTimetable(roomName);
    }
}

// --- RENDERIZADO DE HORARIO ---
function renderTimetable(salaName) {
    if (!salaName || !globalData) return;
    const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    for (let i = 1; i <= 8; i++) {
        days.forEach(day => {
            const cell = document.getElementById(`cell-${day}-${i}`);
            if (cell) {
                cell.innerHTML = ''; 
                cell.classList.remove('bg-green-50', 'ring-2', 'ring-green-500', 'ring-inset');
            }
        });
    }
    if (currentHighlight) {
        const hlCell = document.getElementById(`cell-${currentHighlight.day}-${currentHighlight.mod}`);
        if (hlCell) {
            hlCell.classList.add('bg-green-50', 'ring-2', 'ring-green-500', 'ring-inset');
            hlCell.innerHTML = `<div class="h-full w-full flex items-center justify-center"><span class="text-green-700 font-bold text-xs bg-green-100 px-2 py-1 rounded-full border border-green-200 shadow-sm animate-pulse">DISPONIBLE</span></div>`;
        }
    }
    const classes = globalData.schedule.filter(c => c.ubicacion === salaName);
    classes.forEach(cls => {
        const cellId = `cell-${cls.dia_norm}-${cls.modulo}`;
        const cell = document.getElementById(cellId);
        if (cell) {
            cell.classList.remove('bg-green-50', 'ring-2', 'ring-green-500', 'ring-inset');
            const clsString = encodeURIComponent(JSON.stringify(cls)).replace(/'/g, "%27");
            
            const isManual = cls.type === 'manual';
            const cardClasses = isManual 
                ? 'bg-purple-100 border-purple-600 hover:bg-purple-200 text-purple-900' 
                : 'bg-blue-100 border-blue-600 hover:bg-blue-200 text-blue-900';

            cell.innerHTML = `
                <div onclick="openDetailsPanel('${clsString}')" class="${cardClasses} border-l-4 p-1.5 rounded text-xs shadow-sm h-full overflow-hidden flex flex-col justify-center items-center text-center cursor-pointer transition-colors group">
                    <div class="font-bold w-full leading-tight group-hover:scale-105 transition-transform" title="NRC: ${cls.nrc} Sec: ${cls.seccion}">
                        NRC ${cls.nrc} – ${cls.seccion}
                    </div>
                </div>
            `;
        }
    });
}

function openDetailsPanel(encodedCls) {
    const cls = JSON.parse(decodeURIComponent(encodedCls));
    const panel = document.getElementById('details-panel');
    const content = document.getElementById('details-content');

    content.innerHTML = `
        <div class="space-y-3">
            <div>
                <label class="block text-xs font-bold text-slate-400 uppercase">Asignatura</label>
                <p class="text-slate-800 font-semibold">${cls.materia}</p>
                <p class="text-xs text-slate-500">${cls.codigo_materia || ''}</p>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase">NRC</label>
                    <p class="text-slate-800">${cls.nrc}</p>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase">Sección</label>
                    <p class="text-slate-800">${cls.seccion}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase">Curso</label>
                    <p class="text-slate-800">${cls.n_curso}</p>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase">Componente</label>
                    <p class="text-slate-800">${cls.componente}</p>
                </div>
            </div>
            <div class="border-t border-slate-100 pt-3">
                <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Docente</label>
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><i data-lucide="user" class="w-4 h-4"></i></div>
                    <p class="text-slate-800 text-sm">${cls.profesor}</p>
                </div>
            </div>
            <div class="border-t border-slate-100 pt-3">
                <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Duración</label>
                <div class="bg-slate-50 p-2 rounded text-xs text-slate-600 flex justify-between">
                    <span>${cls.fecha_ini}</span><i data-lucide="arrow-right" class="w-3 h-3 self-center"></i><span>${cls.fecha_term}</span>
                </div>
            </div>
            
            <div class="pt-4 mt-auto">
                <button onclick="openBlockDeleteModal('${encodedCls}')" class="w-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-2 rounded border border-red-200 transition flex items-center justify-center gap-2">
                    <i data-lucide="trash-2" class="w-4 h-4"></i> Eliminar Bloque
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
    panel.classList.remove('w-0', 'opacity-0', 'translate-x-full');
    panel.classList.add('w-auto', 'opacity-100', 'translate-x-0');
}

function closeDetailsPanel() {
    const panel = document.getElementById('details-panel');
    if(panel) {
        panel.classList.add('w-0', 'opacity-0', 'translate-x-full');
        panel.classList.remove('w-auto', 'opacity-100', 'translate-x-0');
    }
}

function updateDashboard(data) {
    if(document.getElementById('stat-total-courses')) document.getElementById('stat-total-courses').innerText = data.total_courses;
    if(document.getElementById('stat-total-rooms')) document.getElementById('stat-total-rooms').innerText = data.total_rooms;
    if(document.getElementById('empty-state')) document.getElementById('empty-state').classList.add('hidden');
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

let chartInstance = null;
function renderOccupancyChart() {
    const ctxEl = document.getElementById('occupancyChart');
    if(!ctxEl) return; 
    const ctx = ctxEl.getContext('2d');
    
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

// --- ASIGNACIÓN MANUAL DE ASIGNATURAS ---
function openAssignModal() {
    const selector = document.getElementById('room-selector');
    if (!selector || !selector.value) {
        showStatusModal('error', 'Error', 'Debe seleccionar una sala primero.');
        return;
    }
    
    const modal = document.getElementById('modal-assign-subject');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('assign-nrc').value = '';
        document.getElementById('assign-section').value = '';
        document.getElementById('assign-nrc').focus();
    }
}

function closeAssignModal() {
    const modal = document.getElementById('modal-assign-subject');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function submitAssignment() {
    const selector = document.getElementById('room-selector');
    const nrc = document.getElementById('assign-nrc').value;
    const section = document.getElementById('assign-section').value;
    const day = document.getElementById('assign-day').value;
    const module = document.getElementById('assign-module').value;

    if (!nrc || !section) {
        showStatusModal('error', 'Datos Incompletos', 'Por favor ingrese NRC y Sección.');
        return;
    }

    // Check for conflicts
    if (globalData && globalData.schedule) {
        const conflict = globalData.schedule.find(s => 
            s.ubicacion === selector.value &&
            s.dia_norm === day &&
            s.modulo == module // Loose equality for string/number comparison
        );

        if (conflict) {
            showStatusModal('error', 'Conflicto de Horario', `La sala ${selector.value} ya está ocupada el ${day} en el módulo ${module}.`);
            return;
        }
    }

    const payload = {
        sala: selector.value,
        nrc: nrc,
        seccion: section,
        dia: day,
        modulo: module
    };

    try {
        const response = await fetch('/assign_subject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            // Actualizar globalData localmente
            if (globalData && globalData.schedule) {
                globalData.schedule.push(result.entry);
            }
            
            closeAssignModal();
            renderTimetable(selector.value);
            showStatusModal('success', 'Asignada', 'La asignatura se ha añadido correctamente.');
        } else {
            showStatusModal('error', 'Error', result.error || 'No se pudo asignar.');
        }
    } catch (error) {
        console.error("Error asignando:", error);
        showStatusModal('error', 'Error', 'Fallo de conexión.');
    }
}

// --- ELIMINACIÓN DE BLOQUES ---
function openBlockDeleteModal(encodedCls) {
    blockToDelete = JSON.parse(decodeURIComponent(encodedCls));
    const modal = document.getElementById('modal-delete-block');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeBlockDeleteModal() {
    blockToDelete = null;
    const modal = document.getElementById('modal-delete-block');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function confirmRoomBlockDelete() {
    if (!blockToDelete) {
        showStatusModal('error', 'Error Interno', 'No hay bloque seleccionado para eliminar.');
        return;
    }

    const payload = { ...blockToDelete };

    try {
        const response = await fetch('/delete_assignment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            if (globalData && globalData.schedule) {
                globalData.schedule = globalData.schedule.filter(item => 
                    !(item.nrc === payload.nrc && 
                      item.seccion === payload.seccion && 
                      item.dia_norm === payload.dia_norm && 
                      item.modulo === payload.modulo &&
                      item.ubicacion === payload.ubicacion)
                );
            }
            
            closeBlockDeleteModal();
            closeDetailsPanel();
            renderTimetable(payload.ubicacion);
            showStatusModal('success', 'Eliminado', 'El bloque ha sido eliminado correctamente.');
        } else {
            showStatusModal('error', 'Error', result.error || 'No se pudo eliminar.');
        }
    } catch (error) {
        console.error("Error eliminando:", error);
        showStatusModal('error', 'Error', 'Fallo de conexión o error del servidor.');
    }
}

// --- VALIDACIÓN DE INPUTS ---
document.addEventListener('DOMContentLoaded', () => {
    const nrcInput = document.getElementById('assign-nrc');
    const sectionInput = document.getElementById('assign-section');

    if (nrcInput) {
        nrcInput.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    if (sectionInput) {
        sectionInput.addEventListener('input', function(e) {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
    }
});