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
- Lo del Visiplan se confirma en cualquier momento del mes mientras no esté vencido (hasta el mismo día de la visita); si se confirma después de las 8:00 a. m. del día,
  queda como NO programado (confirmada antes de esa hora, programada). El Visiplan se edita hasta el 2.º día hábil del mes a las 11:59 p. m.; después queda cerrado para todos (también jefes y administrador).
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

## Aviso de derechos (protección de datos)
- Pie fijo, justificado y pequeño con el aviso de derechos reservados de Epithelium S.A. en todas las pantallas, **menos el login**
  (`avisoLegal` en `index.html`, `mostrarPantalla` en `app.js`, estilos al final de `visitas.css`). El año se calcula solo.
- Sin sello de seguridad en esta app (el sello es solo para usuarios externos del Vademécum).

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


## Maestra de Odoo (todo en uno) — `subirOdoo` en `bases.js`
- Una sola carga: el administrador sube la Maestra de Contactos de Odoo tal como sale (con Calle, Teléfono y Móvil), uno o varios archivos con las mismas columnas.
  La app reparte cada fila por su **Equipo de ventas**: una zona → Maestra de contactos y Direcciones; "Empleados" → Empleados; cualquier otro o vacío → Proveedores.
- Empleados y Proveedores son privados (solo Logística y administrador). Cada base se reemplaza **solo si el archivo trae filas para ella** (menos de 50 filas de zonas = archivo parcial: no toca la Maestra ni Direcciones). Antes de subir, el diálogo muestra los conteos.
- Las tarjetas por separado (Maestra de contactos, Direcciones, Proveedores, Empleados) siguen existiendo para cargar solo una base.

## Direcciones alternas (Entrega / Personal)
- Odoo exporta cada dirección de entrega o personal como una fila más (etiqueta "Direccion Entrega" / "Dirección Personal"). **No son contactos**: `subirOdoo` las pega al cliente
  (por el nombre "Cliente, Dirección" y, si no, por el NIT único con el mismo comercial) y las guarda en la hoja Directorio con las columnas `Principal` (el cliente) y `Tipo`.
  Una sin cliente que trae zona queda como contacto; sin zona, no se sube. El diálogo de carga lo cuenta.
- Logística: al escoger un cliente con varias direcciones sale el selector **Dirección de entrega** (Principal + alternas) y llena dirección y teléfono (`pintarDirSel`, `elegirDirEntrega`).
- Comerciales y jefes: en la ficha del contacto salen como **Otras direcciones** (solo informativo; `htmlDirectorioCliente`). Las **personales** solo las reciben Logística, jefes y administrador (el servidor las filtra).
- Reglas de reparto de la carga única (`tipoFilaOdoo`): dirección alterna (etiqueta Direccion Entrega / Dirección Personal) → pegada a su cliente · Empleados = equipo Empleados, etiqueta Empleado o clasificación 80 · zona (Clientes Especiales, Zona Norte, Zona Sur, Zona Desarrollo) → Maestra y Direcciones ·
  **no se suben**: Equipo de ventas Ventas Mostrador (consumidor final) y usuarios de Odoo · todo lo demás (sin equipo; con etiqueta Proveedor, Entidad Gubernamental, Junta Directiva o sin etiqueta) → Proveedores.
