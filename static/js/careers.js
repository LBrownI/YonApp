// careers.js - Lógica del Módulo de Carreras
let careerDatabase = {}; 
let careerPendingDelete = null;
let currentPlanningPeriod = 1; // 1 = Impares, 2 = Pares

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
            currentPlanningPeriod = json.period || 1;
            updatePeriodUI();
            renderCareerListTable();
            updateScheduleSelectors();
        }
    } catch(e) { console.error("Error cargando carreras", e); }
}

// --- CONFIGURACIÓN DE PERIODO ---
function openPeriodConfigModal() {
    document.getElementById('modal-period-config').classList.remove('hidden');
    updatePeriodUI();
}

async function setPlanningPeriod(period) {
    try {
        const res = await fetch('/set_planning_period', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ period })
        });
        const json = await res.json();
        if(json.success) {
            currentPlanningPeriod = json.period;
            updatePeriodUI();
            updateScheduleSelectors(); // Refrescar selectores
            document.getElementById('modal-period-config').classList.add('hidden');
        }
    } catch(e) { console.error("Error setting period", e); }
}

function updatePeriodUI() {
    // Actualizar etiqueta en el botón principal
    const label = document.getElementById('current-period-label');
    if(label) label.innerText = currentPlanningPeriod === 1 ? "Periodo: 1° Semestre" : "Periodo: 2° Semestre";

    // Actualizar selección en el modal
    document.querySelectorAll('.check-indicator').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('[id^="btn-period-"]').forEach(el => el.classList.remove('border-purple-500', 'bg-purple-50'));
    
    const activeBtn = document.getElementById('btn-period-' + currentPlanningPeriod);
    if(activeBtn) {
        activeBtn.classList.add('border-purple-500', 'bg-purple-50');
        activeBtn.querySelector('.check-indicator').classList.remove('hidden');
    }
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

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

async function saveCareerConfig() {
    const code = document.getElementById('cfg-code').value.toUpperCase();
    const nameRaw = document.getElementById('cfg-name').value;
    const name = toTitleCase(nameRaw);
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
        selectCareer(code);
    }
}

function updateScheduleSelectors() {
    // Inicializar lista de opciones para el buscador
    const optionsContainer = document.getElementById('schedule-career-options');
    if(!optionsContainer) return;
    
    optionsContainer.innerHTML = '';
    Object.keys(careerDatabase).forEach(code => {
        const div = document.createElement('div');
        div.className = "p-2 hover:bg-purple-50 cursor-pointer text-sm text-slate-700 border-b border-slate-50 last:border-0";
        div.innerText = `${code} - ${careerDatabase[code].nombre}`;
        div.onclick = () => selectCareer(code);
        div.dataset.code = code;
        div.dataset.name = careerDatabase[code].nombre;
        optionsContainer.appendChild(div);
    });
    
    // Asegurar que no haya selección inicial si no se ha especificado
    const selector = document.getElementById('schedule-career-selector');
    const searchInput = document.getElementById('schedule-career-search');
    if(selector && !selector.value) {
        searchInput.value = '';
        updateScheduleFilters();
    } else {
        updateAddButtonState();
    }
}

// --- FUNCIONES DEL BUSCADOR DE CARRERAS ---
function showCareerOptions() {
    document.getElementById('schedule-career-options').classList.remove('hidden');
}

function hideCareerOptionsDelayed() {
    setTimeout(() => {
        document.getElementById('schedule-career-options').classList.add('hidden');
    }, 200);
}

function filterCareerOptions() {
    const query = document.getElementById('schedule-career-search').value.toUpperCase();
    const options = document.getElementById('schedule-career-options').children;
    
    for(let opt of options) {
        const text = opt.innerText.toUpperCase();
        if(text.includes(query)) {
            opt.classList.remove('hidden');
        } else {
            opt.classList.add('hidden');
        }
    }
    showCareerOptions();
}

function selectCareer(code) {
    const selector = document.getElementById('schedule-career-selector');
    const searchInput = document.getElementById('schedule-career-search');
    
    if(selector && searchInput && careerDatabase[code]) {
        selector.value = code;
        searchInput.value = code; // Mostrar solo el código como se solicitó
        updateScheduleFilters();
    }
}

