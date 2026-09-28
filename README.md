# Ruta Comercial Epithelium

Agenda de visitas y actividades de la fuerza de ventas de Epithelium, para web y celular
(se puede instalar en la pantalla de inicio).

- **Plan de Trabajo** (agenda de visitas): programar visitas por día y registrar cada una como *Visitado*
  (gestión, quién atendió, productos, muestras, pedido y valor, compromisos) o
  *No visitado* (motivo, reprogramar, observaciones).
- **Cita fija** (opcional): hora acordada con el contacto; la app avisa 15 minutos antes mientras esté abierta.
- **Cierre**: cada visita se reporta hasta las 11:59 a. m. del siguiente día hábil (con festivos de Colombia); si no, queda como NO visitada. Lo reportado no se modifica y eliminar una visita requiere autorización del administrador.
- **Novedades**: vacaciones, incapacidad y permiso (con rango de fechas) y cumpleaños. El calendario marca en gris los festivos oficiales de Colombia con su nombre y pide confirmación antes de programar en un festivo o en un día con novedad.
- **Actividades del mes**: el jefe (o el vendedor) programa actividades y el vendedor
  las marca como realizadas con fecha y resultado.
- **Panel del equipo** (solo jefes): cumplimiento por vendedor y motivos de no visita.
- **Descargar informe**: Excel del mes (Resumen, Visitas, Actividades) sin líneas de cuadrícula.

Los contactos salen de `contactos.json` (Maestra de Contactos: nombre, ciudad y etiqueta, por zona).
Mientras `API_URL` en `app.js` esté vacía, los datos quedan en cada dispositivo.
Para que el jefe vea en vivo a todo el equipo se instala `backend/Codigo.gs` en una hoja
de Google Sheets (instrucciones al inicio del archivo) y se pega su URL en `API_URL`.

Publicación: Settings > Pages > Deploy from a branch > `main` / raíz.
