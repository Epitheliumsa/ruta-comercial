// ===================== LOGÍSTICA =====================
// Plan de trabajo de mensajería: el Coordinador Logístico y los auxiliares de domicilios programan la ruta del día y reportan
// en tiempo real cada parada (entregas en Bogotá y A.M. con devoluciones y PQR, envíos, radicación, proveedores y trámites), con foto.
// Registro clase 'logistica' (una parada por registro): vendedor = el mensajero asignado; comercial = el vendedor de la zona
// del cliente, que ve la entrega en el historial del cliente. Se carga después de app.js (usa sus funciones y constantes).

const esLogistica = () => !!(sesion && sesion.tipo === 'logistica');
const esCoordLog = () => !!(sesion && sesion.coordLogistica);
const puedeOperarLog = () => esLogistica() || esAdmin();          // programa y reporta paradas
const puedeCorregirLog = () => esCoordLog() || esAdmin();         // reabre un reporte para corregirlo
const veTodasZonas = () => esJefe() || esLogistica();             // Maestra Clientes con todas las zonas

// Tipo de parada: se escoge uno; la radicación de documentos es la única que se puede sumar a otro tipo (o ir sola).
// En la entrega en Bogotá y Área Metropolitana se marca además si se recoge devolución o PQR.
const TIPOS_LOG = {
    entrega:     { t: 'Entrega Bogotá y A.M.', corto: 'Entrega', cliente: true, docs: true, ok: 'Entregado', no: 'No entregado', quien: '¿Quién recibió?', rec: 'Recibió' },
    envio:       { t: 'Envío fuera de Bogotá', corto: 'Envío', cliente: true, docs: true, envio: true, ok: 'Enviado', no: 'No enviado', quien: '¿Quién lo recibió en la transportadora?', rec: 'Recibió' },
    radicacion:  { t: 'Radicación de documentos', corto: 'Radicación', cliente: true, radicacion: true, ok: 'Radicado', no: 'No radicado', quien: '¿Quién recibió?', rec: 'Recibió' },
    recoleccion: { t: 'Proveedor', corto: 'Proveedor', recoleccion: true, ok: 'Recogido', no: 'No recogido', quien: '¿Quién entregó?', rec: 'Entregó' },
    vuelta:      { t: 'Trámite área', corto: 'Trámite', vuelta: true, ok: 'Realizado', no: 'No realizado', quien: '¿Con quién se hizo?', rec: 'Con' },
    banco:       { t: 'Bancos', corto: 'Banco', banco: true, ok: 'Realizado', no: 'No realizado', quien: '¿Quién atendió en el banco?', rec: 'Atendió' },
    oficina:     { t: 'Oficina', corto: 'Oficina', oficina: true, ok: 'Realizado', no: 'No realizado', quien: '¿Con quién se hizo?', rec: 'Con' }
};
// Oficina: lo que se hace allá. Aforar lleva cliente y una o varias facturas; las demás solo se marcan (Otro, con su texto)
const OFICINA_LOG = [['aforar', 'Aforar'], ['alistamiento', 'Alistamiento'], ['etiquetas', 'Etiquetas'], ['otro', 'Otro']];
const textoFacAforo = f => `${f.serie || ''} ${f.numero || ''}`.trim();
const itemsOficina = r => (r.oficina || []).map(k => k === 'aforar' ? `Aforar${(r.facturasAforo || []).length ? ': ' + r.facturasAforo.map(textoFacAforo).join(' · ') : ''}`
    : k === 'otro' ? `Otro: ${r.otroOficina || ''}`.trim() : OFICINA_LOG.find(x => x[0] === k)?.[1] || k);
const BANCOS_LOG = ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco de Occidente', 'Banco Popular', 'AV Villas', 'Scotiabank Colpatria', 'Itaú', 'Banco Caja Social'];
// Campos de una parada que dejan huella cuando se editan (nombre con el que se muestra el cambio)
const CAMPOS_HUELLA_LOG = { fecha: 'fecha', hora: 'hora', vendedor: 'mensajero', tipo: 'tipo de parada', tipos: 'radicación', incluye: 'lo que incluye', documentos: 'facturas', incluyeDocs: 'documentos que incluye', radicacion: 'documentos a radicar',
    proveedor: 'proveedor', oficina: 'lo que se hace en la oficina', facturasAforo: 'facturas a aforar', otroOficina: 'otro', entidad: 'banco', materiales: 'qué se recoge', area: 'área', direccion: 'dirección', telefono: 'teléfono', detalle: 'indicaciones' };
const INCLUYE_ENTREGA = { devolucion: 'Recolección de devolución', pqr: 'Recolección de PQR' };
const INCLUYE_ENVIO = { pqr_out: 'PQR/OUT', rea_out: 'REA/OUT', devolucion: 'Devolución' };   // lo que también va en un envío fuera de Bogotá
const NOMBRE_INCLUYE = { pqr: 'PQR', devolucion: 'Devolución', pqr_out: 'PQR/OUT', rea_out: 'REA/OUT' };
// Radicación: factura (serie A = OVI o B = OV) con su número, nota crédito (RNC) con su número, u otros (texto)
const DOCS_RADICACION = [{ k: 'factura', t: 'Factura' }, { k: 'nc', t: 'Nota crédito RNC' }, { k: 'otros', t: 'Otros' }];
const SERIES_FACTURA = { A: 'OVI', B: 'OV' };   // en pantalla solo se ve la letra
const MATERIALES_LOG = ['Materias primas', 'Envases', 'Plegadizas', 'Etiquetas', 'Desarrollo', 'Maquila', 'Otros'];
const AREAS_LOG = ['Recursos Humanos', 'Producción', 'Contabilidad', 'Calidad', 'Gerencia', 'Mercadeo', 'Comercial', 'Compras', 'Otra'];
const MOTIVOS_LOG = ['No estaba quien recibe', 'Lugar cerrado', 'Dirección incorrecta o no se encontró', 'Rechazó la entrega', 'El material no estaba listo', 'Pidió reprogramar', 'Otro'];
const logi = { fecha: '', mensajero: '', filtro: '', busca: '', soloLectura: false };

// ---------- DATOS ----------
const logRegs = () => visibles().filter(r => r.clase === 'logistica' && r.tipo !== 'novedad');
// Novedades del equipo de Logística (cita médica, incapacidad, permiso, vacaciones): se guardan como registros de logística de tipo 'novedad'
const NOVEDADES_LOG = ['Cita médica', 'Incapacidad', 'Permiso', 'Vacaciones'];
const ICONO_NOV = { 'Cita médica': '🩺', Incapacidad: '🤒', Permiso: '📝', Vacaciones: '🌴' };
const novLogRegs = () => visibles().filter(r => r.clase === 'logistica' && r.tipo === 'novedad')
    .filter(r => esLogistica() ? (esCoordLog() || r.vendedor === sesion.id) : esAdmin());
const novLogDe = (fecha, vendedor) => novLogRegs().filter(n => n.fecha <= fecha && (n.hasta || n.fecha) >= fecha && (!vendedor || n.vendedor === vendedor));
const novPorHoras = n => ['Cita médica', 'Permiso'].includes(n.novedad) && !n.diaCompleto && n.horaInicio && n.horaFin;
const rangoNovLog = n => novPorHoras(n) ? `${fechaCorta(n.fecha)}, de ${horaBonita(n.horaInicio)} a ${horaBonita(n.horaFin)}`
    : n.hasta && n.hasta !== n.fecha ? `${fechaCorta(n.fecha)} al ${fechaCorta(n.hasta)}` : fechaCorta(n.fecha);
// Cada uno ve lo suyo: el coordinador y los jefes, todo; el auxiliar, sus paradas; el comercial, las entregas a sus clientes
// (el administrador ve todo; la jefe comercial, todo lo de clientes; el comercial, lo de sus clientes)
const logVisibles = () => logRegs().filter(r => esLogistica() ? (esCoordLog() || r.vendedor === sesion.id) : esAdmin() ? true : esJefe() ? hayTipo(r, 'cliente') : r.comercial === sesion.id);
const tituloModuloLog = () => esLogistica() || esAdmin() ? 'Logística' : esJefe() ? 'Entregas a clientes' : 'Entregas a tus clientes';
const zonaDeContacto = nombre => Object.keys(contactos).find(z => buscarMaestra(z, nombre));
// Los leads (contactos nuevos en seguimiento) también salen en la lista de clientes de Logística
const leadsLog = () => proyectos().filter(p => p.estado !== 'vinculado' && p.estado !== 'perdido');
const leadPorNombre = nombre => nombre ? leadsLog().find(p => normalizar(p.nombre) === normalizar(nombre)) : null;
const tiposLog = r => (r.tipos?.length ? r.tipos : [r.tipo]).filter(k => TIPOS_LOG[k]);
const hayTipo = (r, campo) => tiposLog(r).some(k => TIPOS_LOG[k][campo]);
const conRadicacion = r => hayTipo(r, 'radicacion');
const okTxt = r => TIPOS_LOG[r.tipo]?.ok || 'Realizada';
const noTxt = r => TIPOS_LOG[r.tipo]?.no || 'No realizada';
const incluyeTxt = r => (r.incluye || []).map(k => k === 'devolucion' ? 'devolución' : NOMBRE_INCLUYE[k] || k).join(' y ');
const nombreTipos = r => (TIPOS_LOG[r.tipo]?.t || '') + (r.incluye?.length ? ` + incluye ${incluyeTxt(r)}` : '') + (r.tipo !== 'radicacion' && conRadicacion(r) ? ' + radicación' : '');
const tituloLog = r => r.contacto || r.proveedor || (r.entidad ? `Banco · ${r.entidad}` : r.area ? `Trámite · ${r.area}` : r.tipo === 'oficina' ? 'Oficina' : 'Parada');
// Paradas con hora fija primero (por hora) y después el resto en el orden de la ruta
const ordenLog = (a, b) => (a.hora ? 0 : 1) - (b.hora ? 0 : 1) || (a.hora || '').localeCompare(b.hora || '') || (a.orden ?? 1e9) - (b.orden ?? 1e9) || (a.creado || '').localeCompare(b.creado || '');
// Facturas que se llevan (en pantalla A = OVI y B = OV, siempre de 6 cifras): A en terminados; A y/o B en magistral individual; B en magistral de pedido
const CLASES_PEDIDO = [
    { k: 'pt', t: 'Producto Terminado', campos: [['ovi', 'A']] },
    { k: 'mi', t: 'Magistral Individual', campos: [['ovi', 'A'], ['ov', 'B']] },
    { k: 'mp', t: 'Magistral de Pedido', campos: [['ov', 'B']] }
];
const claseDoc = k => CLASES_PEDIDO.find(c => c.k === k);
// Lo que se programó en la parada, uno por uno (cada factura A o B, cada documento que incluye, lo que se radica o se recoge): se marca en el reporte
const VERBO_LOG = { entrega: 'entregaste', envio: 'enviaste', radicacion: 'radicaste', recoleccion: 'recogiste', oficina: 'hiciste' };
function itemsProgramados(r) {
    const nom = d => claseDoc(d.clase)?.t || 'Pedido';
    return [...(r.documentos || []).flatMap(d => [d.ovi && `${nom(d)} · A ${d.ovi}`, d.ov && `${nom(d)} · B ${d.ov}`]),
        ...(r.incluyeDocs || []).map(textoInc), ...(r.radicacion || []).map(textoRad), ...(r.tipo === 'recoleccion' ? (r.materiales || []) : []), ...(r.tipo === 'oficina' ? itemsOficina(r) : [])].filter(Boolean);
}
const textoInc = d => `${NOMBRE_INCLUYE[d.k] || d.k} ${d.numero}`;
const textoDoc = d => [claseDoc(d.clase)?.t, d.ovi && `A ${d.ovi}`, d.ov && `B ${d.ov}`].filter(Boolean).join(' · ');
// Números de factura y nota crédito: 6 cifras, se completan con ceros a la izquierda (58 → 000058)
const seisCifras = v => { v = String(v || '').replace(/\D/g, ''); return v ? v.slice(-6).padStart(6, '0') : ''; };
const NUM6 = `placeholder="000000" inputmode="numeric" autocomplete="off" maxlength="6" title="6 cifras: se completa con ceros" oninput="this.value = this.value.replace(/[^0-9]/g, '')" onblur="this.value = seisCifras(this.value)"`;
const textoRad = d => d.doc === 'factura' ? `Radicar factura ${d.serie} ${d.numero || ''}`.trim()
    : d.doc === 'nc' ? `Radicar nota crédito RNC ${d.numero || ''}`.trim() : `Radicar: ${d.texto || ''}`;
const horaLog = iso => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
const chipEstadoLog = r => r.estado === 'entregado' ? `<span class="chip ok">${esc(okTxt(r))}</span>`
    : r.estado === 'no_entregado' ? `<span class="chip no">${esc(noTxt(r))}</span>` : r.fecha < hoy() ? '<span class="chip sin-rep">Sin reporte a tiempo</span>' : '<span class="chip p">Pendiente</span>';
