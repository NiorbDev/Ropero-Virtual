# EntreCapas

Ropero digital para guardar prendas, ordenarlas y armar conjuntos en un probador 2D. La aplicación funciona sin cuenta y conserva el ropero en el dispositivo o navegador de cada persona.

[Probar la versión web](https://ropero-virtual-norel.nicolasomgb.chatgpt.site) · [Ver el código](https://github.com/NiorbDev/Ropero-Virtual)

## Qué puedes hacer

- Guardar prendas con fotos, categoría, color, talla y otros detalles.
- Buscar y filtrar el ropero, archivar prendas y llevar un historial de uso y lavado.
- Recortar el fondo de una foto y corregir la selección manualmente.
- Combinar prendas en un probador 2D y ajustar su posición.
- Exportar e importar una copia del ropero, incluidas sus fotos y conjuntos.
- Instalar la web como aplicación progresiva (PWA) en dispositivos compatibles.

## Privacidad

Los perfiles, fotos, prendas y conjuntos se guardan localmente. EntreCapas no necesita una cuenta, no sincroniza el ropero con un servidor y no envía las fotos al proveedor del modelo. El recorte automático descarga el modelo U-2-Netp cuando se necesita; el procesamiento de la imagen ocurre en el dispositivo. La descarga inicial requiere conexión a internet.

Exporta una copia antes de borrar los datos del navegador o cambiar de dispositivo. Un archivo exportado puede contener tus fotos y prendas: compártelo solo con personas de confianza.

## Ejecutar localmente

Necesitas Node.js y npm.

```bash
npm ci
npm run dev
```

Vite mostrará la dirección local en la terminal. Para generar una versión estática:

```bash
npm run build
```

La aplicación incluye pruebas automatizadas; para ejecutarlas una vez:

```bash
npm test -- --run
```

La cámara y la instalación PWA requieren un contexto seguro: `localhost` funciona para desarrollo; una instalación pública debe servirse por HTTPS.

## Tecnologías

React, TypeScript, Vite, IndexedDB, Web Workers, Transformers.js y ONNX Runtime Web. El modelo de recorte se descarga desde Hugging Face cuando se usa por primera vez.

## Licencias

El código propio de este proyecto se publica bajo MIT. Las pistas de Kevin MacLeod y el modelo U-2-Netp tienen sus propias licencias y atribuciones; consulta [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Los patrones decorativos de las referencias visuales no se redistribuyen en este repositorio; los fondos se dibujan con CSS.

## Contribuciones

Las sugerencias y errores se pueden abrir en [Issues](https://github.com/NiorbDev/Ropero-Virtual/issues). No subas fotos personales, exportaciones `.ropero`, bases de datos ni archivos `.env` a un issue o pull request.
