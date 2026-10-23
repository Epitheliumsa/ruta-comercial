/**
 * Ruta Comercial Epithelium: servidor en Google Apps Script.
 *
 * Guarda las visitas y actividades de todo el equipo en una hoja de Google
 * Sheets para que el jefe vea en vivo lo de cada vendedor.
 *
 * Instalación (una sola vez):
 *  1. Crea una hoja de cálculo nueva en Google Drive ("Ruta Comercial - Datos").
 *  2. Menú Extensiones > Apps Script. Borra lo que aparece y pega este archivo.
 *  3. Implementar > Nueva implementación > Tipo: Aplicación web.
 *     Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario.
 *  4. Copia la URL que termina en /exec y pégala en API_URL de visitas/app.js.
 */

// Mismas huellas que visitas/app.js: SHA-256 de "usuario:clave" en minúsculas
const USUARIOS = {
  'l.ramos':     { huella: '979ff4a2d9c7b874f250cb3045a80ca3c2fd83f1075fe25fa206b2ddd697a9cf', id: 'lramos',     tipo: 'comercial', zona: 'Zona Norte' },
  'y.caballero': { huella: 'fd091945acd620b35a25485c8c6822458a042e2191ba99fc94eea332477c1cd8', id: 'ycaballero', tipo: 'comercial', zona: 'Zona Sur' },
  'j.herrera':   { huella: '4ee896f5d2270820de1e071b1e226b123a8c4707f1137605d8e046a7b36dd4e3', id: 'jherrera',   tipo: 'jefe' },  // Jefe comercial: ve y registra para todo el equipo
  'm.castro':    { huella: '38e5f82794a1571cba7695fe203657f0a5b5a27dc385bb8cb3aa6ad7b0b8bd09', id: 'mcastro',    tipo: 'comercial', zona: 'Zona Desarrollo', subeVentas: true },  // carga el informe de ventas del mes de todos
  'h.reyes':     { huella: '67021645044fe3bc87275bbd9883e2d092cf0be800a6e6577ac859c51f31130f', id: 'hreyes',     tipo: 'jefe', admin: true },
  // Logística: solo ven y guardan registros de clase 'logistica' (el coordinador, los de todos; cada auxiliar, los suyos)
  'j.arjona':    { huella: '6dd7e706dbbd6858b7d306987efbb372358d52d7dd3b877de24ee5d5e3fdc2b5', id: 'jarjona',  tipo: 'logistica', area: 'logistica', coordLogistica: true },
  'e.ovalle':    { huella: 'eb8a40c34e5adf4869a44d80284d228fa80c92d5b3f5018515d32bcb1457dd59', id: 'eovalle',  tipo: 'logistica', area: 'logistica' },
  'd.barrero':   { huella: 'e4929e77c56f8b90b5a9f9f6d713a18a3f27f3d0aadd8a29dbbef35cc97a0041', id: 'dbarrero', tipo: 'logistica', area: 'logistica' },
  // Mercadeo: lee visitas, ventas (cuota) y actividades de todo el equipo, sin escribirlas; solo guarda los PDF de las circulares
  'e.rodriguez': { huella: '1810ebbb28c9a1f5b1b7d8f7612189070fcddbcc9a8b0a2e0d18c161506ecf08', id: 'erodriguez', tipo: 'mercadeo', verEquipo: true, subeCirculares: true }
};

const HOJA = 'Registros';
const COLUMNAS = ['id', 'clase', 'vendedor', 'fecha', 'actualizado', 'borrado', 'datos'];

