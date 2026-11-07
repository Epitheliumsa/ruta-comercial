"""Arma el MÓDULO DE PRUEBAS del Cotizador Epithelium: una copia de cotizador/ de una rama, en cotizador/pruebas/, para probar antes de publicar.

Uso (desde la raíz del repositorio): python3 herramientas/vista_previa_cotizador.py [rama o commit]   (por defecto, la rama actual)
- Se abre en https://epitheliumsa.github.io/ruta-comercial/cotizador/pruebas/  (el cotizador oficial no se toca).
- Franja roja "MÓDULO DE PRUEBAS", sin instalación ni service worker, y su propio espacio en el navegador (sesión y motor aparte del oficial).
- Mismos usuarios y acceso que el cotizador de esa rama; el motor es el publicado en el servidor (solo lectura).
- «Probar motor» (solo administrador): carga un archivo JSON de motor SOLO en ese navegador, para ensayar un motor nuevo
  antes de subirlo para todos. «Volver al motor publicado» lo quita.
- Para subirlo se hace un commit que toque SOLO cotizador/pruebas/ (y esta herramienta), con la confirmación del administrador.
- Los cambios de backend/Codigo.gs no se ven aquí: el servidor es uno solo.
"""
import io, re, shutil, subprocess, sys, tarfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
REF = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'
SALIDA = RAIZ / 'cotizador' / 'pruebas'
ARCHIVOS = ['cotizador/index.html', 'cotizador/cotizador.js', 'cotizador/usuarios.js']

tmp = RAIZ / '.vp_cotizador_tmp'
if tmp.exists():
    shutil.rmtree(tmp)
tar = subprocess.run(['git', '-C', str(RAIZ), 'archive', REF, *ARCHIVOS], check=True, capture_output=True).stdout
tarfile.open(fileobj=io.BytesIO(tar)).extractall(tmp, filter='data')
if SALIDA.exists():
    shutil.rmtree(SALIDA)
SALIDA.mkdir(parents=True)
for f in ARCHIVOS:
    shutil.copy(tmp / f, SALIDA / Path(f).name)
shutil.rmtree(tmp)


def cambiar(texto, viejo, nuevo, veces=1):
    if viejo not in texto:
        raise SystemExit(f'No encontré en index.html: {viejo[:70]!r} (¿cambió el cotizador? ajusta esta herramienta)')
    return texto.replace(viejo, nuevo, veces) if veces else texto.replace(viejo, nuevo)


h = (SALIDA / 'index.html').read_text(encoding='utf-8')
# Rutas: la carpeta queda un nivel más adentro
h = h.replace('href="../', 'href="../../').replace('src="../', 'src="../../')
# Sin instalación, sin service worker, sin vista previa del enlace ni indexación
h = re.sub(r'<link rel="manifest"[^>]*>\s*', '', h)
h = re.sub(r'<meta (property="og:|name="twitter:)[^>]*>\s*', '', h)
h = cambiar(h, '<title>Cotizador Epithelium</title>', '<title>PRUEBAS · Cotizador Epithelium</title>\n<meta name="robots" content="noindex, nofollow">')
h = cambiar(h, "if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});", '/* módulo de pruebas: sin service worker */')
h = cambiar(h, "window.addEventListener('beforeinstallprompt',", "if (false) window.addEventListener('beforeinstallprompt',")
# Espacio propio en el navegador (no se cruza con el cotizador oficial)
h = cambiar(h, "const SESION_KEY = 'cz_sesion', MOTOR_KEY = 'cz_motor';", "const SESION_KEY = 'czp_sesion', MOTOR_KEY = 'czp_motor';")
h = h.replace("'cz_salio'", "'czp_salio'")
# Franja y sello
h = h.replace('EN PRUEBAS</span>', 'MÓDULO DE PRUEBAS</span>').replace('>EN PRUEBAS</p>', '>MÓDULO DE PRUEBAS</p>')
h = cambiar(h, '<body>\n', '<body>\n<div class="franja-pruebas">🧪 MÓDULO DE PRUEBAS · lo que ves aquí aún no está publicado</div>\n')
h = cambiar(h, '[hidden]{display:none!important}\n', '[hidden]{display:none!important}\n.franja-pruebas{position:sticky;top:0;z-index:50;background:#b91c1c;color:#fff;text-align:center;font:700 12.5px system-ui,sans-serif;padding:6px 12px}\n#app{height:calc(100vh - 30px)!important}\n')
# Motor: el administrador puede probar uno nuevo SOLO en este navegador (no se sube al servidor)
h = cambiar(h, "  let cache = leer(MOTOR_KEY);\n  try {", "  let cache = leer(MOTOR_KEY);\n  if (cache && cache.local) return cache.d;   // motor de prueba cargado en este navegador\n  try {")
h = cambiar(h, 'Cargar motor (archivo JSON)</button>', 'Probar motor (archivo JSON)</button><button type="button" class="btn-sec" id="motorPublicado" onclick="volverMotorPublicado()">Volver al motor publicado</button>')
i = h.index('async function subirMotor(input) {')
j = h.index('\n}\n', i) + 3
h = h[:i] + """async function subirMotor(input) {   // módulo de pruebas: el motor queda solo en este navegador
  const f = input.files[0]; input.value = ''; if (!f) return;
  const msg = $id('adminMsg');
  try {
    const d = JSON.parse(await f.text());
    if (!d.materias || !d.combos || !d.formas || !d.rangos_cdfll) throw new Error('el archivo no es un motor del cotizador');
    escribir(MOTOR_KEY, { v: 'local', local: true, nombre: f.name, d });
    msg.textContent = `Probando ${f.name} (motor ${d.version}) solo en este navegador.`;
    setTimeout(() => location.reload(), 1200);
  } catch (e) { msg.textContent = 'No se pudo cargar: ' + e.message; }
}
function volverMotorPublicado() { try { localStorage.removeItem(MOTOR_KEY); } catch (e) {} location.reload(); }
""" + h[j:]
h = cambiar(h, "  window.MOTOR = d;\n", "  window.MOTOR = d;\n  { const c = leer(MOTOR_KEY); $id('motorPublicado').hidden = !(c && c.local); if (c && c.local) $id('adminMsg').textContent = `Probando ${c.nombre} (motor ${d.version}) solo en este navegador.`; }\n")
(SALIDA / 'index.html').write_text(h, encoding='utf-8')
v = re.search(r'cotizador\.js\?v=(\d+)', h)
print('Módulo de pruebas del cotizador desde', REF, 'en', SALIDA.relative_to(RAIZ), '· versión', v.group(1) if v else '?')
