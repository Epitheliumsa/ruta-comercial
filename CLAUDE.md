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
- Tipo de visita abierto a todas las zonas. Contactos: los clientes de clasificación 61 (menos las entidades gubernamentales, ej: EAB) y un contacto por cada etiqueta de la
  Maestra que dice "Ateneo" (ej: "Ateneo Universidad del Bosque", sin los médicos 20, 21 y 22), de cualquier zona (visita general con apoyo de las zonas). Objetivos (columna "Visita Ateneo Médico"
  de la hoja Visitas): Actividades, Entrega de Muestras, Parrilla Promocional (la misma de los médicos 20-21-22, aunque el
  contacto sea un ateneo o un cliente 61) y Productos Nuevos (sin Codificación). En el cierre no se pide "¿Quién atendió?".

- Visiplan (zonas comerciales), en este orden: clientes de la zona → Trabajo Administrativo (separado con una línea tenue) →
  **Ateneos** (sección índigo, igual para todas las zonas: los clientes 61 y los ateneos de las etiquetas; filas del plan como
  `ateneo|Nombre`) → Leads. Los ateneos van por aparte: **nunca suman en la Maestra de clientes** (ni en los totales del Visiplan ni en
  Visitados de la Maestra Clientes); solo en su fila "Ateneos · Obj · Real" y en el chip del resumen. En los anillos y el Panel
  salen como "Ateneo visitado" y "Ateneo no visitado", igual que los leads. Los clientes 61 salen solo en Ateneos, salvo el CDFLL, que sale también en los clientes de su zona (Jennifer).
  La fila del ateneo marca R con las Visitas Ateneo Médico. Tocando el nombre del ateneo se abre su tarjeta con el histórico.

## Módulo de pruebas (permanente)
- `python3 herramientas/modulo_pruebas.py <carpeta>` arma una copia idéntica de la app con el encabezado en rojo ("PRUEBAS"),
  sin servidor (todo queda en el navegador), entrada tocando el usuario (sin clave) y colores fijos en campos y listas.
- Link fijo: https://claude.ai/artifact/YWErS5kkwDt7LBhav1fEC3 (Artifact privado: página + todos los archivos de la carpeta).
  Siempre se publica en ese mismo link; nunca se crea otro.
- Queda guardado para futuras pruebas. La rutina "Copia diaria del módulo de pruebas (Ruta Comercial)" lo rehace cada día
  a las 5:52 am (Bogotá) con lo que esté publicado en `main` (solo si cambió `version.txt`).
- Para ensayar un cambio sin publicar: armar el módulo desde la rama de trabajo y publicarlo en el mismo link. La copia
  diaria lo vuelve a dejar igual a la app publicada al día siguiente si `main` cambió.

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


## Ventas del mes (franja en el Plan de trabajo)
- Registro `ventas-<vendedor>-<mes>` (clase `ventas`), leído del "Informe de Ventas Mensual" (Excel del sistema).
- Corte = día en que se carga (Odoo no entrega días atrás), una foto por día: al mirar un día se ve el último corte hasta ese día.
- **Lo sube Tatiana (Maryi Tatiana Castro, `subeVentas`)** y, de respaldo, el administrador. Jennifer ya no lo sube.
- Ver: los jefes (Jennifer y Hernán) ven todo, con Empleados incluido en el total; cada comercial solo su zona
  (el servidor solo le manda su registro). Las cifras nunca van en el repositorio (es público).

## Módulo de Logística (`logistica.js`)
- Usuarios: Javier Arjona (Coordinador Logístico, `coordLogistica`), Eric Ovalle y Deelan Barrero (auxiliares de domicilios y mensajería).
  Tipo de usuario `logistica` (en `app.js` y `backend/Codigo.gs`): solo ven Logística, Maestra Clientes (todas las zonas) y el Vademécum.
- Registro `logistica` = una parada de la ruta. **Un solo tipo** por parada (`tipo`), salvo la radicación, que puede ir sola
  (`tipo:'radicacion'`) o sumarse a cualquier otro (`tipos:[tipo,'radicacion']`; usar `tiposLog`/`hayTipo`/`conRadicacion`):
  Entrega Bogotá y A.M. (`entrega`; puede incluir `incluye: devolucion | pqr` = también se recoge devolución o PQR),
  Envío fuera de Bogotá (`envio`), Radicación de documentos (`radicacion`), Proveedor (`recoleccion`) y Trámite área (`vuelta`).
  `vendedor` = mensajero asignado. `hora` opcional = cita a hora fija: esas paradas van primero, por hora, y no se mueven con Subir/Bajar.
