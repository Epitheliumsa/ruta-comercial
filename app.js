// CONFIGURACIÓN
// URL de la aplicación web de Google Apps Script (ver backend/Codigo.gs).
// Vacía = los datos se guardan solo en este dispositivo.
// Versión publicada: al cambiar, la app ofrece actualizarse (se genera junto con version.txt)
const APP_VERSION = '202609300755';
const API_URL = 'https://script.google.com/macros/s/AKfycbwji7WhPpF2VhCRQETWXNFhF2PTAL8JP8z9SW-stsKdnjbyBa-KVucGCvm6seoTFLfl3Q/exec';

// Zona de un vendedor que todavía no tiene zona: no trae contactos de la Maestra (todo lo que programe queda como contacto nuevo)
const ZONA_POR_ASIGNAR = 'Zona por asignar';

// Usuarios: la clave no se guarda aquí, solo su huella SHA-256 de "usuario:clave" (en minúsculas).
// cumple = fecha de nacimiento (AAAA-MM-DD): al crear un comercial se pide siempre; su día sale en morado en el Visiplan
const USUARIOS = [
    { usuario: 'L.Ramos',     huella: 'afecd958a07662fa1c466a63fa799f91873a1371f878dc6e4bd6c35ffce87617', tipo: 'comercial', id: 'lramos',     nombre: 'Lizeth Ramos',      zona: 'Zona Norte', cumple: '1992-02-16' },
    { usuario: 'Y.Caballero', huella: 'df5769c03aec2c0300cd912335962a57617271fa86e0ef852d5d959895c6ecab', tipo: 'comercial', id: 'ycaballero', nombre: 'Yunelis Caballero', zona: 'Zona Sur', cumple: '1989-03-26' },
    { usuario: 'J.Herrera',   huella: '564177c2a1926013ea79ab83b4bbfe0c3f44fb9585eda1c407504de6424f24c0', tipo: 'comercial', id: 'jherrera',   nombre: 'Jennifer Herrera',  zona: 'Clientes Especiales', cumple: '1988-04-03', jefe: true, cargo: 'Coordinadora Comercial' },
    { usuario: 'M.Castro',    huella: '2b2ebf7f55852620d6c6b80fd886a502c3ffa470d4eae22dcad0fe2dfd5b1d88', tipo: 'comercial', id: 'mcastro',    nombre: 'M. Castro',         zona: ZONA_POR_ASIGNAR, cumple: '1999-07-09' },
    { usuario: 'H.Reyes',     huella: '0213f79c165b6d4bee6bd9eab719817266af1fc9a45ed22cadfccda60f0a122d', tipo: 'jefe',      id: 'hreyes',     nombre: 'Hernán Reyes', cumple: '1975-01-16', admin: true, cargo: 'Gerente General' }
];
const COMERCIALES = USUARIOS.filter(u => u.tipo === 'comercial');
const esCumple = (id, d) => { const u = USUARIOS.find(x => x.id === id); return !!u?.cumple && u.cumple.slice(5) === d.slice(5); };

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
// datos/Matriz_App.xlsx (skill "matriz": herramientas/matriz_app.py). No se editan aquí.
const MATRIZ = window.MATRIZ_OBJETIVOS || { objetivos: {}, subcategorias: {}, variables: [], mensual: {} };
const TIPOS_VISITA = Object.fromEntries(['Visita Médica', 'Visita Cliente', 'Punto de Venta'].map(t => [t, MATRIZ.objetivos[t] || []]));
// "Visita Médica Comercial": solo para clientes 20 y 21 (médicos que también compran), con sus propios objetivos
// en la matriz (columna "Visita Médica Comercial", clave medcom:Visita Médica). nuevo = contacto nuevo.
const VMC = 'Visita Médica Comercial';
const claveTipo = (tipo, nuevo) => tipo === VMC ? 'medcom:Visita Médica' : (nuevo && TIPOS_VISITA[tipo] ? 'nuevo:' : '') + tipo;
// Tipos que salen en informes y filtros (incluye la Visita Médica Comercial)
// "Otros" (antes "Visita personalizada"): último objetivo de las visitas, en rojo; se escribe cuál es (máx. 50 caracteres)
const PERSONALIZADA = 'Otros';
const TIPOS_REPORTE = () => [...Object.keys(TIPOS_VISITA), VMC];
const objetivosDeTipo = (tipo, nuevo) => MATRIZ.objetivos[claveTipo(tipo, nuevo)] || [];
// Una visita puede ser de varios tipos a la vez (Visita Médica y Visita Cliente, según la clasificación del cliente)
const listaTipos = t => (Array.isArray(t) ? t : [t]).filter(Boolean);
const tiposDe = v => v.tiposVisita?.length ? v.tiposVisita : listaTipos(v.tipoVisita);
const nombreTipo = v => tiposDe(v).join(' + ');
// Varios tipos a la vez (Visita Médica y Visita Médica Comercial): una sola lista unida, en orden alfabético
const objetivosDeTipos = (tipos, nuevo) => {
    const ts = listaTipos(tipos), todos = [...new Set(ts.flatMap(t => objetivosDeTipo(t, nuevo)))];
    return ts.length > 1 ? todos.sort((a, b) => normalizar(a).localeCompare(normalizar(b), 'es')) : todos;
};
// Tipos de visita en que sale un cliente según su clasificación (hoja "Tipo de visita" de datos/Matriz_App.xlsx).
// Sin clasificación o sin marcar en la matriz: sale en todos.
const tiposDeCliente = c => (MATRIZ.tiposPorClasificacion || {})[c?.cl] || Object.keys(TIPOS_VISITA);
const AMBOS_TIPOS = ['Visita Médica', 'Visita Cliente'];
// Lo que se marca al lado del cliente 20 o 21: Visita Médica, Visita Médica Comercial o ambas
const OPCIONES_2021 = ['Visita Médica', VMC];
const permiteAmbos = c => !!c && AMBOS_TIPOS.every(t => tiposDeCliente(c).includes(t));
// Subcategorías variables (Parrilla Promocional, Actividades): las del mes que cargue un jefe en la app o, si no, las del archivo
const esVariable = o => (MATRIZ.variables || []).includes(o);
const idMensual = mes => `mensual-${mes}`;
const listasDelMes = mes => {
    const r = registros[idMensual(mes)];
    return r && !r.borrado ? r.listas || {} : (MATRIZ.mensual || {})[mes] || {};
};
function unirListas(listas) {
    const base = [...listas].sort((a, b) => b.length - a.length)[0] || [];
    return [...base, ...listas.flat().filter((x, i, arr) => !base.includes(x) && arr.indexOf(x) === i)];
}
const subcategoriasDe = (tipo, nuevo, objetivo, mes) => objetivo === 'Actividades' && CIRCULARES.length
    ? circularesDelCliente(ctxCircular.cliente, ctxCircular.fecha).filter(esActividadCliente).map(etiquetaCircular)
    : objetivo === 'Parrilla Promocional' && parrillaCircular().length ? parrillaCircular()
    : esVariable(objetivo)
    ? listasDelMes(mes)[objetivo] || []
    : unirListas(listaTipos(tipo).map(t => ((MATRIZ.subcategorias || {})[claveTipo(t, nuevo)] || {})[objetivo] || []));
// ---------- CIRCULARES (circulares.js, desde datos/Circulares.xlsx con herramientas/circulares.py) ----------
// En la visita, el objetivo "Actividades" muestra como subcategorías las circulares vigentes en la fecha de la
// visita que van dirigidas a ese cliente (por su clasificación o por su nombre); las internas no salen.
const CIRCULARES = window.CIRCULARES || [];
let ctxCircular = { cliente: null, fecha: '' };
const estadoCircular = (c, d = hoy()) => c.ini && c.ini > d ? 'proxima' : !c.fin || c.fin >= d ? 'vigente' : 'vencida';
const etiquetaCircular = c => `${c.c} · ${c.nombre}`;
// Parrilla: su nombre dice "Parrilla Promocional" o es un alcance (prórroga) de una circular de parrilla
const esParrilla = c => /parrilla promocional/i.test(c.nombre)
    || (normalizar(c.tipo) === 'alcance' && CIRCULARES.some(x => x !== c && /parrilla promocional/i.test(x.nombre) && (c.nombre + ' ' + c.resumen).includes(x.c)));
// En "Actividades" solo van las circulares de clientes: ni internas, ni informativas, ni las de parrilla
const esActividadCliente = c => !c.interna && normalizar(c.tipo) !== 'informativa' && !esParrilla(c);
const circularDeEtiqueta = t => CIRCULARES.find(c => etiquetaCircular(c) === t);
function circularesDelCliente(cliente, fecha) {
    const d = fecha || hoy();
    return CIRCULARES.filter(c => !c.interna && estadoCircular(c, d) === 'vigente')
        .filter(c => !(cliente && c.excluidos.includes(cliente.n)))
        .filter(c => c.todos || (cliente && (c.canales.includes(String(cliente.cl || '')) || c.clientes.includes(cliente.n))));
}
// Parrilla Promocional: los productos de la circular de parrilla vigente para el cliente, en el orden de la circular
function parrillaCircular() {
    const lista = circularesDelCliente(ctxCircular.cliente, ctxCircular.fecha)
        .filter(c => esParrilla(c) && (c.productos || []).length)
        .flatMap(c => c.productos.map(p => productoPorCodigo[p.c] ? nombreProducto(p.c) : `[${p.c}]${p.n ? ' ' + p.n : ''}`));
    return [...new Set(lista)];
}
// Enlaces al PDF (Drive) que pegan los jefes en la app; si no hay, el del Excel
const ID_PDF_CIRC = 'circulares-pdf';
// Hasta 3 PDF por circular (los de la app mandan; si no hay, los del Excel separados por espacio, coma o ;)
const MAX_PDF_CIRC = 3;
const listaPdf = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).filter(Boolean);
const pdfsCircular = c => { const app = (registros[ID_PDF_CIRC]?.links || {})[c.c]; return listaPdf(app !== undefined ? app : c.pdf).slice(0, MAX_PDF_CIRC); };
const pdfCircular = c => pdfsCircular(c)[0] || '';

// Une listas de subcategorías respetando el orden de la más completa
// En el cierre salen todos los objetivos del tipo: los programados en negrita y los demás en gris claro
// En el cierre solo salen los objetivos de la matriz vigente. Los nombres viejos de visitas programadas
// antes del cambio se pasan al nombre nuevo; los que ya no existen no salen.
const NOMBRES_VIEJOS = { 'Cartera': 'Administración de Cartera', 'Visita personalizada': 'Otros', 'Mapa del Cliente - Ampliación Portafolio': 'Mapa del Cliente', 'Seguimiento': 'Seguimientos' };
const objetivosCierre = v => [...objetivosDeTipos(tiposDe(v), v.esProyecto), ...((v.objetivos || []).includes(PERSONALIZADA) ? [PERSONALIZADA] : [])];
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
const MODALIDADES = { presencial: 'Presencial', virtual: 'Virtual', remota: 'WhatsApp/Llamada/Correo' };
// Las visitas se programan antes de esta hora (Colombia, UTC-5) del día de la visita;
// las que se crean después quedan como NO programadas
const HORA_LIMITE = '08:00';
const GESTIONES = ['Presentación de productos', 'Seguimiento', 'Entrega de muestras', 'Cobro de cartera', 'Capacitación', 'Otro'];
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
const nombreVendedor = id => USUARIOS.find(u => u.id === id)?.nombre || id;
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
    if (e.includes('cliente')) return 'Visita Cliente';
    return 'Visita Cliente';
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
// Resaltado de días en todos los calendarios: festivos y domingos (rosado), sábados (gris muy claro)
const claseDia = d => nombreFestivo(d) || deIso(d).getDay() === 0 ? ' festivo' : deIso(d).getDay() === 6 ? ' sabado' : '';
const esHabil = f => { const w = deIso(f).getDay(); return w !== 0 && w !== 6 && !festivos(+f.slice(0, 4)).has(f); };
function siguienteHabil(f) { let d = sumarDias(f, 1); while (!esHabil(d)) d = sumarDias(d, 1); return d; }
const diaCierre = v => siguienteHabil(v.fecha);
const limiteCierre = v => Date.parse(`${diaCierre(v)}T${HORA_CIERRE}:59-05:00`);
// En pruebas no hay plazo para reportar (ni cierre automático); en vivo aplican todas las restricciones
const puedeReportar = v => v.estado === 'pendiente' && v.fecha <= hoy() && (ETAPA_DATOS === 'pruebas' || Date.now() <= limiteCierre(v));
const textoCierre = v => `${fechaCorta(diaCierre(v))}, ${horaBonita(HORA_CIERRE)}`;

