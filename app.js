// CONFIGURACIÓN
// URL de la aplicación web de Google Apps Script (ver backend/Codigo.gs).
// Vacía = los datos se guardan solo en este dispositivo.
const API_URL = 'https://script.google.com/macros/s/AKfycbwji7WhPpF2VhCRQETWXNFhF2PTAL8JP8z9SW-stsKdnjbyBa-KVucGCvm6seoTFLfl3Q/exec';

// Usuarios: la clave no se guarda aquí, solo su huella SHA-256 de "usuario:clave" (en minúsculas)
const USUARIOS = [
    { usuario: 'L.Ramos',     huella: 'afecd958a07662fa1c466a63fa799f91873a1371f878dc6e4bd6c35ffce87617', tipo: 'comercial', id: 'lramos',     nombre: 'Lizeth Ramos',      zona: 'Zona Norte' },
    { usuario: 'Y.Caballero', huella: 'df5769c03aec2c0300cd912335962a57617271fa86e0ef852d5d959895c6ecab', tipo: 'comercial', id: 'ycaballero', nombre: 'Yunelis Caballero', zona: 'Zona Sur' },
    { usuario: 'J.Herrera',   huella: '564177c2a1926013ea79ab83b4bbfe0c3f44fb9585eda1c407504de6424f24c0', tipo: 'comercial', id: 'jherrera',   nombre: 'Jennifer Herrera',  zona: 'Clientes Especiales' },
    { usuario: 'M.Castro',    huella: '2b2ebf7f55852620d6c6b80fd886a502c3ffa470d4eae22dcad0fe2dfd5b1d88', tipo: 'jefe',      id: 'mcastro',    nombre: 'M. Castro' },
    { usuario: 'H.Reyes',     huella: '0213f79c165b6d4bee6bd9eab719817266af1fc9a45ed22cadfccda60f0a122d', tipo: 'jefe',      id: 'hreyes',     nombre: 'Hernán Reyes', admin: true }
];
const COMERCIALES = USUARIOS.filter(u => u.tipo === 'comercial');

// Tipo de visita y sus objetivos (se pueden escoger varios)
const TIPOS_VISITA = {
    'Visita Médica': ['Parrilla Promocional', 'Productos Nuevos', 'Protocolo Médico', 'Entrega de Muestras', 'Desarrollo Productos', 'Colocación', 'Cartera'],
    'Visita Comercial': ['Colocación', 'Mapa del Cliente', 'Cartera', 'Actividades', 'Precios', 'Devoluciones - PQR'],
    'Punto de Venta': ['Presentación de Productos', 'Actividades', 'Precios', 'Exhibición', 'Capacitación']
};
// Trabajo interno: se programa igual que una visita, pero sin contacto ni objetivos
// y no cuenta en los indicadores de visitas
const TRABAJO_INTERNO = ['Trabajo Administrativo Oficina', 'Trabajo Administrativo Fuera de la Oficina', 'Planeación Mes'];
const esTrabajoInterno = tipo => TRABAJO_INTERNO.includes(tipo);
const MODALIDADES = { presencial: 'Presencial', virtual: 'Virtual' };
// Las visitas se programan antes de esta hora (Colombia, UTC-5) del día de la visita;
// las que se crean después quedan como NO programadas
const HORA_LIMITE = '08:00';
const GESTIONES = ['Pedido tomado', 'Presentación de productos', 'Seguimiento', 'Entrega de muestras', 'Cobro de cartera', 'Capacitación', 'Otro'];
const MOTIVOS = ['Cliente no estaba', 'Cerrado', 'Canceló la cita', 'Sin tiempo en la ruta', 'Reprogramada', 'Otro'];
const TIPOS_ACTIVIDAD = ['Visita especial', 'Ateneo / charla médica', 'Capacitación a punto de venta', 'Evento', 'Meta de ventas', 'Apertura de cliente', 'Recaudo de cartera', 'Otra'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

let sesion = null;              // { usuario, clave, ...datos del USUARIO }
let contactos = {};             // { zona: [{ n, c, e }] }
let registros = {};             // { id: visita | actividad }
let pendientes = new Set();     // ids por subir al servidor
let agenda = { fecha: hoy(), vendedor: null };
let mesAct = mesDe(hoy());
let mesPanel = mesDe(hoy());

// ---------- UTILIDADES ----------
function hoy() { return iso(new Date()); }
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function deIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function sumarDias(s, n) { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d); }
function lunesDe(s) { const d = deIso(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); }
function mesDe(s) { return s.slice(0, 7); }
function sumarMes(m, n) { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + n, 1); return iso(d).slice(0, 7); }
function finDeMes(m) { const [y, mm] = m.split('-').map(Number); return iso(new Date(y, mm, 0)); }
const mayuscula = t => t.charAt(0).toUpperCase() + t.slice(1);
const fechaLarga = s => deIso(s).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const fechaCorta = s => deIso(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const nombreMes = m => deIso(m + '-01').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normalizar = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const $ = id => document.getElementById(id);
const esJefe = () => sesion && sesion.tipo === 'jefe';
// El administrador (Hernán Reyes) es el único que autoriza eliminar visitas
const esAdmin = () => !!(sesion && sesion.admin);
const ADMIN = USUARIOS.find(u => u.admin);
const comercial = id => COMERCIALES.find(c => c.id === id);
const nombreVendedor = id => comercial(id)?.nombre || id;
const limiteProgramacion = fecha => Date.parse(`${fecha}T${HORA_LIMITE}:00-05:00`);
const esProgramada = v => v.programada !== false;
const modalidadDe = v => MODALIDADES[v.modalidad] || MODALIDADES.presencial;
function tipoSugerido(etiqueta) {
    const e = normalizar(etiqueta);
    if (!e) return '';
    if (e.includes('punto de venta')) return 'Punto de Venta';
    if (e.includes('medico')) return 'Visita Médica';
    return 'Visita Comercial';
}
const horaBonita = h => { const [H, M] = h.split(':').map(Number); return `${H % 12 || 12}:${String(M).padStart(2, '0')} ${H < 12 ? 'a. m.' : 'p. m.'}`; };
const fechaHora = isoTxt => new Date(isoTxt).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// ---------- DÍAS HÁBILES Y CIERRE DE VISITAS ----------
// Cada visita se reporta a más tardar a las 11:59 a. m. (Colombia) del siguiente día hábil;
// si no se reporta, queda automáticamente como NO visitada
const HORA_CIERRE = '11:59';
function pascua(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return iso(new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1));
}
const alLunes = f => sumarDias(f, (8 - deIso(f).getDay()) % 7);
const cacheFestivos = {};
// Festivos de Colombia (Ley Emiliani: varios se corren al lunes)
function festivos(y) {
    if (cacheFestivos[y]) return cacheFestivos[y];
    const f = md => `${y}-${md}`;
    const p = pascua(y);
    return cacheFestivos[y] = new Set([
        f('01-01'), f('05-01'), f('07-20'), f('08-07'), f('12-08'), f('12-25'),
        ...['01-06', '03-19', '06-29', '08-15', '10-12', '11-01', '11-11'].map(md => alLunes(f(md))),
        sumarDias(p, -3), sumarDias(p, -2), sumarDias(p, 43), sumarDias(p, 64), sumarDias(p, 71)
    ]);
}
const esHabil = f => { const w = deIso(f).getDay(); return w !== 0 && w !== 6 && !festivos(+f.slice(0, 4)).has(f); };
function siguienteHabil(f) { let d = sumarDias(f, 1); while (!esHabil(d)) d = sumarDias(d, 1); return d; }
const diaCierre = v => siguienteHabil(v.fecha);
const limiteCierre = v => Date.parse(`${diaCierre(v)}T${HORA_CIERRE}:59-05:00`);
const puedeReportar = v => v.estado === 'pendiente' && v.fecha <= hoy() && Date.now() <= limiteCierre(v);
const textoCierre = v => `${fechaCorta(diaCierre(v))}, ${horaBonita(HORA_CIERRE)}`;

// Pasa a NO visitado lo que no se reportó a tiempo (el jefe cierra las de todo el equipo)
function cerrarVencidas() {
    if (!sesion) return 0;
    const ahora = Date.now();
    const vencidas = visibles().filter(v => v.clase === 'visita' && v.estado === 'pendiente'
        && (esJefe() || v.vendedor === sesion.id) && ahora > limiteCierre(v));
    vencidas.forEach(v => {
        const cuando = new Date(ahora).toISOString();
        registros[v.id] = { ...v, estado: 'no_visitado', motivo: 'Sin reporte a tiempo', cierreAutomatico: true,
            registrada: cuando, actualizado: cuando, actualizadoPor: 'sistema' };
        pendientes.add(v.id);
    });
    if (vencidas.length) guardarLocal();
    return vencidas.length;
}

