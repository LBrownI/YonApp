// careers.js
let careerDataStore = {}; 

async function uploadCareerFile() {
    const input = document.getElementById('careerFile');
    if (input.files.length === 0) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    toggleLoading(true);
    try {
        const response = await fetch('/upload_career', { method: 'POST', body: formData });
        const result = await response.json();
        toggleLoading(false);
        if (result.success) {
            careerDataStore = result.full_store;
            showStatusModal('success', 'Carrera Cargada', `Se procesaron ${result.data.entries_count} registros para ${result.data.career}`);
            updateCareerSelector();
            document.getElementById('career-selector').value = result.data.career;
            renderCareerGrid();
        } else { showStatusModal('error', 'Error', result.error); }
    } catch (error) {
        toggleLoading(false);
        showStatusModal('error', 'Error', 'Falló la conexión');
    }
}

function updateCareerSelector() {
    const selector = document.getElementById('career-selector');
    selector.innerHTML = '<option value="">-- Seleccionar --</option>';
    Object.keys(careerDataStore).forEach(careerName => {
        const opt = document.createElement('option');
        opt.value = careerName;
        opt.innerText = careerName;
        selector.appendChild(opt);
    });
}

function renderCareerGrid() {
    const selectedCareer = document.getElementById('career-selector').value;
    const tbody = document.getElementById('career-grid-body');
    const emptyState = document.getElementById('career-empty-state');

    if (!selectedCareer) {
        emptyState.classList.remove('hidden');
        tbody.innerHTML = '';
        return;
    }
    emptyState.classList.add('hidden');
    tbody.innerHTML = '';
    
    const careerData = careerDataStore[selectedCareer] || [];
    const times = ["08:00 - 09:20", "09:30 - 10:50", "11:00 - 12:20", "12:30 - 13:50", "14:00 - 15:20", "15:30 - 16:50", "17:00 - 18:20", "18:30 - 19:50"];
    const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

    for (let i = 0; i < 8; i++) { 
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 h-24";
        tr.innerHTML = `<td class="p-2 border-r border-slate-100 bg-slate-50 text-center align-middle"><span class="block font-bold text-slate-700">M${i+1}</span><span class="text-[10px] text-slate-400">${times[i]}</span></td>`;
        days.forEach(day => {
            // Aquí irá la lógica de espejos más adelante
            tr.innerHTML += `<td class="p-1 border-r border-slate-100 align-top relative hover:bg-slate-50 transition"></td>`;
        });
        tbody.appendChild(tr);
    }
}