// Pasa a NO visitado lo que no se reportó a tiempo (el jefe cierra las de todo el equipo)
function cerrarVencidas() {
    if (!sesion) return 0;
    const ahora = Date.now();
    if (ETAPA_DATOS === 'pruebas') {
        // En pruebas se reabren las que el sistema cerró por no reportarse a tiempo
        const cerradas = visibles().filter(v => v.clase === 'visita' && v.cierreAutomatico && v.estado === 'no_visitado' && (esJefe() || v.vendedor === sesion.id));
        cerradas.forEach(v => {
            const cuando = new Date(ahora).toISOString();
            registros[v.id] = { ...v, estado: 'pendiente', motivo: '', cierreAutomatico: false, registrada: '', actualizado: cuando, actualizadoPor: 'sistema' };
            pendientes.add(v.id);
        });
        if (cerradas.length) guardarLocal();
        return 0;
    }
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

// "Visita Comercial" ahora se llama "Visita Cliente": las visitas guardadas con el nombre viejo se leen con el nuevo
const TIPO_VIEJO = { 'Visita Comercial': 'Visita Cliente' };
function nombreNuevoTipo(r) {
    if (!r || r.clase !== 'visita') return r;
    if (TIPO_VIEJO[r.tipoVisita]) r.tipoVisita = TIPO_VIEJO[r.tipoVisita];
    if (Array.isArray(r.tiposVisita)) r.tiposVisita = r.tiposVisita.map(t => TIPO_VIEJO[t] || t);
    return r;
}

function cargarLocal() {
    limpiarSiCambioEtapa();
    try {
        registros = JSON.parse(localStorage.getItem('rc_registros') || '{}');
        Object.values(registros).forEach(nombreNuevoTipo);
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
            if (!pendientes.has(r.id) && (!local || (r.actualizado || '') >= (local.actualizado || ''))) registros[r.id] = nombreNuevoTipo(r);
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
    agenda.vendedores = [agenda.vendedor];
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
    $('maestraTxt').textContent = esJefe() ? 'Clientes por zona y vendedor' : 'Clientes de tu zona';
    document.querySelectorAll('.solo-jefe').forEach(el => el.style.display = esJefe() ? '' : 'none');
    // Comerciales: en el título de cada pantalla, debajo, su nombre
    document.querySelectorAll('.header-logo h1').forEach(h => {
        h.dataset.titulo = h.dataset.titulo || h.textContent;
        h.innerHTML = esc(h.dataset.titulo) + (esComercial() ? `<small class="h1-vend">${esc(sesion.nombre)}</small>` : '');
    });
    const opciones = COMERCIALES.map(c => `<option value="${c.id}">${esc(c.nombre)} · ${esc(c.zona)}</option>`).join('');
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
    const vigentes = CIRCULARES.filter(c => estadoCircular(c) === 'vigente').length;
    $('homeActTxt').textContent = `${vigentes} ${vigentes === 1 ? 'circular vigente' : 'circulares vigentes'}` + (acts.length ? ` · ${hechas} de ${acts.length} tareas del mes` : '');
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
    agenda.vendedores = [sesion.id];
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
// Los jefes programan visitas a cualquier cliente: buscan primero en la zona del vendedor y luego en todas
const buscarEnTodas = nombre => Object.keys(contactos).map(z => buscarMaestra(z, nombre)).find(Boolean);
const maestraForm = nombre => buscarMaestra(comercial(agenda.vendedor)?.zona, nombre) || (esJefe() ? buscarEnTodas(nombre) : undefined);
const buscarProyecto = (zona, nombre) => proyectosDeZona(zona).find(p => normalizar(p.nombre) === normalizar(nombre));
const solicitudesCreacion = () => proyectos().filter(p => p.estado === 'solicitud');
const JEFE_COMERCIAL = USUARIOS.find(u => u.jefe);
const visitasDeProyecto = id => visibles().filter(v => v.clase === 'visita' && v.contactoProyecto === id);

const opcionesMaestra = (zona, tipo) => (contactos[zona] || []).filter(c => !TIPOS_VISITA[tipo] || tiposDeCliente(c).includes(tipo))
    .map(c => `<option value="${esc(c.n)}" label="${esc([c.e, c.c].filter(Boolean).join(' · '))}">`).join('');
// Jefes: clientes de todas las zonas (sin repetir), con su zona al lado
const opcionesTodas = tipo => { const vistos = new Set(); return Object.keys(contactos).flatMap(z => (contactos[z] || []).filter(c => !TIPOS_VISITA[tipo] || tiposDeCliente(c).includes(tipo)).map(c => ({ c, z })))
    .filter(({ c }) => !vistos.has(normalizar(c.n)) && vistos.add(normalizar(c.n)))
    .map(({ c, z }) => `<option value="${esc(c.n)}" label="${esc([c.e, c.c, z].filter(Boolean).join(' · '))}">`).join(''); };
const opcionesProyecto = zona => proyectosDeZona(zona)
    .map(p => `<option value="${esc(p.nombre)}" label="${esc([ESTADO_PROYECTO[p.estado], p.tipo, p.ciudad].filter(Boolean).join(' · '))}">`).join('');

// "Maestra de Contactos" o "Contacto nuevo": cambia la lista del buscador y abre los datos del proyecto

// "Contacto nuevo" es una sola opción del menú; el tipo de visita se elige en un segundo campo
// Tipo de visita elegido en el menú (Visita Médica, Visita Cliente o Punto de Venta); en clientes 20 y 21 el
// vendedor puede marcar también el otro tipo (ver tiposCliente)
const esTipoVisita = f => !!TIPOS_VISITA[f];
const tipoBase = () => { const f = $('fTipo').value; return f === 'nuevo' ? $('fTipoNuevo').value : esTipoVisita(f) ? tiposCliente()[0] || f : f; };
const origenElegido = () => $('fTipo').value === 'nuevo' ? 'nuevo' : 'maestra';
const TIPO_CONTACTO_DE_VISITA = { 'Visita Médica': 'Médico', 'Visita Cliente': 'Cliente', 'Punto de Venta': 'Punto de Venta' };

function cambiarTipoNuevo() {
    const t = TIPO_CONTACTO_DE_VISITA[$('fTipoNuevo').value];
    if (t) { $('pTipo').value = t; etiquetaPersonaProyecto(); }
    pintarObjetivos();
}

function elegirOrigen(origen) {
    $('lblContacto').innerHTML = (origen === 'nuevo' ? 'Contacto nuevo ' : 'Cliente ') + REQ + (origen === 'nuevo' ? '' : ' <small>(Maestra de Contactos)</small>');
    const zona = comercial(agenda.vendedor)?.zona;
    $('dlContactos').innerHTML = origen === 'nuevo' ? opcionesProyecto(zona) : esJefe() ? opcionesTodas($('fTipo').value) : opcionesMaestra(zona, $('fTipo').value);
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
        ${lista.length ? gruposProyectos(lista, p => `<div class="solicitud proyecto${p.estado === 'vinculado' ? ' vinculado' : ''}">
            <div class="visita-cab"><strong>${esc(p.nombre)}</strong>${chip(p)}</div>
            <small>${esc([p.tipo, p.persona, p.direccion, p.ciudad, p.telefono].filter(Boolean).join(' · '))} · ${visitasDeProyecto(p.id).length} ${visitasDeProyecto(p.id).length === 1 ? 'visita' : 'visitas'}</small>
            ${acciones(p)}
        </div>`) : `<p class="no-results">${filtro === 'solicitud' ? 'No hay solicitudes de creación pendientes.' : 'No hay contactos nuevos. Se crean al programar una visita marcando "Contacto nuevo".'}</p>`}
    </div>`);
}

// Jefes: primero lo propio y luego cada comercial con su zona, por aparte. El comercial ve solo lo suyo.
function gruposProyectos(lista, tarjeta) {
    if (!esJefe()) return lista.map(tarjeta).join('');
    const orden = [sesion.id, ...COMERCIALES.map(c => c.id).filter(id => id !== sesion.id)];
    const vends = [...new Set(lista.map(p => p.vendedor))].sort((a, b) => (orden.indexOf(a) + 1 || 999) - (orden.indexOf(b) + 1 || 999));
    return vends.map(v => {
        const suyos = lista.filter(p => p.vendedor === v);
        const zona = comercial(v)?.zona || suyos[0]?.zona || '';
        const titulo = v === sesion.id ? `Tus contactos${zona ? ' · ' + zona : ''}` : `${nombreVendedor(v)}${zona ? ' · ' + zona : ''}`;
        return `<p class="grupo-titulo grupo-vend">${esc(titulo)} · ${suyos.length}</p>` + suyos.map(tarjeta).join('');
    }).join('');
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
// clientes tiene cada opción. "Todas" marca todas las casillas y no filtra (se guarda vacío = salen todos); otro toque
// las desmarca todas (NINGUNA) para escoger desde cero. Quitar una casilla con todas marcadas deja las demás. Cada pantalla es un grupo.
const NINGUNA = '__ninguna__';
const MULTI = {
    maestra: { get sel() { return maestra.sel; }, abierto: null, busca: '', enfocar: false, repintar: () => pintarMaestra() },
    visiplan: { get sel() { return visiplan.sel; }, abierto: null, busca: '', enfocar: false, repintar: () => pintarVisiplan() },
    historial: { get sel() { return historial.sel; }, abierto: null, busca: '', enfocar: false, repintar: () => pintarHistorial() },
    circ: { get sel() { return circulares.sel; }, abierto: null, busca: '', enfocar: false, repintar: () => pintarCirculares() }
};
function pintarMultis(caja, grupo, defs) {
    const g = MULTI[grupo];
    const tecleando = document.activeElement?.classList?.contains('mc-multi-busca');
    const antes = caja.querySelector('.mc-multi-ops');
    const scroll = antes ? antes.scrollTop : 0;
    g.valores = {}; g.visibles = {};
    caja.innerHTML = defs.map(d => {
        g.valores[d.k] = d.valores;
        const k = d.k, nombre = v => d.nombre ? d.nombre(v) : v;
        const ninguna = g.sel[k].includes(NINGUNA), elegidos = ninguna ? [] : g.sel[k], todas = !ninguna && !elegidos.length;
        const texto = ninguna ? 'Ninguna elegida' : todas ? d.todos : elegidos.length === 1 ? nombre(elegidos[0]) : `${d.t}: ${elegidos.length} elegidas`;
        const abierto = g.abierto === k, qo = abierto ? normalizar(g.busca) : '';
        // Con búsqueda, las casillas muestran solo lo elegido y "Todos" pasa a ser "todos los resultados"
        const vis = d.valores.filter(v => !qo || normalizar(nombre(v)).includes(qo));
        g.visibles[k] = vis;
        const todosVis = !!qo && vis.length > 0 && vis.every(v => elegidos.includes(v));
        return `<div class="mc-multi${abierto ? ' abierto' : ''}${todas ? '' : ' con'}" data-k="${k}">
            <button type="button" class="mc-multi-btn" onclick="abrirMulti('${grupo}', '${k}')" aria-expanded="${abierto}" title="${esc(d.t)}"><span>${esc(texto)}</span></button>
            ${!abierto ? '' : `<div class="mc-multi-panel">
                ${d.extra || ''}
                ${d.valores.length > 10 ? `<input class="mc-multi-busca" placeholder="Buscar ${esc(d.t.toLowerCase())}..." value="${esc(g.busca)}" oninput="MULTI.${grupo}.busca=this.value; MULTI.${grupo}.repintar()">` : ''}
                <div class="mc-multi-acc"><b>${esc(d.t)}</b><span>Elige una o varias</span></div>
                <label class="mc-multi-todas"><input type="checkbox" ${(qo ? todosVis : todas) ? 'checked' : ''} onchange="todasMulti('${grupo}', '${k}')"><span>${qo ? `Todos los resultados (${vis.length})` : esc(d.todos)}</span></label>
                <div class="mc-multi-ops">${vis.map(v => `<label class="${!d.cuenta || d.cuenta[v] ? '' : 'vacio'}">
                    <input type="checkbox" data-v="${esc(v)}" ${(qo ? elegidos.includes(v) : todas || elegidos.includes(v)) ? 'checked' : ''} onchange="marcarMulti('${grupo}', '${k}', this.dataset.v)">
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
    const g = MULTI[grupo], todos = g.valores?.[k] || [], buscando = !!normalizar(g.busca || '');
    const explicitos = g.sel[k].includes(NINGUNA) ? [] : g.sel[k];
    // Buscando se parte de lo elegido a mano: tocar un resultado lo deja como filtro (no quita uno de "todos")
    const s = buscando ? explicitos : explicitos.length ? explicitos : todos;   // vacío = todas marcadas
    let nuevo = s.includes(v) ? s.filter(x => x !== v) : [...s, v];
    if (todos.length && todos.every(x => nuevo.includes(x))) nuevo = [];   // quedaron todas: sin filtro
    else if (!nuevo.length) nuevo = buscando ? [] : [NINGUNA];
    g.sel[k] = nuevo;
    g.repintar();
}
function todasMulti(grupo, k) {
    const g = MULTI[grupo], todos = g.valores?.[k] || [];
    if (normalizar(g.busca || '')) {
        // Buscando: elige (o quita) todos los resultados de la búsqueda
        const vis = g.visibles?.[k] || [], explicitos = g.sel[k].includes(NINGUNA) ? [] : g.sel[k];
        let nuevo = vis.every(v => explicitos.includes(v)) ? explicitos.filter(v => !vis.includes(v)) : [...new Set([...explicitos, ...vis])];
        if (todos.length && todos.every(x => nuevo.includes(x))) nuevo = [];
        g.sel[k] = nuevo;
        return g.repintar();
    }
    g.sel[k] = g.sel[k].length ? [] : [NINGUNA];   // marca todas (sin filtro) o las desmarca todas
    g.repintar();
}
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
    FILTROS_MAESTRA.forEach(k => { maestra.sel[k] = maestra.sel[k].filter(v => v === NINGUNA || base.some(c => DIMS_MAESTRA[k].valor(c) === v)); });
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
const pasaFiltrosPlan = (m, r) => !visiplan.sel.f.length || visiplan.sel.f.some(f => FILTROS_PLAN[f]?.(m, r));
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
    if (esJefe()) { agenda.vendedores = visiplan.vendedores.slice(); agenda.vendedor = agenda.vendedores[0] || agenda.vendedor; }
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
        clientes = clientes.concat((contactos[ven.zona] || []).map(c => ({ n: c.n, e: c.e || '', t: tipoSugerido(c.e || '') || 'Visita Cliente', v: ven.id }))
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
    // Cumpleaños del vendedor: la columna del día queda en morado clarito
    const cumpleHead = d => vista.filter(v => esCumple(v.id, d));
    const cab1 = semanas.map((s, i) => `<th colspan="${s.dias.length * 2}" class="vp-sem">Semana ${i + 1}</th>`).join('');
    const cab2 = dias.map(d => `<th colspan="2" class="vp-dia${fs(d)}${claseDia(d)}${diaPlanHead(d)}${cumpleHead(d).length ? ' cumple' : ''} ir" onclick="irDiaPlan('${d}')" title="${cumpleHead(d).length ? '🎂 Cumpleaños de ' + esc(cumpleHead(d).map(v => v.nombre).join(', ')) + ' · ' : ''}${esc(nombreFestivo(d) || (diaPlanHead(d) ? 'Planeación Mes · ' : '') + fechaLarga(d))} · toca para abrir el Plan de Trabajo${visiplan.vendedores.length > 1 ? ' de ' + esc(nombreVendedor(visiplan.vendedores[0])) : ''}">${DIAS[deIso(d).getDay()][0]}<small>${deIso(d).getDate()}</small></th>`).join('');
    const cab3 = dias.map(d => { const cu = cumpleHead(d).length ? ' cumple' : ''; return `<th class="vp-sub plan${claseDia(d)}${cu}">P</th><th class="vp-sub real${fs(d)}${claseDia(d)}${cu}">R</th>`; }).join('');
    const dp = (v, d) => (seg[v].diasPlaneacion.has(d) ? ' dia-plan' : '') + (esCumple(v, d) ? ' cumple' : '');
    const celdas = (c, m, r, px) => dias.map(d => `<td class="vp-x h${m.includes(d) ? ' on' : ''}${claseDia(d)}${dp(c.v, d)}" data-c="${esc(c.n)}" data-v="${c.v}" data-d="${d}"></td>`
        + `<td data-d="${d}" class="vp-r h${fs(d)}${r.has(d) ? ' on' : px.has(d) ? ' prox' : ''}${claseDia(d)}${dp(c.v, d)}"${!r.has(d) && px.has(d) ? ' title="Reprogramada: pasa a verde cuando se visite"' : ''}></td>`).join('');
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
        + `<tfoot><tr class="vp-tot"><td class="vp-et"></td><th class="vp-cli" scope="row">Obj · Real del día</th>${dias.map(d => `<td class="vp-tp${claseDia(d)}" data-d="${d}"></td><td class="vp-tr${fs(d)}${claseDia(d)}" data-d="${d}"></td>`).join('')}<td class="vp-n plan" id="vpTotP"></td><td class="vp-n real" id="vpTotR"></td><td class="vp-n vp-pct" id="vpTotPct"></td><td class="vp-n vp-pvis" id="vpTotVis"></td></tr>`
        + `<tr class="vp-tot vp-tot-c"><td class="vp-et"></td><th class="vp-cli" scope="row">% Cump del día</th>${dias.map(d => `<td colspan="2" class="vp-dp${fs(d)}${claseDia(d)}" data-d="${d}"></td>`).join('')}<td colspan="4" class="vp-pie" id="vpPieN"></td></tr>`
        + `<tr class="vp-tot vp-tot-v"><td class="vp-et"></td><th class="vp-cli" scope="row">% Visitas del día</th>${dias.map(d => `<td colspan="2" class="vp-dv${fs(d)}${claseDia(d)}" data-d="${d}"></td>`).join('')}<td colspan="4" class="vp-pie" id="vpPieV"></td></tr></tfoot>`;
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
    const txt = l => l.includes(NINGUNA) ? 'Ninguna' : l.join(', ');
    const filtros = [visiplan.busca && `Búsqueda: ${visiplan.busca}`, txt(visiplan.sel.t), txt(visiplan.sel.e),
        visiplan.sel.f.includes(NINGUNA) ? 'Ninguno' : visiplan.sel.f.map(f => NOMBRES_FILTRO_PLAN[f] || 'Planeados o visitados').join(', ')].filter(Boolean).join(' · ');
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
function confirmarPlaneada(contacto, fecha, vendedor) {
    if (fecha !== hoy()) return toast('Las visitas del plan se confirman el mismo día');
    if (vendedor) agenda.vendedor = vendedor;
    confirmandoPlan = { contacto, fecha };
    abrirProgramar(null, contacto);
}

// ---------- AGENDA ----------
function abrirAgenda() {
    pintarAgenda();
    mostrarPantalla('agendaScreen');
}

// Jefes: ven uno, varios o todo el equipo (agenda.vendedor = el primero, con el que se abre Programar)
const vendedoresAgenda = () => esJefe() && agenda.vendedores?.length ? agenda.vendedores : [agenda.vendedor];
// Jefes: los comerciales y, si el jefe no es comercial, él mismo (sus visitas quedan a su nombre y no suman a ninguna zona)
const opcionesAgenda = () => [...(comercial(sesion.id) ? [] : USUARIOS.filter(u => u.id === sesion.id)), ...COMERCIALES];
function pintarVendedoresAgenda() {
    if (!esJefe()) return;
    const sel = vendedoresAgenda(), todos = sel.length === opcionesAgenda().length;
    $('agVendedores').innerHTML = `<button type="button" class="vp-vend-btn todos${todos ? ' activo' : ''}" onclick="elegirVendedorAgenda('todos', event)" aria-pressed="${todos}">Todo el equipo</button>`
        + opcionesAgenda().map(c => `<button type="button" class="vp-vend-btn${sel.includes(c.id) ? ' activo' : ''}" onclick="elegirVendedorAgenda('${c.id}', event)" aria-pressed="${sel.includes(c.id)}">${sel.includes(c.id) ? '✓ ' : ''}${esc(c.nombre)} <small>${esc(c.zona || 'Mis visitas')}</small></button>`).join('') + AYUDA_CHIPS;
}
function elegirVendedorAgenda(id, e) {
    agenda.vendedores = eleccionChip(vendedoresAgenda(), id, opcionesAgenda().map(c => c.id), e);
    agenda.vendedor = agenda.vendedores[0];
    agenda.filtro = '';
    pintarAgenda();
}

function elegirFecha(f) {
    if (!f) return;
    if (f !== agenda.fecha) { agenda.busca = ''; if ($('agBuscar')) $('agBuscar').value = ''; }
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
        celdas += `<button class="cal-dia${fuera ? ' fuera' : ''}${claseDia(d)}${d === t ? ' hoy' : ''}${d === agenda.fecha ? ' sel' : ''}" onclick="irDelCalendario('${d}')">
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
    const vs = vendedoresAgenda(), varios = vs.length > 1;
    const deTodos = fn => vs.flatMap(fn);
    pintarVendedoresAgenda();
    $('agFechaTxt').textContent = f === t ? 'Hoy, ' + fechaLarga(f) : mayuscula(fechaLarga(f));
    const abierta = Date.now() < limiteProgramacion(f);
    $('agFechaSub').textContent = (esJefe() ? (vs.length === opcionesAgenda().length ? 'Todo el equipo' : vs.map(nombreVendedor).join(', ')) + ' · ' : '')
        + (abierta ? `Programa las visitas antes de las ${HORA_LIMITE} a. m.` : f === t ? 'Programación cerrada: lo nuevo queda como no programado' : f < t ? 'Día pasado' : '');
    $('agFechaPick').value = f;

    const lunes = lunesDe(f);
    $('agSemana').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(i => {
        const d = sumarDias(lunes, i);
        const puntos = deTodos(x => visitasDe(x, d)).slice(0, 5)
            .map(x => `<i class="${x.estado === 'visitado' ? 'ok' : x.estado === 'no_visitado' ? 'no' : ''}"></i>`).join('');
        const fest = nombreFestivo(d);
        const nov = deTodos(x => novedadesDe(x, d))[0];
        const marca = nov ? `<em>${CORTO_NOVEDAD[nov.tipo]}</em>` : fest ? '<em>Festivo</em>' : '';
        return `<button class="sd${d === t ? ' hoy' : ''}${d === f ? ' sel' : ''}${claseDia(d)}${nov ? ' con-novedad' : ''}" onclick="elegirFecha('${d}')" title="${esc(fest || nov?.tipo || '')}"><b>${DIAS[deIso(d).getDay()]}</b><span>${deIso(d).getDate()}</span>${marca}<span class="puntos">${puntos}</span></button>`;
    }).join('');

    $('agAvisoZona').hidden = varios || comercial(v)?.zona !== ZONA_POR_ASIGNAR;
    const fest = nombreFestivo(f);
    $('agFestivo').hidden = !fest;
    $('agFestivo').textContent = fest ? `Festivo · ${fest}` : '';
    const novs = deTodos(x => novedadesDe(x, f));
    const lista = deTodos(x => visitasDe(x, f)).sort(ordenCita);
    const k = cuentaVisitas(lista);
    const internos = lista.filter(x => x.interno).length;
    // Los indicadores del día son botones: al tocarlos filtran las visitas (otro toque quita el filtro)
    const boton = (f, clase, texto) => `<button type="button" class="chip chip-filtro ${clase}${agenda.filtro === f ? ' activo' : ''}" onclick="filtrarAgenda('${f}')" aria-pressed="${agenda.filtro === f}">${texto}</button>`;
    // Anillo del día (filtra la agenda) y, al lado, el acumulado del mes hasta ese día (solo informativo)
    const delMes = deTodos(x => visitasMes(mesDe(f), x)).filter(x => x.fecha <= f);
    // Semana: de lunes al día que se está viendo (solo informativo, como el del mes)
    const deSemana = deTodos(x => [0, 1, 2, 3, 4, 5, 6].map(i => sumarDias(lunesDe(f), i)).filter(d => d <= f).flatMap(d => visitasDe(x, d)));
    const anillos = anilloDia(lista, `Día · ${fechaCorta(f)}`, true, 'dia') + anilloDia(deSemana, `Acumulado de la semana · ${lunesDe(f) === f ? 'Lunes ' + fechaCorta(f) : `Del ${deIso(lunesDe(f)).getDate()}${mesDe(lunesDe(f)) === mesDe(f) ? '' : ' de ' + nombreMes(mesDe(lunesDe(f))).split(' ')[0].slice(0, 3)} al ${fechaCorta(f)}`}`, false, 'semana') + anilloDia(delMes, `Acumulado del mes · ${mayuscula(nombreMes(mesDe(f)).split(' ')[0])}, hasta el ${deIso(f).getDate()}`, false, 'mes');
    // En el celular se ve un solo anillo a la vez: botones Día · Semana · Mes (en el computador salen los tres)
    const verAn = agenda.anillo || 'dia';
    const tabsAn = ['dia', 'semana', 'mes'].map(x => `<button type="button" class="${x === verAn ? 'activo' : ''}" onclick="agenda.anillo='${x}'; pintarAgenda()">${{ dia: 'Día', semana: 'Semana', mes: 'Mes' }[x]}</button>`).join('');
    $('agAnillo').innerHTML = delMes.length ? `<div class="anillo-tabs">${tabsAn}</div><div class="anillos ver-${verAn}">${anillos}</div>` : '';
    // + Programar: no se programa en días que ya pasaron (en pruebas sigue abierto)
    const pasado = f < t && ETAPA_DATOS !== 'pruebas';
    document.querySelectorAll('.btn-programar').forEach(b => { b.disabled = pasado; b.title = pasado ? 'Este día ya pasó: no se puede programar' : ''; });
    $('agResumen').innerHTML = lista.length
        ? boton('prog', 'prog', `<b>${k.prog}</b> ${k.prog === 1 ? 'programada' : 'programadas'}`)
            + (k.noProg ? boton('noProg', 'np', `${k.noProg} no programadas`) : '')
            + `<select class="ag-orden" onchange="agenda.orden=this.value; pintarAgenda()" aria-label="Ordenar visitas">
                <option value="prog" ${agenda.orden === 'prog' ? 'selected' : ''}>Orden: visita programada</option>
                <option value="realizada" ${agenda.orden === 'realizada' ? 'selected' : ''}>Orden: visita realizada</option>
                <option value="hora" ${agenda.orden === 'hora' ? 'selected' : ''}>Orden: hora de cita</option></select>`
        : '';

    // Búsqueda de cliente por nombre (visitas y lo planeado del Visiplan)
    const qb = normalizar(agenda.busca || '');
    const pasaBusca = x => !qb || normalizar(x.contacto || '').includes(qb);
    const plan = deTodos(x => planeadasDe(x, f).map(p => ({ ...p, vendedor: x }))).filter(p => p.estado !== 'confirmada' && pasaBusca(p));
    // Arriba los planeados por confirmar; los que no se confirmaron a tiempo quedan al final del día
    const tarjetaPlan = p => `
        <div class="producto-card plan-card ${p.estado === 'cerrada' ? 'cerrada' : ''}">
            <div class="visita-cab"><div>${varios ? `<span class="vend-card">${esc(nombreVendedor(p.vendedor))}</span>` : ''}<h3>${esc(p.contacto)}</h3></div><span class="chip ${p.estado === 'cerrada' ? 'gris' : 'azul'}">${p.estado === 'cerrada' ? 'No confirmada · cerrada' : 'Planeada'}</span></div>
            ${p.estado === 'por confirmar' && f === t
                ? `<div class="acciones"><button class="bv ok" data-c="${esc(p.contacto)}" onclick="confirmarPlaneada(this.dataset.c, '${f}', '${p.vendedor}')">✓ Confirmar visita</button><span class="nota-cierre">Si no la confirmas hoy, queda cerrada y no se programa.</span></div>`
                : p.estado === 'por confirmar' ? '<p class="nota-cierre">Se confirma el mismo día de la visita.</p>' : ''}
        </div>`;
    // Después de las 8:00 a. m. los que no se confirmaron también bajan al final (se pueden confirmar mientras sea el día)
    const tarde = p => p.estado === 'cerrada' || Date.now() >= limiteProgramacion(f);
    const abiertas = plan.filter(p => !tarde(p)), cerradas = plan.filter(tarde);
    const bloquePlan = abiertas.length ? `<div class="plan-dia"><p class="grupo-titulo">Visiplan · ${abiertas.length} ${abiertas.length === 1 ? 'cliente planeado' : 'clientes planeados'}</p>${abiertas.map(tarjetaPlan).join('')}</div>` : '';
    const bloqueCerradas = cerradas.length ? `<div class="plan-dia"><p class="grupo-titulo">Visiplan · ${cerradas.length} ${cerradas.length === 1 ? 'planeado no confirmado' : 'planeados no confirmados'}</p>${cerradas.map(tarjetaPlan).join('')}</div>` : '';
    const cont = $('agLista');
    if (!lista.length && !novs.length && !plan.length) {
        cont.innerHTML = `<div class="no-results">${fest ? 'Día festivo: no hay nada programado.' : 'No hay visitas programadas para este día.'}<br><button class="btn-nuevo btn-programar" style="margin-top:15px" onclick="abrirProgramar()" ${f < t && ETAPA_DATOS !== 'pruebas' ? 'disabled title="Este día ya pasó: no se puede programar"' : ''}>+ Programar</button></div>`;
        return;
    }
    // Filtro por indicador y orden (por hora de cita o por el orden en que se reportaron las visitas)
    const pasa = {
        prog: x => !x.interno && esProgramada(x), noProg: x => !x.interno && !esProgramada(x),
        ok: x => !x.interno && x.estado === 'visitado', no: x => !x.interno && x.estado === 'no_visitado',
        p: x => !x.interno && x.estado === 'pendiente', interno: x => x.interno
    }[agenda.filtro] || (agenda.filtro.startsWith('an:') ? x => claseAnillo(x) === agenda.filtro.slice(3) : () => true);
    // El orden (programado y real) es de cada vendedor
    const ordenes = {};
    let programadas = [];
    vs.forEach(x => { const r = ordenesDelDia(lista.filter(y => y.vendedor === x)); Object.assign(ordenes, r.o); if (!varios) programadas = r.prog; });
    const clave = x => agenda.orden === 'prog' ? (ordenes[x.id]?.prog ?? (x.interno ? 2e9 : 1e9))
        : agenda.orden === 'realizada' ? (ordenes[x.id]?.real ?? (x.interno ? 2e9 : 1e9)) : 0;
    const vistas = lista.filter(pasa).filter(pasaBusca).sort((a, b) => vs.indexOf(a.vendedor) - vs.indexOf(b.vendedor) || clave(a) - clave(b) || ordenCita(a, b));
    const mover = varios ? null : { abierta: Date.now() < limiteProgramacion(f), puede: sesion.id === v || esAdmin(), total: programadas.length };
    const tarjetas = vistas.map(x => tarjetaVisita(x, ordenes[x.id], mover, varios)).join('');
    const filtrando = agenda.filtro;
    const aviso = filtrando || qb ? `<p class="grupo-titulo filtro-activo">Mostrando ${vistas.length} de ${lista.length} · <button class="link-mini" onclick="quitarFiltrosAgenda()">Quitar filtro</button></p>` : '';
    cont.innerHTML = (filtrando ? '' : novs.map(tarjetaNovedad).join('') + bloquePlan) + aviso
        + (tarjetas || (lista.length || !cerradas.length ? `<div class="no-results">${qb ? `No hay visitas de "${esc(agenda.busca)}" este día.${sugerenciasHistorial(qb)}` : 'No hay visitas con este filtro.'}</div>` : ''))
        + (filtrando ? '' : bloqueCerradas);
}

// Si el cliente buscado no está en el día, se ofrece abrir su historial (hasta 5 coincidencias)
function sugerenciasHistorial(qb) {
    const nombres = [...new Set(visibles().filter(x => x.clase === 'visita' && !x.interno && normalizar(x.contacto || '').includes(qb)).map(x => x.contacto))].slice(0, 5);
    return nombres.length ? `<br><small>Ver historial:</small> ${nombres.map(n => `<button class="link-mini" data-c="${esc(n)}" onclick="verCliente(this.dataset.c, agenda.vendedor)">${esc(n)}</button>`).join(' · ')}` : '';
}

function quitarFiltrosAgenda() {
    agenda.filtro = ''; agenda.busca = ''; $('agBuscar').value = '';
    pintarAgenda();
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

function tarjetaVisita(v, ord = null, mover = null, conVendedor = false) {
    const clase = v.estado === 'visitado' ? 'ok' : v.estado === 'no_visitado' ? 'no' : '';
    const [txtOk, txtNo] = v.interno ? ['Realizado', 'No realizado'] : ['Visitado', 'No visitado'];
    const chip = v.estado === 'visitado' ? `<span class="chip ok">${txtOk}</span>`
        : v.estado === 'no_visitado' ? `<span class="chip no">${txtNo}</span>`
        : !v.interno && esReprogramada(v) ? `<span class="chip no">${v.origen === 'proxima' ? 'Próxima visita' : 'Reprogramada'}</span>`
        : '<span class="chip p">Pendiente</span>';
    const mc = !v.interno && (buscarMaestra(comercial(v.vendedor)?.zona, v.contacto) || buscarEnTodas(v.contacto));
    const meta = [mc?.cl ? `Clasificación <b>${esc(mc.cl)}</b>` : '', ...[v.tipoContacto, v.ciudad].filter(Boolean).map(esc)].filter(Boolean).join(' · ');
    const cumplidos = v.estado === 'visitado' ? (v.objetivosCumplidos || []) : null;
    const marcaObj = o => !cumplidos ? '' : cumplidos.includes(o) ? ' class="cumplido"' : ' class="no-cumplido"';
    let objetivos = v.tipoVisita
        ? `<p class="objetivos"><b>${esc(nombreTipo(v))}</b>${(v.objetivos || []).map(o => `<span${marcaObj(o)}>${cumplidos && cumplidos.includes(o) ? '✓ ' : ''}${esc(o)}${textoSubs(v, o)}</span>`).join('')}${(cumplidos || []).filter(o => !(v.objetivos || []).includes(o)).map(o => `<span class="cumplido extra" title="Cumplido sin haberlo programado">✓ ${esc(o)}${textoSubs(v, o)}</span>`).join('')}</p>${cumplidos && v.objetivos?.length ? `<p class="obj-resumen"><b>Objetivos cumplidos:</b> ${cumplidosProgramados(v).length} de ${v.objetivos.length}</p>` : ''}` : '';
    const noProgTxt = esProgramada(v) ? '' : `<span class="chip np">${v.interno ? 'No programado' : 'No programada'}</span>`;
    const marcas = v.interno ? `<span class="chip gris">Trabajo interno</span>${noProgTxt}`
        : `<span class="chip ${v.modalidad === 'virtual' ? 'azul' : v.modalidad === 'remota' ? 'morado' : 'gris'}">${modalidadDe(v)}</span>${v.esProyecto ? '<span class="chip proy">Proyecto</span>' : ''}${esReprogramada(v) && v.vieneDe ? `<span class="chip prox">Viene del ${esc(fechaCorta(v.vieneDe))}</span>` : ''}${v.adelantada ? `<span class="chip azul">Adelantada · planeada el ${esc(fechaCorta(v.fechaPlaneada))}</span>` : ''}${noProgTxt}`;
    let reporte = '';
    if (v.estado === 'visitado' && v.interno) {
        reporte = v.observaciones ? `<div class="reporte">${esc(v.observaciones)}</div>` : '';
    } else if (v.estado === 'visitado') {
        const partes = partesReporte(v);
        reporte = `<div class="reporte">${partes.join('<br>')}</div>`;
    }
    if (v.estado === 'no_visitado') {
        reporte = `<div class="reporte"><b>${esc(v.motivo)}</b>${v.reprogramadaPara ? ` · Reprogramada para el ${esc(fechaCorta(v.reprogramadaPara))}` : ''}${v.observaciones ? '<br>' + esc(v.observaciones) : ''}</div>`;
    }
    const reprog = !v.interno && v.estado === 'pendiente' && esReprogramada(v) ? ' reprog' : '';
    return `<div class="producto-card visita-card ${clase}${v.interno ? ' interno' : ''}${reprog}">
        <div class="visita-cab"><div>${conVendedor ? `<span class="vend-card">${esc(nombreVendedor(v.vendedor))}</span>` : ''}${v.hora ? `<span class="cita-fija"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Cita ${esc(horaBonita(v.hora))}</span>` : ''}${v.interno ? '' : insigniasOrden(v, ord || {}, mover)}${v.interno ? `<h3>${esc(v.contacto)}</h3>` : `<h3 class="cliente-link" data-c="${esc(v.contacto)}" onclick="verCliente(this.dataset.c, '${v.vendedor}')" title="Ver historial del cliente">${esc(v.contacto)}</h3>`}</div>${chip}</div>
        ${meta ? `<p class="meta">${meta}</p>` : ''}
        <div class="marcas">${marcas}</div>
        ${objetivos}
        ${v.objetivo ? `<p class="nota-plan"><b>${v.interno ? 'Qué se iba a hacer' : 'Plan de visita'}:</b> ${esc(v.objetivo)}</p>` : ''}
        ${reporte}
        ${accionesVisita(v, txtOk, txtNo)}
    </div>`;
}

// Adelantar: la visita programada para otro día se hace hoy. Queda la fecha planeada y la fecha de la visita;
// en el Visiplan la X planeada no se mueve.
async function adelantarVisita(id) {
    const v = registros[id];
    if (!v || v.estado !== 'pendiente' || v.fecha <= hoy()) return;
    if (!await dialogo({ titulo: `¿Adelantar la visita a hoy?`, texto: `${v.contacto} estaba planeada para el ${fechaLarga(v.fecha)}. Queda para hoy y se guarda la fecha planeada.`, aceptar: 'Adelantar' })) return;
    guardarRegistro({ ...v, fechaPlaneada: v.fechaPlaneada || v.fecha, fecha: hoy(), adelantada: true, hora: '' });
    toast(`${v.contacto}: adelantada a hoy`);
    elegirFecha(hoy());
}

// Reprogramar una visita futura para otro día: queda como reprogramada y en el Visiplan la X planeada no se mueve
function abrirReprogramar(id) {
    const v = registros[id];
    if (!v || v.estado !== 'pendiente') return;
    abrirModal(`<form class="form-rc" onsubmit="guardarReprogramar(event, '${id}')">
        <h2>Reprogramar</h2><p class="sub">${esc(v.contacto)} · planeada el ${esc(fechaCorta(v.fechaPlaneada || v.fecha))}</p>
        <div class="fila-fecha compacta"><div><label for="aReproFecha">Nueva fecha</label><input id="aReproFecha" type="date" required min="${ETAPA_DATOS === 'pruebas' ? '' : hoy()}"></div>
            <div><label for="aReproHora">Hora <small>(opcional)</small></label><input id="aReproHora" type="time" value="${esc(v.hora || '')}"></div></div>
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario">Reprogramar</button>
        </div>
    </form>`);
}

function guardarReprogramar(e, id) {
    e.preventDefault();
    const v = registros[id], fecha = $('aReproFecha').value;
    if (!fecha) { toast('Elige la nueva fecha'); return; }
    if (fecha === v.fecha) { toast('Elige un día distinto al que ya tiene'); return; }
    guardarRegistro({ ...v, fecha, hora: $('aReproHora').value, origen: 'reprogramada', vieneDe: v.vieneDe || v.fecha,
        fechaPlaneada: v.fechaPlaneada || v.fecha, adelantada: false, programada: Date.now() < limiteProgramacion(fecha) });
    cerrarModal();
    toast(`${v.contacto}: reprogramada para el ${fechaCorta(fecha)}`);
    pintarAgenda();
}

// Reporte de una visita cerrada: cada dato con su título resaltado
function partesReporte(v, conObjetivos) {
    const fila = (t, val) => val ? `<span class="rep-fila"><b>${t}:</b> ${val}</span>` : '';
    return [
        v.gestion ? `<b>${esc(v.gestion)}</b>` : '',
        fila('Atendió', esc(v.atendio || '')),
        conObjetivos && (v.objetivosCumplidos || []).length ? fila('Objetivos cumplidos', v.objetivosCumplidos.map(o => esc(o) + ((v.subCumplidos || {})[o] ? ` (${v.subCumplidos[o].map(esc).join(', ')})` : '')).join(', ')) : '',
        v.pedido === 'si' ? fila('Pedido', esc(textoPedidos(v) || 'sí') + (v.valorPedido ? ' · ' + pesos(v.valorPedido) : '')) : '',
        fila('Productos pedidos', htmlProductosReporte(v.productosPedidos)),
        fila('Productos presentados', Object.keys(v.productosPresentados || {}).length ? htmlProductosReporte(v.productosPresentados) : esc(v.productos || '')),
        fila('Muestras', esc(v.muestras || '')),
        fila('Compromisos', esc(v.compromisos || '')),
        v.proximaVisita ? fila('Próxima visita', esc(fechaCorta(v.proximaVisita)) + (v.proximaHora ? ' · ' + esc(horaBonita(v.proximaHora)) : '')) : '',
        v.observaciones ? fila('Observaciones', esc(v.observaciones)) : ''
    ].filter(Boolean);
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
        const puede = sesion.id === v.vendedor || esAdmin();
        return `<div class="acciones">${puede ? `<button class="bv adelantar" onclick="adelantarVisita('${v.id}')">⏩ Adelantar a hoy</button><button class="bv reprogramar" onclick="abrirReprogramar('${v.id}')">📅 Reprogramar</button>` : ''}<span class="nota-cierre">Se reporta desde el ${esc(fechaCorta(v.fecha))} hasta el ${esc(textoCierre(v))}</span>${editar}${eliminar}</div>`;
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
async function confirmarDia(fecha, conDomingo) {
    const festivo = nombreFestivo(fecha), domingo = conDomingo && !festivo && deIso(fecha).getDay() === 0;
    const nov = novedadesDe(agenda.vendedor, fecha)[0];
    if (festivo && !await dialogo({ tono: 'aviso', titulo: 'Día festivo', texto: `El ${fechaLarga(fecha)} es festivo: ${festivo}.\n¿Deseas continuar con la programación?`, aceptar: 'Sí, continuar', cancelar: 'No' })) return false;
    if (domingo && !await dialogo({ tono: 'aviso', titulo: 'Domingo', texto: `El ${fechaLarga(fecha)} es domingo.\n¿Deseas continuar con la programación?`, aceptar: 'Sí, continuar', cancelar: 'No' })) return false;
    if (nov && !await dialogo({ tono: 'aviso', titulo: nov.tipo, texto: `${nombreVendedor(agenda.vendedor)} tiene ${nov.tipo.toLowerCase()} ese día (${rangoNovedad(nov)}).\n¿Deseas continuar con la programación?`, aceptar: 'Sí, continuar', cancelar: 'No' })) return false;
    return true;
}

// Cambia para quién se programa (jefe con varios vendedores): la lista de clientes y contactos nuevos es la de su zona
let programandoNuevo = false;
function cambiarVendForm(id) {
    agenda.vendedor = id;
    if ($('fTipo').value) elegirOrigen(origenElegido());
}

async function abrirProgramar(id, contactoPlan) {
    advertenciaAceptada = '';
    if (!contactoPlan) confirmandoPlan = null;
    const v = id ? registros[id] : null;
    if (v && v.clase === 'visita' && v.estado !== 'pendiente') return toast('Esta visita ya se cerró y no se puede modificar');
    if (v?.vendedor) agenda.vendedor = v.vendedor;
    // Jefes: lo que programan queda a su nombre; solo las novedades (vacaciones, permisos…) son del vendedor,
    // y si ve varios vendedores escoge de quién
    programandoNuevo = !v && !contactoPlan;
    textoPersonalForm = typeof v?.personalizada === 'string' ? v.personalizada : '';
    const eligeVend = programandoNuevo && esJefe() && vendedoresAgenda().length > 1;
    // Al programar algo nuevo en un festivo (o día con novedad) primero sale la advertencia, antes del formulario
    if (!v && !contactoPlan) {
        if (!await confirmarDia(agenda.fecha)) return;
        advertenciaAceptada = agenda.fecha;
    }
    const zona = comercial(agenda.vendedor)?.zona;
    const lista = contactos[zona] || [];
    const actual = v?.tipoVisita === VMC ? 'Visita Cliente' : v?.tipoVisita || v?.tipo;   // Médica Comercial se abre desde Visita Cliente
    const opcion = t => `<option ${t === actual && !v?.esProyecto ? 'selected' : ''}>${esc(t)}</option>`;
    // Visita que viene del Visiplan o que ya estaba programada (o reprogramada): no se cambia qué se programa ni el cliente
    const bloqueado = !!contactoPlan || (v && v.clase === 'visita');
    const opcionNuevo = t => `<option ${t === actual && v?.esProyecto ? 'selected' : ''}>${esc(t)}</option>`;
    abrirModal(`<form class="form-rc" novalidate onsubmit="guardarProgramada(event, '${id || ''}')">
        <h2>${v ? 'Editar Plan de Visita' : 'Plan de Visita'}</h2>
        <p class="sub" id="fQuien">${esc(nombreVendedor(agenda.vendedor))} · ${esc(zona || '')}</p>
        ${eligeVend ? `<div id="cajaVend" hidden><label for="fVend">Vendedor de la novedad</label><select id="fVend" onchange="cambiarVendForm(this.value)">${vendedoresAgenda().filter(x => comercial(x)).map(x => `<option value="${x}" ${x === agenda.vendedor ? 'selected' : ''}>${esc(nombreVendedor(x))} · ${esc(comercial(x)?.zona || '')}</option>`).join('')}</select></div>` : ''}
        <div class="fila-fecha compacta">
            <div><label for="fFecha" id="lblFecha">Fecha</label><input id="fFecha" type="date" required value="${v?.fecha || agenda.fecha}"></div>
            <div id="cajaHora"><label for="fHora">Cita fija <small>(opcional)</small></label><input id="fHora" type="time" title="Solo si tienes una cita acordada: te avisamos 15 minutos antes" value="${esc(v?.hora)}"></div>
            <div id="cajaHasta" hidden><label for="fHasta">Hasta</label><input id="fHasta" type="date" value="${esc(v?.hasta)}"></div>
        </div>
        <div id="cajaQue"${bloqueado ? ' hidden' : ''}>
        <label for="fTipo">¿Qué vas a programar?</label>
        <select id="fTipo" required onchange="limpiarPlanVisita(true)">
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
                <label for="pTel">Teléfono ${REQ}</label>
                <input id="pTel" type="tel" inputmode="tel" placeholder="Ej: 300 123 4567">
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
            <label id="lblObjetivos">Objetivos de la visita <small>(puedes escoger varios)</small></label>
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
    tiposForm = v?.tiposVisita?.length ? v.tiposVisita.slice() : v && (TIPOS_VISITA[v.tipoVisita] || v.tipoVisita === VMC) ? [v.tipoVisita] : null;
    cambiarTipoProgramacion(v?.objetivos || [], v?.subobjetivos || {});
    if (v && v.clase === 'visita') avisoProgramacion(v);
    if (contactoPlan) {
        advertenciaAceptada = agenda.fecha;
        $('fContacto').value = contactoPlan;
        const zona = comercial(agenda.vendedor)?.zona;
        const p = buscarProyecto(zona, contactoPlan);
        const m = maestraForm(contactoPlan);
        $('fTipo').value = p ? 'nuevo' : esTrabajoInterno(contactoPlan) ? contactoPlan : m ? tipoDeCliente(m) : 'Visita Cliente';
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
    $('fContacto').addEventListener('change', () => { limpiarPlanVisita(false); sugerirTipo(); pintarTipoCliente(); });
    $('fContacto').addEventListener('input', revisarProyecto);
    $('fFecha').addEventListener('change', () => { avisoProgramacion(v && v.clase === 'visita' ? v : null); pintarObjetivos(); });
}

// Si el vendedor cambia qué va a programar o el cliente, el formulario se limpia (objetivos, subcategorías,
// qué va a hacer y modalidad); al cambiar qué va a programar también se borra el cliente. Fecha y hora se conservan.
function limpiarPlanVisita(cambioTipo) {
    tiposForm = null;
    if (cambioTipo) { $('fContacto').value = ''; revisarProyecto(); }
    $('fObjetivo').value = '';
    $('fObjetivoCuenta').textContent = '0 / 100';
    document.querySelectorAll('#modalContenido .modalidad button').forEach(b => b.classList.toggle('on', b.dataset.mod === 'presencial'));
    $('fObjetivos').innerHTML = '';
    if (cambioTipo) cambiarTipoProgramacion([], {});
}

// Muestra u oculta los campos según sea una visita, un trabajo interno o una novedad
function cambiarTipoProgramacion(marcados, subsMarcados) {
    const tipo = tipoBase();
    $('cajaTipoNuevo').hidden = origenElegido() !== 'nuevo';
    elegirOrigen(origenElegido());
    const interno = esTrabajoInterno(tipo);
    const novedad = esNovedad(tipo);
    $('cajaContacto').hidden = interno || novedad;
    // Jefes: visitas y trabajo interno a su nombre; la novedad es del vendedor que se está viendo (o el que escoja)
    if (esJefe() && programandoNuevo) {
        if ($('cajaVend')) $('cajaVend').hidden = !novedad;
        if (novedad && $('fVend') && !comercial(agenda.vendedor)) agenda.vendedor = $('fVend').value;
        $('fQuien').textContent = novedad ? `Novedad de ${nombreVendedor(agenda.vendedor)}` : `${sesion.nombre} · queda a tu nombre`;
    }
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
    // Permiso e incapacidad: el detalle es obligatorio; cumpleaños no lleva detalle; en las demás novedades es opcional
    const cumple = tipo === 'Cumpleaños';
    ['lblNotas', 'fObjetivo'].forEach(x => { $(x).hidden = cumple; });
    // Al escoger Cumpleaños la fecha se pone sola en el día guardado del vendedor
    const uc = cumple && USUARIOS.find(x => x.id === agenda.vendedor);
    if (uc?.cumple && $('fFecha').value && !esCumple(uc.id, $('fFecha').value)) $('fFecha').value = $('fFecha').value.slice(0, 4) + uc.cumple.slice(4);
    $('lblNotas').innerHTML = DETALLE_OBLIGATORIO[tipo] ? `Detalle ${REQ} <small>(${DETALLE_OBLIGATORIO[tipo]})</small>` : novedad ? 'Detalle <small>(opcional)</small>' : `¿Qué vas a hacer? ${REQ} <small>(describe brevemente)</small>`;
    $('fObjetivoCuenta').hidden = novedad;
    if (tipo === 'Incapacidad') $('fObjetivo').placeholder = 'Ej: incapacidad por EPS, gripa, cirugía';
    $('fObjetivoCuenta').textContent = $('fObjetivo').value.length + ' / 100';
    $('fObjetivo').placeholder = novedad ? 'Ej: incapacidad por EPS, cita de control' : interno ? 'Ej: cotizaciones pendientes, informe de cartera' : 'Ej: llevar lista de precios nueva';
    pintarTipoCliente(true);
    $('lblObjetivos').innerHTML = `${interno ? 'Objetivos del trabajo' : 'Objetivos de la visita'} <small>(puedes escoger varios)</small>`;
    pintarObjetivos(marcados, subsMarcados);
    avisoProgramacion(null);
}

// Clientes con clasificación que sale en Visita Médica y Visita Cliente (hoy 20 y 21): al lado del cliente se
// marca una, otra o ambas. Los demás clientes solo salen en el tipo de visita de su clasificación.
let tiposForm = null;
function clienteDelForm() {
    if (!esTipoVisita($('fTipo')?.value)) return null;
    return maestraForm($('fContacto').value) || null;
}
function tiposCliente() {
    const f = $('fTipo').value, c = clienteDelForm();
    if (!c || !permiteAmbos(c) || !AMBOS_TIPOS.includes(f)) return [f];
    // Cliente 20 o 21: Visita Médica, Visita Médica Comercial o ambas (Visita Cliente en el menú = Médica Comercial)
    const porDefecto = [f === 'Visita Cliente' ? VMC : f];
    const elegidos = OPCIONES_2021.filter(t => (tiposForm || porDefecto).includes(t));
    return elegidos.length ? elegidos : porDefecto;
}
function pintarTipoCliente(sinObjetivos) {
    const caja = $('cajaTipoCliente'), c = clienteDelForm();
    const ver = !!c && permiteAmbos(c) && AMBOS_TIPOS.includes($('fTipo').value);
    caja.hidden = !ver;
    if (ver) {
        const ts = tiposCliente();
        caja.innerHTML = OPCIONES_2021.map(t => `<label class="check tipo-op"><input type="checkbox" value="${t}" ${ts.includes(t) ? 'checked' : ''} onchange="cambiarAmbos(this)"><span>${t}</span></label>`).join('')
            + '<small>marca una o ambas</small>';
    } else caja.innerHTML = '';
    // Debajo del cliente, su clasificación completa (número y descripción)
    const cc = maestraForm($('fContacto').value);
    $('fClasif').hidden = !(cc && (cc.cl || cc.ca)) || origenElegido() === 'nuevo';
    $('fClasif').innerHTML = cc ? `Clasificación <b>${esc(cc.cl || '')}</b>${cc.ca ? ' · ' + esc(cc.ca) : ''}` : '';
    if (!sinObjetivos) pintarObjetivos();
}
function cambiarAmbos(casilla) {
    const marcados = [...$('cajaTipoCliente').querySelectorAll('input:checked')].map(i => i.value);
    if (!marcados.length) { casilla.checked = true; return toast('Marca al menos un tipo de visita'); }
    tiposForm = OPCIONES_2021.filter(t => marcados.includes(t));
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
            : k === 'remota'
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'} ${t}</button>`).join('')}</div>`;
}

function elegirModalidad(boton) {
    boton.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === boton));
}

const modalidadElegida = () => document.querySelector('.modalidad .on')?.dataset.mod || 'presencial';

// Muestra los objetivos del tipo de visita elegido, conservando los que ya estén marcados
function pintarObjetivos(marcados, subsMarcados) {
    const tipo = tiposElegidos(), nuevo = origenElegido() === 'nuevo', cont = $('fObjetivos');
    const actuales = marcados || leerObjetivos(cont);
    const subs = subsMarcados || leerSubs(cont);
    ctxCircular = { cliente: clienteDelForm() || null, fecha: $('fFecha').value || agenda.fecha };
    const lista = esTipoVisita($('fTipo').value) && !clienteDelForm() ? [] : objetivosDeTipos(tipo, nuevo);
    $('cajaObjetivos').hidden = !lista.length;
    const textoAntes = $('fPersonal') ? $('fPersonal').value : textoPersonalForm;
    const conPersonal = lista.length && !esTrabajoInterno(tipoBase());
    cont.innerHTML = htmlObjetivos(lista, { tipo, nuevo, mes: mesDe($('fFecha').value || agenda.fecha), marcados: actuales, subs })
        + (conPersonal ? htmlPersonal(actuales.includes(PERSONALIZADA), textoAntes) : '');
}
// Objetivo "Otros": al marcarlo se escribe cuál es (máximo 50 caracteres)
let textoPersonalForm = '';
function htmlPersonal(marcado, texto) {
    return `<div class="obj-item personal${marcado ? ' abierto' : ''}" style="--h:0"><label class="check"><input type="checkbox" class="obj" value="${PERSONALIZADA}" ${marcado ? 'checked' : ''} onchange="abrirSubs(this)"><span>${PERSONALIZADA}</span></label>
        <div class="subs"${marcado ? '' : ' hidden'}><input id="fPersonal" maxlength="50" placeholder="¿Cuál? Ej: acompañamiento a evento" value="${esc(texto || '')}" oninput="textoPersonalForm = this.value; $('fPersonalCuenta').textContent = this.value.length + ' / 50'"><p class="cuenta-nota" id="fPersonalCuenta">${(texto || '').length} / 50</p></div></div>`;
}

// Objetivos con sus subcategorías. Al marcar un objetivo se abren sus subcategorías.
// En el cierre (con "programados") lo programado va en negrita y lo demás en gris claro.
// Color de cada objetivo (tono HSL): el objetivo va con un fondo suave y sus subcategorías con el mismo tono más tenue.
// El tono refleja el tipo de objetivo (cartera = ámbar, reclamos = rojo, productos = verde…)
const TONO_OBJETIVO = {
    'Actividades': 280, 'Actividades Mes': 280, 'Parrilla Promocional': 25, 'Exhibición': 95,
    'Administración de Cartera': 42, 'Precios': 55,
    'Codificación de Producto': 205, 'Colocación': 150, 'Productos Nuevos': 125, 'Desarrollo Productos': 255,
    'Mapa del Cliente': 180, 'Mapa del Cliente - Ampliación Portafolio': 180, 'Entrega de Muestras': 320, 'Protocolo Médico': 230,
    'Devoluciones - PQR': 0, 'Trámites y Reclamos': 0,
    'Visiplan': 210, 'Diagnóstico de Zona': 190, 'Plan de Acción': 30, 'Plan de Trabajo Diario': 160,
    'Capacitación': 240, 'Interacción con Áreas': 170, 'Reunión Ventas': 300, 'Revisión Correos': 215, 'Seguimiento': 140, 'Seguimientos': 140
};
const tonoObjetivo = o => TONO_OBJETIVO[o] ?? [...o].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
// Subcategorías guardadas con el nombre anterior (antes de pasarlas a nombre propio o renombrarlas)
const SUBS_VIEJAS = { 'precios de la competencia': 'Chequeo de Precios', 'presentacion del protocolo': 'Presentación Protocolo Médico' };
const tieneSub = (arr, x) => (arr || []).some(y => normalizar(SUBS_VIEJAS[normalizar(y)] || y) === normalizar(x));
// Circular en "Actividades": al marcarla se abren sus productos para escoger y su objetivo (desplegable)
const hijoCircular = (c, que) => `${c.c} › ${que}`;
function htmlCircularSub(o, x, subs, estilo, subsProg) {
    const c = circularDeEtiqueta(x), marcada = tieneSub(subs[o], x);
    const hijo = (valor, texto) => `<label class="check sub circ-hijo${estilo(valor, subsProg[o] || [])}"><input type="checkbox" data-o="${esc(o)}" data-padre="${esc(x)}" value="${esc(valor)}" ${tieneSub(subs[o], valor) ? 'checked' : ''}><span>${texto}</span></label>`;
    // El objetivo de la circular se lee en un desplegable; los productos se escogen
    const hijos = (c.objetivo ? `<details class="circ-obj"><summary>Ver objetivo</summary><p>${esc(c.objetivo)}</p></details>` : '')
        + (c.productos || []).map(p => hijo(hijoCircular(c, `[${p.c}]`), esc(productoPorCodigo[p.c] ? nombreProducto(p.c) : `[${p.c}]${p.n ? ' ' + p.n : ''}`))).join('');
    return `<div class="circ-sub"><label class="check sub${estilo(x, subsProg[o] || [])}"><input type="checkbox" data-o="${esc(o)}" value="${esc(x)}" data-circ="1" ${tieneSub(subs[o], x) ? 'checked' : ''}><span>${esc(x)}</span>${enlacePdfSub(o, x)}</label>`
        + (hijos ? `<div class="circ-hijos"${marcada ? '' : ' hidden'}>${hijos}</div>` : '') + '</div>';
}
document.addEventListener('change', e => {
    const t = e.target;
    if (t.matches?.('.circ-sub input[data-circ]')) {
        const caja = t.closest('.circ-sub').querySelector('.circ-hijos');
        if (caja) { caja.hidden = !t.checked; if (!t.checked) caja.querySelectorAll('input').forEach(i => { i.checked = false; }); }
    } else if (t.matches?.('.circ-hijos input') && t.checked) {
        const padre = t.closest('.circ-sub').querySelector('input[data-circ]');
        if (padre) padre.checked = true;
    }
}, true);
// En "Actividades", cada circular trae su PDF (si ya se pegó el enlace)
function enlacePdfSub(o, x) {
    const c = o === 'Actividades' && circularDeEtiqueta(x), pdfs = c ? pdfsCircular(c) : [];
    return pdfs.map((u, i) => `<a class="pdf-circ" href="${esc(u)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">PDF${pdfs.length > 1 ? ' ' + (i + 1) : ''}</a>`).join('');
}
function htmlObjetivos(lista, { tipo, nuevo, mes, marcados = [], subs = {}, programados = null, subsProg = {} }) {
    return lista.map(o => {
        const sc = subcategoriasDe(tipo, nuevo, o, mes);
        const prog = programados && programados.includes(o);
        const abierto = marcados.includes(o) || prog;
        const estilo = (lo, de) => programados ? (tieneSub(de, lo) ? ' programado' : ' no-programado') : '';
        const labelSub = x => `<label class="check sub${estilo(x, subsProg[o] || [])}"><input type="checkbox" data-o="${esc(o)}" value="${esc(x)}" ${tieneSub(subs[o], x) ? 'checked' : ''}><span>${esc(x)}</span>${enlacePdfSub(o, x)}</label>`;
        const cajaSubs = sc.length
            ? `<div class="subs"${abierto ? '' : ' hidden'}>${sc.map(x => o === 'Actividades' && circularDeEtiqueta(x) ? htmlCircularSub(o, x, subs, estilo, subsProg) : labelSub(x)).join('')}</div>`
            : o === 'Actividades' && CIRCULARES.length ? `<div class="subs"${abierto ? '' : ' hidden'}><p class="ayuda">No hay circulares vigentes para este cliente en esta fecha.</p></div>`
            : o === 'Parrilla Promocional' && CIRCULARES.length ? `<div class="subs"${abierto ? '' : ' hidden'}><p class="ayuda">No hay parrilla promocional vigente para este cliente en esta fecha.</p></div>`
            : esVariable(o) ? `<div class="subs"${abierto ? '' : ' hidden'}><p class="ayuda">Aún no se cargan ${o === 'Parrilla Promocional' ? 'los productos de la parrilla' : 'las actividades'} de ${nombreMes(mes)}.</p></div>` : '';
        return `<div class="obj-item${abierto && cajaSubs ? ' abierto' : ''}" style="--h:${tonoObjetivo(o)}"><label class="check${estilo(o, programados || [])}"><input type="checkbox" class="obj" value="${esc(o)}" ${marcados.includes(o) ? 'checked' : ''} onchange="abrirSubs(this)"><span>${esc(o)}</span></label>${cajaSubs}</div>`;
    }).join('');
}
function abrirSubs(casilla) {
    const item = casilla.closest('.obj-item'), caja = item.querySelector('.subs');
    if (!caja) return;
    const ver = casilla.checked || !!item.querySelector('.check.programado');
    caja.hidden = !ver;
    item.classList.toggle('abierto', ver);
}
// Al marcar una subcategoría se marca también su objetivo (al programar y al cerrar)
document.addEventListener('change', e => {
    if (!e.target.matches?.('.obj-item .subs input') || !e.target.checked) return;
    const obj = e.target.closest('.obj-item').querySelector('input.obj');
    if (obj && !obj.checked) obj.checked = true;
}, true);
const leerObjetivos = cont => [...cont.querySelectorAll('input.obj:checked')].map(i => i.value);
function leerSubs(cont, soloDe) {
    const r = {};
    cont.querySelectorAll('.subs input:checked').forEach(i => {
        if (soloDe && !soloDe.includes(i.dataset.o)) return;
        (r[i.dataset.o] = r[i.dataset.o] || []).push(i.value);
    });
    return r;
}
// Objetivo programado sin marcar ninguna subcategoría: se asume que se van a hacer todas sus subcategorías
function conTodasLasSubs(subs, objetivos, tipo, nuevo, mes) {
    const r = { ...subs };
    objetivos.forEach(o => { if (!(r[o] || []).length) { const todas = subcategoriasDe(tipo, nuevo, o, mes); if (todas.length) r[o] = todas; } });
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
            <div class="checks" id="rCumplidos">${htmlObjetivos(objetivosCierre(v), { tipo: tiposDe(v), nuevo: v.esProyecto, mes: mesDe(v.fecha), programados: programadosVigentes(v), subsProg: conTodasLasSubs(v.subobjetivos || {}, programadosVigentes(v), tiposDe(v), v.esProyecto, mesDe(v.fecha)) })}</div>` : '';
// Texto de subcategorías junto a un objetivo (✓ en las cumplidas)
function textoSubs(v, o) {
    if (o === PERSONALIZADA && typeof v.personalizada === 'string' && v.personalizada) return `<small class="sub-chip">: ${esc(v.personalizada)}</small>`;
    const prog = (v.subobjetivos || {})[o] || [], cumpl = (v.subCumplidos || {})[o] || [];
    const todas = [...prog, ...cumpl.filter(x => !prog.includes(x))];
    return todas.length ? `<small class="sub-chip">: ${todas.map(x => (cumpl.includes(x) ? '✓ ' : '') + esc(x)).join(', ')}</small>` : '';
}


function sugerirTipo() {
    if ($('fTipo').value) return;
    const zona = comercial(agenda.vendedor)?.zona;
    const nombre = $('fContacto').value;
    const c = maestraForm(nombre);
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
    const textoPersonal = objetivos.includes(PERSONALIZADA) ? ($('fPersonal')?.value || '').trim() : '';
    if (objetivos.includes(PERSONALIZADA) && !textoPersonal) { toast('Escribe cuál es la visita personalizada (máximo 50 caracteres)'); $('fPersonal')?.focus(); return; }
    const subobjetivos = conTodasLasSubs(leerSubs($('fObjetivos'), objetivos), objetivos, tiposElegidos(), origenElegido() === 'nuevo', mesDe(fechaElegida));
    if (!objetivos.length) { toast(interno ? 'Escoge al menos un objetivo del trabajo' : 'Escoge al menos un objetivo de la visita'); return; }
    if (!$('fObjetivo').value.trim()) { toast('Escribe qué vas a hacer (máximo 100 caracteres)'); $('fObjetivo').focus(); return; }
    const zona = comercial(agenda.vendedor)?.zona;
    const nuevo = !interno && origenElegido() === 'nuevo';
    let c = interno ? {} : maestraForm(nombre) || {};
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
    if (!interno && !nuevo && !tiposDeCliente(c).includes($('fTipo').value)) {
        toast(`${c.n} (clasificación ${c.cl}) es de ${tiposDeCliente(c).join(' o ')}. Cambia el tipo de visita.`);
        return;
    }
    const tipos = interno || nuevo ? [tipo] : tiposElegidos();
    // Contacto nuevo: el teléfono es obligatorio (mínimo 7 dígitos)
    if (nuevo && !proyecto && $('pTel').value.replace(/\D/g, '').length < 7) {
        $('pTel').focus();
        toast('Escribe el teléfono del contacto nuevo');
        return;
    }
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
                zona, vendedor: esJefe() ? sesion.id : agenda.vendedor, fecha: hoy(), creado: new Date().toISOString(), creadoPor: sesion.id
            };
            guardarRegistro(proyecto);
        }
        c = { n: proyecto.nombre, e: 'Contacto nuevo · ' + proyecto.tipo, c: proyecto.ciudad };
    }
    const antes = id ? registros[id] : null;
    const fecha = $('fFecha').value;
    const v = antes ? { ...antes } : {
        // Lo que programa un jefe queda a su nombre (no suma a la zona); si confirma lo del Visiplan, es del vendedor
        id: nuevoId(), clase: 'visita', vendedor: esJefe() && !confirmandoPlan ? sesion.id : agenda.vendedor, estado: 'pendiente',
        creado: new Date().toISOString(), creadoPor: sesion.id
    };
    // Si al editar se cambia la fecha, la visita queda como reprogramada (en rojo) y en el Visiplan la X planeada no se mueve
    if (antes && antes.fecha !== fecha && !antes.adelantada) Object.assign(v, { origen: 'reprogramada', vieneDe: antes.vieneDe || antes.fecha });
    Object.assign(v, {
        interno, personalizada: textoPersonal,
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
    // El jefe ve la visita que quedó a su nombre
    if (esJefe() && !vendedoresAgenda().includes(v.vendedor)) { agenda.vendedores = [...vendedoresAgenda(), v.vendedor]; }
    if (v.fecha !== agenda.fecha) elegirFecha(v.fecha); else pintarAgenda();
}

// Novedades con detalle obligatorio (y qué se pide)
const DETALLE_OBLIGATORIO = { 'Permiso': 'motivo del permiso', 'Incapacidad': 'razón de la incapacidad' };
function guardarNovedad(id, tipo) {
    const desde = $('fFecha').value;
    const porHoras = NOVEDAD_HORAS.includes(tipo) && !$('fDiaCompleto').checked;
    const horaInicio = porHoras ? $('fHoraInicio').value : '', horaFin = porHoras ? $('fHoraFin').value : '';
    if (porHoras && (!horaInicio || !horaFin)) return toast(`Escribe la hora de inicio y la hora de finalización ${tipo === 'Permiso' ? 'del permiso' : 'de la cita médica'}`);
    if (porHoras && horaFin <= horaInicio) return toast('La hora de finalización debe ser después de la hora de inicio');
    const hasta = NOVEDAD_RANGO.includes(tipo) && !porHoras && $('fHasta').value ? $('fHasta').value : desde;
    if (hasta < desde) return toast('La fecha "Hasta" no puede ser antes de "Desde"');
    if (DETALLE_OBLIGATORIO[tipo] && !$('fObjetivo').value.trim()) { $('fObjetivo').focus(); return toast(`Escribe el detalle: ${DETALLE_OBLIGATORIO[tipo]}`); }
    // Cumpleaños: solo el día guardado del vendedor
    const u = USUARIOS.find(x => x.id === agenda.vendedor);
    if (tipo === 'Cumpleaños' && u?.cumple && !esCumple(u.id, desde)) {
        return dialogo({ tono: 'fiesta', titulo: 'Esa no es la fecha', texto: `El cumpleaños de ${u.nombre} es el ${Number(u.cumple.slice(8))} de ${nombreMes(u.cumple.slice(0, 7)).split(' ')[0]}. Elige esa fecha.`, aceptar: 'Entendido', cancelar: '' });
    }
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
    const varios = vendedoresAgenda().length > 1;
    return `<div class="producto-card novedad-card">
        <div class="visita-cab"><div>${varios ? `<span class="vend-card">${esc(nombreVendedor(n.vendedor))}</span>` : ''}<h3>${esc(n.tipo)}</h3></div><span class="chip gris">Novedad</span></div>
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

// ---------- CIERRE DE VISITA: pedido, productos y muestras ----------
// Catálogo de productos (productos.js, herramientas/productos.py). Nuevo, Foco y Transición-Impulso se despliegan y se buscan
// por código o nombre; Portafolio y Consultorio van cerradas (solo se marcan).
const CATALOGO = window.CATALOGO || { desplegables: ['Nuevo', 'Foco', 'Transición-Impulso'], cerradas: ['Portafolio', 'Consultorio'], productos: [] };
const productoPorCodigo = Object.fromEntries(CATALOGO.productos.map(p => [p.c, p]));
const nombreProducto = c => productoPorCodigo[c] ? `[${c}] ${productoPorCodigo[c].n}` : c;
// Pedido: sale solo si en Colocación se cumplió Producto Terminado, Magistral Individual o Magistral de Pedido.
// El número de pedido lleva prefijo A (Producto Terminado), B (Magistral de Pedido) o A/B (Magistral Individual).
// Magistral Individual puede llevar dos pedidos en la misma visita: uno OV y otro OVI (basta con uno)
const PEDIDO_CATS = { 'Producto Terminado': ['OVI'], 'Magistral Individual': ['OV', 'OVI'], 'Magistral de Pedido': ['OV'] };
// Los pedidos tienen 6 cifras: se escriben solo los números y se completan con ceros a la izquierda (123 → 000123)
const DIGITOS_PEDIDO = 6;
const cifrasPedido = t => { const d = String(t || '').replace(/\D/g, '').slice(-DIGITOS_PEDIDO); return d ? d.padStart(DIGITOS_PEDIDO, '0') : ''; };
const partesPedido = num => { const m = String(num || '').toUpperCase().match(/^(OVI|OV)?\s*(\d*)$/); return m ? { pre: m[1] || '', dig: m[2] || '' } : { pre: '', dig: '' }; };
const TIPOS_MUESTRA = ['Muestra Médica', 'Muestra Comercial', 'Tester'];
// Lo que indica que se presentaron productos (objetivos o subcategorías cumplidas)
const OBJ_PRESENTA = ['Productos Nuevos', 'Mapa del Cliente', 'Mapa del Cliente - Ampliación Portafolio'];
const SUBS_PRESENTA = ['Presentación del Producto', 'Productos Nuevos', 'Productos Foco', 'Productos Transición', 'Portafolio Actual', 'Portafolio', 'Producto Nuevo'];

// Concepto estratégico y mensaje comercial de la etiqueta (hoja "Guía de etiquetas" de la base de productos)
// Sale al tocar el ⓘ que va al lado de cada etiqueta (sirve igual en computador y celular)
const guiaEtiqueta = cat => { const g = (CATALOGO.guia || {})[cat]; return g && (g.concepto || g.mensaje) ? `<button type="button" class="info-etq" title="Ver concepto y mensaje de ${esc(cat)}" aria-label="Información de ${esc(cat)}" onclick="verGuia(event, this)">ⓘ</button><span class="guia-etq" role="tooltip"><b>${esc(cat)}</b>${g.concepto ? `<span><b>Concepto estratégico:</b> ${esc(g.concepto)}</span>` : ''}${g.mensaje ? `<span><b>Mensaje comercial:</b> ${esc(g.mensaje)}</span>` : ''}</span>` : ''; };
// Selector de productos por categoría. Nuevo, Foco y Transición: lista desplegable con buscador (código o nombre),
// "Todos" y selección de uno o varios; lo marcado se conserva aunque se busque otro. Las cerradas solo se marcan.
function htmlSelProductos(id, cats, sel = {}) {
    const abre = cats.filter(c => CATALOGO.desplegables.includes(c)), cerr = cats.filter(c => !CATALOGO.desplegables.includes(c));
    // Fila de etiquetas: las desplegables abren su lista al tocarlas (▾); las cerradas se marcan con un toque. Cada una con ⓘ.
    return `<div class="sel-prod" id="${id}"><div class="sel-etqs">${abre.map(cat => {
        const lista = CATALOGO.productos.filter(p => p.e.includes(cat));
        return `<div class="con-guia dd-prod" data-cat="${esc(cat)}"><button type="button" class="btn-etq dd-btn" onclick="abrirDdProductos(this)" ${lista.length ? '' : 'disabled'}><span></span> ▾</button>${guiaEtiqueta(cat)}</div>`;
    }).join('')}${cerr.map(cat => `<div class="con-guia"><label class="btn-etq"><input type="checkbox" class="cat" data-cat="${esc(cat)}" ${sel[cat] ? 'checked' : ''}><span>${esc(cat)}</span></label>${guiaEtiqueta(cat)}</div>`).join('')}</div>
        ${abre.map(cat => {
            const elegidos = Array.isArray(sel[cat]) ? sel[cat] : [], lista = CATALOGO.productos.filter(p => p.e.includes(cat));
            return `<div class="dd-panel" data-cat="${esc(cat)}" hidden>
                <p class="dd-titulo">${esc(cat)}</p>
                <input class="sel-busca" placeholder="Buscar por código o nombre..." oninput="buscarProductos(this)" autocomplete="off">
                <label class="mc-multi-todas"><input type="checkbox" class="dd-todos" onchange="todosDdProductos(this)"><span>Todos (${lista.length})</span></label>
                <div class="sel-ops dd-lista">${lista.map(p => `<label data-q="${esc(normalizar(p.c + ' ' + p.n))}"><input type="checkbox" value="${esc(p.c)}" ${elegidos.includes(p.c) ? 'checked' : ''} onchange="pintarSelProductos(this.closest('.sel-prod'))"><span><b>${esc(p.c)}</b> ${esc(p.n)}</span></label>`).join('')}</div>
            </div>`;
        }).join('')}
        <div class="dd-elegidos"></div></div>`;
}
function verGuia(e, boton) {
    e.preventDefault(); e.stopPropagation();
    const caja = boton.closest('.con-guia'), abrir = !caja.classList.contains('ver');
    document.querySelectorAll('.con-guia.ver').forEach(c => c.classList.remove('ver'));
    caja.classList.toggle('ver', abrir);
}
document.addEventListener('click', e => { if (!e.target.closest('.con-guia')) document.querySelectorAll('.con-guia.ver').forEach(c => c.classList.remove('ver')); });
// Texto de cada botón (cuántos elegidos) y productos elegidos debajo de las etiquetas
function pintarSelProductos(caja) {
    caja.querySelectorAll('.dd-panel').forEach(panel => {
        const cat = panel.dataset.cat, total = panel.querySelectorAll('.sel-ops input').length;
        const n = panel.querySelectorAll('.sel-ops input:checked').length;
        const btn = caja.querySelector(`.dd-prod[data-cat="${cat}"] .dd-btn`);
        btn.querySelector('span').textContent = !total ? `${cat} (sin productos)` : !n ? cat : n === total ? `${cat} · todos` : `${cat} · ${n}`;
        btn.classList.toggle('con', n > 0);
        panel.querySelector('.dd-todos').checked = !!total && n === total;
    });
    caja.querySelector('.dd-elegidos').innerHTML = [...caja.querySelectorAll('.dd-panel')].map(panel => {
        const marcados = [...panel.querySelectorAll('.sel-ops input:checked')], total = panel.querySelectorAll('.sel-ops input').length;
        if (!marcados.length) return '';
        return marcados.length === total ? `<span>${esc(panel.dataset.cat)}: todos</span>` : marcados.map(i => `<span>${esc(nombreProducto(i.value))}</span>`).join('');
    }).join('');
}
function abrirDdProductos(boton) {
    const caja = boton.closest('.sel-prod'), cat = boton.closest('.dd-prod').dataset.cat;
    const panel = caja.querySelector(`.dd-panel[data-cat="${cat}"]`), abrir = panel.hidden;
    document.querySelectorAll('.dd-panel').forEach(p => { p.hidden = true; });
    document.querySelectorAll('.dd-btn.abierto').forEach(b => b.classList.remove('abierto'));
    panel.hidden = !abrir;
    boton.classList.toggle('abierto', abrir);
    if (abrir) panel.querySelector('.sel-busca').focus();
}
function todosDdProductos(casilla) {
    const panel = casilla.closest('.dd-panel');
    panel.querySelectorAll('.sel-ops input').forEach(i => { i.checked = casilla.checked; });
    pintarSelProductos(panel.closest('.sel-prod'));
}
function buscarProductos(input) {
    const q = normalizar(input.value);
    input.parentElement.querySelectorAll('.sel-ops label').forEach(l => { l.hidden = !!q && !l.dataset.q.includes(q); });
}
document.addEventListener('click', e => {
    if (!document.contains(e.target) || e.target.closest('.dd-prod') || e.target.closest('.dd-panel')) return;
    document.querySelectorAll('.dd-panel').forEach(p => { p.hidden = true; });
    document.querySelectorAll('.dd-btn.abierto').forEach(b => b.classList.remove('abierto'));
});
function leerSelProductos(id) {
    const r = {};
    document.querySelectorAll(`#${id} .dd-panel`).forEach(c => {
        const cod = [...c.querySelectorAll('.sel-ops input:checked')].map(i => i.value);
        if (cod.length) r[c.dataset.cat] = cod;
    });
    document.querySelectorAll(`#${id} .sel-etqs input.cat:checked`).forEach(i => { r[i.dataset.cat] = true; });
    return r;
}
const htmlProductosReporte = sel => Object.entries(sel || {}).map(([cat, v]) => `<b class="cat-prod">${esc(cat)}${Array.isArray(v) && v.length ? ':' : ''}</b>${Array.isArray(v) && v.length ? ' ' + v.map(p => esc(nombreProducto(p))).join(', ') : ''}`).join(' · ');
const textoSelProductos = sel => Object.entries(sel || {}).map(([cat, v]) => Array.isArray(v) && v.length ? `${cat}: ${v.map(nombreProducto).join(', ')}` : cat).join(' · ');

// Muestras: por cada tipo entregado, producto (buscado por código o nombre) y cantidad
const opcionesProductos = () => CATALOGO.productos.map(p => `<option value="[${esc(p.c)}] ${esc(p.n)}">`).join('');
const filaMuestra = (tipo, m = {}) => `<div class="fila-muestra"><input list="dlProductos" class="m-prod" placeholder="Producto (código o nombre)" value="${esc(m.c ? nombreProducto(m.c) : '')}">
    <input type="number" class="m-cant" min="1" step="1" inputmode="numeric" placeholder="Cant." value="${esc(m.q || '')}">
    <button type="button" class="link-mini" onclick="this.parentElement.remove()" title="Quitar">✕</button></div>`;
function agregarMuestra(tipo) { $('muestras-' + tipo.replace(/\s/g, '')).insertAdjacentHTML('beforeend', filaMuestra(tipo)); }
function leerMuestras() {
    const r = {};
    document.querySelectorAll('#cajaMuestras .bloque-muestra:not([hidden])').forEach(b => {
        const filas = [...b.querySelectorAll('.fila-muestra')].map(f => {
            const t = f.querySelector('.m-prod').value.trim(), m = t.match(/^\[([^\]]+)\]/);
            return { c: m ? m[1] : t, q: Number(f.querySelector('.m-cant').value) || 0 };
        }).filter(x => x.c || x.q);
        r[b.dataset.tipo] = filas;
    });
    return r;
}
const textoMuestras = m => Object.entries(m || {}).filter(([, l]) => l.length).map(([t, l]) => `${t}: ${l.map(x => `${nombreProducto(x.c)} x${x.q}`).join(', ')}`).join(' · ');
const textoPedidos = v => (v.pedidos || []).map(p => `${p.cat} ${p.num}`).join(' · ');

// Muestra u oculta pedido, productos pedidos y muestras según lo que se marca en los objetivos cumplidos
function actualizarCierreVisita() {
    const cont = $('rCumplidos');
    if (!cont || !$('cajaPedido')) return;
    const { objetivosCumplidos: objs, subCumplidos: subs } = leerCierre();
    // Pedido: sale al marcar Colocación. Se elige la categoría del pedido (las subcategorías marcadas vienen elegidas)
    const conColocacion = objs.includes('Colocación');
    $('cajaPedido').hidden = !conColocacion;
    const col = subs['Colocación'] || [];
    let hay = false;
    Object.keys(PEDIDO_CATS).forEach(cat => {
        const fila = $('pedido-' + cat.replace(/\s/g, '')), casilla = fila.querySelector('.p-cat');
        if (col.includes(cat) && !casilla.dataset.tocada) casilla.checked = true;
        fila.querySelector('.p-nums').hidden = !casilla.checked;
        hay = hay || (conColocacion && casilla.checked);
    });
    $('cajaProdPedidos').hidden = !hay;
    // Productos presentados: solo si en lo cumplido hay algo de presentar productos
    const presento = objs.some(o => OBJ_PRESENTA.includes(o)) || Object.values(subs).flat().some(x => SUBS_PRESENTA.includes(x));
    $('cajaProdPresentados').hidden = !presento;
    const mu = objs.includes('Entrega de Muestras') ? (subs['Entrega de Muestras'] || []) : [];
    let hayM = false;
    TIPOS_MUESTRA.forEach(t => {
        const b = document.querySelector(`#cajaMuestras .bloque-muestra[data-tipo="${t}"]`), ver = mu.includes(t);
        b.hidden = !ver; hayM = hayM || ver;
        if (ver && !b.querySelector('.fila-muestra')) agregarMuestra(t);
    });
    $('cajaMuestras').hidden = !hayM;
}

const contadorNota = (id, n = 100) => `<p class="ayuda cuenta-nota" id="${id}Cuenta">0 / ${n}</p>`;
const cuentaNota = (id, n = 100) => `oninput="$('${id}Cuenta').textContent = this.value.length + ' / ${n}'"`;

// Formulario para registrar lo que pasó: visitado / no visitado
function abrirRegistro(id, tipo) {
    const v = registros[id];
    const opciones = (lista, actual) => lista.map(o => `<option ${o === actual ? 'selected' : ''}>${esc(o)}</option>`).join('');
    if (!puedeReportar(v)) return toast(v.estado !== 'pendiente' ? 'Esta visita ya se cerró y no se puede modificar' : 'El plazo para reportar esta visita ya cerró');
    const mc = !v.interno && (buscarMaestra(comercial(v.vendedor)?.zona, v.contacto) || buscarEnTodas(v.contacto));
    ctxCircular = { cliente: mc || null, fecha: v.fecha };
    const cab = (v.interno ? `<p class="sub">${esc(v.contacto)} · ${esc(fechaCorta(v.fecha))}${v.hora ? ' · Cita ' + esc(horaBonita(v.hora)) : ''}</p>`
        : `<p class="cierre-cliente">${esc(v.contacto)}</p>${mc && (mc.cl || mc.ca) ? `<p class="clasif-cliente">Clasificación <b>${esc(mc.cl || '')}</b>${mc.ca ? ' · ' + esc(mc.ca) : ''}</p>` : ''}
        <p class="sub">${esc(fechaCorta(v.fecha))}${v.hora ? ' · Cita ' + esc(horaBonita(v.hora)) : ''}</p>`) + `
        <p class="aviso-hora">Plazo: ${esc(textoCierre(v))}. Después de guardar, el reporte no se puede modificar.</p>`;
    if (tipo === 'ok' && v.interno) {
        abrirModal(`<form class="form-rc" onsubmit="guardarInternoRealizado(event, '${id}')">
            <h2>Trabajo realizado</h2>${cab}
            ${cajaCierre(v)}
            <label for="rObs">¿Qué se hizo? ${REQ} <small>(describe brevemente)</small></label>
            <textarea id="rObs" maxlength="100" ${cuentaNota('rObs')} placeholder="Ej: se enviaron 5 cotizaciones y se cerró el informe de cartera">${esc(v.estado === 'visitado' ? v.observaciones : '')}</textarea>
            ${contadorNota('rObs')}
            <div class="form-botones">
                <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-primario">Guardar</button>
            </div>
        </form>`);
    } else if (tipo === 'ok') {
        const ya = v.estado === 'visitado';
        abrirModal(`<form class="form-rc" novalidate onsubmit="guardarVisitado(event, '${id}')">
            <h2>Cierre de Visita</h2>${cab}
            <label for="rAtendio">¿Quién atendió? ${REQ}</label>
            <input id="rAtendio" required value="${esc(ya ? v.atendio : '')}" placeholder="Nombre y cargo">
            <label>Modalidad</label>
            ${botonesModalidad(v.modalidad)}
            ${cajaCierre(v)}
            <div id="cajaPedido" class="caja-cierre" hidden>
                <label>Pedido ${REQ} <small>(marca la categoría y escribe el número de ${DIGITOS_PEDIDO} cifras)</small></label>
                ${Object.entries(PEDIDO_CATS).map(([cat, pre]) => {
                    const antes = ((ya && v.pedidos) || []).filter(p => p.cat === cat).map(p => partesPedido(p.num));
                    return `<div class="fila-pedido" id="pedido-${cat.replace(/\s/g, '')}"><label class="check p-check"><input type="checkbox" class="p-cat" ${antes.length ? 'checked' : ''} onchange="this.dataset.tocada = 1; actualizarCierreVisita()"><span>${esc(cat)}</span></label>
                    <div class="p-nums">${pre.map(x => `<div class="p-num"><span class="p-pref">${x}</span>
                        <input class="n-pedido" data-cat="${esc(cat)}" data-pref="${x}" inputmode="numeric" maxlength="${DIGITOS_PEDIDO}" placeholder="000000" autocomplete="off" value="${esc(antes.find(a => a.pre === x)?.dig || '')}"
                            oninput="this.value = this.value.replace(/\\D/g, '')" onblur="this.value = cifrasPedido(this.value)"></div>`).join('')}</div></div>`;
                }).join('')}
            </div>
            <div id="cajaProdPedidos" hidden>
                <label>Productos pedidos</label>
                ${htmlSelProductos('rProdPedidos', [...CATALOGO.desplegables, ...CATALOGO.cerradas], ya ? v.productosPedidos : {})}
            </div>
            <div id="cajaProdPresentados" hidden>
                <label>Productos presentados</label>
                ${htmlSelProductos('rProdPresentados', [...CATALOGO.desplegables, ...CATALOGO.cerradas], ya ? v.productosPresentados : {})}
            </div>
            <div id="cajaMuestras" class="caja-cierre" hidden>
                <label>Muestras entregadas ${REQ} <small>(producto y cantidad)</small></label>
                <datalist id="dlProductos">${opcionesProductos()}</datalist>
                ${TIPOS_MUESTRA.map(t => `<div class="bloque-muestra" data-tipo="${t}" hidden><p class="obj-grupo">${t}</p>
                    <div id="muestras-${t.replace(/\s/g, '')}">${((ya && v.muestrasDetalle && v.muestrasDetalle[t]) || []).map(m => filaMuestra(t, m)).join('')}</div>
                    <button type="button" class="link-mini" onclick="agregarMuestra('${t}')">+ Agregar producto</button></div>`).join('')}
            </div>
            <label for="rCompromisos">Compromisos / Próximos Pasos / Observaciones ${REQ} <small>(describe brevemente)</small></label>
            <textarea id="rCompromisos" maxlength="100" ${cuentaNota('rCompromisos')} placeholder="Ej: volver el 15 con la lista de precios">${esc(ya ? v.compromisos : '')}</textarea>
            ${contadorNota('rCompromisos')}
            <label for="rProxima">Próxima visita <small>(opcional: queda programada en ese día y en el Visiplan)</small></label>
            <div class="fila-fecha compacta"><div><label for="rProxima">Fecha</label><input id="rProxima" type="date" min="${sumarDias(v.fecha, 1)}"></div>
                <div><label for="rProximaHora">Cita fija <small>(opcional)</small></label><input id="rProximaHora" type="time" title="Solo si es una reunión fija"></div></div>
            <div class="form-botones">
                <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-primario">Guardar visita</button>
            </div>
        </form>`);
        document.querySelectorAll('#modalContenido .sel-prod').forEach(pintarSelProductos);
        $('rCumplidos')?.addEventListener('change', actualizarCierreVisita);
        actualizarCierreVisita();
    } else {
        const ya = v.estado === 'no_visitado';
        abrirModal(`<form class="form-rc" onsubmit="guardarNoVisitado(event, '${id}')">
            <h2>${v.interno ? 'No realizado' : 'No visitado'}</h2>${cab}
            ${v.interno ? '' : `<label for="nMotivo">Motivo</label>
            <select id="nMotivo">${opciones(MOTIVOS, v.motivo)}</select>`}
            ${v.interno ? `<div class="fila-fecha compacta"><div><label for="nRepro">Fecha para programar <small>(opcional)</small></label>
                <input id="nRepro" type="date" min="${sumarDias(v.fecha, 1)}" value="${esc(ya ? v.reprogramadaPara : '')}" ${ya && v.reprogramadaPara ? 'disabled' : ''}></div>
                <div><label for="nReproHora">Hora <small>(opcional)</small></label><input id="nReproHora" type="time" ${ya && v.reprogramadaPara ? 'disabled' : ''}></div></div>`
            : `<label for="nRepro">Reprogramar para (opcional)</label>
            <input id="nRepro" type="date" min="${sumarDias(v.fecha, 1)}" value="${esc(ya ? v.reprogramadaPara : '')}" ${ya && v.reprogramadaPara ? 'disabled' : ''}>`}
            <label for="nObs">Observaciones${v.interno ? ' ' + REQ : ''}</label>
            <textarea id="nObs" ${v.interno ? 'required' : ''} placeholder="${v.interno ? 'Ej: se movió por reunión con gerencia' : 'Ej: la doctora estaba en cirugía'}">${esc(ya ? v.observaciones : '')}</textarea>
            <div class="form-botones">
                <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-primario" style="background:#c2413a">Guardar</button>
            </div>
        </form>`, 'theme-rojo');
    }
}

const LIMPIAR_VISITADO = { gestion: '', atendio: '', productos: '', muestras: '', pedido: '', valorPedido: '', compromisos: '',
    pedidos: [], productosPresentados: {}, productosPedidos: {}, muestrasDetalle: {} };
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
    actualizarCierreVisita();
    if (!$('rAtendio').value.trim()) { $('rAtendio').focus(); return toast('Escribe quién atendió (nombre y cargo)'); }
    // Números de pedido (Colocación): obligatorios y con su prefijo
    const pedidos = [];
    const colMarcada = !$('cajaPedido').hidden;
    if (colMarcada && !document.querySelector('#cajaPedido .p-cat:checked')) return toast('Marca la categoría del pedido: Producto Terminado, Magistral Individual o Magistral de Pedido');
    for (const fila of colMarcada ? document.querySelectorAll('#cajaPedido .p-nums:not([hidden])') : []) {
        const inps = [...fila.querySelectorAll('.n-pedido')], cat = inps[0].dataset.cat;
        const llenos = inps.filter(i => Number(cifrasPedido(i.value)));
        if (!llenos.length) { inps[0].focus(); return toast(`Escribe el número de pedido de ${cat}${inps.length > 1 ? ' (OV, OVI o ambos)' : ''}`); }
        llenos.forEach(i => { i.value = cifrasPedido(i.value); pedidos.push({ cat, num: i.dataset.pref + i.value }); });
    }
    const muestrasDetalle = $('cajaMuestras').hidden ? {} : leerMuestras();
    for (const [t, l] of Object.entries(muestrasDetalle)) {
        if (!l.length || l.some(x => !x.c || !x.q)) return toast(`Escribe el producto y la cantidad de ${t}`);
        const malo = l.find(x => !productoPorCodigo[x.c]);
        if (malo) return toast(`"${malo.c}" no está en el catálogo: búscalo por código o nombre`);
    }
    if (!$('rCompromisos').value.trim()) { $('rCompromisos').focus(); return toast('Escribe los compromisos, próximos pasos u observaciones (máximo 100 caracteres)'); }
    const productosPresentados = $('cajaProdPresentados').hidden ? {} : leerSelProductos('rProdPresentados'), productosPedidos = pedidos.length ? leerSelProductos('rProdPedidos') : {};
    const v = {
        ...registros[id], ...LIMPIAR_NO_VISITADO,
        estado: 'visitado',
        modalidad: modalidadElegida(),
        ...leerCierre(),
        gestion: '',
        atendio: $('rAtendio').value.trim(),
        productosPresentados, productos: textoSelProductos(productosPresentados),
        productosPedidos, muestrasDetalle, muestras: textoMuestras(muestrasDetalle),
        pedidos, pedido: pedidos.length ? 'si' : 'no', valorPedido: '',
        compromisos: $('rCompromisos').value.trim(),
        observaciones: '',
        proximaVisita: $('rProxima').value || '', proximaHora: $('rProxima').value ? $('rProximaHora').value : '',
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
        fecha, hora: antes.proximaHora || '', objetivo: antes.compromisos || '', vieneDe: antes.fecha,
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
// Los indicadores de arriba filtran (visitas = todas, efectivas, última y próxima; otro toque quita el filtro)
// y los meses se escogen en una lista desplegable (uno o varios)
let historial = { nombre: '', vendedor: '', f: '', sel: { a: [], s: [], t: [], m: [] } };
// Periodos de una fecha: año, semestre, trimestre y mes
const PERIODOS_HIST = {
    a: { t: 'Año', todos: 'Todos los años', de: f => f.slice(0, 4), nombre: v => v },
    s: { t: 'Semestre', todos: 'Todos los semestres', de: f => `${f.slice(0, 4)}-S${+f.slice(5, 7) <= 6 ? 1 : 2}`, nombre: v => `${v.slice(-1)}.º semestre ${v.slice(0, 4)}` },
    t: { t: 'Trimestre', todos: 'Todos los trimestres', de: f => `${f.slice(0, 4)}-T${Math.ceil(+f.slice(5, 7) / 3)}`, nombre: v => `Trimestre ${v.slice(-1)} · ${v.slice(0, 4)}` },
    m: { t: 'Mes', todos: 'Todos los meses', de: f => mesDe(f), nombre: v => mayuscula(nombreMes(v)) }
};
function verCliente(nombre, vendedor) {
    historial = { nombre, vendedor, f: '', sel: { a: [], s: [], t: [], m: [] } };
    MULTI.historial.abierto = null;

    pintarHistorial();
}
function filtrarHistorial(f) { historial.f = historial.f === f ? '' : f; pintarHistorial(); }
const visitasCliente = nombre => visibles().filter(x => x.clase === 'visita' && !x.interno && normalizar(x.contacto) === normalizar(nombre))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
const valoresHistorial = k => [...new Set(visitasCliente(historial.nombre).map(x => PERIODOS_HIST[k].de(x.fecha)))].sort().reverse();
const pasaPeriodo = (k, x) => { const sel = historial.sel[k]; return !sel.length || sel.includes(PERIODOS_HIST[k].de(x.fecha)); };
function pintarHistorial() {
    const { nombre, vendedor } = historial;
    const conFiltroPeriodo = Object.values(historial.sel).some(l => l.length);
    const lista = visitasCliente(nombre).filter(x => Object.keys(PERIODOS_HIST).every(k => pasaPeriodo(k, x)));
    const zona = comercial(vendedor)?.zona;
    const m = buscarMaestra(zona, nombre) || buscarEnTodas(nombre), p = buscarProyecto(zona, nombre);
    const efectivas = lista.filter(x => x.estado === 'visitado');
    const proxima = lista.filter(x => x.estado === 'pendiente' && x.fecha >= hoy()).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const estadoTxt = { visitado: ['ok', 'Visitado'], no_visitado: ['no', 'No visitado'], pendiente: ['p', 'Pendiente'] };
    const filtro = { ok: x => x.estado === 'visitado', ultima: x => x === efectivas[0], prox: x => x === proxima }[historial.f] || (() => true);
    const vistas = lista.filter(filtro);
    const boton = (f, clase, html) => `<button type="button" class="chip chip-filtro ${clase}${historial.f === f ? ' activo' : ''}" onclick="filtrarHistorial('${f}')" aria-pressed="${historial.f === f}">${html}</button>`;
    const chipsMes = visitasCliente(nombre).length > 1 ? '<div class="hist-periodos" id="histMeses"></div>' : '';
    const filas = vistas.map(x => {
        const [cls, txt] = estadoTxt[x.estado] || ['p', x.estado];
        const partes = x.estado === 'visitado' ? partesReporte(x, true) : x.estado === 'no_visitado' ? [`<b>${esc(x.motivo || '')}</b>`, x.observaciones ? esc(x.observaciones) : ''] : [x.objetivo ? esc(x.objetivo) : ''];
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
        ${chipsMes}
        <div class="resumen-dia hist-resumen">
            ${boton('', 'gris', `<b>${lista.length}</b> ${lista.length === 1 ? 'visita' : 'visitas'}`)}
            ${boton('ok', 'ok', `${efectivas.length} efectivas`)}
            ${efectivas[0] ? boton('ultima', 'gris', `Última: ${esc(fechaCorta(efectivas[0].fecha))}`) : ''}
            ${proxima ? boton('prox', 'prox', `Próxima: ${esc(fechaCorta(proxima.fecha))}`) : ''}
        </div>
        ${historial.f || conFiltroPeriodo ? `<p class="grupo-titulo filtro-activo">Mostrando ${vistas.length} de ${visitasCliente(nombre).length}</p>` : ''}
        ${filas || `<div class="no-results">${visitasCliente(nombre).length ? 'No hay visitas con este filtro.' : 'Todavía no hay visitas registradas para este cliente.'}</div>`}
        <div class="form-botones"><button type="button" class="btn-primario" onclick="cerrarModal()">Cerrar</button></div>
    </div>`);
    if ($('histMeses')) {
        // Cada filtro cuenta las visitas que pasan los demás filtros de periodo
        const todasV = visitasCliente(nombre);
        pintarMultis($('histMeses'), 'historial', Object.entries(PERIODOS_HIST).map(([k, d]) => {
            const valores = valoresHistorial(k), base = todasV.filter(x => Object.keys(PERIODOS_HIST).every(o => o === k || pasaPeriodo(o, x)));
            return { k, t: d.t, todos: d.todos, valores, nombre: d.nombre, cuenta: Object.fromEntries(valores.map(v => [v, base.filter(x => d.de(x.fecha) === v).length])) };
        }));
    }
}

function guardarInternoRealizado(e, id) {
    e.preventDefault();
    if (!plazoAbierto(id)) return;
    if (!$('rObs').value.trim()) { $('rObs').focus(); return toast('Escribe qué se hizo (máximo 100 caracteres)'); }
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
    const horaRepro = $('nReproHora') && !$('nReproHora').disabled ? $('nReproHora').value : '';
    const obs = $('nObs').value.trim();
    if (antes.interno && !obs) { toast('Escribe las observaciones'); $('nObs').focus(); return; }
    const v = {
        ...antes, ...LIMPIAR_VISITADO,
        estado: 'no_visitado',
        motivo: $('nMotivo') ? $('nMotivo').value : '',
        observaciones: obs,
        reprogramadaPara: repro || antes.reprogramadaPara || '',
        registrada: new Date().toISOString()
    };
    guardarRegistro(v);
    // La visita reprogramada queda como una nueva visita pendiente en esa fecha
    if (repro && !antes.reprogramadaPara) {
        guardarRegistro({
            id: nuevoId(), clase: 'visita', vendedor: antes.vendedor, estado: 'pendiente',
            contacto: antes.contacto, tipoContacto: antes.tipoContacto, ciudad: antes.ciudad,
            fecha: repro, hora: horaRepro, objetivo: antes.objetivo, vieneDe: antes.fecha, origen: 'reprogramada',
            modalidad: antes.modalidad, tipoVisita: antes.tipoVisita, tiposVisita: antes.tiposVisita, objetivos: antes.objetivos, interno: !!antes.interno,
            programada: Date.now() < limiteProgramacion(repro),
            creado: new Date().toISOString(), creadoPor: sesion.id
        });
    }
    cerrarModal();
    toast(repro ? `${antes.interno ? 'Programado' : 'Reprogramada'} para el ${fechaCorta(repro)}` : antes.interno ? 'Marcado como no realizado' : 'Marcada como no visitada');
    pintarAgenda();
}

// ---------- ACTIVIDADES-CIRCULARES ----------
// Dos vistas: Circulares (resumen con estado, días que faltan y PDF) y Tareas del mes (lo de antes)
let actVista = 'circulares';
const circulares = { filtro: 'vigente', busca: '', orden: 'circular', sel: { cl: [], cli: [], g: [], t: [] } };
// Grupo de producto: se unifica cómo viene escrito en el Excel ("Terminados", "Producto terminado"…)
function gruposCircular(c) {
    return [...new Set(String(c.grupo || '').split('/').map(x => {
        const k = normalizar(x);
        return !k ? '' : k.includes('individual') ? 'Magistral Individual' : k.includes('magistral') ? 'Magistral de Pedido'
            : k.includes('terminado') ? 'Producto Terminado' : k.includes('todo') ? 'Todos' : mayuscula(x.trim());
    }).filter(Boolean))];
}
// ¿La circular aplica a ese cliente (sin mirar fechas)?
const aplicaCliente = (c, cl) => !c.interna && !c.excluidos.includes(cl.n) && (c.todos || c.canales.includes(String(cl.cl || '')) || c.clientes.includes(cl.n));
const clientesCirc = () => { const vistos = new Set(); return (esJefe() ? Object.values(contactos).flat() : contactos[sesion.zona] || contactos[comercial(sesion.id)?.zona] || [])
    .filter(c => !vistos.has(c.n) && vistos.add(c.n)); };
function pasaFiltroCirc(c, sin) {
    const sel = circulares.sel, ning = k => sel[k].includes(NINGUNA);
    if (sin !== 'cl' && sel.cl.length && (ning('cl') || !(c.todos || c.canales.some(x => sel.cl.includes(x))))) return false;
    if (sin !== 't' && sel.t.length && (ning('t') || !sel.t.includes(c.tipo))) return false;
    if (sin !== 'g' && sel.g.length && (ning('g') || !gruposCircular(c).some(x => sel.g.includes(x)))) return false;
    if (sin !== 'cli' && sel.cli.length) {
        if (ning('cli')) return false;
        const cls = clientesCirc().filter(x => sel.cli.includes(x.n));
        if (!cls.some(x => aplicaCliente(c, x))) return false;
    }
    return true;
}
function verActividades(v) {
    actVista = v;
    document.querySelectorAll('.act-vistas button').forEach(b => b.classList.toggle('activo', b.dataset.v === v));
    $('actCircCtrl').hidden = v !== 'circulares';
    $('actTareasCtrl').hidden = v !== 'tareas';
    pintarActividades();
}
const diasEntre = (a, b) => Math.round((deIso(b) - deIso(a)) / 864e5);
function diasCircular(c) {
    const e = estadoCircular(c);
    if (e === 'vencida') return '---';
    if (e === 'proxima') return `Empieza en ${diasEntre(hoy(), c.ini)} d`;
    if (!c.fin) return 'Indefinido';
    const n = diasEntre(hoy(), c.fin);
    return n === 0 ? 'Vence hoy' : `${n} ${n === 1 ? 'día' : 'días'}`;
}
const rangoCircular = c => `${fechaCorta(c.ini)}${c.fin ? (c.fin === c.ini ? '' : ' al ' + fechaCorta(c.fin)) : ' · sin fecha fin'} ${c.ini.slice(0, 4)}`;
function pintarCirculares() {
    const cuenta = { vigente: 0, vencida: 0, proxima: 0 };
    CIRCULARES.forEach(c => cuenta[estadoCircular(c)]++);
    const f = circulares.filtro, q = normalizar(circulares.busca || '');
    const chip = (k, t, n) => `<button type="button" class="vp-vend-btn${f === k ? ' activo' : ''}" onclick="circulares.filtro='${k}'; pintarCirculares()">${t}${n !== undefined ? ` <small>${n}</small>` : ''}</button>`;
    $('circFiltro').innerHTML = chip('vigente', 'Vigentes', cuenta.vigente) + (cuenta.proxima ? chip('proxima', 'Próximas', cuenta.proxima) : '') + chip('vencida', 'Vencidas', cuenta.vencida) + chip('todas', 'Todas', CIRCULARES.length);
    const base = CIRCULARES.filter(c => f === 'todas' || estadoCircular(c) === f)
        .filter(c => !q || normalizar([c.c, c.nombre, c.tipo, c.dirigida, c.producto, c.resumen].join(' ')).includes(q));
    // Orden: por número de circular, por fecha de inicio (más recientes primero) o por fecha final (las que vencen antes)
    const ordenar = {
        circular: (a, b) => a.c.localeCompare(b.c),
        ini: (a, b) => (b.ini || '').localeCompare(a.ini || '') || a.c.localeCompare(b.c),
        fin: (a, b) => (a.fin || '9999').localeCompare(b.fin || '9999') || a.c.localeCompare(b.c)
    }[circulares.orden] || (() => 0);
    const lista = base.filter(c => pasaFiltroCirc(c)).sort(ordenar);
    // Filtros de lista (una o varias opciones): clasificación, cliente y grupo de producto
    const cuentaDe = (k, valores, pasa) => Object.fromEntries(valores.map(v => [v, base.filter(c => pasaFiltroCirc(c, k) && pasa(c, v)).length]));
    const cls = [...new Set(CIRCULARES.flatMap(c => c.canales))].sort((a, b) => a - b);
    const nombreCl = v => { const x = Object.values(contactos).flat().find(c => String(c.cl) === v); return x?.ca ? `${v} · ${x.ca}` : v; };
    const grupos = [...new Set(CIRCULARES.flatMap(gruposCircular))].sort();
    const tipos = [...new Set(CIRCULARES.map(c => c.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const clis = clientesCirc().map(c => c.n).sort((a, b) => a.localeCompare(b));
    const porNombre = Object.fromEntries(clientesCirc().map(c => [c.n, c]));
    pintarMultis($('circMultis'), 'circ', [
        { k: 'cl', t: 'Clasificación', todos: 'Todas las clasificaciones', valores: cls, nombre: nombreCl, cuenta: cuentaDe('cl', cls, (c, v) => c.todos || c.canales.includes(v)) },
        { k: 'cli', t: 'Cliente', todos: 'Todos los clientes', valores: clis, cuenta: MULTI.circ.abierto === 'cli' ? cuentaDe('cli', clis, (c, v) => aplicaCliente(c, porNombre[v])) : null },
        { k: 'g', t: 'Grupo de producto', todos: 'Todos los grupos', valores: grupos, cuenta: cuentaDe('g', grupos, (c, v) => gruposCircular(c).includes(v)) },
        { k: 't', t: 'Tipo', todos: 'Todos los tipos', valores: tipos, cuenta: cuentaDe('t', tipos, (c, v) => c.tipo === v) }
    ]);
    const chipEstado = { vigente: '<span class="chip ok">Vigente</span>', vencida: '<span class="chip no">Vencida</span>', proxima: '<span class="chip azul">Próxima</span>' };
    const tarjeta = c => {
        const e = estadoCircular(c), pdfs = pdfsCircular(c);
        return `<div class="producto-card circ-card ${e}">
            <div class="visita-cab"><div><span class="vend-card">Circular ${esc(c.c)}</span><h3>${esc(c.nombre)}</h3></div>${chipEstado[e]}</div>
            <p class="meta">${esc([c.tipo, c.grupo].filter(Boolean).join(' · '))}</p>
            <p class="circ-fechas"><span>${esc(rangoCircular(c))}</span><b class="${e}">${esc(diasCircular(c))}</b></p>
            <p class="nota-plan"><b>Dirigida a:</b> ${esc(c.dirigida)}${c.interna ? ' <small class="ayuda">(interna: no sale en las visitas)</small>' : ''}</p>
            ${c.producto ? `<p class="nota-plan"><b>Producto:</b> ${esc(c.producto)}</p>` : ''}
            ${c.objetivo ? `<p class="nota-plan"><b>Objetivo:</b> ${esc(c.objetivo)}</p>` : ''}
            ${c.resumen ? `<details class="circ-resumen"><summary>Resumen de la actividad</summary><p>${esc(c.resumen)}</p></details>` : ''}
            ${c.obs ? `<p class="ayuda">${esc(c.obs)}</p>` : ''}
            <div class="acciones circ-pdfs">${pdfs.length ? pdfs.map((u, i) => `<span class="circ-pdf-item"><a class="bv ok circ-pdf" href="${esc(u)}" target="_blank" rel="noopener">📄 ${pdfs.length > 1 ? 'PDF ' + (i + 1) : 'Ver PDF'}</a>${esJefe() ? `<button class="link-mini" title="Quitar este PDF" onclick="quitarPdfCircular('${esc(c.c)}', ${i})">✕</button>` : ''}</span>`).join('') : '<span class="nota-cierre">Sin PDF</span>'}
                ${esJefe() && pdfs.length < MAX_PDF_CIRC ? `<button class="link-mini" onclick="pegarPdfCircular('${esc(c.c)}')">+ Agregar PDF${pdfs.length ? ` (${pdfs.length} de ${MAX_PDF_CIRC})` : ''}</button>` : ''}</div>
        </div>`;
    };
    $('actLista').innerHTML = lista.length ? lista.map(tarjeta).join('') : `<div class="no-results">${CIRCULARES.length ? 'No hay circulares con este filtro.' : 'Todavía no se han cargado circulares.'}</div>`;
}
// El jefe sube el PDF a Google Drive y pega aquí el enlace (queda para todo el equipo)
async function pegarPdfCircular(codigo) {
    const c = CIRCULARES.find(x => x.c === codigo);
    const actuales = pdfsCircular(c);
    if (actuales.length >= MAX_PDF_CIRC) return toast(`Ya tiene ${MAX_PDF_CIRC} PDF: quita uno para agregar otro`);
    const url = await dialogo({ titulo: `PDF ${actuales.length + 1} de la circular ${codigo}`, texto: 'Sube el PDF a Google Drive, compártelo con "Cualquier persona con el enlace" y pega aquí el enlace.', campo: 'https://drive.google.com/...', aceptar: 'Guardar' });
    if (url === null || !url.trim()) return;
    const limpio = url.trim();
    if (!/^https?:\/\//i.test(limpio)) return toast('El enlace debe empezar por https://');
    guardarPdfsCircular(codigo, [...actuales, limpio]);
    toast(`PDF agregado a ${c ? c.nombre : codigo}`);
}
async function quitarPdfCircular(codigo, i) {
    if (!await dialogo({ titulo: '¿Quitar este PDF?', texto: 'Se quita el enlace de la circular (el archivo sigue en Drive).', aceptar: 'Quitar' })) return;
    const c = CIRCULARES.find(x => x.c === codigo);
    guardarPdfsCircular(codigo, pdfsCircular(c).filter((_, k) => k !== i));
    toast('PDF quitado');
}
function guardarPdfsCircular(codigo, lista) {
    const r = registros[ID_PDF_CIRC] || { id: ID_PDF_CIRC, clase: 'mensual', creado: new Date().toISOString() };
    guardarRegistro({ ...r, vendedor: sesion.id, fecha: hoy(), links: { ...(r.links || {}), [codigo]: lista } });
    pintarCirculares();
}
// El registro de enlaces viaja con los datos del mes: si es de un mes anterior, el jefe lo renueva al abrir
function renovarPdfCirculares() {
    const r = registros[ID_PDF_CIRC];
    if (esJefe() && r && !r.borrado && mesDe(r.fecha || '') !== mesDe(hoy())) guardarRegistro({ ...r, vendedor: sesion.id, fecha: hoy() });
}

function abrirActividades() {
    renovarPdfCirculares();
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
    if (actVista === 'circulares') return pintarCirculares();
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
// Anillo del día: cada visita real cuenta una sola vez (el trabajo interno también). Lo realizado pasa a
// visitadas; lo reprogramado y el trabajo interno quedan aparte mientras no se realicen
const PARTES_ANILLO = [
    { f: 'ok', t: 'Visitadas', c: '#16a34a' }, { f: 'p', t: 'Pendientes', c: '#d97706' },
    { f: 'no', t: 'No visitadas', c: '#dc2626' }, { f: 'rep', t: 'Reprogramadas', c: '#7c3aed' },
    { f: 'repNo', t: 'Reprogramadas no visitadas', c: '#9f1239' }, { f: 'int', t: 'Trabajo interno', c: '#94a3b8' },
    { f: 'intNo', t: 'Trabajo interno no realizado', c: '#475569' }
];
function claseAnillo(x) {
    if (x.estado === 'visitado') return 'ok';
    const no = x.estado === 'no_visitado';
    if (x.interno) return no ? 'intNo' : 'int';
    if (x.origen === 'reprogramada') return no ? 'repNo' : 'rep';
    return no ? 'no' : 'p';
}
function anilloDia(lista, titulo, conFiltro = true, periodo = '') {
    const total = lista.length;
    if (!total) return periodo ? `<div class="anillo-dia vacio" data-p="${periodo}"><p class="anillo-titulo">${titulo.split(' · ').map((x, i) => i ? `<b>${esc(x)}</b>` : `<span>${esc(x)}</span>`).join('')}</p><p class="ayuda">Sin visitas</p></div>` : '';
    // Visitadas y no visitadas siempre se ven; lo demás solo si tiene visitas
    const partes = PARTES_ANILLO.map(x => ({ ...x, n: lista.filter(v => claseAnillo(v) === x.f).length }))
        .filter(x => x.n || x.f === 'ok' || x.f === 'no');
    const R = 42, C = 2 * Math.PI * R, hueco = partes.filter(x => x.n).length > 1 ? 2 : 0;
    const porc = (n) => Math.round(n / total * 100) + '%';
    const clic = x => conFiltro ? ` onclick="filtrarAgenda('an:${x.f}')"` : '';
    let ac = 0;
    const arcos = partes.filter(x => x.n).map(x => {
        const largo = x.n / total * C, arco = `<circle r="${R}" cx="55" cy="55" fill="none" stroke="${x.c}" stroke-width="14" stroke-dasharray="${Math.max(largo - hueco, 0.1)} ${C}" stroke-dashoffset="${-ac}" transform="rotate(-90 55 55)"${clic(x)}${conFiltro ? ' style="cursor:pointer"' : ''}><title>${x.t}: ${x.n} (${porc(x.n)})</title></circle>`;
        ac += largo;
        return arco;
    }).join('');
    const [vis, ...resto] = partes;
    const fila = (x, clase = '') => `<li class="${clase}${x.n ? '' : ' cero'}${conFiltro && agenda.filtro === 'an:' + x.f ? ' activo' : ''}"${clic(x)}><i style="background:${x.c}"></i>${x.t}<b>${x.n}</b><small>${porc(x.n)}</small></li>`;
    return `<div class="anillo-dia${conFiltro ? '' : ' fijo'}" data-p="${periodo}"><svg viewBox="0 0 110 110" role="img" aria-label="${esc(titulo)}">${`<circle r="${R}" cx="55" cy="55" fill="none" stroke="#eef3f2" stroke-width="14"/>`}${arcos}
            <text x="55" y="53" text-anchor="middle" class="an-n">${total}</text><text x="55" y="68" text-anchor="middle" class="an-t">${total === 1 ? 'visita' : 'visitas'}</text></svg>
        <div class="anillo-cuerpo"><p class="anillo-titulo">${titulo.split(' · ').map((x, i) => i ? `<b>${esc(x)}</b>` : `<span>${esc(x)}</span>`).join('')}</p><ul class="anillo-ley">${fila(vis, 'principal')}${resto.map(x => fila(x)).join('')}</ul></div></div>`;
}

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
        + TIPOS_REPORTE().map(t => `<option>${esc(t)}</option>`).join('')
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
    const filas = [...TIPOS_REPORTE(), 'Trabajo interno'].map(t => {
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
            ${v.interno ? '<span class="chip gris">Trabajo interno</span>' : `<span class="chip ${v.modalidad === 'virtual' ? 'azul' : v.modalidad === 'remota' ? 'morado' : 'gris'}">${modalidadDe(v)}</span>`}
            ${esProgramada(v) ? '' : '<span class="chip np">No programada</span>'}${v.esProyecto ? '<span class="chip proy">Proyecto</span>' : ''}</div>
        ${fila('Contacto', [v.tipoContacto, v.ciudad].filter(Boolean).join(' · '))}
        ${v.tipoVisita && v.objetivos?.length ? `<strong>${esc(nombreTipo(v))} · objetivos</strong><p class="objetivos">${(v.objetivos || []).map(o => `<span class="${v.estado === 'visitado' ? (cumplidos.includes(o) ? 'cumplido' : 'no-cumplido') : ''}">${v.estado === 'visitado' && cumplidos.includes(o) ? '✓ ' : ''}${esc(o)}</span>`).join('')}</p>` : ''}
        ${fila('Notas de la programación', v.objetivo)}
        ${fila('Qué se hizo', v.gestion)}${fila('Atendió', v.atendio)}${fila('Productos presentados', v.productos)}${fila('Muestras', v.muestras)}
        ${v.pedido === 'si' ? fila('Pedido', (textoPedidos(v) || 'Sí') + (v.valorPedido ? ' · ' + pesos(v.valorPedido) : '')) : ''}${fila('Productos pedidos', textoSelProductos(v.productosPedidos))}
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
        { t: 'Fecha', w: 12, f: 'dd/mm/yyyy' }, { t: 'Fecha planeada', w: 12, f: 'dd/mm/yyyy' }, { t: 'Cita fija', w: 10 }, { t: 'Vendedor', w: 20 }, { t: 'Contacto', w: 32 },
        { t: 'Tipo de contacto', w: 24 }, { t: 'Ciudad', w: 14 }, { t: 'Programada', w: 12 }, { t: 'Modalidad', w: 12 },
        { t: 'Tipo de visita', w: 26 }, { t: 'Objetivos', w: 36, wrap: true }, { t: 'Subcategorías programadas', w: 40, wrap: true },
        { t: 'Objetivos cumplidos', w: 36, wrap: true }, { t: 'Subcategorías cumplidas', w: 40, wrap: true },
        { t: '% objetivos', w: 12, f: '0%' }, { t: 'Contacto proyecto', w: 12 }, { t: 'Notas', w: 30, wrap: true }, { t: 'Estado', w: 13 },
        { t: 'Gestión', w: 22 }, { t: 'Atendió', w: 20 }, { t: 'Productos presentados', w: 30, wrap: true },
        { t: 'Muestras', w: 24, wrap: true }, { t: 'Pedido', w: 8 }, { t: 'N.º de pedido', w: 26, wrap: true }, { t: 'Productos pedidos', w: 30, wrap: true },
        { t: 'Compromisos', w: 30, wrap: true }, { t: 'Motivo no visita', w: 20 }, { t: 'Reprogramada para', w: 14, f: 'dd/mm/yyyy' },
        { t: 'Observaciones', w: 36, wrap: true }, { t: 'Reportada', w: 17, f: 'dd/mm/yyyy hh:mm' },
        { t: 'Cierre', w: 14 }, { t: 'Plazo de reporte', w: 17, f: 'dd/mm/yyyy hh:mm' }
    ];
    // Fecha y hora de Colombia para Excel (que no maneja zonas horarias)
    const horaCol = t => t ? new Date(Date.parse(t) - 5 * 3600000) : null;
    tabla(h, 'TablaVisitas', colsV, vis.map(v => [
        fecha(v.fecha), fecha(v.fechaPlaneada || (v.vieneDe && v.origen === 'reprogramada' ? v.vieneDe : v.fecha)), v.hora || '', nombreVendedor(v.vendedor), v.interno ? '' : v.contacto, v.tipoContacto || '', v.ciudad || '',
        esProgramada(v) ? 'Sí' : 'No', v.interno ? '' : modalidadDe(v), nombreTipo(v), (v.objetivos || []).join(', '), textoSubsExcel(v.subobjetivos),
        v.estado === 'visitado' ? (v.objetivosCumplidos || []).join(', ') : '', v.estado === 'visitado' ? textoSubsExcel(v.subCumplidos) : '',
        v.estado === 'visitado' && v.objetivos?.length ? cumplidosProgramados(v).length / v.objetivos.length : null,
        v.esProyecto ? 'Sí' : v.eraProyecto ? 'Vinculado' : '', v.objetivo || '',
        (v.interno ? { visitado: 'Realizado', no_visitado: 'No realizado' }[v.estado] : null) || estadoTxt[v.estado] || v.estado, v.gestion || '', v.atendio || '', v.productos || '', v.muestras || '',
        v.pedido === 'si' ? 'Sí' : v.estado === 'visitado' ? 'No' : '', textoPedidos(v), textoSelProductos(v.productosPedidos),
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
        const tipoDe = n => buscarProyecto(ven.zona, n)?.tipo || tipoSugerido(etiquetaDe(n)) || 'Visita Cliente';
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

// ---------- CALENDARIO DE LOS CAMPOS DE FECHA ----------
// Reemplaza el calendario del navegador: festivos y domingos resaltados, sábados más suaves.
// Al programar o reprogramar en un festivo (o domingo) sale el aviso de siempre antes de tomar la fecha.
const FECHAS_CON_AVISO = ['fFecha', 'rProxima', 'nRepro', 'aReproFecha'];
let calFecha = null;   // { inp, mes }

document.addEventListener('click', e => {
    const inp = e.target.closest && e.target.closest('input[type=date]');
    if (inp) { e.preventDefault(); if (!inp.disabled && !inp.readOnly) abrirCalFecha(inp); return; }
    if (calFecha && !e.target.closest('#calFecha')) cerrarCalFecha();
}, true);
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && calFecha) { cerrarCalFecha(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('input[type=date]')) { e.preventDefault(); abrirCalFecha(e.target); }
}, true);

function abrirCalFecha(inp, mes) {
    calFecha = { inp, mes: mes || mesDe(inp.value || (inp.min > hoy() ? inp.min : hoy())) };
    let caja = $('calFecha');
    if (!caja) { caja = document.createElement('div'); caja.id = 'calFecha'; caja.className = 'cal-fecha'; document.body.appendChild(caja); }
    const m = calFecha.mes, t = hoy(), inicio = lunesDe(m + '-01'), ultimo = finDeMes(m);
    let dias = '';
    for (let d = inicio; d <= ultimo || deIso(d).getDay() !== 1; d = sumarDias(d, 1)) {
        if (mesDe(d) !== m) { dias += '<span></span>'; continue; }
        const fuera = (inp.min && d < inp.min) || (inp.max && d > inp.max);
        const fest = nombreFestivo(d);
        dias += `<button type="button" class="cf-dia${claseDia(d)}${d === t ? ' hoy' : ''}${d === inp.value ? ' sel' : ''}" ${fuera ? 'disabled' : ''} onclick="elegirCalFecha('${d}')" title="${esc(fest || fechaLarga(d))}">${deIso(d).getDate()}</button>`;
    }
    const fests = [...festivos(+m.slice(0, 4))].filter(([f]) => mesDe(f) === m).sort();
    caja.innerHTML = `<div class="cf-nav"><button type="button" onclick="abrirCalFecha(calFecha.inp, sumarMes(calFecha.mes, -1))" aria-label="Mes anterior">&lsaquo;</button>
            <b>${esc(mayuscula(nombreMes(m)))}</b><button type="button" onclick="abrirCalFecha(calFecha.inp, sumarMes(calFecha.mes, 1))" aria-label="Mes siguiente">&rsaquo;</button></div>
        <div class="cf-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => `<span class="cf-cab${i === 6 ? ' festivo' : i === 5 ? ' sabado' : ''}">${x}</span>`).join('')}${dias}</div>
        ${fests.length ? `<p class="cf-fest">${fests.map(([f, n]) => `<span><b>${deIso(f).getDate()}</b> ${esc(n)}</span>`).join('')}</p>` : ''}
        <div class="cf-pie">${(!inp.min || t >= inp.min) && (!inp.max || t <= inp.max) ? `<button type="button" onclick="elegirCalFecha('${t}')">Hoy</button>` : '<span></span>'}${inp.required || !inp.value ? '' : '<button type="button" onclick="elegirCalFecha(\'\')">Borrar</button>'}</div>`;
    // Debajo del campo (o encima si no cabe), sin salirse de la pantalla
    const r = inp.getBoundingClientRect(), ancho = 280;
    caja.style.left = Math.max(8, Math.min(r.left, innerWidth - ancho - 8)) + 'px';
    caja.style.top = '0px';
    caja.hidden = false;
    const alto = caja.offsetHeight;
    caja.style.top = (r.bottom + alto + 8 > innerHeight && r.top - alto - 6 > 0 ? r.top - alto - 6 : Math.min(r.bottom + 4, innerHeight - alto - 8)) + 'px';
}

function cerrarCalFecha() {
    if ($('calFecha')) $('calFecha').hidden = true;
    calFecha = null;
}

async function elegirCalFecha(d) {
    const inp = calFecha?.inp;
    if (!inp) return;
    cerrarCalFecha();
    if (d && FECHAS_CON_AVISO.includes(inp.id) && d !== inp.value) {
        if (!await confirmarDia(d, true)) return;
        if (inp.id === 'fFecha') advertenciaAceptada = d;
    }
    inp.value = d;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
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
