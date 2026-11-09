`type: proyecto | created: 2026-11-02 | updated: 2026-11-02 | tags: [gsc-studio, real-estate, app]`

# Listing to Social (versión web)

Página web: pegás el link de una propiedad y saca fotos y datos solos. Arma carrusel 4:5, 3 historias, portada de reel y captions ES/EN.

- `public/index.html`: la página.
- `api/extract.js`: lee el aviso (JSON-LD, metadatos y texto). Lo que no encuentra vuelve vacío en `missing`.
- `api/img.js`: trae las fotos del aviso para poder dibujarlas.

## Publicar en Vercel (gratis)

1. Subí esta carpeta a un repo de GitHub.
2. En vercel.com: Add New › Project › elegí el repo › Deploy. No hace falta configurar nada.

Límite: Zonaprop suele bloquear lectores automáticos. Las webs de inmobiliarias y Argenprop suelen andar.

## Códigos de acceso

- `/` pide un código. `/app` es la herramienta (solo con sesión válida).
- `/admin.html`: con la contraseña de admin generás un link por comprador (`/?code=XXXXX-XXXXX`), ves cuántos dispositivos lo usan, lo das de baja o liberás dispositivos.
- Cada código entra en hasta 2 dispositivos.

Configuración en Vercel (una vez):
1. Storage › Create Database › Upstash for Redis › conectarla al proyecto.
2. Settings › Environment Variables › `ADMIN_PASSWORD` (8 caracteres o más).
3. Deployments › Redeploy.
