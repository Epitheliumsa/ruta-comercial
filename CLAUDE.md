# Instrucciones para Claude

## Publicación: siempre pedir confirmación
- **Nunca publicar sin confirmación del usuario.** Publicar es subir a `main`, porque GitHub Pages
  (https://epitheliumsa.github.io/ruta-comercial/) sirve esa rama y los vendedores la ven de inmediato.
- Flujo: hacer y probar los cambios en una rama aparte → mostrar al usuario qué cambió (con capturas
  cuando aplique) → preguntar "¿Lo publico?" → solo con un "sí" explícito, llevarlo a `main`.
- Antes de publicar, correr `sh actualizar-version.sh` para que los celulares se actualicen solos.

## Proyecto
- App web/celular de la fuerza de ventas de Epithelium: agenda de visitas, actividades del mes,
  novedades, contactos nuevos, panel del jefe y descarga en Excel (sin líneas de cuadrícula).
- Servidor: `backend/Codigo.gs` en Google Apps Script (hoja de Hernán Reyes). Si cambia, Hernán debe
  pegarlo y crear una **Nueva versión** de la implementación existente (así la URL no cambia).
- Contactos: `contactos.json` (Maestra de Contactos por zona).
- Responder en español, con tono sencillo, claro y conciso, tuteando.

## Etapa de pruebas
- La app está **en pruebas**. Todo lo que se registre ahora (visitas, actividades, novedades, contactos
  nuevos, solicitudes) es de prueba y **se debe borrar cuando la app salga en vivo**: filas de la hoja
  `Registros` del Google Sheet de Hernán y los datos guardados en cada celular/navegador.
- Al salir en vivo, recordarle al usuario este borrado y confirmarlo antes de hacerlo.
- Limpieza ya preparada en `app.js`: cambiar `ETAPA_DATOS = 'pruebas'` por `'vivo'`, correr
  `sh actualizar-version.sh` y publicar (con confirmación). Cada celular borra una vez lo de pruebas y la app
  ignora los registros de pruebas del servidor. Después Hernán puede borrar esas filas de `Registros`.

## Objetivos y subcategorías
- Salen de un solo archivo: `datos/Matriz_objetivos_subcategorias.xlsx` → `python3 herramientas/matriz_objetivos.py` genera `objetivos.js`.
- Para actualizarlos usa la skill `matriz-objetivos` (`.claude/skills/matriz-objetivos/SKILL.md`). No se editan a mano en `app.js`.
- La Parrilla Promocional y las Actividades cambian cada mes: hoja "Mensual" del Excel o botón de jefes en la app.

## Maestra de Contactos
- Cada vez que llegue una Maestra de Contactos usa la skill `maestra-contactos` (`herramientas/maestra_contactos.py`).
- Siempre: sin las columnas "Nombre" y "Lista de Precios"; "Vacante Epithelium" es de Yunelis (Zona Sur); sin "Empleados";
  los cambios de zona rigen desde la fecha de la subida.