function doPost(e) {
  try {
    const pedido = JSON.parse(e.postData.contents);
    // El Vademécum no tiene usuarios de Ruta Comercial: lee su maestro y el portafolio de cada cliente (por huella), solo lectura
    if (pedido.accion === 'vademecumMaestro') return responder_(Object.assign({ ok: true }, vademecumMaestro_()));
    if (pedido.accion === 'vademecumPortafolio') return responder_(Object.assign({ ok: true }, vademecumPortafolio_(pedido.huella)));
    const usuario = autenticar_(pedido.usuario, pedido.clave);
    if (!usuario) return responder_({ ok: false, error: 'Usuario o clave incorrectos' });
    if (pedido.accion === 'listar') return responder_({ ok: true, registros: listar_(usuario, pedido.desde, pedido.hasta) });
    if (pedido.accion === 'guardar') return responder_({ ok: true, guardados: guardar_(usuario, pedido.registros || []) });
    if (pedido.accion === 'subirArchivo') return responder_(Object.assign({ ok: true }, subirArchivo_(usuario, pedido)));
    if (pedido.accion === 'directorio') return responder_(Object.assign({ ok: true }, directorio_(usuario)));
    if (pedido.accion === 'guardarDirectorio') return responder_(Object.assign({ ok: true }, guardarDirectorio_(usuario, pedido.filas)));
    if (pedido.accion === 'proveedores') return responder_(Object.assign({ ok: true }, proveedores_(usuario)));
    if (pedido.accion === 'guardarProveedores') return responder_(Object.assign({ ok: true }, guardarProveedores_(usuario, pedido.filas)));
    if (pedido.accion === 'empleados') return responder_(Object.assign({ ok: true }, empleados_(usuario)));
    if (pedido.accion === 'guardarEmpleados') return responder_(Object.assign({ ok: true }, guardarEmpleados_(usuario, pedido.filas)));
    if (pedido.accion === 'estadoBases') return responder_(Object.assign({ ok: true }, estadoBases_(usuario)));
    if (pedido.accion === 'versionesBases') return responder_({ ok: true, versiones: versionesBases_(usuario) });
    if (pedido.accion === 'leerBase') return responder_(Object.assign({ ok: true }, leerBase_(usuario, pedido.nombre)));
    if (pedido.accion === 'guardarBase') return responder_(Object.assign({ ok: true }, guardarBase_(usuario, pedido.nombre, pedido.contenido, pedido.resumen)));
    if (pedido.accion === 'guardarBases') return responder_(Object.assign({ ok: true }, guardarBases_(usuario, pedido.bases, pedido.borrarPortafolios)));
    if (pedido.accion === 'leerVademecum') return responder_(Object.assign({ ok: true }, leerVademecum_(usuario)));
    if (pedido.accion === 'consultarDocumento') return responder_(Object.assign({ ok: true }, consultarDocumento_(usuario, pedido.numero, pedido.tipo)));
    if (pedido.accion === 'firmarFormato') return responder_(Object.assign({ ok: true }, firmarFormato_(usuario, pedido)));
    return responder_({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return responder_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return responder_({ ok: true, servicio: 'Ruta Comercial Epithelium' });
}

function autenticar_(usuario, clave) {
  const u = USUARIOS[String(usuario || '').toLowerCase()];
  if (!u) return null;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    (String(usuario) + ':' + String(clave)).toLowerCase(), Utilities.Charset.UTF_8);
  const huella = bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  return huella === u.huella ? u : null;
}

function hoja_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(HOJA);
  if (!h) {
    h = libro.insertSheet(HOJA);
    h.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  // Texto plano para que Sheets no convierta fechas ni números
  h.getRange('A:G').setNumberFormat('@');
  return h;
}

// El comercial solo ve lo suyo; el jefe ve todo el equipo
function listar_(usuario, desde, hasta) {
  const filas = hoja_().getDataRange().getValues().slice(1);
  return filas
    // La parrilla, las actividades del mes y los PDF de las circulares (clase 'mensual') los ve todo el equipo
    // Acompañamientos: también los ve quien pidió el acompañamiento (dueño de la visita)
    .filter(f => f[0] && (usuario.area === 'logistica'
      // Logística: solo lo de logística (el coordinador, de todos los auxiliares; cada auxiliar, solo lo que se le programó o asignó: al asignar, la parada pasa a su nombre)
      ? (f[1] === 'logistica' && (usuario.coordLogistica || f[2] === usuario.id || String(f[6]).indexOf('"previos":[') >= 0 && String(f[6]).indexOf('"' + usuario.id + '"') >= 0 && datosPrevios_(f, usuario.id))) || f[0] === 'lista-transportadoras'
      : (usuario.tipo === 'jefe' || f[2] === usuario.id || f[1] === 'mensual'
      // Mercadeo: ve visitas, ventas, novedades y actividades de todo el equipo (nada de logística, leads ni acompañamientos)
      || (usuario.verEquipo && ['visita', 'ventas', 'novedad', 'actividad'].indexOf(f[1]) >= 0)
      || (f[1] === 'acompanamiento' && String(f[6]).indexOf('"solicitante":"' + usuario.id + '"') >= 0)
      // Cada comercial ve las entregas de logística de sus clientes
      || (f[1] === 'logistica' && String(f[6]).indexOf('"comercial":"' + usuario.id + '"') >= 0))))
    // Los contactos proyecto y los PDF de las circulares se envían siempre, sin importar la fecha
    .filter(f => f[1] === 'proyecto' || f[0] === 'circulares-pdf' || f[0] === 'lista-transportadoras' || ((!desde || String(f[3]) >= desde) && (!hasta || String(f[3]) <= hasta)))
    .map(f => {
      const p = JSON.parse(f[6]);
      // Una parada que se pasó a otra persona: a quien la tenía solo le llega una marca mínima (sin cliente, dirección ni detalle) para que su teléfono deje de mostrarla
      if (usuario.area === 'logistica' && !usuario.coordLogistica && p.clase === 'logistica' && p.vendedor !== usuario.id)
        return { id: p.id, clase: 'logistica', etapa: p.etapa, tipo: p.tipo, vendedor: p.vendedor, fecha: p.fecha, estado: p.estado, actualizado: p.actualizado, traspasada: true };
      return p;
    });
}

// Parada que antes tuvo esta persona (campo "previos") y que hoy tiene otra
function datosPrevios_(f, id) {
  try { const p = JSON.parse(f[6]); return (p.previos || []).indexOf(id) >= 0 && p.vendedor !== id; } catch (e) { return false; }
}

// Guarda o reemplaza cada registro; gana la versión más reciente
function guardar_(usuario, registros) {
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(20000);
  try {
    const h = hoja_();
    const valores = h.getDataRange().getValues();
    const filaDe = {};
    valores.forEach((f, i) => { if (i > 0 && f[0]) filaDe[f[0]] = i + 1; });
    const nuevas = [];
    let guardados = 0;
    registros.forEach(r => {
      if (!r || !r.id) return;
      const n0 = filaDe[r.id];
      const previo = n0 ? JSON.parse(valores[n0 - 1][6]) : null;
      // Acompañamiento: lo guarda quien acompaña (vendedor) o quien lo pidió (solicitante, sin cambiarlo)
      const esSolicitante = r.clase === 'acompanamiento' && r.solicitante === usuario.id && (!previo || previo.solicitante === usuario.id);
      // Ventas del mes: las carga quien tiene subeVentas (Tatiana) o el administrador; cada comercial solo recibe las suyas
      if (r.clase === 'ventas' && !usuario.subeVentas && !usuario.admin) return;
      const subeVentas = r.clase === 'ventas' && usuario.subeVentas;
      // Logística: solo logística escribe registros de logística (el coordinador, los de todos; el auxiliar, los suyos)
      // (excepto la lista de transportadoras, que Logística llena y comparte)
      if (usuario.area === 'logistica' && r.clase !== 'logistica' && !(r.id === 'lista-transportadoras' && r.clase === 'lista')) return;
      const previoLog = r.clase === 'logistica' && filaDe[r.id] ? JSON.parse(valores[filaDe[r.id] - 1][6]) : null;
      const logistica = r.clase === 'logistica' && (usuario.area === 'logistica' ? (usuario.coordLogistica || (previoLog ? previoLog.vendedor === usuario.id : r.vendedor === usuario.id)) : usuario.admin);
      if (r.clase === 'logistica' && !logistica) return;
      // Mercadeo solo escribe los enlaces PDF de las circulares (clase 'mensual', id circulares-pdf)
      if (usuario.tipo === 'mercadeo' && !(usuario.subeCirculares && r.id === 'circulares-pdf' && r.clase === 'mensual')) return;
      if (!logistica && usuario.tipo !== 'jefe' && r.vendedor !== usuario.id && !esSolicitante && !subeVentas) return;
      // Para el rango de fechas, la actividad usa su fecha (o el primer día del mes)
      const fecha = r.fecha || (r.mes ? r.mes + '-01' : '');
      const fila = [r.id, r.clase, r.vendedor, fecha, r.actualizado || '', r.borrado ? 'si' : '', JSON.stringify(r)];
      const n = filaDe[r.id];
      const actual = n ? JSON.parse(valores[n - 1][6]) : null;
      if (r.clase === 'visita') {
        // Solo el administrador elimina visitas
        if (r.borrado && !(actual && actual.borrado) && !usuario.admin) return;
        // Una visita eliminada no se devuelve (p. ej. un cierre automático hecho desde un dispositivo que no había traído la eliminación)
        if (actual && (actual.borrado || actual.eliminada) && !r.borrado && !r.eliminada && r.actualizadoPor === 'sistema') return;
        // Un cierre automático nunca tapa una visita que ya se reportó (aunque lo suba el administrador desde un dispositivo con datos viejos)
        if (actual && actual.estado && actual.estado !== 'pendiente' && r.cierreAutomatico && r.actualizadoPor === 'sistema' && !actual.cierreAutomatico) return;
        // Un reporte hecho dentro del plazo reemplaza el cierre automático
        const reporteATiempo = actual && actual.cierreAutomatico && r.estado !== 'pendiente' && !r.cierreAutomatico
          && r.registrada && r.limiteReporte && r.registrada <= r.limiteReporte;
        // Corrección PROVISIONAL de las visitas "Sin reporte a tiempo": se acepta hasta el viernes 16 de octubre de 2026, 6:00 p. m. (Colombia)
        const correccionProv = actual && actual.cierreAutomatico && r.correccionProvisional && !r.cierreAutomatico && r.estado !== 'pendiente'
          && new Date().toISOString() <= '2026-10-16T23:00:00.000Z';
        if (reporteATiempo || correccionProv) {
          r.actualizado = new Date().toISOString();
          fila[4] = r.actualizado;
          fila[6] = JSON.stringify(r);
        } else if (actual && actual.estado && actual.estado !== 'pendiente' && r.estado !== actual.estado && !usuario.admin
          && !(!actual.cierreAutomatico && actual.limiteReporte && new Date().toISOString() <= actual.limiteReporte)
          && !(actual.solicitudCorreccion && actual.solicitudCorreccion.estado === 'aprobada' && new Date().toISOString() <= actual.solicitudCorreccion.hasta)) {
          // Una visita cerrada solo se corrige hasta las 11:59 a. m. del siguiente día hábil;
          // después, solo con la corrección autorizada por el Gerente General (24 horas)
          return;
        }
      }
      // Logística: un auxiliar no cambia lo ya reportado (solo puede agregar fotos); lo corrige el coordinador o el administrador.
      if (r.clase === 'logistica' && actual && actual.estado && actual.estado !== 'pendiente' && !usuario.coordLogistica && !usuario.admin) {
        if (r.borrado || r.estado !== actual.estado || JSON.stringify(r.documentos) !== JSON.stringify(actual.documentos)) return;
        if (JSON.stringify(r.reporte) !== JSON.stringify(actual.reporte)) return;
      }
      if (n) {
        if (String(valores[n - 1][4]) > String(r.actualizado || '')) return;
        h.getRange(n, 1, 1, fila.length).setValues([fila]);
      } else {
        nuevas.push(fila);
      }
      guardados++;
    });
    if (nuevas.length) h.getRange(h.getLastRow() + 1, 1, nuevas.length, COLUMNAS.length).setValues(nuevas);
    return guardados;
  } finally {
    bloqueo.releaseLock();
  }
}

// Guarda un archivo (ej: el formato de vinculación diligenciado) en una carpeta del Drive del dueño de la hoja.
// Queda con enlace de solo lectura para abrirlo desde la app. Máximo 15 MB.
function carpeta_(nombre) {
  const nombreCarpeta = 'Ruta Comercial - ' + String(nombre || 'Archivos').replace(/[\\/]/g, '-');
  const carpetas = DriveApp.getFoldersByName(nombreCarpeta);
  return carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(nombreCarpeta);
}

function subirArchivo_(usuario, pedido) {
  const bytes = Utilities.base64Decode(String(pedido.datos || ''));
  if (!bytes.length) throw new Error('Archivo vacío');
  if (bytes.length > 15 * 1024 * 1024) throw new Error('El archivo pesa más de 15 MB');
  // Logística solo sube a su carpeta (fotos de entrega)
  const carpeta = carpeta_(usuario.area === 'logistica' ? 'Entregas de logística' : pedido.carpeta);
  const fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH.mm');
  const nombre = fecha + ' · ' + usuario.id + ' · ' + String(pedido.nombre || 'archivo').replace(/[\\/]/g, '-');
  const archivo = carpeta.createFile(Utilities.newBlob(bytes, pedido.tipo || 'application/octet-stream', nombre));
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: archivo.getUrl(), id: archivo.getId() };
}

// Firma electrónica del formato de vinculación (Excel): escribe "Aprobado por ... electrónicamente" con la fecha en la casilla
// de la firma (Gerencia: A92 y nombre D97 · Coordinador Comercial: T92 y nombre W97) de una copia en Google Sheets.
// Con pdf = true exporta esa hoja en PDF (el que el vendedor descarga y envía a creación).
const CASILLAS_FIRMA = { gerencia: ['A92', 'D97'], comercial: ['T92', 'W97'] };
function firmarFormato_(usuario, pedido) {
  if (usuario.tipo !== 'jefe') throw new Error('Solo los jefes aprueban');
  const token = ScriptApp.getOAuthToken();
  const carpeta = carpeta_('Formatos de creación de clientes');
  let hojaId = pedido.hojaId;
  if (!hojaId) {
    const original = DriveApp.getFileById(pedido.fileId);
    const copia = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + pedido.fileId + '/copy', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ name: original.getName().replace(/\.xlsx?$/i, '') + ' (aprobación)', mimeType: 'application/vnd.google-apps.spreadsheet', parents: [carpeta.getId()] })
    });
    hojaId = JSON.parse(copia.getContentText()).id;
  }
  const libro = SpreadsheetApp.openById(hojaId);
  const h = libro.getSheetByName('VINCULACION O ACTUALIZACION 1') || libro.getSheets()[0];
  // Orden de las firmas: primero el Coordinador Comercial y después la Gerencia
  const roles = (pedido.firmas || []).map(f => f.rol);
  if (roles.indexOf('gerencia') >= 0 && roles.indexOf('comercial') < 0) throw new Error('Primero debe firmar el Coordinador Comercial');
  (pedido.firmas || []).forEach(f => {
    const c = CASILLAS_FIRMA[f.rol];
    if (!c) return;
    // Sello "FIRMADO ELECTRÓNICAMENTE": recuadro verde con borde grueso en toda la casilla de la firma
    const casilla = h.getRange(c[0]).getMergedRanges()[0] || h.getRange(c[0]);
    const titulo = '✔ FIRMADO ELECTRÓNICAMENTE';
    const texto = titulo + '\n' + f.texto;
    const rico = SpreadsheetApp.newRichTextValue().setText(texto)
      .setTextStyle(0, texto.length, SpreadsheetApp.newTextStyle().setForegroundColor('#0b5c56').setBold(true).setFontSize(9).build())
      .setTextStyle(0, titulo.length, SpreadsheetApp.newTextStyle().setForegroundColor('#0b7a4b').setBold(true).setFontSize(12).build())
      .build();
    h.getRange(c[0]).setRichTextValue(rico);
    casilla.setBackground('#eaf6ef')
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
      .setBorder(true, true, true, true, false, false, '#0b7a4b', SpreadsheetApp.BorderStyle.SOLID_THICK);
    h.getRange(c[1]).setValue(f.nombre);
  });
  SpreadsheetApp.flush();
  let pdf = '';
  if (pedido.pdf) {
    const url = 'https://docs.google.com/spreadsheets/d/' + hojaId + '/export?format=pdf&gid=' + h.getSheetId()
      + '&size=letter&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4';
    const blob = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } }).getBlob().setName(String(pedido.nombrePdf || 'Formato aprobado') + '.pdf');
    const archivo = carpeta.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    pdf = archivo.getUrl();
  }
  return { hojaId: hojaId, pdf: pdf };
}

