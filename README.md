`type: proyecto | created: 2026-11-02 | updated: 2026-11-02 | tags: [gsc-studio, real-estate, app]`

# Listing a Redes (versión web)

Página web: pegás el link de una propiedad y saca fotos y datos solos. Arma carrusel 4:5, 3 historias, portada de reel y captions ES/EN.

- `public/index.html`: la página.
- `api/extract.js`: lee el aviso (JSON-LD, metadatos y texto). Lo que no encuentra vuelve vacío en `missing`.
- `api/img.js`: trae las fotos del aviso para poder dibujarlas.

## Publicar en Vercel (gratis)

1. Subí esta carpeta a un repo de GitHub.
2. En vercel.com: Add New › Project › elegí el repo › Deploy. No hace falta configurar nada.

Límite: Zonaprop suele bloquear lectores automáticos. Las webs de inmobiliarias y Argenprop suelen andar.
