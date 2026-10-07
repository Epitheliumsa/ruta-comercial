"""Arma el "módulo de pruebas": copia idéntica de la app para ensayar cambios antes de publicarlos.

Uso: python3 herramientas/modulo_pruebas.py <carpeta de salida> [semilla.json]
- semilla.json (opcional, fuera del repositorio): registros de ejemplo que se cargan en el navegador al abrir
  (ej. las ventas del mes), solo si quien prueba no los tiene ya.
- Misma app, con la franja de arriba (encabezado) en rojo y "PRUEBAS" en el título.
- ETAPA_DATOS = 'pruebas' y sin servidor: todo queda solo en el navegador de quien prueba.
- Se entra tocando el usuario (sin clave).
- Listas, campos y textos con color fijo, para que se lean aunque el navegador esté en modo oscuro.
Se publica como Artifact (página privada) con todos los archivos de la carpeta.
"""
import re, shutil, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = Path(sys.argv[1] if len(sys.argv) > 1 else 'modulo-pruebas')
ARCHIVOS = ['index.html', 'app.js', 'logistica.js', 'styles.css', 'visitas.css', 'ciudades.js', 'objetivos.js', 'circulares.js', 'productos.js',
            'portafolios.js', 'contactos.json', 'logo.png', 'logo-blanco.png', 'version.txt', 'icons', 'lib']

if SALIDA.exists():
    shutil.rmtree(SALIDA)
SALIDA.mkdir(parents=True)
for a in ARCHIVOS:
    (shutil.copytree if (RAIZ / a).is_dir() else shutil.copy)(RAIZ / a, SALIDA / a)

app = (SALIDA / 'app.js').read_text(encoding='utf-8')
app = re.sub(r"const API_URL = '[^']*';", "const API_URL = '';   // MÓDULO DE PRUEBAS: sin servidor", app, count=1)
app = re.sub(r"const ETAPA_DATOS = '[a-z]+';", "const ETAPA_DATOS = 'pruebas';", app, count=1)
app = app.replace("if ('serviceWorker' in navigator) {", "if (false && 'serviceWorker' in navigator) {", 1)
app = app.replace('async function ingresar() {', '''// Módulo de pruebas: se entra tocando el usuario, sin clave
function entrarComo(id) {
    const u = USUARIOS.find(x => x.id === id);
    if (!u) return;
    sesion = { ...u, clave: '' };
    try { localStorage.setItem('rc_sesion', JSON.stringify(sesion)); } catch (e) {}
    entrarApp();
}
function pintarEntrarComo() {
    const caja = document.getElementById('entrarComo');
    if (caja) caja.innerHTML = USUARIOS.map(u => `<button type="button" onclick="entrarComo('${u.id}')">${esc(u.nombre)}<small>${esc(u.cargo || 'Visitador Médico Comercial')}${u.zona ? ' · ' + esc(u.zona) : ''}</small></button>`).join('');
}
async function ingresar() {''', 1)
app += '\npintarEntrarComo();\n'
(SALIDA / 'app.js').write_text(app, encoding='utf-8')

h = (SALIDA / 'index.html').read_text(encoding='utf-8')
h = re.sub(r'\?v=\d{12}', '', h)
h = re.sub(r'<!DOCTYPE html>\s*', '', h, flags=re.I)
h = re.sub(r'</?html[^>]*>', '', h)
h = re.sub(r'</?head>', '', h)
h = re.sub(r'<body[^>]*>', '', h).replace('</body>', '')
h = re.sub(r'<link rel="manifest"[^>]*>\s*', '', h)
h = re.sub(r'<title>[^<]*</title>', '<title>Visita Comercial Pruebas</title>', h)
h = re.sub(r'<p>Ingresa tu usuario y clave</p>.*?<button onclick="ingresar\(\)">Acceder</button>',
           '<p>Módulo de pruebas: toca el usuario con el que quieres entrar</p><div id="entrarComo" class="entrar-como"></div>'
           '<input type="hidden" id="accessUser"><input type="hidden" id="accessCode">', h, flags=re.S)
estilo = '''<style>
/* Módulo de pruebas: encabezado en rojo y colores fijos (se leen aunque el navegador esté en modo oscuro) */
:root { color-scheme: light only; }
body { background: #f5f5f5; color: #333; }
.header { background: linear-gradient(135deg, #7f1d1d 0%, #b91c1c 55%, #dc2626 100%) !important; }
.header-logo h1::after { content: "PRUEBAS"; display: inline-block; margin-left: 8px; padding: 1px 7px; border-radius: 6px; background: #fff; color: #b91c1c; font-size: 11px; font-weight: 800; letter-spacing: .06em; vertical-align: middle; }
input, textarea, select, option, optgroup { color: #1f2937 !important; background-color: #fff !important; -webkit-text-fill-color: #1f2937; }
input::placeholder, textarea::placeholder { color: #9aa5a1 !important; -webkit-text-fill-color: #9aa5a1; }
optgroup { font-weight: 700; }
.entrar-como { display: grid; gap: 8px; width: 100%; margin-top: 6px; }
.entrar-como button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 10px 14px; }
.entrar-como button small { font-weight: 500; opacity: .85; font-size: 12px; }
</style>
'''
h = h.replace('<title>Visita Comercial Pruebas</title>', '<title>Visita Comercial Pruebas</title>\n' + estilo, 1)
if len(sys.argv) > 2:
    semilla = Path(sys.argv[2]).read_text(encoding='utf-8')
    (SALIDA / 'semilla.js').write_text(
        "// Módulo de pruebas: registros de ejemplo (solo se agregan los que no estén ya en este navegador)\n"
        f"try {{ const k = 'rc_registros', r = JSON.parse(localStorage.getItem(k) || '{{}}'); ({semilla}).forEach(x => {{ if (!r[x.id]) r[x.id] = x; }});"
        " localStorage.setItem(k, JSON.stringify(r)); if (!localStorage.getItem('rc_etapa')) localStorage.setItem('rc_etapa', 'pruebas'); } catch (e) {}\n", encoding='utf-8')
    h = re.sub(r'(<script src="app\.js)', '<script src="semilla.js"></script>\n    \\1', h, count=1)
(SALIDA / 'index.html').write_text(h, encoding='utf-8')
print('Módulo de pruebas en', SALIDA)
