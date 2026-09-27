// CONFIGURACIÓN
// URL de la aplicación web de Google Apps Script (ver backend/Codigo.gs).
// Vacía = los datos se guardan solo en este dispositivo.
const API_URL = '';

// Usuarios: la clave no se guarda aquí, solo su huella SHA-256 de "usuario:clave" (en minúsculas)
const USUARIOS = [
    { usuario: 'L.Ramos',     huella: 'afecd958a07662fa1c466a63fa799f91873a1371f878dc6e4bd6c35ffce87617', tipo: 'comercial', id: 'lramos',     nombre: 'Lizeth Ramos',      zona: 'Zona Norte' },
    { usuario: 'Y.Caballero', huella: 'df5769c03aec2c0300cd912335962a57617271fa86e0ef852d5d959895c6ecab', tipo: 'comercial', id: 'ycaballero', nombre: 'Yunelis Caballero', zona: 'Zona Sur' },
    { usuario: 'J.Herrera',   huella: '564177c2a1926013ea79ab83b4bbfe0c3f44fb9585eda1c407504de6424f24c0', tipo: 'comercial', id: 'jherrera',   nombre: 'Jennifer Herrera',  zona: 'Clientes Especiales' },
    { usuario: 'M.Castro',    huella: '2b2ebf7f55852620d6c6b80fd886a502c3ffa470d4eae22dcad0fe2dfd5b1d88', tipo: 'jefe',      id: 'mcastro',    nombre: 'M. Castro' },
    { usuario: 'H.Reyes',     huella: '0213f79c165b6d4bee6bd9eab719817266af1fc9a45ed22cadfccda60f0a122d', tipo: 'jefe',      id: 'hreyes',     nombre: 'H. Reyes' }
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
    r.actualizadoPor = sesion.id;
    registros[r.id] = r;
    pendientes.add(r.id);
    guardarLocal();
    sincronizar();
}

function borrarRegistro(r) {
    r.borrado = true;
    guardarRegistro(r);
}

const visibles = () => Object.values(registros).filter(r => !r.borrado);
const visitasDe = (vendedor, fecha) => visibles()
    .filter(r => r.clase === 'visita' && r.vendedor === vendedor && r.fecha === fecha)
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
const visitasMes = (mes, vendedor) => visibles()
    .filter(r => r.clase === 'visita' && mesDe(r.fecha) === mes && (!vendedor || r.vendedor === vendedor));
const actividadesMes = (mes, vendedor) => visibles()
    .filter(r => r.clase === 'actividad' && r.mes === mes && (!vendedor || r.vendedor === vendedor));

// ---------- SINCRONIZACIÓN CON EL SERVIDOR ----------
let sincronizando = false;
let ultimaSync = null;

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
        guardarLocal();
        ultimaSync = new Date();
    } catch (e) {
        console.warn('No se pudo sincronizar:', e);
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
    const cuando = ultimaSync ? `Actualizado ${ultimaSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : 'Sin conexión con el servidor';
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
    if (sesion && USUARIOS.some(u => u.id === sesion.id)) entrarApp();
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
    irInicio();
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
        : 'Hoy no tienes visitas programadas';
    const acts = actividadesMes(mesDe(hoy()), vend);
    const hechas = acts.filter(a => a.hecha).length;
    $('homeActTxt').textContent = acts.length ? `${hechas} de ${acts.length} realizadas este mes` : 'Sin actividades programadas este mes';
    pintarEstadoSync();
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
        <div class="visita-cab"><div><span class="visita-hora">${esc(v.hora || '--:--')}</span><h3>${esc(v.contacto)}</h3></div>${chip}</div>
        ${meta ? `<p class="meta">${meta}</p>` : ''}
        <div class="marcas">${marcas}</div>
        ${objetivos}
        ${v.objetivo ? `<p>${esc(v.objetivo)}</p>` : ''}
        ${reporte}
        <div class="acciones">
            <button class="bv ok${v.estado === 'visitado' ? ' on' : ''}" onclick="abrirRegistro('${v.id}','ok')">✓ ${txtOk}</button>
            <button class="bv no${v.estado === 'no_visitado' ? ' on' : ''}" onclick="abrirRegistro('${v.id}','no')">✕ ${txtNo}</button>
            <button class="link-mini" onclick="abrirProgramar('${v.id}')">Editar</button>
        </div>
    </div>`;
}

// Formulario para programar (o editar) una visita o un trabajo interno
function abrirProgramar(id) {
    const v = id ? registros[id] : null;
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
        <div class="dos">
            <div><label for="fFecha">Fecha</label><input id="fFecha" type="date" required value="${v?.fecha || agenda.fecha}"></div>
            <div><label for="fHora">Hora</label><input id="fHora" type="time" value="${v?.hora || '09:00'}"></div>
        </div>
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
            ${v ? `<button type="button" class="btn-secundario btn-peligro" onclick="eliminarVisita('${v.id}')">Eliminar</button>` : ''}
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
    if (!confirm('¿Eliminar esta visita?')) return;
    borrarRegistro({ ...registros[id] });
    cerrarModal();
    toast('Visita eliminada');
    pintarAgenda();
}