// Ejecútala desde el editor (▶ Ejecutar) para que Google pida TODOS los permisos (Drive completo y conexión externa).
// Crea la carpeta de los formatos (si no existe), escribe un archivo de prueba y lo borra.
// ---------- DIRECTORIO: dirección y teléfono de los clientes ----------
// Son datos personales: no van en la app publicada (el repositorio es público), sino en la hoja "Directorio".
// Logística (para la ruta), los jefes y el administrador ven todos; cada comercial, solo los clientes de su zona
// (columna Zona, que la app llena con la Maestra al subir). Solo el administrador los reemplaza.
const HOJA_DIR = 'Directorio';
// Principal y Tipo: solo en las direcciones alternas (Entrega, Personal) de un cliente; Principal = nombre del cliente al que pertenecen
const COLUMNAS_DIR = ['Nombre', 'Ciudad', 'Dirección', 'Teléfono', 'Zona', 'Principal', 'Tipo'];
function veTodoDirectorio_(u) { return u.area === 'logistica' || u.tipo === 'jefe' || !!u.admin; }
function directorio_(usuario) {
  const todo = veTodoDirectorio_(usuario);
  if (!todo && !usuario.zona) throw new Error('Sin permiso para ver el directorio');
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_DIR);
  if (!h) return { filas: [], actualizado: '' };
  const valores = h.getDataRange().getValues();
  // Cada comercial: solo su zona y sin las direcciones personales (esas las ven Logística, los jefes y el administrador)
  const filas = valores.slice(1).filter(f => f[0] && (todo || (String(f[4]) === usuario.zona && String(f[6]) !== 'Personal'))).map(f => f.slice(0, COLUMNAS_DIR.length).map(String));
  return { filas: filas, actualizado: String(valores[0][COLUMNAS_DIR.length] || '') };
}
function guardarDirectorio_(usuario, filas) {
  if (!usuario.admin) throw new Error('Solo el administrador sube el directorio');
  if (!Array.isArray(filas) || !filas.length) throw new Error('El directorio llegó vacío');
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const h = libro.getSheetByName(HOJA_DIR) || libro.insertSheet(HOJA_DIR);
  const datos = filas.map(f => COLUMNAS_DIR.map((_, i) => String((f || [])[i] || '').slice(0, 200)));
  h.clear();
  h.getRange(1, 1, datos.length + 1, COLUMNAS_DIR.length).setNumberFormat('@')
    .setValues([COLUMNAS_DIR].concat(datos));
  h.getRange(1, 1, 1, COLUMNAS_DIR.length).setFontWeight('bold');
  h.setFrozenRows(1);
  const cuando = new Date().toISOString();
  h.getRange(1, COLUMNAS_DIR.length + 1).setNumberFormat('@').setValue(cuando);   // fecha de la subida, al lado de los títulos
  return { guardados: datos.length, actualizado: cuando };
}

