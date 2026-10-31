// ---------- BASES DE DATOS: solo el administrador ----------
// Pantalla del inicio donde se suben las maestras: Maestra de contactos (clientes y médicos por zona), productos,
// direcciones y teléfonos de clientes, y proveedores. Contactos y productos se guardan en el servidor (hoja "Bases") y
// reemplazan a los que vienen en la app publicada; direcciones y proveedores usan sus propias hojas (ver logistica.js).
// Se carga después de app.js y logistica.js (usa sus funciones y constantes).
const BASE_LOCAL = n => 'rc_base_' + n;
const leerBaseLocal = n => { try { return JSON.parse(localStorage.getItem(BASE_LOCAL(n))); } catch (e) { return null; } };
const guardarBaseLocal = (n, v, d, resumen) => { try { localStorage.setItem(BASE_LOCAL(n), JSON.stringify({ v, d, resumen })); } catch (e) { /* sin espacio: queda solo en memoria */ } };

// Lo subido por el administrador reemplaza lo que trae la app publicada
function aplicarBase(n, d) {
    if (n === 'contactos') { contactos = d; try { localStorage.setItem('rc_contactos', JSON.stringify(d)); } catch (e) { /* nada */ } }
    if (n === 'catalogo') {
        Object.keys(CATALOGO).forEach(k => { delete CATALOGO[k]; });
        Object.assign(CATALOGO, d);
        Object.keys(productoPorCodigo).forEach(k => { delete productoPorCodigo[k]; });
        CATALOGO.productos.forEach(p => { productoPorCodigo[p.c] = p; });
    }
}
// Al abrir la app: si hay una base subida guardada en el teléfono, se usa en vez de la publicada
function baseLocal(n, publicada) { const b = leerBaseLocal(n); return b && b.d ? b.d : publicada; }
(() => { const b = leerBaseLocal('catalogo'); if (b && b.d && b.d.productos) aplicarBase('catalogo', b.d); })();

// Trae del servidor las bases que cambiaron (cada 10 minutos como mucho)
let ultimaBases = 0, trayendoBases = false;
async function cargarBases(forzar = false) {
    if (!API_URL || !sesion || trayendoBases) return;
    if (!forzar && Date.now() - ultimaBases < 10 * 60e3) return;
    trayendoBases = true;
    try {
        const { versiones } = await llamarApi({ accion: 'versionesBases' });
        let cambio = false;
        for (const n of ['contactos', 'catalogo']) {
            const v = versiones && versiones[n];
            if (!v || leerBaseLocal(n)?.v === v) continue;
            const r = await llamarApi({ accion: 'leerBase', nombre: n }, 90000);
            if (!r.contenido) continue;
            const d = JSON.parse(r.contenido);
            guardarBaseLocal(n, r.actualizado || v, d, '');
            aplicarBase(n, d); cambio = true;
        }
        ultimaBases = Date.now();
        if (cambio) repintarPantallaActiva();
    } catch (e) { console.warn('No se pudieron traer las bases de datos:', e); }
    finally { trayendoBases = false; }
}

// ---------- Pantalla ----------
const TARJETAS_BASES = [
    { k: 'odoo', t: 'Maestra de Odoo (todo en uno)', d: 'Sube la Maestra de Contactos de Odoo tal como sale (con Calle, Teléfono y Móvil), uno o varios archivos con las mismas columnas. La app reparte cada fila según su Equipo de ventas: zonas → Maestra de contactos y Direcciones; Empleados → Empleados; el resto → Proveedores. Empleados y Proveedores solo los ven Logística y tú.', a: 'subirOdoo()', n: 'odoo' },
    { k: 'catalogo', t: 'Productos y Vademécum (todo en uno)', d: 'Sube de una vez los dos archivos de Odoo, Producto Terminado y Magistrales (misma estructura), seleccionándolos juntos. La app reparte sola: etiquetas del catálogo de visitas y muestras, productos del Vademécum y portafolio de cada cliente. Si subes solo uno, reemplaza únicamente lo suyo.', a: 'subirProductosTodo()', n: 'productos' },
    { k: 'productoterminado', t: 'Vademécum Producto Terminado', d: 'Archivo de Producto Terminado de Odoo (Referencia Interna, Nombre, Categoría, Forma, Presentación, Tamaño…). Alimenta el Vademécum de Producto Terminado que ven todos los usuarios y también las etiquetas de producto terminado del catálogo de visitas y muestras.', a: 'subirProductosTodo(true)', n: 'productoterminado' },
    { k: 'homologos', t: 'Homólogos (solo magistrales)', d: 'Productos que un cliente conoce con otro nombre (Product Counterpart/Cliente y /Nombre). Se guardan aquí y con ellos se arman los portafolios de cada cliente, sin depender de archivos publicados. Sube el archivo Producto_product.template de Odoo (Grupo, Categoría, Etiquetas, Referencia Interna, Nombre, Product Counterpart/Cliente, Product Counterpart/Nombre).', a: 'subirHomologos()', n: 'homologos' },
    { k: 'materiasprimas', t: 'Materias primas', d: 'Vademécum de materias primas (Vademecum Materias Primas: Referencia Interna, Nombre, Componentes, Indicación, Dosis Recomendada, Categoria Principal y Secundaria). Al subirlo, la app categoriza: respeta la categoría que ya trae cada materia o la que tenía, y las que quedan sin categoría te las propone para que las confirmes.', a: 'subirMateriasPrimas()', n: 'materiasprimas' }
];
const cuandoBase = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : ''; };
let estadoBases = {};
function textoEstadoBase(k) {
    const e = estadoBases[k], l = leerBaseLocal(k);
    const cuando = e?.actualizado || l?.v || (k === 'directorio' ? directorio.actualizado : k === 'proveedores' ? proveedoresMaestra.actualizado : k === 'empleados' ? empleadosMaestra.actualizado : '');
    const n = k === 'directorio' ? Object.keys(directorio.filas).length : k === 'proveedores' ? Object.keys(proveedoresMaestra.filas).length : k === 'empleados' ? Object.keys(empleadosMaestra.filas).length : 0;
    const resumen = e?.resumen || l?.resumen || (n ? `${n} registros` : '');
    if (k === 'odoo') {
        const fechas = [estadoBases.contactos?.actualizado, leerBaseLocal('contactos')?.v, directorio.actualizado, empleadosMaestra.actualizado, proveedoresMaestra.actualizado].filter(Boolean).sort();
        const nC = Object.values(contactos).flat().length, nA = Object.values(directorio.alt || {}).flat().length, nE = Object.keys(empleadosMaestra.filas).length, nP = Object.keys(proveedoresMaestra.filas).length;
        return fechas.length ? `Última carga: <b>${esc(cuandoBase(fechas[fechas.length - 1]))}</b> · ${nC} contactos · ${nA} direcciones alternas · ${nE} empleados · ${nP} proveedores` : '<i>Aún no se ha subido: la app usa lo que trae publicado</i>';
    }
    return cuando ? `Última carga: <b>${esc(cuandoBase(cuando))}</b>${resumen ? ' · ' + esc(resumen) : ''}` : '<i>Aún no se ha subido: la app usa lo que trae publicado</i>';
}
function pintarBases() {
    $('basesLista').innerHTML = TARJETAS_BASES.map(x => `<div class="base-tarjeta">
        <div class="base-info"><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p><p class="base-estado">${textoEstadoBase(x.k)}</p></div>
        <div class="base-botones"><button type="button" class="btn-nuevo" onclick="${x.a}">⬆ Subir</button>
        ${x.sinDescarga ? '' : `<button type="button" class="btn-sec" onclick="descargarBase('${x.k}')">⬇ Descargar</button>`}</div></div>`).join('');
}
async function abrirBases() {
    if (!esAdmin()) return;
    pintarBases();
    mostrarPantalla('basesScreen');
    if (API_URL) { try { estadoBases = (await llamarApi({ accion: 'estadoBases' })).estado || {}; if (pantallaActiva() === 'basesScreen') pintarBases(); } catch (e) { console.warn('No se pudo traer el estado de las bases:', e); } }
}
// Después de subir algo, se refresca el estado en la pantalla
function refrescarBases() { if (pantallaActiva() === 'basesScreen') { pintarBases(); if (API_URL) llamarApi({ accion: 'estadoBases' }).then(r => { estadoBases = r.estado || {}; pintarBases(); }).catch(() => {}); } }

// ---------- Lectura de Excel ----------
const claveTexto = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const celdaTexto = c => { const v = c.value; return v === null || v === undefined ? '' : typeof v === 'boolean' ? String(v) : String(c.text ?? v).trim(); };
// Filas de una hoja como listas de texto (la primera, con los títulos)
// Odoo a veces exporta con los nombres técnicos de los campos: se leen como las columnas de siempre
const ALIAS_COLUMNAS = { default_code: 'Referencia Interna', name: 'Nombre', product_group: 'Grupo de Producto', categ_id: 'Categoría del Producto', pharmaceutical_form: 'Forma Farmacéutica',
    pharmaceutical_presentation: 'Presentación Farmacéutica', size: 'Tamaño', components: 'Componentes', indication: 'Indicación', recommended_dosage: 'Dosis Recomendada',
    product_tag_ids: 'Etiquetas de producto', active: 'Activo(a)' };
const filasHoja = ws => { const f = []; ws.eachRow({ includeEmpty: false }, fila => { const a = []; for (let i = 1; i <= ws.columnCount; i++) a.push(celdaTexto(fila.getCell(i))); f.push(a); });
    if (f[0]?.includes('default_code')) f[0] = f[0].map(c => ALIAS_COLUMNAS[c.trim()] || c);
    return f; };
async function leerLibro(archivo) { await cargarExcelJS(); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await archivo.arrayBuffer()); return wb; }
function elegirArchivos(multiple = false) {
    return new Promise(resolve => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.xlsx'; inp.multiple = multiple;
        inp.onchange = () => resolve([...inp.files]);
        inp.oncancel = () => resolve([]);
        inp.click();
    });
}
async function guardarBaseServidor(n, d, resumen) {
    let cuando = new Date().toISOString();
    if (API_URL) cuando = (await llamarApi({ accion: 'guardarBase', nombre: n, contenido: JSON.stringify(d), resumen }, 120000)).actualizado || cuando;
    guardarBaseLocal(n, cuando, d, resumen);
    aplicarBase(n, d);
    estadoBases[n] = { actualizado: cuando, resumen };
    refrescarBases(); repintarPantallaActiva();
}