function updateAddButtonState() {
    const code = document.getElementById('schedule-career-selector').value;
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;
    const btn = document.getElementById('btn-add-block-trigger');

    if (!btn) return;

    const isReady = Boolean(code && malla && sem);
    btn.disabled = !isReady;
    btn.setAttribute('aria-disabled', String(!isReady));

    if (isReady) {
        btn.className = "bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm flex items-center gap-2";
    } else {
        btn.className = "bg-purple-200 text-purple-400 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 cursor-not-allowed";
    }
}

function updateScheduleFilters() {
    const code = document.getElementById('schedule-career-selector').value;
    const mallaSel = document.getElementById('schedule-malla-selector');
    const semSel = document.getElementById('schedule-sem-selector');
    const emptyState = document.getElementById('schedule-empty-state');

    updateAddButtonState();

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
        // Filtrar según periodo: 
        // Periodo 1 (Impares): i % 2 !== 0
        // Periodo 2 (Pares): i % 2 === 0
        const isOdd = i % 2 !== 0;
        const show = (currentPlanningPeriod === 1 && isOdd) || (currentPlanningPeriod === 2 && !isOdd);
        
        if(show) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = `Semestre ${i}`;
            semSel.appendChild(opt);
        }
    }
}

function renderCareerGrid() {
    const code = document.getElementById('schedule-career-selector').value;
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;
    const codeLiteral = JSON.stringify(code);
    const mallaLiteral = JSON.stringify(malla);
    const semLiteral = JSON.stringify(sem);
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
    
    // IMPORTANTE: Mapeamos los bloques pero guardamos su ÍNDICE ORIGINAL
    // Esto es vital para saber cuál borrar después.
    const activeBlocks = allBlocks
        .map((block, index) => ({ ...block, originalIndex: index })) // Guardamos el índice real
        .filter(b => b.malla === malla && b.semestre == sem);

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
                    let bgClass = "bg-blue-50 border-blue-200 text-blue-700"; 
                    if(block.tipo === 'LAB') bgClass = "bg-orange-50 border-orange-200 text-orange-700";
                    if(block.tipo === 'TAL') bgClass = "bg-green-50 border-green-200 text-green-700";
                    if(block.tipo === 'SIM') bgClass = "bg-purple-50 border-purple-200 text-purple-700";

                    const nrcLiteral = JSON.stringify(block.nrc);
                    const secLiteral = JSON.stringify(block.seccion);
                    const dayLiteral = JSON.stringify(day);

                    return `
                        <div class="flex-1 ${bgClass} border border-l-4 p-1 text-xs flex flex-col justify-center items-center overflow-hidden hover:brightness-95 transition cursor-pointer text-center group relative"
                             onclick='openEditBlockModal(${codeLiteral}, ${mallaLiteral}, ${semLiteral}, ${dayLiteral}, ${i+1}, ${nrcLiteral}, ${secLiteral})'>
                            <button type="button" onclick='promptDeleteBlock(${block.originalIndex}, ${codeLiteral}); event.stopPropagation();' class="absolute top-1 right-1 hidden group-hover:flex items-center justify-center bg-white/80 text-red-600 rounded-full p-1 shadow-sm hover:bg-white">
                                <i data-lucide="trash-2" class="w-3 h-3"></i>
                            </button>
                            <div class="font-bold truncate w-full">NRC ${block.nrc}</div>
                            <div class="text-[10px] opacity-80">${block.seccion}</div>
                        </div>
                    `;
                }).join('');

                content = `<div class="flex h-full w-full gap-1 p-1">${blocksHTML}</div>`;
            }

            tr.innerHTML += `<td class="h-24 p-0 border-r border-slate-100 align-top relative hover:bg-slate-50 transition">${content}</td>`;
        });
        tbody.appendChild(tr);
    }
    if(window.lucide) lucide.createIcons();
}

// --- FUNCIONES NUEVAS: AÑADIR BLOQUE ---

