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
  'l.ramos':     { huella: '979ff4a2d9c7b874f250cb3045a80ca3c2fd83f1075fe25fa206b2ddd697a9cf', id: 'lramos',     tipo: 'comercial' },
  'y.caballero': { huella: 'fd091945acd620b35a25485c8c6822458a042e2191ba99fc94eea332477c1cd8', id: 'ycaballero', tipo: 'comercial' },
  'j.herrera':   { huella: '4ee896f5d2270820de1e071b1e226b123a8c4707f1137605d8e046a7b36dd4e3', id: 'jherrera',   tipo: 'jefe' },  // Jefe comercial: ve y registra para todo el equipo
  'm.castro':    { huella: '38e5f82794a1571cba7695fe203657f0a5b5a27dc385bb8cb3aa6ad7b0b8bd09', id: 'mcastro',    tipo: 'comercial', subeVentas: true },  // carga el informe de ventas del mes de todos
  'h.reyes':     { huella: '67021645044fe3bc87275bbd9883e2d092cf0be800a6e6577ac859c51f31130f', id: 'hreyes',     tipo: 'jefe', admin: true }
};

const HOJA = 'Registros';
const COLUMNAS = ['id', 'clase', 'vendedor', 'fecha', 'actualizado', 'borrado', 'datos'];

function doPost(e) {
  try {
    const pedido = JSON.parse(e.postData.contents);
    const usuario = autenticar_(pedido.usuario, pedido.clave);
    if (!usuario) return responder_({ ok: false, error: 'Usuario o clave incorrectos' });
    if (pedido.accion === 'listar') return responder_({ ok: true, registros: listar_(usuario, pedido.desde, pedido.hasta) });
    if (pedido.accion === 'guardar') return responder_({ ok: true, guardados: guardar_(usuario, pedido.registros || []) });
    if (pedido.accion === 'subirArchivo') return responder_(Object.assign({ ok: true }, subirArchivo_(usuario, pedido)));
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
    .filter(f => f[0] && (usuario.tipo === 'jefe' || f[2] === usuario.id || f[1] === 'mensual'
      || (f[1] === 'acompanamiento' && String(f[6]).indexOf('"solicitante":"' + usuario.id + '"') >= 0)))
    // Los contactos proyecto y los PDF de las circulares se envían siempre, sin importar la fecha
    .filter(f => f[1] === 'proyecto' || f[0] === 'circulares-pdf' || ((!desde || String(f[3]) >= desde) && (!hasta || String(f[3]) <= hasta)))
    .map(f => JSON.parse(f[6]));
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
      if (usuario.tipo !== 'jefe' && r.vendedor !== usuario.id && !esSolicitante && !subeVentas) return;
      // Para el rango de fechas, la actividad usa su fecha (o el primer día del mes)
      const fecha = r.fecha || (r.mes ? r.mes + '-01' : '');
      const fila = [r.id, r.clase, r.vendedor, fecha, r.actualizado || '', r.borrado ? 'si' : '', JSON.stringify(r)];
      const n = filaDe[r.id];
      const actual = n ? JSON.parse(valores[n - 1][6]) : null;
      if (r.clase === 'visita') {
        // Solo el administrador elimina visitas
        if (r.borrado && !(actual && actual.borrado) && !usuario.admin) return;
        // Un reporte hecho dentro del plazo reemplaza el cierre automático
        const reporteATiempo = actual && actual.cierreAutomatico && r.estado !== 'pendiente' && !r.cierreAutomatico
          && r.registrada && r.limiteReporte && r.registrada <= r.limiteReporte;
        if (reporteATiempo) {
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
  const carpeta = carpeta_(pedido.carpeta);
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
