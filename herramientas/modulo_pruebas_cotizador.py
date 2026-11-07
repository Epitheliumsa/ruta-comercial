"""Arma el MÓDULO DE PRUEBAS del Cotizador para el panel de claude.ai (Artifact privado), como el de Visita Comercial.

Uso (desde la raíz del repositorio):
    python3 herramientas/vista_previa_cotizador.py <rama>          # 1) copia el cotizador de la rama a cotizador/pruebas/
    python3 herramientas/modulo_pruebas_cotizador.py <salida> <motor.json>   # 2) arma la carpeta del Artifact
- <motor.json>: el motor del cotizador (el mismo que se sube con «Cargar motor»). NUNCA va al repositorio (tiene costos):
  queda solo dentro del Artifact privado.
- Se entra tocando el usuario (sin clave), sin servidor: nada se guarda fuera del navegador.
- Link fijo del Artifact: ver CLAUDE.md (sección del módulo de pruebas del Cotizador). Siempre se publica en ese mismo link.
"""
import json, re, shutil, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / 'cotizador' / 'pruebas'
SALIDA = Path(sys.argv[1]).resolve()
MOTOR = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
if not (MOTOR.get('materias') and MOTOR.get('combos')):
    raise SystemExit('El archivo de motor no es válido')

if SALIDA.exists():
    shutil.rmtree(SALIDA)
(SALIDA / 'icons').mkdir(parents=True)
for f in ['cotizador.js', 'usuarios.js']:
    shutil.copy(ORIGEN / f, SALIDA / f)
(SALIDA / 'lib').mkdir()
shutil.copy(ORIGEN / 'lib' / 'jspdf.umd.min.js', SALIDA / 'lib' / 'jspdf.umd.min.js')
for f in ['styles.css', 'logo.png', 'logo-blanco.png']:
    shutil.copy(RAIZ / f, SALIDA / f)
for f in ['favicon-32.png', 'apple-touch-icon.png']:
    shutil.copy(RAIZ / 'icons' / f, SALIDA / 'icons' / f)
asc = lambda s: ''.join(c if ord(c) < 128 else '\\u%04x' % ord(c) for c in s)
(SALIDA / 'motor.js').write_text('window.MOTOR_EMBEBIDO=' + asc(json.dumps(MOTOR, ensure_ascii=False, separators=(',', ':'))) + ';\n')


def cambiar(t, viejo, nuevo):
    if viejo not in t:
        raise SystemExit(f'No encontré: {viejo[:70]!r} (¿cambió el cotizador? ajusta esta herramienta)')
    return t.replace(viejo, nuevo, 1)


h = (ORIGEN / 'index.html').read_text(encoding='utf-8')
# El Artifact pone su propio esqueleto: sin doctype/html/head/body
h = re.sub(r'<!DOCTYPE html>\s*<html[^>]*>\s*<head>\s*', '', h)
h = re.sub(r'<meta charset="UTF-8">\s*<meta name="viewport"[^>]*>\s*', '', h)
h = h.replace('</head>\n<body>\n', '').replace('</body>\n</html>', '')
h = h.replace('href="../../', 'href="').replace('src="../../', 'src="')
h = re.sub(r'\?v=\d+', '', h)
# Sin servidor: el motor va incluido; se entra tocando el usuario
h = cambiar(h, '<script src="usuarios.js"', '<script src="motor.js"></script>\n<script src="usuarios.js"')
h = cambiar(h, "  if (cache && cache.local) return cache.d;   // motor de prueba cargado en este navegador\n",
            "  if (cache && cache.local) return cache.d;   // motor de prueba cargado en este navegador\n  return window.MOTOR_EMBEBIDO;   // módulo en claude.ai: motor incluido, sin servidor\n")
h = cambiar(h, '<p>Ingresa tu usuario y clave</p>', '<p>Módulo de pruebas: toca el usuario con el que quieres entrar</p><div id="entrarComo" class="entrar-como"></div>')
h = re.sub(r'\s*<input type="text" id="accessUser"[^>]*>', '<input type="hidden" id="accessUser">', h, count=1)
h = re.sub(r'\s*<input type="password" id="accessCode"[^>]*>', '<input type="hidden" id="accessCode">', h, count=1)
h = re.sub(r'\s*<button type="button" onclick="ingresar\(\)">Acceder</button>', '', h, count=1)
h = cambiar(h, '.franja-pruebas{', '.entrar-como{display:grid;gap:8px;width:100%;margin-top:6px}.entrar-como button{display:flex!important;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:10px 14px!important}.entrar-como button small{font-weight:500;opacity:.85;font-size:12px}\n.franja-pruebas{')
h = cambiar(h, '// Sesión: la propia del cotizador', """function entrarComo(id) {
  const u = USUARIOS.find(x => x.id === id); if (!u) return;
  if (!tieneAcceso(u)) { $id('errorMsg').textContent = `${u.nombre}: el cotizador está en pruebas y todavía no tiene acceso.`; return; }
  $id('errorMsg').textContent = ''; escribir(SESION_KEY, { id: u.id }); entrar(u, '');
}
function pintarEntrarComo() {
  $id('entrarComo').innerHTML = USUARIOS.map(u => `<button type="button" onclick="entrarComo('${u.id}')">${u.nombre}<small>${u.cargo || ''}${u.zona ? ' · ' + u.zona : ''}${tieneAcceso(u) ? '' : ' · sin acceso por ahora'}</small></button>`).join('');
}
pintarEntrarComo();
// Sesión: la propia del cotizador""")
i = h.index('(async function () {\n  const propia')
j = h.index('})();', i) + 5
h = h[:i] + """(function () {   // módulo en claude.ai: se recuerda con quién se entró (sin clave)
  const s = leer(SESION_KEY), u = s && USUARIOS.find(x => x.id === s.id || (s.usuario && x.usuario === s.usuario));
  if (u && tieneAcceso(u)) entrar(u, ''); else pantalla('loginScreen');
})();""" + h[j:]
h = cambiar(h, 'location.reload(); }\n\n// Administrador', "location.reload(); }\n\n// Administrador") if 'location.reload(); }\n\n// Administrador' in h else h
(SALIDA / 'index.html').write_text(h, encoding='utf-8')
print('Módulo de pruebas del cotizador (Artifact) en', SALIDA, '· motor', MOTOR.get('version'))