// Formulario para registrar lo que pasó: visitado / no visitado
function abrirRegistro(id, tipo) {
    const v = registros[id];
    const opciones = (lista, actual) => lista.map(o => `<option ${o === actual ? 'selected' : ''}>${esc(o)}</option>`).join('');
    const cab = `<p class="sub">${esc(v.contacto)} · ${esc(fechaCorta(v.fecha))}${v.hora ? ' · ' + esc(v.hora) : ''}</p>`;
    if (tipo === 'ok' && v.interno) {
        abrirModal(`<form class="form-rc" onsubmit="guardarInternoRealizado(event, '${id}')">
            <h2>Trabajo realizado</h2>${cab}
            <label for="rObs">¿Qué se hizo?</label>
            <textarea id="rObs" placeholder="Ej: se enviaron 5 cotizaciones y se cerró el informe de cartera">${esc(v.estado === 'visitado' ? v.observaciones : '')}</textarea>
            <div class="form-botones">
                ${v.estado !== 'pendiente' ? `<button type="button" class="btn-secundario btn-peligro" onclick="volverPendiente('${id}')">Dejar pendiente</button>` : ''}
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
                ${v.estado !== 'pendiente' ? `<button type="button" class="btn-secundario btn-peligro" onclick="volverPendiente('${id}')">Dejar pendiente</button>` : ''}
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
                ${v.estado !== 'pendiente' ? `<button type="button" class="btn-secundario btn-peligro" onclick="volverPendiente('${id}')">Dejar pendiente</button>` : ''}
                <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
                <button class="btn-primario" style="background:#c2413a">Guardar</button>
            </div>
        </form>`, 'theme-rojo');
    }
}

const LIMPIAR_VISITADO = { gestion: '', atendio: '', productos: '', muestras: '', pedido: '', valorPedido: '', compromisos: '' };
const LIMPIAR_NO_VISITADO = { motivo: '' };

function guardarVisitado(e, id) {
    e.preventDefault();
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
    guardarRegistro({ ...registros[id], ...LIMPIAR_NO_VISITADO, estado: 'visitado', observaciones: $('rObs').value.trim(), registrada: new Date().toISOString() });
    cerrarModal();
    toast('Trabajo registrado como realizado');
    pintarAgenda();
}

function guardarNoVisitado(e, id) {
    e.preventDefault();
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
            fecha: repro, hora: antes.hora, objetivo: antes.objetivo, vieneDe: antes.fecha,
            modalidad: antes.modalidad, tipoVisita: antes.tipoVisita, objetivos: antes.objetivos, interno: !!antes.interno,
            programada: Date.now() < limiteProgramacion(repro),
            creado: new Date().toISOString(), creadoPor: sesion.id
        });
    }
    cerrarModal();
    toast(repro ? `Reprogramada para el ${fechaCorta(repro)}` : 'Marcada como no visitada');
    pintarAgenda();
}

function volverPendiente(id) {
    guardarRegistro({ ...registros[id], ...LIMPIAR_VISITADO, ...LIMPIAR_NO_VISITADO, estado: 'pendiente', observaciones: '' });
    cerrarModal();
    toast('La visita quedó pendiente');
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
    const vis = visitasMes(mes, vend).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
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
        { t: 'Fecha', w: 12, f: 'dd/mm/yyyy' }, { t: 'Hora', w: 8 }, { t: 'Vendedor', w: 20 }, { t: 'Contacto', w: 32 },
        { t: 'Tipo de contacto', w: 24 }, { t: 'Ciudad', w: 14 }, { t: 'Programada', w: 12 }, { t: 'Modalidad', w: 12 },
        { t: 'Tipo de visita', w: 26 }, { t: 'Objetivos', w: 36, wrap: true }, { t: 'Notas', w: 30, wrap: true }, { t: 'Estado', w: 13 },
        { t: 'Gestión', w: 22 }, { t: 'Atendió', w: 20 }, { t: 'Productos presentados', w: 30, wrap: true },
        { t: 'Muestras', w: 24, wrap: true }, { t: 'Pedido', w: 8 }, { t: 'Valor pedido', w: 14, f: '"$" #,##0' },
        { t: 'Compromisos', w: 30, wrap: true }, { t: 'Motivo no visita', w: 20 }, { t: 'Reprogramada para', w: 14, f: 'dd/mm/yyyy' },
        { t: 'Observaciones', w: 36, wrap: true }
    ];
    tabla(h, 'TablaVisitas', colsV, vis.map(v => [
        fecha(v.fecha), v.hora || '', nombreVendedor(v.vendedor), v.interno ? '' : v.contacto, v.tipoContacto || '', v.ciudad || '',
        esProgramada(v) ? 'Sí' : 'No', v.interno ? '' : modalidadDe(v), v.tipoVisita || '', (v.objetivos || []).join(', '), v.objetivo || '',
        (v.interno ? { visitado: 'Realizado', no_visitado: 'No realizado' }[v.estado] : null) || estadoTxt[v.estado] || v.estado, v.gestion || '', v.atendio || '', v.productos || '', v.muestras || '',
        v.pedido === 'si' ? 'Sí' : v.estado === 'visitado' ? 'No' : '', v.valorPedido ? Number(v.valorPedido) : null,
        v.compromisos || '', v.motivo || '', fecha(v.reprogramadaPara), v.observaciones || ''
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
