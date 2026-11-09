// Perfil de marca de cada usuario (estilo copiado, logo, pilares de contenido). Se guarda con su código de acceso.
const { redis, session, body } = require("../lib/auth");
const MAX = 600000; // ~600 KB (el logo va achicado)

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  let code = null; try { code = await session(req); } catch (e) {}
  if (!code) return res.status(401).json({ error: "Tu sesión venció. Volvé a entrar con tu código." });
  try {
    if (req.method === "GET") {
      const v = await redis("GET", "profile:" + code);
      return res.status(200).json({ profile: v ? JSON.parse(v) : null });
    }
    if (req.method === "POST") {
      const b = await body(req);
      const p = b && b.profile;
      if (!p || typeof p !== "object") return res.status(400).json({ error: "Falta el perfil." });
      const s = JSON.stringify(p);
      if (s.length > MAX) return res.status(413).json({ error: "El perfil es muy pesado. Probá con un logo más chico." });
      await redis("SET", "profile:" + code, s);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Método no permitido." });
  } catch (e) {
    return res.status(500).json({ error: "No se pudo guardar tu marca. Probá de nuevo." });
  }
};
