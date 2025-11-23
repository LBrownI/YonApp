// careers.js - Lógica del Módulo de Carreras
let careerDatabase = {}; 
let careerPendingDelete = null;

document.addEventListener('DOMContentLoaded', () => {
    loadCareers();
});

// --- API CLIENTE ---
async function loadCareers() {
    try {
        const res = await fetch('/get_careers');
        const json = await res.json();
        if(json.success) {
            careerDatabase = json.data;
            renderCareerListTable();
            updateScheduleSelectors();
        }
    } catch(e) { console.error("Error cargando carreras", e); }
}

// --- VISTA 1: LISTADO (Sin cambios en esta parte) ---
function renderCareerListTable() {
    const tbody = document.getElementById('career-list-body');
    const empty = document.getElementById('career-list-empty');
    if(!tbody) return;
    tbody.innerHTML = '';
    const keys = Object.keys(careerDatabase);
    if(keys.length === 0) { empty.classList.remove('hidden'); return; }
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
                <button onclick="goToSchedule('${code}')" class="bg-purple-50 text-purple-600 hover:bg-purple-100 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-2 border border-purple-200"><i data-lucide="calendar" class="w-3 h-3"></i> Horarios</button>
                <button onclick="promptDeleteCareer('${code}')" class="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if(window.lucide) lucide.createIcons();
}

// --- CRUD Carreras (Funciones ya existentes, mantenerlas) ---
function openCareerConfigModal() {
    document.getElementById('modal-career-config').classList.remove('hidden');
    document.getElementById('cfg-code').value = '';
    document.getElementById('cfg-code').disabled = false;
    document.getElementById('cfg-name').value = '';
    document.getElementById('cfg-semesters').value = 10;
    document.getElementById('cfg-meshes').value = '';
}

async function saveCareerConfig() {
    const code = document.getElementById('cfg-code').value.toUpperCase();
    const name = document.getElementById('cfg-name').value;
    const sem = document.getElementById('cfg-semesters').value;
    const meshesRaw = document.getElementById('cfg-meshes').value;
    const meshes = meshesRaw.split(',').map(m => m.trim()).filter(m => m !== '');

    if(!code || !name) { alert("Faltan datos"); return; }

    try {
        const res = await fetch('/save_career', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ code, name, semesters: sem, meshes })
        });
        const json = await res.json();
        if(json.success) {
            careerDatabase = json.data; 
            renderCareerListTable();     
            updateScheduleSelectors();   
            document.getElementById('modal-career-config').classList.add('hidden');
        } else { alert("Error: " + json.error); }
    } catch(e) { alert("Error de conexión"); }
}

function promptDeleteCareer(code) {
    careerPendingDelete = code;
    document.getElementById('del-career-name').innerText = careerDatabase[code].nombre;
    document.getElementById('modal-delete-career').classList.remove('hidden');
}

