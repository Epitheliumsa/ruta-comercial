"""Arma la VISTA PREVIA de la app: una copia de lo que hay en una rama, en la carpeta pruebas/ del sitio, para verla antes de publicar.

Uso (desde la raíz del repositorio): python3 herramientas/vista_previa.py [rama o commit]   (por defecto, la rama actual)
- Se abre en https://epitheliumsa.github.io/ruta-comercial/pruebas/  (la app oficial, en la raíz, no se toca).
- Es el modo prueba de siempre: datos reales y el servidor de siempre, pero NO guarda nada en el servidor (franja "VISTA PREVIA").
- Los cambios de backend/Codigo.gs no se ven aquí: el servidor es uno solo.
- Después de entrar una vez como administrador, al cerrar sesión se ve la lista de usuarios para entrar como cualquiera sin clave (lee con las credenciales del administrador; el filtro por usuario es el de la pantalla).
- Para subirla se hace un commit que toque SOLO pruebas/ (y esta herramienta); lo demás de la raíz no se publica hasta decir "sí, publica".
"""
import re, shutil, subprocess, sys, tarfile, io
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
REF = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'
ARCHIVOS = ['index.html', 'app.js', 'logistica.js', 'bases.js', 'styles.css', 'visitas.css', 'ciudades.js', 'objetivos.js', 'circulares.js', 'productos.js',
            'portafolios.js', 'contactos.json', 'logo.png', 'logo-blanco.png', 'version.txt', 'icons', 'lib']
SALIDA = RAIZ / 'pruebas'

if SALIDA.exists():
    shutil.rmtree(SALIDA)
SALIDA.mkdir()
tar = subprocess.run(['git', '-C', str(RAIZ), 'archive', REF, *ARCHIVOS], check=True, capture_output=True).stdout
tarfile.open(fileobj=io.BytesIO(tar)).extractall(SALIDA)

h = (SALIDA / 'index.html').read_text(encoding='utf-8')
# Siempre en modo prueba (sin necesidad de ?prueba) y con otra franja
h = h.replace("if (!/[?&]prueba(=|&|$)/.test(location.search)) return;", "/* vista previa: siempre en modo prueba */")
h = h.replace('🧪 MODO PRUEBA · datos reales · nada de lo que hagas queda guardado', '🧪 VISTA PREVIA · datos reales · nada de lo que hagas queda guardado · aún no está publicado')
h = h.replace('<div class="sello-prueba">PRUEBA</div>', '<div class="sello-prueba">VISTA PREVIA</div>')
h = h.replace("document.title = 'PRUEBA · Visita Comercial';", "document.title = 'VISTA PREVIA · Visita Comercial';")
h = re.sub(r'<link rel="manifest"[^>]*>\s*', '', h)
(SALIDA / 'index.html').write_text(h, encoding='utf-8')

# Entrar como cualquier usuario sin clave: después de entrar UNA vez como administrador, la pantalla de ingreso muestra a todos los usuarios.
# Lee con las credenciales del administrador (guardadas solo en este navegador, en el espacio de la vista previa); nada se guarda en el servidor.
h = (SALIDA / 'index.html').read_text(encoding='utf-8')
h = h.replace('<button onclick="ingresar()">Acceder</button>',
              '<button onclick="ingresar()">Acceder</button>\n                <div id="entrarComo" class="entrar-como" hidden></div>', 1)
h = h.replace('</head>', """<style>
.entrar-como { display: grid; gap: 8px; width: 100%; margin-top: 10px; }
.entrar-como p { margin: 4px 0 0; font-size: 13px; color: #475569; }
.entrar-como button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 10px 14px; }
.entrar-como button small { font-weight: 500; opacity: .85; font-size: 12px; }
</style></head>""", 1)
(SALIDA / 'index.html').write_text(h, encoding='utf-8')
a = (SALIDA / 'app.js').read_text(encoding='utf-8')
a = a.replace("if ('serviceWorker' in navigator) {", "if (false && 'serviceWorker' in navigator) {", 1)   # sin service worker en la vista previa
a = a.replace("    sesion = { ...u, clave };\n    localStorage.setItem('rc_sesion', JSON.stringify(sesion));",
              "    sesion = { ...u, clave };\n    if (u.admin) localStorage.setItem('vp_admin', JSON.stringify({ usuario: u.usuario, clave }));\n    localStorage.setItem('rc_sesion', JSON.stringify(sesion));", 1)
a = a.replace("    sesion = null;\n    document.body.classList.remove('es-logistica', 'es-mercadeo');", "    sesion = null; vpPintar();\n    document.body.classList.remove('es-logistica', 'es-mercadeo');", 1)
a += """
// VISTA PREVIA: entrar como cualquier usuario (sin clave) una vez que el administrador entró en este navegador
function vpAdmin() { try { return JSON.parse(localStorage.getItem('vp_admin') || 'null'); } catch (e) { return null; } }
function vpEntrarComo(id) {
    const a = vpAdmin(), u = USUARIOS.find(x => x.id === id);
    if (!a || !u) return;
    sesion = { ...u, usuario: a.usuario, clave: a.clave, vistaComo: u.usuario };
    try { localStorage.setItem('rc_sesion', JSON.stringify(sesion)); } catch (e) { /* nada */ }
    entrarApp();
}
function vpPintar() {
    const caja = document.getElementById('entrarComo');
    if (!caja) return;
    const a = vpAdmin();
    caja.hidden = !a;
    caja.innerHTML = a ? '<p>Vista previa: toca el usuario con el que quieres ver la app (no pide clave)</p>' + USUARIOS.map(u => `<button type="button" onclick="vpEntrarComo('${u.id}')">${esc(u.nombre)}<small>${esc(u.cargo || 'Visitador Médico Comercial')}${u.zona ? ' · ' + esc(u.zona) : ''}</small></button>`).join('') : '';
}
vpPintar();
"""
(SALIDA / 'app.js').write_text(a, encoding='utf-8')
print('Vista previa de', REF, 'en', SALIDA, '· versión', (SALIDA / 'version.txt').read_text().strip())
