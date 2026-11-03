// Códigos de acceso: se guardan en Upstash Redis (Vercel › Storage) y la sesión va en una cookie firmada.
const crypto = require("crypto");

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const MAX_DEVICES = 2; // celu + compu

async function redis(...cmd) {
  if (!URL_ || !TOKEN) throw new Error("no_store");
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function getCode(code) { const v = await redis("GET", "code:" + code); return v ? JSON.parse(v) : null; }
async function saveCode(code, data) { await redis("SET", "code:" + code, JSON.stringify(data)); await redis("SADD", "codes", code); }

function key() { return crypto.createHash("sha256").update("listing-a-redes:" + (process.env.ADMIN_PASSWORD || "")).digest(); }
function sign(v) { return crypto.createHmac("sha256", key()).update(v).digest("base64url"); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; })); }

function setSession(res, code, device) {
  const v = `${code}.${device}`;
  res.setHeader("Set-Cookie", `lar=${encodeURIComponent(v + "." + sign(v))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 180}`);
}
function clearSession(res) { res.setHeader("Set-Cookie", "lar=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"); }

// Devuelve el código si la cookie es válida y el código sigue activo en ese dispositivo.
async function session(req) {
  const raw = cookies(req).lar || "";
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [code, device, sig] = parts;
  const good = sign(`${code}.${device}`);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const c = await getCode(code);
  if (!c || !c.active || !(c.devices || []).includes(device)) return null;
  return code;
}

function newCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.randomBytes(10);
  let s = ""; for (let i = 0; i < 10; i++) s += abc[b[i] % abc.length];
  return s.slice(0, 5) + "-" + s.slice(5);
}
function isAdmin(req) {
  const p = process.env.ADMIN_PASSWORD || "";
  const got = String(req.headers["x-admin-password"] || "");
  return p.length >= 8 && got.length === p.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(p));
}
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

module.exports = { redis, getCode, saveCode, setSession, clearSession, session, newCode, isAdmin, body, MAX_DEVICES };
