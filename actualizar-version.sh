#!/bin/sh
# Marca una versión nueva de la app antes de publicar: así los celulares ofrecen actualizarse.
# Uso: sh actualizar-version.sh
V=$(TZ=America/Bogota date +%Y%m%d%H%M)
F=$(TZ=America/Bogota date "+%d/%m/%Y %H:%M")
echo "$V" > version.txt
sed -i -E "s/\?v=[0-9]{12}/?v=$V/g" index.html
sed -i -E "s/const APP_VERSION = '[0-9]{12}'/const APP_VERSION = '$V'/" app.js
sed -i -E "s#Versión [0-9/]+ [0-9:]+( UTC)?#Versión $F#" index.html
echo "Versión $V"
