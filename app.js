// CONFIGURACIÓN
// URL de la aplicación web de Google Apps Script (ver backend/Codigo.gs).
// Vacía = los datos se guardan solo en este dispositivo.
// Versión publicada: al cambiar, la app ofrece actualizarse (se genera junto con version.txt)
const APP_VERSION = '202609291530';
const API_URL = 'https://script.google.com/macros/s/AKfycbwji7WhPpF2VhCRQETWXNFhF2PTAL8JP8z9SW-stsKdnjbyBa-KVucGCvm6seoTFLfl3Q/exec';

// Zona de un vendedor que todavía no tiene zona: no trae contactos de la Maestra (todo lo que programe queda como contacto nuevo)
const ZONA_POR_ASIGNAR = 'Zona por asignar';

// Usuarios: la clave no se guarda aquí, solo su huella SHA-256 de "usuario:clave" (en minúsculas)
const USUARIOS = [
    { usuario: 'L.Ramos',     huella: 'afecd958a07662fa1c466a63fa799f91873a1371f878dc6e4bd6c35ffce87617', tipo: 'comercial', id: 'lramos',     nombre: 'Lizeth Ramos',      zona: 'Zona Norte' },
    { usuario: 'Y.Caballero', huella: 'df5769c03aec2c0300cd912335962a57617271fa86e0ef852d5d959895c6ecab', tipo: 'comercial', id: 'ycaballero', nombre: 'Yunelis Caballero', zona: 'Zona Sur' },
    { usuario: 'J.Herrera',   huella: '564177c2a1926013ea79ab83b4bbfe0c3f44fb9585eda1c407504de6424f24c0', tipo: 'comercial', id: 'jherrera',   nombre: 'Jennifer Herrera',  zona: 'Clientes Especiales', jefe: true, cargo: 'Coordinadora Comercial' },
    { usuario: 'M.Castro',    huella: '2b2ebf7f55852620d6c6b80fd886a502c3ffa470d4eae22dcad0fe2dfd5b1d88', tipo: 'comercial', id: 'mcastro',    nombre: 'M. Castro',         zona: ZONA_POR_ASIGNAR },
    { usuario: 'H.Reyes',     huella: '0213f79c165b6d4bee6bd9eab719817266af1fc9a45ed22cadfccda60f0a122d', tipo: 'jefe',      id: 'hreyes',     nombre: 'Hernán Reyes', admin: true, cargo: 'Gerente General' }
];
const COMERCIALES = USUARIOS.filter(u => u.tipo === 'comercial');

// Acceso directo al Vademécum Epithelium: los dos sitios están en epitheliumsa.github.io y comparten el
// almacenamiento del navegador, así que se deja la sesión del Vademécum lista con el mismo perfil que
// tiene cada usuario allá (comerciales con su zona; equipo ve todos los portafolios)
const VADEMECUM_URL = 'https://epitheliumsa.github.io/vademecum-epithelium/';
const PERFIL_VADEMECUM = {
    lramos: { tipo: 'comercial', zona: 'Zona Norte' },
    ycaballero: { tipo: 'comercial', zona: 'Zona Sur' },
    jherrera: { tipo: 'equipo', zona: null },   // jefe comercial: ve todas las zonas
    mcastro: { tipo: 'equipo', zona: null },
    hreyes: { tipo: 'equipo', zona: null }
};

// El enlace lleva además un código de acceso (SHA-256 de "vademecum:usuario:clave") que el Vademécum
// verifica: así entra sin clave aunque la app esté instalada y no comparta el almacenamiento del navegador
async function prepararEnlaceVademecum() {
    const enlace = document.querySelector('.home-btn-vade');
    if (!enlace) return;
    enlace.href = VADEMECUM_URL;
    if (!sesion || !PERFIL_VADEMECUM[sesion.id] || !sesion.clave) return;
    const bytes = new TextEncoder().encode(`vademecum:${sesion.usuario}:${sesion.clave}`.toLowerCase());
    const codigo = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    enlace.href = `${VADEMECUM_URL}#acceso=${codigo}`;
}

function abrirVademecum(e) {
    const perfil = sesion && PERFIL_VADEMECUM[sesion.id];
    if (!perfil) return;   // sin perfil: el Vademécum pide su usuario y clave como siempre
    try {
        localStorage.setItem('vademecum_interno', JSON.stringify(perfil));
        localStorage.removeItem('vademecum_cliente');
        localStorage.setItem('vademecum_timestamp', new Date().toISOString());
    } catch (err) { /* sin almacenamiento: el Vademécum pedirá la clave */ }
}

// Tipo de visita y sus objetivos (se pueden escoger varios)
// Objetivos y subcategorías por tipo: vienen de objetivos.js, que se genera desde
// datos/Matriz_objetivos_subcategorias.xlsx (herramientas/matriz_objetivos.py). No se editan aquí.
const MATRIZ = window.MATRIZ_OBJETIVOS || { objetivos: {}, subcategorias: {}, variables: [], mensual: {} };
const TIPOS_VISITA = Object.fromEntries(['Visita Médica', 'Visita Comercial', 'Punto de Venta'].map(t => [t, MATRIZ.objetivos[t] || []]));
// Variante del tipo: true = contacto nuevo; 'medcom' = visita médica y comercial a la vez (clientes 20 y 21 con las
// dos marcadas), que tiene sus propios objetivos en la matriz ("Visita Médica Comercial")
const claveTipo = (tipo, nuevo) => nuevo === 'medcom'
    ? (tipo === 'Visita Médica' && MATRIZ.objetivos['medcom:' + tipo] ? 'medcom:' + tipo : tipo)
    : (nuevo && TIPOS_VISITA[tipo] ? 'nuevo:' : '') + tipo;
const objetivosDeTipo = (tipo, nuevo) => MATRIZ.objetivos[claveTipo(tipo, nuevo)] || [];
// Una visita puede ser de varios tipos a la vez (Visita Médica y Visita Comercial, según la clasificación del cliente)
const listaTipos = t => (Array.isArray(t) ? t : [t]).filter(Boolean);
const tiposDe = v => v.tiposVisita?.length ? v.tiposVisita : listaTipos(v.tipoVisita);
const nombreTipo = v => tiposDe(v).join(' + ');
const objetivosDeTipos = (tipos, nuevo) => [...new Set(listaTipos(tipos).flatMap(t => objetivosDeTipo(t, nuevo)))];
// Tipos de visita en que sale un cliente según su clasificación (datos/Matriz_tipo_visita_clasificacion.xlsx).
// Sin clasificación o sin marcar en la matriz: sale en todos.
const tiposDeCliente = c => (MATRIZ.tiposPorClasificacion || {})[c?.cl] || Object.keys(TIPOS_VISITA);
const AMBOS_TIPOS = ['Visita Médica', 'Visita Comercial'];
const permiteAmbos = c => !!c && AMBOS_TIPOS.every(t => tiposDeCliente(c).includes(t));
// Subcategorías variables (Parrilla Promocional, Actividades): las del mes que cargue un jefe en la app o, si no, las del archivo
const esVariable = o => (MATRIZ.variables || []).includes(o);
const idMensual = mes => `mensual-${mes}`;
const listasDelMes = mes => {
    const r = registros[idMensual(mes)];
    return r && !r.borrado ? r.listas || {} : (MATRIZ.mensual || {})[mes] || {};
};
const subcategoriasDe = (tipo, nuevo, objetivo, mes) => esVariable(objetivo)
    ? listasDelMes(mes)[objetivo] || []
    : [...new Set(listaTipos(tipo).flatMap(t => ((MATRIZ.subcategorias || {})[claveTipo(t, nuevo)] || {})[objetivo] || []))];
// En el cierre salen todos los objetivos del tipo: los programados en negrita y los demás en gris claro
// En el cierre solo salen los objetivos de la matriz vigente. Los nombres viejos de visitas programadas
// antes del cambio se pasan al nombre nuevo; los que ya no existen no salen.
const NOMBRES_VIEJOS = { 'Cartera': 'Administración de Cartera', 'Mapa del Cliente': 'Mapa del Cliente - Ampliación Portafolio' };
const esMedCom = tipos => AMBOS_TIPOS.every(t => tipos.includes(t)) && !!MATRIZ.objetivos['medcom:Visita Médica'];
const varianteDe = v => v.esProyecto ? true : esMedCom(tiposDe(v)) ? 'medcom' : false;
// Médica y comercial a la vez: una sola lista, la de "Visita Médica Comercial"
const tiposEfectivos = (tipos, variante) => variante === 'medcom' ? ['Visita Médica'] : tipos;
const objetivosCierre = v => objetivosDeTipos(tiposEfectivos(tiposDe(v), varianteDe(v)), varianteDe(v));
const programadosVigentes = v => {
    const base = objetivosCierre(v);
    return (v.objetivos || []).map(o => NOMBRES_VIEJOS[o] || o).filter(o => base.includes(o));
};
const cumplidosProgramados = v => (v.objetivosCumplidos || []).filter(o => (v.objetivos || []).includes(o));
// Trabajo interno: se programa igual que una visita (con objetivos), pero sin contacto
// y no cuenta en los indicadores de visitas
const TRABAJO_INTERNO = ['Trabajo Administrativo Oficina', 'Trabajo Administrativo Fuera de la Oficina', 'Planeación Mes'];
const esTrabajoInterno = tipo => TRABAJO_INTERNO.includes(tipo);
// Novedades del vendedor: días en que no trabaja o trabaja parcial. No son visitas ni cuentan en los indicadores
const NOVEDADES = ['Cita médica', 'Cumpleaños', 'Incapacidad', 'Permiso', 'Vacaciones'];   // en orden alfabético
const NOVEDAD_HORAS = ['Cita médica', 'Permiso'];   // pueden ser de día completo o por horas
const NOVEDAD_RANGO = ['Vacaciones', 'Incapacidad', 'Permiso'];   // se pueden programar por varios días
const esNovedad = tipo => NOVEDADES.includes(tipo);
const novedadesDe = (vendedor, fecha) => visibles().filter(r => r.clase === 'novedad' && r.vendedor === vendedor
    && r.fecha <= fecha && (r.hasta || r.fecha) >= fecha);
// Un permiso puede ser de día completo (uno o varios días) o por horas en un solo día
const esPorHoras = n => NOVEDAD_HORAS.includes(n.tipo) && !n.diaCompleto && n.horaInicio && n.horaFin;
const rangoNovedad = n => esPorHoras(n) ? `${fechaCorta(n.fecha)}, de ${horaBonita(n.horaInicio)} a ${horaBonita(n.horaFin)}`
    : n.hasta && n.hasta !== n.fecha ? `${fechaCorta(n.fecha)} al ${fechaCorta(n.hasta)}` : fechaCorta(n.fecha);