// Uno o varios teléfonos ("300… / 601…"), cada uno con su enlace para llamar
// Dirección que se toca para abrirla en Google Maps o Waze (la ciudad ayuda a que caiga en el lugar correcto)
const enlaceDir = (dir, ciudad = '') => dir ? `<a class="dir-mapa" href="#" data-d="${esc([dir, ciudad && !normalizar(dir).includes(normalizar(String(ciudad).split(/[ ,-]/)[0])) ? ciudad : ''].filter(Boolean).join(', '))}" onclick="abrirMapa(event, this.dataset.d)">${esc(dir)}</a>` : '';
function abrirMapa(e, dir) {
    e.preventDefault(); e.stopPropagation();
    const q = encodeURIComponent(dir + ', Colombia'), d = $('dialogo');
    d.className = 'dialogo visible';
    d.innerHTML = `<div class="dialogo-caja mapa-opciones" role="dialog" aria-modal="true" aria-label="Abrir en el mapa">
        <h3>📍 Abrir en…</h3><p>${esc(dir)}</p>
        <a class="btn-primario" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener" data-cerrar>Google Maps</a>
        <a class="btn-primario" href="https://waze.com/ul?q=${q}&navigate=yes" target="_blank" rel="noopener" data-cerrar>Waze</a>
        <button type="button" class="btn-secundario" data-cerrar>Cancelar</button></div>`;
    d.onclick = ev => { if (ev.target.closest('[data-cerrar]') || ev.target === d) { d.className = 'dialogo'; d.innerHTML = ''; d.onclick = null; } };
}
const enlacesTel = t => String(t || '').split(/\s*[\/,;]\s*/).filter(Boolean).map(x => `<a href="tel:${esc(x.replace(/[^0-9+]/g, ''))}">${esc(x)}</a>`).join(' · ');
const urlFoto = f => f.url || f.data || '';
const miniFoto = f => f.id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(f.id)}&sz=w400` : (f.data || '');

// ---------- INICIO ----------
function pintarInicioLog() {
    const b = $('btnLogistica');
    if (!b) return;
    const ver = esLogistica() || esJefe() || esComercial();
    b.style.display = ver ? '' : 'none';
    if (!ver) return;
    b.querySelector('strong').innerHTML = `${esc(tituloModuloLog())} <span class="en-pruebas">- en pruebas</span>`;   // mientras arranca
    const hoyL = logVisibles().filter(r => r.fecha === hoy());
    const pend = hoyL.filter(r => r.estado === 'pendiente').length;
    $('homeLogTxt').textContent = hoyL.length ? `Hoy: ${hoyL.length} ${hoyL.length === 1 ? 'parada' : 'paradas'}${pend ? ` · ${pend} pendientes` : ' · todas reportadas'}`
        : esComercial() ? 'Pedidos entregados y enviados a tus clientes' : 'Programa la ruta y reporta entregas, envíos y recolecciones';
}

function abrirLogistica() {
    if (!logi.fecha) logi.fecha = hoy();
    logi.soloLectura = !puedeOperarLog();
    mostrarPantalla('logScreen');
    pintarLog();
}
const logMover = n => { logi.fecha = sumarDias(logi.fecha, n); pintarLog(); };
const logElegir = f => { if (f) { logi.fecha = f; pintarLog(); } };

// ---------- PANTALLA ----------
function pintarLog() {
    const f = logi.fecha, t = hoy(), lectura = logi.soloLectura;
    $('logTitulo').textContent = tituloModuloLog();
    $('logFechaTxt').textContent = f === t ? 'Hoy, ' + fechaLarga(f) : mayuscula(fechaLarga(f));
    $('logFechaPick').value = f;
    $('logProgramar').hidden = lectura;
    $('logProgramar').disabled = false; $('logProgramar').title = '';   // Logística programa desde hoy, a cualquier hora
    $('logDescargar').hidden = !(esCoordLog() || esAdmin() || esJefe());
    const todos = logVisibles();
    // Chips de mensajero (coordinador, administrador y jefes)
    const verMens = esCoordLog() || esJefe();
    $('logMensajeros').hidden = !verMens;
    if (verMens) {
        const chip = (id, txt, n) => `<button type="button" class="vp-vend-btn${logi.mensajero === id ? ' activo' : ''}" onclick="logi.mensajero='${id}'; pintarLog()">${logi.mensajero === id ? '✓ ' : ''}${esc(txt)} <small>${n}</small></button>`;
        $('logMensajeros').innerHTML = chip('', 'Todos', todos.filter(r => r.fecha === f).length)
            + MENSAJEROS.map(m => chip(m.id, m.nombre, todos.filter(r => r.fecha === f && r.vendedor === m.id).length)).join('');
    }
    // Semana
    const lunes = lunesDe(f), delMens = r => !logi.mensajero || r.vendedor === logi.mensajero;
    // Cumpleaños del equipo de logística que se está viendo (el auxiliar, el suyo; el coordinador, el de todos o el del mensajero elegido)
    const gente = esLogistica() && !esCoordLog() ? [sesion.id] : logi.mensajero ? [logi.mensajero] : USUARIOS.filter(u => u.tipo === 'logistica').map(u => u.id);
    const cumplen = d => gente.filter(id => esCumple(id, d));
    $('logSemana').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(i => {
        const d = sumarDias(lunes, i), ps = todos.filter(r => r.fecha === d && delMens(r)).sort(ordenLog);
        const puntos = ps.slice(0, 5).map(x => `<i class="${x.estado === 'entregado' ? 'ok' : x.estado === 'no_entregado' ? 'no' : ''}"></i>`).join('');
        const cu = cumplen(d);
        return `<button class="sd${d === t ? ' hoy' : ''}${d === f ? ' sel' : ''}${claseDia(d)}${cu.length ? ' cumple' : ''}" onclick="logElegir('${d}')"${cu.length ? ` title="🎂 Cumpleaños de ${esc(cu.map(nombreVendedor).join(', '))}"` : ''}><b>${DIAS[deIso(d).getDay()]}</b><span>${deIso(d).getDate()}</span>${cu.length ? '<em class="em-cumple">🎂 Cumple</em>' : ''}<span class="puntos">${puntos}</span></button>`;
    }).join('');
    // Paradas del día
    const q = normalizar(logi.busca);
    const dia = todos.filter(r => r.fecha === f && delMens(r));
    // Anillos del día, de la semana (lunes hasta el día) y del mes (hasta el día): cada parte se puede tocar y filtra la lista
    const semana = todos.filter(r => r.fecha >= lunes && r.fecha <= f && delMens(r));
    const mes = todos.filter(r => r.fecha >= mesDe(f) + '-01' && r.fecha <= f && delMens(r));
    const deP = { dia, semana, mes };
    const [fp, fe] = (logi.filtro || '').split(':');
    const tSem = lunes === f ? 'Lunes ' + fechaCorta(f) : `Del ${deIso(lunes).getDate()}${mesDe(lunes) === mesDe(f) ? '' : ' de ' + nombreMes(mesDe(lunes)).split(' ')[0].slice(0, 3)} al ${fechaCorta(f)}`;
    const tMes = `${mayuscula(nombreMes(mesDe(f)).split(' ')[0])}, hasta el ${deIso(f).getDate()}`;
    const anillos = anilloLog(dia, 'Día', fechaCorta(f), 'dia') + anilloLog(semana, 'Acumulado de la semana', tSem, 'semana') + anilloLog(mes, 'Acumulado del mes', tMes, 'mes');
    const verAn = logi.anillo || 'dia';
    const tabsAn = ['dia', 'semana', 'mes'].map(x => `<button type="button" class="${x === verAn ? 'activo' : ''}" onclick="logi.anillo='${x}'; pintarLog()">${{ dia: 'Día', semana: 'Semana', mes: 'Mes' }[x]}</button>`).join('');
    $('logAnillo').innerHTML = mes.length ? `<div class="anillo-tabs">${tabsAn}</div><div class="anillos ver-${verAn}">${anillos}</div>` : '';
    $('logGrafico').innerHTML = graficoLog(todos.filter(r => mesDe(r.fecha) === mesDe(f) && delMens(r)), mesDe(f));
    const parte = PARTES_LOG.find(x => x.f === fe);
    $('logResumen').innerHTML = fp && parte ? `<span class="chip chip-filtro activo lg-filtro-act"><i style="background:${parte.c}"></i>${esc(parte.t)} · ${esc({ dia: 'día ' + fechaCorta(f), semana: tSem.toLowerCase(), mes: tMes.toLowerCase() }[fp])}</span><button type="button" class="link-mini" onclick="filtrarLog('')">✕ Quitar filtro</button>` : '';
    // Coordinación, jefes y administrador: clientes con 2 o más no efectivas que aún tienen una parada pendiente
    const reinc = {};
    if (esCoordLog() || esAdmin() || esJefe()) todos.filter(r => r.estado === 'pendiente' && r.fecha >= t && delMens(r) && fallosParada(r) >= 2).sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(r => { reinc[normalizar(nombreParada(r))] ||= r; });
    $('logResumen').innerHTML += Object.values(reinc).map(r => `<div class="lg-banner-reincide">⚠ <b>Reincidencia:</b> ${esc(nombreParada(r))} · ${fallosParada(r)} no efectivas en 30 días · ${intentoLog(r)}.º intento el ${esc(fechaCorta(r.fecha))}</div>`).join('');
    const base = fp && fp !== 'dia' ? deP[fp] : dia;
    const lista = base.filter(r => (!parte || claseLog(r) === parte.f)
        && (!q || normalizar([tituloLog(r), r.proveedor, r.direccion, r.telefono, r.destino, ...(r.documentos || []).flatMap(d => [d.ov, d.ovi]), ...(r.incluyeDocs || []).map(d => d.numero), ...(r.radicacion || []).map(textoRad)].join(' ')).includes(q)));
    // Cada mensajero tiene su ruta numerada por día (el número no cambia aunque se filtre la lista)
    const rutas = {}, clave = r => r.fecha + '|' + r.vendedor;
    todos.filter(r => base.includes(r) || r.fecha === f).filter(delMens).slice().sort(ordenLog).forEach(r => (rutas[clave(r)] = rutas[clave(r)] || []).push(r));
    const grupos = {};
    const varios = fp === 'semana' || fp === 'mes';
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenLog(a, b)).forEach(r => { const g = varios ? r.fecha : r.vendedor; (grupos[g] = grupos[g] || []).push(r); });
    const conTitulo = varios || Object.keys(grupos).length > 1 || esCoordLog() || esJefe();
    const tarjetasCumple = varios ? '' : cumplen(f).map(tarjetaCumple).join('') + panelNovLog(novLogDe(f).filter(delMens));
    $('logLista').innerHTML = tarjetasCumple + (!lista.length
        ? `<div class="no-results">${base.length ? 'No hay paradas con este filtro.' : lectura ? 'No hay entregas a tus clientes este día.' : 'No hay paradas programadas para este día.'}${lectura || varios ? '' : '<br><button class="btn-nuevo active" onclick="abrirLogForm()">+ Programar</button>'}</div>`
        : Object.entries(grupos).map(([g, ps]) => (conTitulo ? `<p class="grupo-titulo">${esc(varios ? mayuscula(fechaLarga(g)) : nombreVendedor(g))} · ${ps.length} ${ps.length === 1 ? 'parada' : 'paradas'}</p>` : '')
            + ps.map(r => { const ru = rutas[clave(r)] || [r]; return tarjetaLog(r, ru.indexOf(r) + 1, ru.length); }).join('')).join(''));
}
// Partes de los anillos de Logística (mismo estilo de los de comercial)
// Como en comercial: Atendidas (se hizo) · No efectivas (no se pudo) · Sin reporte a tiempo (el día pasó y no se reportó) · Por recibir (aún dentro del día)
const PARTES_LOG = [
    { f: 'entregado', t: 'Atendidas', c: '#16a34a' }, { f: 'no_entregado', t: 'No efectivas', c: '#ec4899' },
    { f: 'sin', t: 'Sin reporte a tiempo', c: '#b91c1c' }, { f: 'pendiente', t: 'Por recibir', c: '#d97706' }
];
const claseLog = r => r.estado === 'pendiente' && r.fecha < hoy() ? 'sin' : r.estado;
// Gráfico de entregas del mes: barras apiladas por estado, agrupadas por día, tipo de parada o mensajero
function graficoLog(lista, mes) {
    if (!lista.length) return '';
    // "Por mensajero" es solo para el coordinador de logística (y el administrador)
    const verMens = esCoordLog() || esAdmin(), dim = logi.dimGraf === 'mens' && !verMens ? 'dia' : logi.dimGraf || 'dia';
    const clave = { dia: r => r.fecha, tipo: r => r.tipo, mens: r => r.vendedor }[dim];
    const nombre = { dia: k => mayuscula(fechaLarga(k)), tipo: k => TIPOS_LOG[k]?.t || k, mens: k => nombreVendedor(k) }[dim];
    const grupos = {};
    lista.forEach(r => { const k = clave(r); (grupos[k] = grupos[k] || []).push(r); });
    const filas = Object.entries(grupos).sort(dim === 'dia' ? (a, b) => a[0].localeCompare(b[0]) : (a, b) => b[1].length - a[1].length);
    const max = Math.max(...filas.map(([, l]) => l.length));
    const tabs = [['dia', 'Por día'], ['tipo', 'Por tipo de parada'], ...(verMens ? [['mens', 'Por mensajero']] : [])].map(([k, t]) => `<button type="button" class="${k === dim ? 'activo' : ''}" onclick="logi.dimGraf='${k}'; pintarLog()">${t}</button>`).join('');
    const total = lista.length, atendidas = lista.filter(r => r.estado === 'entregado').length;
    return `<details class="lg-grafico"${logi.grafAbierto === false ? '' : ' open'} ontoggle="logi.grafAbierto = this.open">
        <summary>📊 Gráfico de entregas · ${esc(mayuscula(nombreMes(mes).split(' ')[0]))} <small>${total} ${total === 1 ? 'parada' : 'paradas'} · ${atendidas} atendidas (${Math.round(atendidas / total * 100)}%)</small></summary>
        <div class="anillo-tabs">${tabs}</div>
        <div class="lg-g-filas">${filas.map(([k, l]) => `<div class="lg-g-fila"><span class="lg-g-nom">${esc(nombre(k))}</span>
            <span class="lg-g-barra" style="width:${Math.max(l.length / max * 100, 4)}%">${PARTES_LOG.map(x => { const n = l.filter(r => claseLog(r) === x.f).length; return n ? `<i style="flex:${n}; background:${x.c}" title="${esc(x.t)}: ${n}">${n}</i>` : ''; }).join('')}</span>
            <b class="lg-g-n">${l.length}</b></div>`).join('')}</div>
        <p class="lg-g-ley">${PARTES_LOG.map(x => `<span><i style="background:${x.c}"></i>${esc(x.t)}</span>`).join('')}</p>
    </details>`;
}
// Tocar una parte (del día, la semana o el mes) muestra esas paradas; tocarla otra vez quita el filtro
function filtrarLog(k) { logi.filtro = logi.filtro === k ? '' : k; pintarLog(); }
function anilloLog(lista, etiqueta, titulo, periodo) {
    const total = lista.length;
    const cab = `<p class="anillo-titulo"><span>${esc(etiqueta)}</span><b>${esc(titulo)}</b></p>`;
    if (!total) return `<div class="anillo-dia${periodo === 'dia' ? '' : ' fijo'} vacio" data-p="${periodo}">${cab}<p class="ayuda">Sin paradas</p></div>`;
    const partes = PARTES_LOG.map(x => ({ ...x, n: lista.filter(r => claseLog(r) === x.f).length }));
    const R = 42, C = 2 * Math.PI * R, hueco = partes.filter(x => x.n).length > 1 ? 2 : 0;
    const porc = n => Math.round(n / total * 100) + '%';
    const clic = x => ` onclick="filtrarLog('${periodo}:${x.f}')"`;
    let ac = 0;
    const arcos = partes.filter(x => x.n).map(x => {
        const largo = x.n / total * C, arco = `<circle r="${R}" cx="55" cy="55" fill="none" stroke="${x.c}" stroke-width="14" stroke-dasharray="${Math.max(largo - hueco, 0.1)} ${C}" stroke-dashoffset="${-ac}" transform="rotate(-90 55 55)"${clic(x)} style="cursor:pointer"><title>${x.t}: ${x.n} (${porc(x.n)})</title></circle>`;
        ac += largo;
        return arco;
    }).join('');
    const fila = (x, clase = '') => `<li class="${clase}${x.n ? '' : ' cero'}${logi.filtro === periodo + ':' + x.f ? ' activo' : ''}"${clic(x)}><i style="background:${x.c}"></i>${x.t}<b>${x.n}</b><small>${porc(x.n)}</small></li>`;
    const [ok, ...resto] = partes;
    return `<div class="anillo-dia${periodo === 'dia' ? '' : ' fijo'} lg-anillo" data-p="${periodo}"><svg viewBox="0 0 110 110" role="img" aria-label="${esc(etiqueta + ' ' + titulo)}"><circle r="${R}" cx="55" cy="55" fill="none" stroke="#eef3f2" stroke-width="14"/>${arcos}
            <text x="55" y="53" text-anchor="middle" class="an-n">${total}</text><text x="55" y="68" text-anchor="middle" class="an-t">${total === 1 ? 'parada' : 'paradas'}</text></svg>
        <div class="anillo-cuerpo">${cab}<ul class="anillo-ley">${fila(ok, 'principal')}${resto.map(x => fila(x)).join('')}</ul></div></div>`;
}

function tarjetaLog(r, n, total) {
    const tp = TIPOS_LOG[r.tipo] || TIPOS_LOG.entrega, cerrada = r.estado !== 'pendiente', rp = r.reporte || {}, ok = okTxt(r), no = noTxt(r);
    const clase = r.estado === 'entregado' ? 'ok' : r.estado === 'no_entregado' ? 'no' : '';
    const titulo = r.contacto ? `<h3 class="cliente-link" data-c="${esc(r.contacto)}" onclick="verCliente(this.dataset.c, '${esc(r.comercial || '')}')" title="Ver historial del cliente">${esc(r.contacto)}</h3>` : `<h3>${esc(tituloLog(r))}</h3>`;
    const docs = (r.documentos || []).map(d => `<span class="lg-doc-chip">${esc(claseDoc(d.clase)?.t || 'Pedido')}${d.ovi ? ` · A <b>${esc(d.ovi)}</b>` : ''}${d.ov ? ` · B <b>${esc(d.ov)}</b>` : ''}</span>`).join('')
        + (r.incluyeDocs || []).map(d => `<span class="lg-doc-chip">${esc(NOMBRE_INCLUYE[d.k] || d.k)} · <b>${esc(d.numero)}</b></span>`).join('')
        + (r.radicacion || []).map(d => `<span class="lg-doc-chip rad">${esc(textoRad(d))}</span>`).join('');
    const lineas = [
        r.destino ? `<b>${r.tipo === 'envio' ? 'Destino' : 'Entregado en'}:</b> ${esc(r.destino)}${r.dirDestino ? ` · ${enlaceDir(r.dirDestino, r.destino)}` : ''}${r.telDestino ? ` · ${enlacesTel(r.telDestino)}` : ''}${r.transportadora ? ` · <b>Transportadora:</b> ${esc(r.transportadora)}` : ''}` : '',
        r.proveedor && (r.contacto || r.materiales?.length) ? `<b>Proveedor:</b> ${esc(r.proveedor)}` : '',
        r.materiales?.length ? `<b>Recoger:</b> ${esc(r.materiales.join(', '))}` : '',
        r.tipo === 'oficina' ? itemsOficina(r).map(x => `<b>${esc(x.split(':')[0])}</b>${x.includes(':') ? ':' + esc(x.split(':').slice(1).join(':')) : ''}`).join(' · ') : '',
        r.direccion ? `<b>Dirección:</b> ${enlaceDir(r.direccion, r.ciudad)}` : '',
        r.telefono ? `<b>Teléfono:</b> ${enlacesTel(r.telefono)}` : '',
        r.detalle ? `<b>Indicaciones:</b> ${esc(r.detalle)}` : ''
    ].filter(Boolean).map(x => `<p class="nota-plan">${x}</p>`).join('');
    let reporte = '';
    if (cerrada) {
        const hora = r.registrada ? horaLog(r.registrada) : '';
        const partes = r.estado === 'entregado'
            ? [`<b>${esc(ok)}</b>${hora ? ' a las ' + esc(hora) : ''}`, rp.recibio ? `<b>${esc(tp.rec)}:</b> ${esc(rp.recibio)}` : '', rp.guia ? `<b>Guía:</b> ${esc(rp.guia)}` : '', rp.radicado ? `<b>Radicado:</b> ${esc(rp.radicado)}` : '', rp.detalle ? `<b>Detalle:</b> ${esc(rp.detalle)}` : '', rp.faltantes?.length ? `<b>⚠ Sin hacer:</b> ${esc(rp.faltantes.join(' · '))}` : '', rp.novedad ? `<b>Novedad:</b> ${esc(rp.novedad)}` : '']
            : [`<b>${esc(no)}</b>${hora ? ' · ' + esc(hora) : ''}`, `<b>Motivo:</b> ${esc(rp.motivo || '')}`, rp.novedad ? esc(rp.novedad) : '', textoAccionLog(rp) ? `<b>${rp.accion === 'oficina' ? '🏢' : '📅'} ${esc(textoAccionLog(rp))}</b>` : ''];
        const fotos = (r.fotos || []).map((f, i) => `<a class="lg-foto" href="${esc(urlFoto(f))}" target="_blank" rel="noopener" title="Foto ${i + 1}"><img src="${esc(miniFoto(f))}" alt="Foto ${i + 1}" loading="lazy"></a>`).join('');
        const pend = (leerFotosPend()[r.id] || []).length;
        reporte = `<div class="reporte">${partes.filter(Boolean).join('<br>')}${!fotos && !pend ? '<div class="lg-sin-foto">📷 Sin foto</div>' : ''}${fotos || pend ? `<div class="lg-fotos fija">${fotos}${pend ? `<span class="chip np">${pend} ${pend === 1 ? 'foto subiendo' : 'fotos subiendo'}…</span>` : ''}</div>` : ''}</div>`;
    }
    let acciones = '';
    if (logi.soloLectura) {
        acciones = cerrada ? `<div class="acciones cerrada"><span class="nota-cierre">Reportado el ${esc(fechaHora(r.registrada))} por ${esc(nombreVendedor(r.reportadoPor || r.vendedor))}</span></div>` : '';
    } else if (!cerrada) {
        acciones = `<div class="acciones">
            <button class="bv ok" onclick="abrirLogReporte('${r.id}', true)">✓ ${esc(ok)}</button>
            <button class="bv no" onclick="abrirLogReporte('${r.id}', false)">✕ ${esc(no)}</button>
            <button class="link-mini" onclick="abrirLogForm('${r.id}')">Editar</button>
            <button type="button" class="link-mini peligro" onclick="eliminarLog('${r.id}')">🗑 Eliminar</button></div>`;
    } else {
        acciones = `<div class="acciones cerrada"><span class="nota-cierre">🔒 Reportado el ${esc(fechaHora(r.registrada))} por ${esc(nombreVendedor(r.reportadoPor || r.vendedor))}${r.correcciones?.length ? ` · corregido ${r.correcciones.length} ${r.correcciones.length === 1 ? 'vez' : 'veces'}` : ''}</span>
            ${puedeCorregirLog() ? `<button class="link-mini" onclick="reabrirLog('${r.id}')">✏️ Corregir reporte</button>` : ''}</div>`;
    }
    // Las de hora fija van por hora; las demás se ordenan con Subir / Bajar
    const sueltas = logRegs().filter(x => x.fecha === r.fecha && x.vendedor === r.vendedor && !x.hora).sort(ordenLog), k = sueltas.findIndex(x => x.id === r.id);
    const mover = !logi.soloLectura && !cerrada && !r.hora && sueltas.length > 1 ? `<div class="mover-orden"><span>Orden en la ruta <b>${n}</b> de ${total}</span>
        <button type="button" onclick="moverLog('${r.id}', -1)" ${k === 0 ? 'disabled' : ''}>▲ Subir</button><button type="button" onclick="moverLog('${r.id}', 1)" ${k === sueltas.length - 1 ? 'disabled' : ''}>▼ Bajar</button></div>` : '';
    const meta = [nombreTipos(r), r.zona || '', r.vieneDe ? `reprogramada (era del ${fechaCorta(r.vieneDe)})` : ''].filter(Boolean).join(' · ');
    return `<div class="producto-card visita-card lg-card ${clase} lg-${r.tipo}">
        <div class="visita-cab"><div>${r.hora ? `<span class="cita-fija"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Hora fija ${esc(horaBonita(r.hora))}</span><br>` : ''}<span class="ordenes"><span class="ord prog">${n}</span></span>${titulo}<br><span class="lg-tipo ${r.tipo}">${esc(tp.corto)}</span>${(r.incluye || []).map(k => `<span class="lg-tipo ${k}">${esc(NOMBRE_INCLUYE[k] || k)}</span>`).join('')}${r.tipo !== 'radicacion' && conRadicacion(r) ? '<span class="lg-tipo radicacion">Radicación</span>' : ''}${r.tipo === 'oficina' ? (r.oficina || []).map(k => `<span class="lg-tipo oficina">${esc(OFICINA_LOG.find(x => x[0] === k)?.[1] || k)}</span>`).join('') : ''}${r.proveedorOtro || r.contactoOtro ? '<span class="lg-otro" title="No está en la Maestra">Otros</span>' : ''}${chipsIntentoLog(r)}</div>${chipEstadoLog(r)}</div>
        ${mover}
        <p class="meta">${esc(meta)}</p>
        ${(r.ediciones || []).length ? (e => `<p class="lg-huella" title="${esc(r.ediciones.map(x => `${nombreVendedor(x.por)} · ${fechaHora(x.cuando)}: ${x.campos.join(', ')}`).join('\n'))}">✏️ Editada por ${esc(nombreVendedor(e.por))} · ${esc(fechaHora(e.cuando))} · cambió ${esc(e.campos.join(', '))}${r.ediciones.length > 1 ? ` · ${r.ediciones.length} ediciones` : ''}</p>`)(r.ediciones[r.ediciones.length - 1]) : ''}
        ${docs ? `<div class="lg-docs">${docs}</div>` : ''}
        ${lineas}
        ${reporte}
        ${acciones}
    </div>`;
}

// ---------- PROGRAMAR / EDITAR UNA PARADA ----------
// Orden del formulario: fecha (y hora si es fija) → cliente (dirección y teléfono salen solos) → tipo de parada → lo de ese tipo
function abrirLogForm(id) {
    if (!puedeOperarLog()) return;
    const r = id ? registros[id] : null;
    if (r && r.tipo !== 'novedad' && r.estado !== 'pendiente') return toast('Esta parada ya se reportó');
    const mens = esCoordLog() || esAdmin();
    const clientes = [...new Set([...Object.values(contactos).flat().map(c => c.n), ...leadsLog().map(p => p.nombre)])].sort((a, b) => a.localeCompare(b, 'es'));
    const provs = [...new Set([...Object.values(proveedoresMaestra.filas).map(p => p.n), ...logRegs().map(x => x.proveedor)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const docs = k => (r?.documentos || []).filter(d => d.clase === k);
    const rads = k => (r?.radicacion || []).filter(d => d.doc === k);
    const rad = k => rads(k)[0];
    abrirModal(`<form class="form-rc" onsubmit="guardarLog(event, '${id || ''}')">
        <h2>${r ? 'Editar parada' : 'Programar parada'}</h2>
        <div class="fila-fecha lg-fila-fecha">
            <div><label for="lgFecha">Fecha ${REQ}</label><input type="date" id="lgFecha" required min="${r && r.fecha < hoy() ? r.fecha : hoy()}" data-min="${r && r.fecha < hoy() ? r.fecha : hoy()}" value="${esc(r?.fecha || logi.fecha || hoy())}"></div>
            <div id="lgFilaHora"><label for="lgHora">Hora <small>(si es fija)</small></label><input type="time" id="lgHora" value="${esc(r?.hora || '')}"></div>
            ${mens ? `<div><label for="lgMens">Mensajero ${REQ}</label><select id="lgMens" required>${MENSAJEROS.map(m => `<option value="${m.id}"${(r?.vendedor || logi.mensajero) === m.id ? ' selected' : ''}>${esc(m.nombre)}${m.id === sesion.id ? ' (yo)' : ''}</option>`).join('')}</select></div>` : ''}
        </div>
        <label>Tipo de parada ${REQ}</label>
        <div class="lg-chips" id="lgTipos">${Object.entries(TIPOS_LOG).filter(([k]) => k !== 'radicacion').map(([k, v]) => `<label class="lg-chip"><input type="radio" name="lgTipo" value="${k}"${r?.tipo === k ? ' checked' : ''} onclick="tipoClick(this)"><span>${esc(v.t)}</span></label>`).join('')}
            <label class="lg-chip lg-chip-rad"><input type="checkbox" id="lgRadChk"${r && conRadicacion(r) ? ' checked' : ''} onchange="logCampos()"><span>${esc(TIPOS_LOG.radicacion.t)}</span></label></div>
        <p class="ayuda">Escoge uno. La radicación de documentos puede ir sola o sumarse a cualquier otro.</p>
        <details class="lg-grafico lg-novs-sel" id="lgNovDet"${r?.tipo === 'novedad' ? ' open' : ''}>
        <summary>🗓 Novedades <small>(del mensajero: cita médica, incapacidad, permiso, vacaciones)</small></summary>
        <div class="lg-chips" id="lgNovs">${NOVEDADES_LOG.map(n => `<label class="lg-chip"><input type="radio" name="lgTipo" value="nov:${esc(n)}"${r?.tipo === 'novedad' && r.novedad === n ? ' checked' : ''} onclick="tipoClick(this)"><span>${ICONO_NOV[n]} ${esc(n)}</span></label>`).join('')}</div>
        </details>
        <div id="lgBOficina" hidden>
            <label>Qué se hace en la oficina ${REQ} <small>(marca lo que aplica)</small></label>
            <div class="lg-chips" id="lgOfChips">${OFICINA_LOG.map(([k, t]) => `<label class="lg-chip"><input type="checkbox" value="${k}"${(r?.oficina || []).includes(k) ? ' checked' : ''} onchange="logCampos()"><span>${t}</span></label>`).join('')}</div>
        </div>
        <div id="lgBVuelta">
            <label for="lgArea">Área ${REQ}</label>
            <select id="lgArea">${AREAS_LOG.map(a => `<option${r?.area === a ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>
        </div>
        <div id="lgBCli">
        <label for="lgCliente"><span id="lgTxtCli">Cliente</span> <small>(Maestra de clientes)</small> <span id="lgReqCli"></span></label>
        <input id="lgCliente" list="dlLogClientes" autocomplete="off" placeholder="Busca el cliente" value="${esc(r?.contacto || '')}" oninput="logInfoCliente()" onchange="logInfoCliente()"${r?.contacto ? ' readonly class="lg-bloq" title="No se cambia al editar"' : ''}>
        ${r?.contacto ? '<p class="ayuda lg-bloq-nota">🔒 El cliente no se cambia al editar. Si es otro, elimina la parada y programa una nueva.</p>' : ''}
        <datalist id="dlLogClientes">${clientes.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <p class="ayuda" id="lgInfoCli"></p>
        <p class="ayuda lg-otro-nota" id="lgOtroCont" hidden>🆕 <b>Otros:</b> este contacto no está en la Maestra. Escribe su dirección y su teléfono; la parada queda marcada como "Otros".</p>
        </div>
        <div id="lgBProv">
            <label for="lgProv">Proveedor ${REQ}</label>
            <input id="lgProv" list="dlLogProv" autocomplete="off" placeholder="Busca proveedor" oninput="logInfoProv()" onchange="logInfoProv()" value="${esc(r?.proveedor || '')}"${r?.proveedor ? ' readonly class="lg-bloq" title="No se cambia al editar"' : ''}>
            ${r?.proveedor ? '<p class="ayuda lg-bloq-nota">🔒 El proveedor no se cambia al editar. Si es otro, elimina la parada y programa una nueva.</p>' : ''}
            <p class="ayuda lg-otro-nota" id="lgOtroProv" hidden>🆕 <b>Otros:</b> este proveedor no está en la Maestra. Escribe su dirección y su teléfono; la parada queda marcada como "Otros".</p><datalist id="dlLogProv">${provs.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
        </div>
        <div id="lgOfAforar" hidden>
            <label>Facturas a aforar ${REQ} <small>(puede ser más de una)</small></label>
            <div id="lgOfFacs">${((r?.facturasAforo || []).length ? r.facturasAforo : [{}]).map(f => filaOfFac(f)).join('')}</div>
            <button type="button" class="link-mini lg-mas" onclick="agregarOfFac()">+ Otra factura</button>
        </div>
        <div id="lgOfOtro" hidden><label for="lgOfOtroTxt">Otro: ¿qué se hace en la oficina? ${REQ}</label><input id="lgOfOtroTxt" maxlength="100" autocomplete="off" value="${esc(r?.otroOficina || '')}"></div>
        <div id="lgBDirTel"><label for="lgDir">Dirección <small>(sale sola con el <span id="lgQuienDir">cliente</span>; puedes cambiarla)</small></label>
        <input id="lgDir" autocomplete="off" maxlength="120" value="${esc(r?.direccion || '')}" oninput="this.dataset.auto = ''">
        <label for="lgTel">Teléfono <small>(sale solo con el <span id="lgQuienTel">cliente</span>; puedes cambiarlo)</small></label>
        <input id="lgTel" type="tel" autocomplete="off" maxlength="40" value="${esc(r?.telefono || '')}" oninput="this.dataset.auto = ''"></div>
        <div id="lgBDocs">
            <label>Factura <span id="lgReqDoc">${REQ}</span> <small>(marca qué llevas)</small></label>
            <div class="lg-pedidos">${CLASES_PEDIDO.map(c => `<div class="lg-pedido" data-k="${c.k}">
                <label class="lg-pchk"><input type="checkbox"${docs(c.k).length ? ' checked' : ''} onchange="logCampos()"><span>${esc(c.t)}</span></label>
                <div class="lg-pcampos">${c.campos.map(([f, t]) => {
                    // A y B son facturas independientes: cada una tiene sus casillas y su "+ Otra factura"
                    const valores = docs(c.k).map(d => d[f]).filter(Boolean);
                    return `<div class="lg-pgrupo">${(valores.length ? valores : ['']).map(v => `<div class="lg-pset"><label class="lg-pc"><span class="lg-pref">${t}</span><input data-f="${f}" ${NUM6} value="${esc(v)}"></label><button type="button" class="lg-quitar" title="Quitar esta factura" aria-label="Quitar esta factura" onclick="quitarSetLog(this)" hidden>×</button></div>`).join('')}<button type="button" class="link-mini lg-mas" onclick="masSetLog(this)">+ Otra factura ${t}</button></div>`;
                }).join('')}</div>
            </div>`).join('')}</div>
        </div>
        <div id="lgBIncluyeEnvio">
            <label><span id="lgTitInc">Este envío también incluye</span> <small>(opcional: marca y escribe el número del documento; puedes agregar varios)</small></label>
            <div class="lg-pedidos">${Object.entries(INCLUYE_ENVIO).map(([k, t]) => {
                const nums = (r?.incluyeDocs || []).filter(d => d.k === k).map(d => d.numero);
                return `<div class="lg-pedido" data-k="${k}">
                <label class="lg-pchk"><input type="checkbox"${r?.incluye?.includes(k) ? ' checked' : ''} onchange="logCampos()"><span>${esc(t)}</span></label>
                <div class="lg-pcampos"><div class="lg-pgrupo">${(nums.length ? nums : ['']).map(v => `<div class="lg-pset"><label class="lg-pc"><span class="lg-pref">Nº</span><input data-f="numero" ${NUM6} value="${esc(v)}"></label><button type="button" class="lg-quitar" title="Quitar este documento" aria-label="Quitar este documento" onclick="quitarSetLog(this)" hidden>×</button></div>`).join('')}<button type="button" class="link-mini lg-mas" onclick="masSetLog(this)">+ Otro ${esc(t)}</button></div></div>
            </div>`; }).join('')}</div>
        </div>
        <div id="lgBRecol">
            <label>Qué se recoge</label>
            <div class="lg-chips" id="lgMateriales">${MATERIALES_LOG.map(m => `<label class="lg-chip"><input type="checkbox" value="${esc(m)}"${r?.materiales?.includes(m) ? ' checked' : ''}><span>${esc(m)}</span></label>`).join('')}</div>
        </div>
        <div id="lgBBanco">
            <label for="lgBanco">Banco ${REQ}</label>
            <input id="lgBanco" list="lgBancos" maxlength="60" autocomplete="off" placeholder="Escoge o escribe el banco" value="${esc(r?.entidad || '')}">
            <datalist id="lgBancos">${BANCOS_LOG.map(b => `<option value="${esc(b)}">`).join('')}</datalist>
        </div>
        <div id="lgBRadA">
            <label>La radicación es a</label>
            <div class="lg-chips"><label class="lg-chip"><input type="radio" name="lgRadA" value="cliente"${r && conRadicacion(r) && r.proveedor && !r.contacto ? '' : ' checked'} onchange="logCampos()"><span>Cliente</span></label>
                <label class="lg-chip"><input type="radio" name="lgRadA" value="proveedor"${r && conRadicacion(r) && r.proveedor && !r.contacto ? ' checked' : ''} onchange="logCampos()"><span>Proveedor</span></label></div>
        </div>
        <div id="lgBRad">
            <label>Qué se radica ${REQ}</label>
            <div class="lg-pedidos">${DOCS_RADICACION.map(c => `<div class="lg-pedido lg-rad" data-k="${c.k}">
                <label class="lg-pchk"><input type="checkbox"${rad(c.k) ? ' checked' : ''} onchange="logCampos()"><span>${esc(c.t)}</span></label>
                <div class="lg-pcampos">${c.k === 'otros'
                    ? `<label class="lg-pc"><input data-f="texto" placeholder="Qué documento se radica" autocomplete="off" maxlength="80" value="${esc(rad('otros')?.texto || '')}"></label>`
                    : `<div class="lg-pgrupo">${(rads(c.k).length ? rads(c.k) : [{}]).map(d => `<div class="lg-pset">${c.k === 'factura'
                        ? `<label class="lg-pc"><select data-f="serie" class="lg-pref lg-serie" aria-label="Serie de la factura">${Object.entries(SERIES_FACTURA).map(([s, t]) => `<option value="${s}"${d.serie === s ? ' selected' : ''}>${s}</option>`).join('')}</select><input data-f="numero" ${NUM6} value="${esc(d.numero || '')}"></label>`
                        : `<label class="lg-pc"><span class="lg-pref">RNC</span><input data-f="numero" ${NUM6} value="${esc(d.numero || '')}"></label>`}<button type="button" class="lg-quitar" title="Quitar" aria-label="Quitar" onclick="quitarSetLog(this)" hidden>×</button></div>`).join('')}<button type="button" class="link-mini lg-mas" onclick="masSetLog(this)">+ Otra ${c.k === 'factura' ? 'factura' : 'nota crédito'}</button></div>`}</div>
            </div>`).join('')}</div>
        </div>
        <div id="lgBNov" hidden>
            <div class="fila-fecha compacta"><div><label for="lgHasta">Hasta <small>(si son varios días)</small></label><input type="date" id="lgHasta" value="${esc(r?.tipo === 'novedad' && r.hasta !== r.fecha ? r.hasta || '' : '')}"></div></div>
            <label class="lg-chip lg-dia-completo"><input type="checkbox" id="lgDiaCompleto"${r?.tipo === 'novedad' && !r.diaCompleto ? '' : ' checked'} onchange="logCampos()"><span>Día completo</span></label>
            <div class="fila-fecha compacta" id="lgHorasNov"><div><label for="lgHoraIni">Hora de inicio ${REQ}</label><input type="time" id="lgHoraIni" value="${esc(r?.horaInicio || '')}"></div><div><label for="lgHoraFin">Hora de fin ${REQ}</label><input type="time" id="lgHoraFin" value="${esc(r?.horaFin || '')}"></div></div>
        </div>
        <label for="lgDetalle" id="lgLblDet">Indicaciones <small>(opcional)</small></label>
        <textarea id="lgDetalle" rows="2" maxlength="200" placeholder="Ej: preguntar por la jefe de compras, recoger uniformes de las 3 sedes…">${esc(r?.detalle || '')}</textarea>
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario">${r ? 'Guardar cambios' : 'Programar'}</button>
        </div>
    </form>`);
    logCampos();
    logInfoCliente(false);
}

