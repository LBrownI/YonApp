// careers.js - Gestión de Configuración y Visualización
let careerDatabase = {}; 
let careerPendingDelete = null;

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    loadCareers();
});

// --- 1. API CLIENTE (COMUNICACIÓN CON FLASK) ---

async function loadCareers() {
    try {
        const res = await fetch('/get_careers');
        const json = await res.json();
        if(json.success) {
            careerDatabase = json.data;
            renderCareerListTable();   // Dibuja la tabla de configuración
            updateScheduleSelectors(); // Prepara los selectores del planificador
        }
    } catch(e) { console.error("Error cargando carreras", e); }
}

// --- 2. VISTA LISTADO (CONFIGURACIÓN) ---

// ESTA ES LA FUNCIÓN QUE TE FALTABA
function renderCareerListTable() {
    const tbody = document.getElementById('career-list-body');
    const empty = document.getElementById('career-list-empty');
    
    // Validación de seguridad por si no estamos en la pestaña correcta
    if(!tbody) return;

    tbody.innerHTML = '';
    const keys = Object.keys(careerDatabase);

    if(keys.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    keys.forEach(code => {
        const c = careerDatabase[code];
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition group";
        tr.innerHTML = `
            <td class="px-6 py-4 font-mono font-bold text-slate-600">${code}</td>
            <td class="px-6 py-4 font-bold text-slate-800">${c.nombre}</td>
            <td class="px-6 py-4 text-center"><span class="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">${c.semestres} Sem.</span></td>
            <td class="px-6 py-4 text-center text-xs text-slate-500">${c.mallas.join(', ')}</td>
            <td class="px-6 py-4 text-right flex justify-end gap-2">
                <button onclick="goToSchedule('${code}')" class="bg-purple-50 text-purple-600 hover:bg-purple-100 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-2 border border-purple-200">
                    <i data-lucide="calendar" class="w-3 h-3"></i> Horarios
                </button>
                <button onclick="promptDeleteCareer('${code}')" class="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Importante: Reinicializar iconos para los botones nuevos
    if(window.lucide) lucide.createIcons();
}

// --- 3. ACCIONES CRUD (MODALES) ---

function openCareerConfigModal() {
    const modal = document.getElementById('modal-career-config');
    if(modal) {
        modal.classList.remove('hidden');
        // Resetear formulario
        document.getElementById('cfg-code').value = '';
        document.getElementById('cfg-code').disabled = false;
        document.getElementById('cfg-name').value = '';
        document.getElementById('cfg-semesters').value = 10;
        document.getElementById('cfg-meshes').value = '';
    }
}

async function saveCareerConfig() {
    const codeInput = document.getElementById('cfg-code');
    const nameInput = document.getElementById('cfg-name');
    const semInput = document.getElementById('cfg-semesters');
    const meshesInput = document.getElementById('cfg-meshes');

    if(!codeInput || !nameInput) return;

    const code = codeInput.value.toUpperCase();
    const name = nameInput.value;
    const sem = semInput.value;
    const meshesRaw = meshesInput.value;
    const meshes = meshesRaw.split(',').map(m => m.trim()).filter(m => m !== '');

    if(!code || !name) { alert("Faltan datos obligatorios"); return; }

    try {
        const res = await fetch('/save_career', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ code, name, semesters: sem, meshes })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Error Servidor: ${text}`);
        }

        const json = await res.json();
        
        if(json.success) {
            careerDatabase = json.data; 
            renderCareerListTable();     // Actualizar tabla visual
            updateScheduleSelectors();   // Actualizar selectores de la otra vista
            document.getElementById('modal-career-config').classList.add('hidden');
            // Opcional: showStatusModal('success', 'Guardado', 'Carrera configurada correctamente');
        } else {
            alert("Error: " + json.error);
        }
    } catch(e) { 
        console.error(e);
        alert("Fallo Técnico: " + e.message); 
    }
}

function promptDeleteCareer(code) {
    careerPendingDelete = code;
    const nameEl = document.getElementById('del-career-name');
    const modal = document.getElementById('modal-delete-career');
    
    if(nameEl && modal && careerDatabase[code]) {
        nameEl.innerText = careerDatabase[code].nombre;
        modal.classList.remove('hidden');
    }
}

