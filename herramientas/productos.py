#!/usr/bin/env python3
"""Genera productos.js (catálogo para Productos presentados, Productos pedidos y Muestras del cierre de visita).

Uso:  python3 herramientas/productos.py [archivos...]
      (por defecto: ../vademecum-epithelium/data.json + datos/Productos_Terminados.xlsx)
      Acepta el data.json del vademécum o Excel de Odoo (Referencia Interna | Nombre | Grupo de Producto | Etiquetas de producto).

Categorías: Nuevo, Foco y Transición se despliegan (se buscan productos por código o nombre);
Portafolio, Estratégico y Consultorio van cerradas (solo se marcan). Transición todavía no tiene productos.
"""
import json, sys, unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENTRADAS = [Path(a) for a in sys.argv[1:]] or [RAIZ.parent / 'vademecum-epithelium' / 'data.json', RAIZ / 'datos' / 'Productos_Terminados.xlsx']
DESPLEGABLES = ['Nuevo', 'Foco', 'Transición']
CERRADAS = ['Portafolio', 'Estratégico', 'Consultorio']
NOMBRES = {'nuevo': 'Nuevo', 'foco': 'Foco', 'transicion': 'Transición', 'portafolio': 'Portafolio',
           'estrategico': 'Estratégico', 'consultorio': 'Consultorio'}

def clave(t):
    return unicodedata.normalize('NFD', str(t).strip().lower()).encode('ascii', 'ignore').decode()

filas = []
for ENTRADA in ENTRADAS:
    if not ENTRADA.exists():
        print('AVISO: no existe', ENTRADA)
        continue
    if ENTRADA.suffix.lower() == '.json':
        for p in json.loads(ENTRADA.read_text(encoding='utf-8')):
            filas.append((p.get('Referencia Interna'), p.get('Nombre'), p.get('Etiquetas de producto'), p.get('Grupo de Producto')))
    else:
        import openpyxl
        ws = openpyxl.load_workbook(ENTRADA, data_only=True).active
        cab = [clave(c.value or '') for c in ws[1]]
        col = lambda *ks: next((i for i, c in enumerate(cab) if any(k in c for k in ks)), None)
        ic, inn, ie, ig, ia = col('referencia', 'codigo'), cab.index('nombre') if 'nombre' in cab else col('nombre'), col('etiqueta'), col('grupo'), col('activo')
        for r in ws.iter_rows(min_row=2, values_only=True):
            if ia is not None and r[ia] in (False, 'False', 0):
                continue
            filas.append((r[ic], r[inn], r[ie] if ie is not None else '', r[ig] if ig is not None else ''))

productos, sin_cat = [], 0
vistos = set()
for c, n, e, g in filas:
    if not c or not n:
        continue
    cats = [NOMBRES[clave(x)] for x in str(e or '').replace(';', ',').split(',') if clave(x) in NOMBRES]
    if not cats:
        sin_cat += 1
    if str(c).strip() in vistos:
        continue
    vistos.add(str(c).strip())
    productos.append({'c': str(c).strip(), 'n': ' '.join(str(n).split()), 'e': cats, 'g': str(g or '').strip()})
productos.sort(key=lambda p: clave(p['n']))
datos = {'desplegables': DESPLEGABLES, 'cerradas': CERRADAS, 'productos': productos}
(RAIZ / 'productos.js').write_text('// Generado con herramientas/productos.py. No editar a mano.\n'
                                   'window.CATALOGO = ' + json.dumps(datos, ensure_ascii=False) + ';\n', encoding='utf-8')
for cat in DESPLEGABLES + CERRADAS:
    print(f'{cat}: {sum(cat in p["e"] for p in productos)}')
import collections
print('Grupos:', dict(collections.Counter(p['g'] for p in productos)))
print(f'Total: {len(productos)} productos · sin categoría (Nuevo/Foco/…): {sin_cat}')