// El tipo principal (radio) o, si solo se marcó la radicación, 'radicacion'
const radMarcada = () => !!$('lgRadChk')?.checked;
// La radicación puede ser a un proveedor (salvo en entrega y envío, que siempre llevan cliente)
const radAProv = () => radMarcada() && !['entrega', 'envio'].includes(tipoMarcado()) && document.querySelector('input[name=lgRadA]:checked')?.value === 'proveedor';
// Cada factura a aforar lleva su serie (A = OVI o B = OV) y su número de 6 cifras, como en el resto de Logística
const filaOfFac = (f = {}) => `<div class="lg-of-fila"><label class="lg-pc"><select class="lg-pref lg-serie lg-of-serie" aria-label="Serie de la factura">${Object.keys(SERIES_FACTURA).map(sr => `<option value="${sr}"${f.serie === sr ? ' selected' : ''}>${sr}</option>`).join('')}</select><input class="lg-of-fac" ${NUM6} value="${esc(f.numero || '')}"></label></div>`;
function agregarOfFac() {
    $('lgOfFacs').insertAdjacentHTML('beforeend', filaOfFac()); $('lgOfFacs').lastElementChild.querySelector('input').focus();
}
const tipoMarcado = () => document.querySelector('input[name=lgTipo]:checked')?.value || (radMarcada() ? 'radicacion' : '');
// Tocar otra vez el tipo marcado lo desmarca (para dejar solo la radicación)
function tipoClick(el) {
    if (el.dataset.on === '1') el.checked = false;
    document.querySelectorAll('input[name=lgTipo]').forEach(i => { i.dataset.on = i.checked ? '1' : ''; });
    logCampos();
}
const incluyeMarcado = () => [...document.querySelectorAll('#lgBIncluyeEnvio .lg-pedido')].filter(f => f.querySelector('.lg-pchk input').checked).map(f => f.dataset.k);
// Muestra solo los campos del tipo de parada escogido
function logCampos() {
    document.querySelectorAll('input[name=lgTipo]').forEach(i => { i.dataset.on = i.checked ? '1' : ''; });
    const k = tipoMarcado(), nv = k.startsWith('nov:') ? k.slice(4) : '';
    $('lgBNov').hidden = !nv; $('lgFilaHora').hidden = !!nv;
    $('lgFecha').min = nv ? '' : $('lgFecha').dataset.min;
    if (nv) {   // Novedad del mensajero: solo fechas, horas (cita y permiso) y el detalle
        $('lgRadChk').checked = false;
        ['lgBRadA', 'lgBIncluyeEnvio', 'lgBCli', 'lgBProv', 'lgBDocs', 'lgBRad', 'lgBRecol', 'lgBVuelta', 'lgBOficina', 'lgOfAforar', 'lgOfOtro', 'lgBDirTel', 'lgBBanco'].forEach(id => { $(id).hidden = true; });
        document.querySelectorAll('.lg-of-fac').forEach(i => { i.required = false; }); $('lgOfOtroTxt').required = false;
        ['lgCliente', 'lgProv', 'lgBanco', 'lgDir', 'lgTel'].forEach(id => { $(id).required = false; });
        document.querySelectorAll('.lg-pcampos input').forEach(i => { i.required = false; });
        const rango = ['Vacaciones', 'Incapacidad', 'Permiso'].includes(nv), horas = ['Cita médica', 'Permiso'].includes(nv), porHoras = horas && !$('lgDiaCompleto').checked;
        $('lgHasta').closest('.fila-fecha').hidden = !rango || porHoras;
        $('lgDiaCompleto').closest('label').hidden = !horas;
        $('lgHorasNov').hidden = !porHoras; $('lgHoraIni').required = $('lgHoraFin').required = porHoras;
        const obl = { Permiso: 'motivo del permiso', Incapacidad: 'razón de la incapacidad', 'Cita médica': 'motivo de la cita (máx. 50 caracteres)' }[nv];
        $('lgLblDet').innerHTML = obl ? `Detalle: ${obl} ${REQ}` : 'Detalle <small>(opcional)</small>';
        $('lgDetalle').required = !!obl; $('lgDetalle').maxLength = nv === 'Cita médica' ? 50 : 200;
        return;
    }
    $('lgDetalle').maxLength = 200;
    const tp = TIPOS_LOG[k] || {}, conRad = radMarcada();
    const ofSel = tp.oficina ? [...document.querySelectorAll('#lgOfChips input:checked')].map(i => i.value) : [], aforar = ofSel.includes('aforar');
    $('lgBOficina').hidden = !tp.oficina; $('lgOfAforar').hidden = !aforar; $('lgOfOtro').hidden = !ofSel.includes('otro');
    document.querySelectorAll('.lg-of-fac').forEach((i, n) => { i.required = aforar && n === 0; }); $('lgOfOtroTxt').required = ofSel.includes('otro');
    $('lgReqCli').innerHTML = tp.cliente || conRad || aforar ? REQ : '<small>(si aplica)</small>';
    const aProv = radAProv(), conProv = !!tp.recoleccion || aProv;
    $('lgBRadA').hidden = !conRad || k === 'entrega' || k === 'envio';
    $('lgCliente').required = (!!(tp.cliente || conRad) || aforar) && !aProv;
    $('lgBIncluyeEnvio').hidden = k !== 'entrega' && k !== 'envio';
    $('lgTitInc').textContent = k === 'entrega' ? 'Esta entrega también incluye' : 'Este envío también incluye';
    // Proveedor: en vez del cliente va el proveedor; Trámite área: el cliente se llama contacto
    $('lgBCli').hidden = aProv || ((!!tp.recoleccion || !!tp.banco) && !conRad) || (!!tp.oficina && !aforar && !conRad);
    $('lgBProv').hidden = !conProv;
    $('lgTxtCli').textContent = k === 'vuelta' ? 'Contacto' : 'Cliente';
    logInfoCliente(false);
    $('lgCliente').placeholder = k === 'vuelta' ? 'Busca el contacto' : 'Busca el cliente';
    $('lgBDocs').hidden = !tp.docs;
    // En la entrega, los pedidos son obligatorios salvo que solo se vaya a recoger una devolución o una PQR
    const docsObl = (k === 'envio' || k === 'entrega') && !incluyeMarcado().length;
    $('lgReqDoc').innerHTML = docsObl ? REQ : '<small>(opcional)</small>';
    $('lgBRad').hidden = !conRad || aProv;
    $('lgBRecol').hidden = !tp.recoleccion; $('lgProv').required = conProv; logInfoProv();
    $('lgBVuelta').hidden = !tp.vuelta;
    $('lgBDirTel').hidden = !!tp.banco || !!tp.oficina;
    $('lgQuienDir').textContent = $('lgQuienTel').textContent = conProv ? 'proveedor' : k === 'vuelta' ? 'contacto' : 'cliente';
    $('lgBBanco').hidden = !tp.banco; $('lgBanco').required = !!tp.banco;
    $('lgLblDet').innerHTML = tp.vuelta || tp.banco ? `Qué hay que hacer ${REQ}` : aProv ? `Qué se radica ${REQ}` : 'Indicaciones <small>(opcional)</small>';
    $('lgDetalle').required = !!(tp.vuelta || tp.banco || aProv);
    // Cada casilla marcada (clase de pedido o documento a radicar) muestra sus campos, que pasan a ser obligatorios
    document.querySelectorAll('.lg-pedido').forEach(fila => {
        const visible = !fila.closest('[hidden]'), on = fila.querySelector('.lg-pchk input').checked && visible;
        fila.classList.toggle('on', on);
        fila.querySelector('.lg-pcampos').hidden = !on;
        // Solo la primera factura es obligatoria (Magistral Individual: basta A o B, se revisa al guardar); las demás, si se dejan vacías, se ignoran
        const grupos = fila.querySelectorAll('.lg-pgrupo');
        fila.querySelectorAll('.lg-pcampos input').forEach(i => { i.required = on && !grupos.length; });
        if (on && grupos.length === 1) { const i = grupos[0].querySelector('input'); if (i) i.required = true; }
        grupos.forEach(refrescarSetsLog);
    });
}
// Dirección y teléfono obligatorios cuando el proveedor o el contacto es "Otros" (no está en la Maestra)
function obligDirTelLog() {
    const otro = !$('lgOtroProv').hidden || !$('lgOtroCont').hidden;
    $('lgDir').required = $('lgTel').required = otro && !$('lgBDirTel').hidden;
}
// Dirección y teléfono del proveedor, de la maestra (si los trae); no pisa lo que escribe logística
function logInfoProv() {
    const nombre = ($('lgProv')?.value || '').trim(), p = proveedoresMaestra.filas[normalizar(nombre)];
    // Un proveedor que no está en la Maestra es "Otros": dirección y teléfono a mano
    const otro = !!nombre && !p && !$('lgBProv').hidden;
    $('lgOtroProv').hidden = !otro;
    obligDirTelLog();
    if (!p) return;
    [['lgDir', p.dir], ['lgTel', p.tel]].forEach(([id, v]) => { const c = $(id); if (v && c && (!c.value || c.dataset.auto === '1')) { c.value = v; c.dataset.auto = '1'; } });
}
// A quién le llega la entrega (el vendedor de la zona del cliente) y los datos del cliente en la Maestra
function datosClienteLog(nombre) {
    const zona = nombre ? zonaDeContacto(nombre) : '', c = zona ? buscarMaestra(zona, nombre) : null, d = dirDe(nombre);
    const lead = !zona ? leadPorNombre(nombre) : null;
    if (lead) return { zona: lead.zona || '', comercial: lead.vendedor || (lead.zona ? vendedorDeZona(lead.zona)?.id || '' : ''), ciudad: lead.ciudad || '', dir: lead.direccion || '', tel: lead.telefono || '', lead: true };
    return { zona: zona || '', comercial: zona ? vendedorDeZona(zona)?.id || '' : '', ciudad: c?.c || d?.c || '', dir: d?.dir || '', tel: d?.tel || '' };
}
// Dirección y teléfono: los de la Maestra y, si la Maestra aún no los tiene, los de la última parada a ese cliente.
// Solo se llenan si el campo está vacío o se llenó solo (lo que escribe logística no se pisa).
function logInfoCliente(rellenar = true) {
    const nombre = $('lgCliente')?.value.trim();
    if (!$('lgInfoCli')) return;
    // Trámite área: un contacto que no está en la Maestra ni es lead es "Otros": dirección y teléfono a mano
    const otroCont = tipoMarcado() === 'vuelta' && !!nombre && !zonaDeContacto(nombre) && !leadPorNombre(nombre);
    $('lgOtroCont').hidden = !otroCont;
    obligDirTelLog();
    if (!nombre) { $('lgInfoCli').textContent = ''; return; }
    const d = datosClienteLog(nombre);
    $('lgInfoCli').innerHTML = d.lead ? `✓ Lead${d.zona ? ' · ' + esc(d.zona) : ''}${d.comercial ? ' · ' + esc(nombreVendedor(d.comercial)) + ' verá esta entrega en el historial del cliente' : ''}`
        : d.comercial ? `✓ ${esc(d.zona)} · ${esc(nombreVendedor(d.comercial))} verá esta entrega en el historial del cliente${d.ciudad ? ' · ' + esc(d.ciudad) : ''}`
        : 'No está en la Maestra: no se le avisará a ningún comercial.';
    if (!rellenar) return;
    const ultima = logRegs().filter(x => x.contacto && normalizar(x.contacto) === normalizar(nombre) && (x.direccion || x.telefono)).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const poner = (campo, valor) => { if (valor && (!campo.value || campo.dataset.auto === '1')) { campo.value = valor; campo.dataset.auto = '1'; } };
    poner($('lgDir'), d.dir || ultima?.direccion);
    poner($('lgTel'), d.tel || ultima?.telefono);
}