- Exportación de Odoo: la plantilla de columnas está en la hoja "Campos" de Plantilla_Maestra_Odoo.xlsx (se regenera con las columnas de `COLUMNAS_ODOO` en `bases.js`). Si un contacto no queda donde se espera, casi siempre es su Equipo de ventas, su etiqueta o un nombre escrito distinto (p. ej. un acento ´ en lugar de la comilla ').

## Logística: Oficina → Aforar con despacho en pasos (misma ficha)
- **Aforar sigue siendo trabajo de oficina** (tipo Oficina, con cliente y facturas). Al programarlo, si se marca Aforar aparece "Después del aforo: No / Envío fuera de Bogotá / Entrega en Bogotá" (`despacho`, `pasosLog`).
  Sin despacho, todo es como antes. Con despacho, la misma ficha tiene dos pasos que pueden hacer personas distintas:
  ① **Aforado** (botón "✓ Aforado", **foto obligatoria**; guarda `aforo: {por, cuando, detalle}` y sus fotos con `e: 'aforo'`) y ② **Enviado/Entregado** (el reporte de siempre del tipo de despacho: transportadora y guía, o quién recibió; con su propia foto: las del aforo no cuentan).
  `repTipoLog(r)` da el tipo con el que se reporta (oficina hasta aforar; después, el del despacho).
- El aforo **no cierra** la parada: queda "Aforado · falta despachar" y **todo Logística la ve y la puede avanzar** mientras esté abierta (`enPasosLog`, `compartidaLog` en `logistica.js`; `enVentanaFila_` y `enPasosLog` en `Codigo.gs`).
  La tarjeta muestra el recorrido (`htmlPasosLog`); quien despacha queda como `reportadoPor` y el aforo conserva su autor y hora. "Corregir reporte" conserva el aforo y sus fotos.
- **Quién despacha se asigna:** tras el aforo la ficha queda **"Por asignar"** (`porAsignarLog`). El coordinador o el administrador la asignan con **👤 Asignar…** (mensajero, fecha y hora; la ficha pasa a su día y su lista, `asignado: {a, por, cuando}`),
  o cualquiera de Logística la toma con **🙋 Yo lo envío / entrego** (queda asignada a esa persona y se abre el reporte). Solo quien la tiene reporta (`puedeDespacharLog`); los demás ven "Lo envía X".
  El coordinador y el administrador pueden **cambiar la asignación** (botón "👤 Cambiar…": otra persona o fecha) o **dejarla por asignar**; quien la tiene puede soltarla con "↩ Ya no puedo". Todo queda en la huella `ediciones` ("cambió el despacho de X a Y").
  El coordinador y el administrador pueden reportar el despacho directo aunque no esté asignado (queda asignado a quien lo cierra, en su lista y con fecha de ese día). El coordinador ve el aviso "N aforos por asignar".
- Las fotos pendientes de subir llevan su etapa (`{ d, e }` en la cola `rc_fotos_pend`); las antiguas (texto) siguen valiendo.

## Logística: lista de transportadoras que aprende
- El campo **Transportadora** (reporte y edición del envío) sugiere una lista que se va llenando con lo que digitan: al guardar, la transportadora nueva queda en la lista (`recordarTransportadora`) y la próxima vez sale sola.
  Vive **aparte de las bases de datos**: un registro `lista-transportadoras` (clase `lista`, campo `items`) que se sincroniza y comparte todo Logística (`listar_` lo envía siempre; `guardar_` deja escribirlo a Logística).
- La primera vez se alimenta con las transportadoras de las paradas ya guardadas; además salen siempre las de `TRANSPORTADORAS_BASE` (472, Coordinadora, Deprisa, Envía, Interrapidísimo, Saferbo, Servientrega, TCC). Se evitan duplicados sin importar mayúsculas ni tildes ("servientrega" → "Servientrega"; "TCC" se respeta).
- El coordinador y el administrador ven **"🗑 Quitar «X» de la lista"** al escribir una guardada por error (`quitarTransportadora`).

## Logística: pegar fotos (ya no hay edición de la entrega cerrada)
- Una entrega cerrada **no se edita**: solo el coordinador o el administrador la corrigen con "Corregir reporte". La ventana de edición hasta las 8:00 a. m. (botón "Editar entrega", `limiteEdicion`) se retiró: se creó para aforos y ese caso lo cubre Oficina → Aforar con despacho.
- Fotos: además de "Tomar foto", en el computador se puede **arrastrar el archivo** o **pegar una captura** (Ctrl+V) en el reporte; pasan por el mismo proceso (`agregarArchivosLog`, máx. 4). La zona de arrastre se oculta en pantallas táctiles.

## Empleados (solo Logística y administrador)
- Los empleados (clasificación 80, equipo de ventas "Empleados") **no** van en la Maestra de contactos ni en el Directorio (viajarían a todos los dispositivos).
  Tienen su propia base privada, igual que Proveedores: hoja "Empleados" del servidor (`empleados_` / `guardarEmpleados_` en `Codigo.gs`), que ven Logística y el administrador.
- El administrador la sube en **Bases de datos → Empleados** (`subirEmpleados`) con la Maestra de Contactos de Odoo: toma solo las filas con Equipo de ventas = Empleados (con Calle, Teléfono y Móvil si el archivo los trae).
- Salen en el Maestro Contactos como zona **Empleados** y en la lista de clientes del formulario de Logística, con dirección y teléfono (`empleadosMaestra`, `dirDe`). Comerciales y demás usuarios no la reciben (el servidor la rechaza).
- Nunca se guardan nombres, direcciones ni teléfonos de empleados en el repositorio.

## Perfil Mercadeo (E.Rodriguez, Jefe de RRHH y Mercadeo)
- Tipo `mercadeo` con `verEquipo` y `subeCirculares` (en `USUARIOS` de `app.js` y en `Codigo.gs`). Es de **solo lectura**: no programa ni reporta visitas.
- Ve: Panel del equipo (visitas y actividades de todo el equipo, cuota y venta por vendedor, **por línea de negocio, del total y por zona**),
  Actividades-Circulares (todas), Maestro Contactos (todas las zonas) y el Vademécum. No ve Logística, Leads, Consultar documento, Descargar informe ni Bases.
- Escribe solo los enlaces PDF de las circulares (registro `circulares-pdf`); el servidor rechaza cualquier otro registro suyo.
- `veEquipo()` = jefes o mercadeo (ven todo el equipo); `subeCirculares()` = jefes o quien tenga la marca.
- La clave solo se entrega a la persona; en el repositorio solo va la huella. También tiene acceso en el Vademécum (`USUARIOS_INTERNOS`, solo el código de acceso).

## Ventas del mes (franja en el Plan de trabajo)
- Registro `ventas-<vendedor>-<mes>` (clase `ventas`), leído del "Informe de Ventas Mensual" (Excel del sistema).
- Corte = día en que se carga (Odoo no entrega días atrás), una foto por día: al mirar un día se ve el último corte hasta ese día.
- **Lo sube Tatiana (Maryi Tatiana Castro, `subeVentas`)** y, de respaldo, el administrador. Jennifer ya no lo sube.
- Ver: los jefes (Jennifer y Hernán) ven todo, con Empleados incluido en el total; cada comercial solo su zona
  (el servidor solo le manda su registro). Las cifras nunca van en el repositorio (es público).

## Un cliente no se programa dos veces el mismo día
- Si el vendedor ya tiene una visita a ese cliente ese día (`visitaMismoDia`), no se deja programar otra: sale el aviso "ya está programado" (también al
  reprogramar, adelantar a hoy y al agendar la próxima visita o la reprogramación desde un cierre). Lo del **Visiplan no cuenta como visita**: al programar un
  cliente que está planeado ese día se une a la planeación en una sola visita (confirmación del plan); eso se conserva tal cual.
- Logística: igual lógica, pero con confirmación. Si el cliente (o proveedor) ya tiene una parada ese día (de cualquier mensajero), sale "Ya está programado ese día"
  con las paradas existentes y la pregunta "¿Vas a visitar dos veces al contacto?": **Sí, programar otra** o **No, cancelar** (`confirmarDobleParada`).
  También al reprogramar desde un "No entregado" (el reporte no se guarda hasta confirmar).

## ¿Quién atendió? por defecto
- Si el cliente es persona natural (título "Doctor" en la Maestra, o un nombre de persona sin razón social: `esPersonaNatural`), su nombre sale ya puesto en
  "¿Quién atendió?" del cierre de visita; se puede editar. Empresas y clínicas quedan vacías. Al corregir un reporte ya hecho se respeta lo que se escribió.

## Varios pedidos / facturas por línea
- Cierre de visita (Colocación): cada categoría (Producto Terminado, Magistral Individual, Magistral de Pedido) puede llevar más de un número de
  pedido: "+ Otro OV / OVI" agrega casillas y la × las quita (`filaPedidoNum`, `masPedidoNum`). Se guarda cada uno en `pedidos: [{cat, num}]`;
  un mismo número no se repite en la categoría.
- Logística: cada línea de factura (Producto Terminado, Magistral Individual, Magistral de Pedido) y, en radicación, Factura y Nota crédito RNC pueden
  llevar varios bloques ("+ Otra factura"; `masSetLog`, `quitarSetLog`): `documentos` y `radicacion` repiten la línea una vez por factura.
  En Magistral Individual la A y la B son independientes: cada una con sus casillas y su "+ Otra factura A / B" (una entrada por factura, con `ovi` o `ov`).
  Los bloques de más que se dejan vacíos se ignoran; la primera sigue siendo obligatoria y una factura repetida en la parada no se deja guardar.

## Colocación en la Visita Médica de clientes 20 y 21
- Los médicos que compran (clasificación 20 y 21) tienen también **Colocación** en la Visita Médica (con sus subcategorías y el pedido),
  sin tener que marcar Visita Médica Comercial. Los 22 no la tienen. `esMedicoComprador`, `conColocacionMedica`, `objetivosDeTipos(tipos, nuevo, cliente)`.

## Nombres del estado de una visita a cliente
- La visita pendiente que nace de la casilla "Próxima visita" del cierre (`origen: 'proxima'`) lleva la etiqueta **Visita de seguimiento**; la que nace de un "Reprogramar para" lleva **Reprogramada**.
- Visita Efectiva (reportada visitada), Visita No Efectiva (reportada como no visitada) y Sin reporte a tiempo (programada y no reportada: cerrada por
  el sistema o día pasado aún pendiente; `sinReporte`). Se usan igual en tarjeta, anillos, historial, Panel (KPIs, tablas, gráfica,
  filtro de estado), Excel (Resumen y Visitas) y Visiplan. `estadoVisitaTxt(v)` da el texto; `cuentaVisitas` devuelve `ok`, `no`, `sin`, `p`.
  El trabajo administrativo sigue con Realizado / No realizado y los Leads y Ateneos con "visitado / no visitado".

## Anillos del Plan de Trabajo
- Partes: Visita Efectiva (visitada), Visita No Efectiva (reportada como no visitada), Sin reporte a tiempo (programada y no reportada:
  día pasado aún pendiente o cerrada por el sistema, `claseAnillo` → 'sin'), Pendientes (hoy o futuro), Reprogramadas, Leads, Ateneos.
- Día, Acumulado de la semana y Acumulado del mes: toda parte de los tres se puede tocar. El del día filtra la lista del día
  (`an:<parte>`); los de semana y mes (`an-semana:<parte>`, `an-mes:<parte>`) muestran esas visitas agrupadas por día. "Quitar filtro" vuelve.

## Módulo de Logística (`logistica.js`)
- Usuarios: Javier Arjona (Coordinador Logístico, `coordLogistica`), Eric Ovalle y Deelan Barrero (auxiliares de domicilios y mensajería).
  Javier programa las paradas de sus auxiliares y también se puede asignar paradas a sí mismo (`MENSAJEROS` lo incluye de último).
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
- Envío fuera de Bogotá: al programar solo se marca la factura. Al reportar "Enviado" se piden transportadora (lista de las usadas
  antes) y número de guía; no se pregunta quién recibió. Destino = la ciudad del cliente (`ciudadCliente`, formato de municipios).
- Dirección de entrega: al reportar una parada con cliente (entrega, envío, radicación) se muestra siempre la de la parada; solo si se
  marca "Cambiar la dirección de entrega" se piden ciudad (municipios), dirección y teléfono (`destino`, `dirDestino`, `telDestino`).
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
- Anillos (como en comercial): Día, Acumulado de la semana (lunes al día) y Acumulado del mes (hasta el día), con Entregadas /
  Pendientes / No entregadas. Toda parte de los tres anillos se puede tocar (`filtrarLog('semana:no_entregado')`): la lista muestra
  esas paradas agrupadas por día; "✕ Quitar filtro" vuelve al día. En el celular se ve un anillo a la vez (botones Día · Semana · Mes).
- Lo reportado queda bloqueado: solo el coordinador (o el administrador) lo reabre para corregir y el reporte anterior queda en `correcciones`.
- Conexión con lo comercial: cada parada con cliente de la Maestra guarda `zona` y `comercial` (el vendedor de la zona). Ese comercial
  la ve en el historial del cliente y en "Entregas a tus clientes" (solo lectura); la jefe comercial ve todo lo de clientes; el administrador, todo.
- Servidor: logística solo lee y escribe clase `logistica` (el auxiliar, lo suyo; el coordinador, todo); un comercial solo recibe las
  paradas con `"comercial":"<su id>"`; un auxiliar no cambia un reporte ya cerrado (solo puede agregar fotos).
- El Vademécum los reconoce por el código de acceso (`acceso`, SHA-256 de "vademecum:usuario:clave"); su clave no va en el código del Vademécum.
- Informe en Excel (botón "⬇ Excel" en Logística: coordinador, administrador y jefe comercial): una fila por factura/pedido de cada parada
  (estado, hora del reporte en hora de Colombia, quién recibió, guía, novedades, enlaces de las fotos, correcciones) y hoja "Resumen"
  por mensajero y por tipo. Sin líneas de cuadrícula.

### Logística: novedades, Oficina, facturas con selector, devoluciones y consulta por documento
- **Reglas de fecha** (`errorFechaLog`, `confirmarDiaLog`): no a días pasados, no hoy después de las 7 p. m. (hora de Bogotá; `HORA_CORTE_LOG`), aviso con confirmación en domingos, festivos y cuando el mensajero tiene una novedad ese día.
- **Novedades** del mensajero (Cita médica, Incapacidad, Permiso, Vacaciones): se guardan como registros `clase: 'logistica'` con `tipo: 'novedad'` (así el servidor no cambia); `logRegs()` las excluye de anillos, gráfico y Excel; `novLogRegs()` las trae. Salen en un panel que se esconde.
- **Oficina** (`tipo: 'oficina'`): Aforar (cliente + facturas con tipo y serie), Alistamiento, Etiquetas, Otro (texto). Sin dirección ni teléfono.
- **Facturas con selector** (`filaDoc`, `OPC_FACTURA`): serie A (OVI) = Producto Terminado y Magistral Individual; serie B (OV) = Magistral Individual NI y Magistral de Pedido. Mismo selector en Aforar y en el pedido de Colocación de Comercial (`filaPedido` en `app.js`). El bloque "PQR - Reacondicionamientos - Devoluciones" usa PQR/OUT, REA/OUT y Devolución.
- **Proveedor / contacto "Otros"**: no está en la Maestra → dirección y teléfono obligatorios y etiqueta Otros. Los leads salen en la lista de clientes.
- **Foto obligatoria** al reportar; **segundo intento** (`intento`) y alerta de **reincidencia** (2 o más no efectivas en 30 días); **devolución** total o parcial de una factura (`reporte.devoluciones`).
- **Consultar documento** (`abrirConsultaDoc`, botón en el inicio): la puede hacer cualquier usuario. Con conexión la hace el servidor (`consultarDocumento_` en `Codigo.gs`) sobre todas las paradas y pedidos, de todos, y devuelve solo un resumen (sin direcciones, teléfonos ni fotos); sin conexión, busca en lo que hay en el teléfono. Número exacto de 6 cifras.

## Visiplan: Reprogramar / Ignorar y Maestro Medico-Cliente
- En la agenda, cada tarjeta "Planeada" del Visiplan (por confirmar o cerrada) tiene dos botones además de Confirmar: **Reprogramar**
  (elige nueva fecha, abre el formulario de programar y la visita pasa a ser una visita normal de ese día) e **Ignorar** (sale de la agenda).
  Ambos guardan en el plan `ignoradas: { "cliente|fecha": {por, cuando, reprogramadaPara?, visitaId?} }`; la X planeada del Visiplan no se mueve
  y no cuenta como visita no efectiva ni sin reporte. Las visitas programadas en firme que no se hacen siguen quedando como no visitadas.
- La Maestra Clientes ahora se llama **Maestro Medico-Cliente** (clientes, médicos, clientes y médicos, puntos de venta y leads en una sola lista)
  y tiene el filtro **Tipo** al comienzo.
- El tipo se calcula por **clasificación**, no por la etiqueta de texto (`claseContacto` en app.js): Médico = 20-21-22 · Cliente = solo los **facturables** (Facturar = Sí) de las
  clasificaciones distintas de 12, 22 y 80 (un 20 o 21 que factura es médico y cliente; si no factura, solo médico) · Punto de venta = 12 · **80 = empleados: no aparece** (Maestro ni Visiplan). Tampoco sale en el Maestro un contacto sin ningún rol (no médico, no cliente facturable, no punto de venta; hoy: Piel y Vida Prod. Dermatologicos LIQUIDADA). Los 20 y 21 son médico y cliente a la vez
  y cuentan en ambos; el resumen lo dice ("N médicos · N clientes · N puntos de venta"). Facturar Sí/No sigue siendo un filtro aparte (dato de Odoo).
- Maestro Medico-Cliente: el ícono de calendario (periodo: día, mes, trimestre, semestre, año) también muestra, en cada contacto, lo que se hizo en ese periodo
  (visitas efectivas con la última fecha y no efectivas) y, en el resumen, cuántos tuvieron visita efectiva y cuántos no.
- Visita ya reportada (efectiva): en las subcategorías de cada objetivo (p. ej. Parrilla Promocional) lo programado que sí se hizo lleva ✓ y lo
  programado que no se hizo sale tachado y en gris. Aplica en toda tarjeta/historial (`textoSubs`).
- Reprogramar/Ignorar dejan huella visible: la tarjeta pasa al final del día en gris y tachada ("Ignorada por X · fecha" / "Reprogramada para el D"),
  y la visita nueva lleva el chip "Viene del Visiplan del D" (`vieneDePlan`).
- Visitas eliminadas que reaparecían como "no visitadas" (caso Yunelis): un dispositivo que no había traído la eliminación cerraba la visita
  automáticamente ("Sin reporte a tiempo") y ese cierre, más reciente, la devolvía. Ahora `sincronizar()` primero consulta al servidor y, si la visita ya
  está eliminada, descarta el cierre automático local; y `backend/Codigo.gs` (`guardar_`) rechaza un cierre `actualizadoPor:'sistema'` sobre una visita eliminada.
  Hay que pegar `Codigo.gs` en Apps Script y crear una Nueva versión.
- Visitas reportadas que reaparecían como "Sin reporte a tiempo" (caso Lizeth/Maryi): un dispositivo con copia vieja (p. ej. el del jefe, que cierra lo vencido de todo
  el equipo, abierto después de horas cerrado) veía la visita como pendiente, la cerraba automáticamente y ese cierre, más reciente, tapaba el reporte.
  Ahora (1) `cerrarVencidas()` no cierra nada hasta haber traído lo del servidor en esa sesión, (2) `sincronizar()` descarta el cierre local si en el servidor la visita ya
  está reportada o eliminada y (3) `backend/Codigo.gs` rechaza un cierre `actualizadoPor:'sistema'` sobre una visita ya reportada. Pegar `Codigo.gs` y crear Nueva versión.
- Corrección PROVISIONAL de visitas "Sin reporte a tiempo" (`CORRECCION_PROV` en app.js; y `correccionProv` en `backend/Codigo.gs`): desde el 15 de oct de 2026 hasta el
  viernes 16 de oct, 6:00 p. m. (Colombia) la dueña de la visita puede reportarla tal cual sucedió (Visita Efectiva o No Efectiva), sin mover la fecha (no se reprograma).
  Mientras dura, la tarjeta dice "Corrección visita Sin Reporte a tiempo", un aviso arriba de la agenda cuenta cuántas hay y su botón las filtra (anillo del mes, "Sin reporte a tiempo").
  Al corregirse queda la huella `correccionProvisional` (chip "Corregida · antes: Sin reporte a tiempo"), `cierreAutomatico` pasa a false y la visita cuenta como Efectiva o No Efectiva.
  Pasada la hora, lo no corregido vuelve a mostrarse como "Sin reporte a tiempo". Hay que pegar `Codigo.gs` y crear Nueva versión (sin eso el servidor rechaza el cambio a Efectiva).
- Histórico del cliente (verCliente y ateneo): una visita acompañada sale UNA sola vez (`agruparAcomp`, `htmlReporteHist`): "Visitaron: A y B" y debajo el reporte de cada uno
  (titular y acompañantes), también para quien solo ve su propia visita (usa la copia del reporte del acompañamiento). Los contadores cuentan la visita una vez.
- Agenda, solo jefes: filtro de **Novedades** (Cita médica, Incapacidad, Permiso, Vacaciones) del equipo en el mes que se está viendo. Los botones llevan cuántas hay de cada tipo;
  al tocar uno la lista muestra todas las de ese tipo (quién, fechas, nota) y "Quitar filtro" vuelve al día. No sale para los comerciales (`agenda.novTipo`, `filtrarNovedades`).
- Logística, formulario de parada: el **tipo de parada va primero** y después Cliente/Proveedor; al **editar**, el cliente o proveedor queda **bloqueado** (para otro se elimina y se programa de nuevo).
  Los tipos *Entrega Bogotá y A.M.* y *Envío fuera de Bogotá* tienen casillas de lo que también incluyen (PQR/OUT, REA/OUT, Devolución); cada una pide el **número del documento** (6 cifras) y admite varios (`+ Otro`), guardados en `incluyeDocs`. Si se marca una, las facturas pasan a ser opcionales, como en la entrega con devolución o PQR.
  Con tipo *Proveedor* el campo de arriba es "Proveedor / Busca proveedor" (sin Cliente salvo que también se radique); con *Trámite área* se llama "Contacto". Orden: tipo, cliente/proveedor, dirección, teléfono, factura, lo que incluye, radicación, qué se recoge/área, indicaciones.
  Cada edición de una parada deja huella (`ediciones`: quién, cuándo y qué campos cambiaron) y la tarjeta muestra "✏️ Editada por X · fecha · cambió …".
- Circular 2026-035 (Alcance a la 2026-033, canales 70 y 90: bonificado 10+2 y 6+2 con 1 unidad de alta rotación): se agregó a `datos/Circulares.xlsx` para canales 70 y 90 (Bella Piel es clasificación 10, por eso no necesita la exclusión). PDF pendiente de cargar desde la app (jefes).
- Logística, reporte "Entregado/Enviado/Radicado/Recogido": trae **lo programado** (cada factura A/B, PQR/OUT, REA/OUT, Devolución, lo que se radica o se recoge) con casillas ya marcadas; se desmarca lo que no se hizo
  y queda en `reporte.programado` / `reporte.faltantes` ("⚠ Sin hacer: …" en la tarjeta, el informe y el Excel). Igual que en comercial, donde el cierre trae los objetivos programados.
- Logística, anillos con los mismos estados que comercial: **Atendidas / No efectivas / Sin reporte a tiempo / Por recibir**. Una parada pendiente de un día ya pasado cuenta como "Sin reporte a tiempo" (`claseLog` en `logistica.js`). Cada tarjeta conserva el verbo de su tipo (Entregado/Enviado/Radicado/Recogido).
- Logística, "📊 Gráfico de entregas" del mes (`graficoLog`): barras apiladas por estado, agrupadas por día, tipo de parada o mensajero; respeta el filtro de mensajero.
- Logística, nuevo tipo de parada **Bancos** (`TIPOS_LOG.banco`): pide banco (lista de bancos o texto libre, se guarda en `entidad`) y "Qué hay que hacer"; no pide cliente. El reporte es como el de Trámite área (Realizado / No realizado, resultado).
- Logística, la **radicación de documentos** puede ser a un cliente o a un proveedor (selector "La radicación es a", salvo en entrega y envío): si es a proveedor se pide el proveedor en vez del cliente (`radAProv`).
- Logística, gráfico de entregas: la vista "Por mensajero" es solo para el coordinador de logística (y el administrador); el auxiliar ve "Por día" y "Por tipo de parada".
- Logística, **Maestra de proveedores** (solo Logística y administrador): el administrador la sube en Logística > "🏭 Proveedores" (Excel con Nombre, Ciudad, Provincia, Etiquetas) y queda en la hoja "Proveedores" del servidor (acciones `proveedores` y `guardarProveedores` en `Codigo.gs`), **no** en el repositorio público. Alimenta la lista "Busca proveedor" del formulario (junto con los proveedores ya usados). El módulo de pruebas la recibe como 4.º argumento de `herramientas/modulo_pruebas.py`.
- El módulo se llama ahora **Maestro Contactos** (antes Maestro Medico-Cliente). Los proveedores (información básica: nombre, ciudad, departamento y etiquetas, de la hoja privada "Proveedores") salen como una "zona" más y un botón de tipo "Proveedores" **solo para Logística y el administrador** (`veProveedores()`); no tienen visitas ni facturación y no abren historial. Los comerciales y jefes no los ven.
- Maestro Contactos para **Logística**: solo búsqueda, botones de tipo y la lista; sin filtros de columnas ni gráfica de composición (los demás roles los conservan).
- Maestro, Logística: en vez de los botones de zona hay un filtro "Zona" (zona y vendedor, con Proveedores) y cada ficha de cliente/médico/punto de venta muestra su zona y vendedor. El buscador dice "Buscar contacto...".
- Maestro: la ficha del proveedor (toque en su tarjeta) muestra etiqueta, ciudad, dirección y teléfono (si la Maestra de proveedores trae Calle, Teléfono y Móvil) y sus paradas de Logística; al elegir un proveedor en el formulario de parada, la dirección y el teléfono se llenan solos. La hoja "Proveedores" ahora tiene también Dirección y Teléfono (`Codigo.gs`).
- Maestra de proveedores: si Odoo trae un proveedor dos veces ("Empresa" y "Empresa, Persona", con el mismo NIT) se deja solo el que tiene nombre y razón social ("Empresa, Persona"), con la dirección más completa de los dos; se aplica al subir el Excel.
- Direcciones: al tocar la dirección (ficha del cliente, del proveedor y tarjeta de la parada) se abre un menú para llevarla a **Google Maps** o **Waze** (`enlaceDir` / `abrirMapa`, con la ciudad si la dirección no la trae).
- Maestro, Logística: el filtro "Zona" arranca sin casillas marcadas y solo filtra cuando se marcan una, dos o tres zonas ("Todas las zonas" lo quita); Proveedores va de último. Las direcciones y teléfonos de la ficha llevan subrayado fino y suave.
- Solicitudes de eliminación y corrección (administrador): cada solicitud tiene el botón **Ver la visita** (abre la agenda de ese vendedor en ese día y resalta la visita) y, en las de eliminación, dice si de verdad hay más de una visita al cliente ese día (`verificaRepetida`). Las tarjetas con el mismo cliente dos veces el mismo día muestran "⚠ Repetida". Red de seguridad extra contra el doble: al aceptar un acompañamiento y al agendar la próxima visita no se crea otra si ya existe (`visitaMismoDia`).
- "Sin reporte a tiempo" es lo único que corresponde a todo lo programado y no reportado a tiempo: también los leads y los ateneos (ya no cuentan como "Lead no visitado" / "Ateneo no visitado"). Aplica al anillo, a los filtros de la agenda, al panel y al Excel. El trabajo administrativo sigue con "Realizado / No realizado".
- Solicitudes (eliminación/corrección y creación): lo pendiente va primero, en grande; lo ya aprobado o rechazado queda abajo como **Historial**, en pequeño, con quién lo resolvió, cuándo y la causa (`resueltas` en `abrirSolicitudes` y `abrirProyectos`). Incluye las visitas ya eliminadas.
- Avisos de aprobaciones (`revisarAprobaciones`): banner + notificación del celular cuando llega algo por aprobar (administrador: eliminación y corrección de visitas; jefes: solicitudes de creación en su turno de firma; todos: solicitudes de acompañamiento). Cada solicitud avisa una sola vez; con la app cerrada, avisa al abrirla. El botón "Activar avisos en este celular" sale también a los jefes.
- Visitas cerradas: el dueño y los jefes (no el administrador) tienen **✏️ Editar (lo aprueba Hernán)** cuando ya no se puede corregir directo. Editan el reporte con el mismo formulario, pero nada cambia: queda una propuesta (`edicionPendiente`, con antes y después) que el Gerente General aprueba o rechaza en "Solicitudes de eliminación y corrección" (`proponerEdicion` / `resolverEdicion`). Al aprobar se aplica el reporte, se copia al acompañante y se crean la próxima visita o la reprogramada si la edición las trae. Queda en el historial y avisa como las demás aprobaciones. No aplica al trabajo administrativo ni a Mercadeo.
- Maestro Contactos, "En el periodo": el cliente con visitas no efectivas y ninguna efectiva dice **Contactado sin visita efectiva · N no efectivas**; "sin visitas" queda solo para quien no tuvo ninguna. El resumen separa: con visita efectiva · contactados sin visita efectiva · sin visitas (sin contar proveedores).
- Historial de solicitudes (administrador): primero el nombre del cliente; filtros de zona, tipo, resultado, fecha (hoy, semana, mes, mes anterior) y causal (texto); y un **resumen** que sigue a los filtros: resueltas, autorizadas y rechazadas con porcentaje, respuesta media, y barras por tipo, zona, vendedor, mes y causales más frecuentes (`pintarHistSol`).

## Bases de datos (solo el administrador) — `bases.js`
- Cada tarjeta tiene **⬇ Descargar** (`descargarBase(k)`): respaldo en Excel sin cuadrícula de lo que está cargado (Maestra_Contactos, Productos con hoja "Guía de Etiquetas", Direcciones —se trae fresco del servidor—, Proveedores). Los archivos se pueden volver a subir tal cual. `ponerDirectorio` guarda también el nombre original (`n`).
- Tarjeta **Vademécum**: sube Vademecum_Epithelium (productos → base `vademecum`) y/o Vademecum_clientes (un portafolio por cliente → bases `pf_<huella>`; la huella sale de `portafolios-index.json` publicado por el Vademécum). El Vademécum los lee con acciones públicas de solo lectura (`vademecumMaestro`, `vademecumPortafolio`) y, si fallan o están vacías, usa sus archivos publicados. `guardarBases` guarda todo en una sola pasada. Requiere pegar `Codigo.gs` y crear nueva versión. `lib/exceljs.min.js` se parchó para leer Excel con tablas (`tables.filter(Boolean)`).
- Botón **Bases de datos** en el inicio (solo `esAdmin()`). Ahí se suben las maestras: **Maestra de contactos** (misma lógica que `herramientas/maestra_contactos.py`),
  **Productos** (Base_Productos + Productos_Terminados, misma lógica que `herramientas/productos.py`), **Direcciones y teléfonos** y **Proveedores**. Se quitaron los
  botones 📇 Direcciones y 🏭 Proveedores de Logística.
- Contactos y productos se guardan en el servidor (hoja "Bases" de `Codigo.gs`: acciones `guardarBase`, `leerBase`, `versionesBases`, `estadoBases`; el contenido va en partes de
  40.000 caracteres) y **reemplazan** a `contactos.json` y `productos.js` para todos los usuarios: `cargarBases()` los trae al sincronizar (cada 10 min como mucho) y los
  guarda en el teléfono (`rc_base_contactos`, `rc_base_catalogo`). Mientras no se haya subido nada, la app usa lo publicado.
- Productos: Base_Productos trae las materias primas (MP) y Productos_Terminados los terminados (PT). Se puede subir **uno solo o los dos**: cada archivo reemplaza solo su familia y el resto del catálogo se conserva (`subirCatalogo`).
- Portafolios por cliente, circulares y matrices siguen saliendo del repositorio (necesitan el Vademécum); no se suben desde aquí.
- Probado con los mismos Excel de `datos/`: el catálogo y los contactos salen idénticos a los publicados.
- Los filtros de vendedor, zona y mensajero se borran al salir de una pantalla: jefes y administrador vuelven a abrir en **todo el equipo** (agenda, Visiplan, panel, actividades, Maestro y Logística) (`todoElEquipo`, `limpiarFiltros`). Antes la agenda abría con la primera comercial (Lizeth).
- Visitas cerradas, **administrador**: ve **✏️ Editar** en toda visita ya reportada y la edita directo (sin pasar por aprobación); queda su nombre como huella ("corregida … por Hernán", `editadaPorAdmin`). Los demás siguen con "Editar (lo aprueba Hernán)".
- Maestro Contactos: "Contactado sin visita efectiva" ya no va en la línea "En el periodo"; reemplaza a "Sin visitas" en la columna de la derecha, para quien tiene visitas no efectivas reportadas y ninguna efectiva. La línea del periodo solo dice "N no efectivas".
- Maestro, gráfica de composición: cuando un contacto cuenta en más de una barra (médico y cliente a la vez, en "Tipo"), cada barra muestra dos porcentajes: sobre los contactos y, en gris, sobre el total de las barras. Si no hay cruce, sale uno solo.
- Panel del equipo: los filtros llevan título (Vendedor, Tipo de visita, Estado) y el **Estado** filtra todo el panel (cifras, gráficas, tablas y detalle), no solo el detalle de abajo (`pasaEstadoPanel`).
- Panel del equipo: periodo de **día, mes, trimestre, semestre o año** (botones arriba, flechas para mover y toque en el título para elegir; es el mismo selector del Maestro). Cifras, gráficas (por día en el mes, por mes en trimestre/semestre/año), actividades y detalle siguen al periodo; al salir vuelve al mes actual. `sincronizar` acepta un rango para traer varios meses.
- Panel del equipo: bloque **Cuota y ventas** bajo las cifras: cumplimiento, venta de la cuota, faltante, ritmo y semáforo (dentro de un mes) y una tabla por vendedor con total. Sigue el periodo (suma los meses que cubre, con el último corte de cada uno; un día usa el corte hasta ese día) y el filtro de vendedor. Los datos son los del informe de ventas que ya se carga; no hay cifras en el código.
- Panel, cuota y ventas por **día**: como los cortes son acumulados del mes, lo vendido en el día es el corte de ese día menos el corte anterior (el último disponible; el día 1 usa el corte completo), y la cuota del día es la cuota del mes entre los días hábiles (cero en días no hábiles). Mes, trimestre, semestre y año suman las cuotas y lo vendido de los meses que cubren.
- Panel del equipo: los textos siguen al periodo (Por vendedor · día/mes/trimestre/semestre/año, "Sin visitas fallidas en este …"), y con el filtro de día el "Indicador del día" es el de ese día.
- **Panel Zona** (comerciales): en el inicio, botón "Panel Zona" con el mismo panel pero solo de su zona (visitas, actividades, cuota y ventas, con filtros de periodo, tipo y estado); sin filtro de vendedor. Los jefes siguen con "Panel del equipo".

## Bases de datos: solo la Maestra de Odoo
- En **Bases de datos** quedan solo Maestra de Odoo (todo en uno), Productos y Vademécum. Contactos, Direcciones, Proveedores y Empleados ya no tienen tarjeta propia: se cargan y se descargan desde la Maestra de Odoo.
- No inferir direcciones alternas por "Nombre, Algo" + mismo NIT: los médicos de una clínica llevan ese mismo patrón y NIT y se perderían como contactos (se probó y quitó). Solo son direcciones alternas las filas con etiqueta Dirección Entrega / Personal.

## Logística: quién ve qué (visual)
- El coordinador (Javier) y el administrador ven **todas** las paradas, incluido si ya se aforó o no y a quién se asignó. Eric y Deelan ven **solo las suyas**: las que se les programaron o se les asignaron
  (al asignar, la parada pasa a su nombre: `vendedor`) — `logVisibles` en `logistica.js`. Ya no hay "Yo lo envío / entrego": el despacho lo asigna el coordinador (el auxiliar ve "Por asignar: lo asigna Javier Arjona").
- El servidor también lo aplica (`listar_` y `guardar_` en `Codigo.gs`): un auxiliar solo recibe y solo escribe las paradas cuyo `vendedor` es él. `enVentanaFila_` (parada compartida) se retiró.
  Al asignar a otra persona, la parada guarda `previos: [id de quienes la tuvieron]`; a ellos el servidor les manda solo una marca mínima (`traspasada: true`: id, tipo, fecha, estado, vendedor nuevo, sin cliente ni dirección) para que su teléfono la deje de mostrar.
  `logRegs()` en `logistica.js` también filtra por `vendedor` en el teléfono de un auxiliar. Pegar `Codigo.gs` y crear Nueva versión.
- La huella "Editada por …" ya no antepone "cambió" a las acciones (asignó / dejó / cambió el despacho).

## Logística: remisiones
- En la parada de Entrega / Envío, el bloque "PQR - Reacondicionamientos - Devoluciones - Remisiones" (`INCLUYE_ENVIO`) tiene también el tipo **Remisión** en tres tipos (`remision_pt` Producto Terminado, `remision_mi` Magistral Individual, `remision_mp` Magistral de Pedido; `esRemisionLog`; número libre, sin serie; el número es opcional y libre: letras siempre en mayúscula, números y símbolos, sin límite de caracteres; solo se busca en «Consultar documento» si es solo de dígitos). Va en `incluyeDocs`; con una remisión sola la factura deja de ser obligatoria. Sale como chip, en la consulta por documento y en el Excel como el resto de lo que incluye. Pegar `Codigo.gs` (consulta por documento).
- Las remisiones se escogen **en el bloque de facturas**: cada fila tiene un filtro **Factura / Remisión** (`cambiaFamDoc`) y, según eso, el tipo (Producto Terminado, Magistral Individual, Magistral de Pedido). Se guardan en `incluyeDocs` (`remision_*`); al editar vuelven a su fila. El bloque de PQR/REA/Devoluciones ya no las trae.
## Vista previa antes de publicar (carpeta `pruebas/`)
- Para que el administrador vea un cambio con datos reales **antes** de publicarlo: `python3 herramientas/vista_previa.py <rama>` copia esa rama a `pruebas/` y se sube a `main`
  **tocando solo `pruebas/` y la herramienta** (nunca los archivos de la raíz), con la confirmación del administrador. Se ve en https://epitheliumsa.github.io/ruta-comercial/pruebas/ — modo prueba permanente (franja "VISTA PREVIA", nada se guarda en el servidor, sin service worker).
- Flujo: trabajar en una rama → `vista_previa.py` → (con su confirmación) subir **solo** `pruebas/` → el administrador revisa → ajustes (se repite) → con su "sí, publica" se publica la rama a la raíz y se avisa si hay que pegar `Codigo.gs`.
- Subir `pruebas/` a `main` y publicar la raíz siguen necesitando la confirmación del administrador (regla de arriba: nunca publicar sin confirmación). Los cambios de `Codigo.gs` no se ven en la vista previa (el servidor es uno solo).
- El enlace `?prueba` de la app oficial sigue siendo la app publicada en modo prueba; no muestra ramas.

## Eliminar solo el administrador y base cerrada de clientes
- **Eliminar paradas de Logística** (mismas condiciones que la visita comercial): el administrador elimina directo (`eliminarLog`, también paradas ya reportadas); quien programó la parada o el coordinador elimina directo **solo una parada pendiente de un día futuro**;
  en cualquier otro caso ve **"Solicitar eliminación"** (`solicitarEliminacionLog`, con el motivo) → queda `solicitudEliminar` pendiente ("Eliminación por autorizar") y **solo el administrador** la autoriza o rechaza (causa de máx. 50 caracteres) desde el módulo **«Solicitudes de eliminación y corrección»** del inicio (sección "🚚 Eliminación de paradas de Logística": `abrirSolicitudes`, `resolverSolicitudLog`; también cuentan en la tarjeta, en los avisos y en el historial) y desde el aviso "🗑 N solicitudes" de la pantalla de Logística. El servidor lo exige (`guardar_`): un no administrador solo puede poner `borrado` en una parada pendiente futura, y no puede aprobar ni rechazar solicitudes.
  Las novedades del mensajero no cambian. Pegar `Codigo.gs`.
  En la agenda comercial **no cambió**: quien programó una visita futura la elimina directo (queda la huella en rojo); las visitas ya vencidas o reportadas piden autorización al administrador.
- **Base cerrada de CLIENTES en Logística**: no se crean clientes nuevos (`guardarLog`): hay que escogerlos de la Maestra (también valen los leads y los empleados); una parada vieja conserva el suyo.
  Un **proveedor** o un **contacto de Trámite área** que no es cliente sí se escribe a mano: queda con nombre propio (`nombrePropio`) y **guardado en memoria** para la próxima vez, con su dirección y teléfono
  (registro `lista-otros-log`, clase `lista`, `items: [{t: 'prov'|'cont', n, dir, tel}]`; se sincroniza y lo ven todos en Logística; no es una base de datos; `recordarOtro`, `otrosGuardados`). Los contactos guardados solo salen en la lista de Trámite área, no en la de clientes.

## Logística: correcciones de reportes (huella y fotos)
- **Corregir reporte** (`reabrirLog`) deja la parada pendiente pero **conserva las fotos** de la entrega (antes se pasaban solo al historial y la tarjeta quedaba "Sin foto"); el nuevo reporte no pide otra foto si ya hay una.
- Cada corrección deja **huella** en la tarjeta (`huellaCorreccionesLog`): el reporte anterior (hora y quién), qué decía, quién reabrió y cuándo, con sus fotos si ya no están en el nuevo reporte; el nuevo reporte lleva su hora ("Reporte corregido el …").

## Logística: fotos (subida y adjunto en un solo paso)
- La foto se sube a Drive **y se agrega a la parada en el mismo paso, en el servidor** (`subirArchivo` con `registro`, `etapa` y `huella`; `subirFotoParada_` en `Codigo.gs`). Antes el teléfono subía el archivo y luego reescribía el registro entero:
  si entretanto la parada cambiaba de dueño (asignación del despacho) o el teléfono tenía una copia vieja, el servidor rechazaba o pisaba esa escritura y la foto quedaba en Drive pero la tarjeta decía "Sin foto".
- La foto espera en la cola (`rc_fotos_log`) mientras la parada no haya llegado al servidor (`pendientes`); un reintento no duplica (`huella`). Si Drive no sirve la miniatura, la imagen prueba un enlace de respaldo (`miniFotoRespaldo`).
- Diagnóstico si fallan: Apps Script > Ejecuciones (errores de `doPost`) y el script de diagnóstico de Drive (crear, compartir, espacio, fotos del día). Pegar `Codigo.gs`.

## Acompañamientos, muestras y circulares (cambios recientes)
- **Acompañamientos vigentes por fecha** (`acompVigentes`): un acompañamiento vale para el día de la visita. Si la visita se reprograma o se adelanta, los del día anterior ya no
  cuentan (ni chip "Acompaña…" ni excluyen a la persona de la lista) y `liberarAcompanamientos` los cancela (borra la solicitud y la visita del acompañante si no ha reportado).
  La lista para pedir acompañamiento excluye a **Logística y Mercadeo** (solo jefes y comerciales).
- **Muestra Médica**: al programar, al marcar Entrega de Muestras > Muestra Médica sale la lista de muestras médicas del catálogo (grupo `Muestras`, `muestrasMedicas`); lo escogido queda
  en la visita (`muestrasPlan`) y al reportar se precarga en "Muestras entregadas". Las muestras no vienen de Odoo: se agregan en `EXTRAS` de `herramientas/productos.py` (ej. MU0048) y se regenera `productos.js`.
- **Circular nueva** (ej. parrilla): fila en `datos/Circulares.xlsx` (hoja Circulares, copiar el estilo de la fila anterior y extender la tabla) → `python3 herramientas/circulares.py` → versión.
  Las fechas Desde/Hasta van **como dice la circular**. La lista de Parrilla Promocional de la visita sale de la circular vigente a la **fecha de la visita**. El PDF lo pegan los jefes desde la app.
- **Ficha del cliente** (historial): junto a la ciudad muestra zona y visitador médico, ej. "Zona Sur-Yunelis Caballero" (`zonaVisitador`); no en zonas privadas (Proveedores, Empleados).
