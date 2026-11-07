// Shopify webhook "Order payment" (orders/paid): creates one access code per app license bought
// and stores it so the buyer can see it from the link in their order email.
// Needs SHOPIFY_WEBHOOK_SECRET (the key shown under Shopify › Settings › Notifications › Webhooks).
const crypto = require("crypto");
const { redis, getCode, saveCode, newCode } = require("../../lib/auth");
const SKU = "LAR-ACCESS";

function raw(req) {
  return new Promise((ok, bad) => { const ch = []; req.on("data", c => ch.push(c)); req.on("end", () => ok(Buffer.concat(ch))); req.on("error", bad); });
}
function valid(buf, hmac) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
  if (!secret || !hmac) return false;
  const good = crypto.createHmac("sha256", secret).update(buf).digest("base64");
  return good.length === hmac.length && crypto.timingSafeEqual(Buffer.from(good), Buffer.from(hmac));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const buf = await raw(req);
  if (!valid(buf, String(req.headers["x-shopify-hmac-sha256"] || ""))) return res.status(401).end();
  let o; try { o = JSON.parse(buf.toString("utf8")); } catch (e) { return res.status(400).end(); }
  const qty = (o.line_items || []).filter(l => String(l.sku || "").toUpperCase() === SKU).reduce((a, l) => a + (l.quantity || 1), 0);
  if (!qty) return res.status(200).json({ skipped: true });
  const id = String(o.id), email = String(o.email || o.contact_email || (o.customer && o.customer.email) || "").toLowerCase();
  try {
    // Shopify can send the same webhook more than once: only create codes the first time.
    const fresh = await redis("SET", "order:" + id + ":lock", "1", "NX", "EX", 600);
    const existing = await redis("GET", "order:" + id);
    if (existing || !fresh) return res.status(200).json({ duplicate: true });
    const codes = [];
    for (let i = 0; i < Math.min(qty, 20); i++) {
      let code; do { code = newCode(); } while (await getCode(code));
      await saveCode(code, { label: `Shopify ${o.name || "#" + id} · ${email}`.slice(0, 80), created: new Date().toISOString(), active: true, devices: [], order: id });
      codes.push(code);
    }
    await redis("SET", "order:" + id, JSON.stringify({ email, name: o.name || "", codes, created: new Date().toISOString() }));
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: "store" }); }
};
module.exports.config = { api: { bodyParser: false } };
