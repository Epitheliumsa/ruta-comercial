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
  cumpleaños** y guardarla en `cumple: 'AAAA-MM-DD'`: ese día sale resaltado en morado clarito en todos los calendarios
  (Visiplan, semana de la agenda y calendario de fechas; rayado si cae en festivo, sábado o domingo), con su tarjeta en la agenda
  y un saludo al tocar el día o al llegar el día. El cumpleaños ya no es una opción de Novedades.
- Al programar en domingo o festivo sale el aviso con confirmación (igual que vacaciones, permisos, incapacidades).
- No se programa nada en días pasados; lo que se programa hoy después de las 8:00 a. m. queda como NO programado.
- Orden de visitas: todo lleva número (también el trabajo administrativo); el orden real se da a medida que se cierran
  (visitadas, no visitadas, leads y trabajo administrativo). El trabajo administrativo es "Todo el día" o con hora de inicio y fin obligatorias.
- Los recuadros solo se cierran con la X, Cancelar o el botón atrás (tocar afuera no los cierra). El botón atrás del Android
  cierra lo abierto o vuelve al inicio; en el inicio hay que tocarlo dos veces para salir.
- Nombres (contacto nuevo, nombre de contacto, quién atendió) van siempre en NomProp (`nombrePropio`).
- Hasta las 8:00 a. m. el vendedor cambia el orden de su día con los botones ▲ Subir / ▼ Bajar de cada tarjeta.
- Lo del Visiplan se confirma desde el día hábil anterior hasta el mismo día; si se confirma después de las 8:00 a. m. del día,
  queda como NO programado. El Visiplan se edita hasta el 2.º día hábil del mes a las 11:59 p. m.
- Toda visita programada lleva consecutivo (las NO programadas quedan de últimas) y todo reporte lleva su consecutivo real.
- La app se sincroniza sola cada 30 segundos (solicitudes de eliminación, acompañamientos, aprobaciones).
  Al rechazar una eliminación se pide la razón (50 caracteres) y le sale al vendedor.
- Maestra Clientes: ícono de calendario arriba a la derecha para el periodo de Visitados / No visitados (día, mes, trimestre, semestre, año).
- Al buscar el cliente para programar, cada opción muestra su clasificación.
- **Mercadeo** (Trabajo Administrativo, solo Coordinadora Comercial y Gerente General; columna "Mercadeo" de la hoja Trabajo interno de la Matriz):
  objetivos Proyectos (con subcategorías Contacto Cliente y Contacto Proveedores), Desarrollo Actividades Comerciales,
  Investigación de Mercado y Otros. Cada objetivo
  marcado lleva su texto (máx. 200) al programar y al cerrar. En Proyectos se escoge o crea el proyecto (clase `proyectoMercadeo`);
  en el cierre su texto queda como avance del proyecto.
  Programar algo que ya está en el Visiplan de ese día lo confirma (no se duplica). Un trabajo administrativo no se repite el mismo día.
- Una visita reportada se puede corregir (incluso pasarla de Visitado a No visitado o al revés) el mismo día y hasta las
  11:59 a. m. del siguiente día hábil; se conserva la hora del primer reporte (orden real) y queda la de la corrección.
  Esto aplica también en pruebas. Después queda bloqueada: el dueño de la visita (también el Coordinador Comercial) pide
  la corrección y le llega al Gerente General en "Solicitudes de eliminación y corrección"; si la autoriza, hay 24 horas
  para corregirla una sola vez.
- Visita futura: quien la programó la elimina directo; queda la huella (tarjeta pequeña en rojo al final del día) y no cuenta en nada.
- Acompañamiento (registro clase `acompanamiento`: vendedor = quien acompaña, solicitante = dueño de la visita): el vendedor lo pide
  desde la tarjeta a jefes y/o compañeros; quien lo recibe acepta o no y le queda la visita en su programación. Los jefes tienen
  "Acompañar" en cualquier visita (a cualquier hora, no en días pasados). Cada uno reporta la suya y en el histórico del cliente
  sale "Visita acompañada" con el reporte del otro. El servidor comparte estos registros con el solicitante.