function openAddBlockModal() {
    const code = document.getElementById('schedule-career-selector').value;
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;

    const missing = [];
    if (!code) missing.push("Carrera");
    if (!malla) missing.push("Malla Curricular");
    if (!sem) missing.push("Semestre");

    if (missing.length > 0) {
        const listEl = document.getElementById('missing-selection-list');
        listEl.innerHTML = missing.map(item => `<li>${item}</li>`).join('');
        
        document.getElementById('modal-warning-missing-selection').classList.remove('hidden');
        lucide.createIcons();
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

function selectEditBlockType(type, btn) {
    document.querySelectorAll('.edit-type-btn').forEach(b => {
        b.className = "edit-type-btn border border-slate-200 text-slate-500 hover:bg-slate-50 py-2 rounded text-xs transition";
    });

    let activeClasses = "edit-type-btn active border-2 font-bold py-2 rounded text-xs transition ";
    if (type === 'TEO') activeClasses += "border-blue-500 bg-blue-50 text-blue-700";
    else if (type === 'LAB') activeClasses += "border-orange-500 bg-orange-50 text-orange-700";
    else if (type === 'TAL') activeClasses += "border-green-500 bg-green-50 text-green-700";
    else if (type === 'SIM') activeClasses += "border-purple-500 bg-purple-50 text-purple-700";
    
    btn.className = activeClasses;
    document.getElementById('edit-block-type').value = type;
}

async function submitNewBlock() {
    const code = document.getElementById('schedule-career-selector').value;
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;
    
    // Validamos NRC y Sección en vez de nombre
    const nrc = document.getElementById('block-nrc').value;
    const sec = document.getElementById('block-sec').value.toUpperCase();
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
            // Resetear lista de NRC disponibles según la nueva data
            buildNrcOptions();
        } else {
            alert("Error: " + json.error);
        }
    } catch(e) { alert("Error de conexión"); }
}

// --- EDITAR / ELIMINAR BLOQUES DESDE EL HORARIO ---

let currentEditBlock = null;

function openEditBlockModal(careerCode, malla, semestre, dia, modulo, nrc, seccion) {
    // Buscar el bloque en la base local para obtener su tipo actual
    let tipo = 'TEO';
    const career = careerDatabase[careerCode];
    if (career && Array.isArray(career.planificacion)) {
        const found = career.planificacion.find(b =>
            b.malla === malla && String(b.semestre) === String(semestre) &&
            b.dia === dia && Number(b.modulo) === Number(modulo) &&
            String(b.nrc) === String(nrc) && b.seccion === seccion
        );
        if (found && found.tipo) tipo = found.tipo;
    }

    currentEditBlock = { careerCode, malla, semestre, dia, modulo, nrc, seccion, tipo };

    document.getElementById('edit-nrc').value = nrc;
    document.getElementById('edit-sec').value = seccion;
    document.getElementById('edit-day').value = dia;
    document.getElementById('edit-mod').value = modulo;
    
    // Set type
    const typeBtn = Array.from(document.querySelectorAll('.edit-type-btn')).find(b => b.innerText.includes(tipo));
    if(typeBtn) {
        selectEditBlockType(tipo, typeBtn);
    } else {
        // Fallback if something is wrong, default to TEO
        const defaultBtn = document.querySelector('.edit-type-btn');
        if(defaultBtn) selectEditBlockType('TEO', defaultBtn);
    }

    document.getElementById('modal-edit-block').classList.remove('hidden');
}

async function saveEditedBlock() {
    if (!currentEditBlock) return;

    const newDay = document.getElementById('edit-day').value;
    const newMod = document.getElementById('edit-mod').value;
    const newType = document.getElementById('edit-block-type').value;

    try {
        const res = await fetch('/edit_block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                career_code: currentEditBlock.careerCode,
                malla: currentEditBlock.malla,
                semestre: currentEditBlock.semestre,
                old_dia: currentEditBlock.dia,
                old_modulo: currentEditBlock.modulo,
                nrc: currentEditBlock.nrc,
                seccion: currentEditBlock.seccion,
                new_dia: newDay,
                new_modulo: newMod,
                new_tipo: newType
            })
        });
        const json = await res.json();
        if (json.success) {
            careerDatabase = json.data;
            renderCareerGrid();
            if (typeof loadSubjectsFromDatabase === 'function') {
                loadSubjectsFromDatabase();
            }
            document.getElementById('modal-edit-block').classList.add('hidden');
            currentEditBlock = null;
        } else {
            alert('Error: ' + json.error);
        }
    } catch (e) {
        alert('Error de conexión');
    }
}

function deleteBlockFromModal() {
    if (!currentEditBlock) return;
    const code = currentEditBlock.careerCode;
    const plan = (careerDatabase[code] && careerDatabase[code].planificacion) || [];
    const matchIndex = plan.findIndex(block =>
        block.malla === currentEditBlock.malla &&
        String(block.semestre) === String(currentEditBlock.semestre) &&
        block.dia === currentEditBlock.dia &&
        Number(block.modulo) === Number(currentEditBlock.modulo) &&
        String(block.nrc) === String(currentEditBlock.nrc) &&
        block.seccion === currentEditBlock.seccion
    );

    if (matchIndex === -1) {
        alert('No se pudo identificar el bloque a eliminar.');
        return;
    }

    promptDeleteBlock(matchIndex, code);
}