setInterval(() => { if (cerrarVencidas()) { repintarPantallaActiva(); sincronizar(); } }, 60000);

const pesos = v => v ? '$ ' + Number(v).toLocaleString('es-CO') : '';

function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('visible'), 2800);
}

async function huellaDe(usuario, clave) {
    const bytes = new TextEncoder().encode(`${usuario.toLowerCase()}:${clave.toLowerCase()}`);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- DATOS LOCALES ----------
function cargarLocal() {
    try {
        registros = JSON.parse(localStorage.getItem('rc_registros') || '{}');
        pendientes = new Set(JSON.parse(localStorage.getItem('rc_pendientes') || '[]'));
    } catch (e) {
        registros = {};
        pendientes = new Set();
    }
}

function guardarLocal() {
    localStorage.setItem('rc_registros', JSON.stringify(registros));
    localStorage.setItem('rc_pendientes', JSON.stringify([...pendientes]));
}

// Guarda un registro (visita o actividad) y lo deja listo para subir
function guardarRegistro(r) {
    r.actualizado = new Date().toISOString();
    if (r.clase === 'visita') r.limiteReporte = new Date(limiteCierre(r)).toISOString();
    r.actualizadoPor = sesion.id;
    registros[r.id] = r;
    pendientes.add(r.id);
    guardarLocal();
    programarAvisos();
    sincronizar();
}

function borrarRegistro(r) {
    r.borrado = true;
    guardarRegistro(r);
}

const visibles = () => Object.values(registros).filter(r => !r.borrado);
// Primero las citas fijas por hora; las visitas sin hora van después
const ordenCita = (a, b) => (a.hora ? 0 : 1) - (b.hora ? 0 : 1) || (a.hora || '').localeCompare(b.hora || '');
const visitasDe = (vendedor, fecha) => visibles()
    .filter(r => r.clase === 'visita' && r.vendedor === vendedor && r.fecha === fecha)
    .sort(ordenCita);
const visitasMes = (mes, vendedor) => visibles()
    .filter(r => r.clase === 'visita' && mesDe(r.fecha) === mes && (!vendedor || r.vendedor === vendedor));
const actividadesMes = (mes, vendedor) => visibles()
    .filter(r => r.clase === 'actividad' && r.mes === mes && (!vendedor || r.vendedor === vendedor));

// ---------- SINCRONIZACIÓN CON EL SERVIDOR ----------
let sincronizando = false;
let ultimaSync = null;
let errorSync = '';

async function llamarApi(cuerpo) {
    const resp = await fetch(API_URL, {
        method: 'POST',
        // text/plain evita la verificación previa (CORS) de Apps Script
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...cuerpo, usuario: sesion.usuario, clave: sesion.clave })
    });
    const datos = await resp.json();
    if (!datos.ok) throw new Error(datos.error || 'Error del servidor');
    return datos;
}

async function sincronizar(mesCentro = mesDe(hoy())) {
    if (!API_URL || !sesion || sincronizando) return pintarEstadoSync();
    sincronizando = true;
    pintarEstadoSync();
    try {
        // 1. Subir lo que se guardó en este dispositivo
        const porSubir = [...pendientes].map(id => registros[id]).filter(Boolean);
        if (porSubir.length) {
            await llamarApi({ accion: 'guardar', registros: porSubir });
            porSubir.forEach(r => { if (registros[r.id] === r) pendientes.delete(r.id); });
        }
        // 2. Traer lo del servidor: mes anterior, actual y siguiente
        const datos = await llamarApi({
            accion: 'listar',
            desde: sumarMes(mesCentro, -1) + '-01',
            hasta: finDeMes(sumarMes(mesCentro, 1))
        });
        datos.registros.forEach(r => {
            const local = registros[r.id];
            if (!pendientes.has(r.id) && (!local || (r.actualizado || '') >= (local.actualizado || ''))) registros[r.id] = r;
        });
        cerrarVencidas();
        guardarLocal();
        programarAvisos();
        ultimaSync = new Date();
        errorSync = '';
    } catch (e) {
        console.warn('No se pudo sincronizar:', e);
        errorSync = navigator.onLine ? (e.message || 'Error de conexión') : 'Sin internet';
    }
    sincronizando = false;
    pintarEstadoSync();
    repintarPantallaActiva();
}

