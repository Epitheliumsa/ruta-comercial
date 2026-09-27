# Ruta Comercial Epithelium

Agenda de visitas y actividades de la fuerza de ventas de Epithelium, para web y celular
(se puede instalar en la pantalla de inicio).

- **Agenda de visitas**: programar visitas por día y registrar cada una como *Visitado*
  (gestión, quién atendió, productos, muestras, pedido y valor, compromisos) o
  *No visitado* (motivo, reprogramar, observaciones).
- **Cita fija** (opcional): hora acordada con el contacto; la app avisa 15 minutos antes mientras esté abierta.
- **Actividades del mes**: el jefe (o el vendedor) programa actividades y el vendedor
  las marca como realizadas con fecha y resultado.
- **Panel del equipo** (solo jefes): cumplimiento por vendedor y motivos de no visita.
- **Descargar informe**: Excel del mes (Resumen, Visitas, Actividades) sin líneas de cuadrícula.

Los contactos salen de `contactos.json` (nombre, ciudad y etiqueta del CRM, por zona).
Mientras `API_URL` en `app.js` esté vacía, los datos quedan en cada dispositivo.
Para que el jefe vea en vivo a todo el equipo se instala `backend/Codigo.gs` en una hoja
de Google Sheets (instrucciones al inicio del archivo) y se pega su URL en `API_URL`.

Publicación: Settings > Pages > Deploy from a branch > `main` / raíz.
