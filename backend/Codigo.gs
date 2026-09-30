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
  'l.ramos':     { huella: 'afecd958a07662fa1c466a63fa799f91873a1371f878dc6e4bd6c35ffce87617', id: 'lramos',     tipo: 'comercial' },
  'y.caballero': { huella: 'df5769c03aec2c0300cd912335962a57617271fa86e0ef852d5d959895c6ecab', id: 'ycaballero', tipo: 'comercial' },
  'j.herrera':   { huella: '564177c2a1926013ea79ab83b4bbfe0c3f44fb9585eda1c407504de6424f24c0', id: 'jherrera',   tipo: 'jefe' },  // Jefe comercial: ve y registra para todo el equipo
  'm.castro':    { huella: '2b2ebf7f55852620d6c6b80fd886a502c3ffa470d4eae22dcad0fe2dfd5b1d88', id: 'mcastro',    tipo: 'comercial' },
  'h.reyes':     { huella: '0213f79c165b6d4bee6bd9eab719817266af1fc9a45ed22cadfccda60f0a122d', id: 'hreyes',     tipo: 'jefe', admin: true }
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
    if (pedido.accion === 'subirArchivo') return responder_({ ok: true, url: subirArchivo_(usuario, pedido) });
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
    .filter(f => f[0] && (usuario.tipo === 'jefe' || f[2] === usuario.id || f[1] === 'mensual'))
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
      if (usuario.tipo !== 'jefe' && r.vendedor !== usuario.id) return;
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
        } else if (actual && actual.estado && actual.estado !== 'pendiente' && r.estado !== actual.estado && !usuario.admin) {
          return; // Una visita cerrada no se puede modificar
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
function subirArchivo_(usuario, pedido) {
  const bytes = Utilities.base64Decode(String(pedido.datos || ''));
  if (!bytes.length) throw new Error('Archivo vacío');
  if (bytes.length > 15 * 1024 * 1024) throw new Error('El archivo pesa más de 15 MB');
  const nombreCarpeta = 'Ruta Comercial - ' + String(pedido.carpeta || 'Archivos').replace(/[\\/]/g, '-');
  const carpetas = DriveApp.getFoldersByName(nombreCarpeta);
  const carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(nombreCarpeta);
  const fecha = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH.mm');
  const nombre = fecha + ' · ' + usuario.id + ' · ' + String(pedido.nombre || 'archivo').replace(/[\\/]/g, '-');
  const archivo = carpeta.createFile(Utilities.newBlob(bytes, pedido.tipo || 'application/octet-stream', nombre));
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return archivo.getUrl();
}

// Ejecútala una vez desde el editor (▶ Ejecutar) para que Google pida el permiso de Drive
function probarDrive() {
  const carpetas = DriveApp.getFoldersByName('Ruta Comercial - Formatos de creación de clientes');
  Logger.log(carpetas.hasNext() ? 'La carpeta ya existe' : 'Drive OK: la carpeta se crea con el primer formato');
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
