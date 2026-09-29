---
name: matriz-objetivos
description: Actualiza la matriz de objetivos y subcategorías de Epithelium Visita (Ruta Comercial) desde un solo Excel. Úsala cuando el usuario entregue o pida la "matriz de objetivos", la "matriz de subcategorías", cambie objetivos o subcategorías de una visita o del trabajo interno, o entregue la Parrilla Promocional o las Actividades del mes.
---

# Matriz de objetivos y subcategorías

Todo vive en **un solo archivo**: `datos/Matriz_objetivos_subcategorias.xlsx`. La app no lo lee directo:
`herramientas/matriz_objetivos.py` lo convierte en `objetivos.js`, que es lo que carga la app.
Nunca se editan los objetivos a mano en `app.js` ni en `objetivos.js`.

## Estructura del Excel (no cambiar encabezados ni la fila 4)
- **Visitas** y **Trabajo interno**: fila con *Objetivo* (columna A, fondo verde) = objetivo, con ✓ o X en los tipos
  donde sale. Filas de abajo con *Subcategoría* (columna B) = sus subcategorías, con X en los tipos donde salen.
  Subcategoría escrita **Variable** = se carga cada mes (Parrilla Promocional y Actividades).
  - Columnas de Visitas: Visita Médica, Visita Médica Comercial (clasificación 20 y 21), Visita Comercial, Punto de Venta y las tres de Contacto nuevo.
  - Columnas de Trabajo interno: Trabajo Administrativo Oficina, Fuera de la Oficina, Planeación Mes.
- **Mensual**: Mes (AAAA-MM) | Objetivo | Subcategoría, para Parrilla Promocional y Actividades.
  Si un jefe las carga en la app (botón "Parrilla y actividades del mes"), mandan las de la app para ese mes.

## Reglas de orden (las aplica el script)
- Objetivos y subcategorías en orden alfabético.
- Excepción: **Planeación Mes** empieza con Visiplan, Diagnóstico de Zona, Plan de Acción y Plan de Trabajo Diario
  (constante `PRIMEROS` del script).

## Pasos
1. Si el usuario manda un Excel con el mismo formato, cópialo encima de `datos/Matriz_objetivos_subcategorias.xlsx`.
   Si manda cambios sueltos (texto o una matriz vieja), edita el Excel con openpyxl conservando el formato
   (sin líneas de cuadrícula, fila verde por objetivo, X azules).
   Si manda la Parrilla o las Actividades del mes, agrégalas en la hoja **Mensual**.
2. Corrige tildes y espacios de los nombres nuevos (ej: "Codificacion" → "Codificación") y avísale al usuario.
3. Trabaja en una rama aparte y corre: `python3 herramientas/matriz_objetivos.py`.
   Revisa los conteos y los `AVISO:` (subcategorías marcadas en tipos donde el objetivo no sale).
4. Prueba en el navegador (Playwright): al programar salen los objetivos del tipo y, al marcar uno, sus subcategorías;
   en el cierre salen todas, lo programado en negrita y lo demás en gris.
5. Entrégale al usuario el Excel actualizado (sin líneas de cuadrícula) y un resumen corto de lo que cambió.
6. **Pregunta antes de publicar** (ver CLAUDE.md). Al publicar: `sh actualizar-version.sh`, commit y push a `main`.

## Cuidado
- Las visitas ya guardadas conservan los nombres viejos de objetivos y subcategorías; renombrar no las cambia.
- Si cambia el nombre de un tipo (columna), hay que actualizar `TIPOS` en el script y la app.