- Formulario (orden): fecha, hora (si es fija) y mensajero → cliente (Maestra) → dirección y teléfono (salen solos; editables) →
  tipo de parada → datos del tipo. Bloque "Factura" (`documentos: [{clase, ov, ovi}]`; en pantalla solo A y B): Producto Terminado = A (OVI);
  Magistral Individual = A (OVI) y/o B (OV), basta una (primero A); Magistral de Pedido = B (OV). Facturas y nota crédito RNC: 6 cifras,
  se completan con ceros a la izquierda (`seisCifras`: 58 → 000058).
  Entregas y envíos exigen al menos una clase con sus números
  (una entrega sin pedido vale si recoge devolución o PQR).
- Radicación (`radicacion: [{doc:'factura', serie:'A'|'B', numero}, {doc:'nc', numero}, {doc:'otros', texto}]`): factura A = OVI,
  factura B = OV; nota crédito RNC; otros. (No se pide número de radicado; basta la foto del sello.)
- Módulo de pruebas con direcciones: `python3 herramientas/modulo_pruebas.py <salida> <semilla.json> <Maestra Odoo con direcciones.xlsx>`
  (el Excel nunca va al repositorio; el módulo es una página privada).
- Dirección y teléfono (**datos personales: nunca en el repositorio**, que es público; `maestra_contactos.py` descarta correo, documento,
  calle y teléfonos): el administrador sube la Maestra de Odoo en Logística > "📇 Direcciones"; va a la hoja "Directorio" del Google Sheet
  (acciones `directorio` y `guardarDirectorio` en `Codigo.gs`). Logística, jefes y administrador traen todo; cada comercial, solo su zona
  (columna Zona). Se ven en la tarjeta del cliente (Maestra) y llenan solos la parada; si no hay, se usa la última parada a ese cliente.
- Envío fuera de Bogotá: al programar solo se marca la factura. Al reportar "Enviado" se llenan ciudad de destino (sale la del
  cliente en formato de municipios, `ciudadCliente`; si se cambia se piden dirección y teléfono de allá: `dirDestino`, `telDestino`),
  transportadora (lista de las usadas antes) y número de guía; quedan en la parada (`destino`, `transportadora`) y en el Excel.
- Memoria: al reportar sale la lista de quienes recibieron antes en ese cliente (`antesCliente`); en el cierre de visita comercial,
  la de quienes atendieron antes (`htmlAtendioAntes`).
- Ficha del cliente: visitas (verde azulado) y entregas (naranja) con etiqueta y título de sección; botones por cada día con movimiento
  (🤝 visitas, 🚚 entregas) y "Ver un día" con calendario: muestra todo lo que pasó ese día (`historial.dia`).
- Reporte: entregado / no entregado (con motivo), quién recibió, guía (envíos), novedades, hasta 4 fotos ("Tomar foto" con la cámara
  o "Galería o captura"). El historial del cliente muestra la hora del reporte. Las fotos se reducen en el
  teléfono y se suben a Drive (carpeta "Ruta Comercial - Entregas de logística") en segundo plano; si no hay señal quedan
  pendientes en el teléfono y se reintentan en cada sincronización.
- No entregado: "¿Qué se hace?" (opcional) → 📅 Reprogramar (fecha y hora; crea una parada nueva pendiente con lo mismo,
  `vieneDe` = fecha original) o 🏢 Devolver a la oficina (`reporte.accion`). En comercial, "Reprogramar para" también lleva hora.
- Lo reportado queda bloqueado: solo el coordinador (o el administrador) lo reabre para corregir y el reporte anterior queda en `correcciones`.
- Conexión con lo comercial: cada parada con cliente de la Maestra guarda `zona` y `comercial` (el vendedor de la zona). Ese comercial
  la ve en el historial del cliente y en "Entregas a tus clientes" (solo lectura); la jefe comercial ve todo lo de clientes; el administrador, todo.
- Servidor: logística solo lee y escribe clase `logistica` (el auxiliar, lo suyo; el coordinador, todo); un comercial solo recibe las
  paradas con `"comercial":"<su id>"`; un auxiliar no cambia un reporte ya cerrado (solo puede agregar fotos).
- El Vademécum los reconoce por el código de acceso (`acceso`, SHA-256 de "vademecum:usuario:clave"); su clave no va en el código del Vademécum.
- Informe en Excel (botón "⬇ Excel" en Logística: coordinador, administrador y jefe comercial): una fila por factura/pedido de cada parada
  (estado, hora del reporte en hora de Colombia, quién recibió, guía, novedades, enlaces de las fotos, correcciones) y hoja "Resumen"
  por mensajero y por tipo. Sin líneas de cuadrícula.
