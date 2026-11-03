// Trae una foto del aviso para poder dibujarla en el diseño (evita el bloqueo CORS del canvas).
module.exports = async (req, res) => {
  const url = (req.query && req.query.url) || "";
  if (!/^https?:\/\//i.test(url)) return res.status(400).end();
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: new URL(url).origin } });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) return res.status(502).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return res.status(413).end();
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    res.status(200).send(buf);
  } catch (e) { res.status(502).end(); }
};
