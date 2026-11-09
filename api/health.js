// Setup check: says which settings the server can see (never shows the values).
const { redis } = require("../lib/auth");
module.exports = async (req, res) => {
  const e = process.env, has = k => !!(e[k] && String(e[k]).trim());
  const out = {
    ADMIN_PASSWORD: has("ADMIN_PASSWORD") ? (String(e.ADMIN_PASSWORD).length >= 8 ? "ok" : "too short (min 8)") : "MISSING",
    database_url: has("KV_REST_API_URL") || has("UPSTASH_REDIS_REST_URL") ? "ok" : "MISSING",
    database_token: has("KV_REST_API_TOKEN") || has("UPSTASH_REDIS_REST_TOKEN") ? "ok" : "MISSING",
    link_reader: has("JINA_API_KEY") ? "ok" : "missing (JINA_API_KEY)",
    portal_reader: has("SCRAPERAPI_KEY") ? "ok" : "missing (optional: SCRAPERAPI_KEY, for Argenprop)",
    stock_photos: has("PIXABAY_API_KEY") ? "ok (Pixabay)" : has("PEXELS_API_KEY") ? "ok (Pexels)" : "missing (optional: PIXABAY_API_KEY)",
    ai: has("ANTHROPIC_API_KEY") ? "ok" : "missing (optional: ANTHROPIC_API_KEY, copies brand style + writes daily content)",
    SHOPIFY_WEBHOOK_SECRET: has("SHOPIFY_WEBHOOK_SECRET") ? "ok" : "missing (optional)"
  };
  try { await redis("PING"); out.database_connection = "ok"; } catch (err) { out.database_connection = "FAILED: " + String(err.message || err).slice(0, 80); }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(out);
};