function pintarEstadoSync() {
    const el = $('estadoSync');
    if (!el) return;
    if (!API_URL) {
        el.textContent = 'Los datos se guardan en este dispositivo.';
        return;
    }
    if (sincronizando) { el.textContent = 'Sincronizando…'; return; }
    const pend = pendientes.size ? `${pendientes.size} cambios por subir · ` : '';
    const cuando = errorSync ? `No se pudo conectar (${errorSync})`
        : ultimaSync ? `Actualizado ${ultimaSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : 'Conectando…';
    el.innerHTML = `${esc(pend + cuando)} · <button onclick="sincronizar()">Actualizar</button>`;
}

window.addEventListener('online', () => sincronizar());

// ---------- INICIO Y ACCESO ----------
document.addEventListener('DOMContentLoaded', async () => {
    cargarLocal();
    try {
        const resp = await fetch('contactos.json', { cache: 'no-cache' });
        contactos = await resp.json();
        localStorage.setItem('rc_contactos', JSON.stringify(contactos));
    } catch (e) {
        contactos = JSON.parse(localStorage.getItem('rc_contactos') || '{}');
    }
    try { sesion = JSON.parse(localStorage.getItem('rc_sesion') || 'null'); } catch (e) { sesion = null; }
    const u = sesion && USUARIOS.find(x => x.id === sesion.id);
    if (u) { sesion = { ...u, clave: sesion.clave }; entrarApp(); }
    else mostrarPantalla('loginScreen');
});

async function ingresar() {
    const usuario = $('accessUser').value.trim();
    const clave = $('accessCode').value.trim();
    const error = $('errorMsg');
    if (!usuario || !clave) { error.textContent = 'Ingresa tu usuario y clave'; return; }
    const huella = await huellaDe(usuario, clave);
    const u = USUARIOS.find(x => x.usuario.toLowerCase() === usuario.toLowerCase() && x.huella === huella);
    if (!u) {
        error.textContent = '❌ Usuario o clave incorrectos';
        $('accessCode').value = '';
        return;
    }
    sesion = { ...u, clave };
    localStorage.setItem('rc_sesion', JSON.stringify(sesion));
    error.textContent = '';
    entrarApp();
}

function cerrarSesion() {
    if (!confirm('¿Cerrar sesión?')) return;
    if (pendientes.size && API_URL && !confirm(`Hay ${pendientes.size} cambios sin subir al servidor. Si sales ahora se quedan en este dispositivo. ¿Salir de todas formas?`)) return;
    localStorage.removeItem('rc_sesion');
    sesion = null;
    $('accessUser').value = '';
    $('accessCode').value = '';
    mostrarPantalla('loginScreen');
}

function entrarApp() {
    agenda.vendedor = esJefe() ? COMERCIALES[0].id : sesion.id;
    const intro = $('homeIntro');
    intro.innerHTML = '';
    const saludo = document.createElement('span');
    saludo.className = 'home-saludo';
    saludo.textContent = `Hola, ${sesion.nombre}`;
    const detalle = document.createElement('small');
    detalle.textContent = esJefe() ? 'Jefe comercial · todo el equipo' : sesion.zona;
    saludo.appendChild(detalle);
    intro.appendChild(saludo);
    $('btnPanel').style.display = esJefe() ? '' : 'none';
    document.querySelectorAll('.solo-jefe').forEach(el => el.style.display = esJefe() ? '' : 'none');
    const opciones = COMERCIALES.map(c => `<option value="${c.id}">${esc(c.nombre)} · ${esc(c.zona)}</option>`).join('');
    $('agVendedor').innerHTML = opciones;
    $('actVendedor').innerHTML = '<option value="">Todo el equipo</option>' + opciones;
    cerrarVencidas();
    irInicio();
    programarAvisos();
    sincronizar();
}

function mostrarPantalla(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

function pantallaActiva() {
    return document.querySelector('.screen.active')?.id;
}

function repintarPantallaActiva() {
    const p = pantallaActiva();
    if (p === 'homeScreen') pintarInicio();
    if (p === 'agendaScreen') pintarAgenda();
    if (p === 'actScreen') pintarActividades();
    if (p === 'panelScreen') pintarPanel();
}

function irInicio() {
    pintarInicio();
    mostrarPantalla('homeScreen');
}

function pintarInicio() {
    const vend = esJefe() ? null : sesion.id;
    const deHoy = visibles().filter(r => r.clase === 'visita' && !r.interno && r.fecha === hoy() && (!vend || r.vendedor === vend));
    const pend = deHoy.filter(v => v.estado === 'pendiente').length;
    $('homeAgendaTxt').textContent = deHoy.length
        ? `Hoy: ${deHoy.length} ${deHoy.length === 1 ? 'visita' : 'visitas'}${pend ? ` · ${pend} por registrar` : ' · todas registradas'}`
        : esJefe() ? 'Hoy el equipo no tiene visitas programadas' : 'Hoy no tienes visitas programadas';
    const acts = actividadesMes(mesDe(hoy()), vend);
    const hechas = acts.filter(a => a.hecha).length;
    const sols = solicitudesPendientes();
    $('btnSolicitudes').style.display = esAdmin() ? '' : 'none';
    $('solicitudesTxt').textContent = sols.length ? `${sols.length} por revisar` : 'No hay solicitudes pendientes';
    $('homeActTxt').textContent = acts.length ? `${hechas} de ${acts.length} realizadas este mes` : 'Sin actividades programadas este mes';
    pintarEstadoSync();
}

// ---------- AVISO DE CITAS (15 minutos antes) ----------
const MINUTOS_AVISO = 15;
let temporizadores = [];
let registroSW = null;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(r => { registroSW = r; }).catch(() => {});
}

const momentoCita = v => Date.parse(`${v.fecha}T${v.hora}:00-05:00`);

function avisados() {
    try { return JSON.parse(localStorage.getItem('rc_avisados') || '{}'); } catch (e) { return {}; }
}

// Deja listos los avisos de las citas pendientes del vendedor en las próximas 24 horas.
// Funcionan mientras la app esté abierta (en pantalla o en segundo plano).
function programarAvisos() {
    temporizadores.forEach(clearTimeout);
    temporizadores = [];
    if (!sesion || esJefe()) return;
    const ahora = Date.now();
    const ya = avisados();
    visibles()
        .filter(v => v.clase === 'visita' && v.vendedor === sesion.id && v.estado === 'pendiente' && v.hora)
        .forEach(v => {
            const cita = momentoCita(v);
            const clave = v.id + '@' + v.fecha + 'T' + v.hora;
            if (ya[clave] || cita <= ahora || cita - ahora > 24 * 3600 * 1000) return;
            const espera = Math.max(0, cita - MINUTOS_AVISO * 60000 - ahora);
            temporizadores.push(setTimeout(() => avisarCita(v, clave), espera));
        });
    pintarBotonAvisos();
}

function avisarCita(v, clave) {
    const ya = avisados();
    ya[clave] = Date.now();
    localStorage.setItem('rc_avisados', JSON.stringify(ya));
    const faltan = Math.max(0, Math.round((momentoCita(v) - Date.now()) / 60000));
    const texto = `${v.contacto} · ${horaBonita(v.hora)} (${faltan ? `en ${faltan} min` : 'ahora'})`;
    $('avisoCitaTxt').textContent = texto;
    $('avisoCita').dataset.fecha = v.fecha;
    $('avisoCita').classList.add('visible');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    if ('Notification' in window && Notification.permission === 'granted') {
        const opciones = { body: texto, icon: 'icons/icon-192.png', tag: clave };
        if (registroSW) registroSW.showNotification('Cita en 15 minutos', opciones);
        else try { new Notification('Cita en 15 minutos', opciones); } catch (e) {}
    }
}

function verCitaAvisada() {
    cerrarAvisoCita();
    agenda.vendedor = sesion.id;
    agenda.fecha = $('avisoCita').dataset.fecha || hoy();
    abrirAgenda();
}

function cerrarAvisoCita() {
    $('avisoCita').classList.remove('visible');
}

function pintarBotonAvisos() {
    const b = $('btnAvisos');
    if (!b) return;
    b.hidden = esJefe() || !('Notification' in window) || Notification.permission !== 'default';
}

async function activarAvisos() {
    if (!('Notification' in window)) return;
    const permiso = await Notification.requestPermission();
    toast(permiso === 'granted' ? 'Listo: te avisaremos 15 minutos antes de cada cita' : 'Sin permiso de notificaciones: el aviso saldrá solo dentro de la app');
    pintarBotonAvisos();
}

// Al volver a la app se revisan los avisos (los temporizadores se pausan en segundo plano en algunos celulares)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (cerrarVencidas()) { repintarPantallaActiva(); sincronizar(); }
    programarAvisos();
});

// ---------- SOLICITUDES DE ELIMINACIÓN (administrador) ----------
const solicitudesPendientes = () => visibles().filter(v => v.clase === 'visita' && v.solicitudEliminar?.estado === 'pendiente');

function abrirSolicitudes() {
    const lista = solicitudesPendientes().sort((a, b) => a.solicitudEliminar.fecha.localeCompare(b.solicitudEliminar.fecha));
    abrirModal(`<div class="form-rc">
        <h2>Solicitudes de eliminación</h2>
        <p class="sub">Visitas que los vendedores piden eliminar por error de programación.</p>
        ${lista.length ? lista.map(v => `<div class="solicitud">
            <strong>${esc(v.contacto)}</strong>
            <small>${esc(nombreVendedor(v.vendedor))} · visita del ${esc(fechaCorta(v.fecha))} · pedida el ${esc(fechaHora(v.solicitudEliminar.fecha))}</small>
            <p>${esc(v.solicitudEliminar.motivo)}</p>
            <div class="form-botones">
                <button class="btn-secundario" onclick="resolverSolicitud('${v.id}', false)">Rechazar</button>
                <button class="btn-primario" style="background:#c2413a" onclick="resolverSolicitud('${v.id}', true)">Autorizar y eliminar</button>
            </div>
        </div>`).join('') : '<p class="no-results">No hay solicitudes pendientes.</p>'}
    </div>`, 'theme-rojo');
}

function resolverSolicitud(id, autorizar) {
    if (!esAdmin()) return;
    const v = registros[id];
    const solicitud = { ...v.solicitudEliminar, estado: autorizar ? 'aprobada' : 'rechazada', resueltaPor: sesion.id, resuelta: new Date().toISOString() };
    if (autorizar) borrarRegistro({ ...v, solicitudEliminar: solicitud });
    else guardarRegistro({ ...v, solicitudEliminar: solicitud });
    toast(autorizar ? 'Visita eliminada' : 'Solicitud rechazada');
    abrirSolicitudes();
    pintarInicio();
}

// ---------- AGENDA ----------
function abrirAgenda() {
    if (esJefe()) $('agVendedor').value = agenda.vendedor;
    pintarAgenda();
    mostrarPantalla('agendaScreen');
}

function cambiarVendedorAgenda() {
    agenda.vendedor = $('agVendedor').value;
    pintarAgenda();
}

function elegirFecha(f) {
    if (!f) return;
    const mesAntes = mesDe(agenda.fecha);
    agenda.fecha = f;
    pintarAgenda();
    if (mesDe(f) !== mesAntes) sincronizar(mesDe(f));
}

const moverDia = n => elegirFecha(sumarDias(agenda.fecha, n));
const irHoy = () => elegirFecha(hoy());

function pintarAgenda() {
    const f = agenda.fecha, t = hoy(), v = agenda.vendedor;
    $('agFechaTxt').textContent = f === t ? 'Hoy, ' + fechaLarga(f) : mayuscula(fechaLarga(f));
    const abierta = Date.now() < limiteProgramacion(f);
    $('agFechaSub').textContent = (esJefe() ? nombreVendedor(v) + ' · ' : '')
        + (abierta ? `Programa las visitas antes de las ${HORA_LIMITE} a. m.` : f === t ? 'Programación cerrada: lo nuevo queda como no programado' : f < t ? 'Día pasado' : '');
    $('agFechaPick').value = f;

    const lunes = lunesDe(f);
    $('agSemana').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(i => {
        const d = sumarDias(lunes, i);
        const puntos = visitasDe(v, d).slice(0, 5)
            .map(x => `<i class="${x.estado === 'visitado' ? 'ok' : x.estado === 'no_visitado' ? 'no' : ''}"></i>`).join('');
        return `<button class="sd${d === t ? ' hoy' : ''}${d === f ? ' sel' : ''}" onclick="elegirFecha('${d}')"><b>${DIAS[deIso(d).getDay()]}</b><span>${deIso(d).getDate()}</span><span class="puntos">${puntos}</span></button>`;
    }).join('');

    const lista = visitasDe(v, f);
    const k = cuentaVisitas(lista);
    const internos = lista.filter(x => x.interno).length;
    $('agResumen').innerHTML = lista.length
        ? `<span><b>${k.prog}</b> visitas programadas</span>${k.noProg ? `<span class="chip np">${k.noProg} no programadas</span>` : ''}<span class="chip ok">${k.ok} visitadas</span><span class="chip no">${k.no} no visitadas</span><span class="chip p">${k.p} pendientes</span>${internos ? `<span class="chip gris">${internos} trabajo interno</span>` : ''}`
        : '';

    const cont = $('agLista');
    if (!lista.length) {
        cont.innerHTML = '<div class="no-results">No hay visitas programadas para este día.<br><button class="btn-nuevo" style="margin-top:15px" onclick="abrirProgramar()">+ Programar</button></div>';
        return;
    }
    cont.innerHTML = lista.map(tarjetaVisita).join('');
}

function tarjetaVisita(v) {
    const clase = v.estado === 'visitado' ? 'ok' : v.estado === 'no_visitado' ? 'no' : '';
    const [txtOk, txtNo] = v.interno ? ['Realizado', 'No realizado'] : ['Visitado', 'No visitado'];
    const chip = v.estado === 'visitado' ? `<span class="chip ok">${txtOk}</span>`
        : v.estado === 'no_visitado' ? `<span class="chip no">${txtNo}</span>`
        : '<span class="chip p">Pendiente</span>';
    const meta = [v.tipoContacto, v.ciudad].filter(Boolean).map(esc).join(' · ');
    let objetivos = v.tipoVisita
        ? `<p class="objetivos"><b>${esc(v.tipoVisita)}</b>${(v.objetivos || []).map(o => `<span>${esc(o)}</span>`).join('')}</p>` : '';
    const noProgTxt = esProgramada(v) ? '' : `<span class="chip np">${v.interno ? 'No programado' : 'No programada'}</span>`;
    const marcas = v.interno ? `<span class="chip gris">Trabajo interno</span>${noProgTxt}`
        : `<span class="chip ${v.modalidad === 'virtual' ? 'azul' : 'gris'}">${modalidadDe(v)}</span>${noProgTxt}`;
    if (v.interno) objetivos = '';
    let reporte = '';
    if (v.estado === 'visitado' && v.interno) {
        reporte = v.observaciones ? `<div class="reporte">${esc(v.observaciones)}</div>` : '';
    } else if (v.estado === 'visitado') {
        const partes = [
            `<b>${esc(v.gestion)}</b>${v.atendio ? ` · Atendió: ${esc(v.atendio)}` : ''}`,
            v.productos ? `Productos: ${esc(v.productos)}` : '',
            v.muestras ? `Muestras: ${esc(v.muestras)}` : '',
            v.pedido === 'si' ? `Pedido: sí${v.valorPedido ? ' · ' + pesos(v.valorPedido) : ''}` : '',
            v.compromisos ? `Próximos pasos: ${esc(v.compromisos)}` : '',
            v.observaciones ? esc(v.observaciones) : ''
        ].filter(Boolean);
        reporte = `<div class="reporte">${partes.join('<br>')}</div>`;
    }
    if (v.estado === 'no_visitado') {
        reporte = `<div class="reporte"><b>${esc(v.motivo)}</b>${v.reprogramadaPara ? ` · Reprogramada para el ${esc(fechaCorta(v.reprogramadaPara))}` : ''}${v.observaciones ? '<br>' + esc(v.observaciones) : ''}</div>`;
    }
    return `<div class="producto-card visita-card ${clase}${v.interno ? ' interno' : ''}">
        <div class="visita-cab"><div>${v.hora ? `<span class="cita-fija"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Cita ${esc(horaBonita(v.hora))}</span>` : ''}<h3>${esc(v.contacto)}</h3></div>${chip}</div>
        ${meta ? `<p class="meta">${meta}</p>` : ''}
        <div class="marcas">${marcas}</div>
        ${objetivos}
        ${v.objetivo ? `<p>${esc(v.objetivo)}</p>` : ''}
        ${reporte}
        ${accionesVisita(v, txtOk, txtNo)}
    </div>`;
}

function accionesVisita(v, txtOk, txtNo) {
    const sol = v.solicitudEliminar;
    const eliminar = accionEliminar(v, 'link-mini')
        + (sol?.estado === 'rechazada' ? '<span class="chip gris">Eliminación rechazada</span>' : '');
    if (v.estado !== 'pendiente') {
        const nota = v.cierreAutomatico
            ? 'Cerrada automáticamente: no se reportó a tiempo'
            : `Reportada el ${fechaHora(v.registrada)}`;
        return `<div class="acciones cerrada"><span class="nota-cierre">🔒 ${esc(nota)}</span>${eliminar}</div>`;
    }
    const editar = `<button class="link-mini" onclick="abrirProgramar('${v.id}')">Editar</button>`;
    if (v.fecha > hoy()) {
        return `<div class="acciones"><span class="nota-cierre">Se reporta desde el ${esc(fechaCorta(v.fecha))} hasta el ${esc(textoCierre(v))}</span>${editar}${eliminar}</div>`;
    }
    return `<div class="acciones">
            <button class="bv ok" onclick="abrirRegistro('${v.id}','ok')">✓ ${txtOk}</button>
            <button class="bv no" onclick="abrirRegistro('${v.id}','no')">✕ ${txtNo}</button>
            <span class="nota-cierre alerta">Reportar hasta el ${esc(textoCierre(v))}</span>
            ${editar}${eliminar}
        </div>`;
}

// Eliminar: el administrador elimina directo; los demás piden autorización
function accionEliminar(v, clase) {
    if (esAdmin()) return `<button type="button" class="${clase}" onclick="eliminarVisita('${v.id}')">Eliminar</button>`;
    if (v.solicitudEliminar?.estado === 'pendiente') return '<span class="chip np">Eliminación por autorizar</span>';
    return `<button type="button" class="${clase}" onclick="solicitarEliminacion('${v.id}')">Solicitar eliminación</button>`;
}

function solicitarEliminacion(id) {
    const v = registros[id];
    abrirModal(`<form class="form-rc" onsubmit="enviarSolicitud(event, '${id}')">
        <h2>Solicitar eliminación</h2>
        <p class="sub">${esc(v.contacto)} · ${esc(fechaCorta(v.fecha))}</p>
        <p class="ayuda">Las visitas solo se eliminan con autorización de ${esc(ADMIN.nombre)}. Mientras tanto la visita sigue en la agenda.</p>
        <label for="sMotivo">¿Por qué se debe eliminar?</label>
        <textarea id="sMotivo" required placeholder="Ej: la programé dos veces por error"></textarea>
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario" style="background:#c2413a">Enviar solicitud</button>
        </div>
    </form>`, 'theme-rojo');
}

function enviarSolicitud(e, id) {
    e.preventDefault();
    guardarRegistro({ ...registros[id], solicitudEliminar: {
        estado: 'pendiente', motivo: $('sMotivo').value.trim(), por: sesion.id, fecha: new Date().toISOString()
    } });
    cerrarModal();
    toast(`Solicitud enviada a ${ADMIN.nombre}`);
    pintarAgenda();
}

// Formulario para programar (o editar) una visita o un trabajo interno
function abrirProgramar(id) {
    const v = id ? registros[id] : null;
    if (v && v.estado !== 'pendiente') return toast('Esta visita ya se cerró y no se puede modificar');
    const zona = comercial(agenda.vendedor)?.zona;
    const lista = contactos[zona] || [];
    const opcion = t => `<option ${t === v?.tipoVisita ? 'selected' : ''}>${esc(t)}</option>`;
    abrirModal(`<form class="form-rc" onsubmit="guardarProgramada(event, '${id || ''}')">
        <h2>${v ? 'Editar programación' : 'Programar'}</h2>
        <p class="sub">${esc(nombreVendedor(agenda.vendedor))} · ${esc(zona || '')}</p>
        <label for="fTipo">¿Qué vas a programar?</label>
        <select id="fTipo" required onchange="cambiarTipoProgramacion()">
            <option value="">Elige una opción</option>
            <optgroup label="Visitas">${Object.keys(TIPOS_VISITA).map(opcion).join('')}</optgroup>
            <optgroup label="Trabajo interno">${TRABAJO_INTERNO.map(opcion).join('')}</optgroup>
        </select>
        <div id="cajaContacto">
            <label for="fContacto">Contacto</label>
            <input id="fContacto" list="dlContactos" autocomplete="off" placeholder="Busca el médico, cliente o punto de venta" value="${esc(v?.contacto)}">
            <datalist id="dlContactos">${lista.map(c => `<option value="${esc(c.n)}" label="${esc([c.e, c.c].filter(Boolean).join(' · '))}">`).join('')}</datalist>
        </div>
        <div class="fila-fecha">
            <div><label for="fFecha">Fecha</label><input id="fFecha" type="date" required value="${v?.fecha || agenda.fecha}"></div>
            <div><label for="fHora">Cita fija</label><input id="fHora" type="time" value="${esc(v?.hora)}"></div>
        </div>
        <p class="ayuda">La hora es opcional: úsala solo si tienes una cita acordada. Te avisamos 15 minutos antes.</p>
        <div id="cajaModalidad">
            <label>Modalidad</label>
            ${botonesModalidad(v?.modalidad)}
        </div>
        <div id="cajaObjetivos" hidden>
            <label>Objetivos de la visita <small>(puedes escoger varios)</small></label>
            <div class="checks" id="fObjetivos"></div>
        </div>
        <label for="fObjetivo" id="lblNotas">Notas (opcional)</label>
        <textarea id="fObjetivo" placeholder="Ej: llevar lista de precios nueva">${esc(v?.objetivo)}</textarea>
        <p class="aviso-hora" id="fAviso" hidden></p>
        <div class="form-botones">
            ${v ? accionEliminar(v, 'btn-secundario btn-peligro') : ''}
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario">${v ? 'Guardar cambios' : 'Programar'}</button>
        </div>
    </form>`);
    cambiarTipoProgramacion(v?.objetivos || []);
    $('fContacto').addEventListener('change', sugerirTipo);
    $('fFecha').addEventListener('change', () => avisoProgramacion(v));
    avisoProgramacion(v);
}

// Muestra u oculta los campos según sea una visita o un trabajo interno
function cambiarTipoProgramacion(marcados) {
    const tipo = $('fTipo').value;
    const interno = esTrabajoInterno(tipo);
    $('cajaContacto').hidden = interno;
    $('cajaModalidad').hidden = interno;
    $('lblNotas').textContent = interno ? '¿Qué vas a hacer? (opcional)' : 'Notas (opcional)';
    $('fObjetivo').placeholder = interno ? 'Ej: cotizaciones pendientes, informe de cartera' : 'Ej: llevar lista de precios nueva';
    pintarObjetivos(marcados);
}

function botonesModalidad(actual = 'presencial') {
    return `<div class="modalidad" role="group" aria-label="Modalidad">${Object.entries(MODALIDADES).map(([k, t]) =>
        `<button type="button" class="${k}${k === (actual || 'presencial') ? ' on' : ''}" data-mod="${k}" onclick="elegirModalidad(this)">${k === 'virtual'
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'} ${t}</button>`).join('')}</div>`;
}

function elegirModalidad(boton) {
    boton.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === boton));
}

const modalidadElegida = () => document.querySelector('.modalidad .on')?.dataset.mod || 'presencial';

// Muestra los objetivos del tipo de visita elegido, conservando los que ya estén marcados
function pintarObjetivos(marcados) {
    const tipo = $('fTipo').value;
    const actuales = marcados || [...document.querySelectorAll('#fObjetivos input:checked')].map(i => i.value);
    $('cajaObjetivos').hidden = !TIPOS_VISITA[tipo];
    $('fObjetivos').innerHTML = (TIPOS_VISITA[tipo] || []).map(o =>
        `<label class="check"><input type="checkbox" value="${esc(o)}" ${actuales.includes(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('');
}

function sugerirTipo() {
    if ($('fTipo').value) return;
    const zona = comercial(agenda.vendedor)?.zona;
    const c = (contactos[zona] || []).find(x => normalizar(x.n) === normalizar($('fContacto').value));
    const tipo = tipoSugerido(c?.e);
    if (tipo) { $('fTipo').value = tipo; pintarObjetivos(); }
}

function avisoProgramacion(v) {
    const fecha = $('fFecha').value;
    const aviso = $('fAviso');
    const mismaFecha = v && v.fecha === fecha;
    const quedaNoProgramada = mismaFecha ? !esProgramada(v) : fecha && Date.now() >= limiteProgramacion(fecha);
    aviso.hidden = !quedaNoProgramada;
    aviso.textContent = mismaFecha
        ? 'Esta visita quedó como NO programada: se creó después de las 8:00 a. m. del día.'
        : `Ya pasaron las ${HORA_LIMITE} a. m. (hora Colombia) de ese día: la visita queda como NO programada.`;
}

function guardarProgramada(e, id) {
    e.preventDefault();
    const tipo = $('fTipo').value;
    const interno = esTrabajoInterno(tipo);
    const nombre = $('fContacto').value.trim();
    if (!interno && !nombre) { toast('Escribe el contacto de la visita'); return; }
    const objetivos = interno ? [] : [...document.querySelectorAll('#fObjetivos input:checked')].map(i => i.value);
    if (!interno && !objetivos.length) { toast('Escoge al menos un objetivo de la visita'); return; }
    const zona = comercial(agenda.vendedor)?.zona;
    const c = interno ? {} : (contactos[zona] || []).find(x => normalizar(x.n) === normalizar(nombre)) || {};
    const antes = id ? registros[id] : null;
    const fecha = $('fFecha').value;
    const v = antes ? { ...antes } : {
        id: nuevoId(), clase: 'visita', vendedor: agenda.vendedor, estado: 'pendiente',
        creado: new Date().toISOString(), creadoPor: sesion.id
    };
    Object.assign(v, {
        interno,
        contacto: interno ? tipo : (c.n || nombre), tipoContacto: c.e || '', ciudad: c.c || '',
        fecha, hora: $('fHora').value, objetivo: $('fObjetivo').value.trim(),
        modalidad: interno ? '' : modalidadElegida(), tipoVisita: tipo, objetivos,
        // Si cambia de día se vuelve a revisar si alcanzó a programarse antes de las 8:00 a. m.
        programada: antes && antes.fecha === fecha ? esProgramada(antes) : Date.now() < limiteProgramacion(fecha)
    });
    guardarRegistro(v);
    cerrarModal();
    toast(id ? 'Programación actualizada' : `${v.contacto}: ${v.programada ? 'programado' : 'registrado como NO programado'}`);
    if (v.fecha !== agenda.fecha) elegirFecha(v.fecha); else pintarAgenda();
}

function eliminarVisita(id) {
    if (!esAdmin() || !confirm('¿Eliminar esta visita?')) return;
    const v = registros[id];
    borrarRegistro({ ...v, solicitudEliminar: { ...(v.solicitudEliminar || {}), estado: 'aprobada', resueltaPor: sesion.id, resuelta: new Date().toISOString() } });
    cerrarModal();
    toast('Visita eliminada');
    pintarAgenda();
}

// Formulario para registrar lo que pasó: visitado / no visitado
function abrirRegistro(id, tipo) {
    const v = registros[id];
    const opciones = (lista, actual) => lista.map(o => `<option ${o === actual ? 'selected' : ''}>${esc(o)}</option>`).join('');
    if (!puedeReportar(v)) return toast(v.estado !== 'pendiente' ? 'Esta visita ya se cerró y no se puede modificar' : 'El plazo para reportar esta visita ya cerró');
    const cab = `<p class="sub">${esc(v.contacto)} · ${esc(fechaCorta(v.fecha))}${v.hora ? ' · Cita ' + esc(horaBonita(v.hora)) : ''}</p>
        <p class="aviso-hora">Plazo: ${esc(textoCierre(v))}. Después de guardar, el reporte no se puede modificar.</p>`;
    if (tipo === 'ok' && v.interno) {
        abrirModal(`<form class="form-rc" onsubmit="guardarInternoRealizado(event, '${id}')">
            <h2>Trabajo realizado</h2>${cab}
            <label for="rObs">¿Qué se hizo?</label>
            <textarea id="rObs" placeholder="Ej: se enviaron 5 cotizaciones y se cerró el informe de cartera">${esc(v.estado === 'visitado' ? v.observaciones : '')}</textarea>
            <div class="form-botones">
                <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-primario">Guardar</button>
            </div>
        </form>`);
    } else if (tipo === 'ok') {
        const ya = v.estado === 'visitado';
        abrirModal(`<form class="form-rc" onsubmit="guardarVisitado(event, '${id}')">
            <h2>Registrar visita</h2>${cab}
            <label>Modalidad</label>
            ${botonesModalidad(v.modalidad)}
            <div class="dos">
                <div><label for="rGestion">¿Qué se hizo?</label><select id="rGestion">${opciones(GESTIONES, v.gestion)}</select></div>
                <div><label for="rAtendio">¿Quién atendió?</label><input id="rAtendio" value="${esc(ya ? v.atendio : '')}" placeholder="Nombre y cargo"></div>
            </div>
            <label for="rProductos">Productos presentados</label>
            <input id="rProductos" value="${esc(ya ? v.productos : '')}" placeholder="Ej: Kojic Plus, Retinol 0,5%">
            <label for="rMuestras">Muestras entregadas</label>
            <input id="rMuestras" value="${esc(ya ? v.muestras : '')}" placeholder="Producto y cantidad">
            <label>¿Hubo pedido?</label>
            <div class="opciones-si-no">
                <label><input type="radio" name="rPedido" value="si" ${ya && v.pedido === 'si' ? 'checked' : ''} onchange="$('cajaValor').hidden=false"> Sí</label>
                <label><input type="radio" name="rPedido" value="no" ${!ya || v.pedido !== 'si' ? 'checked' : ''} onchange="$('cajaValor').hidden=true"> No</label>
            </div>
            <div id="cajaValor" ${ya && v.pedido === 'si' ? '' : 'hidden'}>
                <label for="rValor">Valor del pedido (COP)</label>
                <input id="rValor" type="number" min="0" step="1000" inputmode="numeric" value="${esc(ya ? v.valorPedido : '')}">
            </div>
            <label for="rCompromisos">Compromisos / próximos pasos</label>
            <textarea id="rCompromisos" placeholder="Ej: volver el 15 con la lista de precios">${esc(ya ? v.compromisos : '')}</textarea>
            <label for="rObs">Observaciones</label>
            <textarea id="rObs">${esc(ya ? v.observaciones : '')}</textarea>
            <div class="form-botones">
                <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-primario">Guardar visita</button>
            </div>
        </form>`);
    } else {
        const ya = v.estado === 'no_visitado';
        abrirModal(`<form class="form-rc" onsubmit="guardarNoVisitado(event, '${id}')">
            <h2>${v.interno ? 'No realizado' : 'No visitado'}</h2>${cab}
            <label for="nMotivo">Motivo</label>
            <select id="nMotivo">${opciones(MOTIVOS, v.motivo)}</select>
            <label for="nRepro">Reprogramar para (opcional)</label>
            <input id="nRepro" type="date" min="${sumarDias(v.fecha, 1)}" value="${esc(ya ? v.reprogramadaPara : '')}" ${ya && v.reprogramadaPara ? 'disabled' : ''}>
            <label for="nObs">Observaciones</label>
            <textarea id="nObs" placeholder="Ej: la doctora estaba en cirugía">${esc(ya ? v.observaciones : '')}</textarea>
            <div class="form-botones">
                <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-primario" style="background:#c2413a">Guardar</button>
            </div>
        </form>`, 'theme-rojo');
    }
}

const LIMPIAR_VISITADO = { gestion: '', atendio: '', productos: '', muestras: '', pedido: '', valorPedido: '', compromisos: '' };
const LIMPIAR_NO_VISITADO = { motivo: '' };

// Revisa que el plazo siga abierto al momento de guardar
function plazoAbierto(id) {
    if (puedeReportar(registros[id])) return true;
    cerrarModal();
    toast('El plazo para reportar esta visita ya cerró');
    pintarAgenda();
    return false;
}

function guardarVisitado(e, id) {
    e.preventDefault();
    if (!plazoAbierto(id)) return;
    const pedido = document.querySelector('input[name=rPedido]:checked').value;
    const v = {
        ...registros[id], ...LIMPIAR_NO_VISITADO,
        estado: 'visitado',
        modalidad: modalidadElegida(),
        gestion: $('rGestion').value,
        atendio: $('rAtendio').value.trim(),
        productos: $('rProductos').value.trim(),
        muestras: $('rMuestras').value.trim(),
        pedido,
        valorPedido: pedido === 'si' ? $('rValor').value : '',
        compromisos: $('rCompromisos').value.trim(),
        observaciones: $('rObs').value.trim(),
        registrada: new Date().toISOString()
    };
    guardarRegistro(v);
    cerrarModal();
    toast('Visita registrada');
    pintarAgenda();
}

function guardarInternoRealizado(e, id) {
    e.preventDefault();
    if (!plazoAbierto(id)) return;
    guardarRegistro({ ...registros[id], ...LIMPIAR_NO_VISITADO, estado: 'visitado', observaciones: $('rObs').value.trim(), registrada: new Date().toISOString() });
    cerrarModal();
    toast('Trabajo registrado como realizado');
    pintarAgenda();
}

function guardarNoVisitado(e, id) {
    e.preventDefault();
    if (!plazoAbierto(id)) return;
    const antes = registros[id];
    const repro = $('nRepro').disabled ? '' : $('nRepro').value;
    const v = {
        ...antes, ...LIMPIAR_VISITADO,
        estado: 'no_visitado',
        motivo: $('nMotivo').value,
        observaciones: $('nObs').value.trim(),
        reprogramadaPara: repro || antes.reprogramadaPara || '',
        registrada: new Date().toISOString()
    };
    guardarRegistro(v);
    // La visita reprogramada queda como una nueva visita pendiente en esa fecha
    if (repro && !antes.reprogramadaPara) {
        guardarRegistro({
            id: nuevoId(), clase: 'visita', vendedor: antes.vendedor, estado: 'pendiente',
            contacto: antes.contacto, tipoContacto: antes.tipoContacto, ciudad: antes.ciudad,
            fecha: repro, hora: '', objetivo: antes.objetivo, vieneDe: antes.fecha,
            modalidad: antes.modalidad, tipoVisita: antes.tipoVisita, objetivos: antes.objetivos, interno: !!antes.interno,
            programada: Date.now() < limiteProgramacion(repro),
            creado: new Date().toISOString(), creadoPor: sesion.id
        });
    }
    cerrarModal();
    toast(repro ? `Reprogramada para el ${fechaCorta(repro)}` : 'Marcada como no visitada');
    pintarAgenda();
}

// ---------- ACTIVIDADES DEL MES ----------
function abrirActividades() {
    if (!esJefe()) $('actVendedor').value = sesion.id;
    pintarActividades();
    mostrarPantalla('actScreen');
}

function moverMesAct(n) {
    mesAct = sumarMes(mesAct, n);
    pintarActividades();
    sincronizar(mesAct);
}

function vendedorActividades() {
    return esJefe() ? $('actVendedor').value : sesion.id;
}

function pintarActividades() {
    const vend = vendedorActividades();
    const lista = actividadesMes(mesAct, vend)
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.titulo.localeCompare(b.titulo));
    const hechas = lista.filter(a => a.hecha);
    $('actMesTxt').textContent = mayuscula(nombreMes(mesAct));
    $('actMesSub').textContent = esJefe() ? (vend ? nombreVendedor(vend) : 'Todo el equipo') : sesion.zona;
    const pct = lista.length ? Math.round(hechas.length / lista.length * 100) : 0;
    $('actBarra').style.width = pct + '%';
    $('actPct').textContent = lista.length ? `${hechas.length} de ${lista.length} · ${pct}%` : 'Sin actividades';

    const cont = $('actLista');
    if (!lista.length) {
        cont.innerHTML = `<div class="no-results">No hay actividades programadas para ${esc(nombreMes(mesAct))}.<br><button class="btn-nuevo" style="margin-top:15px" onclick="abrirActividad()">+ Nueva actividad</button></div>`;
        return;
    }
    const tarjeta = a => `<div class="producto-card act-card${a.hecha ? ' hecha' : ''}" onclick="abrirActividad('${a.id}')">
        <button class="act-check" onclick="event.stopPropagation(); marcarActividad('${a.id}')" aria-label="${a.hecha ? 'Desmarcar' : 'Marcar como realizada'}">${a.hecha ? '✓' : ''}</button>
        <div class="act-cuerpo">
            <h3>${esc(a.titulo)}</h3>
            <p class="meta">${esc(a.tipo)}${a.fecha ? ' · ' + esc(fechaCorta(a.fecha)) : ''}${esJefe() && !vend ? ' · ' + esc(nombreVendedor(a.vendedor)) : ''}</p>
            ${a.detalle ? `<p>${esc(a.detalle)}</p>` : ''}
            ${a.hecha ? `<div class="reporte"><b>Realizada el ${esc(fechaCorta(a.fechaRealizada))}</b>${a.resultado ? '<br>' + esc(a.resultado) : ''}</div>` : ''}
        </div>
    </div>`;
    const pend = lista.filter(a => !a.hecha);
    cont.innerHTML = (pend.length ? `<p class="grupo-titulo">Por hacer · ${pend.length}</p>` + pend.map(tarjeta).join('') : '')
        + (hechas.length ? `<p class="grupo-titulo">Realizadas · ${hechas.length}</p>` + hechas.map(tarjeta).join('') : '');
}

function abrirActividad(id) {
    const a = id ? registros[id] : null;
    const vendPorDefecto = a?.vendedor || vendedorActividades() || COMERCIALES[0].id;
    const opcionesVend = COMERCIALES.map(c => `<option value="${c.id}" ${c.id === vendPorDefecto ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
    const fechaDef = a?.fecha || (mesAct === mesDe(hoy()) ? hoy() : mesAct + '-01');
    abrirModal(`<form class="form-rc" onsubmit="guardarActividad(event, '${id || ''}')">
        <h2>${a ? 'Actividad' : 'Nueva actividad'}</h2>
        <p class="sub">${esc(nombreMes(mesAct))}</p>
        ${esJefe() ? `<label for="aVend">Vendedor</label><select id="aVend">${opcionesVend}</select>` : ''}
        <label for="aTitulo">Actividad</label>
        <input id="aTitulo" required value="${esc(a?.titulo)}" placeholder="Ej: Ateneo Hospital San José">
        <div class="dos">
            <div><label for="aTipo">Tipo</label><select id="aTipo">${TIPOS_ACTIVIDAD.map(t => `<option ${t === a?.tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
            <div><label for="aFecha">Fecha</label><input id="aFecha" type="date" required value="${fechaDef}"></div>
        </div>
        <label for="aDetalle">Detalle / meta</label>
        <textarea id="aDetalle" placeholder="Qué se espera lograr">${esc(a?.detalle)}</textarea>
        ${a?.hecha ? `<label for="aResultado">Resultado</label><textarea id="aResultado">${esc(a.resultado)}</textarea>` : ''}
        <div class="form-botones">
            ${a ? `<button type="button" class="btn-secundario btn-peligro" onclick="eliminarActividad('${a.id}')">Eliminar</button>` : ''}
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario" style="background:#1e63c4">${a ? 'Guardar' : 'Programar'}</button>
        </div>
    </form>`, 'theme-azul');
}

function guardarActividad(e, id) {
    e.preventDefault();
    const a = id ? { ...registros[id] } : {
        id: nuevoId(), clase: 'actividad', hecha: false,
        creado: new Date().toISOString(), creadoPor: sesion.id
    };
    const fecha = $('aFecha').value;
    Object.assign(a, {
        vendedor: esJefe() ? $('aVend').value : (a.vendedor || sesion.id),
        titulo: $('aTitulo').value.trim(),
        tipo: $('aTipo').value,
        fecha,
        mes: mesDe(fecha),
        detalle: $('aDetalle').value.trim()
    });
    if ($('aResultado')) a.resultado = $('aResultado').value.trim();
    guardarRegistro(a);
    cerrarModal();
    toast(id ? 'Actividad actualizada' : 'Actividad programada');
    if (a.mes !== mesAct) mesAct = a.mes;
    pintarActividades();
}

function eliminarActividad(id) {
    if (!confirm('¿Eliminar esta actividad?')) return;
    borrarRegistro({ ...registros[id] });
    cerrarModal();
    toast('Actividad eliminada');
    pintarActividades();
}

function marcarActividad(id) {
    const a = registros[id];
    if (a.hecha) {
        guardarRegistro({ ...a, hecha: false, fechaRealizada: '', resultado: '' });
        toast('Actividad desmarcada');
        return pintarActividades();
    }
    abrirModal(`<form class="form-rc" onsubmit="guardarRealizada(event, '${id}')">
        <h2>Actividad realizada</h2>
        <p class="sub">${esc(a.titulo)}</p>
        <label for="hFecha">Fecha en que se hizo</label>
        <input id="hFecha" type="date" required value="${hoy() < a.fecha ? a.fecha : hoy()}">
        <label for="hResultado">Resultado</label>
        <textarea id="hResultado" placeholder="Ej: asistieron 14 médicos, se entregaron 30 muestras"></textarea>
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario" style="background:#1e63c4">Marcar como realizada</button>
        </div>
    </form>`, 'theme-azul');
}

function guardarRealizada(e, id) {
    e.preventDefault();
    guardarRegistro({ ...registros[id], hecha: true, fechaRealizada: $('hFecha').value, resultado: $('hResultado').value.trim() });
    cerrarModal();
    toast('Actividad realizada');
    pintarActividades();
}

// ---------- PANEL DEL EQUIPO (jefe) ----------
function abrirPanel() {
    pintarPanel();
    mostrarPantalla('panelScreen');
}

function moverMesPanel(n) {
    mesPanel = sumarMes(mesPanel, n);
    pintarPanel();
    sincronizar(mesPanel);
}

// Indicadores de visitas (el trabajo interno no cuenta). Cumplimiento = visitadas de las programadas
function cuentaVisitas(todas) {
    const lista = todas.filter(v => !v.interno);
    const ok = lista.filter(v => v.estado === 'visitado').length;
    const no = lista.filter(v => v.estado === 'no_visitado').length;
    const prog = lista.filter(esProgramada);
    const okProg = prog.filter(v => v.estado === 'visitado').length;
    return {
        t: lista.length, ok, no, p: lista.length - ok - no,
        prog: prog.length, noProg: lista.length - prog.length, okProg,
        cumpl: prog.length ? okProg / prog.length : 0,
        virtual: lista.filter(v => v.modalidad === 'virtual').length,
        pedidos: lista.filter(v => v.pedido === 'si').length,
        internos: todas.length - lista.length
    };
}
const pct = (k) => k.prog ? Math.round(k.cumpl * 100) + '%' : '—';

function pintarPanel() {
    $('panMesTxt').textContent = mayuscula(nombreMes(mesPanel));
    $('panMesSub').textContent = API_URL ? 'Datos de todo el equipo' : 'Solo los datos guardados en este dispositivo';
    const vis = visitasMes(mesPanel);
    const acts = actividadesMes(mesPanel);
    const c = cuentaVisitas(vis);
    const actHechas = acts.filter(a => a.hecha).length;
    $('panKpis').innerHTML = `
        <div class="kpi"><small>Programadas</small><b>${c.prog}</b></div>
        <div class="kpi np"><small>No programadas</small><b>${c.noProg}</b></div>
        <div class="kpi ok"><small>Visitadas</small><b>${c.ok}</b></div>
        <div class="kpi no"><small>No visitadas</small><b>${c.no}</b></div>
        <div class="kpi p"><small>Pendientes</small><b>${c.p}</b></div>
        <div class="kpi"><small>Cumplimiento</small><b>${pct(c)}</b></div>
        <div class="kpi azul"><small>Virtuales</small><b>${c.virtual}</b></div>
        <div class="kpi azul"><small>Actividades</small><b>${actHechas}/${acts.length}</b></div>`;

    const barra = k => `<div class="celda-barra"><span class="barra"><i class="ok" style="width:${k.prog ? k.okProg / k.prog * 100 : 0}%"></i></span><b>${pct(k)}</b></div>`;

    // Indicador del día: lo programado antes de las 8:00 a. m. frente a lo que se agregó después
    const t = hoy();
    const deHoy = visibles().filter(x => x.clase === 'visita' && x.fecha === t);
    $('panHoyTxt').textContent = mayuscula(fechaLarga(t));
    $('panHoy').innerHTML = `<thead><tr><th>Vendedor</th><th class="n">Prog.</th><th class="n">No prog.</th><th class="n">Visit.</th><th class="n">No visit.</th><th class="n">Pend.</th><th class="n">Trab. interno</th></tr></thead><tbody>`
        + COMERCIALES.map(v => {
            const k = cuentaVisitas(deHoy.filter(x => x.vendedor === v.id));
            return `<tr><td><b>${esc(v.nombre)}</b><small>${esc(v.zona)}</small></td>
                <td class="n">${k.prog}</td><td class="n${k.noProg ? ' alerta' : ''}">${k.noProg}</td><td class="n">${k.ok}</td><td class="n">${k.no}</td><td class="n">${k.p}</td><td class="n">${k.internos}</td></tr>`;
        }).join('') + '</tbody>';

    $('panTabla').innerHTML = `<thead><tr><th>Vendedor</th><th class="n">Prog.</th><th class="n">No prog.</th><th class="n">Visit.</th><th class="n">No visit.</th><th class="n">Pend.</th><th class="n">Virtual</th><th class="n">Pedidos</th><th>Cumplimiento</th><th class="n">Actividades</th></tr></thead><tbody>`
        + COMERCIALES.map(v => {
            const k = cuentaVisitas(vis.filter(x => x.vendedor === v.id));
            const a = acts.filter(x => x.vendedor === v.id);
            return `<tr><td><b>${esc(v.nombre)}</b><small>${esc(v.zona)}</small></td>
                <td class="n">${k.prog}</td><td class="n">${k.noProg}</td><td class="n">${k.ok}</td><td class="n">${k.no}</td><td class="n">${k.p}</td><td class="n">${k.virtual}</td><td class="n">${k.pedidos}</td>
                <td>${barra(k)}</td><td class="n">${a.filter(x => x.hecha).length}/${a.length}</td></tr>`;
        }).join('') + '</tbody>';

    const motivos = {};
    vis.filter(v => v.estado === 'no_visitado' && !v.interno).forEach(v => { motivos[v.motivo] = (motivos[v.motivo] || 0) + 1; });
    const orden = Object.entries(motivos).sort((a, b) => b[1] - a[1]);
    $('panMotivos').innerHTML = orden.length
        ? orden.map(([m, n]) => `<div class="motivo"><span>${esc(m)}</span><b>${n}</b></div>`).join('')
        : '<p class="no-results" style="padding:10px">Sin visitas fallidas este mes.</p>';
}

// ---------- DESCARGAR INFORME (Excel) ----------
function abrirDescarga() {
    const opcionesVend = esJefe()
        ? `<label for="dVend">Vendedor</label><select id="dVend"><option value="">Todo el equipo</option>${COMERCIALES.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select>`
        : '';
    abrirModal(`<form class="form-rc" onsubmit="descargarInforme(event)">
        <h2>Descargar informe</h2>
        <p class="sub">Excel con las visitas, lo registrado en cada una y las actividades del mes.</p>
        <label for="dMes">Mes</label>
        <input id="dMes" type="month" required value="${mesDe(hoy())}">
        ${opcionesVend}
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario" id="btnDescargar">Descargar Excel</button>
        </div>
    </form>`);
}

function cargarExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise((ok, falla) => {
        const s = document.createElement('script');
        s.src = 'lib/exceljs.min.js';
        s.onload = ok;
        s.onerror = () => falla(new Error('No se pudo cargar el generador de Excel'));
        document.head.appendChild(s);
    });
}

async function descargarInforme(e) {
    e.preventDefault();
    const boton = $('btnDescargar');
    boton.disabled = true;
    boton.textContent = 'Generando…';
    try {
        const mes = $('dMes').value;
        const vend = esJefe() ? $('dVend').value : sesion.id;
        await sincronizar(mes);
        await cargarExcelJS();
        const libro = armarLibro(mes, vend);
        const buffer = await libro.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const quien = vend ? nombreVendedor(vend).replace(/\s+/g, '_') : 'Equipo';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Visitas_${quien}_${mes}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        cerrarModal();
        toast('Informe descargado');
    } catch (err) {
        console.error(err);
        toast('No se pudo generar el Excel. Revisa tu conexión e intenta de nuevo.');
        boton.disabled = false;
        boton.textContent = 'Descargar Excel';
    }
}

function armarLibro(mes, vend) {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Ruta Comercial Epithelium';
    const verde = 'FF006B4F';
    const estadoTxt = { visitado: 'Visitado', no_visitado: 'No visitado', pendiente: 'Pendiente' };
    // ExcelJS guarda las fechas en UTC: se arman en UTC para que no se corran de día
    const fecha = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
    const vendedores = vend ? COMERCIALES.filter(c => c.id === vend) : COMERCIALES;
    const vis = visitasMes(mes, vend).sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenCita(a, b));
    const acts = actividadesMes(mes, vend).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

    const hoja = nombre => {
        const h = libro.addWorksheet(nombre, { views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }] });
        h.getCell('A1').value = `${nombre} · ${nombreMes(mes)}`;
        h.getCell('A1').font = { bold: true, size: 14, color: { argb: verde } };
        h.getCell('A2').value = vend ? `${nombreVendedor(vend)} · ${comercial(vend).zona}` : 'Todo el equipo';
        h.getCell('A2').font = { color: { argb: 'FF666666' } };
        return h;
    };
    const tabla = (h, nombre, columnas, filas) => {
        h.addTable({
            name: nombre, ref: 'A3', headerRow: true,
            style: { theme: 'TableStyleMedium7', showRowStripes: true },
            columns: columnas.map(c => ({ name: c.t, filterButton: true })),
            rows: filas.length ? filas : [columnas.map(() => null)]
        });
        columnas.forEach((c, i) => {
            const col = h.getColumn(i + 1);
            col.width = c.w;
            if (c.f) col.numFmt = c.f;
            col.alignment = { vertical: 'top', wrapText: !!c.wrap };
        });
        h.views = [{ showGridLines: false, state: 'frozen', ySplit: 3 }];
    };

    // Resumen
    const r = hoja('Resumen');
    const colsR = [
        { t: 'Vendedor', w: 22 }, { t: 'Zona', w: 20 }, { t: 'Programadas', w: 13 }, { t: 'No programadas', w: 16 },
        { t: 'Visitadas', w: 12 }, { t: 'No visitadas', w: 13 }, { t: 'Pendientes', w: 12 }, { t: 'Cumplimiento', w: 14, f: '0%' },
        { t: 'Presenciales', w: 13 }, { t: 'Virtuales', w: 11 }, { t: 'Pedidos', w: 10 }, { t: 'Valor pedidos', w: 16, f: '"$" #,##0' },
        { t: 'Trabajo interno', w: 15 }, { t: 'Actividades', w: 12 }, { t: 'Act. realizadas', w: 15 }
    ];
    tabla(r, 'TablaResumen', colsR, vendedores.map(v => {
        const lv = vis.filter(x => x.vendedor === v.id);
        const k = cuentaVisitas(lv);
        const la = acts.filter(x => x.vendedor === v.id);
        const valor = lv.filter(x => x.pedido === 'si').reduce((s, x) => s + (Number(x.valorPedido) || 0), 0);
        return [v.nombre, v.zona, k.prog, k.noProg, k.ok, k.no, k.p, k.cumpl, k.t - k.virtual, k.virtual, k.pedidos, valor,
            k.internos, la.length, la.filter(x => x.hecha).length];
    }));

    // Visitas
    const h = hoja('Visitas');
    const colsV = [
        { t: 'Fecha', w: 12, f: 'dd/mm/yyyy' }, { t: 'Cita fija', w: 10 }, { t: 'Vendedor', w: 20 }, { t: 'Contacto', w: 32 },
        { t: 'Tipo de contacto', w: 24 }, { t: 'Ciudad', w: 14 }, { t: 'Programada', w: 12 }, { t: 'Modalidad', w: 12 },
        { t: 'Tipo de visita', w: 26 }, { t: 'Objetivos', w: 36, wrap: true }, { t: 'Notas', w: 30, wrap: true }, { t: 'Estado', w: 13 },
        { t: 'Gestión', w: 22 }, { t: 'Atendió', w: 20 }, { t: 'Productos presentados', w: 30, wrap: true },
        { t: 'Muestras', w: 24, wrap: true }, { t: 'Pedido', w: 8 }, { t: 'Valor pedido', w: 14, f: '"$" #,##0' },
        { t: 'Compromisos', w: 30, wrap: true }, { t: 'Motivo no visita', w: 20 }, { t: 'Reprogramada para', w: 14, f: 'dd/mm/yyyy' },
        { t: 'Observaciones', w: 36, wrap: true }, { t: 'Reportada', w: 17, f: 'dd/mm/yyyy hh:mm' },
        { t: 'Cierre', w: 14 }, { t: 'Plazo de reporte', w: 17, f: 'dd/mm/yyyy hh:mm' }
    ];
    // Fecha y hora de Colombia para Excel (que no maneja zonas horarias)
    const horaCol = t => t ? new Date(Date.parse(t) - 5 * 3600000) : null;
    tabla(h, 'TablaVisitas', colsV, vis.map(v => [
        fecha(v.fecha), v.hora || '', nombreVendedor(v.vendedor), v.interno ? '' : v.contacto, v.tipoContacto || '', v.ciudad || '',
        esProgramada(v) ? 'Sí' : 'No', v.interno ? '' : modalidadDe(v), v.tipoVisita || '', (v.objetivos || []).join(', '), v.objetivo || '',
        (v.interno ? { visitado: 'Realizado', no_visitado: 'No realizado' }[v.estado] : null) || estadoTxt[v.estado] || v.estado, v.gestion || '', v.atendio || '', v.productos || '', v.muestras || '',
        v.pedido === 'si' ? 'Sí' : v.estado === 'visitado' ? 'No' : '', v.valorPedido ? Number(v.valorPedido) : null,
        v.compromisos || '', v.motivo || '', fecha(v.reprogramadaPara), v.observaciones || '',
        v.estado === 'pendiente' ? null : horaCol(v.registrada),
        v.estado === 'pendiente' ? '' : v.cierreAutomatico ? 'Automático' : 'Vendedor',
        horaCol(new Date(limiteCierre(v)).toISOString())
    ]));

    // Actividades
    const a = hoja('Actividades');
    const colsA = [
        { t: 'Fecha', w: 12, f: 'dd/mm/yyyy' }, { t: 'Vendedor', w: 20 }, { t: 'Actividad', w: 34, wrap: true }, { t: 'Tipo', w: 26 },
        { t: 'Detalle / meta', w: 36, wrap: true }, { t: 'Estado', w: 12 }, { t: 'Fecha realizada', w: 15, f: 'dd/mm/yyyy' },
        { t: 'Resultado', w: 40, wrap: true }
    ];
    tabla(a, 'TablaActividades', colsA, acts.map(x => [
        fecha(x.fecha), nombreVendedor(x.vendedor), x.titulo, x.tipo, x.detalle || '',
        x.hecha ? 'Realizada' : 'Por hacer', fecha(x.fechaRealizada), x.resultado || ''
    ]));
    return libro;
}

// ---------- MODAL ----------
function abrirModal(html, tema = '') {
    const caja = document.querySelector('#modal .modal-content');
    caja.classList.remove('theme-rojo', 'theme-azul');
    if (tema) caja.classList.add(tema);
    $('modalContenido').innerHTML = html;
    $('modal').classList.add('active');
}

function cerrarModal() {
    $('modal').classList.remove('active');
    $('modalContenido').innerHTML = '';
}

window.onclick = e => { if (e.target === $('modal')) cerrarModal(); };