// ---------- Maestra de contactos (misma lógica que herramientas/maestra_contactos.py) ----------
const ZONAS_BASE = ['Clientes Especiales', 'Zona Norte', 'Zona Sur', 'Zona Desarrollo'];
const COMERCIAL_ZONA_BASE = [['Vacante Epithelium', 'Zona Sur'], ['Yunelis Caballero', 'Zona Sur'], ['Yunelis Esther Caballero', 'Zona Sur'],
    ['Maryi Tatiana Castro', 'Zona Desarrollo'], ['Lizeth Geraldine Ramos Guerrero', 'Zona Norte'], ['Jennifer Andrea Herrera', 'Clientes Especiales']];
function contactosDeMaestra(filas) {
    const cab = filas[0].map(x => x.trim()), col = Object.fromEntries(cab.map((n, i) => [n, i]));
    for (const n of ['Nombre Público', 'Ciudad', 'Comercial', 'Equipo de ventas', 'Etiquetas']) if (!(n in col)) throw new Error(`Falta la columna "${n}" en la maestra`);
    const colPlazo = ['Plazos de Pago', 'Condiciones de pago de cliente'].find(n => n in col);
    const provAnt = {}; Object.values(contactos).flat().forEach(x => { provAnt[x.n] = x.p || ''; });
    const val = (f, n) => (n in col ? (f[col[n]] || '') : '');
    const nuevo = Object.fromEntries(ZONAS_BASE.map(z => [z, []])), sinZona = [];
    filas.slice(1).forEach(f => {
        if (!f.some(Boolean)) return;
        const equipo = val(f, 'Equipo de ventas'), comercial = val(f, 'Comercial'), nombre = val(f, 'Nombre Público');
        if (equipo === 'Empleados' || !nombre) return;
        const zona = (COMERCIAL_ZONA_BASE.find(([n]) => comercial && comercial.toLowerCase().includes(n.toLowerCase())) || [])[1] || (ZONAS_BASE.includes(equipo) ? equipo : null);
        if (!zona) { sinZona.push(nombre); return; }
        const extra = { t: val(f, 'Título'), p: 'Provincia' in col ? val(f, 'Provincia') : provAnt[nombre] || '',
            f: ['true', 'sí', 'si', '1'].includes(val(f, 'Cliente para Facturar').toLowerCase()),
            cl: val(f, 'Categoría de cliente/Clasificación'), ca: val(f, 'Categoría de cliente'), pz: colPlazo ? val(f, colPlazo) : '' };
        const c = { n: nombre, c: val(f, 'Ciudad'), e: val(f, 'Etiquetas') };
        Object.entries(extra).forEach(([k, v]) => { if (v !== '' && v !== false) c[k] = v; });
        c.f = extra.f;   // como en la maestra publicada: "facturar" siempre va, también en falso
        nuevo[zona].push(c);
    });
    ZONAS_BASE.forEach(z => nuevo[z].sort((a, b) => a.n.toLowerCase().localeCompare(b.n.toLowerCase())));
    return { nuevo, sinZona };
}
async function subirContactos() {
    if (!esAdmin()) return;
    const [archivo] = await elegirArchivos();
    if (!archivo) return;
    try {
        const wb = await leerLibro(archivo);
        const { nuevo, sinZona } = contactosDeMaestra(filasHoja(wb.worksheets[0]));
        const antes = {}; Object.entries(contactos).forEach(([z, l]) => l.forEach(x => { antes[x.n] = z; }));
        const despues = {}; Object.entries(nuevo).forEach(([z, l]) => l.forEach(x => { despues[x.n] = z; }));
        const nuevos = Object.keys(despues).filter(n => !(n in antes)).length, retirados = Object.keys(antes).filter(n => !(n in despues)).length;
        const cambios = Object.keys(despues).filter(n => n in antes && antes[n] !== despues[n]).length;
        const total = Object.keys(despues).length;
        if (total < 50) return toast('La maestra trae muy pocos contactos: revisa que sea la Maestra de Contactos de Odoo');
        const resumen = `${total} contactos en ${ZONAS_BASE.length} zonas`;
        if (!await dialogo({ titulo: 'Maestra de contactos', aceptar: 'Subir', cancelar: 'No subir',
            texto: `${total} contactos (${ZONAS_BASE.map(z => `${z}: ${nuevo[z].length}`).join(' · ')}).\nNuevos: ${nuevos} · Retirados: ${retirados} · Cambian de zona: ${cambios}${sinZona.length ? `\nSin zona (no se suben): ${sinZona.length}` : ''}\nReemplaza la lista de contactos de la app para todos los usuarios.` })) return;
        await guardarBaseServidor('contactos', nuevo, resumen);
        toast(`Maestra de contactos actualizada: ${total}`);
    } catch (e) { toast('No se pudo subir la maestra de contactos: ' + e.message); }
}


// ---------- Maestra de Odoo (todo en uno): una sola carga que se reparte a cada base ----------
// Una fila va según su "Equipo de ventas": una zona (Clientes Especiales, Zona Norte, Zona Sur, Zona Desarrollo) → Maestra de contactos y Direcciones;
// "Empleados" → Empleados (privada); cualquier otro (o vacío) → Proveedores (privada). Cada base se reemplaza solo si el archivo trae filas para ella.
const COLUMNAS_ODOO = { n: ['Nombre Público', 'Nombre'], nom: ['Nombre'], ciudad: ['Ciudad'], prov: ['Provincia'], com: ['Comercial'], eq: ['Equipo de ventas'], etq: ['Etiquetas'],
    tit: ['Título'], fac: ['Cliente para Facturar'], cl: ['Categoría de cliente/Clasificación'], ca: ['Categoría de cliente'],
    pz: ['Plazos de Pago', 'Condiciones de pago de cliente'], calle: ['Calle'], tel: ['Teléfono'], mov: ['Móvil'], nit: ['Número de Identificación'] };
function filasOdoo(libros) {
    const filas = [];
    libros.forEach(({ nombre, wb }) => {
        const hoja = filasHoja(wb.worksheets[0]); if (!hoja.length) return;
        const cab = Object.fromEntries(hoja[0].map((t, i) => [t.trim(), i]));
        // Si alguien escribió sobre el título de la primera columna ("Etiquetas"), pero la columna sí trae las etiquetas, se usa igual: sin ella las direcciones de entrega entrarían como clientes
        if (!('Etiquetas' in cab) && /direcci[oó]n (entrega|personal)/i.test(hoja.slice(1, 400).map(f => f[0]).join('|'))) cab['Etiquetas'] = 0;
        const col = k => COLUMNAS_ODOO[k].find(x => x in cab);
        if (!col('n') || !col('ciudad') || !col('eq')) throw new Error(`"${nombre}" no parece la Maestra de Contactos de Odoo: faltan las columnas Nombre Público, Ciudad o Equipo de ventas`);
        hoja.slice(1).forEach(f => {
            if (!f.some(Boolean)) return;
            const o = {}; Object.keys(COLUMNAS_ODOO).forEach(k => { const c = col(k); o[k] = c ? String(f[cab[c]] || '').trim() : ''; });
            if (o.n) filas.push(o);
        });
    });
    return filas;
}
// Odoo trae cada dirección de entrega / personal de un cliente como una fila más (etiqueta "Direccion Entrega" o "Dirección Personal"): no es un contacto,
// es una dirección alterna del cliente. Los empleados se reconocen por el equipo, la etiqueta o la clasificación 80.
const claveOdoo = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tipoDireccionOdoo = o => /direccion (entrega|personal)/.test(claveOdoo(o.etq)) ? (/direccion personal/.test(claveOdoo(o.etq)) ? 'Personal' : 'Entrega') : '';
const tipoFilaOdoo = o => tipoDireccionOdoo(o) ? 'direccion'
    : /emplead/i.test(o.eq) || /(^|[,;\s])empleado/.test(claveOdoo(o.etq)) || o.cl === '80' ? 'empleado'
    : ZONAS_BASE.includes(o.eq) ? 'zona'
    : /usuario odoo/.test(claveOdoo(o.etq)) || (o.eq && !/junta directiva/.test(claveOdoo(o.etq))) ? 'ignorada'   // Ventas Mostrador (consumidor final) y usuarios de Odoo: no se suben
    : 'otro';   // lo demás (proveedores, entidades, junta directiva, sin etiqueta): Proveedores
