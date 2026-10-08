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
    envio:       { t: 'Envío fuera de Bogotá', corto: 'Envío', cliente: true, docs: true, envio: true, ok: 'Enviado', no: 'No enviado', quien: '¿Quién lo recibió? (transportadora o persona)', rec: 'Recibió' },
    radicacion:  { t: 'Radicación de documentos', corto: 'Radicación', cliente: true, radicacion: true, ok: 'Radicado', no: 'No radicado', quien: '¿Quién recibió?', rec: 'Recibió' },
    recoleccion: { t: 'Proveedor', corto: 'Proveedor', recoleccion: true, ok: 'Recogido', no: 'No recogido', quien: '¿Quién entregó?', rec: 'Entregó' },
    vuelta:      { t: 'Trámite área', corto: 'Trámite', vuelta: true, ok: 'Realizado', no: 'No realizado', quien: '¿Con quién se hizo?', rec: 'Con' }
};
const INCLUYE_ENTREGA = { devolucion: 'Recolección de devolución', pqr: 'Recolección de PQR' };
// Radicación: factura (serie A = OVI o B = OV) con su número, nota crédito (RNC) con su número, u otros (texto)
const DOCS_RADICACION = [{ k: 'factura', t: 'Factura' }, { k: 'nc', t: 'Nota crédito RNC' }, { k: 'otros', t: 'Otros' }];
const SERIES_FACTURA = { A: 'OVI', B: 'OV' };   // en pantalla solo se ve la letra
const MATERIALES_LOG = ['Materias primas', 'Envases', 'Plegadizas', 'Etiquetas', 'Otros'];
const AREAS_LOG = ['Recursos Humanos', 'Producción', 'Contabilidad', 'Calidad', 'Gerencia', 'Mercadeo', 'Comercial', 'Compras', 'Otra'];
const MOTIVOS_LOG = ['No estaba quien recibe', 'Lugar cerrado', 'Dirección incorrecta o no se encontró', 'Rechazó la entrega', 'El material no estaba listo', 'Pidió reprogramar', 'Otro'];
const logi = { fecha: '', mensajero: '', filtro: '', busca: '', soloLectura: false };

// ---------- DATOS ----------
const logRegs = () => visibles().filter(r => r.clase === 'logistica');
// Cada uno ve lo suyo: el coordinador y los jefes, todo; el auxiliar, sus paradas; el comercial, las entregas a sus clientes
// (el administrador ve todo; la jefe comercial, todo lo de clientes; el comercial, lo de sus clientes)
const logVisibles = () => logRegs().filter(r => esLogistica() ? (esCoordLog() || r.vendedor === sesion.id) : esAdmin() ? true : esJefe() ? hayTipo(r, 'cliente') : r.comercial === sesion.id);
const tituloModuloLog = () => esLogistica() || esAdmin() ? 'Logística' : esJefe() ? 'Entregas a clientes' : 'Entregas a tus clientes';
const zonaDeContacto = nombre => Object.keys(contactos).find(z => buscarMaestra(z, nombre));
const tiposLog = r => (r.tipos?.length ? r.tipos : [r.tipo]).filter(k => TIPOS_LOG[k]);
const hayTipo = (r, campo) => tiposLog(r).some(k => TIPOS_LOG[k][campo]);
const conRadicacion = r => hayTipo(r, 'radicacion');
const okTxt = r => TIPOS_LOG[r.tipo]?.ok || 'Realizada';
const noTxt = r => TIPOS_LOG[r.tipo]?.no || 'No realizada';
const incluyeTxt = r => (r.incluye || []).map(k => k === 'pqr' ? 'PQR' : 'devolución').join(' y ');
const nombreTipos = r => (TIPOS_LOG[r.tipo]?.t || '') + (r.incluye?.length ? ` + recoge ${incluyeTxt(r)}` : '') + (r.tipo !== 'radicacion' && conRadicacion(r) ? ' + radicación' : '');
const tituloLog = r => r.contacto || r.proveedor || (r.area ? `Trámite · ${r.area}` : 'Parada');
// Paradas con hora fija primero (por hora) y después el resto en el orden de la ruta
const ordenLog = (a, b) => (a.hora ? 0 : 1) - (b.hora ? 0 : 1) || (a.hora || '').localeCompare(b.hora || '') || (a.orden ?? 1e9) - (b.orden ?? 1e9) || (a.creado || '').localeCompare(b.creado || '');
// Facturas que se llevan (en pantalla A = OVI y B = OV, siempre de 6 cifras): A en terminados; B y/o A en magistral individual; B en magistral de pedido
const CLASES_PEDIDO = [
    { k: 'pt', t: 'Producto Terminado', campos: [['ovi', 'A']] },
    { k: 'mi', t: 'Magistral Individual', campos: [['ov', 'B'], ['ovi', 'A']] },
    { k: 'mp', t: 'Magistral de Pedido', campos: [['ov', 'B']] }
];
const claseDoc = k => CLASES_PEDIDO.find(c => c.k === k);
const textoDoc = d => [claseDoc(d.clase)?.t, d.ovi && `A ${d.ovi}`, d.ov && `B ${d.ov}`].filter(Boolean).join(' · ');
// Números de factura y nota crédito: 6 cifras, se completan con ceros a la izquierda (58 → 000058)
const seisCifras = v => { v = String(v || '').replace(/\D/g, ''); return v ? v.slice(-6).padStart(6, '0') : ''; };
const NUM6 = `placeholder="000000" inputmode="numeric" autocomplete="off" maxlength="6" title="6 cifras: se completa con ceros" oninput="this.value = this.value.replace(/[^0-9]/g, '')" onblur="this.value = seisCifras(this.value)"`;
const textoRad = d => d.doc === 'factura' ? `Radicar factura ${d.serie} ${d.numero || ''}`.trim()
    : d.doc === 'nc' ? `Radicar nota crédito RNC ${d.numero || ''}`.trim() : `Radicar: ${d.texto || ''}`;