// --- AUTOCOMPLETE DE NRC EN MODAL ---

function buildNrcOptions() {
    const code = document.getElementById('schedule-career-selector').value;
    const malla = document.getElementById('schedule-malla-selector').value;
    const sem = document.getElementById('schedule-sem-selector').value;
    const container = document.getElementById('block-nrc-options');
    if(!container) return;

    container.innerHTML = '';

    if(!code || !careerDatabase[code]) return;

    const allBlocks = careerDatabase[code].planificacion || [];
    const filteredBlocks = allBlocks.filter(b => {
        if(malla && b.malla !== malla) return false;
        if(sem && String(b.semestre) !== String(sem)) return false;
        return true;
    });

    const seen = new Set();
    filteredBlocks.forEach(b => {
        const key = `${b.nrc}-${b.seccion}`;
        if(seen.has(key)) return;
        seen.add(key);

        const div = document.createElement('div');
        div.className = "px-2 py-1 hover:bg-purple-50 cursor-pointer flex justify-between items-center";
        div.innerHTML = `
            <span class="font-mono text-slate-700">${b.nrc}</span>
            <span class="text-[10px] text-slate-400 ml-2">${b.seccion}</span>
        `;
        div.onclick = () => {
            document.getElementById('block-nrc').value = b.nrc;
            document.getElementById('block-sec').value = b.seccion;
            container.classList.add('hidden');
        };
        container.appendChild(div);
    });
}

function showNrcOptions() {
    const container = document.getElementById('block-nrc-options');
    if(container) {
        buildNrcOptions();
        container.classList.remove('hidden');
    }
}

function hideNrcOptionsDelayed() {
    setTimeout(() => {
        const container = document.getElementById('block-nrc-options');
        if(container) container.classList.add('hidden');
    }, 200);
}

function filterNrcOptions() {
    const input = document.getElementById('block-nrc');
    const container = document.getElementById('block-nrc-options');
    if(!input || !container) return;

    const query = input.value.toString().toUpperCase();

    // Si todavía no hemos construido la lista, hacerlo ahora
    if(!container.children.length) buildNrcOptions();

    Array.from(container.children).forEach(child => {
        const text = child.innerText.toUpperCase();
        if(text.includes(query)) child.classList.remove('hidden');
        else child.classList.add('hidden');
    });

    container.classList.remove('hidden');
}

// --- ELIMINACIÓN DE BLOQUES (CARRERAS) ---

let blockIndexToDelete = null;
let blockCareerForDeletion = null;

function promptDeleteBlock(index, careerCode = null) {
    blockIndexToDelete = index;
    const selector = document.getElementById('schedule-career-selector');
    blockCareerForDeletion = careerCode || (selector ? selector.value : null);

    const modal = document.getElementById('modal-confirm-delete-block');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

async function confirmPlanningBlockDelete() {
    const targetCareer = blockCareerForDeletion;

    if (blockIndexToDelete === null || !targetCareer) {
        alert('Selecciona un bloque válido para eliminar.');
        return;
    }

    try {
        const res = await fetch('/delete_planning_block', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                career_code: targetCareer,
                block_index: blockIndexToDelete
            })
        });
        const json = await res.json();

        if(json.success) {
            careerDatabase = json.data;
            renderCareerGrid();
            if (typeof loadSubjectsFromDatabase === 'function') {
                loadSubjectsFromDatabase();
            }
            const confirmModal = document.getElementById('modal-confirm-delete-block');
            if(confirmModal) {
                confirmModal.classList.add('hidden');
                confirmModal.classList.remove('flex');
            }
            const editModal = document.getElementById('modal-edit-block');
            if(editModal) {
                editModal.classList.add('hidden');
            }
            blockIndexToDelete = null;
            blockCareerForDeletion = null;
            currentEditBlock = null;
        } else {
            alert("Error: " + json.error);
        }
    } catch(e) {
        alert("Error de conexión");
    }
}

function handleScheduleSelectorChange() {
    updateAddButtonState();
    renderCareerGrid();
}