async function guardarNovedadLog(e, id, nv) {
    const antes = id ? registros[id] : null, desde = $('lgFecha').value;
    const horas = ['Cita médica', 'Permiso'].includes(nv), porHoras = horas && !$('lgDiaCompleto').checked;
    const horaInicio = porHoras ? $('lgHoraIni').value : '', horaFin = porHoras ? $('lgHoraFin').value : '';
    if (!desde) return toast('Elige la fecha');
    if (porHoras && horaFin <= horaInicio) return toast('La hora de fin debe ser después de la hora de inicio');
    const hasta = ['Vacaciones', 'Incapacidad', 'Permiso'].includes(nv) && !porHoras && $('lgHasta').value ? $('lgHasta').value : desde;
    if (hasta < desde) return toast('La fecha "Hasta" no puede ser antes de "Desde"');
    const vendedor = $('lgMens') ? $('lgMens').value : (antes?.vendedor || sesion.id);
    const n = { ...(antes || { id: nuevoId(), clase: 'logistica', creado: new Date().toISOString(), creadoPor: sesion.id }),
        tipo: 'novedad', novedad: nv, vendedor, fecha: desde, hasta, diaCompleto: horas ? !porHoras : true, horaInicio, horaFin, detalle: $('lgDetalle').value.trim() };
    guardarRegistro(n);
    cerrarModal();
    logi.fecha = desde; pintarLog();
    const pend = logRegs().filter(x => x.vendedor === vendedor && x.estado === 'pendiente' && x.fecha >= desde && x.fecha <= hasta).length;
    toast(`${nv} registrada para ${primerNombre(vendedor)}: ${rangoNovLog(n)}${pend ? ` · tiene ${pend} ${pend === 1 ? 'parada programada' : 'paradas programadas'} esos días: reasígnalas` : ''}`);
}
async function eliminarNovLog(id) {
    const n = registros[id];
    if (!n || !await dialogo({ titulo: '¿Eliminar esta novedad?', texto: `${n.novedad} · ${nombreVendedor(n.vendedor)} · ${rangoNovLog(n)}`, aceptar: 'Eliminar' })) return;
    borrarRegistro({ ...n });
    toast('Novedad eliminada'); pintarLog();
}
// Las novedades del día van en un panel que se puede esconder, igual que el gráfico de entregas
const panelNovLog = lista => !lista.length ? '' : `<details class="lg-grafico lg-novs"${logi.novAbierto === false ? '' : ' open'} ontoggle="logi.novAbierto = this.open">
    <summary>🗓 Novedades del día <small>${lista.length} ${lista.length === 1 ? 'novedad' : 'novedades'}</small></summary>${lista.map(tarjetaNovLog).join('')}</details>`;