// Una carga hecha con una versión vieja de la app aplica reglas viejas: antes de subir se comprueba que esta sea la última publicada
async function appAlDia() {
    try {
        const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return true;
        const v = (await r.text()).trim();
        return !v || v === APP_VERSION;
    } catch (e) { return true; }   // sin conexión a la versión: no se bloquea
}
async function subirOdoo() {
    if (!esAdmin()) return;
    if (!await appAlDia()) {
        if (await dialogo({ titulo: 'La app está desactualizada', texto: 'Hay una versión nueva y esta carga usaría reglas viejas (por ejemplo, no pegaría las direcciones de entrega a su cliente). Actualiza y vuelve a subir el archivo.', aceptar: 'Actualizar ahora' })) actualizarApp();
        return;
    }
    const archivos = await elegirArchivos(true);
    if (!archivos.length) return;
    try {
        const libros = []; for (const a of archivos) libros.push({ nombre: a.name, wb: await leerLibro(a) });
        const todas = filasOdoo(libros), vistos = new Set();
        const filas = todas.filter(o => { const k = normalizar(o.n); if (vistos.has(k)) return false; vistos.add(k); return true; });   // un nombre repetido: gana el primero
        let clientes = filas.filter(o => tipoFilaOdoo(o) === 'zona');
        const empleados = filas.filter(o => tipoFilaOdoo(o) === 'empleado'), otros = filas.filter(o => tipoFilaOdoo(o) === 'otro'), ignoradas = filas.filter(o => tipoFilaOdoo(o) === 'ignorada');
        // Direcciones alternas: se pegan al cliente (por el nombre "Cliente, Dirección" y, si no, por el NIT único); la que no tiene cliente y trae zona queda como contacto
        const porNombre = {}, porNit = {};
        clientes.forEach(o => { porNombre[normalizar(o.n)] = o; (porNit[o.nit] = porNit[o.nit] || []).push(o); });
        const altas = [], sinCliente = [];
        filas.filter(o => tipoFilaOdoo(o) === 'direccion').forEach(o => {
            const etiqueta = o.nom && o.nom !== o.n ? o.nom : '';
            let padre = etiqueta && o.n.endsWith(', ' + etiqueta) ? porNombre[normalizar(o.n.slice(0, -(etiqueta.length + 2)))] : null;
            if (!padre && o.nit && (porNit[o.nit] || []).length) { const c = porNit[o.nit].filter(x => !o.com || x.com === o.com), t = c.length ? c : porNit[o.nit]; padre = t.length === 1 ? t[0] : null; /* sin coincidir el comercial, vale el NIT de un solo cliente */ }
            if (padre) altas.push({ o, padre, tipo: tipoDireccionOdoo(o), etiqueta: etiqueta || o.n });
            else if (ZONAS_BASE.includes(o.eq)) { sinCliente.push(o.n); clientes.push(o); }
            else sinCliente.push(o.n);
        });
        const tel = o => [...new Set([o.mov, o.tel].filter(Boolean))].join(' / ');
        const lineas = [];
        let nuevo = null, resumenC = '';
        // Maestra de contactos + Direcciones
        if (clientes.length >= 50) {
            const cab = ['Título', 'Nombre Público', 'Provincia', 'Ciudad', 'Comercial', 'Equipo de ventas', 'Cliente para Facturar', 'Categoría de cliente/Clasificación', 'Categoría de cliente', 'Plazos de Pago', 'Etiquetas'];
            const res = contactosDeMaestra([cab, ...clientes.map(o => [o.tit, o.n, o.prov, o.ciudad, o.com, o.eq, o.fac, o.cl, o.ca, o.pz, o.etq])]);
            nuevo = res.nuevo;
            const total = Object.values(nuevo).reduce((a, l) => a + l.length, 0);
            resumenC = `${total} contactos en ${ZONAS_BASE.length} zonas · ${altas.length} direcciones alternas`;
            const antes = new Set(Object.values(contactos).flat().map(x => x.n)), despues = new Set(Object.values(nuevo).flat().map(x => x.n));
            lineas.push(`Clientes y médicos: ${total} (${ZONAS_BASE.map(z => `${z}: ${nuevo[z].length}`).join(' · ')}) · nuevos ${[...despues].filter(n => !antes.has(n)).length} · retirados ${[...antes].filter(n => !despues.has(n)).length}${res.sinZona.length ? ` · sin zona (no se suben) ${res.sinZona.length}` : ''}`);
            lineas.push(`Direcciones: ${clientes.filter(o => o.calle).length} con dirección y ${clientes.filter(o => tel(o)).length} con teléfono`);
            lineas.push(`Direcciones alternas: ${altas.length} pegadas a su cliente (${altas.filter(a => a.tipo === 'Entrega').length} de entrega · ${altas.filter(a => a.tipo === 'Personal').length} personales)${sinCliente.length ? ` · sin cliente: ${sinCliente.length} (${sinCliente.slice(0, 4).join(', ')}${sinCliente.length > 4 ? '…' : ''})` : ''}`);
        } else if (clientes.length) lineas.push(`Clientes y médicos: solo ${clientes.length} filas de zonas: no se reemplaza la Maestra ni Direcciones (parece un archivo parcial)`);
        else lineas.push('Clientes y médicos: el archivo no trae filas de zonas: se conservan la Maestra y Direcciones');
        // Empleados y Proveedores
        const filasEmp = empleados.map(o => [o.n, o.ciudad, o.prov.replace(/\s*\(CO\)$/, ''), 'Empleado', o.calle, tel(o)]);
        const nits = {}; otros.forEach(o => { nits[normalizar(o.n)] = o.nit; });
        const filasProv = depurarProveedores(otros.map(o => [o.n, o.ciudad, o.prov.replace(/\s*\(CO\)$/, ''), o.etq, o.calle, tel(o)]), nits);
        lineas.push(filasEmp.length ? `Empleados: ${filasEmp.length} (${filasEmp.filter(f => f[4]).length} con dirección) · solo Logística y tú` : 'Empleados: el archivo no trae: se conservan los actuales');
        lineas.push(filasProv.length ? `Proveedores y otros: ${filasProv.length} (${filasProv.filter(f => f[4]).length} con dirección) · solo Logística y tú` : 'Proveedores: el archivo no trae: se conservan los actuales');
        if (ignoradas.length) lineas.push(`No se suben: ${ignoradas.length} (Ventas Mostrador y usuarios de Odoo)`);
        if (!nuevo && !filasEmp.length && !filasProv.length) return toast('No encontré filas para ninguna base: revisa que sea la Maestra de Contactos de Odoo');
        if (!await dialogo({ titulo: 'Maestra de Odoo', aceptar: 'Subir todo', texto: `${filas.length} filas leídas${todas.length !== filas.length ? ` (${todas.length - filas.length} repetidas se ignoran)` : ''}.\n\n${lineas.join('\n')}\n\nCada base reemplaza a la anterior. Empleados y Proveedores no llegan a los comerciales.` })) return;
        const hechos = [];
        if (nuevo) {
            await guardarBaseServidor('contactos', nuevo, resumenC);
            const zonaDe = {}; Object.entries(nuevo).forEach(([z, l]) => l.forEach(x => { zonaDe[x.n] = z; }));
            const dir = clientes.map(o => [o.n, o.ciudad, o.calle, tel(o), zonaDe[o.n] || o.eq, '', ''])
                .concat(altas.map(a => [a.etiqueta, a.o.ciudad, a.o.calle, tel(a.o), zonaDe[a.padre.n] || a.padre.eq, a.padre.n, a.tipo]));
            let cuando = new Date().toISOString();
            if (API_URL) cuando = (await llamarApi({ accion: 'guardarDirectorio', filas: dir }, 90000)).actualizado || cuando;
            ponerDirectorio(dir, cuando);
            hechos.push('Maestra de contactos', 'Direcciones');
        }
        if (filasEmp.length) {
            let cuando = new Date().toISOString();
            if (API_URL) cuando = (await llamarApi({ accion: 'guardarEmpleados', filas: filasEmp }, 90000)).actualizado || cuando;
            ponerEmpleados(filasEmp, cuando); hechos.push('Empleados');
        }
        if (filasProv.length) {
            let cuando = new Date().toISOString();
            if (API_URL) cuando = (await llamarApi({ accion: 'guardarProveedores', filas: filasProv }, 90000)).actualizado || cuando;
            ponerProveedores(filasProv, cuando); hechos.push('Proveedores');
        }
        refrescarBases();
        toast(`Listo: ${hechos.join(', ')}`);
    } catch (e) { toast('No se pudo subir la maestra de Odoo: ' + e.message); }
}

// ---------- Productos (misma lógica que herramientas/productos.py) ----------
const DESPLEGABLES_BASE = ['Nuevo', 'Foco', 'Transición-Impulso', 'Producto Terminado'], CERRADAS_BASE = ['Portafolio', 'Cliente', 'Consultorio'];
const NOMBRES_ETIQUETA = { nuevo: 'Nuevo', foco: 'Foco', transicion: 'Transición-Impulso', 'transicion-impulso': 'Transición-Impulso', 'transicion - impulso': 'Transición-Impulso',
    'transicion impulso': 'Transición-Impulso', portafolio: 'Portafolio', estrategico: 'Estratégico', consultorio: 'Consultorio', cliente: 'Cliente',
    'a descodificar': 'A descodificar', 'en desarrollo': 'En Desarrollo', 'producto terminado': 'Producto Terminado' };