async function confirmDeleteCareer() {
    if(!careerPendingDelete) return;
    try {
        const res = await fetch('/delete_career', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
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

// --- VISTA 2: PLANIFICADOR (Horarios) ---

function goToSchedule(code) {
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
    mallaSel.innerHTML = '<option value="">-- Seleccionar Malla --</option>';
    career.mallas.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.innerText = `Malla ${m}`;
        mallaSel.appendChild(opt);
    });
    semSel.innerHTML = '<option value="">-- Seleccionar Semestre --</option>';
    for(let i=1; i<=career.semestres; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.innerText = `Semestre ${i}`;
        semSel.appendChild(opt);
    }
}

function renderCareerGrid() {
    const code = document.getElementById('schedule-career-selector').value;
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;
    const tbody = document.getElementById('schedule-grid-body');
    const emptyState = document.getElementById('schedule-empty-state');

    if(!code || !malla || !sem) {
        if(emptyState) emptyState.classList.remove('hidden');
        if(tbody) tbody.innerHTML = '';
        return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = '';

    const allBlocks = careerDatabase[code].planificacion || [];
    const activeBlocks = allBlocks.filter(b => b.malla === malla && b.semestre == sem);

    const times = ["08:00 - 09:20", "09:30 - 10:50", "11:00 - 12:20", "12:30 - 13:50", "14:00 - 15:20", "15:30 - 16:50", "17:00 - 18:20", "18:30 - 19:50"];
    const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    
    for (let i = 0; i < 8; i++) { 
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100"; 

        tr.innerHTML = `
            <td class="p-2 border-r border-slate-100 bg-slate-50 text-center align-middle h-24">
                <span class="block font-bold text-slate-700">M${i+1}</span>
                <span class="text-[10px] text-slate-400 whitespace-nowrap">${times[i]}</span>
            </td>
        `;

        days.forEach(day => {
            const blocksInCell = activeBlocks.filter(b => b.dia === day && b.modulo === (i+1));
            let content = '';
            
            if (blocksInCell.length > 0) {
                const blocksHTML = blocksInCell.map(block => {
                    // Estilos visuales según tipo (MODIFICADO PARA QUE SE VEA SOLO NRC/TIPO)
                    let bgClass = "bg-blue-50 border-blue-200 text-blue-700"; 
                    if(block.tipo === 'LAB') bgClass = "bg-orange-50 border-orange-200 text-orange-700";
                    if(block.tipo === 'TAL') bgClass = "bg-green-50 border-green-200 text-green-700";
                    if(block.tipo === 'SIM') bgClass = "bg-purple-50 border-purple-200 text-purple-700";

                    return `
                        <div class="flex-1 ${bgClass} border border-l-4 p-1 text-xs flex flex-col justify-center items-center overflow-hidden hover:brightness-95 transition cursor-pointer text-center">
                            <div class="font-bold truncate w-full" title="NRC: ${block.nrc}">NRC ${block.nrc} - ${block.seccion}</div>
                            <div class="text-[10px] opacity-80 font-bold mt-1 bg-white/50 px-1 rounded">${block.tipo}</div>
                        </div>
                    `;
                }).join('');

                content = `<div class="flex h-full w-full gap-1 p-1">${blocksHTML}</div>`;
            }

            tr.innerHTML += `<td class="h-24 p-0 border-r border-slate-100 align-top relative hover:bg-slate-50 transition">${content}</td>`;
        });
        tbody.appendChild(tr);
    }
}

// --- FUNCIONES NUEVAS: AÑADIR BLOQUE ---

function openAddBlockModal() {
    const code = document.getElementById('schedule-career-selector').value;
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;

    if (!code || !malla || !sem) {
        alert("Selecciona Carrera, Malla y Semestre primero.");
        return;
    }
    document.getElementById('modal-add-block').classList.remove('hidden');
    document.getElementById('block-nrc').focus();
}

function selectBlockType(type, btn) {
    document.querySelectorAll('.type-btn').forEach(b => {
        b.className = "type-btn border border-slate-200 text-slate-500 hover:bg-slate-50 py-2 rounded text-xs transition";
    });

    let activeClasses = "type-btn active border-2 font-bold py-2 rounded text-xs transition ";
    if (type === 'TEO') activeClasses += "border-blue-500 bg-blue-50 text-blue-700";
    else if (type === 'LAB') activeClasses += "border-orange-500 bg-orange-50 text-orange-700";
    else if (type === 'TAL') activeClasses += "border-green-500 bg-green-50 text-green-700";
    else if (type === 'SIM') activeClasses += "border-purple-500 bg-purple-50 text-purple-700";
    
    btn.className = activeClasses;
    document.getElementById('block-type').value = type;
}

async function submitNewBlock() {
    const code = document.getElementById('schedule-career-selector').value;
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;
    
    // Validamos NRC y Sección en vez de nombre
    const nrc = document.getElementById('block-nrc').value;
    const sec = document.getElementById('block-sec').value;
    const day = document.getElementById('block-day').value;
    const mod = document.getElementById('block-mod').value;
    const type = document.getElementById('block-type').value;

    if(!nrc || !sec) { alert("NRC y Sección son obligatorios"); return; }

    try {
        const res = await fetch('/add_block', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                career_code: code,
                malla: malla,
                semestre: sem,
                dia: day,
                modulo: mod,
                // Ya no enviamos 'asignatura' (nombre)
                nrc: nrc,
                seccion: sec,
                tipo: type
            })
        });
        
        const json = await res.json();
        if(json.success) {
            careerDatabase = json.data; 
            renderCareerGrid(); 
            document.getElementById('modal-add-block').classList.add('hidden');
            document.getElementById('block-nrc').value = '';
            document.getElementById('block-sec').value = '';
        } else {
            alert("Error: " + json.error);
        }
    } catch(e) { alert("Error de conexión"); }
}