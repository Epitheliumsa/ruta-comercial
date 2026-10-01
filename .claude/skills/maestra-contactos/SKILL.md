---
name: maestra-contactos
description: Actualiza los clientes de cada zona de Epithelium Visita (Ruta Comercial) cuando el usuario sube una nueva Maestra de Contactos de Odoo (archivo tipo AAAAMMDD_Maestra_de_Contactos.xlsx). Úsala siempre que llegue una maestra de contactos o pidan actualizar clientes, zonas o comerciales.
---

# Maestra de Contactos

La app lee `contactos.json` (clientes por zona). Se genera con `herramientas/maestra_contactos.py` desde la maestra que
manda el usuario. Reglas que dio Hernán Reyes (aplican **siempre**):

1. **No se suben las columnas "Nombre" y "Lista de Precios"** (en la primera maestra venían resaltadas en rojo; en las
   siguientes vienen sin resaltar y igual se quitan). El nombre del cliente en la app es "Nombre Público".
2. **Lo que diga "Vacante Epithelium" en Comercial es de Yunelis Caballero (Zona Sur).** Maryi Tatiana Castro es **Zona Desarrollo** (desde oct 2026). La zona sale del comercial
   (`COMERCIAL_ZONA` del script); si no está ahí, de "Equipo de ventas".
3. El equipo **"Empleados" no se sube**.
4. **Los cambios de zona rigen desde la fecha en que se sube la maestra**: lo ya visitado queda con quien lo visitó, y
   desde ese día el cliente sale en el Visiplan y el Plan de Trabajo del nuevo vendedor (al anterior ya no le aparece).

## Pasos
1. Rama aparte. Corre `python3 herramientas/maestra_contactos.py <maestra.xlsx> <AAAA-MM-DD de hoy>`.
2. Revisa lo que imprime: contactos por zona, **nuevos, retirados y cambios de zona**, y si hay alguno **SIN ZONA**
   (comercial nuevo que no está en `COMERCIAL_ZONA`: pregunta al usuario de quién es y agrégalo al script).
3. El script deja `datos/Maestra_de_Contactos.xlsx` (copia limpia, sin cuadrícula) y anota los cambios en
   `datos/historial_maestra.csv` con la fecha desde la que rigen.
4. **Leads ganadas**: los contactos **nuevos** de la maestra pueden ser Leads con solicitud de creación. La app los
   amarra sola con verificación: al publicar, en "Solicitudes de creación" la jefe (o Hernán) ve "¿Ya se creó en la
   Maestra?" con el cliente que se parece y confirma con "Sí, es este". Díselo al usuario junto con la lista de nuevos.
5. Cuéntale al usuario en corto qué cambió (sobre todo los cambios de zona) y **pregunta antes de publicar** (CLAUDE.md).
   Al publicar: `sh actualizar-version.sh`, commit y push a `main`.
