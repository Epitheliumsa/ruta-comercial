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
- Ciudad (Leads y solicitudes de creación): se escoge de la lista de municipios de Colombia "Municipio - Departamento",
  Bogotá primero y luego en orden alfabético. `python3 herramientas/ciudades.py` genera `ciudades.js` desde `datos/municipios_*.json`.
- Usuarios en `USUARIOS` (`app.js`). **Al crear un comercial (o cualquier usuario) pedir siempre su fecha de
  cumpleaños** y guardarla en `cumple: 'AAAA-MM-DD'`: ese día sale resaltado en morado clarito en el Visiplan.
- Responder en español, con tono sencillo, claro y conciso, tuteando.

## Etapa de pruebas y datos para capacitaciones
- La app está **en pruebas**. Todo lo que se registre ahora (visitas, actividades, novedades, contactos
  nuevos, solicitudes) queda marcado como `pruebas`.
- **Los datos de pruebas se conservan para capacitaciones: NO se borran.** Las filas de `pruebas` de la hoja
  `Registros` del Google Sheet de Hernán se quedan ahí al salir en vivo (la app en vivo las ignora). Si algún día
  se quiere limpiar `Registros`, antes copiar esas filas a una hoja/pestaña "Capacitación – datos de prueba".
- Nunca guardar esos datos en este repositorio: es público y tienen nombres reales de clientes.
- Salir en vivo (con confirmación del usuario): cambiar `ETAPA_DATOS = 'pruebas'` por `'vivo'` en `app.js`,
  correr `sh actualizar-version.sh` y publicar. Cada celular borra una sola vez lo de pruebas que tenga guardado
  localmente (en la hoja no se borra nada) y la app ignora los registros de pruebas del servidor.
- Para una capacitación: armar en ese momento un "modo capacitación" que lea solo los datos de `pruebas`
  (copia de la app con `ETAPA_DATOS = 'pruebas'`, franja visible "MODO CAPACITACIÓN", otro nombre e ícono y
  otras llaves de almacenamiento local, para no cruzarse con la app real en el mismo celular).

## Matriz de la app (skill `matriz`)
- Toda la configuración está en un solo archivo: `datos/Matriz_App.xlsx` (Índice, Visitas, Trabajo interno, Mensual y
  Tipo de visita) → `python3 herramientas/matriz_app.py` la refresca y genera `objetivos.js`.
- Para entregarla o actualizarla usa la skill `matriz` (`.claude/skills/matriz/SKILL.md`). No se edita a mano en `app.js`.
- La Parrilla Promocional y las Actividades cambian cada mes: hoja "Mensual" o botón de jefes en la app.
- En qué tipo de visita sale cada cliente depende de su clasificación (hoja "Tipo de visita"). Los clientes 20 y 21
  (X en Visita Médica y Visita Cliente) al programar marcan **Visita Médica**, **Visita Médica Comercial** o ambas:
  Visita Médica = columna "Visita Médica"; Visita Médica Comercial = columna "Visita Médica Comercial"; ambas = una
  sola lista unida con las dos. Si el vendedor entra por "Visita Cliente", se marca Visita Médica Comercial.
- El orden de las subcategorías lo da el número que el usuario pone en la columna A de cada subcategoría.
- Objetivos y subcategorías van en nombre propio (NOMPROPIO, conectores en minúscula: "Chequeo de Precios").

## Maestra de Contactos
- Cada vez que llegue una Maestra de Contactos usa la skill `maestra-contactos` (`herramientas/maestra_contactos.py`).
- Siempre: sin las columnas "Nombre" y "Lista de Precios"; "Vacante Epithelium" es de Yunelis (Zona Sur); sin "Empleados";
  los cambios de zona rigen desde la fecha de la subida.

## Chips de selección (vendedores, zonas y cualquier filtro de este estilo)
- Un clic elige solo ese chip y desactiva los demás. Ctrl (o Cmd) + clic suma o quita chips para elegir varios.
- En el celular: mantener presionado suma o quita. El botón "Todo el equipo" / "Todas" elige todos.
- Usar la función `eleccionChip` de app.js y la clase `vp-vend-btn`, con la ayuda `AYUDA_CHIPS` al final del grupo.

## Circulares (skill `circulares`)
- Módulo **Actividades-Circulares**: resumen de circulares (vigentes, vencidas con días "---", PDF) y las tareas del mes.
- Fuente: `datos/Circulares.xlsx` → `python3 herramientas/circulares.py` genera `circulares.js`. Se cargan solo por Excel.
- En la visita, el objetivo "Actividades" muestra las circulares vigentes dirigidas al cliente (por clasificación o nombre).
- PDF: el jefe lo sube a Google Drive y pega el enlace en la app (registro `circulares-pdf`, clase `mensual`).