const tarjetaNovLog = n => `<div class="producto-card novedad-card lg-nov">
    <div class="visita-cab"><div><span class="vend-card">${esc(nombreVendedor(n.vendedor))}</span><h3>${ICONO_NOV[n.novedad] || ''} ${esc(n.novedad)}</h3></div><span class="chip lg-nov-chip">${esc(n.novedad)}</span></div>
    <p class="meta">${esc(rangoNovLog(n))}</p>${n.detalle ? `<p>${esc(n.detalle)}</p>` : ''}
    ${puedeOperarLog() && (esCoordLog() || esAdmin() || n.vendedor === sesion.id) ? `<div class="acciones"><button type="button" class="btn-link" onclick="abrirLogForm('${n.id}')">Editar</button><button type="button" class="btn-link peligro" onclick="eliminarNovLog('${n.id}')">Eliminar</button></div>` : ''}
</div>`;
async function guardarLog(e, id) {
    e.preventDefault();
    if (tipoMarcado().startsWith('nov:')) return guardarNovedadLog(e, id, tipoMarcado().slice(4));
    const antes = id ? registros[id] : null, tipo = tipoMarcado(), tp = TIPOS_LOG[tipo], fecha = $('lgFecha').value;
    if (!tp) return toast('Escoge el tipo de parada');
    const conRad = radMarcada(), tipos = conRad && tipo !== 'radicacion' ? [tipo, 'radicacion'] : [tipo];
    if (!fecha) return toast('Elige la fecha');
    const vendedor = $('lgMens') ? $('lgMens').value : (antes?.vendedor || sesion.id);
    const errFecha = errorFechaLog(fecha, vendedor, antes?.id || '', !!antes && antes.fecha === fecha && antes.vendedor === vendedor);
    if (errFecha) return toast(errFecha);
    if (!(antes && antes.fecha === fecha) && !await confirmarDiaLog(fecha, vendedor)) return;
    const incluye = tipo === 'entrega' || tipo === 'envio' ? incluyeMarcado() : [];   // lo que también va: PQR/OUT, REA/OUT, Devolución
    // Cada línea marcada puede tener varias facturas (una por bloque); los bloques vacíos de más se ignoran
    const leer = sel => [...document.querySelectorAll(sel)].filter(f => f.querySelector('.lg-pchk input').checked).flatMap(f => {
        const sets = [...f.querySelectorAll('.lg-pset')], bloques = sets.length ? sets : [f.querySelector('.lg-pcampos')];   // un bloque por factura
        const lista = bloques.map(b => { const d = {}; b.querySelectorAll('[data-f]').forEach(i => { d[i.dataset.f] = ['ov', 'ovi', 'numero'].includes(i.dataset.f) ? seisCifras(i.value) : i.value.trim(); }); return { k: f.dataset.k, d }; });
        const llenos = lista.filter(x => Object.entries(x.d).some(([c, v]) => c !== 'serie' && v));
        return llenos.length ? llenos : lista.slice(0, 1);
    });
    const documentos = tp.docs ? leer('#lgBDocs .lg-pedido').map(({ k, d }) => ({ clase: k, ...d })) : [];
    const radicacion = conRad && !radAProv() ? leer('#lgBRad .lg-pedido').map(({ k, d }) => ({ doc: k, ...d })) : [];
    // Entrega o envío: número(s) de cada documento que también va (PQR/OUT, REA/OUT, Devolución)
    const incluyeDocs = incluye.length ? leer('#lgBIncluyeEnvio .lg-pedido').map(({ k, d }) => ({ k, numero: d.numero })).filter(d => d.numero) : [];
    const sinNumeroInc = incluye.find(k => !incluyeDocs.some(d => d.k === k));
    if (sinNumeroInc) return toast(`${INCLUYE_ENVIO[sinNumeroInc]}: escribe el número del documento`);
    // Una misma factura no se repite dentro de la parada
    const claves = [...documentos.flatMap(d => [d.ov && `B ${d.clase} ${d.ov}`, d.ovi && `A ${d.clase} ${d.ovi}`]), ...incluyeDocs.map(d => `${d.k} ${d.numero}`), ...radicacion.filter(d => d.numero).map(d => `${d.doc} ${d.serie || ''} ${d.numero}`)].filter(Boolean);
    const repetida = claves.find((x, i) => claves.indexOf(x) !== i);
    if (repetida) return toast('Hay una factura repetida en la parada: revisa los números');
    const sinNumero = documentos.find(d => !d.ov && !d.ovi);
    if (sinNumero) return toast(`${claseDoc(sinNumero.clase)?.t}: escribe al menos la factura A o la B`);
    if ((tipo === 'envio' || tipo === 'entrega') && !incluye.length && !documentos.length) return toast('Marca qué pedido llevas y escribe sus números');
    if (conRad && !radAProv() && !radicacion.length) return toast('Marca qué se radica: factura, nota crédito u otros');
    if (radicacion.some(d => d.doc !== 'otros' ? !d.numero : !d.texto)) return toast('Escribe el número (o el documento) de lo que se radica');
    // Oficina: qué se hace (Aforar pide cliente y facturas; Otro, el texto)
    const oficina = tp.oficina ? [...document.querySelectorAll('#lgOfChips input:checked')].map(i => i.value) : [];
    if (tp.oficina && !oficina.length) return toast('Marca qué se hace en la oficina: Aforar, Alistamiento, Etiquetas u Otro');
    const facturasAforo = oficina.includes('aforar') ? [...document.querySelectorAll('.lg-of-fila')].map(f => ({ serie: f.querySelector('.lg-of-serie').value, numero: seisCifras(f.querySelector('.lg-of-fac').value) })).filter(f => f.numero) : [];
    if (oficina.includes('aforar') && !$('lgCliente').value.trim()) return toast('Aforar: escoge el cliente');
    if (oficina.includes('aforar') && !facturasAforo.length) return toast('Aforar: escribe el número de la factura');
    if (new Set(facturasAforo.map(textoFacAforo)).size !== facturasAforo.length) return toast('Hay una factura repetida en Aforar: revisa los números');
    const otroOficina = oficina.includes('otro') ? $('lgOfOtroTxt').value.trim() : '';
    if (oficina.includes('otro') && !otroOficina) return toast('Otro: escribe qué se hace en la oficina');
    // El cliente de la Maestra se guarda con su nombre exacto; uno que no esté en la Maestra, con nombre propio
    const escrito = tp.oficina && !oficina.includes('aforar') ? '' : $('lgCliente').value.trim(), zonaC = escrito ? zonaDeContacto(escrito) : '';
    const lead = !zonaC && escrito ? leadPorNombre(escrito) : null;
    const aProv = radAProv(), contacto = aProv ? '' : zonaC ? buscarMaestra(zonaC, escrito).n : lead ? lead.nombre : escrito ? nombrePropio(escrito) : '';
    const cl = datosClienteLog(contacto);
    const base = antes || { id: nuevoId(), clase: 'logistica', estado: 'pendiente', creado: new Date().toISOString(), creadoPor: sesion.id };
    // El mismo cliente (o proveedor) ya tiene parada ese día: se pregunta si de verdad se va dos veces
    if (!await confirmarDobleParada(contacto || $('lgProv')?.value, fecha, base.id)) return;
    const mismo = logRegs().filter(x => x.fecha === fecha && x.vendedor === vendedor && x.id !== base.id);
    const orden = antes && antes.fecha === fecha && antes.vendedor === vendedor ? antes.orden : Math.max(0, ...mismo.map(x => x.orden || 0)) + 1;
    const nuevo = {
        ...base, ...(tp.oficina ? { oficina, facturasAforo, otroOficina } : {}), tipo, tipos, incluye, incluyeDocs, fecha, hora: $('lgHora').value, vendedor, orden, documentos, radicacion,
        contacto, zona: cl.zona, comercial: cl.comercial, ciudad: cl.ciudad || '',
        proveedor: tp.recoleccion || aProv ? $('lgProv').value.trim() : '', contactoOtro: tp.vuelta && !!contacto && !zonaC && !lead, proveedorOtro: (tp.recoleccion || aProv) && !!$('lgProv').value.trim() && !proveedoresMaestra.filas[normalizar($('lgProv').value)], materiales: tp.recoleccion ? [...document.querySelectorAll('#lgMateriales input:checked')].map(i => i.value) : [],
        area: tp.vuelta ? $('lgArea').value : '', entidad: tp.banco ? $('lgBanco').value.trim() : '', direccion: tp.banco || tp.oficina ? '' : $('lgDir').value.trim(), telefono: tp.banco || tp.oficina ? '' : $('lgTel').value.trim(), detalle: $('lgDetalle').value.trim()
    };
    // Huella de la edición: quién la editó, cuándo y qué cambió (solo si algo cambió)
    if (antes) {
        const cambios = Object.entries(CAMPOS_HUELLA_LOG).filter(([k]) => JSON.stringify(antes[k] ?? '') !== JSON.stringify(nuevo[k] ?? '')).map(([, t]) => t);
        if (cambios.length) nuevo.ediciones = [...(antes.ediciones || []), { por: sesion.id, cuando: new Date().toISOString(), campos: cambios }];
    }
    guardarRegistro(nuevo);
    cerrarModal();
    toast(antes ? 'Parada actualizada' : `Parada programada para el ${fechaCorta(fecha)}`);
    logi.fecha = fecha;
    pintarLog();
}

async function eliminarLog(id) {
    const r = registros[id];
    if (!r || r.estado !== 'pendiente') return;
    if (!await dialogo({ titulo: '¿Eliminar esta parada?', texto: `${tituloLog(r)} sale de la ruta del ${fechaCorta(r.fecha)}.`, aceptar: 'Eliminar', tono: 'aviso', icono: '🗑' })) return;
    borrarRegistro(r);
    pintarLog();
}

function moverLog(id, d) {
    const r = registros[id];
    const grupo = logRegs().filter(x => x.fecha === r.fecha && x.vendedor === r.vendedor && !x.hora).sort(ordenLog);
    const i = grupo.findIndex(x => x.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= grupo.length) return;
    [grupo[i], grupo[j]] = [grupo[j], grupo[i]];
    grupo.forEach((x, k) => { if (x.orden !== k + 1) guardarRegistro({ ...registros[x.id], orden: k + 1 }); });
    pintarLog();
}

