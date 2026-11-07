#!/bin/sh
# Marca una versión nueva del Cotizador antes de publicar: así los equipos ofrecen actualizarse (o se actualizan solos).
# Uso: sh herramientas/version_cotizador.sh
V=$(TZ=America/Bogota date +%Y%m%d%H%M)
echo "$V" > cotizador/version.txt
sed -i -E "s/\?v=[0-9]{12}/?v=$V/g" cotizador/index.html cotizador/sw.js
sed -i -E "s/const COTI_VERSION = '[0-9]{12}'/const COTI_VERSION = '$V'/" cotizador/index.html
sed -i -E "s/const CACHE = 'cotizador-[0-9]{12}'/const CACHE = 'cotizador-$V'/" cotizador/sw.js
echo "Versión del cotizador $V"
