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
    { k: 'odoo', t: 'Maestra de Odoo (todo en uno)', d: 'Sube la Maestra de Contactos de Odoo tal como sale (con Calle, Teléfono y Móvil), uno o varios archivos con las mismas columnas. La app reparte cada fila según su Equipo de ventas: zonas → Maestra de contactos y Direcciones; Empleados → Empleados; el resto → Proveedores. Empleados y Proveedores solo los ven Logística y tú.', a: 'subirOdoo()', n: 'odoo', sinDescarga: true },
    { k: 'contactos', t: 'Maestra de contactos', d: 'Clientes y médicos de cada zona (Maestra de Contactos de Odoo). Reemplaza la lista de la app.', a: 'subirContactos()', n: 'contactos' },
    { k: 'catalogo', t: 'Productos', d: 'Catálogo con etiquetas (Nuevo, Foco, Transición-Impulso…) para visitas y muestras. Sube Base_Productos (materias primas), Productos_Terminados (terminados) o los dos: cada archivo reemplaza solo lo suyo.', a: 'subirCatalogo()', n: 'productos' },
    { k: 'directorio', t: 'Direcciones y teléfonos', d: 'Calle, teléfono y móvil de los clientes (Maestra de Odoo). Los ven Logística, los jefes y tú; cada comercial, solo su zona.', a: 'subirDirectorio()', n: 'clientes' },
    { k: 'vademecum', t: 'Vademécum', d: 'Productos y portafolios por cliente del Vademécum. Sube Vademecum_Epithelium (productos), Vademecum_clientes (portafolios) o los dos: cada archivo reemplaza solo lo suyo. El Vademécum lo toma de aquí.', a: 'subirVademecum()', n: 'vademecum' },
    { k: 'proveedores', t: 'Proveedores', d: 'Maestra de proveedores con dirección y teléfono. Solo la ven Logística y tú.', a: 'subirProveedores()', n: 'proveedores' },
    { k: 'empleados', t: 'Empleados', d: 'Empleados con dirección y teléfono (Maestra de Contactos de Odoo: se toman los de Equipo de ventas = Empleados). Solo los ven Logística y tú.', a: 'subirEmpleados()', n: 'empleados' }
];
const cuandoBase = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : ''; };
let estadoBases = {};
function textoEstadoBase(k) {
    const e = estadoBases[k], l = leerBaseLocal(k);
    const cuando = e?.actualizado || l?.v || (k === 'directorio' ? directorio.actualizado : k === 'proveedores' ? proveedoresMaestra.actualizado : k === 'empleados' ? empleadosMaestra.actualizado : '');
    const n = k === 'directorio' ? Object.keys(directorio.filas).length : k === 'proveedores' ? Object.keys(proveedoresMaestra.filas).length : k === 'empleados' ? Object.keys(empleadosMaestra.filas).length : 0;
    const resumen = e?.resumen || l?.resumen || (n ? `${n} registros` : '');
    if (k === 'odoo') return 'Reemplaza de una sola vez la Maestra de contactos, Direcciones, Empleados y Proveedores (cada base solo si el archivo trae filas para ella).';
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
const filasHoja = ws => { const f = []; ws.eachRow({ includeEmpty: false }, fila => { const a = []; for (let i = 1; i <= ws.columnCount; i++) a.push(celdaTexto(fila.getCell(i))); f.push(a); }); return f; };
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
        if (!await dialogo({ titulo: 'Maestra de contactos', aceptar: 'Subir',
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
async function subirOdoo() {
    if (!esAdmin()) return;
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
            if (!padre && o.nit && (porNit[o.nit] || []).length) { const c = porNit[o.nit].filter(x => !o.com || x.com === o.com); padre = c.length === 1 ? c[0] : null; }
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
            resumenC = `${total} contactos en ${ZONAS_BASE.length} zonas`;
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
const DESPLEGABLES_BASE = ['Nuevo', 'Foco', 'Transición-Impulso'], CERRADAS_BASE = ['Portafolio', 'Cliente', 'Consultorio'];
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
        if (!await dialogo({ titulo: 'Productos', aceptar: 'Subir',
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
        if (k === 'contactos') {
            const filas = [];
            Object.entries(contactos).forEach(([z, l]) => l.forEach(x => filas.push([x.n, x.c || '', x.e || '', z, '', x.t || '', x.p || '', x.f ? 'Sí' : 'No', x.cl || '', x.ca || '', x.pz || ''])));
            hojaTabla(wb, 'Contactos', ['Nombre Público', 'Ciudad', 'Etiquetas', 'Equipo de ventas', 'Comercial', 'Título', 'Provincia', 'Cliente para Facturar',
                'Categoría de cliente/Clasificación', 'Categoría de cliente', 'Plazos de Pago'], filas, [40, 18, 30, 20, 18, 12, 18, 14, 28, 22, 18]);
            nombre = 'Maestra_Contactos'; cuenta = filas.length;
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
        if (!await dialogo({ titulo: 'Vademécum', aceptar: 'Subir',
            texto: `${lineas.join('\n')}\n${maestro ? '' : 'Los productos no cambian (no subiste Vademecum_Epithelium).\n'}${clientes ? '' : 'Los portafolios no cambian (no subiste Vademecum_clientes).\n'}Reemplaza lo que lee el Vademécum.` })) return;
        bases[0].resumen = resumen;
        let cuando = new Date().toISOString();
        if (API_URL) cuando = (await llamarApi({ accion: 'guardarBases', bases, borrarPortafolios: !!clientes }, 180000)).actualizado || cuando;
        estadoBases.vademecum = { actualizado: cuando, resumen };
        refrescarBases();
        toast('Vademécum actualizado: ' + resumen);
    } catch (e) { toast('No se pudo subir el Vademécum: ' + e.message); }
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
