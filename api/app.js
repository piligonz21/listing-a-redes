// Sirve la herramienta solo con una sesión válida; si no, vuelve a la pantalla del código.
const fs = require("fs");
const path = require("path");
const { session } = require("../lib/auth");
let html = null;

module.exports = async (req, res) => {
  let ok = null;
  try { ok = await session(req); } catch (e) { ok = null; }
  if (!ok) { res.statusCode = 302; res.setHeader("Location", "/"); return res.end(); }
  html = html || fs.readFileSync(path.join(process.cwd(), "app.html"), "utf8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).send(html);
};