const etiquetasProducto = t => String(t || '').replace(/;/g, ',').split(',').map(x => NOMBRES_ETIQUETA[claveTexto(x)]).filter(Boolean);
function catalogoDeLibros(libros) {
    const productos = [], vistos = new Set(), guia = {};
    libros.forEach(wb => wb.worksheets.forEach(ws => {
        const filas = filasHoja(ws); if (!filas.length) return;
        const cab = filas[0].map(claveTexto);
        if (cab.includes('concepto estrategico')) {   // Guía de etiquetas
            const ie = cab.indexOf('etiqueta'), ic = cab.indexOf('concepto estrategico'), im = cab.findIndex(c => c.includes('mensaje'));
            filas.slice(1).forEach(r => etiquetasProducto(r[ie]).forEach(et => { guia[et] = { concepto: String(r[ic] || '').split(/\s+/).filter(Boolean).join(' '), mensaje: String(r[im] || '').split(/\s+/).filter(Boolean).join(' ') }; }));
            return;
        }
        if (!cab.includes('referencia interna')) return;
        const col = n => cab.indexOf(n), ic = col('referencia interna'), inn = col('nombre'), ie = col('etiquetas de producto'), inu = col('nueva etiqueta'), ia = col('activo(a)'), ig = col('grupo de producto');
        filas.slice(1).forEach(r => {
            const cod = String(r[ic] || '').trim();
            if (!cod || vistos.has(cod) || (ia >= 0 && ['false', '0', 'no'].includes(claveTexto(r[ia])))) return;
            const nueva = inu >= 0 ? r[inu] : '';
            vistos.add(cod);
            productos.push({ c: cod, n: String(r[inn] || '').split(/\s+/).filter(Boolean).join(' '),
                e: etiquetasProducto(String(nueva || '').trim() ? nueva : ie >= 0 ? r[ie] : ''),
                g: ig >= 0 ? String(r[ig] || '').trim() : cod.startsWith('PT') ? 'Producto Terminado' : 'Magistral de Pedido' });
        });
    }));
    productos.sort((a, b) => claveTexto(a.n).localeCompare(claveTexto(b.n)));
    return { desplegables: DESPLEGABLES_BASE, cerradas: CERRADAS_BASE, productos, guia };
}
// Cada archivo trae su familia: Base_Productos las materias primas (MP) y Productos_Terminados los terminados (PT).
// Lo que se sube reemplaza solo su familia; lo demás del catálogo se conserva (así se puede subir un archivo solo).
const familiaProducto = c => String(c).startsWith('PT') ? 'PT' : 'MP';
const NOMBRE_FAMILIA = { PT: 'Productos terminados', MP: 'Materias primas' };
async function subirCatalogo() {
    if (!esAdmin()) return;
    const archivos = await elegirArchivos(true);
    if (!archivos.length) return;
    try {
        const libros = []; for (const a of archivos) libros.push(await leerLibro(a));
        const leido = catalogoDeLibros(libros);
        if (!leido.productos.length) return toast('No encontré productos: el archivo debe tener la columna "Referencia Interna" (Base_Productos o Productos_Terminados)');
        const familias = new Set(leido.productos.map(p => familiaProducto(p.c)));
        const conservados = CATALOGO.productos.filter(p => !familias.has(familiaProducto(p.c)));
        const productos = [...conservados, ...leido.productos].sort((a, b) => claveTexto(a.n).localeCompare(claveTexto(b.n)));
        const d = { desplegables: DESPLEGABLES_BASE, cerradas: CERRADAS_BASE, productos, guia: Object.keys(leido.guia).length ? leido.guia : CATALOGO.guia || {} };
        const cuenta = {}; d.productos.forEach(p => p.e.forEach(e => { cuenta[e] = (cuenta[e] || 0) + 1; }));
        const linea = f => `${NOMBRE_FAMILIA[f]}: ${d.productos.filter(p => familiaProducto(p.c) === f).length} (antes ${CATALOGO.productos.filter(p => familiaProducto(p.c) === f).length})${familias.has(f) ? ' · se reemplazan' : ' · se conservan'}`;
        const resumen = `${d.productos.length} productos`;
        if (!await dialogo({ titulo: 'Productos', aceptar: 'Subir', cancelar: 'No subir',
            texto: `${linea('MP')}\n${linea('PT')}\nTotal: ${d.productos.length} productos. ${[...DESPLEGABLES_BASE, ...CERRADAS_BASE].map(c => `${c}: ${cuenta[c] || 0}`).join(' · ')}\nReemplaza el catálogo de la app para todos los usuarios.` })) return;
        await guardarBaseServidor('catalogo', d, resumen);
        toast(`Productos actualizados: ${d.productos.length}`);
    } catch (e) { toast('No se pudo subir el catálogo de productos: ' + e.message); }
}

