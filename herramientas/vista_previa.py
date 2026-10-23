"""Arma la VISTA PREVIA de la app: una copia de lo que hay en una rama, en la carpeta pruebas/ del sitio, para verla antes de publicar.

Uso (desde la raíz del repositorio): python3 herramientas/vista_previa.py [rama o commit]   (por defecto, la rama actual)
- Se abre en https://epitheliumsa.github.io/ruta-comercial/pruebas/  (la app oficial, en la raíz, no se toca).
- Es el modo prueba de siempre: datos reales y el servidor de siempre, pero NO guarda nada en el servidor (franja "VISTA PREVIA").
- Los cambios de backend/Codigo.gs no se ven aquí: el servidor es uno solo.
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

a = (SALIDA / 'app.js').read_text(encoding='utf-8')
a = a.replace("if ('serviceWorker' in navigator) {", "if (false && 'serviceWorker' in navigator) {", 1)   # sin service worker en la vista previa
(SALIDA / 'app.js').write_text(a, encoding='utf-8')
print('Vista previa de', REF, 'en', SALIDA, '· versión', (SALIDA / 'version.txt').read_text().strip())