// ---------- REPORTAR UNA PARADA ----------
function abrirLogReporte(id, ok) {
    const r = registros[id];
    if (!r || r.estado !== 'pendiente' || !puedeOperarLog()) return;
    const tp = TIPOS_LOG[r.tipo], tieneEnvio = r.tipo === 'envio';
    const req = !!tp.cliente;   // entregas y radicaciones piden quién recibió (en el envío no: van transportadora y guía)
    const ciudadCli = ciudadCliente(r.contacto), ant = antesCliente(r.contacto);
    const detalle = r.tipo === 'recoleccion' ? 'Qué se recogió' : r.tipo === 'vuelta' || r.tipo === 'banco' || r.tipo === 'oficina' ? 'Resultado' : r.tipo === 'entrega' && (r.incluye || []).some(k => k === 'devolucion' || k === 'pqr') ? `Qué se recogió (${incluyeTxt({ incluye: r.incluye.filter(k => k === 'devolucion' || k === 'pqr') })})` : '';
    fotosLogSel = [];
    abrirModal(`<form class="form-rc" onsubmit="guardarLogReporte(event, '${id}', ${ok})">
        <h2>${ok ? esc(okTxt(r)) : esc(noTxt(r))}</h2>
        <p class="sub">${esc(tituloLog(r))}${(r.documentos || []).length ? ' · ' + esc(r.documentos.map(textoDoc).join(' · ')) : ''}${(r.incluyeDocs || []).length ? ' · ' + esc(r.incluyeDocs.map(textoInc).join(' · ')) : ''}${(r.radicacion || []).length ? ' · ' + esc(r.radicacion.map(textoRad).join(' · ')) : ''}</p>
        ${!ok && fallosParada(r) >= 1 ? `<p class="lg-aviso-reincide">⚠ ${intentoLog(r) > 1 ? 'Este es el ' + intentoLog(r) + '.º intento. ' : ''}Con este reporte serán <b>${fallosParada(r) + 1} paradas no efectivas</b> con este cliente en 30 días: <b>reporta la novedad</b>.</p>` : ''}
        ${ok ? `
            ${tp.cliente ? `<div class="lg-dir-entrega">📍 <b>Dirección de entrega</b><br>${esc(ciudadCli || '')}${ciudadCli && r.direccion ? ' · ' : ''}${r.direccion ? enlaceDir(r.direccion, ciudadCli) : ciudadCli ? '' : 'Sin dirección registrada'}${r.telefono ? `<br>📞 ${enlacesTel(r.telefono)}` : ''}</div>
            <label class="lg-chip lg-cambiar"><input type="checkbox" id="lgCambiarDir" onchange="cambiarDirLog()"><span>Cambiar la dirección de entrega</span></label>
            <div id="lgDestOtro" hidden>
                <label for="lgDestino">Ciudad ${REQ}</label>
                ${campoCiudad('lgDestino', ciudadCli, false)}
                <label for="lgDirDest">Dirección ${REQ}</label>
                <input id="lgDirDest" autocomplete="off" maxlength="120">
                <label for="lgTelDest">Teléfono de quien recibe <small>(opcional)</small></label>
                <input id="lgTelDest" type="tel" autocomplete="off" maxlength="40">
            </div>` : ''}
            ${tieneEnvio ? '' : `<label for="lgRecibio">${esc(tp.quien)} ${req ? REQ : '<small>(opcional)</small>'}</label>
            <input id="lgRecibio" list="dlRecibio" autocomplete="off" maxlength="80" ${req ? 'required' : ''} placeholder="${ant.recibio.length ? 'Escribe o escoge de quienes han recibido antes' : ''}" onblur="this.value = nombrePropio(this.value)">
            <datalist id="dlRecibio">${ant.recibio.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
            ${ant.recibio.length ? `<div class="lg-chips lg-recibio">${ant.recibio.slice(0, 4).map(x => `<button type="button" class="lg-chip-btn" data-v="${esc(x)}" onclick="$('lgRecibio').value = this.dataset.v">${esc(x)}</button>`).join('')}</div>` : ''}`}
            ${tieneEnvio ? `
            <div class="fila-fecha iguales">
                <div><label for="lgTransp">Transportadora ${REQ}</label><input id="lgTransp" list="dlTransp" autocomplete="off" maxlength="60" required value="${esc(r.transportadora || '')}">
                <datalist id="dlTransp">${transportadoras().map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
                <div><label for="lgGuia">Número de guía ${REQ}</label><input id="lgGuia" autocomplete="off" maxlength="40" required></div>
            </div>` : ''}
            ${(items => items.length && r.tipo !== 'vuelta' && r.tipo !== 'banco' ? `<label>Lo programado <small>(marca lo que sí ${VERBO_LOG[r.tipo] || 'hiciste'}; desmarca lo que no)</small></label>
            <div class="lg-chips" id="lgProg">${items.map(t => `<label class="lg-chip"><input type="checkbox" checked data-t="${esc(t)}"><span>${esc(t)}</span></label>`).join('')}</div>` : '')(itemsProgramados(r))}
            ${detalle ? `<label for="lgRDetalle">${esc(detalle)} <small>(opcional)</small></label><textarea id="lgRDetalle" rows="2" maxlength="200"></textarea>` : ''}
            <label for="lgNovedad">Novedades <small>(opcional)</small></label>
            <textarea id="lgNovedad" rows="2" maxlength="200" placeholder="Ej: faltó una unidad, el cliente pidió cambiar la factura…"></textarea>
        ` : `
            <label for="lgMotivo">Motivo ${REQ}</label>
            <select id="lgMotivo" required><option value="">Elige el motivo</option>${MOTIVOS_LOG.map(m => `<option>${esc(m)}</option>`).join('')}</select>
            <label for="lgNovedad">Cuéntalo con más detalle ${REQ}</label>
            <textarea id="lgNovedad" rows="3" maxlength="200" required placeholder="Qué pasó y qué se acordó con el cliente"></textarea>
            <label>¿Qué se hace? <small>(opcional)</small></label>
            <div class="lg-chips" id="lgAccion">
                <label class="lg-chip"><input type="radio" name="lgAccion" value="reprogramar" onclick="accionNoEntrega(this)"><span>📅 Reprogramar</span></label>
                <label class="lg-chip"><input type="radio" name="lgAccion" value="oficina" onclick="accionNoEntrega(this)"><span>🏢 Devolver a la oficina</span></label>
            </div>
            <div class="fila-fecha compacta" id="lgRepro" hidden>
                <div><label for="lgReproFecha">Reprogramar para ${REQ}</label><input id="lgReproFecha" type="date" min="${hoy()}"></div>
                <div><label for="lgReproHora">Hora <small>(opcional)</small></label><input id="lgReproHora" type="time"></div>
            </div>
        `}
        <label for="lgFotos">Foto <small>${ok ? (conRadicacion(r) ? '(obligatoria: foto del sello de radicado)' : '(obligatoria: foto de la entrega o del recibido)') : '(obligatoria: foto del lugar o de la novedad)'}</small></label>
        <div class="lg-foto-btns">
            <label class="btn-secundario lg-foto-btn">📷 Tomar foto<input type="file" accept="image/*" capture="environment" hidden onchange="agregarFotosLog(this)"></label>
        </div>
        <p class="ayuda" id="lgFotosTxt"></p>
        <p class="ayuda">Se guarda con la hora de ahora: ${esc(fechaHora(new Date().toISOString()))}</p>
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario" id="lgBtnRep">Guardar</button>
        </div>
    </form>`, ok ? '' : 'theme-rojo');
}
// No entregado: reprogramar (pide fecha y hora) o devolver a la oficina; tocar la opción marcada la quita
function accionNoEntrega(el) {
    if (el.dataset.on === '1') el.checked = false;
    document.querySelectorAll('#lgAccion input').forEach(i => { i.dataset.on = i.checked ? '1' : ''; });
    const repro = el.checked && el.value === 'reprogramar';
    $('lgRepro').hidden = !repro; $('lgReproFecha').required = repro;
}
// Qué se hizo con lo no entregado (para la tarjeta, el historial y el Excel)
const textoAccionLog = rp => rp?.accion === 'oficina' ? 'Se devuelve a la oficina'
    : rp?.reprogramadaPara ? `Reprogramada para el ${fechaCorta(rp.reprogramadaPara)}${rp.horaRepro ? ' a las ' + horaBonita(rp.horaRepro) : ''}` : '';
// Paradas del mismo cliente (o proveedor) en un día; si ya hay, se confirma antes de programar otra
const nombreParada = r => r.contacto || r.proveedor || '';
// Reglas de la fecha al programar (nueva, editada o reprogramada): no a días pasados, no hoy después de las 6 p. m.,
// no a un día ya cerrado del mensajero, y aviso con confirmación en domingos y festivos
const HORA_CORTE_LOG = 18;
const horaBogotaLog = () => +new Date().toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' });
function errorFechaLog(fecha, vendedor, idIgnorar = '', sinCambio = false) {
    if (sinCambio) return '';
    if (fecha < hoy()) return 'Ese día ya pasó: programa desde hoy';
    if (fecha === hoy() && horaBogotaLog() >= HORA_CORTE_LOG) return 'Después de las 6:00 p. m. ya no se programa para hoy: elige el siguiente día';
    const dia = logRegs().filter(x => x.fecha === fecha && x.vendedor === vendedor && x.id !== idIgnorar);
    if (dia.length && dia.every(x => x.estado !== 'pendiente')) return `El ${fechaLarga(fecha)} ya está cerrado para ${primerNombre(vendedor)}: todas sus paradas están reportadas. Elige otro día`;
    return '';
}
async function confirmarDiaLog(fecha, vendedor = '') {
    const festivo = nombreFestivo(fecha), domingo = !festivo && deIso(fecha).getDay() === 0;
    const nov = vendedor ? novLogDe(fecha, vendedor)[0] : null;
    if (nov && !festivo && !domingo) return dialogo({ tono: 'aviso', icono: ICONO_NOV[nov.novedad] || '📅', titulo: nov.novedad, aceptar: 'Sí, continuar', cancelar: 'No',
        texto: `${nombreVendedor(vendedor)} tiene ${nov.novedad.toLowerCase()} ese día (${rangoNovLog(nov)}).\n¿Deseas continuar con la programación?` });
    if (!festivo && !domingo) return true;
    return dialogo({ tono: festivo ? 'aviso' : 'playa', icono: festivo ? '📅' : '🛋️', titulo: festivo ? 'Día festivo' : 'Domingo · día de descanso', aceptar: 'Sí, continuar', cancelar: 'No',
        texto: (festivo ? `El ${fechaLarga(fecha)} es festivo: ${festivo}.` : `El ${fechaLarga(fecha)} es día de descanso.`) + '\n¿Deseas continuar con la programación?' });
}
// Segundo intento y reincidencia: la parada reprogramada lleva su número de intento; el cliente o proveedor con 2 o más paradas no efectivas en 30 días queda alertado
const intentoLog = r => r.intento || 1;
function fallosParada(r) {
    const n = normalizar(nombreParada(r)); if (!n) return 0;
    const desde = sumarDias(hoy(), -30);
    return logRegs().filter(x => x.estado === 'no_entregado' && x.fecha >= desde && normalizar(nombreParada(x)) === n).length;
}
const chipsIntentoLog = r => { const n = fallosParada(r);
    return `${intentoLog(r) > 1 ? `<span class="lg-intento">${intentoLog(r)}.º intento</span>` : ''}${n >= 2 ? `<span class="lg-reincide" title="Paradas no efectivas con este cliente o proveedor en los últimos 30 días">⚠ Reincidencia · ${n} no efectivas</span>` : ''}`; };
