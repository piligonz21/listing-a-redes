// The buyer opens the link in their Shopify order email (order id + email) and gets their access code(s).
const { redis } = require("../lib/auth");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const o = String((req.query && req.query.o) || "").replace(/\D/g, "");
  const e = String((req.query && req.query.e) || "").trim().toLowerCase();
  if (!o || !e) return res.status(400).json({ error: "This link is incomplete. Use the link from your order email." });
  let rec = null;
  try { const v = await redis("GET", "order:" + o); rec = v ? JSON.parse(v) : null; } catch (err) { return res.status(500).json({ error: "Server error. Try again in a minute." }); }
  if (!rec) return res.status(202).json({ pending: true });
  if (rec.email !== e) return res.status(403).json({ error: "This link doesn't match the order. Use the link from your order email." });
  res.status(200).json({ codes: rec.codes, name: rec.name });
};
