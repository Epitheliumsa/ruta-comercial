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
  Columnas: Visita Médica, Visita Médica Comercial (clasificación 20 y 21), Visita Cliente, Punto de Venta y las tres de Contacto nuevo.
- **Trabajo interno**: igual, con Trabajo Administrativo Oficina, Fuera de la Oficina y Planeación Mes.
- **Mensual**: Mes (AAAA-MM) | Objetivo | Subcategoría, para Parrilla Promocional y Actividades.
  Si un jefe las carga en la app (botón "Parrilla y actividades del mes"), mandan las de la app para ese mes.
- **Tipo de visita**: una fila por clasificación de cliente (número, categoría, clientes, etiquetas) y X en Visita
  Médica, Visita Cliente y/o Punto de Venta. Clientes y etiquetas se recalculan con `contactos.json` cada vez que corre
  el script; las X se conservan. Clasificación sin X (amarillo fuerte) = sale en todos los tipos.

- Encabezado de la columna A: **Categoría** (antes "Objetivo"; en la app siguen siendo "objetivos"). El tipo
  **Visita Cliente** antes se llamaba "Visita Comercial": el script acepta el nombre viejo en los encabezados y la app lee
  las visitas guardadas con el nombre viejo como Visita Cliente.
- **Otros** no va en la matriz: la app lo agrega al final de los objetivos de toda visita (texto libre de 50 caracteres).

## Reglas de la app
- Al programar, cada tipo de visita solo muestra los clientes de las clasificaciones con X en ese tipo.
- "Visita Médica Comercial" aplica solo a las clasificaciones 20 y 21 (X en Visita Médica y Visita Cliente). Al
  lado del cliente se marca **Visita Médica**, **Visita Médica Comercial** o ambas:
  - Visita Médica → objetivos y subcategorías de la columna "Visita Médica".
  - Visita Médica Comercial → los de la columna "Visita Médica Comercial".
  - Ambas → una sola lista unida con las dos columnas (sin grupos).
  Si el vendedor entra por "Visita Cliente" con un cliente 20 o 21, queda marcada Visita Médica Comercial.

## Nombres
- Objetivos y subcategorías en nombre propio (como NOMPROPIO), con de/del/la/y… en minúscula y siglas (PQR) como vienen.
  El generador lo aplica solo. Si se renombra una subcategoría, agrega el nombre viejo en `SUBS_VIEJAS` de `app.js`.

## Reglas de orden (las aplica el generador)
- Objetivos en orden alfabético (Planeación Mes empieza con Visiplan, Diagnóstico de Zona, Plan de Acción y Plan de
  Trabajo Diario: constante `PRIMEROS`).
- **Subcategorías: el número que el usuario escribe en la columna A de cada fila de subcategoría es su orden** dentro
  del objetivo (1, 2, 3…). Sin número: se usa `ORDEN_SUBS` y luego el orden alfabético. Si hay números repetidos,
  avísale al usuario y pregúntale el orden.

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