const horaLog = iso => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
const chipEstadoLog = r => r.estado === 'entregado' ? `<span class="chip ok">${esc(okTxt(r))}</span>`
    : r.estado === 'no_entregado' ? `<span class="chip no">${esc(noTxt(r))}</span>` : '<span class="chip p">Pendiente</span>';
// Uno o varios teléfonos ("300… / 601…"), cada uno con su enlace para llamar
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
    b.querySelector('strong').textContent = tituloModuloLog();
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
    $('logDescargar').hidden = !(esCoordLog() || esAdmin() || esJefe());
    $('logDirectorio').hidden = !esAdmin();
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
    const cuenta = { '': dia.length, pendiente: dia.filter(r => r.estado === 'pendiente').length, entregado: dia.filter(r => r.estado === 'entregado').length, no_entregado: dia.filter(r => r.estado === 'no_entregado').length };
    const boton = (k, clase, texto) => `<button type="button" class="chip chip-filtro ${clase}${logi.filtro === k ? ' activo' : ''}" onclick="logi.filtro = logi.filtro === '${k}' ? '' : '${k}'; pintarLog()" aria-pressed="${logi.filtro === k}">${texto}</button>`;
    $('logResumen').innerHTML = dia.length ? boton('', 'gris', `<b>${cuenta['']}</b> ${cuenta[''] === 1 ? 'parada' : 'paradas'}`)
        + boton('entregado', 'ok', `${cuenta.entregado} reportadas con éxito`) + boton('pendiente', 'p', `${cuenta.pendiente} pendientes`)
        + (cuenta.no_entregado ? boton('no_entregado', 'no', `${cuenta.no_entregado} con novedad`) : '') : '';
    const lista = dia.filter(r => (!logi.filtro || r.estado === logi.filtro)
        && (!q || normalizar([tituloLog(r), r.proveedor, r.direccion, r.telefono, r.destino, ...(r.documentos || []).flatMap(d => [d.ov, d.ovi]), ...(r.radicacion || []).map(textoRad)].join(' ')).includes(q)));
    // Cada mensajero tiene su ruta numerada (el número no cambia aunque se filtre la lista)
    const rutas = {};
    dia.slice().sort(ordenLog).forEach(r => (rutas[r.vendedor] = rutas[r.vendedor] || []).push(r));
    const grupos = {};
    lista.sort(ordenLog).forEach(r => (grupos[r.vendedor] = grupos[r.vendedor] || []).push(r));
    const varios = Object.keys(grupos).length > 1 || (esCoordLog() || esJefe());
    const tarjetasCumple = cumplen(f).map(tarjetaCumple).join('');
    $('logLista').innerHTML = tarjetasCumple + (!lista.length
        ? `<div class="no-results">${dia.length ? 'No hay paradas con este filtro.' : lectura ? 'No hay entregas a tus clientes este día.' : 'No hay paradas programadas para este día.'}${lectura ? '' : '<br><button class="btn-nuevo active" onclick="abrirLogForm()">+ Programar</button>'}</div>`
        : Object.entries(grupos).map(([m, ps]) => (varios ? `<p class="grupo-titulo">${esc(nombreVendedor(m))} · ${ps.length} ${ps.length === 1 ? 'parada' : 'paradas'}</p>` : '')
            + ps.map(r => tarjetaLog(r, rutas[m].indexOf(r) + 1, rutas[m].length)).join('')).join(''));
}