async function confirmDeleteCareer() {
    if(!careerPendingDelete) return;
    try {
        const res = await fetch('/delete_career', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ code: careerPendingDelete })
        });
        if(res.ok) {
            delete careerDatabase[careerPendingDelete];
            renderCareerListTable();
            updateScheduleSelectors();
            document.getElementById('modal-delete-career').classList.add('hidden');
        }
    } catch(e) { alert("Error al eliminar"); }
}

// --- 4. VISTA PLANIFICADOR (SÁBANA) ---

function goToSchedule(code) {
    // Esta función asume que 'switchTab' existe en el ámbito global (main.js lo provee)
    if(window.switchTab) {
        switchTab('career-schedule');
        const selector = document.getElementById('schedule-career-selector');
        if(selector) {
            selector.value = code;
            updateScheduleFilters(); 
        }
    }
}

function updateScheduleSelectors() {
    const selector = document.getElementById('schedule-career-selector');
    if(!selector) return;
    
    const currentVal = selector.value;
    selector.innerHTML = '<option value="">-- Seleccionar --</option>';
    
    Object.keys(careerDatabase).forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.innerText = careerDatabase[code].nombre;
        selector.appendChild(opt);
    });
    selector.value = currentVal; 
}

function updateScheduleFilters() {
    const code = document.getElementById('schedule-career-selector').value;
    const mallaSel = document.getElementById('schedule-malla-selector');
    const semSel = document.getElementById('schedule-sem-selector');
    const emptyState = document.getElementById('schedule-empty-state');

    if(!code) {
        mallaSel.innerHTML = '<option value="">--</option>';
        semSel.innerHTML = '<option value="">--</option>';
        emptyState.classList.remove('hidden');
        return;
    }

    const career = careerDatabase[code];

    // Llenar Mallas
    mallaSel.innerHTML = '<option value="">-- Seleccionar Malla --</option>';
    career.mallas.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.innerText = `Malla ${m}`;
        mallaSel.appendChild(opt);
    });

    // Llenar Semestres
    semSel.innerHTML = '<option value="">-- Seleccionar Semestre --</option>';
    for(let i=1; i<=career.semestres; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `Semestre ${i}`;
        semSel.appendChild(opt);
    }
}

function renderCareerGrid() {
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;
    const tbody = document.getElementById('schedule-grid-body');
    const emptyState = document.getElementById('schedule-empty-state');

    if(!malla || !sem || !tbody) {
        if(emptyState) emptyState.classList.remove('hidden');
        if(tbody) tbody.innerHTML = '';
        return;
    }

    if(emptyState) emptyState.classList.add('hidden');
    tbody.innerHTML = '';

    const times = ["08:00 - 09:20", "09:30 - 10:50", "11:00 - 12:20", "12:30 - 13:50", "14:00 - 15:20", "15:30 - 16:50", "17:00 - 18:20", "18:30 - 19:50"];
    
    for (let i = 0; i < 8; i++) { 
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 h-24";
        tr.innerHTML = `
            <td class="p-2 border-r border-slate-100 bg-slate-50 text-center align-middle">
                <span class="block font-bold text-slate-700">M${i+1}</span>
                <span class="text-[10px] text-slate-400">${times[i]}</span>
            </td>
            <td class="p-1 border-r border-slate-100 bg-white hover:bg-slate-50 transition relative border-b"></td>
            <td class="p-1 border-r border-slate-100 bg-white hover:bg-slate-50 transition relative border-b"></td>
            <td class="p-1 border-r border-slate-100 bg-white hover:bg-slate-50 transition relative border-b"></td>
            <td class="p-1 border-r border-slate-100 bg-white hover:bg-slate-50 transition relative border-b"></td>
            <td class="p-1 border-r border-slate-100 bg-white hover:bg-slate-50 transition relative border-b"></td>
            <td class="p-1 border-r border-slate-100 bg-white hover:bg-slate-50 transition relative border-b"></td>
        `;
        tbody.appendChild(tr);
    }
}