// Guarda un recorrido para compartir por link (Netlify Blobs). Solo usuarios de la app pueden subir.
// Cada foto va en su propio pedido (máx. ~4 MB) y al final la página.
const { connectLambda, getStore } = require("@netlify/blobs");
const { session } = require("../../lib/auth");

const json = (code, o) => ({ statusCode: code, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(o) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido." });
  const headers = {}; Object.entries(event.headers || {}).forEach(([k, v]) => { headers[k.toLowerCase()] = v; });
  let who = null; try { who = await session({ headers }); } catch (e) {}
  if (!who) return json(401, { error: "Tu sesión venció. Volvé a entrar con tu código." });
  const q = event.queryStringParameters || {};
  if (!/^[a-z0-9]{12,24}$/.test(q.id || "")) return json(400, { error: "Recorrido inválido." });
  const body = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
  if (!body.length) return json(400, { error: "Falta el contenido." });
  try {
    connectLambda(event);
    const store = getStore("tours");
    const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    if (q.kind === "img") {
      const k = parseInt(q.k, 10);
      if (!(k >= 0 && k < 80)) return json(400, { error: "Foto inválida." });
      await store.set(`${q.id}/img/${k}`, ab);
    } else if (q.kind === "page") {
      await store.set(`${q.id}/index`, body.toString("utf8"));
    } else return json(400, { error: "Tipo inválido." });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: "No se pudo guardar el recorrido. Probá de nuevo." });
  }
};
