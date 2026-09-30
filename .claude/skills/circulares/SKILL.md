---
name: circulares
description: Carga o actualiza las circulares de Ventas/Mercadeo en Epithelium Visita (módulo Actividades-Circulares y objetivo "Actividades" de las visitas) desde el Excel de resumen de circulares. Úsala cuando el usuario mande el Excel de circulares (ResumenCirculares), pida cargar circulares nuevas, corregir una circular o sus enlaces a PDF.
---

# Circulares (skill "circulares")

Las circulares viven en **`datos/Circulares.xlsx`** (hoja "Circulares", fila 1 = encabezados). La app no lee el Excel:
`herramientas/circulares.py` genera **`circulares.js`** (lo que carga la app). No se editan a mano.

## Columnas
Circular | Tipo | Nombre de la actividad | Grupo | Dirigida a (canal/cliente) | Producto | Fecha inicio | Fecha fin |
Estado | Días vencida / restantes | Objetivo | Resumen de la actividad | Observación | Enlace PDF (opcional)
- **Estado y Días los calcula la app cada día** (las columnas del Excel se ignoran). Vencida = "---" en días.
- Fecha fin vacía o "Indefinido" = vigente sin fin.
- Enlace PDF: enlace de Google Drive. Los jefes también lo pegan en la app ("+ Pegar enlace del PDF"); el de la app manda.

## "Dirigida a" → en qué visitas sale (objetivo "Actividades")
- "Canales / Subcanales 20, 21, 22" → clientes con esa clasificación (solo números de 2 cifras).
- Nombres de clientes ("Bella Piel S.A.S.", "Boston…") → los clientes de la Maestra cuyo nombre coincide.
- "(no aplica X)" → quita esos clientes.  "Todos" → todos.  "Médicos…" sin números → 20, 21 y 22.
- Internas (Fuerza de Ventas, Equipo…, Coordinadora, Canal 80 colaboradores) → solo en el módulo, no en visitas.

## Pasos
1. En una rama aparte: `python3 herramientas/circulares.py <ruta del Excel>` (copia el Excel a `datos/Circulares.xlsx`).
2. Revisa lo que imprime: a quién va cada circular y los `AVISO:` (dirigida a un cliente que no está en la Maestra).
   Cuéntale al usuario las que no coinciden.
3. Prueba en el navegador: módulo Actividades-Circulares (vigentes, vencidas con "---") y, en una visita, el objetivo
   "Actividades" con las circulares vigentes del cliente.
4. `sh actualizar-version.sh`, y **pregunta antes de publicar** (ver CLAUDE.md).