const CORTO_NOVEDAD = { Vacaciones: 'Vacac.', Incapacidad: 'Incap.', Permiso: 'Permiso', 'Cumpleaños': 'Cumple', 'Cita médica': 'Cita méd.' };
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
let agenda = { fecha: hoy(), vendedor: null, filtro: '', orden: 'prog' };
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
// Ven a todo el equipo: los jefes (Hernán Reyes, M. Castro) y la jefe comercial (Jennifer Herrera),
// que además tiene su propia agenda como vendedora
const esJefe = () => !!(sesion && (sesion.tipo === 'jefe' || sesion.jefe));
const esComercial = () => !!(sesion && sesion.tipo === 'comercial');
// El administrador (Hernán Reyes) es el único que autoriza eliminar visitas
const esAdmin = () => !!(sesion && sesion.admin);
const ADMIN = USUARIOS.find(u => u.admin);
const comercial = id => COMERCIALES.find(c => c.id === id);
const nombreVendedor = id => comercial(id)?.nombre || id;
const limiteProgramacion = fecha => Date.parse(`${fecha}T${HORA_LIMITE}:00-05:00`);
const esProgramada = v => v.programada !== false;
const modalidadDe = v => MODALIDADES[v.modalidad] || MODALIDADES.presencial;
// Tipo con el que se abre un cliente: el de su clasificación; si tiene varios, el que sugiere su etiqueta
const tipoDeCliente = c => { const ts = tiposDeCliente(c), t = tipoSugerido(c?.e || ''); return ts.includes(t) ? t : ts[0]; };
function tipoSugerido(etiqueta) {
    const e = normalizar(etiqueta);
    if (!e) return '';
    if (e.includes('punto de venta')) return 'Punto de Venta';
    if (e.includes('medico')) return 'Visita Médica';
    if (e.includes('cliente')) return 'Visita Comercial';
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
// Calendario oficial de festivos de Colombia (Ley 51 de 1983, Ley Emiliani: varios se corren al lunes)
function festivos(y) {
    if (cacheFestivos[y]) return cacheFestivos[y];
    const f = md => `${y}-${md}`;
    const p = pascua(y);
    return cacheFestivos[y] = new Map([
        [f('01-01'), 'Año Nuevo'],
        [alLunes(f('01-06')), 'Día de los Reyes Magos'],
        [alLunes(f('03-19')), 'Día de San José'],
        [sumarDias(p, -3), 'Jueves Santo'],
        [sumarDias(p, -2), 'Viernes Santo'],
        [f('05-01'), 'Día del Trabajo'],
        [sumarDias(p, 43), 'Ascensión del Señor'],
        [sumarDias(p, 64), 'Corpus Christi'],
        [sumarDias(p, 71), 'Sagrado Corazón de Jesús'],
        [alLunes(f('06-29')), 'San Pedro y San Pablo'],
        [f('07-20'), 'Día de la Independencia'],
        [f('08-07'), 'Batalla de Boyacá'],
        [alLunes(f('08-15')), 'Asunción de la Virgen'],
        [alLunes(f('10-12')), 'Día de la Raza'],
        [alLunes(f('11-01')), 'Día de Todos los Santos'],
        [alLunes(f('11-11')), 'Independencia de Cartagena'],
        [f('12-08'), 'Día de la Inmaculada Concepción'],
        [f('12-25'), 'Navidad']
    ]);
}
const nombreFestivo = f => festivos(+f.slice(0, 4)).get(f) || '';
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
// ---------- ETAPA DE LOS DATOS (pruebas / en vivo) ----------
// Mientras se prueba la app, todo lo que se registra queda marcado como 'pruebas'.
// PARA SALIR EN VIVO: cambiar ETAPA_DATOS a 'vivo' y publicar. Al abrir esa versión, cada celular borra
// una sola vez lo guardado en pruebas y la app ignora los registros de pruebas que sigan en la hoja de Google.
// (Hernán puede luego borrar esas filas de la pestaña Registros cuando quiera; ya no afectan la app.)
const ETAPA_DATOS = 'pruebas';
const etapaDe = r => r.etapa || 'pruebas';   // lo registrado antes de esta marca es de pruebas

function limpiarSiCambioEtapa() {
    try {
        const anterior = localStorage.getItem('rc_etapa');
        if (anterior === ETAPA_DATOS) return;
        if (anterior !== null || ETAPA_DATOS !== 'pruebas') {
            // Cambió la etapa: se borra lo local de la etapa anterior (la sesión y los contactos se conservan)
            ['rc_registros', 'rc_pendientes', 'rc_avisados'].forEach(k => localStorage.removeItem(k));
            console.info(`Datos de "${anterior || 'pruebas'}" borrados: la app pasa a "${ETAPA_DATOS}"`);
        }
        localStorage.setItem('rc_etapa', ETAPA_DATOS);
    } catch (e) { /* sin almacenamiento local */ }
}

function cargarLocal() {
    limpiarSiCambioEtapa();
    try {
        registros = JSON.parse(localStorage.getItem('rc_registros') || '{}');
        Object.keys(registros).forEach(id => { if (etapaDe(registros[id]) !== ETAPA_DATOS) delete registros[id]; });
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
    r.etapa = ETAPA_DATOS;
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
let sincronizarOtraVez = false;   // hubo cambios mientras se sincronizaba: se repite al terminar
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
    if (sincronizando) { sincronizarOtraVez = true; return; }
    if (!API_URL || !sesion) return pintarEstadoSync();
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
            if (etapaDe(r) !== ETAPA_DATOS) return;   // registros de otra etapa (pruebas) no entran
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
    if (sincronizarOtraVez) { sincronizarOtraVez = false; if (pendientes.size) sincronizar(mesCentro); }
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

async function cerrarSesion() {
    if (!await dialogo({ titulo: '¿Cerrar sesión?', aceptar: 'Cerrar sesión' })) return;
    if (pendientes.size && API_URL && !await dialogo({ titulo: 'Hay cambios sin subir', texto: `Hay ${pendientes.size} cambios sin subir al servidor. Si sales ahora se quedan en este dispositivo.`, aceptar: 'Salir de todas formas' })) return;
    localStorage.removeItem('rc_sesion');
    sesion = null;
    $('accessUser').value = '';
    $('accessCode').value = '';
    mostrarPantalla('loginScreen');
}

function entrarApp() {
    agenda.vendedor = esComercial() ? sesion.id : COMERCIALES[0].id;
    const intro = $('homeIntro');
    intro.innerHTML = '';
    const saludo = document.createElement('span');
    saludo.className = 'home-saludo';
    saludo.textContent = `Hola, ${sesion.nombre}`;
    const detalle = document.createElement('small');
    detalle.textContent = [sesion.cargo || 'Visitador Médico Comercial', sesion.zona].filter(Boolean).join(' · ');
    saludo.appendChild(detalle);
    intro.appendChild(saludo);
    $('btnPanel').style.display = esJefe() ? '' : 'none';
    $('btnMensual').style.display = esJefe() ? '' : 'none';
    $('maestraTxt').textContent = esJefe() ? 'Clientes por zona y vendedor' : 'Clientes de tu zona';
    document.querySelectorAll('.solo-jefe').forEach(el => el.style.display = esJefe() ? '' : 'none');
    const opciones = COMERCIALES.map(c => `<option value="${c.id}">${esc(c.nombre)} · ${esc(c.zona)}</option>`).join('');
    $('agVendedor').innerHTML = opciones;
    $('actVendedor').innerHTML = '<option value="">Todo el equipo</option>' + opciones;
    cerrarVencidas();
    prepararEnlaceVademecum();
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
    if (p === 'visiplanScreen') pintarVisiplan();
    if (p === 'maestraScreen') pintarMaestra();
}

function irInicio() {
    pintarInicio();
    mostrarPantalla('homeScreen');
}

function pintarInicio() {
    const vend = esComercial() ? sesion.id : null;
    const deHoy = visibles().filter(r => r.clase === 'visita' && !r.interno && r.fecha === hoy() && (!vend || r.vendedor === vend));
    const pend = deHoy.filter(v => v.estado === 'pendiente').length;
    $('homeAgendaTxt').textContent = deHoy.length
        ? `Hoy: ${deHoy.length} ${deHoy.length === 1 ? 'visita' : 'visitas'}${pend ? ` · ${pend} por registrar` : ' · todas registradas'}`
        : esComercial() ? 'Hoy no tienes visitas programadas' : 'Hoy el equipo no tiene visitas programadas';
    const acts = actividadesMes(mesDe(hoy()), vend);
    const hechas = acts.filter(a => a.hecha).length;
    const proys = proyectos().filter(p => p.estado !== 'vinculado' && (esJefe() || p.vendedor === sesion.id)).length;
    $('proyectosTxt').textContent = proys ? `${proys} sin crear en la Maestra de Contactos` : 'Proyectos que aún no están en la Maestra de Contactos';
    const solsCreacion = solicitudesCreacion().length;
    $('btnCreacion').style.display = esJefe() ? '' : 'none';
    $('creacionTxt').textContent = solsCreacion ? `${solsCreacion} por revisar` : 'No hay solicitudes pendientes';
    const sols = solicitudesPendientes();
    $('btnSolicitudes').style.display = esAdmin() ? '' : 'none';
    $('solicitudesTxt').textContent = sols.length ? `${sols.length} por revisar` : 'No hay solicitudes pendientes';
    $('homeActTxt').textContent = acts.length ? `${hechas} de ${acts.length} realizadas este mes` : 'Sin actividades programadas este mes';
    pintarEstadoSync();
}

// ---------- ACTUALIZACIÓN DE LA APP ----------
// Revisa si hay una versión nueva publicada y ofrece recargar (evita quedarse con la versión guardada en el celular)
async function revisarVersion() {
    try {
        const resp = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
        if (!resp.ok) return;
        const publicada = (await resp.text()).trim();
        if (!publicada || publicada === APP_VERSION) return;
        // Se recarga sola una vez por versión (sin cambios por subir); si no, queda el aviso para actualizar
        let yaIntentada = null;
        try { yaIntentada = sessionStorage.getItem('rc_recarga'); } catch (e) {}
        if (yaIntentada !== publicada && !pendientes.size) {
            try { sessionStorage.setItem('rc_recarga', publicada); } catch (e) {}
            return location.replace(location.pathname + '?v=' + publicada);
        }
        $('avisoVersion').classList.add('visible');
    } catch (e) { /* sin conexión: se revisa después */ }
}

function actualizarApp() {
    if (pendientes.size && API_URL) sincronizar();
    location.replace(location.pathname + '?v=' + Date.now());
}

document.addEventListener('DOMContentLoaded', revisarVersion);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarVersion(); });

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
    if (!esComercial()) return;
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
    b.hidden = !esComercial() || !('Notification' in window) || Notification.permission !== 'default';
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

// ---------- CONTACTOS NUEVOS (PROYECTO) ----------
// Contactos que todavía no están en la Maestra de Contactos. Se visitan como "Contacto nuevo" (proyecto);
// cuando se van a volver clientes, el vendedor envía la "solicitud de creación" a los jefes y, una vez
// creado en la Maestra, el contacto se vincula (sus visitas pasan al nombre de la Maestra).
const TIPOS_PROYECTO = ['Médico', 'Cliente', 'Punto de Venta'];
const ESTADO_PROYECTO = { proyecto: 'Contacto nuevo', solicitud: 'Solicitud de creación', vinculado: 'Creado en la Maestra' };
const proyectos = () => visibles().filter(r => r.clase === 'proyecto');
const proyectosDeZona = zona => proyectos().filter(p => p.zona === zona && p.estado !== 'vinculado');
const buscarMaestra = (zona, nombre) => (contactos[zona] || []).find(x => normalizar(x.n) === normalizar(nombre));
const buscarProyecto = (zona, nombre) => proyectosDeZona(zona).find(p => normalizar(p.nombre) === normalizar(nombre));
const solicitudesCreacion = () => proyectos().filter(p => p.estado === 'solicitud');
const JEFE_COMERCIAL = USUARIOS.find(u => u.jefe);
const visitasDeProyecto = id => visibles().filter(v => v.clase === 'visita' && v.contactoProyecto === id);

const opcionesMaestra = (zona, tipo) => (contactos[zona] || []).filter(c => !TIPOS_VISITA[tipo] || tiposDeCliente(c).includes(tipo))
    .map(c => `<option value="${esc(c.n)}" label="${esc([c.e, c.c].filter(Boolean).join(' · '))}">`).join('');
const opcionesProyecto = zona => proyectosDeZona(zona)
    .map(p => `<option value="${esc(p.nombre)}" label="${esc([ESTADO_PROYECTO[p.estado], p.tipo, p.ciudad].filter(Boolean).join(' · '))}">`).join('');

// "Maestra de Contactos" o "Contacto nuevo": cambia la lista del buscador y abre los datos del proyecto

// "Contacto nuevo" es una sola opción del menú; el tipo de visita se elige en un segundo campo
// Tipo de visita elegido en el menú (Visita Médica, Visita Comercial o Punto de Venta); en clientes 20 y 21 el
// vendedor puede marcar también el otro tipo (ver tiposCliente)
const esTipoVisita = f => !!TIPOS_VISITA[f];
const tipoBase = () => { const f = $('fTipo').value; return f === 'nuevo' ? $('fTipoNuevo').value : esTipoVisita(f) ? tiposCliente()[0] || f : f; };
const origenElegido = () => $('fTipo').value === 'nuevo' ? 'nuevo' : 'maestra';
const TIPO_CONTACTO_DE_VISITA = { 'Visita Médica': 'Médico', 'Visita Comercial': 'Cliente', 'Punto de Venta': 'Punto de Venta' };

function cambiarTipoNuevo() {
    const t = TIPO_CONTACTO_DE_VISITA[$('fTipoNuevo').value];
    if (t) { $('pTipo').value = t; etiquetaPersonaProyecto(); }
    pintarObjetivos();
}

function elegirOrigen(origen) {
    $('lblContacto').innerHTML = (origen === 'nuevo' ? 'Contacto nuevo ' : 'Cliente ') + REQ + (origen === 'nuevo' ? '' : ' <small>(Maestra de Contactos)</small>');
    const zona = comercial(agenda.vendedor)?.zona;
    $('dlContactos').innerHTML = origen === 'nuevo' ? opcionesProyecto(zona) : opcionesMaestra(zona, $('fTipo').value);
    $('fContacto').placeholder = origen === 'nuevo' ? 'Nombre del contacto nuevo o búscalo si ya lo visitaste' : 'Busca el médico, cliente o punto de venta';
    revisarProyecto();
}


function revisarProyecto() {
    const nuevo = origenElegido() === 'nuevo';
    const zona = comercial(agenda.vendedor)?.zona;
    const existente = nuevo && buscarProyecto(zona, $('fContacto').value);
    $('cajaProyecto').hidden = !nuevo || !!existente;
    $('ayudaContacto').hidden = !existente;
    if (existente) {
        const n = visitasDeProyecto(existente.id).length;
        $('ayudaContacto').textContent = `Contacto nuevo ya registrado (${ESTADO_PROYECTO[existente.estado].toLowerCase()}) · ${n} ${n === 1 ? 'visita' : 'visitas'} antes`;
    }
}

// El nombre de contacto es obligatorio para clientes y puntos de venta; en un médico el contacto es el mismo médico
function etiquetaPersonaProyecto() {
    const obligatorio = $('pTipo').value !== 'Médico';
    $('lblPersona').innerHTML = obligatorio ? 'Nombre de contacto ' + REQ : 'Nombre de contacto <small>(opcional)</small>';
    $('pPersona').placeholder = obligatorio ? 'Persona con quien se habla (ej: administradora)' : 'Ej: asistente o secretaria';
}

function abrirProyectos(filtro) {
    const lista = proyectos()
        .filter(p => esJefe() || p.vendedor === sesion.id)
        .filter(p => !filtro || p.estado === filtro)
        .sort((a, b) => ['solicitud', 'proyecto', 'vinculado'].indexOf(a.estado) - ['solicitud', 'proyecto', 'vinculado'].indexOf(b.estado) || a.nombre.localeCompare(b.nombre));
    const chip = p => `<span class="chip ${p.estado === 'vinculado' ? 'ok' : p.estado === 'solicitud' ? 'np' : 'proy'}">${ESTADO_PROYECTO[p.estado]}</span>`;
    const acciones = p => {
        if (p.estado === 'vinculado') return `<p>Creado en la Maestra como <b>${esc(p.vinculadoA)}</b></p>`;
        const botones = [];
        if (p.estado === 'proyecto') botones.push(`<button class="btn-secundario" onclick="solicitarCreacion('${p.id}')">Solicitud de creación</button>`);
        if (p.estado === 'solicitud' && esJefe()) botones.push(`<button class="btn-secundario btn-peligro" onclick="rechazarCreacion('${p.id}')">Rechazar</button>`);
        if (esJefe()) botones.push(`<button class="btn-primario" onclick="$('vin-${p.id}').hidden=false; this.parentElement.hidden=true">Vincular a la Maestra</button>`);
        return `${p.solicitud && p.estado === 'solicitud' ? `<p class="nota-sol">Solicitada el ${esc(fechaHora(p.solicitud.fecha))} por ${esc(nombreVendedor(p.solicitud.por))}${p.solicitud.nota ? ': ' + esc(p.solicitud.nota) : ''}</p>` : ''}
            ${p.rechazo && p.estado === 'proyecto' ? `<p class="nota-sol">Solicitud rechazada${p.rechazo.motivo ? ': ' + esc(p.rechazo.motivo) : ''}</p>` : ''}
            ${p.estado === 'solicitud' && !esJefe() ? '<p class="nota-sol">Enviada a los jefes. Cuando se cree en la Maestra de Contactos quedará vinculado.</p>' : ''}
            <div class="vincular" id="vin-${p.id}" hidden>
                <label for="vinInput-${p.id}">Contacto creado en la Maestra de Contactos</label>
                <input id="vinInput-${p.id}" list="dlMaestra-${p.id}" autocomplete="off" placeholder="Busca el contacto en la Maestra">
                <datalist id="dlMaestra-${p.id}">${opcionesMaestra(p.zona)}</datalist>
                <div class="form-botones"><button class="btn-secundario" onclick="abrirProyectos(${filtro ? `'${filtro}'` : ''})">Cancelar</button><button class="btn-primario" onclick="vincularProyecto('${p.id}')">Vincular</button></div>
            </div>
            ${botones.length ? `<div class="form-botones">${botones.join('')}</div>` : ''}`;
    };
    abrirModal(`<div class="form-rc">
        <h2>${filtro === 'solicitud' ? 'Solicitudes de creación' : 'Contactos nuevos'}</h2>
        <p class="sub">${filtro === 'solicitud'
            ? 'Contactos nuevos que los vendedores piden crear en la Maestra de Contactos. Cuando lo crees, vincúlalo aquí.'
            : 'Contactos que aún no están en la Maestra de Contactos. Cuando se vaya a volver cliente, envía la solicitud de creación.'}</p>
        ${lista.length ? lista.map(p => `<div class="solicitud proyecto${p.estado === 'vinculado' ? ' vinculado' : ''}">
            <div class="visita-cab"><strong>${esc(p.nombre)}</strong>${chip(p)}</div>
            <small>${esc([p.tipo, p.persona, p.direccion, p.ciudad, p.telefono].filter(Boolean).join(' · '))}${esJefe() ? ' · ' + esc(nombreVendedor(p.vendedor)) : ''} · ${visitasDeProyecto(p.id).length} ${visitasDeProyecto(p.id).length === 1 ? 'visita' : 'visitas'}</small>
            ${acciones(p)}
        </div>`).join('') : `<p class="no-results">${filtro === 'solicitud' ? 'No hay solicitudes de creación pendientes.' : 'No hay contactos nuevos. Se crean al programar una visita marcando "Contacto nuevo".'}</p>`}
    </div>`);
}

// El vendedor revisa los datos del contacto y envía la solicitud de creación a los jefes
function solicitarCreacion(id) {
    const p = registros[id];
    abrirModal(`<form class="form-rc" onsubmit="enviarSolicitudCreacion(event, '${id}')">
        <h2>Solicitud de creación</h2>
        <p class="sub">${esc(p.nombre)} se va a volver cliente. Revisa sus datos: la solicitud le llega a ${esc(JEFE_COMERCIAL?.nombre || 'la jefe comercial')} y a ${esc(ADMIN.nombre)}.</p>
        <div class="dos">
            <div><label for="sTipo">Tipo</label><select id="sTipo">${TIPOS_PROYECTO.map(t => `<option ${t === p.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div><label for="sCiudad">Ciudad</label><input id="sCiudad" required value="${esc(p.ciudad)}"></div>
        </div>
        <label for="sPersona">Nombre de contacto</label><input id="sPersona" value="${esc(p.persona)}">
        <label for="sDir">Dirección</label><input id="sDir" required value="${esc(p.direccion)}">
        <label for="sTel">Teléfono</label><input id="sTel" type="tel" required value="${esc(p.telefono)}">
        <label for="sNota">Observaciones para la creación (opcional)</label>
        <textarea id="sNota" placeholder="Ej: NIT, correo de facturación, condiciones acordadas"></textarea>
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="abrirProyectos()">Cancelar</button>
            <button class="btn-primario">Enviar solicitud</button>
        </div>
    </form>`);
}

function enviarSolicitudCreacion(e, id) {
    e.preventDefault();
    guardarRegistro({ ...registros[id], estado: 'solicitud', tipo: $('sTipo').value, ciudad: $('sCiudad').value.trim(),
        persona: $('sPersona').value.trim(), direccion: $('sDir').value.trim(), telefono: $('sTel').value.trim(),
        solicitud: { fecha: new Date().toISOString(), por: sesion.id, nota: $('sNota').value.trim() }, rechazo: null });
    toast('Solicitud de creación enviada a los jefes');
    abrirProyectos();
    pintarInicio();
}

async function rechazarCreacion(id) {
    if (!esJefe()) return;
    const motivo = await dialogo({ titulo: 'Rechazar solicitud de creación', texto: '¿Por qué se rechaza? (opcional)', campo: 'Ej: faltan datos de facturación', aceptar: 'Rechazar' });
    if (motivo === null) return;
    guardarRegistro({ ...registros[id], estado: 'proyecto', rechazo: { motivo: motivo.trim(), por: sesion.id, fecha: new Date().toISOString() } });
    toast('Solicitud rechazada: el contacto sigue como contacto nuevo');
    abrirProyectos('solicitud');
    pintarInicio();
}

function vincularProyecto(id) {
    const p = registros[id];
    const c = buscarMaestra(p.zona, $('vinInput-' + id).value);
    if (!c) return toast('Ese contacto no está en la Maestra de Contactos de la app. Pide que se actualice la lista de contactos.');
    guardarRegistro({ ...p, estado: 'vinculado', vinculadoA: c.n, vinculadoEl: new Date().toISOString(), vinculadoPor: sesion.id });
    // Las visitas del contacto nuevo pasan al contacto de la Maestra (se conserva que fueron proyecto)
    visitasDeProyecto(id).forEach(v =>
        guardarRegistro({ ...v, contacto: c.n, tipoContacto: c.e || '', ciudad: c.c || v.ciudad, esProyecto: false, eraProyecto: true }));
    toast(`${p.nombre} quedó vinculado a ${c.n}`);
    abrirProyectos();
    repintarPantallaActiva();
}

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

// ---------- PARRILLA Y ACTIVIDADES DEL MES (subcategorías variables) ----------
// Los jefes cargan cada mes los productos de la Parrilla Promocional y las Actividades; salen como subcategorías
// al programar y al cerrar las visitas de ese mes
function abrirMensual(mes = mesDe(hoy())) {
    const listas = listasDelMes(mes);
    const cargadas = !!registros[idMensual(mes)];
    abrirModal(`<form class="form-rc" onsubmit="guardarMensual(event)">
        <h2>Parrilla y actividades del mes</h2>
        <p class="sub">Escribe una por línea. Salen como subcategorías en las visitas del mes.</p>
        <label for="mMes">Mes</label>
        <input id="mMes" type="month" required value="${mes}" onchange="abrirMensual(this.value)">
        ${(MATRIZ.variables || []).map((o, i) => `<label for="mLista${i}">${esc(o)}</label>
        <textarea id="mLista${i}" data-o="${esc(o)}" rows="6" placeholder="${o === 'Parrilla Promocional' ? 'Ej: Kojic Plus\nRetinol 0,5%' : 'Ej: Congreso de dermatología\nDía de marca en consultorio'}">${esc((listas[o] || []).join('\n'))}</textarea>`).join('')}
        ${!cargadas && Object.keys(listas).length ? '<p class="ayuda">Estas vienen del archivo de la matriz. Si las guardas aquí, mandan las de la app.</p>' : ''}
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario">Guardar</button>
        </div>
    </form>`);
}

function guardarMensual(e) {
    e.preventDefault();
    const mes = $('mMes').value;
    const listas = {};
    document.querySelectorAll('#modalContenido textarea[data-o]').forEach(t => {
        const l = [...new Set(t.value.split('\n').map(x => x.trim()).filter(Boolean))];
        if (l.length) listas[t.dataset.o] = l;
    });
    const id = idMensual(mes);
    guardarRegistro({ ...(registros[id] || { id, clase: 'mensual', creado: new Date().toISOString() }),
        vendedor: 'equipo', mes, fecha: mes + '-01', listas, borrado: false, editadoPor: sesion.id });
    cerrarModal();
    toast(`Guardado para ${nombreMes(mes)}`);
}

// ---------- CHIPS DE SELECCIÓN (vendedores, zonas) ----------
// Un clic elige solo ese chip; Ctrl (o Cmd) + clic lo suma o lo quita. En el celular: mantener presionado lo suma o lo quita.
let chipVarios = false;
const AYUDA_CHIPS = '<small class="vp-vends-ayuda">Ctrl + clic para elegir varios · en el celular, mantén presionado</small>';
function eleccionChip(lista, id, todos, e) {
    if (id === 'todos') return todos.slice();
    if (!chipVarios && !(e && (e.ctrlKey || e.metaKey))) return [id];
    return lista.includes(id) ? (lista.length > 1 ? lista.filter(x => x !== id) : lista) : todos.filter(x => x === id || lista.includes(x));
}
(() => {
    let espera = null, largo = false, hecho = 0;
    document.addEventListener('pointerdown', e => {
        const b = e.target.closest('.vp-vend-btn:not(.todos)');
        if (!b || e.pointerType === 'mouse') return;
        clearTimeout(espera);
        espera = setTimeout(() => { chipVarios = true; navigator.vibrate?.(25); b.click(); chipVarios = false; largo = true; }, 500);
    });
    ['pointerup', 'pointercancel', 'scroll'].forEach(t => document.addEventListener(t, () => {
        clearTimeout(espera);
        if (largo && t !== 'scroll') { largo = false; hecho = Date.now(); }
    }, true));
    // El toque largo ya eligió: se ignora el clic que el celular manda al soltar
    document.addEventListener('click', e => { if (e.isTrusted && Date.now() - hecho < 400 && e.target.closest('.vp-vend-btn')) { e.preventDefault(); e.stopPropagation(); } }, true);
    document.addEventListener('contextmenu', e => { if (e.target.closest('.vp-vend-btn')) e.preventDefault(); });
})();

// ---------- MAESTRA CLIENTES ----------
// El comercial ve los clientes de su zona; los jefes los ven por zona y vendedor (una, varias o todas)
const FILTROS_MAESTRA = ['e', 'cat', 'd', 'c', 'pz', 'f', 'vis'];
const maestra = { zonas: null, busca: '', sel: Object.fromEntries(FILTROS_MAESTRA.map(k => [k, []])), dim: 'e', abierto: null, buscaOp: '',
    mesVis: mesDe(hoy()), visitados: new Set() };
// Columnas por las que se filtra y se agrupa la gráfica: cómo se saca el valor de cada cliente y cómo se nombra
const textoPlazo = pz => /^\d+$/.test(pz) ? (pz === '0' ? 'Contado' : pz + ' días') : pz;
const departamento = p => (p || '').replace(/\s*\(CO\)$/, '');
const DIMS_MAESTRA = {
    e: { t: 'Etiqueta', todos: 'Todas las etiquetas', valor: c => c.e || '' },
    // Clasificación y categoría son lo mismo: el número es la clasificación y el nombre la categoría
    cat: { t: 'Clasificación', todos: 'Todas las clasificaciones', valor: c => c.cl || c.ca || '', nombre: (v, c) => c && c.ca && c.cl ? `${c.cl} · ${c.ca}` : v,
        orden: (a, b) => Number(a) - Number(b) || a.localeCompare(b) },
    d: { t: 'Departamento', todos: 'Todos los departamentos', valor: c => departamento(c.p) },
    c: { t: 'Ciudad', todos: 'Todas las ciudades', valor: c => c.c || '' },
    pz: { t: 'Plazo de pago', todos: 'Todos los plazos', valor: c => c.pz || '', nombre: textoPlazo, orden: (a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b) },
    vis: { t: 'Visitas del mes', todos: 'Visitados y no visitados', valor: c => maestra.visitados.has(normalizar(c.n)) ? 'si' : 'no',
        nombre: v => (v === 'si' ? 'Visitado en ' : 'No visitado en ') + nombreMes(maestra.mesVis), orden: (a, b) => a === 'si' ? -1 : b === 'si' ? 1 : 0 },
    f: { t: 'Facturar', todos: 'Facturar: todos', valor: c => c.f ? 'si' : 'no', nombre: v => v === 'si' ? 'Cliente para facturar' : 'No factura', orden: (a, b) => a === 'si' ? -1 : b === 'si' ? 1 : 0 },
    z: { t: 'Zona', jefe: true, valor: c => c.z, nombre: z => { const v = vendedorDeZona(z); return z + (v ? ' · ' + v.nombre : ''); } }
};
const MAX_BARRAS = 8;
// Color por tipo de etiqueta (se unifican en Cliente, Médico y Punto de Venta) y por si es cliente para facturar
const GRUPOS_ETIQUETA = {
    cliente: { t: 'Cliente', c: '#2563eb', tinte: '#e3ecfd' },
    medico: { t: 'Médico', c: '#db2777', tinte: '#fce6f0' },
    ambos: { t: 'Cliente y Médico', c: '#2563eb', c2: '#db2777', tinte: '#f1e6f6' },
    pv: { t: 'Punto de Venta', c: '#ca8a04', tinte: '#faf0d4' }
};
const COLOR_FACTURA = { si: '#16a34a', no: '#dc2626' };
const grupoEtiqueta = e => { const n = normalizar(e || ''); return n.includes('cliente') && n.includes('medico') ? 'ambos' : n.startsWith('medico') ? 'medico' : n.includes('punto de venta') ? 'pv' : 'cliente'; };
const zonasMaestra = () => Object.keys(contactos).filter(z => (contactos[z] || []).length);
const vendedorDeZona = z => COMERCIALES.find(c => c.zona === z);

function abrirMaestra() {
    if (!maestra.zonas) maestra.zonas = esJefe() ? zonasMaestra() : [comercial(sesion.id)?.zona].filter(Boolean);
    $('mcZonas').hidden = !esJefe();
    pintarMaestra();
    mostrarPantalla('maestraScreen');
}

function elegirZonaMaestra(z, e) {
    maestra.zonas = eleccionChip(maestra.zonas, z === 'todas' ? 'todos' : z, zonasMaestra(), e);
    pintarMaestra();
}

// Meses para el filtro de visitas: el actual y los que tienen visitas, del más reciente al más antiguo
const mesesMaestra = () => [...new Set([mesDe(hoy()), ...visibles().filter(x => x.clase === 'visita' && x.fecha).map(x => mesDe(x.fecha))])].sort().reverse();

// Clientes que pasan los filtros, dejando por fuera uno (para contar las opciones de ese filtro)
function filtrarMaestra(base, sin) {
    const q = normalizar(maestra.busca);
    return base.filter(c => (!q || normalizar(c.n).includes(q))
        && FILTROS_MAESTRA.every(k => k === sin || !maestra.sel[k].length || maestra.sel[k].includes(DIMS_MAESTRA[k].valor(c))));
}

// Filtros de selección múltiple (Maestra Clientes y Visiplan): botón con lo elegido y lista de casillas con cuántos
// clientes tiene cada opción. "Todas" deja el filtro sin elegir nada (salen todos). Cada pantalla es un grupo.
const MULTI = {
    maestra: { get sel() { return maestra.sel; }, abierto: null, busca: '', enfocar: false, repintar: () => pintarMaestra() },
    visiplan: { get sel() { return visiplan.sel; }, abierto: null, busca: '', enfocar: false, repintar: () => pintarVisiplan() }
};
function pintarMultis(caja, grupo, defs) {
    const g = MULTI[grupo];
    const tecleando = document.activeElement?.classList?.contains('mc-multi-busca');
    const antes = caja.querySelector('.mc-multi-ops');
    const scroll = antes ? antes.scrollTop : 0;
    caja.innerHTML = defs.map(d => {
        const k = d.k, elegidos = g.sel[k], nombre = v => d.nombre ? d.nombre(v) : v;
        const texto = !elegidos.length ? d.todos : elegidos.length === 1 ? nombre(elegidos[0]) : `${d.t}: ${elegidos.length} elegidas`;
        const abierto = g.abierto === k, qo = normalizar(g.busca);
        return `<div class="mc-multi${abierto ? ' abierto' : ''}${elegidos.length ? ' con' : ''}" data-k="${k}">
            <button type="button" class="mc-multi-btn" onclick="abrirMulti('${grupo}', '${k}')" aria-expanded="${abierto}" title="${esc(d.t)}"><span>${esc(texto)}</span></button>
            ${!abierto ? '' : `<div class="mc-multi-panel">
                ${d.extra || ''}
                ${d.valores.length > 10 ? `<input class="mc-multi-busca" placeholder="Buscar ${esc(d.t.toLowerCase())}..." value="${esc(g.busca)}" oninput="MULTI.${grupo}.busca=this.value; MULTI.${grupo}.repintar()">` : ''}
                <div class="mc-multi-acc"><b>${esc(d.t)}</b><span>Elige una o varias</span></div>
                <label class="mc-multi-todas"><input type="checkbox" ${elegidos.length ? '' : 'checked'} onchange="todasMulti('${grupo}', '${k}')"><span>${esc(d.todos)}</span></label>
                <div class="mc-multi-ops">${d.valores.filter(v => !qo || normalizar(nombre(v)).includes(qo)).map(v => `<label class="${!d.cuenta || d.cuenta[v] ? '' : 'vacio'}">
                    <input type="checkbox" data-v="${esc(v)}" ${elegidos.includes(v) ? 'checked' : ''} onchange="marcarMulti('${grupo}', '${k}', this.dataset.v)">
                    <span>${esc(nombre(v))}</span><small>${d.cuenta ? d.cuenta[v] || 0 : ''}</small></label>`).join('') || '<p>Sin opciones</p>'}</div>
            </div>`}
        </div>`;
    }).join('');
    const ops = caja.querySelector('.mc-multi-ops');
    if (ops) ops.scrollTop = scroll;
    const bq = caja.querySelector('.mc-multi-busca');
    if (bq && (tecleando || (g.enfocar && !matchMedia('(hover: none)').matches))) { bq.focus(); bq.setSelectionRange(bq.value.length, bq.value.length); }
    g.enfocar = false;
}
function abrirMulti(grupo, k) {
    const g = MULTI[grupo];
    g.abierto = g.abierto === k ? null : k;
    g.busca = ''; g.enfocar = true;
    g.repintar();
}
function marcarMulti(grupo, k, v) {
    const g = MULTI[grupo], s = g.sel[k];
    g.sel[k] = s.includes(v) ? s.filter(x => x !== v) : [...s, v];
    g.repintar();
}
function todasMulti(grupo, k) { MULTI[grupo].sel[k] = []; MULTI[grupo].repintar(); }
// Cerrar la lista de opciones al tocar fuera de ella
document.addEventListener('click', e => {
    if (!document.contains(e.target) || e.target.closest('.mc-multi')) return;
    Object.values(MULTI).forEach(g => { if (g.abierto) { g.abierto = null; g.repintar(); } });
});

function pintarFiltrosMaestra(base) {
    pintarMultis($('mcFiltrosMulti'), 'maestra', FILTROS_MAESTRA.map(k => {
        const d = DIMS_MAESTRA[k], ejemplo = {}, cuenta = {};
        base.forEach(c => { const v = d.valor(c); if (v && !ejemplo[v]) ejemplo[v] = c; });
        filtrarMaestra(base, k).forEach(c => { const v = d.valor(c); cuenta[v] = (cuenta[v] || 0) + 1; });
        return { k, t: d.t, todos: d.todos, cuenta, nombre: v => d.nombre ? d.nombre(v, ejemplo[v]) : v,
            valores: Object.keys(ejemplo).sort(d.orden || ((a, b) => a.localeCompare(b, 'es'))),
            extra: k === 'vis' ? `<select class="mc-multi-mes" onchange="maestra.mesVis=this.value; pintarMaestra()" aria-label="Mes">${mesesMaestra().map(m => `<option value="${m}" ${m === maestra.mesVis ? 'selected' : ''}>${esc(nombreMes(m).replace(/^./, x => x.toUpperCase()))}</option>`).join('')}</select>` : '' };
    }));
}

function pintarMaestra() {
    const todas = zonasMaestra(), sel = maestra.zonas || [];
    if (esJefe()) {
        $('mcZonas').innerHTML = `<button type="button" class="vp-vend-btn todos${sel.length === todas.length ? ' activo' : ''}" onclick="elegirZonaMaestra('todas', event)">Todas las zonas</button>`
            + todas.map(z => {
                const v = vendedorDeZona(z);
                return `<button type="button" class="vp-vend-btn${sel.includes(z) ? ' activo' : ''}" onclick="elegirZonaMaestra('${esc(z)}', event)">${sel.includes(z) ? '✓ ' : ''}${esc(z)} <small>${esc(v ? v.nombre : '')} · ${contactos[z].length}</small></button>`;
            }).join('') + AYUDA_CHIPS;
    }
    const base = sel.flatMap(z => (contactos[z] || []).map(c => ({ ...c, z })));
    // Clientes con visita efectiva en el mes elegido (filtro Visitados / No visitados)
    maestra.visitados = new Set(visibles().filter(x => x.clase === 'visita' && !x.interno && x.estado === 'visitado' && mesDe(x.fecha) === maestra.mesVis)
        .map(x => normalizar(x.contacto)));
    // Las opciones elegidas que ya no existen en las zonas elegidas se quitan
    FILTROS_MAESTRA.forEach(k => { maestra.sel[k] = maestra.sel[k].filter(v => base.some(c => DIMS_MAESTRA[k].valor(c) === v)); });
    pintarFiltrosMaestra(base);
    const lista = filtrarMaestra(base);
    // La gráfica no se filtra por su propia columna: así se pueden tocar varias barras
    pintarComposicion(FILTROS_MAESTRA.includes(maestra.dim) ? filtrarMaestra(base, maestra.dim) : lista);
    // Última visita efectiva de cada cliente
    const ultima = {};
    visibles().filter(x => x.clase === 'visita' && !x.interno && x.estado === 'visitado')
        .forEach(x => { const k = normalizar(x.contacto); if (!ultima[k] || x.fecha > ultima[k]) ultima[k] = x.fecha; });
    $('mcResumen').textContent = `${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'}${lista.length !== base.length ? ` de ${base.length}` : ''} · toca un cliente para ver su historial`;
    const fila = c => {
        const v = vendedorDeZona(c.z), u = ultima[normalizar(c.n)];
        const g = GRUPOS_ETIQUETA[grupoEtiqueta(c.e)];
        return `<button class="mc-fila" style="--g:${g.c}; --g2:${g.c2 || g.c}; --tinte:${g.tinte}; --fx:${COLOR_FACTURA[c.f ? 'si' : 'no']}" title="${esc(g.t)} · ${c.f ? 'Cliente para facturar' : 'No factura'}" data-c="${esc(c.n)}" data-v="${v ? v.id : ''}" onclick="verCliente(this.dataset.c, this.dataset.v)">
            <span class="mc-nombre"><b>${esc(c.n)}</b><small>${esc([c.t, c.e, [c.c, c.p && !normalizar(c.p).startsWith(normalizar(c.c)) ? c.p.replace(/\s*\(CO\)$/, '') : ''].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}</small>
                <span class="mc-datos">${c.cl || c.ca ? `<span class="cat">${c.cl ? `<b>${esc(c.cl)}</b> · ` : ''}${esc(c.ca || '')}</span>` : ''}${c.pz !== undefined ? `<span>Plazo <b>${esc(textoPlazo(c.pz).toLowerCase())}</b></span>` : ''}<span class="${c.f ? 'fact' : 'nofact'}">Facturar: <b>${c.f ? 'Sí' : 'No'}</b></span></span></span>
            <span class="mc-ultima">${u ? 'Última visita<br><b>' + esc(fechaCorta(u)) + '</b>' : '<i>Sin visitas</i>'}</span>
        </button>`;
    };
    // Jefes: agrupado por zona con el nombre del vendedor
    $('mcLista').innerHTML = !lista.length ? '<div class="no-results">No hay clientes con estos filtros.</div>'
        : sel.map(z => {
            const deZona = lista.filter(c => c.z === z);
            if (!deZona.length) return '';
            const v = vendedorDeZona(z);
            return (esJefe() ? `<p class="grupo-titulo">${esc(z)} · ${esc(v ? v.nombre : 'Sin vendedor')} · ${deZona.length}</p>` : '') + deZona.map(fila).join('');
        }).join('');
}

// Barras con la composición de los clientes filtrados. Tocar una barra filtra por ese valor; tocarla otra vez lo quita.
function pintarComposicion(lista) {
    const dims = Object.entries(DIMS_MAESTRA).filter(([, d]) => !d.jefe || esJefe());
    if (!dims.some(([k]) => k === maestra.dim)) maestra.dim = 'e';
    const d = DIMS_MAESTRA[maestra.dim];
    const cuenta = {}, ejemplo = {};
    lista.forEach(c => { const v = d.valor(c) || ''; cuenta[v] = (cuenta[v] || 0) + 1; ejemplo[v] = ejemplo[v] || c; });
    let grupos = Object.entries(cuenta).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
    // Más de 8 valores: el resto se junta en "Otros" (al pasar el mouse muestra el detalle; al tocarlo se despliega)
    const nombreDe = v => v ? (d.nombre ? d.nombre(v, ejemplo[v]) : v) : 'Sin dato';
    let resto = [];
    if (grupos.length > MAX_BARRAS && !maestra.verOtros) {
        resto = grupos.slice(MAX_BARRAS - 1);
        grupos = [...grupos.slice(0, MAX_BARRAS - 1), ['__otros', resto.reduce((s, g) => s + g[1], 0), resto.length]];
    }
    const total = lista.length, max = Math.max(1, ...grupos.map(g => g[1]));
    // Cliente y Médico: rayas de los dos colores
    const colorEtiqueta = g => g.c2 ? `repeating-linear-gradient(135deg, ${g.c} 0 6px, ${g.c2} 6px 12px)` : g.c;
    const colorBarra = v => v === '__otros' ? '' : maestra.dim === 'e' ? `; background:${colorEtiqueta(GRUPOS_ETIQUETA[grupoEtiqueta(v)])}`
        : maestra.dim === 'f' ? `; background:${COLOR_FACTURA[v]}` : maestra.dim === 'vis' ? `; background:${v === 'si' ? '#16a34a' : '#a8b8b4'}` : '';
    const elegidos = maestra.dim === 'z' ? ((maestra.zonas || []).length < zonasMaestra().length ? maestra.zonas : []) : maestra.sel[maestra.dim];
    $('mcDims').innerHTML = dims.map(([k, x]) => `<button type="button" class="${k === maestra.dim ? 'activo' : ''}" onclick="maestra.dim='${k}'; maestra.verOtros=false; pintarMaestra()">${x.t}</button>`).join('');
    $('mcBarras').classList.toggle('con-sel', elegidos.length > 0);
    $('mcBarras').innerHTML = !total ? '' : grupos.map(([v, n, varios]) => {
        const otros = v === '__otros', nombre = otros ? `Otros (${varios})` : nombreDe(v);
        const activo = elegidos.includes(v);
        if (otros) return `<button type="button" class="mc-barra otros" onclick="maestra.verOtros=true; pintarMaestra()"
                title="${esc(resto.map(([x, m]) => `${nombreDe(x)}: ${m}`).join('\n'))}\n\nToca para ver el detalle">
            <span class="mc-barra-nombre">${esc(nombre)} <u>ver detalle</u></span>
            <span class="mc-barra-pista"><span style="width:${Math.max(n / max * 100, 1.5)}%"></span></span>
            <span class="mc-barra-num"><b>${n}</b> ${n / total < .005 ? '<1' : Math.round(n / total * 100)}%</span>
        </button>`;
        const pct = n / total < .005 ? '<1' : Math.round(n / total * 100), clic = !!v;
        return `<button type="button" class="mc-barra${activo ? ' activo' : ''}" ${clic ? `data-v="${esc(v)}" onclick="filtrarComposicion(this.dataset.v)"` : 'disabled'}
                title="${esc(nombre)}: ${n} ${n === 1 ? 'cliente' : 'clientes'} (${pct}%)${clic ? (activo ? ' · toca para quitar el filtro' : ' · toca para filtrar') : ''}">
            <span class="mc-barra-nombre">${esc(nombre)}</span>
            <span class="mc-barra-pista"><span style="width:${Math.max(n / max * 100, 1.5)}%${colorBarra(v)}"></span></span>
            <span class="mc-barra-num"><b>${n}</b> ${pct}%</span>
        </button>`;
    }).join('') + (maestra.verOtros && grupos.length > MAX_BARRAS ? `<button type="button" class="mc-ver-menos" onclick="maestra.verOtros=false; pintarMaestra()">Ver menos</button>` : '');
}

function filtrarComposicion(v) {
    if (maestra.dim === 'z') {
        const todas = zonasMaestra(), z = maestra.zonas || [];
        maestra.zonas = z.length === todas.length ? [v] : z.includes(v) ? (z.length > 1 ? z.filter(x => x !== v) : todas) : todas.filter(x => x === v || z.includes(x));
        pintarMaestra();
    } else marcarMulti('maestra', maestra.dim, v);
}

// ---------- VISIPLAN (plan de visitas del mes) ----------
// Cada vendedor marca con X, al inicio del mes, qué días visitará a cada cliente de su zona. Se puede
// editar hasta el 2.º día hábil del mes. En el día, cada X aparece en el Plan de Trabajo para confirmarla:
// al confirmarla se programa la visita (con lo que se va a hacer). Si no se confirma ese día, queda cerrada.
const visiplan = { mes: sumarMes(mesDe(hoy()), 0), vendedores: null, busca: '', sel: { t: [], e: [], f: [] }, periodo: 'mes', dia: hoy() };
const INTERNO_ETQ = 'Trabajo interno';
const NOMBRES_FILTRO_PLAN = { plan: 'Planeados', noplan: 'No planeados', real: 'Con visita real', cump: 'Cumplidos en el día planeado', visit: 'Planeados y visitados' };
let esperaPlan = null;

const idPlan = (vendedor, mes) => `plan-${vendedor}-${mes}`;
const planDe = (vendedor, mes) => registros[idPlan(vendedor, mes)] || null;
function diasDelMes(mes) {   // lunes a sábado, como el formato Visiplan
    const dias = [];
    for (let d = mes + '-01'; mesDe(d) === mes; d = sumarDias(d, 1)) if (deIso(d).getDay() !== 0) dias.push(d);
    return dias;
}
function limitePlan(mes) {   // hasta el final del 2.º día hábil del mes (hora Colombia)
    let d = mes + '-01', n = 0;
    while (true) { if (esHabil(d) && ++n === 2) break; d = sumarDias(d, 1); }
    return { dia: d, ms: Date.parse(`${d}T23:59:59-05:00`) };
}
// Mientras estemos en pruebas el plan queda abierto; al salir en vivo (ETAPA_DATOS = 'vivo') vuelve el cierre del 2.º día hábil
const planEditable = mes => ETAPA_DATOS === 'pruebas' || esAdmin() || Date.now() <= limitePlan(mes).ms;
const clavePlan = (contacto, fecha) => `${contacto}|${fecha}`;

// Seguimiento del mes: X del plan, visitas efectivas y próximas visitas agendadas que aún no son efectivas
// Reprogramada: viene de una visita no realizada ("Reprogramar para") o de la "Próxima visita" de un cierre
const esReprogramada = v => v.origen === 'proxima' || v.origen === 'reprogramada' || !!v.vieneDe;

// El trabajo interno (oficina, fuera de la oficina, planeación mes) va aparte: no suma en los indicadores de clientes
function seguimientoPlan(vendedor, mes) {
    const todas = planDe(vendedor, mes)?.marcas || {}, marcas = {}, reales = {}, proximas = {};
    const internos = { marcas: {}, reales: {} };
    Object.entries(todas).forEach(([k, ds]) => { (esTrabajoInterno(k) ? internos.marcas : marcas)[k] = ds; });
    visibles().filter(x => x.clase === 'visita' && x.vendedor === vendedor && mesDe(x.fecha) === mes).forEach(x => {
        if (x.interno) { if (x.estado === 'visitado') (internos.reales[x.contacto] = internos.reales[x.contacto] || new Set()).add(x.fecha); return; }
        if (x.estado === 'visitado') (reales[x.contacto] = reales[x.contacto] || new Set()).add(x.fecha);
        else if (esReprogramada(x)) (proximas[x.contacto] = proximas[x.contacto] || new Set()).add(x.fecha);
    });
    // Días de Planeación Mes: toda la columna del día queda en azul
    const diasPlaneacion = new Set([...(internos.marcas['Planeación Mes'] || []), ...(internos.reales['Planeación Mes'] || [])]);
    return { marcas, reales, proximas, internos, diasPlaneacion };
}
// Indicadores: Obj = visitas planeadas · Real = visitas efectivas · %Cump = efectivas el mismo día planeado / planeadas
// · %Visitas = efectivas / planeadas
function indicadoresPlan(dias, r) {
    const obj = dias.length, real = r.size, cump = dias.filter(d => r.has(d)).length;
    return { obj, real, cump };
}

// Lo planeado para un vendedor en un día (con su estado: por confirmar, confirmada o cerrada)
function planeadasDe(vendedor, fecha) {
    const plan = planDe(vendedor, mesDe(fecha));
    if (!plan) return [];
    // Si un cliente cambió de zona (nueva Maestra de Contactos), desde hoy ya no le sale al vendedor anterior
    const zona = comercial(vendedor)?.zona;
    const sigueEnZona = c => fecha < hoy() || esTrabajoInterno(c) || buscarMaestra(zona, c) || buscarProyecto(zona, c) || !Object.keys(contactos).length;
    return Object.entries(plan.marcas || {}).filter(([c, dias]) => dias.includes(fecha) && sigueEnZona(c)).map(([contacto]) => {
        const visitaId = (plan.confirmadas || {})[clavePlan(contacto, fecha)];
        const estado = visitaId && registros[visitaId] && !registros[visitaId].borrado ? 'confirmada' : fecha < hoy() ? 'cerrada' : 'por confirmar';
        return { contacto, fecha, estado, visitaId };
    }).sort((a, b) => a.contacto.localeCompare(b.contacto));
}

// Vendedores que se ven: el comercial solo el suyo; los jefes escogen uno, varios o todo el equipo
function abrirVisiplan() {
    if (!esJefe()) visiplan.vendedores = [sesion.id];
    else if (!visiplan.vendedores) visiplan.vendedores = [agenda.vendedor || COMERCIALES[0].id];
    $('vpVendedores').hidden = !esJefe();
    pintarVisiplan();
    mostrarPantalla('visiplanScreen');
}

function pintarVendedoresPlan() {
    const sel = visiplan.vendedores, todos = sel.length === COMERCIALES.length;
    $('vpVendedores').innerHTML = `<button type="button" class="vp-vend-btn todos${todos ? ' activo' : ''}" onclick="elegirVendedorPlan('todos', event)" aria-pressed="${todos}">Todo el equipo</button>`
        + COMERCIALES.map(c => `<button type="button" class="vp-vend-btn${sel.includes(c.id) ? ' activo' : ''}" onclick="elegirVendedorPlan('${c.id}', event)" aria-pressed="${sel.includes(c.id)}">${sel.includes(c.id) ? '✓ ' : ''}${esc(c.nombre)} <small>${esc(c.zona)}</small></button>`).join('') + AYUDA_CHIPS;
}

function elegirVendedorPlan(id, e) {
    const antes = visiplan.vendedores.length;
    visiplan.vendedores = eleccionChip(visiplan.vendedores, id, COMERCIALES.map(c => c.id), e);
    if (antes === 1 && visiplan.vendedores.length > 1) visiplan.sel.f = ['plan'];   // varios vendedores: arranca solo con lo planeado
    pintarVisiplan();
}

// Filtro de clientes: desde la lista "Mostrar" o tocando un indicador del resumen (otro toque lo quita)
function filtrarPlan(f) {
    const s = visiplan.sel.f;
    visiplan.sel.f = s.length === 1 && s[0] === f ? [] : [f];
    pintarVisiplan();
}
// Un cliente pasa el filtro "Mostrar" si cumple cualquiera de las opciones elegidas
const pasaFiltrosPlan = (m, r) => !visiplan.sel.f.length || visiplan.sel.f.some(f => FILTROS_PLAN[f](m, r));
const FILTROS_PLAN = {
    plan: (m) => m.length > 0,
    noplan: (m) => m.length === 0,
    real: (m, r) => r.size > 0,
    cump: (m, r) => m.some(d => r.has(d)),
    visit: (m, r) => m.length > 0 && r.size > 0,
    actividad: (m, r) => m.length > 0 || r.size > 0   // para el informe general: lo planeado o visitado
};

// Periodo que se ve en el Visiplan: hoy, esta semana o el mes completo (por defecto)
function periodoPlan(p) {
    visiplan.periodo = p;
    if (p === 'hoy') visiplan.dia = hoy();
    if (p !== 'mes') visiplan.mes = mesDe(hoy());
    pintarVisiplan();
}
// Calendario del Visiplan: ver solo el día elegido
function verDiaPlan(d) {
    if (!d) return;
    const mesAntes = visiplan.mes;
    visiplan.periodo = 'hoy'; visiplan.dia = d; visiplan.mes = mesDe(d);
    pintarVisiplan();
    if (visiplan.mes !== mesAntes) sincronizar(visiplan.mes);
}
// Clic en un día del encabezado: abre el Plan de Trabajo de ese día (del vendedor que se está viendo)
function irDiaPlan(d) {
    if (esJefe()) agenda.vendedor = visiplan.vendedores[0] || agenda.vendedor;
    agenda.fecha = d;
    abrirAgenda();
    sincronizar(mesDe(d));
}
function diasVistaPlan(mes) {
    const dias = diasDelMes(mes);
    if (visiplan.periodo === 'hoy') return dias.filter(d => d === (visiplan.dia || hoy()));
    if (visiplan.periodo === 'semana') return dias.filter(d => lunesDe(d) === lunesDe(hoy()));
    return dias;
}

function moverMesPlan(n) { visiplan.mes = sumarMes(visiplan.mes, n); visiplan.periodo = 'mes'; pintarVisiplan(); sincronizar(visiplan.mes); }

function pintarVisiplan() {
    const mes = visiplan.mes;
    if (esJefe()) pintarVendedoresPlan();
    const vista = COMERCIALES.filter(c => visiplan.vendedores.includes(c.id));
    const todos = vista.length > 1;   // varios vendedores: se muestra el vendedor en cada fila
    visiplan.vista = vista.map(c => c.id);
    const editable = planEditable(mes);
    const lim = limitePlan(mes);
    $('vpMesTxt').textContent = mayuscula(nombreMes(mes));
    $('vpMesSub').textContent = editable
        ? (Date.now() > lim.ms && ETAPA_DATOS === 'pruebas' ? 'Abierto para pruebas (en vivo se cierra el 2.º día hábil)'
            : `Se puede editar hasta el ${fechaLarga(lim.dia)}${esAdmin() && Date.now() > lim.ms ? ' (abierto por el administrador)' : ''}`)
        : `Plan cerrado el ${fechaLarga(lim.dia)}: ya no se puede editar`;
    $('vpMesSub').classList.toggle('cerrado', !editable);

    // Clientes de la zona de cada vendedor: Maestra de Contactos y contactos nuevos
    const seg = {};
    let clientes = [];
    vista.forEach(ven => {
        seg[ven.id] = seguimientoPlan(ven.id, mes);
        clientes = clientes.concat((contactos[ven.zona] || []).map(c => ({ n: c.n, e: c.e || '', t: tipoSugerido(c.e || '') || 'Visita Comercial', v: ven.id }))
            .concat(proyectosDeZona(ven.zona).map(p => ({ n: p.nombre, e: 'Contacto nuevo · ' + p.tipo, t: p.tipo, v: ven.id }))));
    });
    // Filtros (selección múltiple): tipo de cliente, etiqueta (con Trabajo interno) y qué mostrar
    const claveZona = vista.map(c => c.id).join(',');
    if (visiplan.zonaFiltros !== claveZona) { visiplan.zonaFiltros = claveZona; visiplan.sel.t = []; visiplan.sel.e = []; }
    const cuentaDe = k => clientes.reduce((o, c) => (o[c[k]] = (o[c[k]] || 0) + 1, o), {});
    const unicos = k => [...new Set(clientes.map(c => c[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    if (!visiplan.oculto) pintarMultis($('vpMultis'), 'visiplan', [
        { k: 't', t: 'Tipo de cliente', todos: 'Todos los tipos de cliente', valores: unicos('t'), cuenta: cuentaDe('t') },
        { k: 'e', t: 'Etiqueta', todos: 'Todas las etiquetas', valores: [INTERNO_ETQ, ...unicos('e')], cuenta: { ...cuentaDe('e'), [INTERNO_ETQ]: TRABAJO_INTERNO.length * vista.length } },
        { k: 'f', t: 'Mostrar', todos: 'Todos los clientes', valores: Object.keys(NOMBRES_FILTRO_PLAN), nombre: f => NOMBRES_FILTRO_PLAN[f] || 'Planeados o visitados' }
    ]);
    const q = normalizar(visiplan.busca);
    document.querySelectorAll('#vpPeriodo button').forEach(b => b.classList.toggle('activo', b.dataset.p === visiplan.periodo));
    const otroDia = visiplan.periodo === 'hoy' && visiplan.dia !== hoy();
    $('vpPeriodo').querySelector('[data-p="hoy"]').textContent = otroDia ? mayuscula(fechaCorta(visiplan.dia)) : 'Hoy';
    $('vpFechaPick').value = visiplan.periodo === 'hoy' ? visiplan.dia : '';
    const dias = diasVistaPlan(mes), enVista = new Set(dias);
    visiplan.dias = dias;
    const soloVista = (m, r) => [m.filter(d => enVista.has(d)), new Set([...r].filter(d => enVista.has(d)))];
    const { t: selT, e: selE } = visiplan.sel;
    clientes = clientes.filter(c => (!q || normalizar(c.n).includes(q)) && (!selE.length || selE.includes(c.e)) && (!selT.length || selT.includes(c.t))
        && pasaFiltrosPlan(...soloVista(seg[c.v].marcas[c.n] || [], seg[c.v].reales[c.n] || new Set())));

    const semanas = [];
    dias.forEach(d => {
        const s = semanas[semanas.length - 1];
        if (!s || deIso(d).getDay() === 1 && s.dias.length) semanas.push({ dias: [d] }); else s.dias.push(d);
    });
    visiplan.editable = editable;

    const fs = d => deIso(d).getDay() === 6 ? ' fs' : '';   // último día de la semana: línea más fuerte
    const diaPlanHead = d => vista.some(v => seg[v.id].diasPlaneacion.has(d)) ? ' dia-plan' : '';
    const cab1 = semanas.map((s, i) => `<th colspan="${s.dias.length * 2}" class="vp-sem">Semana ${i + 1}</th>`).join('');
    const cab2 = dias.map(d => `<th colspan="2" class="vp-dia${fs(d)}${nombreFestivo(d) ? ' festivo' : ''}${diaPlanHead(d)} ir" onclick="irDiaPlan('${d}')" title="${esc(nombreFestivo(d) || (diaPlanHead(d) ? 'Planeación Mes · ' : '') + fechaLarga(d))} · toca para abrir el Plan de Trabajo${visiplan.vendedores.length > 1 ? ' de ' + esc(nombreVendedor(visiplan.vendedores[0])) : ''}">${DIAS[deIso(d).getDay()][0]}<small>${deIso(d).getDate()}</small></th>`).join('');
    const cab3 = dias.map(d => `<th class="vp-sub plan${nombreFestivo(d) ? ' festivo' : ''}">P</th><th class="vp-sub real${fs(d)}${nombreFestivo(d) ? ' festivo' : ''}">R</th>`).join('');
    const dp = (v, d) => seg[v].diasPlaneacion.has(d) ? ' dia-plan' : '';
    const celdas = (c, m, r, px) => dias.map(d => `<td class="vp-x h${m.includes(d) ? ' on' : ''}${nombreFestivo(d) ? ' festivo' : ''}${dp(c.v, d)}" data-c="${esc(c.n)}" data-v="${c.v}" data-d="${d}"></td>`
        + `<td data-d="${d}" class="vp-r h${fs(d)}${r.has(d) ? ' on' : px.has(d) ? ' prox' : ''}${nombreFestivo(d) ? ' festivo' : ''}${dp(c.v, d)}"${!r.has(d) && px.has(d) ? ' title="Reprogramada: pasa a verde cuando se visite"' : ''}></td>`).join('');
    const vacio = new Set();
    // Arriba, el trabajo interno de cada vendedor (se programa igual con X; no suma en los indicadores de clientes)
    // Trabajo interno: sale con "Todas las etiquetas" o si se elige en Etiqueta, y sin filtros de clientes en "Mostrar"
    const verInternos = (!selE.length || selE.includes(INTERNO_ETQ)) && (!visiplan.sel.f.length || visiplan.sel.f.includes('actividad')) && !q;
    const filasInternas = !verInternos ? '' : vista.map(ven => TRABAJO_INTERNO.map((t, i) => {
        const c = { n: t, v: ven.id }, sg = seg[ven.id];
        return `<tr class="vp-int${i === TRABAJO_INTERNO.length - 1 ? ' vp-int-fin' : ''}"><td class="vp-et">${todos ? `<b class="vp-vend">${esc(nombreVendedor(ven.id))}</b>` : ''}Trabajo interno</td><th class="vp-cli" scope="row">${esc(t)}</th>`
            + celdas(c, sg.internos.marcas[t] || [], sg.internos.reales[t] || vacio, vacio)
            + `<td class="vp-n plan"></td><td class="vp-n real"></td><td class="vp-n"></td><td class="vp-n"></td></tr>`;
    }).join('')).join('');
    const filas = filasInternas + clientes.slice(0, 600).map(c => {
        const sg = seg[c.v], m = sg.marcas[c.n] || [], r = sg.reales[c.n] || vacio, px = sg.proximas[c.n] || vacio;
        const etiqueta = todos ? `<b class="vp-vend">${esc(nombreVendedor(c.v))}</b>${esc(c.e)}` : esc(c.e);
        return `<tr><td class="vp-et">${etiqueta}</td><th class="vp-cli" scope="row" data-cliente="${esc(c.n)}" data-v="${c.v}" title="Ver historial de visitas">${esc(c.n)}</th>`
            + celdas(c, m, r, px)
            + `<td class="vp-n plan"></td><td class="vp-n real"></td><td class="vp-n vp-pct"></td><td class="vp-n vp-pvis"></td></tr>`;
    }).join('');
    $('vpTabla').classList.toggle('bloqueada', !editable);
    $('vpTabla').classList.toggle('estirar', visiplan.periodo === 'mes');   // el mes llena el ancho; hoy y semana quedan compactos
    $('vpTabla').innerHTML = `<thead><tr><th rowspan="3" class="vp-et">${todos ? 'Vendedor · Etiqueta' : 'Etiqueta'}</th><th rowspan="3" class="vp-cli">Cliente</th>${cab1}<th rowspan="3" class="vp-n" title="Visitas programadas">Obj</th><th rowspan="3" class="vp-n" title="Visitas efectivas">Real</th><th rowspan="3" class="vp-n" title="Visitas efectivas en el día que se planearon / programadas">% Cump</th><th rowspan="3" class="vp-n" title="Visitas efectivas / visitas programadas">% Visitas</th></tr><tr>${cab2}</tr><tr>${cab3}</tr></thead><tbody>${filas || `<tr><td colspan="${dias.length * 2 + 6}" class="no-results">No hay clientes con estos filtros.</td></tr>`}</tbody>`
        + `<tfoot><tr class="vp-tot"><td class="vp-et"></td><th class="vp-cli" scope="row">Obj · Real del día</th>${dias.map(d => `<td class="vp-tp${nombreFestivo(d) ? ' festivo' : ''}" data-d="${d}"></td><td class="vp-tr${fs(d)}${nombreFestivo(d) ? ' festivo' : ''}" data-d="${d}"></td>`).join('')}<td class="vp-n plan" id="vpTotP"></td><td class="vp-n real" id="vpTotR"></td><td class="vp-n vp-pct" id="vpTotPct"></td><td class="vp-n vp-pvis" id="vpTotVis"></td></tr>`
        + `<tr class="vp-tot vp-tot-c"><td class="vp-et"></td><th class="vp-cli" scope="row">% Cump del día</th>${dias.map(d => `<td colspan="2" class="vp-dp${fs(d)}${nombreFestivo(d) ? ' festivo' : ''}" data-d="${d}"></td>`).join('')}<td colspan="4" class="vp-pie" id="vpPieN"></td></tr>`
        + `<tr class="vp-tot vp-tot-v"><td class="vp-et"></td><th class="vp-cli" scope="row">% Visitas del día</th>${dias.map(d => `<td colspan="2" class="vp-dv${fs(d)}${nombreFestivo(d) ? ' festivo' : ''}" data-d="${d}"></td>`).join('')}<td colspan="4" class="vp-pie" id="vpPieV"></td></tr></tfoot>`;
    actualizarTotalesPlan();
}

// Totales del Visiplan por cliente (horizontal) y por día (vertical): Obj, Real, %Cump y %Visitas.
// Se recalculan al instante cada vez que se pone o se quita una X.
const pctPlan = (r, p) => p ? Math.round(r / p * 100) + '%' : '';
function ponPct(celda, r, p) {
    celda.textContent = pctPlan(r, p);
    celda.classList.remove('bueno', 'medio', 'bajo');
    if (p) celda.classList.add(r / p >= 0.9 ? 'bueno' : r / p >= 0.6 ? 'medio' : 'bajo');
}
function actualizarTotalesPlan() {
    const tabla = $('vpTabla'), porDia = {}, T = { o: 0, r: 0, c: 0 };
    tabla.querySelectorAll('tbody tr').forEach(fila => {
        const k = { o: 0, r: 0, c: 0 }, interna = fila.classList.contains('vp-int');
        fila.querySelectorAll('.vp-x').forEach(x => {
            const plan = x.classList.contains('on'), real = x.nextElementSibling?.classList.contains('on');
            if (plan) k.o++;
            if (real) k.r++;
            if (plan && real) k.c++;
            if (interna) return;   // el trabajo interno no suma en los totales de clientes
            const pd = porDia[x.dataset.d] = porDia[x.dataset.d] || { o: 0, r: 0, c: 0 };
            if (plan) pd.o++;
            if (real) pd.r++;
            if (plan && real) pd.c++;
        });
        const n = fila.querySelectorAll('.vp-n');
        if (n.length < 4) return;
        n[0].textContent = k.o; n[1].textContent = k.r;
        if (interna) return;
        ponPct(n[2], k.c, k.o); ponPct(n[3], k.r, k.o);
        T.o += k.o; T.r += k.r; T.c += k.c;
    });
    tabla.querySelectorAll('tfoot .vp-tp').forEach(celda => {
        const d = celda.dataset.d, pd = porDia[d] || { o: 0, r: 0, c: 0 };
        celda.textContent = pd.o || '';
        tabla.querySelector(`tfoot .vp-tr[data-d="${d}"]`).textContent = pd.r || '';
        ponPct(tabla.querySelector(`tfoot .vp-dp[data-d="${d}"]`), pd.c, pd.o);
        ponPct(tabla.querySelector(`tfoot .vp-dv[data-d="${d}"]`), pd.r, pd.o);
    });
    // Pie de la primera columna: clientes (según el filtro), planeados y visitados con su porcentaje
    const filasCli = [...tabla.querySelectorAll('tbody tr:not(.vp-int)')].filter(f => f.querySelector('.vp-x'));
    const nCli = filasCli.length, nPlan = filasCli.filter(f => f.querySelector('.vp-x.on')).length, nVis = filasCli.filter(f => f.querySelector('.vp-r.on')).length;
    if ($('vpPieN')) {
        $('vpPieN').innerHTML = `<b>${nCli}</b> ${nCli === 1 ? 'cliente' : 'clientes'} · <span class="p">planeados <b>${nPlan}</b> (${pctPlan(nPlan, nCli) || '0%'})</span> · <span class="v">visitados <b>${nVis}</b> (${pctPlan(nVis, nCli) || '0%'})</span>`;
        // Barra de progreso de las visitas: reales frente a las programadas (Obj)
        const avance = T.o ? Math.min(T.r / T.o, 1) : 0, nivel = !T.o ? '' : T.r / T.o >= 0.9 ? 'bueno' : T.r / T.o >= 0.6 ? 'medio' : 'bajo';
        $('vpPieV').innerHTML = `<div class="vp-prog"><div class="vp-barra-prog ${nivel}" title="Visitas reales frente a las programadas"><span style="width:${Math.round(avance * 100)}%"></span></div>`
            + `<small class="vp-barra-txt">Visitas <b>${T.r}</b> de <b>${T.o}</b> · ${pctPlan(T.r, T.o) || '0%'}</small></div>`;
    }
    // Celular: tarjetas grandes con clientes, planeados y visitados
    $('vpKpis').innerHTML = `<div><b>${nCli}</b><span>Clientes</span></div><div class="p"><b>${nPlan}</b><span>Planeados · ${pctPlan(nPlan, nCli) || '0%'}</span></div><div class="v"><b>${nVis}</b><span>Visitados · ${pctPlan(nVis, nCli) || '0%'}</span></div>`;
    if ($('vpTotP')) {
        $('vpTotP').textContent = T.o; $('vpTotR').textContent = T.r;
        ponPct($('vpTotPct'), T.c, T.o); ponPct($('vpTotVis'), T.r, T.o);
    }
    // Resumen del periodo (hoy, semana o mes) sin filtros, del vendedor o de todo el equipo
    let obj = 0, real = 0, cump = 0, clientesP = 0;
    const enVista = new Set(visiplan.dias || []);
    (visiplan.vista || []).forEach(vid => {
        const { marcas, reales } = seguimientoPlan(vid, visiplan.mes);
        const rv = n => new Set([...(reales[n] || [])].filter(d => enVista.has(d)));
        Object.entries(marcas).forEach(([n, ds]) => {
            const k = indicadoresPlan(ds.filter(d => enVista.has(d)), rv(n)); obj += k.obj; cump += k.cump; if (k.obj) clientesP++;
        });
        Object.keys(reales).forEach(n => { real += rv(n).size; });
    });
    const chip = (f, clase, html, titulo) => { const on = visiplan.sel.f.includes(f); return `<button type="button" class="chip chip-filtro ${clase}${on ? ' activo' : ''}" onclick="filtrarPlan('${f}')" title="${titulo}" aria-pressed="${on}">${html}</button>`; };
    $('vpResumen').innerHTML = chip('plan', 'vp-chip-cli', `<b>${clientesP}</b> ${clientesP === 1 ? 'cliente planeado' : 'clientes planeados'}`, 'Ver solo los clientes planeados')
        + chip('plan', 'vp-chip-plan', `Obj ${obj}`, 'Ver solo los clientes planeados') + chip('real', 'vp-chip-real', `Real ${real}`, 'Ver los clientes con visita real')
        + (obj ? chip('cump', 'vp-chip-pct', `${pctPlan(cump, obj)} Cump`, 'Ver los cumplidos en el día planeado') + chip('visit', 'vp-chip-pct', `${pctPlan(real, obj)} Visitas`, 'Ver los planeados que ya se visitaron') : '')
        + (visiplan.editable ? '' : '<span class="chip gris">🔒 Cerrado</span>');
}

// Excel solo con el Visiplan que se está viendo (vendedor y mes)
async function descargarVisiplan(boton) {
    boton.disabled = true;
    const txt = boton.textContent;
    boton.textContent = 'Generando…';
    try {
        await sincronizar(visiplan.mes);
        await cargarExcelJS();
        pintarVisiplan();
        const sel = visiplan.vendedores, todos = sel.length === COMERCIALES.length;
        const libro = libroVisiplanPantalla();
        const buffer = await libro.xlsx.writeBuffer();
        const quien = todos ? 'Equipo' : sel.length === 1 ? nombreVendedor(sel[0]).replace(/\s+/g, '_') : 'Varios';
        bajarArchivo(buffer, `Visiplan_${quien}_${visiplan.mes}.xlsx`);
        toast('Visiplan descargado');
    } catch (err) {
        console.error(err);
        toast('No se pudo generar el Excel. Revisa tu conexión e intenta de nuevo.');
    }
    boton.disabled = false;
    boton.textContent = txt;
}

// Excel "fiel copia" del Visiplan: se arma desde la tabla que se ve en pantalla (mismos filtros, periodo,
// vendedores, colores, X, totales y convenciones), leyendo los colores reales de cada celda
// Arma el Visiplan de un mes y vendedores dados en la tabla de la app (sin tocar lo que el usuario está viendo)
// y lo pasa al Excel con el mismo formato de la pantalla. Lo usa el informe general.
function conVisiplanDe(mes, vendedores, hacer) {
    const antes = { ...visiplan, vendedores: [...(visiplan.vendedores || [])], sel: { ...visiplan.sel } };
    Object.assign(visiplan, { mes, vendedores, periodo: 'mes', busca: '', sel: { t: [], e: [], f: ['actividad'] }, oculto: true, zonaFiltros: vendedores.join(',') });
    try {
        pintarVisiplan();
        return hacer();
    } finally {
        Object.assign(visiplan, antes, { oculto: false });
        pintarVisiplan();
    }
}

function libroVisiplanPantalla(libro = new ExcelJS.Workbook()) {
    libro.creator = 'Epithelium Visita';
    const h = libro.addWorksheet('Visiplan', { views: [{ showGridLines: false }] });
    const argb = css => {
        const m = String(css).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
        return 'FF' + [m[1], m[2], m[3]].map(n => Math.round(Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase();
    };
    const estiloDe = (el, celda, extra = {}) => {
        const cs = getComputedStyle(el);
        const fondo = argb(cs.backgroundColor);
        if (fondo && fondo !== 'FFFFFFFF') celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } };
        celda.font = { bold: Number(cs.fontWeight) >= 600, italic: cs.fontStyle === 'italic', color: { argb: argb(cs.color) || 'FF333333' }, size: extra.size || 10 };
        const lado = w => parseFloat(w) >= 2 ? 'medium' : 'thin';
        const borde = (w, c) => parseFloat(w) > 0 ? { style: lado(w), color: { argb: argb(c) || 'FFE6EEEC' } } : undefined;
        celda.border = { right: borde(cs.borderRightWidth, cs.borderRightColor), bottom: borde(cs.borderBottomWidth, cs.borderBottomColor),
            top: borde(cs.borderTopWidth, cs.borderTopColor), left: borde(cs.borderLeftWidth, cs.borderLeftColor) };
        celda.alignment = { horizontal: cs.textAlign === 'left' || cs.textAlign === 'start' ? 'left' : 'center', vertical: 'middle', wrapText: true };
    };
    const texto = el => {
        if (el.matches('.vp-x.on, .vp-r.on, .vp-r.prox')) return 'X';
        const v = el.querySelector('.vp-vend');
        if (v) return `${v.textContent.trim()} · ${el.textContent.replace(v.textContent, '').trim()}`;
        const barra = el.querySelector('.vp-barra-prog span');
        if (barra) {   // la barra de progreso se dibuja con bloques
            const n = Math.round(parseFloat(barra.style.width) / 10);
            return `${'█'.repeat(n)}${'░'.repeat(10 - n)}  ${el.querySelector('.vp-barra-txt').textContent.trim()}`;
        }
        const chico = el.matches('.vp-dia') && el.querySelector('small');
        if (chico) return `${el.firstChild.textContent.trim()} ${chico.textContent.trim()}`;
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        if (/^\d+$/.test(t)) return Number(t);                        // números como números
        if (/^\d+%$/.test(t)) return { pct: Number(t.slice(0, -1)) / 100 };   // porcentajes con formato %
        return t;
    };
    // Encabezado: título, vendedores, periodo y filtros
    const vend = COMERCIALES.filter(c => visiplan.vendedores.includes(c.id)).map(c => `${c.nombre} · ${c.zona}`).join(', ');
    const periodo = visiplan.periodo === 'hoy' ? (visiplan.dia === hoy() ? 'Hoy' : mayuscula(fechaLarga(visiplan.dia))) : { semana: 'Esta semana', mes: 'Mes completo' }[visiplan.periodo];
    const filtros = [visiplan.busca && `Búsqueda: ${visiplan.busca}`, visiplan.sel.t.join(', '), visiplan.sel.e.join(', '),
        visiplan.sel.f.map(f => NOMBRES_FILTRO_PLAN[f] || 'Planeados o visitados').join(', ')].filter(Boolean).join(' · ');
    h.getCell('A1').value = `Visiplan del mes · ${mayuscula(nombreMes(visiplan.mes))}`;
    h.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF0B5C56' } };
    h.getCell('A2').value = vend;
    h.getCell('A2').font = { color: { argb: 'FF555555' } };
    h.getCell('A3').value = `${periodo}${filtros ? ' · ' + filtros : ''} · Descargado el ${fechaHora(new Date().toISOString())}`;
    h.getCell('A3').font = { italic: true, color: { argb: 'FF777777' }, size: 9 };
    // Resumen (los indicadores de arriba) con sus colores
    let col = 1;
    document.querySelectorAll('#vpResumen > *').forEach(chip => {
        const c = h.getCell(5, col); c.value = chip.textContent.replace(/\s+/g, ' ').trim(); estiloDe(chip, c, { size: 10 });
        c.border = {}; h.mergeCells(5, col, 5, col + 1); col += 2;
    });
    // Convenciones
    col = 1;
    document.querySelectorAll('.vp-conv span').forEach(sp => {
        const muestra = sp.querySelector('.vp-muestra');
        const m = h.getCell(6, col); m.value = muestra && !muestra.matches('.fest, .planeacion') ? 'X' : '';
        if (muestra) estiloDe(muestra, m);
        m.border = {};
        const t = h.getCell(6, col + 1); t.value = sp.textContent.trim(); t.font = { size: 9, color: { argb: 'FF4C615B' } };
        h.mergeCells(6, col + 1, 6, col + 4); col += 5;
    });
    // La tabla, celda por celda (respeta columnas y filas combinadas)
    const inicio = 8, ocupadas = new Set();
    let fila = inicio;
    const tabla = $('vpTabla');
    [...tabla.querySelectorAll('thead tr, tbody tr, tfoot tr')].forEach(tr => {
        let c = 1;
        [...tr.children].forEach(td => {
            while (ocupadas.has(`${fila},${c}`)) c++;
            const cs = Number(td.colSpan) || 1, rs = Number(td.rowSpan) || 1;
            const celda = h.getCell(fila, c);
            const valor = texto(td);
            celda.value = valor && valor.pct !== undefined ? valor.pct : valor;
            estiloDe(td, celda);
            if (valor && valor.pct !== undefined) celda.numFmt = '0%';
            if (cs > 1 || rs > 1) {
                h.mergeCells(fila, c, fila + rs - 1, c + cs - 1);
                for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) ocupadas.add(`${fila + i},${c + j}`);
            }
            c += cs;
        });
        fila++;
    });
    // Anchos parecidos a la pantalla
    const cab = tabla.querySelector('thead tr');
    const cols = [...tabla.querySelectorAll('tbody tr:first-child > *')];
    h.getColumn(1).width = 24; h.getColumn(2).width = 36;
    cols.forEach((td, i) => {
        if (i < 2) return;
        h.getColumn(i + 1).width = td.classList.contains('vp-n') ? 9 : 3.6;
    });
    h.getRow(inicio).height = 18;
    h.views = [{ showGridLines: false, state: 'frozen', xSplit: 2, ySplit: inicio + (cab ? 2 : 0) }];
    return libro;
}

// Marcar o quitar una X (se guarda sola a los pocos segundos)
const planesPorGuardar = new Set();
function marcarPlan(celda) {
    const mes = visiplan.mes;
    const { c, d, v: vend } = celda.dataset;
    if (!planEditable(mes)) return toast(`El plan de ${nombreMes(mes)} ya está cerrado`);
    if (esJefe() && !esAdmin() && vend !== sesion.id) return toast('Solo el vendedor (o el administrador) puede editar su plan');
    const id = idPlan(vend, mes);
    const plan = registros[id] ? { ...registros[id], marcas: { ...registros[id].marcas } }
        : { id, clase: 'plan', vendedor: vend, mes, fecha: mes + '-01', marcas: {}, confirmadas: {}, creado: new Date().toISOString(), creadoPor: sesion.id };
    const lista = new Set(plan.marcas[c] || []);
    if (lista.has(d)) lista.delete(d); else lista.add(d);
    plan.marcas[c] = [...lista].sort();
    if (!plan.marcas[c].length) delete plan.marcas[c];
    registros[id] = plan;   // se ve de inmediato; se guarda y sube después de una pausa
    celda.classList.toggle('on', lista.has(d));
    if (c === 'Planeación Mes') pintarVisiplan(); else actualizarTotalesPlan();   // Planeación Mes pinta de azul el día
    planesPorGuardar.add(id);
    clearTimeout(esperaPlan);
    esperaPlan = setTimeout(() => {
        planesPorGuardar.forEach(pid => guardarRegistro(registros[pid]));
        planesPorGuardar.clear();
        pintarVisiplan(); toast('Plan guardado');
    }, 1200);
}

// Confirmar en el día una visita planeada: abre la programación con el cliente ya puesto
let confirmandoPlan = null;
function confirmarPlaneada(contacto, fecha) {
    if (fecha !== hoy()) return toast('Las visitas del plan se confirman el mismo día');
    confirmandoPlan = { contacto, fecha };
    abrirProgramar(null, contacto);
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

// Calendario del mes con festivos oficiales, novedades y número de visitas
let mesCalendario = null;
function abrirCalendario(mes) {
    mesCalendario = mes || mesDe(agenda.fecha);
    const v = agenda.vendedor, t = hoy();
    const primero = mesCalendario + '-01';
    const inicio = lunesDe(primero);
    const ultimo = finDeMes(mesCalendario);
    let celdas = '';
    for (let d = inicio; d <= ultimo || deIso(d).getDay() !== 1; d = sumarDias(d, 1)) {
        const fuera = mesDe(d) !== mesCalendario;
        const fest = nombreFestivo(d);
        const nov = novedadesDe(v, d)[0];
        const n = visitasDe(v, d).filter(x => !x.interno).length;
        celdas += `<button class="cal-dia${fuera ? ' fuera' : ''}${fest ? ' festivo' : ''}${d === t ? ' hoy' : ''}${d === agenda.fecha ? ' sel' : ''}${deIso(d).getDay() === 0 ? ' domingo' : ''}" onclick="irDelCalendario('${d}')">
            <b>${deIso(d).getDate()}</b>
            ${fest ? `<small class="cal-fest">${esc(fest)}</small>` : ''}
            ${nov ? `<small class="cal-nov" title="${esc(nov.tipo)}"><span class="largo">${esc(nov.tipo)}</span><span class="corto">${esc(CORTO_NOVEDAD[nov.tipo])}</span></small>` : ''}
            ${n ? `<span class="cal-n">${n} ${n === 1 ? 'visita' : 'visitas'}</span>` : ''}
        </button>`;
    }
    const festMes = [...festivos(+mesCalendario.slice(0, 4))].filter(([f]) => mesDe(f) === mesCalendario).sort();
    abrirModal(`<div class="form-rc calendario">
        <div class="nav-fecha">
            <button class="btn-nav" onclick="abrirCalendario(sumarMes(mesCalendario, -1))" aria-label="Mes anterior">&lsaquo;</button>
            <div class="nav-titulo"><strong>${esc(mayuscula(nombreMes(mesCalendario)))}</strong><small>${esc(nombreVendedor(v))}</small></div>
            <button class="btn-nav" onclick="abrirCalendario(sumarMes(mesCalendario, 1))" aria-label="Mes siguiente">&rsaquo;</button>
        </div>
        <div class="cal-grid">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(x => `<span class="cal-cab">${x}</span>`).join('')}${celdas}</div>
        <div class="cal-festivos">${festMes.length ? '<b>Festivos del mes</b>' + festMes.map(([f, nom]) => `<span>${esc(fechaCorta(f))} · ${esc(nom)}</span>`).join('') : '<span>Este mes no tiene festivos.</span>'}</div>
    </div>`);
}

function irDelCalendario(d) {
    cerrarModal();
    elegirFecha(d);
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
        const fest = nombreFestivo(d);
        const nov = novedadesDe(v, d)[0];
        const marca = nov ? `<em>${CORTO_NOVEDAD[nov.tipo]}</em>` : fest ? '<em>Festivo</em>' : '';
        return `<button class="sd${d === t ? ' hoy' : ''}${d === f ? ' sel' : ''}${fest ? ' festivo' : ''}${nov ? ' con-novedad' : ''}" onclick="elegirFecha('${d}')" title="${esc(fest || nov?.tipo || '')}"><b>${DIAS[deIso(d).getDay()]}</b><span>${deIso(d).getDate()}</span>${marca}<span class="puntos">${puntos}</span></button>`;
    }).join('');

    $('agAvisoZona').hidden = comercial(v)?.zona !== ZONA_POR_ASIGNAR;
    const fest = nombreFestivo(f);
    $('agFestivo').hidden = !fest;
    $('agFestivo').textContent = fest ? `Festivo · ${fest}` : '';
    const novs = novedadesDe(v, f);
    const lista = visitasDe(v, f);
    const k = cuentaVisitas(lista);
    const internos = lista.filter(x => x.interno).length;
    // Los indicadores del día son botones: al tocarlos filtran las visitas (otro toque quita el filtro)
    const boton = (f, clase, texto) => `<button type="button" class="chip chip-filtro ${clase}${agenda.filtro === f ? ' activo' : ''}" onclick="filtrarAgenda('${f}')" aria-pressed="${agenda.filtro === f}">${texto}</button>`;
    $('agResumen').innerHTML = lista.length
        ? boton('prog', 'prog', `<b>${k.prog}</b> ${k.prog === 1 ? 'programada' : 'programadas'}`)
            + (k.noProg ? boton('noProg', 'np', `${k.noProg} no programadas`) : '')
            + boton('ok', 'ok', `${k.ok} visitadas`) + boton('no', 'no', `${k.no} no visitadas`) + boton('p', 'p', `${k.p} pendientes`)
            + (internos ? boton('interno', 'gris', `${internos} trabajo interno`) : '')
            + `<select class="ag-orden" onchange="agenda.orden=this.value; pintarAgenda()" aria-label="Ordenar visitas">
                <option value="prog" ${agenda.orden === 'prog' ? 'selected' : ''}>Orden: visita programada</option>
                <option value="realizada" ${agenda.orden === 'realizada' ? 'selected' : ''}>Orden: visita realizada</option>
                <option value="hora" ${agenda.orden === 'hora' ? 'selected' : ''}>Orden: hora de cita</option></select>`
        : '';

    const plan = planeadasDe(v, f).filter(p => p.estado !== 'confirmada');
    // Arriba los planeados por confirmar; los que no se confirmaron a tiempo quedan al final del día
    const tarjetaPlan = p => `
        <div class="producto-card plan-card ${p.estado === 'cerrada' ? 'cerrada' : ''}">
            <div class="visita-cab"><div><h3>${esc(p.contacto)}</h3></div><span class="chip ${p.estado === 'cerrada' ? 'gris' : 'azul'}">${p.estado === 'cerrada' ? 'No confirmada · cerrada' : 'Planeada'}</span></div>
            ${p.estado === 'por confirmar' && f === t
                ? `<div class="acciones"><button class="bv ok" data-c="${esc(p.contacto)}" onclick="confirmarPlaneada(this.dataset.c, '${f}')">✓ Confirmar visita</button><span class="nota-cierre">Si no la confirmas hoy, queda cerrada y no se programa.</span></div>`
                : p.estado === 'por confirmar' ? '<p class="nota-cierre">Se confirma el mismo día de la visita.</p>' : ''}
        </div>`;
    // Después de las 8:00 a. m. los que no se confirmaron también bajan al final (se pueden confirmar mientras sea el día)
    const tarde = p => p.estado === 'cerrada' || Date.now() >= limiteProgramacion(f);
    const abiertas = plan.filter(p => !tarde(p)), cerradas = plan.filter(tarde);
    const bloquePlan = abiertas.length ? `<div class="plan-dia"><p class="grupo-titulo">Visiplan · ${abiertas.length} ${abiertas.length === 1 ? 'cliente planeado' : 'clientes planeados'}</p>${abiertas.map(tarjetaPlan).join('')}</div>` : '';
    const bloqueCerradas = cerradas.length ? `<div class="plan-dia"><p class="grupo-titulo">Visiplan · ${cerradas.length} ${cerradas.length === 1 ? 'planeado no confirmado' : 'planeados no confirmados'}</p>${cerradas.map(tarjetaPlan).join('')}</div>` : '';
    const cont = $('agLista');
    if (!lista.length && !novs.length && !plan.length) {
        cont.innerHTML = `<div class="no-results">${fest ? 'Día festivo: no hay nada programado.' : 'No hay visitas programadas para este día.'}<br><button class="btn-nuevo" style="margin-top:15px" onclick="abrirProgramar()">+ Programar</button></div>`;
        return;
    }
    // Filtro por indicador y orden (por hora de cita o por el orden en que se reportaron las visitas)
    const pasa = {
        prog: x => !x.interno && esProgramada(x), noProg: x => !x.interno && !esProgramada(x),
        ok: x => !x.interno && x.estado === 'visitado', no: x => !x.interno && x.estado === 'no_visitado',
        p: x => !x.interno && x.estado === 'pendiente', interno: x => x.interno
    }[agenda.filtro] || (() => true);
    const { o: ordenes, prog: programadas } = ordenesDelDia(lista);
    const clave = x => agenda.orden === 'prog' ? (ordenes[x.id]?.prog ?? (x.interno ? 2e9 : 1e9))
        : agenda.orden === 'realizada' ? (ordenes[x.id]?.real ?? (x.interno ? 2e9 : 1e9)) : 0;
    const vistas = lista.filter(pasa).sort((a, b) => clave(a) - clave(b) || ordenCita(a, b));
    const mover = { abierta: Date.now() < limiteProgramacion(f), puede: sesion.id === v || esAdmin(), total: programadas.length };
    const tarjetas = vistas.map(x => tarjetaVisita(x, ordenes[x.id], mover)).join('');
    const aviso = agenda.filtro ? `<p class="grupo-titulo filtro-activo">Mostrando ${vistas.length} de ${lista.length} · <button class="link-mini" onclick="filtrarAgenda('${agenda.filtro}')">Quitar filtro</button></p>` : '';
    cont.innerHTML = (agenda.filtro ? '' : novs.map(tarjetaNovedad).join('') + bloquePlan) + aviso
        + (tarjetas || (lista.length || !cerradas.length ? '<div class="no-results">No hay visitas con este filtro.</div>' : ''))
        + (agenda.filtro ? '' : bloqueCerradas);
}

// Orden de las visitas del día. El programado lo pone el vendedor y lo puede cambiar hasta que cierra la
// programación (8:00 a. m.); las visitas fuera de horario (no programadas) no tienen orden programado.
// El real lo da el sistema según el orden en que se registran como visitadas.
function ordenesDelDia(lista) {
    const prog = lista.filter(x => !x.interno && esProgramada(x))
        .sort((a, b) => (a.ordenPlan ?? 1e9) - (b.ordenPlan ?? 1e9) || (a.creado || '').localeCompare(b.creado || '') || ordenCita(a, b));
    const real = lista.filter(x => !x.interno && x.estado === 'visitado' && !x.cierreAutomatico && x.registrada)
        .sort((a, b) => a.registrada.localeCompare(b.registrada));
    const o = {};
    prog.forEach((x, i) => { o[x.id] = { prog: i + 1 }; });
    real.forEach((x, i) => { (o[x.id] = o[x.id] || {}).real = i + 1; });
    return { o, prog };
}

function moverOrden(id, paso) {
    const v = registros[id];
    if (Date.now() >= limiteProgramacion(v.fecha)) return toast('La programación del día ya cerró: el orden quedó fijo');
    const { prog } = ordenesDelDia(visitasDe(v.vendedor, v.fecha));
    const i = prog.findIndex(x => x.id === id), j = i + paso;
    if (i < 0 || j < 0 || j >= prog.length) return;
    [prog[i], prog[j]] = [prog[j], prog[i]];
    prog.forEach((x, k) => { if (x.ordenPlan !== k + 1) guardarRegistro({ ...x, ordenPlan: k + 1 }); });
    agenda.orden = 'prog';
    pintarAgenda();
}

function filtrarAgenda(f) {
    agenda.filtro = agenda.filtro === f ? '' : f;
    pintarAgenda();
}

function tarjetaVisita(v, ord = null, mover = null) {
    const clase = v.estado === 'visitado' ? 'ok' : v.estado === 'no_visitado' ? 'no' : '';
    const [txtOk, txtNo] = v.interno ? ['Realizado', 'No realizado'] : ['Visitado', 'No visitado'];
    const chip = v.estado === 'visitado' ? `<span class="chip ok">${txtOk}</span>`
        : v.estado === 'no_visitado' ? `<span class="chip no">${txtNo}</span>`
        : !v.interno && esReprogramada(v) ? `<span class="chip no">${v.origen === 'proxima' ? 'Próxima visita' : 'Reprogramada'}</span>`
        : '<span class="chip p">Pendiente</span>';
    const meta = [v.tipoContacto, v.ciudad].filter(Boolean).map(esc).join(' · ');
    const cumplidos = v.estado === 'visitado' ? (v.objetivosCumplidos || []) : null;
    const marcaObj = o => !cumplidos ? '' : cumplidos.includes(o) ? ' class="cumplido"' : ' class="no-cumplido"';
    let objetivos = v.tipoVisita
        ? `<p class="objetivos"><b>${esc(nombreTipo(v))}</b>${(v.objetivos || []).map(o => `<span${marcaObj(o)}>${cumplidos && cumplidos.includes(o) ? '✓ ' : ''}${esc(o)}${textoSubs(v, o)}</span>`).join('')}${(cumplidos || []).filter(o => !(v.objetivos || []).includes(o)).map(o => `<span class="cumplido extra" title="Cumplido sin haberlo programado">✓ ${esc(o)}${textoSubs(v, o)}</span>`).join('')}${cumplidos && v.objetivos?.length ? `<small>${cumplidosProgramados(v).length} de ${v.objetivos.length} cumplidos</small>` : ''}</p>` : '';
    const noProgTxt = esProgramada(v) ? '' : `<span class="chip np">${v.interno ? 'No programado' : 'No programada'}</span>`;
    const marcas = v.interno ? `<span class="chip gris">Trabajo interno</span>${noProgTxt}`
        : `<span class="chip ${v.modalidad === 'virtual' ? 'azul' : 'gris'}">${modalidadDe(v)}</span>${v.esProyecto ? '<span class="chip proy">Proyecto</span>' : ''}${esReprogramada(v) && v.vieneDe ? `<span class="chip prox">Viene del ${esc(fechaCorta(v.vieneDe))}</span>` : ''}${noProgTxt}`;
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
            v.proximaVisita ? `Próxima visita: ${esc(fechaCorta(v.proximaVisita))}` : '',
            v.observaciones ? esc(v.observaciones) : ''
        ].filter(Boolean);
        reporte = `<div class="reporte">${partes.join('<br>')}</div>`;
    }
    if (v.estado === 'no_visitado') {
        reporte = `<div class="reporte"><b>${esc(v.motivo)}</b>${v.reprogramadaPara ? ` · Reprogramada para el ${esc(fechaCorta(v.reprogramadaPara))}` : ''}${v.observaciones ? '<br>' + esc(v.observaciones) : ''}</div>`;
    }
    const reprog = !v.interno && v.estado === 'pendiente' && esReprogramada(v) ? ' reprog' : '';
    return `<div class="producto-card visita-card ${clase}${v.interno ? ' interno' : ''}${reprog}">
        <div class="visita-cab"><div>${v.hora ? `<span class="cita-fija"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Cita ${esc(horaBonita(v.hora))}</span>` : ''}${v.interno ? '' : insigniasOrden(v, ord || {}, mover)}${v.interno ? `<h3>${esc(v.contacto)}</h3>` : `<h3 class="cliente-link" data-c="${esc(v.contacto)}" onclick="verCliente(this.dataset.c, '${v.vendedor}')" title="Ver historial del cliente">${esc(v.contacto)}</h3>`}</div>${chip}</div>
        ${meta ? `<p class="meta">${meta}</p>` : ''}
        <div class="marcas">${marcas}</div>
        ${objetivos}
        ${v.objetivo ? `<p>${esc(v.objetivo)}</p>` : ''}
        ${reporte}
        ${accionesVisita(v, txtOk, txtNo)}
    </div>`;
}

// Insignias de orden: Prog (azul, lo pone el vendedor; con flechas mientras la programación está abierta) y Real (verde)
function insigniasOrden(v, ord, mover) {
    const flechas = mover && mover.abierta && mover.puede && ord.prog && v.estado === 'pendiente'
        ? `<button class="ord-mover" onclick="moverOrden('${v.id}', -1)" ${ord.prog === 1 ? 'disabled' : ''} aria-label="Subir en el orden">▲</button><button class="ord-mover" onclick="moverOrden('${v.id}', 1)" ${ord.prog === mover.total ? 'disabled' : ''} aria-label="Bajar en el orden">▼</button>` : '';
    const abierta = mover && mover.abierta;
    return `<span class="ordenes"><span class="ord prog${abierta ? ' abierta' : ''}" title="${ord.prog ? 'Orden programado' + (abierta ? ' (se puede cambiar hasta las 8:00 a. m.)' : '') : 'Fuera de horario: sin orden programado'}">${ord.prog || '–'}${flechas}</span>`
        + (ord.real ? `<span class="ord real" title="Orden en que se visitó">${ord.real}</span>` : '') + '</span>';
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
// Pregunta antes de programar en un festivo o en un día con novedad; devuelve true si se continúa
async function confirmarDia(fecha) {
    const festivo = nombreFestivo(fecha);
    const nov = novedadesDe(agenda.vendedor, fecha)[0];
    if (festivo && !await dialogo({ tono: 'aviso', titulo: 'Día festivo', texto: `El ${fechaLarga(fecha)} es festivo: ${festivo}.\n¿Deseas continuar con la programación?`, aceptar: 'Sí, continuar', cancelar: 'No' })) return false;
    if (nov && !await dialogo({ tono: 'aviso', titulo: nov.tipo, texto: `${nombreVendedor(agenda.vendedor)} tiene ${nov.tipo.toLowerCase()} ese día (${rangoNovedad(nov)}).\n¿Deseas continuar con la programación?`, aceptar: 'Sí, continuar', cancelar: 'No' })) return false;
    return true;
}

async function abrirProgramar(id, contactoPlan) {
    advertenciaAceptada = '';
    if (!contactoPlan) confirmandoPlan = null;
    const v = id ? registros[id] : null;
    if (v && v.clase === 'visita' && v.estado !== 'pendiente') return toast('Esta visita ya se cerró y no se puede modificar');
    // Al programar algo nuevo en un festivo (o día con novedad) primero sale la advertencia, antes del formulario
    if (!v && !contactoPlan) {
        if (!await confirmarDia(agenda.fecha)) return;
        advertenciaAceptada = agenda.fecha;
    }
    const zona = comercial(agenda.vendedor)?.zona;
    const lista = contactos[zona] || [];
    const actual = v?.tipoVisita || v?.tipo;
    const opcion = t => `<option ${t === actual && !v?.esProyecto ? 'selected' : ''}>${esc(t)}</option>`;
    // Visita que viene del Visiplan o que ya estaba programada (o reprogramada): no se cambia qué se programa ni el cliente
    const bloqueado = !!contactoPlan || (v && v.clase === 'visita');
    const opcionNuevo = t => `<option ${t === actual && v?.esProyecto ? 'selected' : ''}>${esc(t)}</option>`;
    abrirModal(`<form class="form-rc" novalidate onsubmit="guardarProgramada(event, '${id || ''}')">
        <h2>${v ? 'Editar programación' : 'Programar'}</h2>
        <p class="sub">${esc(nombreVendedor(agenda.vendedor))} · ${esc(zona || '')}</p>
        <div class="fila-fecha compacta">
            <div><label for="fFecha" id="lblFecha">Fecha</label><input id="fFecha" type="date" required value="${v?.fecha || agenda.fecha}"></div>
            <div id="cajaHora"><label for="fHora">Cita fija <small>(opcional)</small></label><input id="fHora" type="time" title="Solo si tienes una cita acordada: te avisamos 15 minutos antes" value="${esc(v?.hora)}"></div>
            <div id="cajaHasta" hidden><label for="fHasta">Hasta</label><input id="fHasta" type="date" value="${esc(v?.hasta)}"></div>
        </div>
        <div id="cajaQue"${bloqueado ? ' hidden' : ''}>
        <label for="fTipo">¿Qué vas a programar?</label>
        <select id="fTipo" required onchange="tiposForm = null; cambiarTipoProgramacion()">
            <option value="">Elige una opción</option>
            <optgroup label="Tipo de Visita">${Object.keys(TIPOS_VISITA).map(opcion).join('')}</optgroup>
            <optgroup label="Trabajo interno">${TRABAJO_INTERNO.map(opcion).join('')}</optgroup>
            <optgroup label="Contacto nuevo"><option value="nuevo" ${v?.esProyecto ? 'selected' : ''}>Contacto nuevo</option></optgroup>
            <optgroup label="Novedades">${NOVEDADES.map(opcion).join('')}</optgroup>
        </select>
        </div>
        <p class="tipo-bloqueado" id="fTipoFijo" hidden></p>
        <div id="cajaTipoNuevo" hidden>
            <label for="fTipoNuevo">Tipo de visita</label>
            <select id="fTipoNuevo" onchange="cambiarTipoNuevo()">
                <option value="">Elige el tipo de visita</option>
                ${Object.keys(TIPOS_VISITA).map(opcionNuevo).join('')}
            </select>
        </div>
        <div id="cajaContacto">
            <label for="fContacto" id="lblContacto">Contacto</label>
            <div class="contacto-fila">
                <input id="fContacto" required list="dlContactos" autocomplete="off" placeholder="Busca el médico, cliente o punto de venta" value="${esc(v?.contacto)}">
                <div id="cajaTipoCliente" class="tipo-cliente" hidden></div>
            </div>
            <p class="clasif-cliente" id="fClasif" hidden></p>
            <datalist id="dlContactos"></datalist>
            <p class="ayuda" id="ayudaContacto" hidden></p>
            <div class="caja-proyecto" id="cajaProyecto" hidden>
                <p><span class="chip proy">Proyecto</span> Contacto nuevo que aún no está en la Maestra de Contactos. Escribe su nombre arriba.</p>
                <div class="dos">
                    <div><label for="pTipo">Tipo</label><select id="pTipo" onchange="etiquetaPersonaProyecto()">${TIPOS_PROYECTO.map(t => `<option>${t}</option>`).join('')}</select></div>
                    <div><label for="pCiudad">Ciudad</label><input id="pCiudad" placeholder="Ej: Bogotá"></div>
                </div>
                <label for="pPersona" id="lblPersona">Nombre de contacto (opcional)</label>
                <input id="pPersona" placeholder="Persona con quien se habla">
                <label for="pDir">Dirección (opcional)</label>
                <input id="pDir" placeholder="Ej: Cra 15 # 93-60, consultorio 402">
                <label for="pTel">Teléfono (opcional)</label>
                <input id="pTel" type="tel" inputmode="tel">
            </div>
        </div>
        <p class="aviso-festivo en-form" id="fFestivo" hidden></p>
        <div id="cajaPermiso" hidden>
            <label class="check dia-completo"><input type="checkbox" id="fDiaCompleto" ${!v || v.clase !== 'novedad' || v.diaCompleto !== false ? 'checked' : ''} onchange="cambiarTipoProgramacion()"><span>Día completo</span></label>
            <div class="dos" id="cajaHorasPermiso">
                <div><label for="fHoraInicio">Hora de inicio</label><input id="fHoraInicio" type="time" value="${esc(v?.horaInicio)}"></div>
                <div><label for="fHoraFin">Hora de finalización</label><input id="fHoraFin" type="time" value="${esc(v?.horaFin)}"></div>
            </div>
        </div>
        <div id="cajaModalidad">
            <label>Modalidad</label>
            ${botonesModalidad(v?.modalidad)}
        </div>
        <div id="cajaObjetivos" hidden>
            <label>Objetivos de la visita <small>(puedes escoger varios)</small></label>
            <div class="checks" id="fObjetivos"></div>
        </div>
        <label for="fObjetivo" id="lblNotas">¿Qué vas a hacer? ${REQ} <small>(describe brevemente)</small></label>
        <textarea id="fObjetivo" maxlength="100" oninput="$('fObjetivoCuenta').textContent = this.value.length + ' / 100'" placeholder="Ej: llevar lista de precios nueva">${esc(v?.clase === 'novedad' ? v.nota : v?.objetivo)}</textarea>
        <p class="ayuda cuenta-nota" id="fObjetivoCuenta">0 / 100</p>
        <p class="aviso-hora" id="fAviso" hidden></p>
        <div class="form-botones">
            ${v && v.clase === 'visita' ? accionEliminar(v, 'btn-secundario btn-peligro') : ''}
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario">${v ? 'Guardar cambios' : 'Programar'}</button>
        </div>
    </form>`);
    tiposForm = v?.tiposVisita?.length ? v.tiposVisita.slice() : v && TIPOS_VISITA[v.tipoVisita] ? [v.tipoVisita] : null;
    cambiarTipoProgramacion(v?.objetivos || [], v?.subobjetivos || {});
    if (v && v.clase === 'visita') avisoProgramacion(v);
    if (contactoPlan) {
        advertenciaAceptada = agenda.fecha;
        $('fContacto').value = contactoPlan;
        const zona = comercial(agenda.vendedor)?.zona;
        const p = buscarProyecto(zona, contactoPlan);
        const m = buscarMaestra(zona, contactoPlan);
        $('fTipo').value = p ? 'nuevo' : esTrabajoInterno(contactoPlan) ? contactoPlan : m ? tipoDeCliente(m) : 'Visita Comercial';
        if (p) $('fTipoNuevo').value = tipoSugerido(p.tipo || '');
        tiposForm = null;
        cambiarTipoProgramacion();
        document.querySelector('#modalContenido h2').textContent = 'Confirmar visita del plan';
        $('fAviso').hidden = false;
        $('fAviso').textContent = 'Visita del Visiplan: cuenta como programada. Escoge qué vas a hacer y confirma.';
        $('fFecha').disabled = true;
    }
    if (bloqueado) {
        $('fContacto').readOnly = true; $('fTipoNuevo').disabled = true;
        const nuevoTxt = $('fTipo').value === 'nuevo' ? 'Contacto nuevo · ' + $('fTipoNuevo').value : '';
        $('fTipoFijo').hidden = false;
        $('fTipoFijo').dataset.nuevo = nuevoTxt;
        $('fTipoFijo').dataset.extra = contactoPlan ? ' · del Visiplan' : v?.origen === 'reprogramada' || v?.origen === 'proxima' ? ' · reprogramada' : '';
        pintarTipoFijo();
    }
    $('fContacto').addEventListener('change', () => { tiposForm = null; sugerirTipo(); pintarTipoCliente(); });
    $('fContacto').addEventListener('input', revisarProyecto);
    $('fFecha').addEventListener('change', () => { avisoProgramacion(v && v.clase === 'visita' ? v : null); pintarObjetivos(); });
}

// Muestra u oculta los campos según sea una visita, un trabajo interno o una novedad
function cambiarTipoProgramacion(marcados, subsMarcados) {
    const tipo = tipoBase();
    $('cajaTipoNuevo').hidden = origenElegido() !== 'nuevo';
    elegirOrigen(origenElegido());
    const interno = esTrabajoInterno(tipo);
    const novedad = esNovedad(tipo);
    $('cajaContacto').hidden = interno || novedad;
    $('cajaModalidad').hidden = interno || novedad;
    $('cajaHora').hidden = novedad;
    // Permiso: día completo (con "Hasta") o por horas en un solo día
    const permiso = NOVEDAD_HORAS.includes(tipo);
    const porHoras = permiso && !$('fDiaCompleto').checked;
    $('cajaPermiso').hidden = !permiso;
    $('cajaHorasPermiso').hidden = !porHoras;
    const conRango = NOVEDAD_RANGO.includes(tipo) && !porHoras;
    $('cajaHasta').hidden = !conRango;
    $('lblFecha').textContent = conRango ? 'Desde' : 'Fecha';
    // En visitas y trabajo interno es obligatorio escribir qué se va a hacer (máximo 100 caracteres)
    $('lblNotas').innerHTML = novedad ? 'Detalle <small>(opcional)</small>' : `¿Qué vas a hacer? ${REQ} <small>(describe brevemente)</small>`;
    $('fObjetivoCuenta').hidden = novedad;
    $('fObjetivoCuenta').textContent = $('fObjetivo').value.length + ' / 100';
    $('fObjetivo').placeholder = novedad ? 'Ej: incapacidad por EPS, cita de control' : interno ? 'Ej: cotizaciones pendientes, informe de cartera' : 'Ej: llevar lista de precios nueva';
    pintarTipoCliente(true);
    pintarObjetivos(marcados, subsMarcados);
    avisoProgramacion(null);
}

// Clientes con clasificación que sale en Visita Médica y Visita Comercial (hoy 20 y 21): al lado del cliente se
// marca una, otra o ambas. Los demás clientes solo salen en el tipo de visita de su clasificación.
let tiposForm = null;
function clienteDelForm() {
    if (!esTipoVisita($('fTipo')?.value)) return null;
    return buscarMaestra(comercial(agenda.vendedor)?.zona, $('fContacto').value) || null;
}
function tiposCliente() {
    const f = $('fTipo').value, c = clienteDelForm();
    if (!c || !permiteAmbos(c) || !AMBOS_TIPOS.includes(f)) return [f];
    const elegidos = AMBOS_TIPOS.filter(t => (tiposForm || [f]).includes(t));
    return elegidos.length ? elegidos : [f];
}
function pintarTipoCliente(sinObjetivos) {
    const caja = $('cajaTipoCliente'), c = clienteDelForm();
    const ver = !!c && permiteAmbos(c) && AMBOS_TIPOS.includes($('fTipo').value);
    caja.hidden = !ver;
    if (ver) {
        const ts = tiposCliente();
        caja.innerHTML = AMBOS_TIPOS.map(t => `<label class="check tipo-op"><input type="checkbox" value="${t}" ${ts.includes(t) ? 'checked' : ''} onchange="cambiarAmbos(this)"><span>${t}</span></label>`).join('')
            + '<small>marca una o ambas</small>';
    } else caja.innerHTML = '';
    // Debajo del cliente, su clasificación completa (número y descripción)
    const cc = buscarMaestra(comercial(agenda.vendedor)?.zona, $('fContacto').value);
    $('fClasif').hidden = !(cc && (cc.cl || cc.ca)) || origenElegido() === 'nuevo';
    $('fClasif').innerHTML = cc ? `Clasificación <b>${esc(cc.cl || '')}</b>${cc.ca ? ' · ' + esc(cc.ca) : ''}` : '';
    if (!sinObjetivos) pintarObjetivos();
}
function cambiarAmbos(casilla) {
    const marcados = [...$('cajaTipoCliente').querySelectorAll('input:checked')].map(i => i.value);
    if (!marcados.length) { casilla.checked = true; return toast('Marca al menos un tipo de visita'); }
    tiposForm = AMBOS_TIPOS.filter(t => marcados.includes(t));
    pintarTipoFijo();
    pintarObjetivos();
}
const tiposElegidos = () => esTipoVisita($('fTipo').value) ? tiposCliente() : listaTipos(tipoBase());
// Visita del Visiplan o ya programada: arriba sale fijo el tipo (en clientes 20 y 21, los tipos marcados)
function pintarTipoFijo() {
    const el = $('fTipoFijo');
    if (el.hidden) return;
    const t = el.dataset.nuevo || (esTipoVisita($('fTipo').value) ? tiposCliente().join(' + ') : $('fTipo').value);
    el.innerHTML = `<b>${esc(t)}</b>${el.dataset.extra || ''}`;
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
function pintarObjetivos(marcados, subsMarcados) {
    const ts = tiposElegidos(), nuevo = origenElegido() === 'nuevo' || (esMedCom(ts) && 'medcom'), tipo = tiposEfectivos(ts, nuevo), cont = $('fObjetivos');
    const actuales = marcados || leerObjetivos(cont);
    const subs = subsMarcados || leerSubs(cont);
    const lista = esTipoVisita($('fTipo').value) && !clienteDelForm() ? [] : objetivosDeTipos(tipo, nuevo);
    $('cajaObjetivos').hidden = !lista.length;
    cont.innerHTML = htmlObjetivos(lista, { tipo, nuevo, mes: mesDe($('fFecha').value || agenda.fecha), marcados: actuales, subs });
}

// Objetivos con sus subcategorías. Al marcar un objetivo se abren sus subcategorías.
// En el cierre (con "programados") lo programado va en negrita y lo demás en gris claro.
// Subcategorías guardadas con el nombre anterior (antes de pasarlas a nombre propio o renombrarlas)
const SUBS_VIEJAS = { 'precios de la competencia': 'Chequeo de Precios' };
const tieneSub = (arr, x) => (arr || []).some(y => normalizar(SUBS_VIEJAS[normalizar(y)] || y) === normalizar(x));
function htmlObjetivos(lista, { tipo, nuevo, mes, marcados = [], subs = {}, programados = null, subsProg = {}, _uno = false }) {
    // Visita de varios tipos: los objetivos van por grupo; los que se repiten salen una sola vez, en el primer grupo
    const tipos = listaTipos(tipo);
    if (tipos.length > 1 && !_uno) {
        const vistos = new Set();
        return tipos.map(t => {
            const deTipo = lista.filter(o => objetivosDeTipo(t, nuevo).includes(o) && !vistos.has(o));
            deTipo.forEach(o => vistos.add(o));
            return deTipo.length ? `<p class="obj-grupo">${esc(t)}</p>` + htmlObjetivos(deTipo, { tipo, nuevo, mes, marcados, subs, programados, subsProg, _uno: true }) : '';
        }).join('');
    }
    return lista.map(o => {
        const sc = subcategoriasDe(tipo, nuevo, o, mes);
        const prog = programados && programados.includes(o);
        const abierto = marcados.includes(o) || prog;
        const estilo = (lo, de) => programados ? (tieneSub(de, lo) ? ' programado' : ' no-programado') : '';
        const cajaSubs = sc.length
            ? `<div class="subs"${abierto ? '' : ' hidden'}>${sc.map(x => `<label class="check sub${estilo(x, subsProg[o] || [])}"><input type="checkbox" data-o="${esc(o)}" value="${esc(x)}" ${tieneSub(subs[o], x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div>`
            : esVariable(o) ? `<div class="subs"${abierto ? '' : ' hidden'}><p class="ayuda">Aún no se cargan ${o === 'Parrilla Promocional' ? 'los productos de la parrilla' : 'las actividades'} de ${nombreMes(mes)}.</p></div>` : '';
        return `<div class="obj-item${abierto && cajaSubs ? ' abierto' : ''}"><label class="check${estilo(o, programados || [])}"><input type="checkbox" class="obj" value="${esc(o)}" ${marcados.includes(o) ? 'checked' : ''} onchange="abrirSubs(this)"><span>${esc(o)}</span></label>${cajaSubs}</div>`;
    }).join('');
}
function abrirSubs(casilla) {
    const item = casilla.closest('.obj-item'), caja = item.querySelector('.subs');
    if (!caja) return;
    const ver = casilla.checked || !!item.querySelector('.check.programado');
    caja.hidden = !ver;
    item.classList.toggle('abierto', ver);
}
const leerObjetivos = cont => [...cont.querySelectorAll('input.obj:checked')].map(i => i.value);
function leerSubs(cont, soloDe) {
    const r = {};
    cont.querySelectorAll('.subs input:checked').forEach(i => {
        if (soloDe && !soloDe.includes(i.dataset.o)) return;
        (r[i.dataset.o] = r[i.dataset.o] || []).push(i.value);
    });
    return r;
}
// Cierre: una subcategoría cumplida también cuenta su objetivo como cumplido
function leerCierre() {
    const cont = $('rCumplidos');
    if (!cont) return { objetivosCumplidos: [], subCumplidos: {} };
    const subs = leerSubs(cont), objs = leerObjetivos(cont);
    Object.keys(subs).forEach(o => { if (!objs.includes(o)) objs.push(o); });
    return { objetivosCumplidos: objs, subCumplidos: subs };
}
const cajaCierre = v => objetivosCierre(v).length ? `<label>Objetivos cumplidos <small>(en negrita lo programado; marca lo que lograste)</small></label>
            <div class="checks" id="rCumplidos">${htmlObjetivos(objetivosCierre(v), { tipo: tiposEfectivos(tiposDe(v), varianteDe(v)), nuevo: varianteDe(v), mes: mesDe(v.fecha), programados: programadosVigentes(v), subsProg: v.subobjetivos || {} })}</div>` : '';
// Texto de subcategorías junto a un objetivo (✓ en las cumplidas)
function textoSubs(v, o) {
    const prog = (v.subobjetivos || {})[o] || [], cumpl = (v.subCumplidos || {})[o] || [];
    const todas = [...prog, ...cumpl.filter(x => !prog.includes(x))];
    return todas.length ? `<small class="sub-chip">: ${todas.map(x => (cumpl.includes(x) ? '✓ ' : '') + esc(x)).join(', ')}</small>` : '';
}


function sugerirTipo() {
    if ($('fTipo').value) return;
    const zona = comercial(agenda.vendedor)?.zona;
    const nombre = $('fContacto').value;
    const c = buscarMaestra(zona, nombre);
    const p = !c && buscarProyecto(zona, nombre);
    if (c) $('fTipo').value = tipoDeCliente(c);
    else if (p) { $('fTipo').value = 'nuevo'; $('fTipoNuevo').value = tipoSugerido(p.tipo); }
    else return;
    cambiarTipoProgramacion();
}

function avisoProgramacion(v) {
    const fecha = $('fFecha').value;
    const fest = fecha && nombreFestivo(fecha);
    $('fFestivo').hidden = !fest;
    $('fFestivo').textContent = fest ? `Festivo · ${fest}` : '';
    const aviso = $('fAviso');
    if (esNovedad(tipoBase())) { aviso.hidden = true; return; }
    const mismaFecha = v && v.fecha === fecha;
    const quedaNoProgramada = mismaFecha ? !esProgramada(v) : fecha && Date.now() >= limiteProgramacion(fecha);
    aviso.hidden = !quedaNoProgramada;
    aviso.textContent = mismaFecha
        ? 'Esta visita quedó como NO programada: se creó después de las 8:00 a. m. del día.'
        : `Ya pasaron las ${HORA_LIMITE} a. m. (hora Colombia) de ese día: la visita queda como NO programada.`;
}

// Fecha cuya advertencia (festivo o novedad) ya se aceptó en este formulario
let advertenciaAceptada = '';

async function guardarProgramada(e, id) {
    e.preventDefault();
    const tipo = tipoBase();
    // Advertencia antes de programar en un festivo o en un día con novedad (vacaciones, incapacidad…):
    // es lo primero que sale al tocar Programar
    const fechaElegida = $('fFecha').value;
    const cambiaDia = !id || registros[id].fecha !== fechaElegida;
    // Si en el formulario se cambió a otra fecha festiva (o con novedad), se pregunta de nuevo al guardar
    if (!esNovedad(tipo) && fechaElegida && cambiaDia && advertenciaAceptada !== fechaElegida) {
        if (!await confirmarDia(fechaElegida)) return;
        advertenciaAceptada = fechaElegida;
    }
    if (!$('fTipo').value) { toast('Elige qué vas a programar'); $('fTipo').focus(); return; }
    if (!fechaElegida) { toast('Elige la fecha'); $('fFecha').focus(); return; }
    if (esNovedad(tipo)) return guardarNovedad(id, tipo);
    if (esTipoVisita($('fTipo').value) && !clienteDelForm()) {
        toast($('fContacto').value.trim() ? 'Ese cliente no está en la Maestra de Contactos. Si es nuevo, elige "Contacto nuevo".' : 'Escoge el cliente de la visita');
        $('fContacto').focus(); return;
    }
    if (origenElegido() === 'nuevo' && !tipo) { toast('Elige el tipo de visita del contacto nuevo'); $('fTipoNuevo').focus(); return; }
    const interno = esTrabajoInterno(tipo);
    const nombre = $('fContacto').value.trim();
    if (!interno && !nombre) { toast('Escribe el contacto de la visita'); return; }
    const objetivos = leerObjetivos($('fObjetivos'));
    const subobjetivos = leerSubs($('fObjetivos'), objetivos);
    if (!objetivos.length) { toast(interno ? 'Escoge al menos un objetivo del trabajo' : 'Escoge al menos un objetivo de la visita'); return; }
    if (!$('fObjetivo').value.trim()) { toast('Escribe qué vas a hacer (máximo 100 caracteres)'); $('fObjetivo').focus(); return; }
    const zona = comercial(agenda.vendedor)?.zona;
    const nuevo = !interno && origenElegido() === 'nuevo';
    let c = interno ? {} : buscarMaestra(zona, nombre) || {};
    let proyecto = nuevo ? buscarProyecto(zona, nombre) : null;
    if (!interno && !nuevo && !c.n) {
        toast('No está en la Maestra de Contactos. Si es un contacto nuevo, elige "Contacto nuevo" en ¿Qué vas a programar?');
        return;
    }
    if (nuevo && c.n) {
        toast('Ese contacto ya está en la Maestra de Contactos: elige la visita en el grupo "Visitas".');
        return;
    }
    // La clasificación del cliente dice en qué tipos de visita sale
    if (!interno && !nuevo && !tiposDeCliente(c).includes(tipo)) {
        toast(`${c.n} (clasificación ${c.cl}) es de ${tiposDeCliente(c).join(' o ')}. Cambia el tipo de visita.`);
        return;
    }
    const tipos = interno || nuevo ? [tipo] : tiposElegidos();
    if (nuevo && !proyecto && $('pTipo').value !== 'Médico' && !$('pPersona').value.trim()) {
        $('pPersona').focus();
        toast('Escribe el nombre de contacto del cliente o punto de venta');
        return;
    }
    if (nuevo) {
        if (!proyecto) {
            proyecto = {
                id: nuevoId(), clase: 'proyecto', estado: 'proyecto', nombre, tipo: $('pTipo').value,
                ciudad: $('pCiudad').value.trim(), telefono: $('pTel').value.trim(),
                persona: $('pPersona').value.trim(), direccion: $('pDir').value.trim(),
                zona, vendedor: agenda.vendedor, fecha: hoy(), creado: new Date().toISOString(), creadoPor: sesion.id
            };
            guardarRegistro(proyecto);
        }
        c = { n: proyecto.nombre, e: 'Contacto nuevo · ' + proyecto.tipo, c: proyecto.ciudad };
    }
    const antes = id ? registros[id] : null;
    const fecha = $('fFecha').value;
    const v = antes ? { ...antes } : {
        id: nuevoId(), clase: 'visita', vendedor: agenda.vendedor, estado: 'pendiente',
        creado: new Date().toISOString(), creadoPor: sesion.id
    };
    Object.assign(v, {
        interno,
        contacto: interno ? tipo : (c.n || nombre), tipoContacto: c.e || '', ciudad: c.c || '',
        esProyecto: !!proyecto, contactoProyecto: proyecto ? proyecto.id : '',
        fecha, hora: $('fHora').value, objetivo: $('fObjetivo').value.trim(),
        modalidad: interno ? '' : modalidadElegida(), tipoVisita: tipos[0], tiposVisita: tipos.length > 1 ? tipos : [], objetivos, subobjetivos,
        // Si cambia de día se vuelve a revisar si alcanzó a programarse antes de las 8:00 a. m.
        programada: antes && antes.fecha === fecha ? esProgramada(antes) : Date.now() < limiteProgramacion(fecha)
    });
    // Visita confirmada desde el Visiplan: cuenta como programada y queda enlazada al plan
    const deplan = !id && confirmandoPlan && confirmandoPlan.fecha === fecha && normalizar(confirmandoPlan.contacto) === normalizar(v.contacto);
    if (deplan) {
        Object.assign(v, { programada: true, origen: 'plan' });
        const pid = idPlan(v.vendedor, mesDe(fecha));
        if (registros[pid]) guardarRegistro({ ...registros[pid], confirmadas: { ...(registros[pid].confirmadas || {}), [clavePlan(confirmandoPlan.contacto, fecha)]: v.id } });
    }
    confirmandoPlan = null;
    guardarRegistro(v);
    cerrarModal();
    toast(id ? 'Programación actualizada' : `${v.contacto}: ${v.programada ? 'programado' : 'registrado como NO programado'}`);
    if (v.fecha !== agenda.fecha) elegirFecha(v.fecha); else pintarAgenda();
}

function guardarNovedad(id, tipo) {
    const desde = $('fFecha').value;
    const porHoras = NOVEDAD_HORAS.includes(tipo) && !$('fDiaCompleto').checked;
    const horaInicio = porHoras ? $('fHoraInicio').value : '', horaFin = porHoras ? $('fHoraFin').value : '';
    if (porHoras && (!horaInicio || !horaFin)) return toast(`Escribe la hora de inicio y la hora de finalización ${tipo === 'Permiso' ? 'del permiso' : 'de la cita médica'}`);
    if (porHoras && horaFin <= horaInicio) return toast('La hora de finalización debe ser después de la hora de inicio');
    const hasta = NOVEDAD_RANGO.includes(tipo) && !porHoras && $('fHasta').value ? $('fHasta').value : desde;
    if (hasta < desde) return toast('La fecha "Hasta" no puede ser antes de "Desde"');
    const n = id ? { ...registros[id] } : { id: nuevoId(), clase: 'novedad', vendedor: agenda.vendedor, creado: new Date().toISOString(), creadoPor: sesion.id };
    Object.assign(n, { tipo, fecha: desde, hasta, nota: $('fObjetivo').value.trim(),
        diaCompleto: NOVEDAD_HORAS.includes(tipo) ? !porHoras : true, horaInicio, horaFin });
    guardarRegistro(n);
    cerrarModal();
    if (!(agenda.fecha >= desde && agenda.fecha <= hasta)) elegirFecha(desde); else pintarAgenda();
    const nombre = nombreVendedor(n.vendedor);
    if (tipo === 'Cumpleaños') dialogo({ tono: 'fiesta', titulo: `¡Disfruta tu día, ${nombre}!`, texto: `Cumpleaños registrado para el ${fechaLarga(desde)}.`, aceptar: 'Gracias', cancelar: '' });
    else if (tipo === 'Vacaciones') dialogo({ tono: 'playa', titulo: `Playa, Brisa y Mar. ¡¡¡Felices Vacaciones!!! ${nombre}`, texto: `Vacaciones registradas: ${rangoNovedad(n)}.`, aceptar: 'Gracias', cancelar: '' });
    else if (tipo === 'Incapacidad') dialogo({ tono: 'salud', titulo: `Recupérate pronto, ${nombre}`, texto: `Incapacidad registrada: ${rangoNovedad(n)}.`, aceptar: 'Gracias', cancelar: '' });
    else if (tipo === 'Cita médica') dialogo({ tono: 'salud', titulo: `Llega a tiempo, no pierdas tu cita, ${nombre}`, texto: `Cita médica registrada: ${rangoNovedad(n)}${n.diaCompleto ? ' (día completo).' : ''}`, aceptar: 'Gracias', cancelar: '' });
    else if (tipo === 'Permiso') dialogo({ tono: 'permiso', titulo: `¡Que te vaya muy bien, ${nombre}!`, texto: `Permiso registrado: ${rangoNovedad(n)}${n.diaCompleto ? ' (día completo).' : ''}`, aceptar: 'Gracias', cancelar: '' });
    else toast(`${tipo} registrado: ${rangoNovedad(n)}`);
}

async function eliminarNovedad(id) {
    if (!await dialogo({ titulo: '¿Eliminar esta novedad?', aceptar: 'Eliminar' })) return;
    borrarRegistro({ ...registros[id] });
    toast('Novedad eliminada');
    pintarAgenda();
}

function tarjetaNovedad(n) {
    return `<div class="producto-card novedad-card">
        <div class="visita-cab"><div><h3>${esc(n.tipo)}</h3></div><span class="chip gris">Novedad</span></div>
        <p class="meta">${esc(rangoNovedad(n))}</p>
        ${n.nota ? `<p>${esc(n.nota)}</p>` : ''}
        <div class="acciones"><button class="link-mini" onclick="abrirProgramar('${n.id}')">Editar</button><button class="link-mini" onclick="eliminarNovedad('${n.id}')">Eliminar</button></div>
    </div>`;
}

async function eliminarVisita(id) {
    if (!esAdmin() || !await dialogo({ titulo: '¿Eliminar esta visita?', texto: 'La visita se borra para todo el equipo.', aceptar: 'Eliminar' })) return;
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
            ${cajaCierre(v)}
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
            ${cajaCierre(v)}
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
            <label for="rProxima">Próxima visita <small>(opcional: queda programada en ese día y en el Visiplan)</small></label>
            <input id="rProxima" type="date" min="${sumarDias(v.fecha, 1)}">
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
        ...leerCierre(),
        gestion: $('rGestion').value,
        atendio: $('rAtendio').value.trim(),
        productos: $('rProductos').value.trim(),
        muestras: $('rMuestras').value.trim(),
        pedido,
        valorPedido: pedido === 'si' ? $('rValor').value : '',
        compromisos: $('rCompromisos').value.trim(),
        observaciones: $('rObs').value.trim(),
        proximaVisita: $('rProxima').value || '',
        registrada: new Date().toISOString()
    };
    guardarRegistro(v);
    if (v.proximaVisita) agendarProxima(v);
    cerrarModal();
    toast(v.proximaVisita ? `Visita registrada · próxima visita el ${fechaCorta(v.proximaVisita)}` : 'Visita registrada');
    pintarAgenda();
}

// La próxima visita queda programada en ese día. En el Visiplan sale en la casilla R en rojo hasta que sea efectiva.
// Si ese día ya estaba planeada, queda como la confirmación del plan (no se duplica).
function agendarProxima(antes) {
    const fecha = antes.proximaVisita;
    const nueva = {
        id: nuevoId(), clase: 'visita', vendedor: antes.vendedor, estado: 'pendiente', origen: 'proxima',
        contacto: antes.contacto, tipoContacto: antes.tipoContacto, ciudad: antes.ciudad,
        esProyecto: !!antes.esProyecto, contactoProyecto: antes.contactoProyecto || '',
        fecha, hora: '', objetivo: antes.compromisos || '', vieneDe: antes.fecha,
        modalidad: antes.modalidad, tipoVisita: antes.tipoVisita, tiposVisita: antes.tiposVisita, objetivos: antes.objetivos || [], interno: false,
        programada: Date.now() < limiteProgramacion(fecha),
        creado: new Date().toISOString(), creadoPor: sesion.id
    };
    guardarRegistro(nueva);
    const plan = planDe(antes.vendedor, mesDe(fecha));
    if (plan && (plan.marcas[antes.contacto] || []).includes(fecha)) {
        guardarRegistro({ ...plan, confirmadas: { ...(plan.confirmadas || {}), [clavePlan(antes.contacto, fecha)]: nueva.id } });
    }
}

// Historial de un cliente: todas sus visitas con el resumen de cada una
function verCliente(nombre, vendedor) {
    const lista = visibles().filter(x => x.clase === 'visita' && !x.interno && normalizar(x.contacto) === normalizar(nombre))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const zona = comercial(vendedor)?.zona;
    const m = buscarMaestra(zona, nombre), p = buscarProyecto(zona, nombre);
    const efectivas = lista.filter(x => x.estado === 'visitado');
    const proxima = lista.filter(x => x.estado === 'pendiente' && x.fecha >= hoy()).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const estadoTxt = { visitado: ['ok', 'Visitado'], no_visitado: ['no', 'No visitado'], pendiente: ['p', 'Pendiente'] };
    const filas = lista.map(x => {
        const [cls, txt] = estadoTxt[x.estado] || ['p', x.estado];
        const partes = x.estado === 'visitado' ? [
            x.gestion ? `<b>${esc(x.gestion)}</b>${x.atendio ? ` · Atendió: ${esc(x.atendio)}` : ''}` : '',
            (x.objetivosCumplidos || []).length ? `Objetivos cumplidos: ${x.objetivosCumplidos.map(o => esc(o) + ((x.subCumplidos || {})[o] ? ` (${x.subCumplidos[o].map(esc).join(', ')})` : '')).join(', ')}` : '',
            x.productos ? `Productos: ${esc(x.productos)}` : '',
            x.muestras ? `Muestras: ${esc(x.muestras)}` : '',
            x.pedido === 'si' ? `Pedido: sí${x.valorPedido ? ' · ' + pesos(x.valorPedido) : ''}` : '',
            x.compromisos ? `Próximos pasos: ${esc(x.compromisos)}` : '',
            x.proximaVisita ? `Próxima visita: ${esc(fechaCorta(x.proximaVisita))}` : '',
            x.observaciones ? esc(x.observaciones) : ''
        ] : x.estado === 'no_visitado' ? [`<b>${esc(x.motivo || '')}</b>`, x.observaciones ? esc(x.observaciones) : ''] : [x.objetivo ? esc(x.objetivo) : ''];
        return `<div class="hist-item ${cls}">
            <div class="hist-cab"><b>${esc(mayuscula(fechaLarga(x.fecha)))}</b><span class="chip ${cls}">${txt}</span></div>
            <p class="meta">${esc([nombreTipo(x), modalidadDe(x), nombreVendedor(x.vendedor)].filter(Boolean).join(' · '))}</p>
            ${partes.filter(Boolean).length ? `<div class="reporte">${partes.filter(Boolean).join('<br>')}</div>` : ''}
        </div>`;
    }).join('');
    abrirModal(`<div class="form-rc ficha historial">
        <h2>${esc(nombre)}</h2>
        <p class="sub">${esc([m?.e || (p ? 'Contacto nuevo · ' + p.tipo : ''), m?.c || p?.ciudad || ''].filter(Boolean).join(' · '))}</p>
        ${m && (m.cl || m.ca) ? `<p class="clasif-cliente">Clasificación <b>${esc(m.cl || '')}</b>${m.ca ? ' · ' + esc(m.ca) : ''}</p>` : ''}
        <div class="resumen-dia hist-resumen">
            <span><b>${lista.length}</b> ${lista.length === 1 ? 'visita' : 'visitas'}</span>
            <span class="chip ok">${efectivas.length} efectivas</span>
            ${efectivas[0] ? `<span class="chip gris">Última: ${esc(fechaCorta(efectivas[0].fecha))}</span>` : ''}
            ${proxima ? `<span class="chip prox">Próxima: ${esc(fechaCorta(proxima.fecha))}</span>` : ''}
        </div>
        ${filas || '<div class="no-results">Todavía no hay visitas registradas para este cliente.</div>'}
        <div class="form-botones"><button type="button" class="btn-primario" onclick="cerrarModal()">Cerrar</button></div>
    </div>`);
}

function guardarInternoRealizado(e, id) {
    e.preventDefault();
    if (!plazoAbierto(id)) return;
    guardarRegistro({ ...registros[id], ...LIMPIAR_NO_VISITADO, estado: 'visitado', observaciones: $('rObs').value.trim(),
        ...leerCierre(), registrada: new Date().toISOString() });
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
            fecha: repro, hora: '', objetivo: antes.objetivo, vieneDe: antes.fecha, origen: 'reprogramada',
            modalidad: antes.modalidad, tipoVisita: antes.tipoVisita, tiposVisita: antes.tiposVisita, objetivos: antes.objetivos, interno: !!antes.interno,
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
    else if (esComercial() && !abrirActividades.yaAbrio) $('actVendedor').value = sesion.id;
    abrirActividades.yaAbrio = true;
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

async function eliminarActividad(id) {
    if (!await dialogo({ titulo: '¿Eliminar esta actividad?', aceptar: 'Eliminar' })) return;
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
    mostrarPantalla('panelScreen');
    pintarPanel();
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

// Filtros del panel: vendedor, tipo de visita y estado (el estado solo filtra el detalle)
const filtroPanel = { vendedor: '', tipo: '', estado: '' };

function iniciarFiltrosPanel() {
    const sel = $('panVend');
    if (sel.options.length) return;
    sel.innerHTML = '<option value="">Todos los vendedores</option>' + COMERCIALES.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
    $('panTipo').innerHTML = '<option value="">Todos los tipos</option>'
        + Object.keys(TIPOS_VISITA).map(t => `<option>${esc(t)}</option>`).join('')
        + '<option value="__interno">Trabajo interno</option>';
}

function filtrarPanel() {
    filtroPanel.vendedor = $('panVend').value;
    filtroPanel.tipo = $('panTipo').value;
    filtroPanel.estado = $('panEstado').value;
    pintarPanel();
}

const pasaFiltro = v => (!filtroPanel.vendedor || v.vendedor === filtroPanel.vendedor)
    && (!filtroPanel.tipo || (filtroPanel.tipo === '__interno' ? v.interno : tiposDe(v).includes(filtroPanel.tipo)));

function pintarPanel() {
    iniciarFiltrosPanel();
    $('panMesTxt').textContent = mayuscula(nombreMes(mesPanel));
    $('panMesSub').textContent = API_URL ? 'Datos de todo el equipo' : 'Solo los datos guardados en este dispositivo';
    const vis = visitasMes(mesPanel).filter(pasaFiltro);
    const acts = actividadesMes(mesPanel, filtroPanel.vendedor);
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

    pintarGraficaDias(vis);
    pintarGraficaTipos(vis);
    pintarGraficaObjetivos(vis);

    const barra = k => `<div class="celda-barra"><span class="barra"><i class="ok" style="width:${k.prog ? k.okProg / k.prog * 100 : 0}%"></i></span><b>${pct(k)}</b></div>`;
    const vendedores = COMERCIALES.filter(v => !filtroPanel.vendedor || v.id === filtroPanel.vendedor);

    // Indicador del día: lo programado antes de las 8:00 a. m. frente a lo que se agregó después
    const t = hoy();
    const deHoy = visibles().filter(x => x.clase === 'visita' && x.fecha === t).filter(pasaFiltro);
    $('panHoyTxt').textContent = mayuscula(fechaLarga(t)) + (nombreFestivo(t) ? ` · Festivo: ${nombreFestivo(t)}` : '');
    $('panHoy').innerHTML = `<thead><tr><th>Vendedor</th><th class="n">Prog.</th><th class="n">No prog.</th><th class="n">Visit.</th><th class="n">No visit.</th><th class="n">Pend.</th><th class="n">Trab. interno</th></tr></thead><tbody>`
        + vendedores.map(v => {
            const k = cuentaVisitas(deHoy.filter(x => x.vendedor === v.id));
            const nov = novedadesDe(v.id, t)[0];
            return `<tr><td><b>${esc(v.nombre)}</b><small>${esc(v.zona)}</small>${nov ? `<span class="chip gris">${esc(nov.tipo)}</span>` : ''}</td>
                <td class="n">${k.prog}</td><td class="n${k.noProg ? ' alerta' : ''}">${k.noProg}</td><td class="n">${k.ok}</td><td class="n">${k.no}</td><td class="n">${k.p}</td><td class="n">${k.internos}</td></tr>`;
        }).join('') + '</tbody>';

    $('panTabla').innerHTML = `<thead><tr><th>Vendedor</th><th class="n">Prog.</th><th class="n">No prog.</th><th class="n">Visit.</th><th class="n">No visit.</th><th class="n">Pend.</th><th class="n">Virtual</th><th class="n">Pedidos</th><th>Cumplimiento</th><th class="n">Actividades</th></tr></thead><tbody>`
        + vendedores.map(v => {
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

    // Detalle de cada visita (más recientes primero)
    const det = vis.filter(v => !filtroPanel.estado || v.estado === filtroPanel.estado)
        .sort((a, b) => b.fecha.localeCompare(a.fecha) || ordenCita(a, b));
    $('panDetTxt').textContent = `${det.length} ${det.length === 1 ? 'registro' : 'registros'}`;
    $('panDetalle').innerHTML = det.length ? det.map(v => {
        const est = v.estado === 'visitado' ? `<span class="chip ok">${v.interno ? 'Realizado' : 'Visitado'}</span>`
            : v.estado === 'no_visitado' ? `<span class="chip no">${v.interno ? 'No realizado' : 'No visitado'}</span>` : '<span class="chip p">Pendiente</span>';
        const cumpl = v.estado === 'visitado' && v.objetivos?.length ? ` · ${cumplidosProgramados(v).length}/${v.objetivos.length} objetivos` : '';
        return `<button class="fila-det" onclick="verDetalleVisita('${v.id}')">
            <span class="fd-fecha">${esc(fechaCorta(v.fecha))}${v.hora ? `<small>${esc(horaBonita(v.hora))}</small>` : ''}</span>
            <span class="fd-cuerpo"><b>${esc(v.contacto)}</b><small>${esc(nombreVendedor(v.vendedor))} · ${esc(v.interno ? 'Trabajo interno' : nombreTipo(v))}${cumpl}${esProgramada(v) ? '' : ' · No programada'}${v.esProyecto ? ' · Proyecto' : ''}</small></span>
            ${est}
        </button>`;
    }).join('') : '<p class="no-results" style="padding:10px">No hay visitas con estos filtros.</p>';
}

// ---------- GRÁFICAS DEL PANEL (SVG) ----------
// Estados: verde = visitado, rojo = no visitado, gris = pendiente (validados para daltonismo con separación de 2px y leyenda)
const COLOR = { ok: '#0a6647', no: '#e66a5f', p: '#b9c4bf', obj: '#9fd3bd', objOk: '#0a6647', tipo: '#009460' };

function pintarGraficaDias(vis) {
    const dias = Number(finDeMes(mesPanel).slice(8));
    const datos = [];
    for (let d = 1; d <= dias; d++) {
        const f = `${mesPanel}-${String(d).padStart(2, '0')}`;
        const k = cuentaVisitas(vis.filter(v => v.fecha === f));
        datos.push({ f, d, ok: k.ok, no: k.no, p: k.p });
    }
    const max = Math.max(4, ...datos.map(x => x.ok + x.no + x.p));
    const paso = max <= 6 ? 2 : max <= 12 ? 3 : Math.ceil(max / 4);
    const tope = Math.ceil(max / paso) * paso;
    const W = anchoGrafica('grafDias'), H = 220, izq = 30, der = 8, arr = 12, abj = 26;
    const ancho = (W - izq - der) / dias;
    const barra = Math.min(16, ancho - 4);
    const y = v => arr + (H - arr - abj) * (1 - v / tope);
    let svg = '';
    for (let v = 0; v <= tope; v += paso) {
        svg += `<line x1="${izq}" x2="${W - der}" y1="${y(v)}" y2="${y(v)}" class="g-grid"/><text x="${izq - 6}" y="${y(v) + 4}" class="g-eje" text-anchor="end">${v}</text>`;
    }
    datos.forEach((x, i) => {
        const cx = izq + ancho * i + (ancho - barra) / 2;
        let base = y(0);
        const tramos = [['ok', x.ok], ['no', x.no], ['p', x.p]].filter(t => t[1] > 0);
        tramos.forEach(([clave, n], j) => {
            const alto = y(0) - y(n);
            const ultimo = j === tramos.length - 1;
            const hueco = j > 0 ? 2 : 0;
            svg += ultimo ? rectRedondo(cx, base - alto + hueco, barra, alto - hueco, COLOR[clave]) : `<rect x="${cx}" y="${base - alto + hueco}" width="${barra}" height="${Math.max(0, alto - hueco)}" fill="${COLOR[clave]}"/>`;
            base -= alto;
        });
        const tip = `${fechaCorta(x.f)}: ${x.ok} visitadas · ${x.no} no visitadas · ${x.p} pendientes`;
        svg += `<rect x="${izq + ancho * i}" y="${arr}" width="${ancho}" height="${H - arr - abj}" fill="transparent" data-tip="${esc(tip)}"/>`;
        if (x.d === 1 || x.d % 5 === 0) svg += `<text x="${cx + barra / 2}" y="${H - 8}" class="g-eje" text-anchor="middle">${x.d}</text>`;
    });
    $('grafDias').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Visitas por día del mes">${svg}</svg>`;
}

// Las gráficas se dibujan al ancho real del contenedor para que el texto no se achique en el celular
const anchoGrafica = id => Math.max(300, Math.round($(id).clientWidth || 640));
let esperaResize;
window.addEventListener('resize', () => {
    clearTimeout(esperaResize);
    esperaResize = setTimeout(() => { if (pantallaActiva() === 'panelScreen') pintarPanel(); }, 200);
});

// Barra con el extremo de dato redondeado (4px) y la base recta
function rectRedondo(x, yTop, w, h, color, horizontal) {
    if (h <= 0 || w <= 0) return '';
    const r = Math.min(4, horizontal ? h / 2 : w / 2, horizontal ? w : h);
    if (horizontal) return `<path d="M${x},${yTop} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${w - r} z" fill="${color}"/>`;
    return `<path d="M${x},${yTop + h} v-${h - r} a${r},${r} 0 0 1 ${r},-${r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z" fill="${color}"/>`;
}

// Barras horizontales con la etiqueta a la izquierda y el valor en la punta
function barrasHorizontales(contenedor, filas, anchoEtiqueta = 150) {
    if (!filas.length) return '<p class="no-results" style="padding:10px">Sin datos en este periodo.</p>';
    const max = Math.max(...filas.map(f => f.total), 1);
    const W = anchoGrafica(contenedor), alto = 30, H = filas.length * alto + 6, izq = anchoEtiqueta, der = 40;
    const x = v => (W - izq - der) * v / max;
    let svg = '';
    filas.forEach((f, i) => {
        const yb = i * alto + 6, g = 16;
        svg += `<text x="${izq - 8}" y="${yb + g - 3}" class="g-etq" text-anchor="end">${esc(f.nombre)}</text>`;
        svg += rectRedondo(izq, yb, x(f.total), g, f.color || COLOR.tipo, true);
        if (f.parte) svg += f.parte >= f.total ? rectRedondo(izq, yb, x(f.parte), g, COLOR.objOk, true)
            : `<rect x="${izq}" y="${yb}" width="${Math.max(0, x(f.parte) - 2)}" height="${g}" fill="${COLOR.objOk}"/>`;
        svg += `<text x="${izq + x(f.total) + 6}" y="${yb + g - 3}" class="g-valor">${f.etiqueta ?? f.total}</text>`;
        svg += `<rect x="0" y="${yb - 4}" width="${W}" height="${alto}" fill="transparent" data-tip="${esc(f.tip || `${f.nombre}: ${f.total}`)}"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${svg}</svg>`;
}

function pintarGraficaTipos(vis) {
    const filas = [...Object.keys(TIPOS_VISITA), 'Trabajo interno'].map(t => {
        const lista = vis.filter(v => t === 'Trabajo interno' ? v.interno : tiposDe(v).includes(t));
        const ok = lista.filter(v => v.estado === 'visitado').length;
        return { nombre: t, total: lista.length, tip: `${t}: ${lista.length} programadas · ${ok} ${t === 'Trabajo interno' ? 'realizadas' : 'visitadas'}` };
    }).filter(f => f.total > 0);
    $('grafTipos').innerHTML = barrasHorizontales('grafTipos', filas, 150);
}

function pintarGraficaObjetivos(vis) {
    const cuenta = {};
    vis.filter(v => !v.interno).forEach(v => (v.objetivos || []).forEach(o => {
        cuenta[o] = cuenta[o] || { total: 0, parte: 0 };
        cuenta[o].total++;
        if (v.estado === 'visitado' && (v.objetivosCumplidos || []).includes(o)) cuenta[o].parte++;
    }));
    const filas = Object.entries(cuenta).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
        .map(([o, k]) => ({ nombre: o, total: k.total, parte: k.parte, color: COLOR.obj, etiqueta: `${k.parte}/${k.total}`,
            tip: `${o}: programado ${k.total} ${k.total === 1 ? 'vez' : 'veces'} · cumplido ${k.parte}` }));
    $('grafObjetivos').innerHTML = barrasHorizontales('grafObjetivos', filas, 170);
}

// Tooltip de las gráficas
document.addEventListener('pointermove', e => {
    const t = $('tooltip');
    if (!t) return;
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { t.classList.remove('visible'); return; }
    t.textContent = el.dataset.tip;
    t.classList.add('visible');
    const x = Math.min(e.clientX + 12, window.innerWidth - t.offsetWidth - 8);
    t.style.left = Math.max(8, x) + 'px';
    t.style.top = (e.clientY - t.offsetHeight - 12) + 'px';
});

// Ficha completa de una visita (solo lectura)
function verDetalleVisita(id) {
    const v = registros[id];
    const fila = (t, x) => x ? `<strong>${t}</strong><p>${esc(x)}</p>` : '';
    const estado = v.estado === 'visitado' ? (v.interno ? 'Realizado' : 'Visitado') : v.estado === 'no_visitado' ? (v.interno ? 'No realizado' : 'No visitado') : 'Pendiente';
    const cumplidos = v.objetivosCumplidos || [];
    abrirModal(`<div class="form-rc ficha">
        <h2>${esc(v.contacto)}</h2>
        <p class="sub">${esc(nombreVendedor(v.vendedor))} · ${esc(mayuscula(fechaLarga(v.fecha)))}${v.hora ? ' · Cita ' + esc(horaBonita(v.hora)) : ''}</p>
        <div class="marcas"><span class="chip ${v.estado === 'visitado' ? 'ok' : v.estado === 'no_visitado' ? 'no' : 'p'}">${estado}</span>
            ${v.interno ? '<span class="chip gris">Trabajo interno</span>' : `<span class="chip ${v.modalidad === 'virtual' ? 'azul' : 'gris'}">${modalidadDe(v)}</span>`}
            ${esProgramada(v) ? '' : '<span class="chip np">No programada</span>'}${v.esProyecto ? '<span class="chip proy">Proyecto</span>' : ''}</div>
        ${fila('Contacto', [v.tipoContacto, v.ciudad].filter(Boolean).join(' · '))}
        ${v.tipoVisita && v.objetivos?.length ? `<strong>${esc(nombreTipo(v))} · objetivos</strong><p class="objetivos">${(v.objetivos || []).map(o => `<span class="${v.estado === 'visitado' ? (cumplidos.includes(o) ? 'cumplido' : 'no-cumplido') : ''}">${v.estado === 'visitado' && cumplidos.includes(o) ? '✓ ' : ''}${esc(o)}</span>`).join('')}</p>` : ''}
        ${fila('Notas de la programación', v.objetivo)}
        ${fila('Qué se hizo', v.gestion)}${fila('Atendió', v.atendio)}${fila('Productos presentados', v.productos)}${fila('Muestras', v.muestras)}
        ${v.pedido === 'si' ? fila('Pedido', 'Sí' + (v.valorPedido ? ' · ' + pesos(v.valorPedido) : '')) : ''}
        ${fila('Compromisos', v.compromisos)}${fila('Motivo', v.motivo)}
        ${v.reprogramadaPara ? fila('Reprogramada para', fechaCorta(v.reprogramadaPara)) : ''}
        ${fila('Observaciones', v.observaciones)}
        ${v.estado !== 'pendiente' ? fila('Cierre', v.cierreAutomatico ? 'Automático: no se reportó a tiempo' : 'Reportada el ' + fechaHora(v.registrada)) : fila('Plazo de reporte', textoCierre(v))}
    </div>`);
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
        const quien = vend ? nombreVendedor(vend).replace(/\s+/g, '_') : 'Equipo';
        bajarArchivo(buffer, `Visitas_${quien}_${mes}.xlsx`);
        cerrarModal();
        toast('Informe descargado');
    } catch (err) {
        console.error(err);
        toast('No se pudo generar el Excel. Revisa tu conexión e intenta de nuevo.');
        boton.disabled = false;
        boton.textContent = 'Descargar Excel';
    }
}

const textoSubsExcel = m => Object.entries(m || {}).filter(([, l]) => l.length).map(([o, l]) => `${o}: ${l.join(', ')}`).join(' · ');

function bajarArchivo(buffer, nombre) {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function armarLibro(mes, vend, solo) {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Epithelium Visita';
    const verde = 'FF006B4F';
    const estadoTxt = { visitado: 'Visitado', no_visitado: 'No visitado', pendiente: 'Pendiente' };
    // ExcelJS guarda las fechas en UTC: se arman en UTC para que no se corran de día
    const fecha = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
    // vend: un vendedor, varios (lista, solo para el Visiplan) o todos ('')
    const varios = Array.isArray(vend) ? vend : null;
    const vendedores = varios ? COMERCIALES.filter(c => varios.includes(c.id)) : vend ? COMERCIALES.filter(c => c.id === vend) : COMERCIALES;
    if (varios) vend = '';
    const vis = visitasMes(mes, vend).sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenCita(a, b));
    const acts = actividadesMes(mes, vend).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

    const hoja = nombre => {
        const h = libro.addWorksheet(nombre, { views: [{ showGridLines: false, state: 'frozen', ySplit: 3 }] });
        h.getCell('A1').value = `${nombre} · ${nombreMes(mes)}`;
        h.getCell('A1').font = { bold: true, size: 14, color: { argb: verde } };
        h.getCell('A2').value = varios ? vendedores.map(c => c.nombre).join(', ') : vend ? `${nombreVendedor(vend)} · ${comercial(vend).zona}` : 'Todo el equipo';
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

    if (solo === 'visiplan') { hojaVisiplan(); return libro; }

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
        { t: 'Tipo de visita', w: 26 }, { t: 'Objetivos', w: 36, wrap: true }, { t: 'Subcategorías programadas', w: 40, wrap: true },
        { t: 'Objetivos cumplidos', w: 36, wrap: true }, { t: 'Subcategorías cumplidas', w: 40, wrap: true },
        { t: '% objetivos', w: 12, f: '0%' }, { t: 'Contacto proyecto', w: 12 }, { t: 'Notas', w: 30, wrap: true }, { t: 'Estado', w: 13 },
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
        esProgramada(v) ? 'Sí' : 'No', v.interno ? '' : modalidadDe(v), nombreTipo(v), (v.objetivos || []).join(', '), textoSubsExcel(v.subobjetivos),
        v.estado === 'visitado' ? (v.objetivosCumplidos || []).join(', ') : '', v.estado === 'visitado' ? textoSubsExcel(v.subCumplidos) : '',
        v.estado === 'visitado' && v.objetivos?.length ? cumplidosProgramados(v).length / v.objetivos.length : null,
        v.esProyecto ? 'Sí' : v.eraProyecto ? 'Vinculado' : '', v.objetivo || '',
        (v.interno ? { visitado: 'Realizado', no_visitado: 'No realizado' }[v.estado] : null) || estadoTxt[v.estado] || v.estado, v.gestion || '', v.atendio || '', v.productos || '', v.muestras || '',
        v.pedido === 'si' ? 'Sí' : v.estado === 'visitado' ? 'No' : '', v.valorPedido ? Number(v.valorPedido) : null,
        v.compromisos || '', v.motivo || '', fecha(v.reprogramadaPara), v.observaciones || '',
        v.estado === 'pendiente' ? null : horaCol(v.registrada),
        v.estado === 'pendiente' ? '' : v.cierreAutomatico ? 'Automático' : 'Vendedor',
        horaCol(new Date(limiteCierre(v)).toISOString())
    ]));

    // Novedades (vacaciones, incapacidades, permisos, cumpleaños) que tocan el mes
    const hn = hoja('Novedades');
    const colsN = [{ t: 'Vendedor', w: 22 }, { t: 'Novedad', w: 16 }, { t: 'Desde', w: 12, f: 'dd/mm/yyyy' }, { t: 'Hasta', w: 12, f: 'dd/mm/yyyy' },
        { t: 'Día completo', w: 13 }, { t: 'Hora de inicio', w: 14 }, { t: 'Hora de finalización', w: 18 },
        { t: 'Días', w: 8 }, { t: 'Detalle', w: 40, wrap: true }];
    const iniMes = mes + '-01', finMes = finDeMes(mes);
    const listaN = visibles().filter(n => n.clase === 'novedad' && (!vend || n.vendedor === vend) && n.fecha <= finMes && (n.hasta || n.fecha) >= iniMes)
        .sort((x, y) => x.fecha.localeCompare(y.fecha));
    tabla(hn, 'TablaNovedades', colsN, listaN.map(n => [nombreVendedor(n.vendedor), n.tipo, fecha(n.fecha), fecha(n.hasta || n.fecha),
        esPorHoras(n) ? 'No' : 'Sí', esPorHoras(n) ? horaBonita(n.horaInicio) : '', esPorHoras(n) ? horaBonita(n.horaFin) : '',
        Math.round((deIso(n.hasta || n.fecha) - deIso(n.fecha)) / 86400000) + 1, n.nota || '']));

    // Visiplan: formato mensual con fila Plan y fila Real por cliente, indicadores y totales por día
    function hojaVisiplan() {
    const hv = hoja('Visiplan');
    const diasV = diasDelMes(mes);
    const colsVP = [{ t: 'Vendedor', w: 20 }, { t: 'Tipo de cliente', w: 16 }, { t: 'Etiqueta', w: 26 }, { t: 'Cliente', w: 34 }, { t: 'Seguimiento', w: 12 },
        ...diasV.map(d => ({ t: `${DIAS[deIso(d).getDay()][0]} ${deIso(d).getDate()}`, w: 5 })),
        { t: 'Obj', w: 8 }, { t: 'Real', w: 8 }, { t: '% Cump', w: 10, f: '0%' }, { t: '% Visitas', w: 11, f: '0%' }];
    const filasVP = [], rojas = [];
    const pctX = (r, p) => p ? Math.round(r / p * 100) / 100 : null;
    const tot = diasV.map(() => ({ o: 0, r: 0, c: 0 }));
    vendedores.forEach(ven => {
        const { marcas, reales, proximas } = seguimientoPlan(ven.id, mes);
        const etiquetaDe = n => (contactos[ven.zona] || []).find(c => c.n === n)?.e || (buscarProyecto(ven.zona, n) ? 'Contacto nuevo' : '');
        const tipoDe = n => buscarProyecto(ven.zona, n)?.tipo || tipoSugerido(etiquetaDe(n)) || 'Visita Comercial';
        [...new Set([...Object.keys(marcas), ...Object.keys(reales), ...Object.keys(proximas)])].sort((a, b) => a.localeCompare(b)).forEach(n => {
            const ds = marcas[n] || [], r = reales[n] || new Set(), px = proximas[n] || new Set();
            const k = indicadoresPlan(ds, r);
            diasV.forEach((d, i) => { if (ds.includes(d)) tot[i].o++; if (r.has(d)) tot[i].r++; if (ds.includes(d) && r.has(d)) tot[i].c++; });
            const ind = [k.obj, k.real, pctX(k.cump, k.obj), pctX(k.real, k.obj)];
            filasVP.push([ven.nombre, tipoDe(n), etiquetaDe(n), n, 'Plan', ...diasV.map(d => ds.includes(d) ? 'X' : ''), ...ind]);
            filasVP.push([ven.nombre, tipoDe(n), etiquetaDe(n), n, 'Real', ...diasV.map((d, i) => {
                if (r.has(d)) return 'X';
                if (px.has(d)) { rojas.push([filasVP.length + 4, i + 6]); return 'X'; }
                return '';
            }), ...ind]);
        });
    });
    tabla(hv, 'TablaVisiplan', colsVP, filasVP);
    diasV.forEach((d, i) => { hv.getColumn(i + 6).alignment = { horizontal: 'center' }; });
    // Programado en azul, real en verde y reprogramado (aún no efectivo) en rojo, como en la app
    hv.eachRow(fila => {
        const seg = fila.getCell(5).value;
        if (seg !== 'Plan' && seg !== 'Real') return;
        const color = seg === 'Plan' ? 'FF1D4ED8' : 'FF15803D';
        fila.getCell(5).font = { bold: true, color: { argb: color } };
        diasV.forEach((d, i) => { const c = fila.getCell(i + 6); if (c.value === 'X') c.font = { bold: true, color: { argb: color } }; });
    });
    rojas.forEach(([f, c]) => { hv.getRow(f).getCell(c).font = { bold: true, color: { argb: 'FFDC2626' } }; });
    // Totales por día (suma vertical) debajo de la tabla
    if (filasVP.length) {
        const T = tot.reduce((a, x) => ({ o: a.o + x.o, r: a.r + x.r, c: a.c + x.c }), { o: 0, r: 0, c: 0 });
        const base = 3 + filasVP.length + 2, n = diasV.length;
        [['Obj del día', tot.map(x => x.o || null), 'FF1D4ED8', false], ['Real del día', tot.map(x => x.r || null), 'FF15803D', false],
         ['% Cump del día', tot.map(x => pctX(x.c, x.o)), 'FF1D4ED8', true], ['% Visitas del día', tot.map(x => pctX(x.r, x.o)), 'FF1D4ED8', true]].forEach(([t, vals, color, esPct], k) => {
            const fila = hv.getRow(base + k);
            fila.getCell(4).value = t;
            vals.forEach((v, i) => { const c = fila.getCell(6 + i); c.value = v; if (esPct) c.numFmt = '0%'; });
            fila.font = { bold: true, color: { argb: color } };
        });
        const fila = hv.getRow(base + 5);
        fila.getCell(4).value = 'Total del mes';
        [T.o, T.r, pctX(T.c, T.o), pctX(T.r, T.o)].forEach((v, i) => { const c = fila.getCell(n + 6 + i); c.value = v; if (i > 1) c.numFmt = '0%'; });
        fila.font = { bold: true, color: { argb: verde } };
        const conv = hv.getRow(base + 7);
        conv.getCell(4).value = 'Convenciones: X azul = programada · X verde = visita real (efectiva) · X roja = reprogramada / próxima visita, pasa a verde al visitarla (no suma mientras tanto)';
        conv.getCell(4).font = { italic: true, color: { argb: 'FF666666' } };
    }
    }
    // Visiplan con el mismo formato de la pantalla (planeados o visitados del mes)
    conVisiplanDe(mes, vendedores.map(c => c.id), () => libroVisiplanPantalla(libro));

    // Contactos proyecto
    const hp = hoja('Proyectos');
    const colsP = [
        { t: 'Contacto', w: 32 }, { t: 'Tipo', w: 16 }, { t: 'Nombre de contacto', w: 24 }, { t: 'Dirección', w: 30 },
        { t: 'Ciudad', w: 16 }, { t: 'Teléfono', w: 14 }, { t: 'Vendedor', w: 20 },
        { t: 'Creado', w: 12, f: 'dd/mm/yyyy' }, { t: 'Visitas', w: 9 }, { t: 'Estado', w: 22 }, { t: 'Solicitud de creación', w: 17, f: 'dd/mm/yyyy hh:mm' },
        { t: 'Observaciones solicitud', w: 34, wrap: true }, { t: 'Creado en la Maestra como', w: 32 }
    ];
    const listaP = proyectos().filter(p => !vend || p.vendedor === vend).sort((x, y) => x.nombre.localeCompare(y.nombre));
    tabla(hp, 'TablaProyectos', colsP, listaP.map(p => [
        p.nombre, p.tipo, p.persona || '', p.direccion || '', p.ciudad || '', p.telefono || '', nombreVendedor(p.vendedor), fecha(p.fecha),
        visibles().filter(v => v.clase === 'visita' && v.contactoProyecto === p.id).length,
        ESTADO_PROYECTO[p.estado] || p.estado, p.solicitud ? horaCol(p.solicitud.fecha) : null, p.solicitud?.nota || '', p.vinculadoA || ''
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

// ---------- DIÁLOGOS ----------
// Ventana de confirmación propia: confirm() y prompt() no salen en algunos celulares o apps
// Devuelve true/false (o el texto escrito si se pide un campo, null si se cancela)
function dialogo({ titulo = '', texto = '', aceptar = 'Aceptar', cancelar = 'Cancelar', campo = '', tono = '' }) {
    return new Promise(resolve => {
        const d = $('dialogo');
        d.className = 'dialogo visible ' + tono;
        d.innerHTML = `<div class="dialogo-caja" role="alertdialog" aria-modal="true" aria-labelledby="dialogoTitulo">
            ${tono === 'fiesta' ? '<div class="dialogo-icono">🎂</div>' : tono === 'salud' ? '<div class="dialogo-icono">💚</div>' : tono === 'playa' ? '<div class="dialogo-icono">🏖️</div>' : tono === 'permiso' ? '<div class="dialogo-icono">🕒</div>' : tono === 'aviso' ? '<div class="dialogo-icono">📅</div>' : ''}
            ${titulo ? `<h3 id="dialogoTitulo">${esc(titulo)}</h3>` : ''}
            ${texto ? `<p>${esc(texto).replace(/\n/g, '<br>')}</p>` : ''}
            ${campo ? `<textarea id="dialogoCampo" placeholder="${esc(campo)}"></textarea>` : ''}
            <div class="form-botones">
                ${cancelar ? `<button type="button" class="btn-secundario" data-r="0">${esc(cancelar)}</button>` : ''}
                <button type="button" class="btn-primario" data-r="1">${esc(aceptar)}</button>
            </div>
        </div>`;
        d.onclick = e => {
            const b = e.target.closest('[data-r]');
            if (!b) return;
            const ok = b.dataset.r === '1';
            const valor = campo ? $('dialogoCampo').value : null;
            d.className = 'dialogo';
            d.innerHTML = '';
            resolve(campo ? (ok ? valor : null) : ok);
        };
        (d.querySelector('textarea') || d.querySelector('[data-r="1"]')).focus();
    });
}

// ---------- MODAL ----------
function abrirModal(html, tema = '') {
    const caja = document.querySelector('#modal .modal-content');
    caja.classList.remove('theme-rojo', 'theme-azul');
    if (tema) caja.classList.add(tema);
    $('modalContenido').innerHTML = html;
    marcarObligatorios($('modalContenido'));
    $('modal').classList.add('active');
}

// Campos obligatorios de escribir: asterisco rojo en su etiqueta (antes de la aclaración en letra pequeña)
const REQ = '<span class="req" title="Obligatorio">*</span>';
function marcarObligatorios(raiz) {
    raiz.querySelectorAll('input[required]:not([type=date]):not([type=month]):not([type=checkbox]):not([type=radio]), textarea[required]').forEach(campo => {
        const lbl = campo.id && raiz.querySelector(`label[for="${campo.id}"]`);
        if (!lbl || lbl.querySelector('.req')) return;
        const chico = lbl.querySelector('small');
        chico ? chico.insertAdjacentHTML('beforebegin', REQ + ' ') : lbl.insertAdjacentHTML('beforeend', ' ' + REQ);
    });
}

function cerrarModal() {
    $('modal').classList.remove('active');
    $('modalContenido').innerHTML = '';
}

window.onclick = e => { if (e.target === $('modal')) cerrarModal(); };
