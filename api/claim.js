// The buyer opens the link in their Shopify order email (order id + email) and gets their access code(s).
const { redis } = require("../lib/auth");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const o = String((req.query && req.query.o) || "").replace(/\D/g, "");
  const e = String((req.query && req.query.e) || "").trim().toLowerCase();
  if (!o || !e) return res.status(400).json({ error: "Este link está incompleto. Usá el link del mail de tu pedido." });
  let rec = null;
  try { const v = await redis("GET", "order:" + o); rec = v ? JSON.parse(v) : null; } catch (err) { return res.status(500).json({ error: "Error del servidor. Probá de nuevo en un minuto." }); }
  if (!rec) return res.status(202).json({ pending: true });
  if (rec.email !== e) return res.status(403).json({ error: "Este link no corresponde al pedido. Usá el link del mail de tu pedido." });
  res.status(200).json({ codes: rec.codes, name: rec.name });
};
