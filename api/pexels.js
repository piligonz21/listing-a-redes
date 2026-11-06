// Busca fotos de stock en Pexels (para cuando faltan fotos). Necesita PEXELS_API_KEY en Vercel.
const { session } = require("../lib/auth");

module.exports = async (req, res) => {
  let who = null; try { who = await session(req); } catch (e) {}
  if (!who) return res.status(401).json({ error: "Tu sesión venció. Volvé a entrar con tu código." });
  const key = process.env.PEXELS_API_KEY;
  if (!key) return res.status(200).json({ error: "Falta conectar Pexels (PEXELS_API_KEY en Vercel)." });
  const q = String((req.query && req.query.q) || "").trim().slice(0, 80);
  if (!q) return res.status(400).json({ error: "Escribí qué foto buscás." });
  const orientation = ["portrait", "landscape", "square"].includes(req.query.o) ? req.query.o : "portrait";
  const page = Math.max(1, Math.min(20, parseInt(req.query.page) || 1));
  try {
    const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=18&page=${page}&orientation=${orientation}&locale=es-ES`;
    const r = await fetch(u, { headers: { Authorization: key } });
    if (r.status === 401 || r.status === 403) return res.status(200).json({ error: "La clave de Pexels no es válida. Revisala en Vercel." });
    if (!r.ok) return res.status(200).json({ error: "Pexels no respondió. Probá de nuevo en un rato." });
    const d = await r.json();
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).json({
      photos: (d.photos || []).map(p => ({
        id: p.id, w: p.width, h: p.height, alt: p.alt || "",
        thumb: p.src.medium, full: p.src.original + "?auto=compress&cs=tinysrgb&w=2160",
        by: p.photographer, link: p.url
      })),
      more: !!d.next_page
    });
  } catch (e) { res.status(200).json({ error: "No pude conectarme con Pexels." }); }
};
