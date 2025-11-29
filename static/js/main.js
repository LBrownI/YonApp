// main.js - Lógica Global y de Navegación
lucide.createIcons();

// --- LÓGICA DE INTERFAZ ---
function handleLogin(e) {
    e.preventDefault();
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('main-layout').classList.remove('hidden');
}

// --- GESTIÓN DE NAVEGACIÓN Y SIDEBAR ---
function setSidebarMode(mode) {
    // Ocultar todos los menús
    document.getElementById('nav-root').classList.add('hidden');
    document.getElementById('nav-rooms').classList.add('hidden');
    document.getElementById('nav-careers').classList.add('hidden');

    // Mostrar el correspondiente
    if (mode === 'root') {
        document.getElementById('nav-root').classList.remove('hidden');
    } else if (mode === 'rooms') {
        document.getElementById('nav-rooms').classList.remove('hidden');
    } else if (mode === 'careers') {
        document.getElementById('nav-careers').classList.remove('hidden');
    }
    lucide.createIcons(); 
}

function enterModule(moduleName) {
    if (moduleName === 'rooms') {
        setSidebarMode('rooms');
        // Llamamos a la función que vive en rooms.js
        if (typeof handleRoomsClick === 'function') {
            handleRoomsClick();
        } else {
            switchTab('upload'); // Fallback
        }
    } else if (moduleName === 'careers') {
        setSidebarMode('careers');
        switchTab('career-schedule');
    }
}

function goBackToRoot() {
    setSidebarMode('root');
    switchTab('dashboard');
}

function switchTab(tabId) {
    // Si existe la función de limpiar highlights (en rooms.js), la llamamos
    if (typeof resetRoomHighlights === 'function') {
        resetRoomHighlights();
    }

    // Si vamos al dashboard, forzamos el menú raíz
    if (tabId === 'dashboard') {
        setSidebarMode('root');
    }

    // Gestión de estilos de botones
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-white');
        btn.classList.add('text-slate-300');
    });
    const activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) activeBtn.classList.add('bg-slate-800', 'text-white');
    
    // Gestión de vistas
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const view = document.getElementById('tab-' + tabId);
    if (view) view.classList.remove('hidden');
    
    // Títulos Dinámicos
    const titles = {
        'dashboard': 'Inicio',
        'upload': 'Importación de Datos',
        'timetable': 'Visualizador de Horarios',
        'occupancy': 'Monitor de Ocupación',
        'finder': 'Buscador de Salas',
        'career-schedule': 'Planificador Académico',
        'career-list': 'Carreras',
        'subject-list': 'Asignaturas'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.innerText = titles[tabId] || 'YonApp';

    // Hook para el gráfico de salas (si estamos en esa pestaña y existe la data)
    if(tabId === 'occupancy' && typeof renderOccupancyChart === 'function' && typeof globalData !== 'undefined' && globalData) {
        setTimeout(renderOccupancyChart, 50);
    }

    // Hook para cargar asignaturas
    if(tabId === 'subject-list' && typeof loadSubjectsFromDatabase === 'function') {
        loadSubjectsFromDatabase();
    }
    
    lucide.createIcons();
}

// --- MODALES GLOBALES (HELPERS) ---
function toggleLoading(show) {
    const modal = document.getElementById('modal-loading');
    if(!modal) return;
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

function showStatusModal(type, title, message) {
    const modal = document.getElementById('modal-status');
    if(!modal) { alert(message); return; }

    const iconContainer = document.getElementById('status-icon-container');
    const icon = document.getElementById('status-icon');
    
    document.getElementById('status-title').innerText = title;
    document.getElementById('status-message').innerText = message;

    if (type === 'success') {
        iconContainer.className = "mx-auto w-16 h-16 flex items-center justify-center rounded-full mb-4 bg-green-100 text-green-600";
        icon.setAttribute('data-lucide', 'check');
    } else {
        iconContainer.className = "mx-auto w-16 h-16 flex items-center justify-center rounded-full mb-4 bg-red-100 text-red-600";
        icon.setAttribute('data-lucide', 'x');
    }
    
    lucide.createIcons();
    modal.classList.remove('hidden');
}

function closeStatusModal() {
    const modal = document.getElementById('modal-status');
    if(modal) modal.classList.add('hidden');
}

// Inicialización Global
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const dateEl = document.getElementById('date-display');
    if(dateEl) dateEl.innerText = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    
    // Animación Typewriter del Login
    if(document.getElementById('typewriter-text')) {
        const target = document.getElementById('typewriter-text');
        (async () => {
            const type = async (t) => { for(let c of t) { target.innerText += c; await new Promise(r=>setTimeout(r,100)); }};
            const del = async () => { while(target.innerText.length > 0) { target.innerText = target.innerText.slice(0,-1); await new Promise(r=>setTimeout(r,50)); }};
            await new Promise(r=>setTimeout(r,500));
            await type("Yonathan A");
            await new Promise(r=>setTimeout(r,300));
            await del();
            await new Promise(r=>setTimeout(r,300));
            await type("✨Your on-campus network✨");
        })();
    }
});