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

## Actividades (en la visita)
- Solo salen circulares de clientes: no las internas, ni las de Tipo "Informativa", ni las de parrilla (nombre con
  "Parrilla Promocional" o un "Alcance" que cita una circular de parrilla).
- Al marcar una circular se abren sus **productos** para escoger (códigos de la columna Producto) y su **Objetivo** como desplegable de solo lectura ("Ver objetivo"), que no se marca.

## Parrilla Promocional
- En la visita, el objetivo "Parrilla Promocional" muestra como subcategorías los productos de la circular de parrilla
  vigente para el cliente (nombre con "Parrilla Promocional"), **en el orden de la columna Producto**. Los códigos
  `[XX0000]` se leen de esa columna; el nombre sale del catálogo (productos.js) o, si no está, del texto de la circular.
- Si no hay parrilla vigente para el cliente, se usa la hoja "Mensual" de la matriz (si tiene algo) o sale el aviso.

## Circular anulada
- Tipo **"Anulada"** en el Excel (sin fechas, Dirigida a "N/A"): sale en el módulo en gris, con el chip "Anulada" y el
  filtro "Anuladas", y nunca sale en las visitas. Los avisos de "sin fecha" y "N/A" del script son normales.

## Revisión del PDF
- Firmas: siempre va la del Gerente General (Hernán Reyes) y la de Erika Rodríguez (Mercadeo) o la de Jennifer Herrera.
  No todas las casillas de Aprobaciones tienen que estar firmadas: no se anota como faltante.

## Pasos
1. En una rama aparte: `python3 herramientas/circulares.py <ruta del Excel>` (copia el Excel a `datos/Circulares.xlsx`).
2. Revisa lo que imprime: a quién va cada circular y los `AVISO:` (dirigida a un cliente que no está en la Maestra).
   Cuéntale al usuario las que no coinciden.
3. Prueba en el navegador: módulo Actividades-Circulares (vigentes, vencidas con "---") y, en una visita, el objetivo
   "Actividades" con las circulares vigentes del cliente.
4. `sh actualizar-version.sh`, y **pregunta antes de publicar** (ver CLAUDE.md).