// ---------- MAESTRA DE PROVEEDORES: solo para Logística ----------
// Hoja "Proveedores" (Nombre, Ciudad, Provincia, Etiquetas, Dirección, Teléfono). La ven Logística y el administrador; solo el administrador la reemplaza.
const HOJA_PROV = 'Proveedores';
const COLUMNAS_PROV = ['Nombre', 'Ciudad', 'Provincia', 'Etiquetas', 'Dirección', 'Teléfono'];
function proveedores_(usuario) {
  if (usuario.area !== 'logistica' && !usuario.admin) throw new Error('Sin permiso para ver los proveedores');
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_PROV);
  if (!h) return { filas: [], actualizado: '' };
  const valores = h.getDataRange().getValues();
  return { filas: valores.slice(1).filter(f => f[0]).map(f => f.slice(0, COLUMNAS_PROV.length).map(String)),
           actualizado: String(valores[0][COLUMNAS_PROV.length] || '') };
}
function guardarProveedores_(usuario, filas) {
  if (!usuario.admin) throw new Error('Solo el administrador sube los proveedores');
  if (!Array.isArray(filas) || !filas.length) throw new Error('La maestra de proveedores llegó vacía');
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const h = libro.getSheetByName(HOJA_PROV) || libro.insertSheet(HOJA_PROV);
  const datos = filas.map(f => COLUMNAS_PROV.map((_, i) => String((f || [])[i] || '').slice(0, 200)));
  h.clear();
  h.getRange(1, 1, datos.length + 1, COLUMNAS_PROV.length).setNumberFormat('@').setValues([COLUMNAS_PROV].concat(datos));
  h.getRange(1, 1, 1, COLUMNAS_PROV.length).setFontWeight('bold');
  h.setFrozenRows(1);
  const cuando = new Date().toISOString();
  h.getRange(1, COLUMNAS_PROV.length + 1).setNumberFormat('@').setValue(cuando);
  return { guardados: datos.length, actualizado: cuando };
}