// ---------- Descargar copia (respaldo en Excel, sin líneas de cuadrícula; se puede volver a subir tal cual) ----------
const hoyArchivo = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).replace(/-/g, '');
function hojaTabla(wb, nombre, titulos, filas, anchos) {
    const ws = wb.addWorksheet(nombre, { views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }] });
    ws.addRow(titulos);
    filas.forEach(f => ws.addRow(f));
    ws.columns.forEach((c, i) => { c.width = (anchos && anchos[i]) || 22; });
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF4' } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: titulos.length } };
    return ws;
}
async function bajarLibro(wb, nombre) {
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `${nombre}_${hoyArchivo()}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function descargarBase(k) {
    if (!esAdmin()) return;
    try {
        await cargarExcelJS();
        const wb = new ExcelJS.Workbook();
        let nombre, cuenta;
        if (k === 'odoo') {
            if (API_URL) { try { const r = await llamarApi({ accion: 'directorio' }); ponerDirectorio(r.filas || [], r.actualizado); } catch (e) { /* queda lo que hay en el teléfono */ } }
            const filas = [];
            Object.entries(contactos).forEach(([z, l]) => l.forEach(x => { const d = directorio.filas[normalizar(x.n)] || {};
                filas.push([x.e || 'Cliente', x.n, x.c || d.c || '', x.p || '', d.dir || '', d.tel || '', z, x.cl || '', x.ca || '', x.pz || '']); }));
            Object.entries(directorio.alt || {}).forEach(([padre, l]) => l.forEach(a => {
                const p = Object.values(contactos).flat().find(x => normalizar(x.n) === padre);
                filas.push([a.tipo === 'Personal' ? 'Dirección Personal' : 'Direccion Entrega', (p ? p.n + ', ' : '') + a.n, a.c || '', '', a.dir || '', a.tel || '', a.z || '', '', '', '']); }));
            Object.values(empleadosMaestra.filas).forEach(x => filas.push(['Empleado', x.n, x.c || '', x.p || '', x.dir || '', x.tel || '', 'Empleados', '', '', '']));
            Object.values(proveedoresMaestra.filas).forEach(x => filas.push([x.e || 'Proveedor', x.n, x.c || '', x.p || '', x.dir || '', x.tel || '', '', '', '', '']));
            hojaTabla(wb, 'Maestra Odoo', ['Etiquetas', 'Nombre Público', 'Ciudad', 'Provincia', 'Calle', 'Teléfono', 'Equipo de ventas', 'Categoría de cliente/Clasificación', 'Categoría de cliente', 'Plazos de Pago'],
                filas, [28, 44, 18, 18, 45, 22, 20, 28, 24, 18]);
            nombre = 'Maestra_Odoo'; cuenta = filas.length;
        } else if (k === 'contactos') {
            const filas = [];
            Object.entries(contactos).forEach(([z, l]) => l.forEach(x => filas.push([x.n, x.c || '', x.e || '', z, '', x.t || '', x.p || '', x.f ? 'Sí' : 'No', x.cl || '', x.ca || '', x.pz || ''])));
            hojaTabla(wb, 'Contactos', ['Nombre Público', 'Ciudad', 'Etiquetas', 'Equipo de ventas', 'Comercial', 'Título', 'Provincia', 'Cliente para Facturar',
                'Categoría de cliente/Clasificación', 'Categoría de cliente', 'Plazos de Pago'], filas, [40, 18, 30, 20, 18, 12, 18, 14, 28, 22, 18]);
            nombre = 'Maestra_Contactos'; cuenta = filas.length;
        } else if (k === 'homologos') {
            const h = await homologosActuales();
            if (!h?.items?.length) return toast('Aún no has subido los homólogos: no hay nada para descargar');
            const maestro = await maestroActual(), porRef = Object.fromEntries(maestro.map(x => [x['Referencia Interna'], x]));
            const nombres = await nombresClientes();
            const filas = h.items.map(i => { const m = porRef[i.r] || {}; return [m['Grupo de Producto'] ?? '', m['Categoría del Producto'] ?? '', m['Etiquetas de producto'] ?? '', i.r, m['Nombre'] ?? '', nombres[i.h] || i.h, i.n]; });
            hojaTabla(wb, 'Homologos', ['Grupo de Producto', 'Categoría del Producto', 'Etiquetas de producto', 'Referencia Interna', 'Nombre', 'Product Counterpart/Cliente', 'Product Counterpart/Nombre'], filas, [20, 38, 20, 16, 40, 40, 44]);
            nombre = 'Homologos'; cuenta = filas.length;
        } else if (k === 'productoterminado') {
            let lista = [];
            if (API_URL) { try { const r = await llamarApi({ accion: 'vademecumProductoTerminado' }, 60000); lista = r.productoterminado || []; } catch (e) { /* sin copia */ } }
            if (!lista.length) lista = leerBaseLocal('productoterminado')?.d || [];
            if (!lista.length) return toast('Aún no has subido el Producto Terminado desde aquí: no hay nada para descargar');
            hojaTabla(wb, 'Producto Terminado', COLS_VADE, lista.map(p => COLS_VADE.map(c => p[c] ?? '')), [14, 50, 22, 34, 18, 22, 9, 8, 60, 70, 50, 20]);
            nombre = 'Vademecum_Producto_Terminado'; cuenta = lista.length;
        } else if (k === 'materiasprimas') {
            const lista = await materiasPrimasActuales();
            if (!lista.length) return toast('Aún no has subido las materias primas desde aquí: no hay nada para descargar');
            hojaTabla(wb, 'Vademecum Materias Primas', COLS_MP_ARCHIVO, lista.map(m => COLS_MP_ARCHIVO.map(c => m[CLAVE_MP[c]] ?? '')), [16, 30, 55, 40, 28, 28, 28]);
            nombre = 'Vademecum_Materias_Primas'; cuenta = lista.length;
        } else if (k === 'catalogo') {
            const ps = CATALOGO.productos;
            hojaTabla(wb, 'Productos', ['Referencia Interna', 'Nombre', 'Etiquetas de producto', 'Grupo de Producto'], ps.map(p => [p.c, p.n, (p.e || []).join(', '), p.g || '']), [20, 60, 30, 24]);
            const g = Object.entries(CATALOGO.guia || {});
            if (g.length) hojaTabla(wb, 'Guía de Etiquetas', ['Etiqueta', 'Concepto Estratégico', 'Mensaje Comercial'], g.map(([e, v]) => [e, v.concepto || '', v.mensaje || '']), [22, 50, 70]);
            nombre = 'Productos'; cuenta = ps.length;
        } else if (k === 'proveedores') {
            const filas = Object.values(proveedoresMaestra.filas).map(x => [x.n, x.n, x.p || '', x.c || '', x.dir || '', x.tel || '', x.e || '']);
            hojaTabla(wb, 'Proveedores', ['Nombre Público', 'Nombre', 'Provincia', 'Ciudad', 'Calle', 'Teléfono', 'Etiquetas'], filas, [40, 40, 18, 18, 40, 20, 30]);
            nombre = 'Proveedores'; cuenta = filas.length;
        } else if (k === 'empleados') {
            const filas = Object.values(empleadosMaestra.filas).map(x => [x.n, x.n, x.p || '', x.c || '', x.dir || '', x.tel || '', 'Empleados']);
            hojaTabla(wb, 'Empleados', ['Nombre Público', 'Nombre', 'Provincia', 'Ciudad', 'Calle', 'Teléfono', 'Equipo de ventas'], filas, [40, 40, 18, 18, 40, 20, 18]);
            nombre = 'Empleados'; cuenta = filas.length;
        } else if (k === 'directorio') {
            if (API_URL) { try { const r = await llamarApi({ accion: 'directorio' }); ponerDirectorio(r.filas || [], r.actualizado); } catch (e) { /* queda lo que hay en el teléfono */ } }
            const filas = Object.values(directorio.filas).map(x => [x.n || '', x.c || '', x.dir || '', x.tel || '', x.z || '']);
            if (filas.some(f => !f[0])) return toast('Falta el nombre en el directorio guardado: vuelve a sincronizar e inténtalo de nuevo');
            hojaTabla(wb, 'Direcciones', ['Nombre Público', 'Ciudad', 'Calle', 'Teléfono', 'Equipo de ventas'], filas, [40, 18, 45, 24, 20]);
            nombre = 'Direcciones'; cuenta = filas.length;
        } else if (k === 'vademecum') {
            const t = await descargarVademecum();
            if (!t) return toast('Aún no has subido el Vademécum desde aquí: no hay nada para descargar');
            return toast('Copia descargada: ' + t);
        } else return;
        if (!cuenta) return toast('Esta base aún no tiene registros para descargar');
        await bajarLibro(wb, nombre);
        toast(`Copia descargada: ${cuenta} registros`);
    } catch (e) { toast('No se pudo descargar la copia: ' + e.message); }
}

// ---------- Vademécum: productos y portafolios por cliente (el Vademécum los lee del servidor) ----------
const URL_INDICE_VADEMECUM = 'https://epitheliumsa.github.io/vademecum-epithelium/portafolios-index.json';
const COLS_VADE = ['Referencia Interna', 'Nombre', 'Grupo de Producto', 'Categoría del Producto', 'Forma Farmacéutica', 'Presentación Farmacéutica', 'Tamaño', 'Masa',
    'Componentes', 'Indicación', 'Dosis Recomendada', 'Etiquetas de producto'];
// Filas de una hoja como productos del Vademécum (mismas llaves que data.json); extra = columnas adicionales (Cliente, Zona)
function productosVademecum(filas, extra = []) {
    const cab = filas[0].map(x => x.trim()), col = Object.fromEntries(cab.map((n, i) => [n, i]));
    for (const n of [...COLS_VADE, ...extra]) if (!(n in col)) throw new Error(`Falta la columna "${n}"`);
    return filas.slice(1).filter(f => f[col['Referencia Interna']]).map(f => {
        const o = Object.fromEntries(COLS_VADE.map(n => [n, f[col[n]] ?? '']));
        if (o['Tamaño'] !== '' && !isNaN(Number(o['Tamaño']))) o['Tamaño'] = Number(o['Tamaño']);
        return { o, f, col };
    });
}
const encabezadoLibro = wb => filasHoja(wb.worksheets[0])[0]?.map(x => x.trim()) || [];
async function subirVademecum() {
    if (!esAdmin()) return;
    const archivos = await elegirArchivos(true);
    if (!archivos.length) return;
    try {
        let maestro = null, clientes = null;
        for (const a of archivos) {
            const wb = await leerLibro(a), cab = encabezadoLibro(wb);
            if (!cab.includes('Referencia Interna')) throw new Error(`"${a.name}" no tiene la columna "Referencia Interna": sube Vademecum_Epithelium y/o Vademecum_clientes`);
            const filas = filasHoja(wb.worksheets[0]);
            if (cab.includes('Cliente')) clientes = productosVademecum(filas, ['Cliente', 'Zona de Vendedor']);
            else maestro = productosVademecum(filas).map(x => x.o);
        }
        if (maestro && maestro.length < 100) return toast('El Vademécum trae muy pocos productos: revisa que sea Vademecum_Epithelium');
        if (maestro && new Set(maestro.map(p => p['Referencia Interna'])).size !== maestro.length) return toast('Hay referencias repetidas en Vademecum_Epithelium: revísalas antes de subir');
        const bases = [], lineas = [];
        let resumen = '';
        if (maestro) {
            bases.push({ nombre: 'vademecum', contenido: JSON.stringify(maestro), resumen: `${maestro.length} productos` });
            lineas.push(`Productos: ${maestro.length}`);
        }
        let sinAcceso = [];
        if (clientes) {
            let indice;
            try { const r = await fetch(URL_INDICE_VADEMECUM, { cache: 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status); indice = await r.json(); }
            catch (e) { return toast('No pude traer la lista de clientes del Vademécum: revisa la conexión e inténtalo de nuevo'); }
            const huella = Object.fromEntries(indice.map(x => [x.cliente, x.huella]));
            const por = {};
            clientes.forEach(({ o, f, col }) => { const c = f[col['Cliente']]; (por[c] ||= { cliente: c, zona: f[col['Zona de Vendedor']] || '', productos: [] }).productos.push(o); });
            Object.values(por).forEach(c => { if (huella[c.cliente]) bases.push({ nombre: 'pf_' + huella[c.cliente], contenido: JSON.stringify(c), resumen: '' }); else sinAcceso.push(c.cliente); });
            const n = bases.filter(b => b.nombre !== 'vademecum').length;
            if (!n) return toast('Ningún cliente del archivo está en la lista del Vademécum');
            lineas.push(`Portafolios de clientes: ${n}${sinAcceso.length ? ` (sin acceso configurado, no se suben: ${sinAcceso.join(', ')})` : ''}`);
        }
        resumen = [maestro && `${maestro.length} productos`, clientes && `${bases.filter(b => b.nombre !== 'vademecum').length} portafolios`].filter(Boolean).join(' · ');
        if (!await dialogo({ titulo: 'Vademécum', aceptar: 'Subir', cancelar: 'No subir',
            texto: `${lineas.join('\n')}\n${maestro ? '' : 'Los productos no cambian (no subiste Vademecum_Epithelium).\n'}${clientes ? '' : 'Los portafolios no cambian (no subiste Vademecum_clientes).\n'}Reemplaza lo que lee el Vademécum.` })) return;
        bases[0].resumen = resumen;
        let cuando = new Date().toISOString();
        if (API_URL) cuando = (await llamarApi({ accion: 'guardarBases', bases, borrarPortafolios: !!clientes }, 180000)).actualizado || cuando;
        estadoBases.vademecum = { actualizado: cuando, resumen };
        refrescarBases();
        toast('Vademécum actualizado: ' + resumen);
    } catch (e) { toast('No se pudo subir el Vademécum: ' + e.message); }
}
// ---------- Materias primas: archivo → categorización → Vademécum ----------
const COLS_MP_ARCHIVO = ['Referencia Interna', 'Nombre', 'Componentes', 'Indicación', 'Dosis Recomendada', 'Categoria Principal', 'Categoria Secundaria'];
// Columna del archivo → llave con la que el Vademécum guarda cada materia prima
const CLAVE_MP = { 'Referencia Interna': 'Referencia Interna', 'Nombre': 'Nombre', 'Componentes': 'Identificación Técnica', 'Indicación': 'Uso Terapéutico y Cosmético',
    'Dosis Recomendada': 'Concentración de Uso', 'Categoria Principal': 'Categoria Principal', 'Categoria Secundaria': 'Categoria Secundaria' };
const ALIAS_MP = { 'identificacion tecnica': 'Componentes', 'uso terapeutico y cosmetico': 'Indicación', 'concentracion de uso': 'Dosis Recomendada', 'indicacion': 'Indicación',
    'categoria principal': 'Categoria Principal', 'categoria secundaria': 'Categoria Secundaria' };
const CATEGORIAS_MP = ['Acné', 'Rosácea', 'Corticoides', 'Antibióticos Tópicos', 'Cicatrizantes - Reparadores', 'Anestésicos Tópicos', 'Antivirales Dermatológicos', 'Queratolíticos - Exfoliantes',
    'Antiparasitarios', 'Protectores Solares', 'Vitaminas', 'Capilares', 'Shampoo Magistrales', 'Ungueales', 'Desodorantes - Antitranspirantes', 'Limpiadores Magistrales', 'Despigmentantes',
    'Hidratantes', 'Antienvejecimiento', 'Antiestrias', 'Excipientes'];
// Sugerencia para las que llegan sin categoría: puntúa por el uso terapéutico (la persona la confirma o cambia)
const REGLAS_MP = [
    ['Excipientes', /emulsionante|espesante|conservante|vehiculo|solvente|disolvente|quelante|regulador de ph|fragancia|colorante|excipiente|capsula|antioxidante de la formula/],
    ['Corticoides', /corticoide|corticosteroide|antiinflamatorio esteroideo|mometasona|clobetasol|betametasona|hidrocortisona|desonida|triamcinolona/],
    ['Antibióticos Tópicos', /antibiotico|antibacteri|clindamicina|eritromicina|mupirocina|acido fusidico|metronidazol/],
    ['Antivirales Dermatológicos', /antiviral|herpes|verruga|molusco|aciclovir|imiquimod/],
    ['Antiparasitarios', /antiparasit|escabiosis|sarna|pediculosis|piojo|permetrina|ivermectina|azufre/],
    ['Anestésicos Tópicos', /anestesic|lidocaina|benzocaina|tetracaina|prilocaina|analgesic/],
    ['Protectores Solares', /fotoprote|filtro solar|protector solar|uva|uvb|spf/],
    ['Rosácea', /rosacea/],
    ['Acné', /acne|comedon|seborre|sebo\b|poro/],
    ['Ungueales', /ungueal|onicomicosis|\buna\b|unas\b/],
    ['Capilares', /capilar|alopecia|caida del cabello|cuero cabelludo|cabello/],
    ['Desodorantes - Antitranspirantes', /antitranspirante|hiperhidrosis|desodorante|sudor/],
    ['Antiestrias', /estria/],
    ['Despigmentantes', /despigment|melasma|hiperpigment|mancha|tirosinasa|aclarante/],
    ['Queratolíticos - Exfoliantes', /queratolitic|exfoliante|exfoliacion|peeling|hiperqueratosis|queratosis/],
    ['Cicatrizantes - Reparadores', /cicatriz|reparador|regenerad|heridas|quemadura|epiteliz/],
    ['Antienvejecimiento', /antienvejec|arruga|antiedad|envejecimiento|colageno|firmeza|rejuvenec/],
    ['Vitaminas', /vitamina/],
    ['Hidratantes', /hidratante|humectante|emoliente|barrera cutanea|xerosis/]
];
function sugerirCategoriaMP(m) {
    const t = claveTexto([m['Nombre'], m['Identificación Técnica'], m['Uso Terapéutico y Cosmético']].join(' '));
    const puntos = REGLAS_MP.map(([c, re]) => [c, (t.match(new RegExp(re.source, 'g')) || []).length]).filter(x => x[1]);
    puntos.sort((a, b) => b[1] - a[1]);
    return puntos.length ? puntos[0][0] : '';
}
// Lo que hay hoy (servidor; en pruebas, lo último que se subió en este navegador)
async function materiasPrimasActuales() {
    if (API_URL) { try { const r = await llamarApi({ accion: 'vademecumMateriasPrimas' }, 60000); if (Array.isArray(r.materiasprimas) && r.materiasprimas.length) return r.materiasprimas; } catch (e) { /* sin copia anterior */ } }
    return leerBaseLocal('materiasprimas')?.d || [];
}
function leerMateriasPrimas(libro) {
    const ws = libro.worksheets.find(w => filasHoja(w)[0]?.map(claveTexto).includes('referencia interna'));
    if (!ws) throw new Error('No encontré la hoja con la columna "Referencia Interna"');
    const f = filasHoja(ws), cab = f[0].map(x => ALIAS_MP[claveTexto(x)] || x.trim()), col = Object.fromEntries(cab.map((n, i) => [n, i]));
    for (const n of ['Referencia Interna', 'Nombre', 'Componentes', 'Indicación', 'Dosis Recomendada']) if (!(n in col)) throw new Error(`Falta la columna "${n}"`);
    return f.slice(1).filter(r => String(r[col['Referencia Interna']] || '').trim()).map(r => {
        const m = {};
        COLS_MP_ARCHIVO.forEach(c => { const v = c in col ? String(r[col[c]] ?? '').replace(/[ \t]+\n/g, '\n').trim() : ''; m[CLAVE_MP[c]] = c === 'Nombre' ? v.split(/\s+/).filter(Boolean).join(' ') : v; });
        return m;
    });
}
// Pantalla de categorización: una fila por cada materia que quedó sin categoría
function categorizarMateriasPrimas(pend) {
    return new Promise(resolve => {
        const opciones = (sel, vacio) => `<option value="">${vacio}</option>` + CATEGORIAS_MP.map(c => `<option${c === sel ? ' selected' : ''}>${esc(c)}</option>`).join('');
        abrirModal(`<div class="form-rc"><h2>Categorizar materias primas</h2>
            <p>${pend.length} materia${pend.length === 1 ? '' : 's'} prima${pend.length === 1 ? '' : 's'} sin categoría. Dejé una sugerencia según su uso: confírmala o cámbiala. La categoría principal define el color.</p>
            <div style="max-height:55vh;overflow:auto">${pend.map((m, i) => `<div style="border-bottom:1px solid #e2e6ea;padding:8px 0">
                <label style="float:right;font-size:.85em;white-space:nowrap"><input type="checkbox" class="mp-omitir" data-i="${i}"> No subir</label>
                <b>${esc(m['Referencia Interna'])} · ${esc(m['Nombre'])}</b>
                <div style="font-size:.85em;color:#555;margin:2px 0 6px">${esc((m['Uso Terapéutico y Cosmético'] || '').slice(0, 160))}</div>
                <select class="mp-cat" data-i="${i}" style="width:100%;margin-bottom:4px">${opciones(sugerirCategoriaMP(m), 'Elige la categoría principal…')}</select>
                <select class="mp-cat2" data-i="${i}" style="width:100%">${opciones('', 'Categoría secundaria (opcional)')}</select></div>`).join('')}</div>
            <div class="form-botones"><button type="button" class="btn-secundario" id="mpCancelar">No subir</button><button type="button" class="btn-primario" id="mpGuardar">Categorizar y continuar</button></div></div>`);
        const omitir = [...document.querySelectorAll('.mp-omitir')];
        omitir.forEach((c, i) => { c.onchange = () => { const f = c.closest('div'); f.style.opacity = c.checked ? '.45' : ''; f.querySelectorAll('select').forEach(x => { x.disabled = c.checked; }); }; });
        $('mpCancelar').onclick = () => { cerrarModal(); resolve(false); };
        $('mpGuardar').onclick = () => {
            const pr = [...document.querySelectorAll('.mp-cat')], se = [...document.querySelectorAll('.mp-cat2')];
            if (pr.some((x, i) => !omitir[i].checked && !x.value)) return toast('Falta elegir la categoría principal (o marca "No subir" en las que no quieras subir)');
            pr.forEach((x, i) => { if (omitir[i].checked) { pend[i].__omitir = true; return; } pend[i]['Categoria Principal'] = x.value; pend[i]['Categoria Secundaria'] = se[i].value && se[i].value !== x.value ? se[i].value : ''; });
            cerrarModal(); resolve(true);
        };
    });
}
async function subirMateriasPrimas() {
    if (!esAdmin()) return;
    const [archivo] = await elegirArchivos(false);
    if (!archivo) return;
    try {
        const lista = leerMateriasPrimas(await leerLibro(archivo));
        if (lista.length < 50) return toast('El archivo trae muy pocas materias primas: revisa que sea el Vademecum de Materias Primas');
        if (new Set(lista.map(m => m['Referencia Interna'])).size !== lista.length) return toast('Hay referencias repetidas en el archivo: revísalas antes de subir');
        const previo = Object.fromEntries((await materiasPrimasActuales()).map(m => [m['Referencia Interna'], m]));
        const valida = c => CATEGORIAS_MP.includes(c);
        let heredadas = 0;
        lista.forEach(m => {
            if (valida(m['Categoria Principal'])) return;
            const antes = previo[m['Referencia Interna']];
            if (antes && valida(antes['Categoria Principal'])) { m['Categoria Principal'] = antes['Categoria Principal']; m['Categoria Secundaria'] = valida(m['Categoria Secundaria']) ? m['Categoria Secundaria'] : antes['Categoria Secundaria'] || ''; heredadas++; }
            else m['Categoria Principal'] = '';
        });
        lista.forEach(m => { if (!valida(m['Categoria Secundaria']) || m['Categoria Secundaria'] === m['Categoria Principal']) m['Categoria Secundaria'] = ''; });
        const pend = lista.filter(m => !m['Categoria Principal']);
        if (pend.length && !await categorizarMateriasPrimas(pend)) return;
        // Las marcadas "No subir" no entran: si ya existían se queda como estaba, si eran nuevas no se agregan
        const omitidas = lista.filter(m => m.__omitir).length;
        for (let i = lista.length - 1; i >= 0; i--) if (lista[i].__omitir) { const antes = previo[lista[i]['Referencia Interna']]; if (antes) lista[i] = antes; else lista.splice(i, 1); }
        const nuevas = lista.filter(m => !previo[m['Referencia Interna']]).length, quitadas = Object.keys(previo).filter(r => !lista.some(m => m['Referencia Interna'] === r)).length;
        const porCat = {}; lista.forEach(m => { porCat[m['Categoria Principal']] = (porCat[m['Categoria Principal']] || 0) + 1; });
        if (!await dialogo({ titulo: 'Materias primas', aceptar: 'Subir', cancelar: 'No subir',
            texto: `${lista.length} materias primas${Object.keys(previo).length ? ` (antes ${Object.keys(previo).length}: ${nuevas} nuevas, ${quitadas} que ya no vienen)` : ''}\nCategorizadas ahora: ${pend.length - omitidas} · con la categoría que ya tenían: ${heredadas}${omitidas ? ` · sin subir: ${omitidas}` : ''}\n${CATEGORIAS_MP.filter(c => porCat[c]).map(c => `${c}: ${porCat[c]}`).join(' · ')}\nReemplaza lo que ve el Vademécum.` })) return;
        await guardarBaseServidor('materiasprimas', lista, `${lista.length} materias primas`);
        toast(`Materias primas actualizadas: ${lista.length}`);
    } catch (e) { toast('No se pudo subir las materias primas: ' + e.message); }
}

// Cliente de la categoría → cliente de la lista del Vademécum: nombre igual (sin puntuación) o, si no, el único que el otro nombre contiene
const claveCliente = t => claveTexto(t).replace(/[^a-z0-9&]+/g, ' ').trim();
function clienteDelIndice(nom, indice, porNombre) {
    const k = claveCliente(nom); if (!k) return null;
    const exacto = indice.find(x => claveCliente(x.cliente) === k); if (exacto) return exacto;
    const cerca = indice.filter(x => { const c = claveCliente(x.cliente); return c && (k.startsWith(c + ' ') || c.startsWith(k + ' ')); });
    return cerca.length === 1 ? cerca[0] : null;
}
// ---------- Productos y Vademécum en una sola subida ----------
// Los dos archivos de Odoo (Producto Terminado y Magistrales) traen la misma estructura. Cada fila se reparte por su referencia:
// PT → catálogo de visitas; MP → catálogo + Vademécum (lo que no es Cliente) y portafolios (etiqueta Cliente, categoría "Magistral de Pedido / cliente").
async function subirProductosTodo(soloPT = false) {
    if (!esAdmin()) return;
    const archivos = await elegirArchivos(true);
    if (!archivos.length) return;
    try {
        const libros = []; for (const a of archivos) libros.push(await leerLibro(a));
        const leido = catalogoDeLibros(libros);
        if (soloPT) leido.productos = leido.productos.filter(p => familiaProducto(p.c) === 'PT');
        if (!leido.productos.length) return toast(soloPT ? 'No encontré productos terminados (referencias PT…) en el archivo' : 'No encontré productos: los archivos deben tener la columna "Referencia Interna"');
        // Filas completas (columnas del Vademécum); lo que el archivo no trae (Masa) sale del nombre o de lo que ya había
        let previo = {};
        if (API_URL) { try { ((await llamarApi({ accion: 'leerVademecum' }, 120000)).productos || []).forEach(x => { previo[x['Referencia Interna']] = x; }); } catch (e) { /* sin copia anterior */ } }
        const filasVade = [];
        libros.forEach(wb => wb.worksheets.forEach(ws => {
            const f = filasHoja(ws); if (!f.length || !f[0].map(claveTexto).includes('referencia interna')) return;
            const cab = f[0].map(x => x.trim()), col = Object.fromEntries(cab.map((n, i) => [n, i]));
            if (!('Nombre' in col)) throw new Error('Al archivo le falta la columna "Nombre"');
            const inu = cab.findIndex(x => claveTexto(x) === 'nueva etiqueta'), ia = cab.findIndex(x => claveTexto(x) === 'activo(a)');
            f.slice(1).filter(r => String(r[col['Referencia Interna']] || '').trim()).forEach(r => {
                if (ia >= 0 && ['false', '0', 'no'].includes(claveTexto(r[ia]))) return;
                const o = Object.fromEntries(COLS_VADE.map(n => [n, n in col ? String(r[col[n]] ?? '').trim() : '']));
                o['Referencia Interna'] = String(o['Referencia Interna']).trim();
                o['Nombre'] = o['Nombre'].split(/\s+/).filter(Boolean).join(' ');
                if (o['Tamaño'] !== '' && !isNaN(Number(o['Tamaño']))) o['Tamaño'] = Number(o['Tamaño']);
                if (inu >= 0 && String(r[inu] || '').trim()) o['Etiquetas de producto'] = r[inu];
                if (!o['Masa']) o['Masa'] = (o['Nombre'].match(/\bx\s*[\d.,]+\s*(ml|g|mg|kg|l)\b/i) || [])[1]?.toLowerCase() || previo[o['Referencia Interna']]?.['Masa'] || '';
                if (!soloPT || familiaProducto(o['Referencia Interna']) === 'PT') filasVade.push(o);
            });
        }));
        const familias = new Set(leido.productos.map(p => familiaProducto(p.c)));
        const conservados = CATALOGO.productos.filter(p => !familias.has(familiaProducto(p.c)));
        const productos = [...conservados, ...leido.productos].sort((a, b) => claveTexto(a.n).localeCompare(claveTexto(b.n)));
        const catalogo = { desplegables: DESPLEGABLES_BASE, cerradas: CERRADAS_BASE, productos, guia: Object.keys(leido.guia).length ? leido.guia : CATALOGO.guia || {} };
        const terminados = filasVade.filter(o => familiaProducto(o['Referencia Interna']) === 'PT');
        const esCliente = o => etiquetasProducto(o['Etiquetas de producto']).includes('Cliente');
        const mp = filasVade.filter(o => familiaProducto(o['Referencia Interna']) === 'MP');
        const maestro = mp.filter(o => !esCliente(o));
        const delCliente = mp.filter(o => esCliente(o));
        if (mp.length && maestro.length < 100) return toast('Los magistrales traen muy pocos productos: revisa que sea el archivo completo');
        if (new Set(maestro.map(o => o['Referencia Interna'])).size !== maestro.length) return toast('Hay referencias repetidas en los magistrales: revísalas antes de subir');
        const lineas = [`Catálogo de visitas: ${productos.length} productos (${[...familias].map(f => NOMBRE_FAMILIA[f].toLowerCase()).join(' y ')} se reemplazan)`];
        const bases = [{ nombre: 'catalogo', contenido: JSON.stringify(catalogo), resumen: `${productos.length} productos` }];
        if (terminados.length) {
            if (new Set(terminados.map(o => o['Referencia Interna'])).size !== terminados.length) return toast('Hay referencias repetidas en Producto Terminado: revísalas antes de subir');
            bases.push({ nombre: 'productoterminado', contenido: JSON.stringify(terminados), resumen: `${terminados.length} productos` });
            lineas.push(`Vademécum Producto Terminado: ${terminados.length} productos`);
        }
        let resumenV = '';
        if (mp.length) {
            bases.push({ nombre: 'vademecum', contenido: JSON.stringify(maestro), resumen: `${maestro.length} productos` });
            lineas.push(`Vademécum: ${maestro.length} productos`);
            resumenV = `${maestro.length} productos`;
        }
        let sinAcceso = [], nPf = 0;
        if (delCliente.length) {
            let indice;
            try { const r = await fetch(URL_INDICE_VADEMECUM, { cache: 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status); indice = await r.json(); }
            catch (e) { return toast('No pude traer la lista de clientes del Vademécum: revisa la conexión e inténtalo de nuevo'); }
            const porNombre = Object.fromEntries(indice.map(x => [claveTexto(x.cliente), x])), por = {};
            delCliente.forEach(o => {
                const cat = String(o['Categoría del Producto'] || ''), nom = cat.includes(' / ') ? cat.split(' / ').slice(1).join(' / ').trim() : '';
                const x = clienteDelIndice(nom, indice, porNombre);
                if (!x) { if (nom && !sinAcceso.includes(nom)) sinAcceso.push(nom); return; }
                (por[x.huella] ||= { cliente: x.cliente, zona: x.zona || '', productos: [] }).productos.push(o);
            });
            // Además de sus productos propios (etiqueta Cliente), cada portafolio conserva los productos de Epithelium que ya tenía asignados,
            // con los datos vigentes del maestro (se cruzan por Referencia Interna)
            const maestroPorRef = Object.fromEntries(maestro.map(o => [o['Referencia Interna'], o]));
            let conservados = 0;
            const guardados = await homologosActuales();
            const homPorCliente = {}; (guardados?.items || []).forEach(i => { (homPorCliente[i.h] ||= []).push(i); });
            await Promise.all(Object.entries(por).map(async ([h, c]) => {
                if (guardados?.items) {   // los homólogos guardados en Bases de datos mandan: el cliente tiene sus propios más los que lleva con otro nombre
                    (homPorCliente[h] || []).forEach(i => { const x = productoHomologo(maestroPorRef, i); if (x && !c.productos.some(y => y['Referencia Interna'] === x['Referencia Interna'] && claveTexto(y['Nombre']) === claveTexto(x['Nombre']))) { c.productos.push(x); conservados++; } });
                    return;
                }
                let asignados = [];
                try { const r = await fetch(URL_INDICE_VADEMECUM.replace('portafolios-index.json', `portafolios/${h}.json`), { cache: 'no-cache' }); if (r.ok) asignados = (await r.json()).productos || []; } catch (e) { /* sin asignados previos */ }
                const propios = new Set(c.productos.map(o => o['Referencia Interna']));
                asignados.filter(x => !etiquetasProducto(x['Etiquetas de producto']).includes('Cliente') && !propios.has(x['Referencia Interna']))
                    .forEach(x => { c.productos.push(maestroPorRef[x['Referencia Interna']] || x); conservados++; });
            }));
            Object.entries(por).forEach(([h, c]) => bases.push({ nombre: 'pf_' + h, contenido: JSON.stringify(c), resumen: '' }));
            nPf = Object.keys(por).length;
            lineas.push(`Portafolios de clientes: ${nPf} se actualizan (${delCliente.length} productos propios + ${conservados} de Epithelium que ya tenían)${sinAcceso.length ? `; sin cruzar con la lista del Vademécum (no se tocan): ${sinAcceso.join(', ')}` : ''}`);
        }
        if (!soloPT && !familias.has('MP')) lineas.push('Magistrales: no se subieron, el Vademécum y los portafolios no cambian.');
        if (!await dialogo({ titulo: soloPT ? 'Vademécum Producto Terminado' : 'Productos y Vademécum', aceptar: 'Subir', cancelar: 'No subir', texto: `${lineas.join('\n')}\nReemplaza lo que ven todos los usuarios.` })) return;
        const resumen = [`${productos.length} productos`, resumenV && `${maestro.length} en el Vademécum`, nPf && `${nPf} portafolios`].filter(Boolean).join(' · ');
        bases[0].resumen = resumen;
        let cuando = new Date().toISOString();
        if (API_URL) cuando = (await llamarApi({ accion: 'guardarBases', bases, borrarPortafolios: false }, 180000)).actualizado || cuando;
        guardarBaseLocal('catalogo', cuando, catalogo, resumen); aplicarBase('catalogo', catalogo);
        estadoBases.catalogo = { actualizado: cuando, resumen };
        if (terminados.length) { estadoBases.productoterminado = { actualizado: cuando, resumen: `${terminados.length} productos` }; guardarBaseLocal('productoterminado', cuando, terminados, `${terminados.length} productos`); }
        refrescarBases(); repintarPantallaActiva();
        toast(`Listo: ${productos.length} productos en el catálogo${resumenV ? ', ' + resumenV + ' en el Vademécum' : ''}${nPf ? ' y ' + nPf + ' portafolios' : ''}`);
    } catch (e) { toast('No se pudo subir: ' + e.message); }
}
// ---------- Homólogos (solo magistrales): cómo llama cada cliente a los productos de Epithelium ----------
// Nombre del cliente en Odoo → nombre del cliente en la lista del Vademécum (confirmados con el administrador)
const MAPA_CLIENTES_HOMOLOGOS = {
    'Boutique de la Piel, Giovanny German Avila Camacho': 'Boutique de la Piel - Giovanny German Avila Camacho', 'Carlos Fernando Quintero Baute': 'Dr. Carlos Fernando Quintero',
    'Carolina Andrea Murcia Alvarez': 'Farmapiel Garzon - Carolina Andrea Murcia Alvarez', 'Claudia Milena Arango Atehortua': 'Dermaskin Cuidado para La Piel - Dra Claudia Milena Arango',
    'Dermaskin Cuidado Para La Piel, Mileydi Jhoana Loaiza Luna': 'Dermaskin Cuidado para La Piel - Dra Claudia Milena Arango',
    'Cm Dra Carol Mesa Dermatologa, Carol Vanessa Messa Velandia': 'Dra. Carol Mesa Dermatologa', 'Darwin Alejandro Lazo Sanchez': 'Darwin Alejandro Lazo',
    'Deladieth Serrano Rincon': 'Dermatologia y Medicina Estetica- Dra. Erika Molina/Deladieth Serrano Rincon',
    'Dermoestetica Dra. Claudia Figueroa, Claudia Elena Figueroa Murcia': 'Dermoestetica Dra. Claudia Figueroa', 'Dermoscience Group S.A.S, Jessica Martelo Fernandez': 'Dermoscience Group S.A.S',
    'Dra. Tatiana Leal Sandoval': 'Dra. Tatiana Leal S.A.S.', 'Drogueria Farmapiel, Olmedo Humberto Obando Delgado': 'Drogueria Farmapiel',
    'Farmadescuentos Co S.A.S - Pharmags Laboratories S.A.S.': 'Farmadescuentos Co S.A.S', 'GG & Piel S.A.S - Dr. Giovanny Antonio Guerra': 'GG & Piel S.A.S.', 'Giovanny Antonio Guerra Jimenez': 'GG & Piel S.A.S.',
    'Lizeth Daniela Caro Suarez': 'Gema Clinic - Dra. Lizeth Daniela Caro Suarez', 'Sandra Carolina Moreno Ferrer': 'Guapa Glow - Sandra Carolina Moreno',
    'Isis Gyo By Dra. Karen Acosta, Karen Lorena Acosta Ussa': 'Isis Gyo By Dra. Karen Acosta', 'MD Support LTDA': 'MD Support Ltda', 'Maria De Jesus Correa Acosta': 'Niks Leip - Maria de Jesus Acosta Correa',
    'Natalia Hernandez Mantilla': 'Dra. Natalia Hernandez Mantilla', 'Pielmedic, Antony Adrian Aguilar Erazo': 'PielMedic Cabello y Piel - Antony Adrian Aguilar Erazo',
    'Tienda Dermocosmetica Bella Piel, Juanita Ceron Delgado': 'Tienda Dermocosmetica Bella Piel- Juanita Ceron Delgado', 'Andres Mauricio Ardila Rojas': 'Drogueria Dermatos - Dr. Andres Mauricio Ardila',
    'Carolina Palacio S.A.S.': 'Hair and Skin Evolution - Carolina Palacio S.A.S.'
};
// Clientes que no son clientes activos del Vademécum (no se cargan)
const CLIENTES_EXCLUIDOS = ['Hernan Guillermo Reyes Sierra', 'Luis Ignacio Jimenez Alba', 'Ximena Sanchez Angarita'];
const listaClientesVademecum = async () => { const r = await fetch(URL_INDICE_VADEMECUM, { cache: 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const nombresClientes = async () => { try { return Object.fromEntries((await listaClientesVademecum()).map(x => [x.huella, x.cliente])); } catch (e) { return {}; } };
function clienteHomologo(nombre, indice) {
    const k = claveCliente(nombre);
    if (CLIENTES_EXCLUIDOS.some(x => claveCliente(x) === k)) return 'excluido';
    const mapeado = Object.entries(MAPA_CLIENTES_HOMOLOGOS).find(([o]) => claveCliente(o) === k);
    return clienteDelIndice(mapeado ? mapeado[1] : nombre, indice, null);
}
// Lo guardado (servidor; en pruebas, lo último subido en este navegador)
async function homologosActuales() {
    if (API_URL) { try { const r = await llamarApi({ accion: 'leerBase', nombre: 'homologos' }, 60000); if (r.contenido) return JSON.parse(r.contenido); } catch (e) { /* sin copia */ } }
    return leerBaseLocal('homologos')?.d || null;
}
async function maestroActual() {
    if (API_URL) { try { const r = await llamarApi({ accion: 'leerVademecum' }, 120000); if (r.productos?.length) return r.productos; } catch (e) { /* sin copia */ } }
    return [];
}
function leerHomologos(libro) {
    const ws = libro.worksheets.find(w => filasHoja(w)[0]?.map(claveTexto).includes('product counterpart/cliente'));
    if (!ws) throw new Error('No encontré las columnas "Product Counterpart/Cliente" y "Product Counterpart/Nombre"');
    const f = filasHoja(ws), cab = f[0].map(claveTexto), ir = cab.indexOf('referencia interna'), ic = cab.indexOf('product counterpart/cliente'), inn = cab.indexOf('product counterpart/nombre');
    if (ir < 0 || inn < 0) throw new Error('Faltan las columnas "Referencia Interna" y "Product Counterpart/Nombre"');
    let ref = '';
    const filas = [];
    f.slice(1).forEach(r => {   // la referencia solo viene en la primera fila de cada producto: se arrastra hacia abajo
        if (String(r[ir] || '').trim()) ref = String(r[ir]).trim();
        const cliente = String(r[ic] || '').trim(), nombre = String(r[inn] || '').split(/\s+/).filter(Boolean).join(' ');
        if (ref && cliente && nombre) filas.push({ r: ref, c: cliente, n: nombre });
    });
    return filas;
}
// Producto del maestro con el nombre que le pone el cliente
const productoHomologo = (maestroPorRef, i) => { const m = maestroPorRef[i.r]; return m ? { ...m, Nombre: i.n } : null; };
async function subirHomologos() {
    if (!esAdmin()) return;
    const [archivo] = await elegirArchivos(false);
    if (!archivo) return;
    try {
        const filas = leerHomologos(await leerLibro(archivo));
        if (filas.length < 100) return toast('El archivo trae muy pocos homólogos: revisa que sea Producto_product.template de Odoo');
        let indice;
        try { indice = await listaClientesVademecum(); }
        catch (e) { return toast('No pude traer la lista de clientes del Vademécum: revisa la conexión e inténtalo de nuevo'); }
        const items = [], sinCruce = new Set(), excluidos = new Set();
        filas.forEach(x => {
            const cl = clienteHomologo(x.c, indice);
            if (cl === 'excluido') return excluidos.add(x.c);
            if (!cl) return sinCruce.add(x.c);
            if (!items.some(i => i.r === x.r && i.h === cl.huella && claveTexto(i.n) === claveTexto(x.n))) items.push({ r: x.r, h: cl.huella, n: x.n });
        });
        const clientes = new Set(items.map(i => i.h)).size, previo = await homologosActuales();
        if (!items.length) return toast('Ningún cliente del archivo está en la lista del Vademécum');
        if (!await dialogo({ titulo: 'Homólogos', aceptar: 'Subir', cancelar: 'No subir',
            texto: `${items.length} homólogos de ${clientes} clientes${previo?.items ? ` (antes ${previo.items.length})` : ''}\n${sinCruce.size ? `Sin cruzar con la lista del Vademécum (no se cargan): ${[...sinCruce].join('; ')}\n` : ''}${excluidos.size ? `Clientes retirados: ${[...excluidos].join('; ')}\n` : ''}Con esto se actualizan los portafolios de esos clientes.` })) return;
        await guardarBaseServidor('homologos', { items }, `${items.length} homólogos · ${clientes} clientes`);
        // Se rehacen los portafolios: sus productos propios (etiqueta Cliente) + los homólogos con el nombre del cliente
        const maestro = await maestroActual();
        let rehechos = 0;
        if (maestro.length && API_URL) {
            const lee = await llamarApi({ accion: 'leerVademecum' }, 120000), porRef = Object.fromEntries(maestro.map(x => [x['Referencia Interna'], x]));
            const porCliente = {}; items.forEach(i => { (porCliente[i.h] ||= []).push(i); });
            const bases = Object.entries(porCliente).map(([h, lista]) => {
                const actual = lee.portafolios?.[h] || { cliente: indice.find(x => x.huella === h).cliente, zona: indice.find(x => x.huella === h).zona || '', productos: [] };
                const propios = actual.productos.filter(x => etiquetasProducto(x['Etiquetas de producto']).includes('Cliente'));
                const homologos = lista.map(i => productoHomologo(porRef, i)).filter(Boolean).filter(x => !propios.some(y => y['Referencia Interna'] === x['Referencia Interna'] && claveTexto(y['Nombre']) === claveTexto(x['Nombre'])));
                rehechos++;
                return { nombre: 'pf_' + h, contenido: JSON.stringify({ ...actual, productos: [...propios, ...homologos] }), resumen: '' };
            });
            await llamarApi({ accion: 'guardarBases', bases, borrarPortafolios: false }, 180000);
        }
        toast(`Homólogos actualizados: ${items.length}${rehechos ? ` · ${rehechos} portafolios al día` : ''}`);
    } catch (e) { toast('No se pudo subir los homólogos: ' + e.message); }
}
async function descargarVademecum() {
    const r = API_URL ? await llamarApi({ accion: 'leerVademecum' }, 120000) : { productos: null };
    if (!r.productos) return null;
    const wb = new ExcelJS.Workbook();
    hojaTabla(wb, 'Vademecum Epithelium', COLS_VADE, r.productos.map(p => COLS_VADE.map(c => p[c] ?? '')), [14, 50, 22, 34, 18, 22, 9, 8, 60, 70, 50, 20]);
    const wc = new ExcelJS.Workbook(), filas = [];
    Object.values(r.portafolios || {}).sort((a, b) => a.cliente.localeCompare(b.cliente)).forEach(c => c.productos.forEach(p => filas.push([c.cliente, ...COLS_VADE.map(k => p[k] ?? ''), c.zona || ''])));
    hojaTabla(wc, 'Vademecum clientes', ['Cliente', ...COLS_VADE, 'Zona de Vendedor'], filas, [36, 14, 50, 22, 34, 18, 22, 9, 8, 60, 70, 50, 20, 20]);
    await bajarLibro(wb, 'Vademecum_Epithelium');
    if (filas.length) { await new Promise(res => setTimeout(res, 600)); await bajarLibro(wc, 'Vademecum_clientes'); }
    return `${r.productos.length} productos y ${filas.length} filas de portafolios`;
}
