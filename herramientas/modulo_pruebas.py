"""Arma el "módulo de pruebas": copia idéntica de la app para ensayar cambios antes de publicarlos.

Uso: python3 herramientas/modulo_pruebas.py <carpeta de salida> [semilla.json] [Maestra_Odoo_con_direcciones.xlsx]
- semilla.json (opcional, fuera del repositorio): registros de ejemplo que se cargan en el navegador al abrir
  (ej. las ventas del mes), solo si quien prueba no los tiene ya.
- Maestra de Odoo con direcciones (opcional, fuera del repositorio): carga el directorio de direcciones y teléfonos
  como si lo hubiera traído del servidor. Son datos personales: solo para el módulo de pruebas (página privada).
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
ARCHIVOS = ['index.html', 'app.js', 'logistica.js', 'bases.js', 'styles.css', 'visitas.css', 'ciudades.js', 'objetivos.js', 'circulares.js', 'productos.js',
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
# Sin aviso de "versión nueva": el módulo se republica por partes y su version.txt no siempre coincide con el app.js (el aviso se quedaba pegado)
app = app.replace("async function revisarVersion() {", "async function revisarVersion() {\n    return;   // módulo de pruebas: sin aviso de versión", 1)
bases = (SALIDA / 'bases.js').read_text(encoding='utf-8')
bases = bases.replace("async function appAlDia() {", "async function appAlDia() {\n    return true;   // módulo de pruebas", 1)
# La lista de clientes del Vademécum va dentro del módulo (la página de pruebas no puede consultar otros sitios)
indice = RAIZ.parent / 'vademecum-epithelium' / 'portafolios-index.json'
if indice.exists():
    shutil.copy(indice, SALIDA / 'portafolios-index.json')
    shutil.copytree(indice.parent / 'portafolios', SALIDA / 'portafolios', dirs_exist_ok=True)
    bases = re.sub(r"const URL_INDICE_VADEMECUM = '[^']*';", "const URL_INDICE_VADEMECUM = 'portafolios-index.json';", bases, count=1)
(SALIDA / 'bases.js').write_text(bases, encoding='utf-8')
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
    if len(sys.argv) > 3:
        import json, time, unicodedata, openpyxl
        norm = lambda t: re.sub('[\u0300-\u036f]', '', unicodedata.normalize('NFD', str(t))).lower().strip()   # igual que normalizar() de app.js
        contactos = json.loads((RAIZ / 'contactos.json').read_text(encoding='utf-8'))
        zona_de = {norm(x['n']): z for z, l in contactos.items() for x in l}
        ws = openpyxl.load_workbook(sys.argv[3], read_only=True, data_only=True).active
        filas_x = list(ws.iter_rows(values_only=True))
        col = {str(n or '').strip(): i for i, n in enumerate(filas_x[0])}
        val = lambda f, n: str(f[col[n]]).strip() if n in col and f[col[n]] not in (None, False) else ''
        # Si el título de la primera columna (Etiquetas) fue cambiado, se usa igual cuando trae las direcciones de entrega
        et = lambda f: str(f[col['Etiquetas']] if 'Etiquetas' in col else f[0] or '')
        es_dir = lambda f: bool(re.search(r'direccion (entrega|personal)', norm(et(f))))
        dirs, vistos, emps, alts = [], set(), {}, []
        for f in filas_x[1:]:
            n = val(f, 'Nombre Público') or val(f, 'Nombre')
            if n and 'emplead' in val(f, 'Equipo de ventas').lower() and not es_dir(f):
                tel = ' / '.join(dict.fromkeys(t for t in (val(f, 'Móvil'), val(f, 'Teléfono')) if t))
                emps[norm(n)] = {'n': n, 'c': val(f, 'Ciudad'), 'p': re.sub(r'\s*\(CO\)$', '', val(f, 'Provincia')), 'e': 'Empleado', 'dir': val(f, 'Calle'), 'tel': tel}
                continue
            if n and es_dir(f):
                alts.append(f)
                continue
            if not n or norm(n) in vistos:
                continue
            vistos.add(norm(n))
            tel = ' / '.join(dict.fromkeys(t for t in (val(f, 'Móvil'), val(f, 'Teléfono')) if t))
            dirs.append([n, val(f, 'Ciudad'), val(f, 'Calle'), tel, zona_de.get(norm(n), '')])
        # Misma forma que ponerDirectorio() en logistica.js (llave = nombre normalizado)
        m = {norm(d[0]): {'n': d[0], 'c': d[1], 'dir': d[2], 'tel': d[3], 'z': d[4]} for d in dirs}
        # Direcciones alternas: se pegan al cliente por el nombre ("Cliente, Dirección") o por el NIT único
        por_nit = {}
        for f in filas_x[1:]:
            if val(f, 'Número de Identificación') and not es_dir(f) and norm(val(f, 'Nombre Público') or val(f, 'Nombre')) in m:
                por_nit.setdefault(val(f, 'Número de Identificación'), []).append(norm(val(f, 'Nombre Público') or val(f, 'Nombre')))
        alt = {}
        for f in alts:
            nm, nom = val(f, 'Nombre Público') or val(f, 'Nombre'), val(f, 'Nombre')
            padre = None
            if nom and nom != nm and nm.endswith(', ' + nom) and norm(nm[:-len(nom) - 2]) in m:
                padre = norm(nm[:-len(nom) - 2])
            if not padre:
                c = por_nit.get(val(f, 'Número de Identificación'), [])
                padre = c[0] if len(c) == 1 else None
            if padre:
                tel = ' / '.join(dict.fromkeys(t for t in (val(f, 'Móvil'), val(f, 'Teléfono')) if t))
                alt.setdefault(padre, []).append({'n': nom if nom and nom != nm else nm, 'c': val(f, 'Ciudad'), 'dir': val(f, 'Calle'), 'tel': tel, 'z': m[padre]['z'],
                                                 'tipo': 'Personal' if 'personal' in norm(et(f)) else 'Entrega'})
        with open(SALIDA / 'semilla.js', 'a', encoding='utf-8') as js:
            js.write("try { localStorage.setItem('rc_directorio', JSON.stringify(" + json.dumps(
                {'filas': m, 'alt': alt, 'actualizado': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'traido': 0}, ensure_ascii=False) + ")); } catch (e) {}\n")
            js.write("try { localStorage.setItem('rc_empleados', JSON.stringify(" + json.dumps(
                {'filas': emps, 'actualizado': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'traido': 0}, ensure_ascii=False) + ")); } catch (e) {}\n")
        print('Directorio de pruebas:', len(dirs), 'clientes ·', sum(len(v) for v in alt.values()), 'direcciones alternas ·', len(emps), 'empleados')
    if len(sys.argv) > 4:
        # Maestra de proveedores (opcional): misma forma que ponerProveedores() en logistica.js
        import json, time, unicodedata, openpyxl
        norm = lambda t: re.sub('[\u0300-\u036f]', '', unicodedata.normalize('NFD', str(t))).lower().strip()
        fx = list(openpyxl.load_workbook(sys.argv[4], read_only=True, data_only=True).active.iter_rows(values_only=True))
        col = {str(n or '').strip(): i for i, n in enumerate(fx[0])}
        g = lambda f, n: str(f[col[n]]).strip() if n in col and f[col[n]] not in (None, False) else ''
        provs = {}
        for f in fx[1:]:
            n = g(f, 'Nombre Público') or g(f, 'Nombre')
            if n:
                provs.setdefault(norm(n), {'n': n, 'c': g(f, 'Ciudad'), 'p': re.sub(r'\s*\(CO\)$', '', g(f, 'Provincia')), 'e': g(f, 'Etiquetas'), 'dir': g(f, 'Calle'), 'tel': ' / '.join(dict.fromkeys(t for t in (g(f, 'Móvil'), g(f, 'Teléfono')) if t))})
        # Odoo trae un proveedor dos veces ("Empresa" y "Empresa, Persona", mismo NIT): se deja el que tiene nombre y razón social
        nit = {norm(g(f, 'Nombre Público') or g(f, 'Nombre')): g(f, 'Número de Identificación') for f in fx[1:]}
        for k in [k for k in provs if any(o.startswith(k + ', ') and (not nit.get(k) or nit.get(o) == nit.get(k)) for o in provs)]:
            for o, v in provs.items():   # se rescata la dirección más completa (y el teléfono si falta)
                if o.startswith(k + ', ') and (not nit.get(k) or nit.get(o) == nit.get(k)):
                    if len(provs[k]['dir']) > len(v['dir']): v['dir'] = provs[k]['dir']
                    if not v['tel']: v['tel'] = provs[k]['tel']
            del provs[k]
        with open(SALIDA / 'semilla.js', 'a', encoding='utf-8') as js:
            js.write("try { localStorage.setItem('rc_proveedores', JSON.stringify(" + json.dumps(
                {'filas': provs, 'actualizado': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'traido': 0}, ensure_ascii=False) + ")); } catch (e) {}\n")
        print('Maestra de proveedores de pruebas:', len(provs))
    h = re.sub(r'(<script src="app\.js)', '<script src="semilla.js"></script>\n    \\1', h, count=1)
(SALIDA / 'index.html').write_text(h, encoding='utf-8')
print('Módulo de pruebas en', SALIDA)