// ---------- MAESTRA DE EMPLEADOS: solo para Logística ----------
// Hoja "Empleados" (mismas columnas que Proveedores). La ven Logística y el administrador; solo el administrador la reemplaza.
// Nunca viaja a comerciales ni a los demás usuarios.
const HOJA_EMP = 'Empleados';
function empleados_(usuario) {
  if (usuario.area !== 'logistica' && !usuario.admin) throw new Error('Sin permiso para ver los empleados');
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_EMP);
  if (!h) return { filas: [], actualizado: '' };
  const valores = h.getDataRange().getValues();
  return { filas: valores.slice(1).filter(f => f[0]).map(f => f.slice(0, COLUMNAS_PROV.length).map(String)),
           actualizado: String(valores[0][COLUMNAS_PROV.length] || '') };
}
function guardarEmpleados_(usuario, filas) {
  if (!usuario.admin) throw new Error('Solo el administrador sube los empleados');
  if (!Array.isArray(filas) || !filas.length) throw new Error('La maestra de empleados llegó vacía');
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const h = libro.getSheetByName(HOJA_EMP) || libro.insertSheet(HOJA_EMP);
  const datos = filas.map(f => COLUMNAS_PROV.map((_, i) => String((f || [])[i] || '').slice(0, 200)));
  h.clear();
  h.getRange(1, 1, datos.length + 1, COLUMNAS_PROV.length).setNumberFormat('@').setValues([COLUMNAS_PROV].concat(datos));
  h.getRange(1, 1, 1, COLUMNAS_PROV.length).setFontWeight('bold');
  h.setFrozenRows(1);
  const cuando = new Date().toISOString();
  h.getRange(1, COLUMNAS_PROV.length + 1).setNumberFormat('@').setValue(cuando);
  return { guardados: datos.length, actualizado: cuando };
}

