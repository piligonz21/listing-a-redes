const { getCode, saveCode, setSession, clearSession, body, MAX_DEVICES } = require("../lib/auth");

module.exports = async (req, res) => {
  if (req.method === "DELETE") { clearSession(res); return res.status(200).json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).end();
  const { code, device } = await body(req);
  const c = String(code || "").trim().toUpperCase();
  const d = String(device || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  if (!c || d.length < 16) return res.status(400).json({ error: "Enter your access code." });
  let data;
  try { data = await getCode(c); } catch (e) { return res.status(500).json({ error: "The access code database isn't set up yet." }); }
  if (!data || !data.active) return res.status(401).json({ error: "That code doesn't exist or was deactivated." });
  data.devices = data.devices || [];
  if (!data.devices.includes(d)) {
    if (data.devices.length >= MAX_DEVICES) return res.status(403).json({ error: `This code is already used on ${MAX_DEVICES} devices. Contact the seller to reset it.` });
    data.devices.push(d);
    data.firstUse = data.firstUse || new Date().toISOString();
    await saveCode(c, data);
  }
  setSession(res, c, d);
  res.status(200).json({ ok: true });
};