const paradasMismoDia = (nombre, fecha, idExcluir) => nombre ? logRegs().filter(x => x.fecha === fecha && x.id !== idExcluir && normalizar(nombreParada(x)) === normalizar(nombre)) : [];
async function confirmarDobleParada(nombre, fecha, idExcluir) {
    const ya = paradasMismoDia(String(nombre || '').trim(), fecha, idExcluir);
    if (!ya.length) return true;
    return dialogo({ titulo: 'Ya está programado ese día', icono: '⚠️', tono: 'aviso', aceptar: 'Sí, programar otra', cancelar: 'No, cancelar',
        texto: `${nombre} ya tiene ${ya.length === 1 ? 'una parada' : ya.length + ' paradas'} el ${fechaCorta(fecha)}:\n`
            + ya.map(x => `• ${nombreTipos(x)} · ${nombreVendedor(x.vendedor)} · ${x.estado === 'pendiente' ? 'pendiente' : (x.estado === 'entregado' ? okTxt(x) : noTxt(x)).toLowerCase()}`).join('\n')
            + '\n\n¿Vas a visitar dos veces al contacto?' });
}
// Varias facturas de la misma línea: "+ Otra factura" agrega un bloque nuevo (copia el anterior sin números)
function refrescarSetsLog(pc) { if (!pc) return; const sets = pc.querySelectorAll('.lg-pset'); sets.forEach(s => { const q = s.querySelector('.lg-quitar'); if (q) q.hidden = sets.length < 2; }); }
function masSetLog(btn) {
    const pc = btn.parentElement, sets = pc.querySelectorAll('.lg-pset'), ultimo = sets[sets.length - 1], nuevo = ultimo.cloneNode(true);
    nuevo.querySelectorAll('input').forEach(i => { i.value = ''; i.required = false; });
    const sel = ultimo.querySelector('select'); if (sel) nuevo.querySelector('select').value = sel.value;
    pc.insertBefore(nuevo, btn); refrescarSetsLog(pc); nuevo.querySelector('input').focus();
}
function quitarSetLog(btn) { const pc = btn.closest('.lg-pgrupo'); btn.closest('.lg-pset').remove(); refrescarSetsLog(pc); }
// La dirección de entrega es la de la parada; solo si se marca "Cambiar" se piden ciudad, dirección y teléfono
function cambiarDirLog() {
    const on = $('lgCambiarDir').checked;
    $('lgDestOtro').hidden = !on; $('lgDestino').required = on; $('lgDirDest').required = on;
    if (on) $('lgDirDest').focus();
}
// Ciudad del cliente en el formato de la lista de municipios ("Pereira - Risaralda"), con la Maestra y el directorio
function ciudadCliente(nombre) {
    if (!nombre) return '';
    const zona = zonaDeContacto(nombre), m = zona ? buscarMaestra(zona, nombre) : null, c = m?.c || dirDe(nombre)?.c || '';
    const nc = normalizar(c).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!nc) return '';
    if (nc.startsWith('bogota')) return 'Bogotá D.C.';
    const dep = normalizar(m?.p || '').replace(/\(co\)/, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    const cand = CIUDADES.filter(x => normalizar(x).split(' - ')[0] === nc);
    return cand.find(x => dep && normalizar(x).endsWith(' - ' + dep)) || (cand.length === 1 ? cand[0] : '') || c;
}
// Lo que ya se sabe del cliente por reportes anteriores: quiénes recibieron (los más recientes primero)
function antesCliente(nombre) {
    const regs = nombre ? logRegs().filter(x => x.contacto && normalizar(x.contacto) === normalizar(nombre) && x.reporte?.recibio)
        .sort((a, b) => (b.registrada || '').localeCompare(a.registrada || '')) : [];
    return { recibio: [...new Set(regs.map(x => x.reporte.recibio))] };
}
const transportadoras = () => [...new Set(logRegs().map(x => x.transportadora).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

// Fotos elegidas para el reporte (de la cámara y de la galería, hasta 4)
let fotosLogSel = [];
function agregarFotosLog(input) {
    fotosLogSel = [...fotosLogSel, ...input.files].slice(0, 4);
    input.value = '';
    const n = fotosLogSel.length;
    $('lgFotosTxt').innerHTML = n ? `${n} ${n === 1 ? 'foto lista' : 'fotos listas'}${n === 4 ? ' (máximo 4)' : ''} · <a href="#" onclick="fotosLogSel = []; $('lgFotosTxt').textContent = ''; return false">Quitar</a>` : '';
}
async function guardarLogReporte(e, id, ok) {
    e.preventDefault();
    const r = registros[id], btn = $('lgBtnRep');
    if (!r || r.estado !== 'pendiente') return;
    if (!fotosLogSel.length && !(r.fotos || []).length) return toast('Falta la foto: toma una con la cámara para guardar el reporte');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
        const archivos = fotosLogSel.slice(0, 4);
        const fotos = [];
        for (const f of archivos) fotos.push(await comprimirFoto(f, API_URL ? 1280 : 480, API_URL ? 0.72 : 0.6));
        const val = k => $(k)?.value.trim() || '';
        const cambio = ok && !!$('lgCambiarDir')?.checked;
        if (cambio && !validarCiudad($('lgDestino'))) { btn.disabled = false; btn.textContent = 'Guardar'; return toast('Escoge la ciudad de destino de la lista'); }
        const accion = ok ? '' : document.querySelector('#lgAccion input:checked')?.value || '';
        if (accion === 'reprogramar' && !val('lgReproFecha')) { btn.disabled = false; btn.textContent = 'Guardar'; return toast('Escoge la fecha para reprogramar'); }
        // Lo programado que se marcó y lo que quedó sin hacer
        const prog = [...document.querySelectorAll('#lgProg input')].map(i => ({ t: i.dataset.t, ok: i.checked }));
        const faltantes = prog.filter(x => !x.ok).map(x => x.t);
        const reporte = ok ? { recibio: nombrePropio(val('lgRecibio')), guia: val('lgGuia'), detalle: val('lgRDetalle'), novedad: val('lgNovedad'), ...(prog.length ? { programado: prog, faltantes } : {}) }
            : { motivo: val('lgMotivo'), novedad: val('lgNovedad'), accion,
                ...(accion === 'reprogramar' ? { reprogramadaPara: val('lgReproFecha'), horaRepro: val('lgReproHora') } : {}) };
        // Dirección cambiada al entregar y, en el envío, destino (la ciudad del cliente si no se cambió), transportadora y guía
        const envio = { ...(cambio ? { destino: val('lgDestino'), dirDestino: val('lgDirDest'), telDestino: val('lgTelDest') } : {}),
            ...(ok && r.tipo === 'envio' ? { transportadora: val('lgTransp'), ...(cambio ? {} : { destino: ciudadCliente(r.contacto), dirDestino: '', telDestino: '' }) } : {}) };
        // Si se reprograma para un día en que el cliente ya tiene parada, primero se confirma (el reporte aún no se guardó)
        if (reporte.reprogramadaPara) {
            const err = errorFechaLog(reporte.reprogramadaPara, r.vendedor, r.id);
            if (err) { btn.disabled = false; btn.textContent = 'Guardar'; return toast(err); }
            if (!await confirmarDiaLog(reporte.reprogramadaPara, r.vendedor)) { btn.disabled = false; btn.textContent = 'Guardar'; return; }
        }
        if (reporte.reprogramadaPara && !await confirmarDobleParada(nombreParada(r), reporte.reprogramadaPara, r.id)) { btn.disabled = false; btn.textContent = 'Guardar'; return; }
        // Sin servidor (pruebas) la foto chica queda en el registro; con servidor se sube a Drive en segundo plano
        guardarRegistro({ ...r, ...envio, estado: ok ? 'entregado' : 'no_entregado', reporte, registrada: new Date().toISOString(), reportadoPor: sesion.id,
            fotos: [...(r.fotos || []), ...(API_URL ? [] : fotos.map(d => ({ data: d })))] });
        if (API_URL && fotos.length) { const p = leerFotosPend(); p[id] = [...(p[id] || []), ...fotos]; guardarFotosPend(p); subirFotosPend(); }
        // Reprogramada: queda una parada nueva, pendiente, con lo mismo (cliente, tipo, facturas, indicaciones) en la nueva fecha
        if (reporte.reprogramadaPara) {
            const f = reporte.reprogramadaPara, mismo = logRegs().filter(x => x.fecha === f && x.vendedor === r.vendedor);
            const { reporte: _r, fotos: _f, correcciones: _c, registrada: _g, reportadoPor: _p, ...datos } = r;
            guardarRegistro({ ...datos, id: nuevoId(), estado: 'pendiente', fecha: f, hora: reporte.horaRepro || '', orden: Math.max(0, ...mismo.map(x => x.orden || 0)) + 1,
                vieneDe: r.vieneDe || r.fecha, origen: 'reprogramada', intento: intentoLog(r) + 1, creado: new Date().toISOString(), creadoPor: sesion.id });
        }
        cerrarModal();
        toast(ok ? `${okTxt(r)}: queda registrado` : reporte.reprogramadaPara ? `Reprogramada para el ${fechaCorta(reporte.reprogramadaPara)}` : accion === 'oficina' ? 'Novedad registrada: se devuelve a la oficina' : 'Novedad registrada');
        pintarLog();
    } catch (err) {
        btn.disabled = false; btn.textContent = 'Guardar';
        toast('No se pudo guardar: ' + err.message);
    }
}

async function reabrirLog(id) {
    const r = registros[id];
    if (!r || r.estado === 'pendiente' || !puedeCorregirLog()) return;
    if (!await dialogo({ titulo: '¿Corregir este reporte?', texto: 'La parada vuelve a pendiente para reportarla de nuevo. El reporte anterior queda guardado en su historial.', aceptar: 'Reabrir' })) return;
    guardarRegistro({ ...r, estado: 'pendiente', reporte: null, registrada: '',
        correcciones: [...(r.correcciones || []), { estado: r.estado, reporte: r.reporte, registrada: r.registrada, reportadoPor: r.reportadoPor, fotos: r.fotos || [], reabierta: new Date().toISOString(), por: sesion.id }], fotos: [] });
    pintarLog();
}

// ---------- FOTOS ----------
// Se reducen en el teléfono (máx. 1280 px) y se suben a Drive en segundo plano: si no hay señal, quedan pendientes y se reintentan
function comprimirFoto(archivo, max = 1280, calidad = 0.72) {
    return new Promise((ok, mal) => {
        const url = URL.createObjectURL(archivo), img = new Image();
        img.onload = () => {
            const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
            c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            ok(c.toDataURL('image/jpeg', calidad));
        };
        img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('no se pudo leer la foto')); };
        img.src = url;
    });
}
const FOTOS_PEND = 'rc_fotos_log';
const leerFotosPend = () => { try { return JSON.parse(localStorage.getItem(FOTOS_PEND) || '{}'); } catch (e) { return {}; } };
const guardarFotosPend = p => { try { localStorage.setItem(FOTOS_PEND, JSON.stringify(p)); } catch (e) { toast('El teléfono no tiene espacio para guardar la foto: sube las pendientes con señal'); } };
let subiendoFotos = false;
async function subirFotosPend() {
    if (!API_URL || !sesion || subiendoFotos) return;
    const p = leerFotosPend();
    if (!Object.keys(p).length) return;
    subiendoFotos = true;
    try {
        for (const id of Object.keys(p)) {
            const r = registros[id];
            if (!r) { delete p[id]; continue; }
            const subidas = [];
            for (const d of p[id]) {
                try {
                    const res = await llamarApi({ accion: 'subirArchivo', carpeta: 'Entregas de logística', nombre: `${r.tipo}-${r.id}.jpg`, tipo: 'image/jpeg', datos: d.split(',')[1] }, 90000);
                    subidas.push({ url: res.url, id: res.id || idDrive(res.url) });
                } catch (e) { break; }
            }
            p[id] = p[id].slice(subidas.length);
            if (!p[id].length) delete p[id];
            if (subidas.length) guardarRegistro({ ...registros[id], fotos: [...(registros[id].fotos || []), ...subidas] });
        }
    } finally {
        guardarFotosPend(p);
        subiendoFotos = false;
        if (pantallaActiva() === 'logScreen') pintarLog();
    }
}

// ---------- DIRECTORIO: dirección y teléfono de los clientes ----------
// Son datos personales: no van en contactos.json (el repositorio es público). El administrador sube la Maestra de Odoo
// (con Calle, Teléfono y Móvil) y quedan en la hoja "Directorio" del servidor. Logística, los jefes y el administrador
// traen todos; cada comercial, solo los de su zona (lo filtra el servidor). Se refrescan cada 6 horas y se borran
// del teléfono al cerrar sesión.
const DIR_LOCAL = 'rc_directorio';
const veDirectorio = () => !!sesion;
let directorio = (() => { try { return JSON.parse(localStorage.getItem(DIR_LOCAL)) || { filas: {} }; } catch (e) { return { filas: {} }; } })();
function ponerDirectorio(filas, actualizado) {
    const m = {};
    filas.forEach(([n, c, dir, tel, z]) => { if (n) m[normalizar(n)] = { n, c, dir, tel, z }; });
    directorio = { filas: m, actualizado: actualizado || '', traido: Date.now() };
    try { localStorage.setItem(DIR_LOCAL, JSON.stringify(directorio)); } catch (e) { /* sin espacio: queda en memoria */ }
}
// Cada comercial solo ve los de su zona (el servidor ya filtra; esto cubre el módulo de pruebas)
const dirDe = nombre => {
    const d = nombre ? directorio.filas[normalizar(nombre)] : null;
    return d && (esLogistica() || esJefe() || esAdmin() || !d.z || d.z === comercial(sesion?.id)?.zona) ? d : null;
};
function borrarDirectorio() {
    if (!API_URL) return;   // módulo de pruebas: el directorio viene con la página
    directorio = { filas: {} }; try { localStorage.removeItem(DIR_LOCAL); } catch (e) { /* nada */ } }
let trayendoDir = false;
async function cargarDirectorio(forzar = false) {
    if (!API_URL || !veDirectorio() || trayendoDir) return;
    if (!forzar && directorio.traido && Date.now() - directorio.traido < 6 * 3600e3) return;
    trayendoDir = true;
    try { const r = await llamarApi({ accion: 'directorio' }); ponerDirectorio(r.filas || [], r.actualizado); }
    catch (e) { console.warn('No se pudo traer el directorio:', e); }
    finally { trayendoDir = false; }
}
// El administrador sube la Maestra de Contactos de Odoo tal como sale (Nombre Público, Ciudad, Calle, Teléfono, Móvil)
function subirDirectorio() {
    if (!esAdmin()) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx';
    inp.onchange = async () => {
        const archivo = inp.files[0];
        if (!archivo) return;
        try {
            await cargarExcelJS();
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(await archivo.arrayBuffer());
            const ws = wb.worksheets[0], cab = {};
            ws.getRow(1).eachCell((c, i) => { cab[String(c.text).trim()] = i; });
            if (!cab['Nombre Público'] || !cab['Calle']) return toast('No encontré las columnas "Nombre Público" y "Calle": sube la Maestra de Contactos de Odoo con direcciones y teléfonos.');
            const val = (fila, n) => cab[n] ? String(fila.getCell(cab[n]).text || '').trim() : '';
            const filas = [], vistos = new Set();
            ws.eachRow((fila, i) => {
                const n = val(fila, 'Nombre Público');
                if (i === 1 || !n || /emplead/i.test(val(fila, 'Equipo de ventas')) || vistos.has(normalizar(n))) return;
                vistos.add(normalizar(n));
                const tel = [...new Set([val(fila, 'Móvil'), val(fila, 'Teléfono')].filter(Boolean))].join(' / ');
                filas.push([n, val(fila, 'Ciudad'), val(fila, 'Calle'), tel, zonaDeContacto(n) || '']);
            });
            const conDir = filas.filter(f => f[2]).length, conTel = filas.filter(f => f[3]).length;
            if (!await dialogo({ titulo: 'Direcciones y teléfonos', aceptar: 'Subir',
                texto: `${filas.length} clientes: ${conDir} con dirección y ${conTel} con teléfono. Reemplaza el directorio anterior. Los ven Logística, los jefes y tú; cada comercial, solo los de su zona. No quedan en la app publicada.` })) return;
            let cuando = new Date().toISOString();
            if (API_URL) cuando = (await llamarApi({ accion: 'guardarDirectorio', filas }, 90000)).actualizado || cuando;
            ponerDirectorio(filas, cuando);
            toast(`Directorio actualizado: ${filas.length} clientes`);
        } catch (e) {
            toast('No se pudo subir el directorio: ' + e.message);
        }
    };
    inp.click();
}

// ---------- MAESTRA DE PROVEEDORES: solo para Logística ----------
// Nombre, ciudad, provincia y etiquetas de cada proveedor (hoja "Proveedores" del servidor, no el repositorio público).
// La ven Logística y el administrador; solo el administrador la sube. Alimenta la lista "Busca proveedor" del formulario.
const PROV_LOCAL = 'rc_proveedores';
const veProveedores = () => !!sesion && (esLogistica() || esAdmin());
let proveedoresMaestra = (() => { try { return JSON.parse(localStorage.getItem(PROV_LOCAL)) || { filas: {} }; } catch (e) { return { filas: {} }; } })();
function ponerProveedores(filas, actualizado) {
    const m = {};
    filas.forEach(([n, c, p, e, dir, tel]) => { if (n) m[normalizar(n)] = { n, c, p, e, dir: dir || '', tel: tel || '' }; });
    proveedoresMaestra = { filas: m, actualizado: actualizado || '', traido: Date.now() };
    try { localStorage.setItem(PROV_LOCAL, JSON.stringify(proveedoresMaestra)); } catch (e) { /* sin espacio: queda en memoria */ }
}
function borrarProveedores() {
    if (!API_URL) return;   // módulo de pruebas: la maestra viene con la página
    proveedoresMaestra = { filas: {} }; try { localStorage.removeItem(PROV_LOCAL); } catch (e) { /* nada */ } }
let trayendoProv = false;
async function cargarProveedores(forzar = false) {
    if (!API_URL || !veProveedores() || trayendoProv) return;
    if (!forzar && proveedoresMaestra.traido && Date.now() - proveedoresMaestra.traido < 6 * 3600e3) return;
    trayendoProv = true;
    try { const r = await llamarApi({ accion: 'proveedores' }); ponerProveedores(r.filas || [], r.actualizado); }
    catch (e) { console.warn('No se pudo traer la maestra de proveedores:', e); }
    finally { trayendoProv = false; }
}
// El administrador sube la Maestra de proveedores (Nombre, Nombre Público, Provincia, Ciudad, Comercial, Etiquetas; con Calle, Teléfono y Móvil si los tiene)
function subirProveedores() {
    if (!esAdmin()) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx';
    inp.onchange = async () => {
        const archivo = inp.files[0];
        if (!archivo) return;
        try {
            await cargarExcelJS();
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(await archivo.arrayBuffer());
            const ws = wb.worksheets[0], cab = {};
            ws.getRow(1).eachCell((c, i) => { cab[String(c.text).trim()] = i; });
            const colN = cab['Nombre Público'] ? 'Nombre Público' : 'Nombre';
            if (!cab[colN] || !cab['Ciudad']) return toast('No encontré las columnas "Nombre" y "Ciudad": sube la Maestra de proveedores.');
            const val = (fila, n) => cab[n] ? String(fila.getCell(cab[n]).text || '').trim() : '';
            const filas = [], vistos = new Set(), nits = {};
            ws.eachRow((fila, i) => {
                const n = val(fila, colN);
                if (i === 1 || !n || vistos.has(normalizar(n))) return;
                vistos.add(normalizar(n));
                nits[normalizar(n)] = val(fila, 'Número de Identificación');
                filas.push([n, val(fila, 'Ciudad'), val(fila, 'Provincia').replace(/\s*\(CO\)$/, ''), val(fila, 'Etiquetas'),
                    val(fila, 'Calle'), [...new Set([val(fila, 'Móvil'), val(fila, 'Teléfono')].filter(Boolean))].join(' / ')]);
            });
            // Odoo trae un proveedor dos veces: "Empresa" y "Empresa, Persona" (mismo NIT). Se deja el que tiene el nombre y la razón social
            const dobles = new Set(filas.filter(f => f[0].includes(', ')).map(f => normalizar(f[0].split(', ')[0]))
                .filter(base => vistos.has(base) && filas.some(f => normalizar(f[0]).startsWith(base + ', ') && (!nits[base] || nits[normalizar(f[0])] === nits[base]))));
            // Del que se quita se rescata la dirección si es más completa (y el teléfono si al otro le falta)
            filas.filter(f => f[0].includes(', ')).forEach(f => {
                const o = filas.find(x => dobles.has(normalizar(x[0])) && normalizar(f[0]).startsWith(normalizar(x[0]) + ', '));
                if (!o) return;
                if (o[4].length > f[4].length) f[4] = o[4];
                if (!f[5]) f[5] = o[5];
            });
            const sinDobles = filas.filter(f => !dobles.has(normalizar(f[0])));
            filas.length = 0; filas.push(...sinDobles);
            if (!filas.length) return toast('La maestra de proveedores está vacía');
            if (!await dialogo({ titulo: 'Maestra de proveedores', aceptar: 'Subir',
                texto: `${filas.length} proveedores: ${filas.filter(f => f[4]).length} con dirección y ${filas.filter(f => f[5]).length} con teléfono. Reemplaza la maestra anterior. Solo la ven Logística y tú; no queda en la app publicada.` })) return;
            let cuando = new Date().toISOString();
            if (API_URL) cuando = (await llamarApi({ accion: 'guardarProveedores', filas }, 90000)).actualizado || cuando;
            ponerProveedores(filas, cuando);
            toast(`Maestra de proveedores actualizada: ${filas.length}`);
        } catch (e) {
            toast('No se pudo subir la maestra de proveedores: ' + e.message);
        }
    };
    inp.click();
}