- "Trabajo interno" se llama **Trabajo Administrativo** en la app (la hoja de la Matriz conserva su nombre).
- Obligatorios: causa al rechazar una solicitud (50), causa de Lead perdida (50), detalle de Cita médica (50); en Vacaciones el detalle es opcional,
  observaciones de no visitadas (100).
- Firmas de la solicitud de creación: primero Coordinador Comercial y después Gerente General; en el formato queda el sello
  "✔ FIRMADO ELECTRÓNICAMENTE" en la casilla de cada firma.
- Responder en español, con tono sencillo, claro y conciso, tuteando.

## En vivo desde el 1 de octubre de 2026
- `ETAPA_DATOS = 'vivo'`. Lo de `pruebas` sigue en la hoja para capacitaciones (la app en vivo lo ignora).
- El Visiplan en vivo usa otro id (`plan-<vendedor>-<mes>-vivo`) para no pisar el de pruebas. La configuración del mes
  (clase `mensual`: parrilla, listas, PDF de circulares) es la misma en pruebas y en vivo.
- Carga inicial (`cargaInicialVivo`): la capacitación del 1 oct 2026 quedó programada y cerrada para todo el equipo, y en el
  Visiplan de octubre de las zonas y la Coordinadora (con Planeación Mes el 2 oct).
- Excepción única: el Visiplan de octubre de 2026 se completa hasta el sábado 3 oct, 11:59 p. m. (`LIMITE_PLAN_EXCEPCION`).

## Etapa de pruebas y datos para capacitaciones (histórico)
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

## Leads y solicitud de creación
- Lead = contacto nuevo (registro `proyecto`). Se crea desde el módulo Leads (+ Crear Lead) o al programar (Contacto nuevo > Lead).
  Sale en la Maestra Clientes con los mismos filtros (al final, en cian) y va por aparte en todos los indicadores.
- Solicitud de creación: clasificación obligatoria + formato oficial `formatos/FTO-CME-002-1_Formato_vinculacion_clientes.xlsx`
  (se descarga, se diligencia y se sube; el servidor lo guarda en el Drive de Hernán, carpeta "Ruta Comercial - Formatos de creación de clientes").
  Llega a la jefe comercial; a Hernán solo si la clasificación es de gerencia (10-20-30-60-61-70-71).
- "Solicitudes de creación" es la bandeja de aprobación: la jefe (Coordinador Comercial) y, si es de gerencia, Hernán ven el
  formato y tocan Aprobar o Rechazar (queda su nombre y fecha como firma). Aprobada = en creación (transición) hasta la Maestra nueva.
- Al enviar la solicitud la Lead queda **ganada** y sale del Visiplan desde el mes siguiente. Cuando el cliente ya está en la
  Maestra, la jefe la confirma ("¿Ya se creó en la Maestra?" → "Sí, es este"): sus visitas pasan al cliente (quedan marcadas `eraProyecto`).

## Visita Ateneo Médico
- Tipo de visita abierto a todas las zonas. Contactos: los clientes de clasificación 61 y un contacto por cada etiqueta de la
  Maestra que dice "Ateneo" (ej: "Ateneo Universidad del Bosque", sin los médicos 20, 21 y 22), de cualquier zona (visita general con apoyo de las zonas). Objetivos (columna "Visita Ateneo Médico"
  de la hoja Visitas): Actividades, Entrega de Muestras, Parrilla Promocional (la de Visita Médica) y Productos Nuevos (sin Codificación).

## Módulo de pruebas (cuando el usuario lo pida)
- `python3 herramientas/modulo_pruebas.py <carpeta>` arma una copia idéntica de la app con el encabezado en rojo ("PRUEBAS"),
  sin servidor (todo queda en el navegador), entrada tocando el usuario (sin clave) y colores fijos en campos y listas.
- Se publica como Artifact privado (página + todos los archivos de la carpeta). Siempre en el mismo link si ya existe.

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
- Zonas: Clientes Especiales (Jennifer), Zona Norte (Lizeth), Zona Sur (Yunelis) y Zona Desarrollo (Maryi Castro, desde oct 2026).
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

