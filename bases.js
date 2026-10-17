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
    { k: 'contactos', t: 'Maestra de contactos', d: 'Clientes y médicos de cada zona (Maestra de Contactos de Odoo). Reemplaza la lista de la app.', a: 'subirContactos()', n: 'contactos' },
    { k: 'catalogo', t: 'Productos', d: 'Catálogo con etiquetas (Nuevo, Foco, Transición-Impulso…) para visitas y muestras. Sube Base_Productos (materias primas), Productos_Terminados (terminados) o los dos: cada archivo reemplaza solo lo suyo.', a: 'subirCatalogo()', n: 'productos' },
    { k: 'directorio', t: 'Direcciones y teléfonos', d: 'Calle, teléfono y móvil de los clientes (Maestra de Odoo). Los ven Logística, los jefes y tú; cada comercial, solo su zona.', a: 'subirDirectorio()', n: 'clientes' },
    { k: 'proveedores', t: 'Proveedores', d: 'Maestra de proveedores con dirección y teléfono. Solo la ven Logística y tú.', a: 'subirProveedores()', n: 'proveedores' }
];
const cuandoBase = iso => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }) : ''; };
let estadoBases = {};
function textoEstadoBase(k) {
    const e = estadoBases[k], l = leerBaseLocal(k);
    const cuando = e?.actualizado || l?.v || (k === 'directorio' ? directorio.actualizado : k === 'proveedores' ? proveedoresMaestra.actualizado : '');
    const n = k === 'directorio' ? Object.keys(directorio.filas).length : k === 'proveedores' ? Object.keys(proveedoresMaestra.filas).length : 0;
    const resumen = e?.resumen || l?.resumen || (n ? `${n} registros` : '');
    return cuando ? `Última carga: <b>${esc(cuandoBase(cuando))}</b>${resumen ? ' · ' + esc(resumen) : ''}` : '<i>Aún no se ha subido: la app usa lo que trae publicado</i>';
}
function pintarBases() {
    $('basesLista').innerHTML = TARJETAS_BASES.map(x => `<div class="base-tarjeta">
        <div class="base-info"><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p><p class="base-estado">${textoEstadoBase(x.k)}</p></div>
        <div class="base-botones"><button type="button" class="btn-nuevo" onclick="${x.a}">⬆ Subir</button>
        <button type="button" class="btn-sec" onclick="descargarBase('${x.k}')">⬇ Descargar</button></div></div>`).join('');
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
        } else if (k === 'directorio') {
            if (API_URL) { try { const r = await llamarApi({ accion: 'directorio' }); ponerDirectorio(r.filas || [], r.actualizado); } catch (e) { /* queda lo que hay en el teléfono */ } }
            const filas = Object.values(directorio.filas).map(x => [x.n || '', x.c || '', x.dir || '', x.tel || '', x.z || '']);
            if (filas.some(f => !f[0])) return toast('Falta el nombre en el directorio guardado: vuelve a sincronizar e inténtalo de nuevo');
            hojaTabla(wb, 'Direcciones', ['Nombre Público', 'Ciudad', 'Calle', 'Teléfono', 'Equipo de ventas'], filas, [40, 18, 45, 24, 20]);
            nombre = 'Direcciones'; cuenta = filas.length;
        } else return;
        if (!cuenta) return toast('Esta base aún no tiene registros para descargar');
        await bajarLibro(wb, nombre);
        toast(`Copia descargada: ${cuenta} registros`);
    } catch (e) { toast('No se pudo descargar la copia: ' + e.message); }
}