// ---------- BASES DE DATOS: lo que sube el administrador desde la pantalla "Bases de datos" ----------
// "contactos" (la Maestra de Contactos por zona) y "catalogo" (productos): los ven todos los usuarios y reemplazan lo que
// viene en la app publicada. Se guardan como texto JSON en la hoja "Bases", en partes (una celda aguanta unos 50.000 caracteres).
// Direcciones (hoja "Directorio") y Proveedores (hoja "Proveedores") siguen con sus propias hojas y permisos.
const HOJA_BASES = 'Bases';
const COLUMNAS_BASES = ['Nombre', 'Parte', 'Contenido', 'Actualizado', 'Resumen'];
const BASES_VALIDAS = ['contactos', 'catalogo', 'vademecum'];
const PARTE_BASES = 40000;
function filasBases_() {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_BASES);
  return h ? h.getDataRange().getValues().slice(1).filter(f => f[0]) : [];
}
function versionesBases_(usuario) {
  const v = {};
  filasBases_().forEach(f => { if (Number(f[1]) === 0 && !/^pf_/.test(f[0])) v[f[0]] = String(f[3]); });
  return v;
}
function leerBase_(usuario, nombre) {
  if (!baseValida_(nombre)) throw new Error('Base desconocida');
  const partes = filasBases_().filter(f => f[0] === nombre).sort((a, b) => Number(a[1]) - Number(b[1]));
  if (!partes.length) return { contenido: '', actualizado: '' };
  return { contenido: partes.map(f => String(f[2])).join(''), actualizado: String(partes[0][3]) };
}
const baseValida_ = n => BASES_VALIDAS.indexOf(n) >= 0 || /^pf_[0-9a-f]{24}$/.test(n);
function guardarBase_(usuario, nombre, contenido, resumen) {
  return guardarBases_(usuario, [{ nombre: nombre, contenido: contenido, resumen: resumen }]);
}
// Guarda varias bases de una sola vez (una sola reescritura de la hoja). borrarPortafolios: retira los portafolios del Vademécum que ya no vienen.
function guardarBases_(usuario, bases, borrarPortafolios) {
  if (!usuario.admin) throw new Error('Solo el administrador sube las bases de datos');
  if (!bases || !bases.length) throw new Error('No llegó nada para guardar');
  bases.forEach(b => {
    if (!baseValida_(b.nombre)) throw new Error('Base desconocida');
    if (typeof b.contenido !== 'string' || b.contenido.length < 10) throw new Error('La base llegó vacía');
    JSON.parse(b.contenido);   // que sea un JSON válido
  });
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const h = libro.getSheetByName(HOJA_BASES) || libro.insertSheet(HOJA_BASES);
  if (h.getLastRow() < 1) { h.getRange(1, 1, 1, COLUMNAS_BASES.length).setValues([COLUMNAS_BASES]).setFontWeight('bold'); h.setFrozenRows(1); }
  const cuando = new Date().toISOString(), nombres = bases.map(b => b.nombre);
  const otras = h.getDataRange().getValues().slice(1).filter(f => f[0] && nombres.indexOf(f[0]) < 0 && !(borrarPortafolios && /^pf_/.test(f[0])));
  const nuevas = [];
  bases.forEach(b => { for (let i = 0, p = 0; i < b.contenido.length; i += PARTE_BASES, p++) nuevas.push([b.nombre, p, b.contenido.substr(i, PARTE_BASES), cuando, p === 0 ? String(b.resumen || '').slice(0, 300) : '']); });
  const todo = otras.concat(nuevas);
  if (h.getMaxRows() < todo.length + 1) h.insertRowsAfter(h.getMaxRows(), todo.length + 1 - h.getMaxRows());
  h.getRange(2, 1, h.getMaxRows() - 1, COLUMNAS_BASES.length).clearContent();
  h.getRange(2, 1, todo.length, COLUMNAS_BASES.length).setNumberFormat('@').setValues(todo);
  return { actualizado: cuando, partes: nuevas.length };
}
// ---------- Vademécum: el maestro de productos ("vademecum") y un portafolio por cliente ("pf_<huella>") ----------
function textoBase_(nombre) {
  const partes = filasBases_().filter(f => f[0] === nombre).sort((a, b) => Number(a[1]) - Number(b[1]));
  return partes.length ? { contenido: partes.map(f => String(f[2])).join(''), actualizado: String(partes[0][3]) } : null;
}
function vademecumMaestro_() {
  const b = textoBase_('vademecum');
  return b ? { productos: JSON.parse(b.contenido), actualizado: b.actualizado } : { productos: null, actualizado: '' };
}
function vademecumPortafolio_(huella) {
  if (!/^[0-9a-f]{24}$/.test(String(huella || ''))) return { portafolio: null };
  const b = textoBase_('pf_' + huella);
  return b ? { portafolio: JSON.parse(b.contenido), actualizado: b.actualizado } : { portafolio: null };
}
function leerVademecum_(usuario) {
  if (!usuario.admin) throw new Error('Solo el administrador descarga el Vademécum');
  const m = vademecumMaestro_(), portafolios = {};
  const nombres = {};
  filasBases_().forEach(f => { if (/^pf_/.test(f[0])) nombres[f[0]] = 1; });
  Object.keys(nombres).forEach(n => { portafolios[n.slice(3)] = JSON.parse(textoBase_(n).contenido); });
  return { productos: m.productos, portafolios: portafolios, actualizado: m.actualizado };
}
// Lo que muestra la pantalla "Bases de datos": cuándo se subió cada cosa y cuántos registros trae
function estadoBases_(usuario) {
  if (!usuario.admin) throw new Error('Solo el administrador ve las bases de datos');
  const libro = SpreadsheetApp.getActiveSpreadsheet(), estado = {};
  const hoja = (nombre, col) => {
    const h = libro.getSheetByName(nombre);
    if (!h || h.getLastRow() < 2) return { n: 0, actualizado: '' };
    return { n: h.getLastRow() - 1, actualizado: String(h.getRange(1, col).getValue() || '') };
  };
  estado.directorio = hoja(HOJA_DIR, COLUMNAS_DIR.length + 1);
  estado.proveedores = hoja(HOJA_PROV, COLUMNAS_PROV.length + 1);
  estado.empleados = hoja(HOJA_EMP, COLUMNAS_PROV.length + 1);
  filasBases_().forEach(f => { if (Number(f[1]) === 0 && !/^pf_/.test(f[0])) estado[f[0]] ={ actualizado: String(f[3]), resumen: String(f[4]) }; });
  return { estado: estado };
}

