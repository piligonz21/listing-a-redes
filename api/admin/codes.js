// Panel de Pili: crear, listar y dar de baja códigos. Pide la contraseña de admin en cada pedido.
const { redis, getCode, saveCode, newCode, isAdmin, body } = require("../../lib/auth");

module.exports = async (req, res) => {
  const pw = process.env.ADMIN_PASSWORD || "";
  if (pw.length < 8) return res.status(500).json({ error: "El servidor no tiene ADMIN_PASSWORD (o tiene menos de 8 caracteres). Cargala en las variables de entorno y volvé a publicar." });
  if (!isAdmin(req)) return res.status(401).json({ error: "Contraseña incorrecta." });
  try {
    if (req.method === "GET") {
      const list = (await redis("SMEMBERS", "codes")) || [];
      const items = (await Promise.all(list.map(async c => ({ code: c, ...(await getCode(c)) })))).sort((a, b) => (b.created || "").localeCompare(a.created || ""));
      return res.status(200).json({ items });
    }
    const b = await body(req);
    if (req.method === "POST") {
      let code; do { code = newCode(); } while (await getCode(code));
      const data = { label: String(b.label || "").slice(0, 80), created: new Date().toISOString(), active: true, devices: [] };
      await saveCode(code, data);
      return res.status(200).json({ code, ...data });
    }
    if (req.method === "PATCH") {
      const c = await getCode(String(b.code || ""));
      if (!c) return res.status(404).json({ error: "No existe ese código." });
      if (typeof b.active === "boolean") c.active = b.active;
      if (b.resetDevices) c.devices = [];
      await saveCode(String(b.code), c);
      return res.status(200).json({ code: b.code, ...c });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message === "no_store" ? "Falta conectar la base de códigos (Vercel › Storage › Upstash Redis)." : "Error del servidor." });
  }
};