// Ficha del proveedor (desde el Maestro): datos básicos, dirección y teléfono si la maestra los trae, y sus paradas de Logística
function verProveedor(nombre) {
    const p = proveedoresMaestra.filas[normalizar(nombre)];
    if (!p) return;
    const paradas = logVisibles().filter(r => r.proveedor && normalizar(r.proveedor) === normalizar(nombre)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const tels = enlacesTel(p.tel);
    abrirModal(`<div class="form-rc ficha historial">
        <h2>${esc(p.n)}</h2>
        <p class="sub">${esc([p.e, [p.c, p.p && !normalizar(p.p).startsWith(normalizar(p.c)) ? p.p : ''].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}</p>
        ${p.dir || tels ? `<p class="dir-cliente">${p.dir ? `📍 ${enlaceDir(p.dir, p.c)}` : ''}${p.dir && tels ? '<br>' : ''}${tels ? `📞 ${tels}` : ''}</p>` : ''}
        <p class="clasif-cliente">Clasificación <b>Proveedor</b>${p.e ? ' · ' + esc(p.e) : ''}</p>
        <p class="grupo-titulo hist-sec l">🚚 Paradas · ${paradas.length}</p>
        ${paradas.map(r => `<div class="hist-item ${r.estado === 'entregado' ? 'ok' : r.estado === 'no_entregado' ? 'no' : 'p'}">
            <div class="hist-cab"><b>${esc(mayuscula(fechaLarga(r.fecha)))}</b>${chipEstadoLog(r)}</div>
            <p class="meta"><span class="hist-tag l">${esc(TIPOS_LOG[r.tipo]?.corto || '')}</span>${esc([nombreVendedor(r.vendedor), (r.materiales || []).join(', ')].filter(Boolean).join(' · '))}</p>
        </div>`).join('') || '<div class="no-results">Todavía no hay paradas con este proveedor.</div>'}
        <div class="form-botones"><button type="button" class="btn-primario" onclick="cerrarModal()">Cerrar</button></div>
    </div>`);
}

// Dirección y teléfono en la tarjeta del cliente (Maestra)
function htmlDirectorioCliente(nombre) {
    const d = dirDe(nombre);
    if (!d || !(d.dir || d.tel)) return '';
    const tels = enlacesTel(d.tel);
    return `<p class="dir-cliente">${d.dir ? `📍 ${enlaceDir(d.dir, d.c)}` : ''}${d.dir && tels ? '<br>' : ''}${tels ? `📞 ${tels}` : ''}</p>`;
}

// ---------- HISTORIAL DEL CLIENTE (Maestra) ----------
const entregasCliente = nombre => logVisibles().filter(r => hayTipo(r, 'cliente') && r.contacto && normalizar(r.contacto) === normalizar(nombre))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || ordenLog(b, a));
function htmlEntregasCliente(nombre, dia = '') {
    const lista = entregasCliente(nombre).filter(r => !dia || r.fecha === dia);
    if (!lista.length) return esLogistica() && !dia ? '<div class="no-results">Todavía no hay entregas registradas para este cliente.</div>' : '';
    return `<p class="grupo-titulo hist-sec l">🚚 Entregas y recolecciones · ${lista.length}</p>` + lista.map(r => {
        const tp = TIPOS_LOG[r.tipo], rp = r.reporte || {}, cls = r.estado === 'entregado' ? 'ok' : r.estado === 'no_entregado' ? 'no' : 'p';
        const docs = [...(r.documentos || []).map(textoDoc), ...(r.incluyeDocs || []).map(textoInc), ...(r.radicacion || []).map(textoRad), ...(r.tipo === 'oficina' ? itemsOficina(r) : [])].filter(Boolean).map(esc).join('<br>');
        const det = r.estado === 'entregado' ? [rp.recibio && `${tp.rec}: ${rp.recibio}`, rp.guia && `Guía ${rp.guia}`, rp.radicado && `Radicado ${rp.radicado}`, rp.faltantes?.length && `Sin hacer: ${rp.faltantes.join(' · ')}`, rp.novedad && `Novedad: ${rp.novedad}`] : r.estado === 'no_entregado' ? [rp.motivo, rp.novedad, textoAccionLog(rp)] : ['Pendiente de reportar'];
        const fotos = (r.fotos || []).map((f, i) => `<a class="lg-foto" href="${esc(urlFoto(f))}" target="_blank" rel="noopener"><img src="${esc(miniFoto(f))}" alt="Foto ${i + 1}" loading="lazy"></a>`).join('');
        return `<div class="hist-item ${cls}">
            <div class="hist-cab"><b>${esc(mayuscula(fechaLarga(r.fecha)))}${r.registrada ? ' · ' + esc(horaLog(r.registrada)) : r.hora ? ' · hora fija ' + esc(horaBonita(r.hora)) : ''}</b>${chipEstadoLog(r)}</div>
            <p class="meta"><span class="hist-tag l">${esc(TIPOS_LOG[r.tipo]?.corto || 'Entrega')}</span>${esc([nombreTipos(r), nombreVendedor(r.vendedor)].join(' · '))}</p>
            <div class="reporte">${[docs, ...det.filter(Boolean).map(esc)].filter(Boolean).join('<br>')}${fotos ? `<div class="lg-fotos">${fotos}</div>` : ''}</div>
        </div>`;
    }).join('');
}

// ---------- INFORME EN EXCEL ----------
// Una fila por factura/pedido de cada parada (así se busca una factura y se ve qué pasó con ella); hoja "Resumen" por mensajero y tipo.
function abrirLogInforme() {
    if (!(esCoordLog() || esAdmin() || esJefe())) return;
    abrirModal(`<form class="form-rc" onsubmit="descargarLogInforme(event)">
        <h2>Descargar informe de logística</h2>
        <p class="sub">Excel con cada parada: OV, OVI, quién recibió, hora, novedades y fotos.</p>
        <label for="lgiMes">Mes</label>
        <input id="lgiMes" type="month" required value="${mesDe(logi.fecha || hoy())}">
        ${esCoordLog() || esAdmin() ? `<label for="lgiMens">Mensajero</label><select id="lgiMens"><option value="">Todos</option>${MENSAJEROS.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select>` : ''}
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario" id="lgiBtn">Descargar Excel</button>
        </div>
    </form>`);
}

async function descargarLogInforme(e) {
    e.preventDefault();
    const btn = $('lgiBtn');
    btn.disabled = true; btn.textContent = 'Generando…';
    try {
        const mes = $('lgiMes').value, mens = $('lgiMens')?.value || '';
        await sincronizar(mes);
        await cargarExcelJS();
        const regs = logVisibles().filter(r => mesDe(r.fecha) === mes && (!mens || r.vendedor === mens)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.vendedor.localeCompare(b.vendedor) || ordenLog(a, b));
        const libro = armarLibroLog(regs, mes, mens);
        const buffer = await libro.xlsx.writeBuffer();
        bajarArchivo(buffer, `Logistica_${mens ? nombreVendedor(mens).replace(/\s+/g, '_') : 'Equipo'}_${mes}.xlsx`);
        cerrarModal();
        toast(regs.length ? 'Informe descargado' : 'Informe descargado (sin paradas ese mes)');
    } catch (err) {
        console.error(err);
        toast('No se pudo generar el Excel. Revisa tu conexión e intenta de nuevo.');
        btn.disabled = false; btn.textContent = 'Descargar Excel';
    }
}

function armarLibroLog(regs, mes, mens) {
    const libro = new ExcelJS.Workbook();
    const naranja = 'FFC2410C', claro = 'FFFFEDD5', gris = 'FF475569';
    // Excel no maneja zonas horarias: la fecha va a medianoche UTC y la hora, ya corrida a hora de Colombia (UTC-5, sin horario de verano)
    const diaXl = f => { const [y, m, d] = f.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
    const horaXl = iso => new Date(new Date(iso).getTime() - 5 * 3600e3);
    const filas = [];
    regs.forEach(r => {
        const tp = TIPOS_LOG[r.tipo], rp = r.reporte || {};
        // Una fila por clase de pedido y por documento radicado (la factura A va en OVI y la B en OV)
        const docs = [...(r.documentos || []).map(d => ({ doc: claseDoc(d.clase)?.t || '', ov: d.ov, ovi: d.ovi })),
            ...(r.radicacion || []).map(d => d.doc === 'factura' ? { doc: `Radicar factura ${d.serie}`, [d.serie === 'A' ? 'ovi' : 'ov']: d.numero }
                : d.doc === 'nc' ? { doc: 'Radicar nota crédito RNC', otro: d.numero } : { doc: 'Radicar otros', otro: d.texto }),
            ...(r.tipo === 'oficina' ? (r.oficina || []).flatMap(k => k === 'aforar' ? (r.facturasAforo || []).map(f => ({ doc: 'Aforar', [f.serie === 'A' ? 'ovi' : 'ov']: f.numero })) : k === 'otro' ? [{ doc: 'Otro (oficina)', otro: r.otroOficina || '' }] : [{ doc: OFICINA_LOG.find(x => x[0] === k)?.[1] || k }]) : [])];
        if (!docs.length) docs.push({ doc: '' });
        const fotos = (r.fotos || []).map(f => f.url).filter(Boolean);
        docs.forEach((d, i) => filas.push([
            diaXl(r.fecha), r.hora ? horaBonita(r.hora) : '', nombreVendedor(r.vendedor), nombreTipos(r), (r.contacto || r.proveedor || r.entidad || r.area || '') + (r.proveedorOtro && !r.contacto || r.contactoOtro ? ' (Otros)' : ''),
            r.zona || '', r.comercial ? nombreVendedor(r.comercial) : '', [r.destino, r.dirDestino, r.telDestino].filter(Boolean).join(' · '), r.transportadora || '',
            d.doc || '', d.ov || '', d.ovi || '', d.otro || '', r.estado === 'entregado' ? okTxt(r) : r.estado === 'no_entregado' ? noTxt(r) : 'Pendiente',
            r.registrada ? horaXl(r.registrada) : '', rp.recibio || '', rp.guia || '', rp.motivo || '', [rp.detalle, rp.faltantes?.length && `Sin hacer: ${rp.faltantes.join(' · ')}`, rp.novedad, textoAccionLog(rp), r.vieneDe ? `Reprogramada (era del ${fechaCorta(r.vieneDe)})` : '', intentoLog(r) > 1 ? `${intentoLog(r)}.º intento` : ''].filter(Boolean).join(' · '),
            [r.direccion, r.telefono && `Tel. ${r.telefono}`, r.proveedor && r.contacto ? `Proveedor: ${r.proveedor}` : '', r.detalle].filter(Boolean).join(' · '), i === 0 && fotos.length ? fotos.length : '', i === 0 ? fotos.join('\n') : '',
            r.reportadoPor ? nombreVendedor(r.reportadoPor) : '', (r.correcciones || []).length || ''
        ]));
    });
    const cols = [['Fecha', 12], ['Hora fija', 11], ['Mensajero', 18], ['Tipo de parada', 26], ['Cliente / proveedor / área', 34], ['Zona', 18], ['Comercial', 18], ['Destino', 16], ['Transportadora', 16],
        ['Pedido o documento', 24], ['Factura B (OV)', 14], ['Factura A (OVI)', 14], ['Otro número / detalle', 18], ['Estado', 14], ['Fecha y hora del reporte', 20], ['Recibió / entregó', 24], ['Guía', 14], ['Motivo (no realizada)', 24], ['Novedades', 40],
        ['Dirección e indicaciones', 36], ['Fotos', 8], ['Enlaces de las fotos', 40], ['Reportó', 16], ['Correcciones', 12]];
    const h = libro.addWorksheet('Entregas', { views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }] });
    h.getCell('A1').value = `Logística · ${mayuscula(nombreMes(mes))}${mens ? ' · ' + nombreVendedor(mens) : ''}`;
    h.getCell('A1').font = { bold: true, size: 14, color: { argb: naranja } };
    h.getCell('A2').value = `${filas.length} ${filas.length === 1 ? 'fila' : 'filas'} · ${regs.length} ${regs.length === 1 ? 'parada' : 'paradas'} · una fila por pedido o documento`;
    h.getCell('A2').font = { color: { argb: gris } };
    h.getCell('A3').value = `Descargado el ${fechaHora(new Date().toISOString())}`;
    h.getCell('A3').font = { italic: true, size: 9, color: { argb: 'FF777777' } };
    const cab = h.getRow(4);
    cols.forEach(([t, w], i) => {
        const c = cab.getCell(i + 1);
        c.value = t; c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: naranja } };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        h.getColumn(i + 1).width = w;
    });
    cab.height = 30;
    const colorEstado = { Pendiente: 'FFFEF3C7' };
    filas.forEach((f, n) => {
        const fila = h.getRow(5 + n);
        f.forEach((v, i) => { fila.getCell(i + 1).value = v === '' ? null : v; });
        fila.getCell(1).numFmt = 'dd/mm/yyyy'; fila.getCell(15).numFmt = 'dd/mm/yyyy hh:mm AM/PM';
        fila.eachCell({ includeEmpty: true }, c => {
            c.font = { size: 10 };
            c.alignment = { vertical: 'top', wrapText: true };
            c.border = { bottom: { style: 'thin', color: { argb: 'FFE8E1D9' } } };
        });
        const est = f[13], ce = h.getCell(5 + n, 14);
        ce.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: est === 'Pendiente' ? 'FFFEF3C7' : /^No /.test(est) ? 'FFFEE2E2' : 'FFDCFCE7' } };
        ce.font = { size: 10, bold: true, color: { argb: est === 'Pendiente' ? 'FF92400E' : /^No /.test(est) ? 'FF991B1B' : 'FF166534' } };
    });
    if (filas.length) h.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filas.length, column: cols.length } };
    // Resumen por mensajero y por tipo
    const r = libro.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
    r.getCell('A1').value = `Resumen · ${mayuscula(nombreMes(mes))}`;
    r.getCell('A1').font = { bold: true, size: 14, color: { argb: naranja } };
    const tabla = (fila0, titulo, primera, grupos, claveDe) => {
        r.getCell(fila0, 1).value = titulo; r.getCell(fila0, 1).font = { bold: true, size: 11, color: { argb: gris } };
        ['', 'Paradas', 'Realizadas', 'Con novedad', 'Pendientes', '% realizadas'].forEach((t, i) => {
            const c = r.getCell(fila0 + 1, i + 1);
            c.value = t || primera; c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: naranja } }; c.alignment = { horizontal: i ? 'center' : 'left' };
        });
        let n = fila0 + 2;
        grupos.forEach(([clave, nombre]) => {
            const g = regs.filter(x => claveDe(x) === clave); if (!g.length) return;
            const ok = g.filter(x => x.estado === 'entregado').length, no = g.filter(x => x.estado === 'no_entregado').length, pe = g.length - ok - no;
            [nombre, g.length, ok, no, pe, g.length - pe ? ok / (g.length - pe) : 0].forEach((v, i) => {
                const c = r.getCell(n, i + 1); c.value = v; c.border = { bottom: { style: 'thin', color: { argb: 'FFE8E1D9' } } };
                if (i === 5) c.numFmt = '0%'; if (i) c.alignment = { horizontal: 'center' };
            });
            n++;
        });
        return n;
    };
    let sig = tabla(3, 'Por mensajero', 'Mensajero', MENSAJEROS.map(m => [m.id, m.nombre]), x => x.vendedor);
    tabla(sig + 1, 'Por tipo de parada', 'Tipo de parada', Object.entries(TIPOS_LOG).map(([k, v]) => [k, v.t]), x => x.tipo);
    r.getColumn(1).width = 34; for (let i = 2; i <= 6; i++) r.getColumn(i).width = 14;
    r.getCell(sig + 9, 1).value = '"% realizadas" = realizadas sobre las paradas ya reportadas (no cuenta las pendientes).';
    r.getCell(sig + 9, 1).font = { italic: true, size: 9, color: { argb: 'FF777777' } };
    return libro;
}
