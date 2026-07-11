# HazMat Respuesta Inicial v0.6.2 — Hotfix

## Error corregido
La versión v0.6.1 contenía un error de sintaxis en `app.js` que detenía toda la aplicación antes de cargar el catálogo GRE.

## Verificación
- El catálogo de sustancias vuelve a cargarse.
- La búsqueda por ONU y nombre queda operativa.
- El menú lateral y la sección Táctico se conservan.
- Se agregó una rutina de inicio con aviso explícito si falta `gre-data.js`.

## Actualización
Reemplace todos los archivos del repositorio, no solamente `app.js`.
Luego haga commit y espere la publicación de GitHub Pages.

En Android:
1. Abra la URL en Chrome.
2. Recargue la página.
3. Cierre completamente la PWA.
4. Vuelva a abrirla.
5. Si conserva la versión anterior, desinstale e instale nuevamente.