function tarjetaLog(r, n, total) {
    const tp = TIPOS_LOG[r.tipo] || TIPOS_LOG.entrega, cerrada = r.estado !== 'pendiente', rp = r.reporte || {}, ok = okTxt(r), no = noTxt(r);
    const clase = r.estado === 'entregado' ? 'ok' : r.estado === 'no_entregado' ? 'no' : '';
    const titulo = r.contacto ? `<h3 class="cliente-link" data-c="${esc(r.contacto)}" onclick="verCliente(this.dataset.c, '${esc(r.comercial || '')}')" title="Ver historial del cliente">${esc(r.contacto)}</h3>` : `<h3>${esc(tituloLog(r))}</h3>`;
    const docs = (r.documentos || []).map(d => `<span class="lg-doc-chip">${esc(claseDoc(d.clase)?.t || 'Pedido')}${d.ovi ? ` · A <b>${esc(d.ovi)}</b>` : ''}${d.ov ? ` · B <b>${esc(d.ov)}</b>` : ''}</span>`).join('')
        + (r.radicacion || []).map(d => `<span class="lg-doc-chip rad">${esc(textoRad(d))}</span>`).join('');
    const lineas = [
        r.destino ? `<b>Destino:</b> ${esc(r.destino)}${r.transportadora ? ` · <b>Transportadora:</b> ${esc(r.transportadora)}` : ''}` : '',
        r.proveedor && (r.contacto || r.materiales?.length) ? `<b>Proveedor:</b> ${esc(r.proveedor)}` : '',
        r.materiales?.length ? `<b>Recoger:</b> ${esc(r.materiales.join(', '))}` : '',
        r.direccion ? `<b>Dirección:</b> ${esc(r.direccion)}` : '',
        r.telefono ? `<b>Teléfono:</b> ${enlacesTel(r.telefono)}` : '',
        r.detalle ? `<b>Indicaciones:</b> ${esc(r.detalle)}` : ''
    ].filter(Boolean).map(x => `<p class="nota-plan">${x}</p>`).join('');
    let reporte = '';
    if (cerrada) {
        const hora = r.registrada ? horaLog(r.registrada) : '';
        const partes = r.estado === 'entregado'
            ? [`<b>${esc(ok)}</b>${hora ? ' a las ' + esc(hora) : ''}`, rp.recibio ? `<b>${esc(tp.rec)}:</b> ${esc(rp.recibio)}` : '', rp.guia ? `<b>Guía:</b> ${esc(rp.guia)}` : '', rp.radicado ? `<b>Radicado:</b> ${esc(rp.radicado)}` : '', rp.detalle ? `<b>Detalle:</b> ${esc(rp.detalle)}` : '', rp.novedad ? `<b>Novedad:</b> ${esc(rp.novedad)}` : '']
            : [`<b>${esc(no)}</b>${hora ? ' · ' + esc(hora) : ''}`, `<b>Motivo:</b> ${esc(rp.motivo || '')}`, rp.novedad ? esc(rp.novedad) : ''];
        const fotos = (r.fotos || []).map((f, i) => `<a class="lg-foto" href="${esc(urlFoto(f))}" target="_blank" rel="noopener" title="Foto ${i + 1}"><img src="${esc(miniFoto(f))}" alt="Foto ${i + 1}" loading="lazy"></a>`).join('');
        const pend = (leerFotosPend()[r.id] || []).length;
        reporte = `<div class="reporte">${partes.filter(Boolean).join('<br>')}${fotos || pend ? `<div class="lg-fotos">${fotos}${pend ? `<span class="chip np">${pend} ${pend === 1 ? 'foto subiendo' : 'fotos subiendo'}…</span>` : ''}</div>` : ''}</div>`;
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
    const meta = [nombreTipos(r), r.zona || ''].filter(Boolean).join(' · ');
    return `<div class="producto-card visita-card lg-card ${clase} lg-${r.tipo}">
        <div class="visita-cab"><div>${r.hora ? `<span class="cita-fija"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Hora fija ${esc(horaBonita(r.hora))}</span><br>` : ''}<span class="ordenes"><span class="ord prog">${n}</span></span><span class="lg-tipo ${r.tipo}">${esc(tp.corto)}</span>${(r.incluye || []).map(k => `<span class="lg-tipo ${k}">${k === 'pqr' ? 'PQR' : 'Devolución'}</span>`).join('')}${r.tipo !== 'radicacion' && conRadicacion(r) ? '<span class="lg-tipo radicacion">Radicación</span>' : ''}${titulo}</div>${chipEstadoLog(r)}</div>
        ${mover}
        <p class="meta">${esc(meta)}</p>
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
    if (r && r.estado !== 'pendiente') return toast('Esta parada ya se reportó');
    const mens = esCoordLog() || esAdmin();
    const clientes = [...new Set(Object.values(contactos).flat().map(c => c.n))].sort((a, b) => a.localeCompare(b, 'es'));
    const provs = [...new Set(logRegs().map(x => x.proveedor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const doc = k => (r?.documentos || []).find(d => d.clase === k);
    const rad = k => (r?.radicacion || []).find(d => d.doc === k);
    abrirModal(`<form class="form-rc" onsubmit="guardarLog(event, '${id || ''}')">
        <h2>${r ? 'Editar parada' : 'Programar parada'}</h2>
        <div class="fila-fecha lg-fila-fecha">
            <div><label for="lgFecha">Fecha ${REQ}</label><input type="date" id="lgFecha" required min="${r ? '' : hoy()}" value="${esc(r?.fecha || logi.fecha || hoy())}"></div>
            <div><label for="lgHora">Hora <small>(si es fija)</small></label><input type="time" id="lgHora" value="${esc(r?.hora || '')}"></div>
            ${mens ? `<div><label for="lgMens">Mensajero ${REQ}</label><select id="lgMens" required>${MENSAJEROS.map(m => `<option value="${m.id}"${(r?.vendedor || logi.mensajero) === m.id ? ' selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></div>` : ''}
        </div>
        <label for="lgCliente">Cliente <small>(Maestra de clientes)</small> <span id="lgReqCli"></span></label>
        <input id="lgCliente" list="dlLogClientes" autocomplete="off" placeholder="Busca el cliente" value="${esc(r?.contacto || '')}" oninput="logInfoCliente()" onchange="logInfoCliente()">
        <datalist id="dlLogClientes">${clientes.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <p class="ayuda" id="lgInfoCli"></p>
        <label for="lgDir">Dirección <small>(sale sola con el cliente; puedes cambiarla)</small></label>
        <input id="lgDir" autocomplete="off" maxlength="120" value="${esc(r?.direccion || '')}" oninput="this.dataset.auto = ''">
        <label for="lgTel">Teléfono <small>(sale solo con el cliente; puedes cambiarlo)</small></label>
        <input id="lgTel" type="tel" autocomplete="off" maxlength="40" value="${esc(r?.telefono || '')}" oninput="this.dataset.auto = ''">
        <label>Tipo de parada ${REQ}</label>
        <div class="lg-chips" id="lgTipos">${Object.entries(TIPOS_LOG).filter(([k]) => k !== 'radicacion').map(([k, v]) => `<label class="lg-chip"><input type="radio" name="lgTipo" value="${k}"${r?.tipo === k ? ' checked' : ''} onclick="tipoClick(this)"><span>${esc(v.t)}</span></label>`).join('')}
            <label class="lg-chip lg-chip-rad"><input type="checkbox" id="lgRadChk"${r && conRadicacion(r) ? ' checked' : ''} onchange="logCampos()"><span>${esc(TIPOS_LOG.radicacion.t)}</span></label></div>
        <p class="ayuda">Escoge uno. La radicación de documentos puede ir sola o sumarse a cualquier otro.</p>
        <div id="lgBIncluye">
            <label>En esta entrega también se recoge <small>(opcional)</small></label>
            <div class="lg-chips" id="lgIncluye">${Object.entries(INCLUYE_ENTREGA).map(([k, t]) => `<label class="lg-chip"><input type="checkbox" value="${k}"${r?.incluye?.includes(k) ? ' checked' : ''} onchange="logCampos()"><span>${esc(t)}</span></label>`).join('')}</div>
        </div>
        <div id="lgBDocs">
            <label>Factura <span id="lgReqDoc">${REQ}</span> <small>(marca qué llevas)</small></label>
            <div class="lg-pedidos">${CLASES_PEDIDO.map(c => `<div class="lg-pedido" data-k="${c.k}">
                <label class="lg-pchk"><input type="checkbox"${doc(c.k) ? ' checked' : ''} onchange="logCampos()"><span>${esc(c.t)}</span></label>
                <div class="lg-pcampos">${c.campos.map(([f, t]) => `<label class="lg-pc"><span class="lg-pref">${t}</span><input data-f="${f}" ${NUM6} value="${esc(doc(c.k)?.[f] || '')}"></label>`).join('')}</div>
            </div>`).join('')}</div>
        </div>
        <div id="lgBRad">
            <label>Qué se radica ${REQ}</label>
            <div class="lg-pedidos">${DOCS_RADICACION.map(c => `<div class="lg-pedido lg-rad" data-k="${c.k}">
                <label class="lg-pchk"><input type="checkbox"${rad(c.k) ? ' checked' : ''} onchange="logCampos()"><span>${esc(c.t)}</span></label>
                <div class="lg-pcampos">${c.k === 'factura'
                    ? `<label class="lg-pc"><select data-f="serie" class="lg-pref lg-serie" aria-label="Serie de la factura">${Object.entries(SERIES_FACTURA).map(([s, t]) => `<option value="${s}"${rad('factura')?.serie === s ? ' selected' : ''}>${s}</option>`).join('')}</select><input data-f="numero" ${NUM6} value="${esc(rad('factura')?.numero || '')}"></label>`
                    : c.k === 'nc' ? `<label class="lg-pc"><span class="lg-pref">RNC</span><input data-f="numero" ${NUM6} value="${esc(rad('nc')?.numero || '')}"></label>`
                    : `<label class="lg-pc"><input data-f="texto" placeholder="Qué documento se radica" autocomplete="off" maxlength="80" value="${esc(rad('otros')?.texto || '')}"></label>`}</div>
            </div>`).join('')}</div>
        </div>
        <div id="lgBEnvio">
            <div class="fila-fecha iguales"><div><label for="lgDestino">Ciudad de destino ${REQ}</label><input id="lgDestino" autocomplete="off" value="${esc(r?.destino || '')}"></div>
            <div><label for="lgTransp">Transportadora ${REQ}</label><input id="lgTransp" autocomplete="off" value="${esc(r?.transportadora || '')}"></div></div>
        </div>
        <div id="lgBRecol">
            <label for="lgProv">Proveedor ${REQ}</label>
            <input id="lgProv" list="dlLogProv" autocomplete="off" value="${esc(r?.proveedor || '')}"><datalist id="dlLogProv">${provs.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
            <label>Qué se recoge</label>
            <div class="lg-chips" id="lgMateriales">${MATERIALES_LOG.map(m => `<label class="lg-chip"><input type="checkbox" value="${esc(m)}"${r?.materiales?.includes(m) ? ' checked' : ''}><span>${esc(m)}</span></label>`).join('')}</div>
        </div>
        <div id="lgBVuelta">
            <label for="lgArea">Área ${REQ}</label>
            <select id="lgArea">${AREAS_LOG.map(a => `<option${r?.area === a ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select>
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
const tipoMarcado = () => document.querySelector('#lgTipos input[name=lgTipo]:checked')?.value || (radMarcada() ? 'radicacion' : '');
// Tocar otra vez el tipo marcado lo desmarca (para dejar solo la radicación)
function tipoClick(el) {
    if (el.dataset.on === '1') el.checked = false;
    document.querySelectorAll('#lgTipos input[name=lgTipo]').forEach(i => { i.dataset.on = i.checked ? '1' : ''; });
    logCampos();
}
const incluyeMarcado = () => [...document.querySelectorAll('#lgIncluye input:checked')].map(i => i.value);
// Muestra solo los campos del tipo de parada escogido
function logCampos() {
    document.querySelectorAll('#lgTipos input[name=lgTipo]').forEach(i => { i.dataset.on = i.checked ? '1' : ''; });
    const k = tipoMarcado(), tp = TIPOS_LOG[k] || {}, conRad = radMarcada();
    $('lgReqCli').innerHTML = tp.cliente || conRad ? REQ : '<small>(si aplica)</small>';
    $('lgCliente').required = !!(tp.cliente || conRad);
    $('lgBIncluye').hidden = k !== 'entrega';
    $('lgBDocs').hidden = !tp.docs;
    // En la entrega, los pedidos son obligatorios salvo que solo se vaya a recoger una devolución o una PQR
    const docsObl = k === 'envio' || (k === 'entrega' && !incluyeMarcado().length);
    $('lgReqDoc').innerHTML = docsObl ? REQ : '<small>(opcional)</small>';
    $('lgBRad').hidden = !conRad;
    $('lgBEnvio').hidden = !tp.envio; $('lgDestino').required = !!tp.envio; $('lgTransp').required = !!tp.envio;
    $('lgBRecol').hidden = !tp.recoleccion; $('lgProv').required = !!tp.recoleccion;
    $('lgBVuelta').hidden = !tp.vuelta;
    $('lgLblDet').innerHTML = tp.vuelta ? `Qué hay que hacer ${REQ}` : 'Indicaciones <small>(opcional)</small>';
    $('lgDetalle').required = !!tp.vuelta;
    // Cada casilla marcada (clase de pedido o documento a radicar) muestra sus campos, que pasan a ser obligatorios
    document.querySelectorAll('.lg-pedido').forEach(fila => {
        const visible = !fila.closest('[hidden]'), on = fila.querySelector('.lg-pchk input').checked && visible;
        fila.classList.toggle('on', on);
        fila.querySelector('.lg-pcampos').hidden = !on;
        const campos = fila.querySelectorAll('.lg-pcampos input');
        campos.forEach(i => i.required = on && campos.length === 1);   // Magistral Individual: basta A o B
    });
}
// A quién le llega la entrega (el vendedor de la zona del cliente) y los datos del cliente en la Maestra
function datosClienteLog(nombre) {
    const zona = nombre ? zonaDeContacto(nombre) : '', c = zona ? buscarMaestra(zona, nombre) : null, d = dirDe(nombre);
    return { zona: zona || '', comercial: zona ? vendedorDeZona(zona)?.id || '' : '', ciudad: c?.c || d?.c || '', dir: d?.dir || '', tel: d?.tel || '' };
}
// Dirección y teléfono: los de la Maestra y, si la Maestra aún no los tiene, los de la última parada a ese cliente.
// Solo se llenan si el campo está vacío o se llenó solo (lo que escribe logística no se pisa).
function logInfoCliente(rellenar = true) {
    const nombre = $('lgCliente')?.value.trim();
    if (!$('lgInfoCli')) return;
    if (!nombre) { $('lgInfoCli').textContent = ''; return; }
    const d = datosClienteLog(nombre);
    $('lgInfoCli').innerHTML = d.comercial ? `✓ ${esc(d.zona)} · ${esc(nombreVendedor(d.comercial))} verá esta entrega en el historial del cliente${d.ciudad ? ' · ' + esc(d.ciudad) : ''}`
        : 'No está en la Maestra: no se le avisará a ningún comercial.';
    if (!rellenar) return;
    const ultima = logRegs().filter(x => x.contacto && normalizar(x.contacto) === normalizar(nombre) && (x.direccion || x.telefono)).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const poner = (campo, valor) => { if (valor && (!campo.value || campo.dataset.auto === '1')) { campo.value = valor; campo.dataset.auto = '1'; } };
    poner($('lgDir'), d.dir || ultima?.direccion);
    poner($('lgTel'), d.tel || ultima?.telefono);
}

function guardarLog(e, id) {
    e.preventDefault();
    const antes = id ? registros[id] : null, tipo = tipoMarcado(), tp = TIPOS_LOG[tipo], fecha = $('lgFecha').value;
    if (!tp) return toast('Escoge el tipo de parada');
    const conRad = radMarcada(), tipos = conRad && tipo !== 'radicacion' ? [tipo, 'radicacion'] : [tipo];
    if (!fecha) return toast('Elige la fecha');
    if (!antes && fecha < hoy()) return toast('Ese día ya pasó: programa desde hoy');
    const vendedor = $('lgMens') ? $('lgMens').value : (antes?.vendedor || sesion.id);
    const incluye = tipo === 'entrega' ? incluyeMarcado() : [];
    const leer = sel => [...document.querySelectorAll(sel)].filter(f => f.querySelector('.lg-pchk input').checked).map(f => {
        const d = {};
        f.querySelectorAll('.lg-pcampos [data-f]').forEach(i => { d[i.dataset.f] = ['ov', 'ovi', 'numero'].includes(i.dataset.f) ? seisCifras(i.value) : i.value.trim(); });
        return { k: f.dataset.k, d };
    });
    const documentos = tp.docs ? leer('#lgBDocs .lg-pedido').map(({ k, d }) => ({ clase: k, ...d })) : [];
    const radicacion = conRad ? leer('#lgBRad .lg-pedido').map(({ k, d }) => ({ doc: k, ...d })) : [];
    const sinNumero = documentos.find(d => !d.ov && !d.ovi);
    if (sinNumero) return toast(`${claseDoc(sinNumero.clase)?.t}: escribe al menos la factura A o la B`);
    if ((tipo === 'envio' || (tipo === 'entrega' && !incluye.length)) && !documentos.length) return toast('Marca qué pedido llevas y escribe sus números');
    if (conRad && !radicacion.length) return toast('Marca qué se radica: factura, nota crédito u otros');
    if (radicacion.some(d => d.doc !== 'otros' ? !d.numero : !d.texto)) return toast('Escribe el número (o el documento) de lo que se radica');
    // El cliente de la Maestra se guarda con su nombre exacto; uno que no esté en la Maestra, con nombre propio
    const escrito = $('lgCliente').value.trim(), zonaC = escrito ? zonaDeContacto(escrito) : '';
    const contacto = zonaC ? buscarMaestra(zonaC, escrito).n : escrito ? nombrePropio(escrito) : '';
    const cl = datosClienteLog(contacto);
    const base = antes || { id: nuevoId(), clase: 'logistica', estado: 'pendiente', creado: new Date().toISOString(), creadoPor: sesion.id };
    const mismo = logRegs().filter(x => x.fecha === fecha && x.vendedor === vendedor && x.id !== base.id);
    const orden = antes && antes.fecha === fecha && antes.vendedor === vendedor ? antes.orden : Math.max(0, ...mismo.map(x => x.orden || 0)) + 1;
    guardarRegistro({
        ...base, tipo, tipos, incluye, fecha, hora: $('lgHora').value, vendedor, orden, documentos, radicacion,
        contacto, zona: cl.zona, comercial: cl.comercial, ciudad: cl.ciudad || '',
        destino: tp.envio ? $('lgDestino').value.trim() : '', transportadora: tp.envio ? $('lgTransp').value.trim() : '',
        proveedor: tp.recoleccion ? $('lgProv').value.trim() : '', materiales: tp.recoleccion ? [...document.querySelectorAll('#lgMateriales input:checked')].map(i => i.value) : [],
        area: tp.vuelta ? $('lgArea').value : '', direccion: $('lgDir').value.trim(), telefono: $('lgTel').value.trim(), detalle: $('lgDetalle').value.trim()
    });
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
    const req = !!tp.cliente;   // entregas, envíos y radicaciones piden quién recibió
    const detalle = r.tipo === 'recoleccion' ? 'Qué se recogió' : r.tipo === 'vuelta' ? 'Resultado' : r.incluye?.length ? `Qué se recogió (${incluyeTxt(r)})` : '';
    fotosLogSel = [];
    abrirModal(`<form class="form-rc" onsubmit="guardarLogReporte(event, '${id}', ${ok})">
        <h2>${ok ? esc(okTxt(r)) : esc(noTxt(r))}</h2>
        <p class="sub">${esc(tituloLog(r))}${(r.documentos || []).length ? ' · ' + esc(r.documentos.map(textoDoc).join(' · ')) : ''}${(r.radicacion || []).length ? ' · ' + esc(r.radicacion.map(textoRad).join(' · ')) : ''}</p>
        ${ok ? `
            <label for="lgRecibio">${esc(tp.quien)} ${req ? REQ : '<small>(opcional)</small>'}</label>
            <input id="lgRecibio" autocomplete="off" maxlength="80" ${req ? 'required' : ''}>
            ${tieneEnvio ? `<label for="lgGuia">Número de guía ${REQ}</label><input id="lgGuia" autocomplete="off" maxlength="40" required>` : ''}
            ${conRadicacion(r) ? `<label for="lgRadicado">Número o sello de radicado <small>(opcional)</small></label><input id="lgRadicado" autocomplete="off" maxlength="40">` : ''}
            ${detalle ? `<label for="lgRDetalle">${esc(detalle)} <small>(opcional)</small></label><textarea id="lgRDetalle" rows="2" maxlength="200"></textarea>` : ''}
            <label for="lgNovedad">Novedades <small>(opcional)</small></label>
            <textarea id="lgNovedad" rows="2" maxlength="200" placeholder="Ej: faltó una unidad, el cliente pidió cambiar la factura…"></textarea>
        ` : `
            <label for="lgMotivo">Motivo ${REQ}</label>
            <select id="lgMotivo" required><option value="">Elige el motivo</option>${MOTIVOS_LOG.map(m => `<option>${esc(m)}</option>`).join('')}</select>
            <label for="lgNovedad">Cuéntalo con más detalle ${REQ}</label>
            <textarea id="lgNovedad" rows="3" maxlength="200" required placeholder="Qué pasó y qué se acordó con el cliente"></textarea>
        `}
        <label for="lgFotos">Foto <small>${ok ? (conRadicacion(r) ? '(recomendada: foto del sello de radicado)' : '(recomendada: foto de la entrega o del recibido)') : '(opcional)'}</small></label>
        <div class="lg-foto-btns">
            <label class="btn-secundario lg-foto-btn">📷 Tomar foto<input type="file" accept="image/*" capture="environment" hidden onchange="agregarFotosLog(this)"></label>
            <label class="btn-secundario lg-foto-btn">🖼 Galería o captura<input type="file" accept="image/*" multiple hidden onchange="agregarFotosLog(this)"></label>
        </div>
        <p class="ayuda" id="lgFotosTxt"></p>
        <p class="ayuda">Se guarda con la hora de ahora: ${esc(fechaHora(new Date().toISOString()))}</p>
        <div class="form-botones">
            <button type="button" class="btn-secundario" onclick="cerrarModal()">Cancelar</button>
            <button class="btn-primario" id="lgBtnRep">Guardar</button>
        </div>
    </form>`, ok ? '' : 'theme-rojo');
}

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
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
        const archivos = fotosLogSel.slice(0, 4);
        const fotos = [];
        for (const f of archivos) fotos.push(await comprimirFoto(f, API_URL ? 1280 : 480, API_URL ? 0.72 : 0.6));
        const val = k => $(k)?.value.trim() || '';
        const reporte = ok ? { recibio: val('lgRecibio'), guia: val('lgGuia'), radicado: val('lgRadicado'), detalle: val('lgRDetalle'), novedad: val('lgNovedad') }
            : { motivo: val('lgMotivo'), novedad: val('lgNovedad') };
        // Sin servidor (pruebas) la foto chica queda en el registro; con servidor se sube a Drive en segundo plano
        guardarRegistro({ ...r, estado: ok ? 'entregado' : 'no_entregado', reporte, registrada: new Date().toISOString(), reportadoPor: sesion.id,
            fotos: [...(r.fotos || []), ...(API_URL ? [] : fotos.map(d => ({ data: d })))] });
        if (API_URL && fotos.length) { const p = leerFotosPend(); p[id] = [...(p[id] || []), ...fotos]; guardarFotosPend(p); subirFotosPend(); }
        cerrarModal();
        toast(ok ? `${okTxt(r)}: queda registrado` : 'Novedad registrada');
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
    filas.forEach(([n, c, dir, tel, z]) => { if (n) m[normalizar(n)] = { c, dir, tel, z }; });
    directorio = { filas: m, actualizado: actualizado || '', traido: Date.now() };
    try { localStorage.setItem(DIR_LOCAL, JSON.stringify(directorio)); } catch (e) { /* sin espacio: queda en memoria */ }
}
// Cada comercial solo ve los de su zona (el servidor ya filtra; esto cubre el módulo de pruebas)
const dirDe = nombre => {
    const d = nombre ? directorio.filas[normalizar(nombre)] : null;
    return d && (esLogistica() || esJefe() || esAdmin() || !d.z || d.z === comercial(sesion?.id)?.zona) ? d : null;
};
function borrarDirectorio() { directorio = { filas: {} }; try { localStorage.removeItem(DIR_LOCAL); } catch (e) { /* nada */ } }
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

// Dirección y teléfono en la tarjeta del cliente (Maestra)
function htmlDirectorioCliente(nombre) {
    const d = dirDe(nombre);
    if (!d || !(d.dir || d.tel)) return '';
    const tels = enlacesTel(d.tel);
    return `<p class="dir-cliente">${d.dir ? `📍 ${esc(d.dir)}` : ''}${d.dir && tels ? '<br>' : ''}${tels ? `📞 ${tels}` : ''}</p>`;
}

// ---------- HISTORIAL DEL CLIENTE (Maestra) ----------
const entregasCliente = nombre => logVisibles().filter(r => hayTipo(r, 'cliente') && r.contacto && normalizar(r.contacto) === normalizar(nombre))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || ordenLog(b, a));
function htmlEntregasCliente(nombre) {
    const lista = entregasCliente(nombre);
    if (!lista.length) return esLogistica() ? '<div class="no-results">Todavía no hay entregas registradas para este cliente.</div>' : '';
    return `<p class="grupo-titulo">Entregas y recolecciones · ${lista.length}</p>` + lista.map(r => {
        const tp = TIPOS_LOG[r.tipo], rp = r.reporte || {}, cls = r.estado === 'entregado' ? 'ok' : r.estado === 'no_entregado' ? 'no' : 'p';
        const docs = [...(r.documentos || []).map(textoDoc), ...(r.radicacion || []).map(textoRad)].filter(Boolean).map(esc).join('<br>');
        const det = r.estado === 'entregado' ? [rp.recibio && `${tp.rec}: ${rp.recibio}`, rp.guia && `Guía ${rp.guia}`, rp.radicado && `Radicado ${rp.radicado}`, rp.novedad && `Novedad: ${rp.novedad}`] : r.estado === 'no_entregado' ? [rp.motivo, rp.novedad] : ['Pendiente de reportar'];
        const fotos = (r.fotos || []).map((f, i) => `<a class="lg-foto" href="${esc(urlFoto(f))}" target="_blank" rel="noopener"><img src="${esc(miniFoto(f))}" alt="Foto ${i + 1}" loading="lazy"></a>`).join('');
        return `<div class="hist-item ${cls}">
            <div class="hist-cab"><b>${esc(mayuscula(fechaLarga(r.fecha)))}${r.registrada ? ' · ' + esc(horaLog(r.registrada)) : r.hora ? ' · hora fija ' + esc(horaBonita(r.hora)) : ''}</b>${chipEstadoLog(r)}</div>
            <p class="meta">${esc([nombreTipos(r), nombreVendedor(r.vendedor)].join(' · '))}</p>
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
                : d.doc === 'nc' ? { doc: 'Radicar nota crédito RNC', otro: d.numero } : { doc: 'Radicar otros', otro: d.texto })];
        if (!docs.length) docs.push({ doc: '' });
        const fotos = (r.fotos || []).map(f => f.url).filter(Boolean);
        docs.forEach((d, i) => filas.push([
            diaXl(r.fecha), r.hora ? horaBonita(r.hora) : '', nombreVendedor(r.vendedor), nombreTipos(r), r.contacto || r.proveedor || r.area || '',
            r.zona || '', r.comercial ? nombreVendedor(r.comercial) : '', r.destino || '', r.transportadora || '',
            d.doc || '', d.ov || '', d.ovi || '', d.otro || '', r.estado === 'entregado' ? okTxt(r) : r.estado === 'no_entregado' ? noTxt(r) : 'Pendiente',
            r.registrada ? horaXl(r.registrada) : '', rp.recibio || '', rp.guia || '', rp.radicado || '', rp.motivo || '', [rp.detalle, rp.novedad].filter(Boolean).join(' · '),
            [r.direccion, r.telefono && `Tel. ${r.telefono}`, r.proveedor && r.contacto ? `Proveedor: ${r.proveedor}` : '', r.detalle].filter(Boolean).join(' · '), i === 0 && fotos.length ? fotos.length : '', i === 0 ? fotos.join('\n') : '',
            r.reportadoPor ? nombreVendedor(r.reportadoPor) : '', (r.correcciones || []).length || ''
        ]));
    });
    const cols = [['Fecha', 12], ['Hora fija', 11], ['Mensajero', 18], ['Tipo de parada', 26], ['Cliente / proveedor / área', 34], ['Zona', 18], ['Comercial', 18], ['Destino', 16], ['Transportadora', 16],
        ['Pedido o documento', 24], ['Factura B (OV)', 14], ['Factura A (OVI)', 14], ['Otro número / detalle', 18], ['Estado', 14], ['Fecha y hora del reporte', 20], ['Recibió / entregó', 24], ['Guía', 14], ['Radicado', 14], ['Motivo (no realizada)', 24], ['Novedades', 40],
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