function probarDrive() {
  UrlFetchApp.fetch('https://www.googleapis.com/discovery/v1/apis?name=drive', { muteHttpExceptions: true });
  const carpeta = carpeta_('Formatos de creación de clientes');
  const prueba = carpeta.createFile('prueba.txt', 'Prueba de permisos de Ruta Comercial');
  prueba.setTrashed(true);
  Logger.log('Drive OK (permiso completo): ' + carpeta.getUrl());
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- CONSULTA POR DOCUMENTO: la puede hacer cualquier usuario ----------
// Busca un número de 6 cifras (pedido de una visita, factura A o B, PQR/OUT, REA/OUT, devolución, aforo o radicación) en TODAS las paradas
// de Logística y en los pedidos de las visitas, sin importar de quién sean. Devuelve solo un resumen: fecha, tipo, cliente o proveedor,
// mensajero o comercial, estado, quién recibió y las devoluciones. No devuelve direcciones, teléfonos ni fotos.
const NOMBRE_CLASE_DOC_ = { pt: 'Producto Terminado', mi: 'Magistral Individual', mini: 'Magistral Individual NI', mp: 'Magistral de Pedido' };
const NOMBRE_INCLUYE_DOC_ = { pqr: 'PQR', pqr_out: 'PQR/OUT', rea_out: 'REA/OUT', devolucion: 'Devolución', remision_pt: 'Remisión Producto Terminado', remision_mi: 'Remisión Magistral Individual', remision_mp: 'Remisión Magistral de Pedido' };
function seisCifras_(v) { const d = String(v || '').replace(/\D/g, ''); return d ? ('000000' + d.slice(-6)).slice(-6) : ''; }
function docsParada_(r) {
  const docs = [], nom = c => NOMBRE_CLASE_DOC_[c] || 'Pedido';
  (r.documentos || []).forEach(d => {
    if (d.ovi) docs.push({ t: 'facA', txt: nom(d.clase) + ' · A ' + d.ovi, num: seisCifras_(d.ovi) });
    if (d.ov) docs.push({ t: 'facB', txt: nom(d.clase) + ' · B ' + d.ov, num: seisCifras_(d.ov) });
  });
  (r.incluyeDocs || []).forEach(d => docs.push({ t: d.k === 'rea_out' ? 'rea' : d.k === 'devolucion' ? 'dev' : String(d.k).indexOf('remision') === 0 ? 'rem' : 'pqr', txt: (NOMBRE_INCLUYE_DOC_[d.k] || d.k) + ' ' + d.numero, num: String(d.k).indexOf('remision') === 0 && !/^\d+$/.test(d.numero || '') ? '' : seisCifras_(d.numero) }));
  (r.facturasAforo || []).forEach(f => docs.push({ t: 'aforo', txt: 'Aforar · ' + (NOMBRE_CLASE_DOC_[f.clase] ? NOMBRE_CLASE_DOC_[f.clase] + ' · ' : '') + (f.serie || '') + ' ' + f.numero, num: seisCifras_(f.numero) }));
  (r.radicacion || []).forEach(d => { if (d.numero) docs.push({ t: 'rad', txt: (d.doc === 'nc' ? 'Radicar nota crédito RNC ' : 'Radicar factura ' + (d.serie || '') + ' ') + d.numero, num: seisCifras_(d.numero) }); });
  ((r.reporte || {}).devoluciones || []).forEach(d => docs.push({ t: 'dev', txt: (d.tipo === 'total' ? 'Devolución total: ' : 'Devolución parcial: ') + d.factura, num: seisCifras_(d.factura) }));
  return docs;
}
function consultarDocumento_(usuario, numero, tipo) {
  const n = seisCifras_(numero);
  if (!n || n === '000000') throw new Error('Escribe el número del documento (6 cifras)');
  const res = [];
  hoja_().getDataRange().getValues().slice(1).forEach(f => {
    if (!f[0] || f[5] || (f[1] !== 'logistica' && f[1] !== 'visita')) return;
    const texto = String(f[6]);
    if (texto.indexOf(n.slice(-4)) < 0) return;   // descarte rápido antes de leer el JSON
    let r; try { r = JSON.parse(texto); } catch (e) { return; }
    if (r.borrado || r.eliminada) return;
    if (f[1] === 'logistica') {
      if (r.tipo === 'novedad') return;
      const docs = docsParada_(r).filter(d => d.num === n && (!tipo || d.t === tipo));
      if (!docs.length) return;
      const rp = r.reporte || {};
      res.push({ fuente: 'log', id: r.id, fecha: r.fecha, tipo: r.tipo, estado: r.estado, titulo: r.contacto || r.proveedor || r.entidad || r.area || '', vendedor: r.vendedor,
        docs: docs, registrada: r.registrada || '', recibio: rp.recibio || '', motivo: rp.motivo || '',
        devoluciones: (rp.devoluciones || []).map(d => (d.tipo === 'total' ? 'Devolución total: ' : 'Devolución parcial: ') + d.factura + (d.detalle ? ' · ' + d.detalle : '')) });
    } else if (!tipo || tipo === 'pedido') {
      const docs = (r.pedidos || []).filter(p => p.num && seisCifras_(p.num) === n).map(p => ({ t: 'pedido', txt: p.cat + ' ' + p.num, num: n }));
      if (docs.length) res.push({ fuente: 'visita', id: r.id, fecha: r.fecha, estado: r.estado, titulo: r.contacto || '', vendedor: r.vendedor, docs: docs });
    }
  });
  res.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return { resultados: res.slice(0, 60), total: res.length };
}
