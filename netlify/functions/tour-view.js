// Muestra un recorrido compartido: /t/<id> (la página) y /t/<id>/img/<n> (las fotos). Público, sin entrar a la app.
const { connectLambda, getStore } = require("@netlify/blobs");

const notFound = () => ({ statusCode: 404, headers: { "content-type": "text/html; charset=utf-8" },
  body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recorrido no encontrado</title><p style="font-family:Arial,sans-serif;text-align:center;margin-top:30vh">Este recorrido no existe o fue borrado.</p>' });

exports.handler = async (event) => {
  const path = event.path || "";
  const m = path.match(/\/t\/([a-z0-9]{12,24})(?:\/img\/(\d{1,2}))?\/?$/);
  if (!m) return notFound();
  try {
    connectLambda(event);
    const store = getStore("tours");
    if (m[2] !== undefined) {
      const ab = await store.get(`${m[1]}/img/${m[2]}`, { type: "arrayBuffer" });
      if (!ab) return { statusCode: 404, body: "" };
      return { statusCode: 200, headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" }, body: Buffer.from(ab).toString("base64"), isBase64Encoded: true };
    }
    const html = await store.get(`${m[1]}/index`);
    if (!html) return notFound();
    return { statusCode: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "x-robots-tag": "noindex" }, body: html };
  } catch (e) { return notFound(); }
};
