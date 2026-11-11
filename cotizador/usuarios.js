/* Personal de Epithelium: los MISMOS usuarios y claves de Visita Comercial (USUARIOS en app.js de ruta-comercial).
   Solo va la huella SHA-256 de "usuario:clave" en min\u00fasculas; la clave nunca se guarda aqu\u00ed.
   Para agregar o cambiar una clave, se cambia en Visita Comercial y se copia la misma l\u00ednea aqu\u00ed. */
const USUARIOS_EMPRESA = [
  { usuario: 'L.Ramos', huella: '979ff4a2d9c7b874f250cb3045a80ca3c2fd83f1075fe25fa206b2ddd697a9cf', id: 'lramos', nombre: 'Lizeth Ramos', cargo: 'Visitador M\u00e9dico Comercial', zona: 'Zona Norte' },
  { usuario: 'Y.Caballero', huella: 'fd091945acd620b35a25485c8c6822458a042e2191ba99fc94eea332477c1cd8', id: 'ycaballero', nombre: 'Yunelis Caballero', cargo: 'Visitador M\u00e9dico Comercial', zona: 'Zona Sur' },
  { usuario: 'J.Herrera', huella: '4ee896f5d2270820de1e071b1e226b123a8c4707f1137605d8e046a7b36dd4e3', id: 'jherrera', nombre: 'Jennifer Herrera', cargo: 'Coordinadora Comercial', zona: 'Clientes Especiales' },
  { usuario: 'M.Castro', huella: '38e5f82794a1571cba7695fe203657f0a5b5a27dc385bb8cb3aa6ad7b0b8bd09', id: 'mcastro', nombre: 'Maryi Castro', cargo: 'Visitador M\u00e9dico Comercial', zona: 'Zona Desarrollo' },
  { usuario: 'H.Reyes', huella: '67021645044fe3bc87275bbd9883e2d092cf0be800a6e6577ac859c51f31130f', id: 'hreyes', admin: true, nombre: 'Hern\u00e1n Reyes', cargo: 'Gerente General' },
  { usuario: 'B.Aldana', huella: '78a54bc34aa6bdaadcbbeca45bc1c48839bda7fcca9abe1e80c1b64fc0ac97f7', id: 'baldana', admin: true, nombre: 'Brayan Aldana', cargo: 'Administrador del Cotizador' },
  { usuario: 'J.Arjona', huella: '6dd7e706dbbd6858b7d306987efbb372358d52d7dd3b877de24ee5d5e3fdc2b5', id: 'jarjona', nombre: 'Javier Arjona', cargo: 'Coordinador Log\u00edstico' },
  { usuario: 'E.Ovalle', huella: 'eb8a40c34e5adf4869a44d80284d228fa80c92d5b3f5018515d32bcb1457dd59', id: 'eovalle', nombre: 'Eric Ovalle', cargo: 'Auxiliar de Domicilios y Mensajer\u00eda' },
  { usuario: 'D.Barrero', huella: 'e4929e77c56f8b90b5a9f9f6d713a18a3f27f3d0aadd8a29dbbef35cc97a0041', id: 'dbarrero', nombre: 'Deelan Barrero', cargo: 'Auxiliar de Domicilios y Mensajer\u00eda' },
  { usuario: 'E.Rodriguez', huella: '049cf64428110707ba7acb783f084ec8edd7d442ea9266084f0194e74bcc597a', id: 'erodriguez', nombre: 'Erika Elena Rodriguez', cargo: 'Jefe de RRHH y Mercadeo' },
];

/* Usuarios propios del Cotizador (no entran a Visita Comercial ni al Vademécum).
   motores: los que puede usar ('EPITHELIUM', 'CDFLL'). La misma línea va en USUARIOS_COTIZADOR de backend/Codigo.gs.
   Ejemplo: { usuario: 'Cliente.Usuario', huella: '<sha256 de "cliente.usuario:clave">', id: 'cliente', nombre: 'Nombre', cargo: 'Cliente', motores: ['CDFLL'] }, */
const USUARIOS_EXTERNOS = [
];
const USUARIOS = [...USUARIOS_EMPRESA.map(x => ({ ...x, empresa: true })), ...USUARIOS_EXTERNOS];

/* Mientras está en pruebas solo entran estos id (vacío = todos). La misma lista va en app.js y backend/Codigo.gs (ACCESO_COTIZADOR). */
const ACCESO_COTIZADOR = ['jherrera', 'hreyes', 'baldana'];
const tieneAcceso = u => !ACCESO_COTIZADOR.length || ACCESO_COTIZADOR.includes(u.id);
