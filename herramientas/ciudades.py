#!/usr/bin/env python3
"""Genera ciudades.js: municipios de Colombia como "Municipio - Departamento" para el campo Ciudad.

Uso:  python3 herramientas/ciudades.py
Fuentes (en datos/):
  municipios_dane.json   municipios con código DANE (paquete npm colombia-cities, licencia MIT)
  municipios_tildes.json mismos municipios con mejores tildes (github.com/marcovega/colombia-json)
Orden: primero Bogotá, luego todos en orden alfabético (sin importar tildes).
"""
import json, unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DANE = json.loads((RAIZ / 'datos' / 'municipios_dane.json').read_text(encoding='utf-8'))
TILDES = json.loads((RAIZ / 'datos' / 'municipios_tildes.json').read_text(encoding='utf-8'))
SALIDA = RAIZ / 'ciudades.js'

DEPTOS = {'Archipiélago De San Andrés': 'San Andrés y Providencia', 'Bolivar': 'Bolívar', 'Choco': 'Chocó',
          'Norte De Santander': 'Norte de Santander', 'Valle Del Cauca': 'Valle del Cauca'}

def clave(t):
    return ' '.join(unicodedata.normalize('NFD', t.lower()).encode('ascii', 'ignore').decode().replace('-', ' ').split())

def propio(t):
    """Nombre propio con conectores en minúscula: "Agua De Dios" -> "Agua de Dios"."""
    p = t.split()
    for i, w in enumerate(p):
        lw = w.lower()
        if i and (lw in ('de', 'del', 'y', 'e') or (lw in ('la', 'las', 'los', 'el') and p[i - 1].lower() in ('de', 'del'))):
            p[i] = lw
    return ' '.join(p)

# Tildes: por departamento y nombre sin tildes
tildes = {}
for d in TILDES:
    for c in d['ciudades']:
        tildes[(clave(d['departamento']), clave(c))] = c

ciudades = []
for d in DANE:
    depto = DEPTOS.get(d['departamento'], d['departamento'])
    for m in d['municipios']:
        nombre = tildes.get((clave(depto), clave(m['nombre'])), m['nombre'])
        nombre = propio(nombre)
        ciudades.append('Bogotá D.C.' if depto == 'Bogotá D.C.' else f'{nombre} - {depto}')

bogota = [c for c in ciudades if c.startswith('Bogotá')]
resto = sorted(set(c for c in ciudades if not c.startswith('Bogotá')), key=clave)
lista = bogota + resto
SALIDA.write_text('// Generado con herramientas/ciudades.py (municipios de Colombia, DANE). No editar a mano.\n'
                  'window.CIUDADES = ' + json.dumps(lista, ensure_ascii=False) + ';\n', encoding='utf-8')
print(f'{len(lista)} ciudades -> {SALIDA.name}')
