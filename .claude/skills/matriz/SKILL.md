---
name: matriz
description: Entrega o actualiza la matriz completa de Epithelium Visita (Ruta Comercial) en un solo Excel, datos/Matriz_App.xlsx - objetivos y subcategorías por tipo de visita y trabajo interno, Parrilla Promocional y Actividades del mes, y qué tipo de visita sale según la clasificación del cliente. Úsala cuando el usuario pida "la matriz", "la matriz de la app", la matriz de objetivos, subcategorías o clasificaciones, entregue una matriz corregida, cambie objetivos, subcategorías, su orden o nombres, o entregue la Parrilla o las Actividades del mes.
---

# Matriz de la app (skill "matriz")

Toda la configuración vive en **un solo archivo**: `datos/Matriz_App.xlsx`. La app no lo lee directo:
`herramientas/matriz_app.py` arma/refresca el Excel y llama a `herramientas/matriz_objetivos.py`, que genera
`objetivos.js` (lo que carga la app). Nunca se editan objetivos ni clasificaciones a mano en `app.js` ni en `objetivos.js`.

## Hojas (no cambiar el nombre de las hojas ni la fila 4 de encabezados)
- **Índice**: qué hay en cada hoja y las reglas. Lo arma el script.
- **Visitas**: fila con *Objetivo* (columna A, fondo verde, ✓ en los tipos donde sale) y debajo sus *Subcategorías*
  (columna B, X en los tipos donde salen). Subcategoría **Variable** = se carga cada mes (Parrilla Promocional, Actividades).
  Columnas: Visita Médica, Visita Médica Comercial (clasificación 20 y 21), Visita Comercial, Punto de Venta y las tres de Contacto nuevo.
- **Trabajo interno**: igual, con Trabajo Administrativo Oficina, Fuera de la Oficina y Planeación Mes.
- **Mensual**: Mes (AAAA-MM) | Objetivo | Subcategoría, para Parrilla Promocional y Actividades.
  Si un jefe las carga en la app (botón "Parrilla y actividades del mes"), mandan las de la app para ese mes.
- **Tipo de visita**: una fila por clasificación de cliente (número, categoría, clientes, etiquetas) y X en Visita
  Médica, Visita Comercial y/o Punto de Venta. Clientes y etiquetas se recalculan con `contactos.json` cada vez que corre
  el script; las X se conservan. Clasificación sin X (amarillo fuerte) = sale en todos los tipos.

## Reglas de la app
- Al programar, cada tipo de visita solo muestra los clientes de las clasificaciones con X en ese tipo.
- Clasificaciones con X en Visita Médica y Visita Comercial (hoy 20 y 21): el vendedor marca una, otra o ambas.
  Con **las dos** marcadas sale una sola lista: la columna "Visita Médica Comercial" de Visitas. Con una sola, la de ese tipo.

## Nombres
- Objetivos y subcategorías en nombre propio (como NOMPROPIO), con de/del/la/y… en minúscula y siglas (PQR) como vienen.
  El generador lo aplica solo. Si se renombra una subcategoría, agrega el nombre viejo en `SUBS_VIEJAS` de `app.js`.

## Reglas de orden (las aplica el generador)
- Objetivos y subcategorías en orden alfabético.
- Excepción: **Planeación Mes** empieza con Visiplan, Diagnóstico de Zona, Plan de Acción y Plan de Trabajo Diario
  (constante `PRIMEROS` de `matriz_objetivos.py`).
- Excepción: subcategorías con orden fijo (constante `ORDEN_SUBS`):
  - Colocación: Producto Terminado, Magistral Individual, Magistral de Pedido, Producto Nuevo.
  - Desarrollo Productos: Fórmula Magistral Nueva, Ajuste de Fórmula, Muestra de Desarrollo.
  - Devoluciones - PQR: Devolución, Queja, Reclamo, Reacondicionamiento, Sugerencia.
  - Mapa del Cliente - Ampliación Portafolio: Productos Nuevos, Productos Foco, Productos Transición, Portafolio Actual.
  - Productos Nuevos: Presentación del Producto, Entrega de Muestra, Material de Apoyo, Codificación.
  Si llega una subcategoría nueva en esos objetivos, va al final (alfabética) salvo que el usuario diga su lugar.

## Pasos
1. **Si solo pide la matriz**: corre `python3 herramientas/matriz_app.py` (refresca conteos) y entrégale
   `datos/Matriz_App.xlsx` (sin líneas de cuadrícula). Si `objetivos.js` no cambió, no hay nada que publicar.
2. **Si manda un Excel**: en una rama aparte, `python3 herramientas/matriz_app.py <ruta del Excel>`. Acepta la matriz
   completa (con sus 5 hojas) o una vieja de objetivos (toma "Tipo de visita" de la actual). Si manda cambios sueltos,
   edita `datos/Matriz_App.xlsx` con openpyxl conservando el formato y corre el script.
3. Corrige tildes y espacios de nombres nuevos (ej: "Codificacion" → "Codificación") y avísale al usuario.
4. Revisa los conteos y los `AVISO:` que imprime (subcategorías marcadas donde el objetivo no sale, clasificaciones sin X).
5. Prueba en el navegador (Playwright): al programar, los clientes del tipo, los objetivos y al marcar uno sus
   subcategorías; en el cierre salen todos, lo programado en negrita y lo demás en gris.
6. Entrégale el Excel actualizado y un resumen corto de lo que cambió.
7. **Pregunta antes de publicar** (ver CLAUDE.md). Al publicar: `sh actualizar-version.sh`, commit y push a `main`.

## Cuidado
- Las visitas ya guardadas conservan los nombres viejos de objetivos y subcategorías; renombrar no las cambia.
- Si cambia el nombre de un tipo (columna), hay que actualizar `TIPOS` en `matriz_objetivos.py` y la app.
- Clasificaciones nuevas en la Maestra salen sin X hasta que el usuario las marque: pregúntale en qué tipo van.
