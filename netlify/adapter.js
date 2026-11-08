// Runs the same handlers used on Vercel (api/*.js, Node req/res style) as Netlify Functions.
const { Readable } = require("stream");

module.exports = function wrap(handler) {
  return async (event) => {
    const buf = event.body ? Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8") : Buffer.alloc(0);
    const req = Readable.from(buf.length ? [buf] : []);
    req.method = event.httpMethod;
    req.headers = {};
    Object.entries(event.headers || {}).forEach(([k, v]) => { req.headers[k.toLowerCase()] = v; });
    req.query = Object.assign({}, event.queryStringParameters || {});
    req.url = event.path;
    if (buf.length && /json/i.test(req.headers["content-type"] || "")) { try { req.body = JSON.parse(buf.toString("utf8")); } catch (e) {} }

    const headers = {}, multi = {};
    let body = "", finished;
    const done = new Promise(r => { finished = r; });
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      setHeader(k, v) { k = k.toLowerCase(); if (Array.isArray(v)) { multi[k] = v.map(String); delete headers[k]; } else { headers[k] = String(v); delete multi[k]; } return this; },
      getHeader(k) { return headers[k.toLowerCase()]; },
      json(o) { if (!headers["content-type"]) headers["content-type"] = "application/json; charset=utf-8"; return this.send(JSON.stringify(o)); },
      send(b) { body = b == null ? "" : b; finished(); return this; },
      end(b) { if (b != null) body = b; finished(); return this; }
    };
    await Promise.race([Promise.resolve(handler(req, res)).then(() => finished()), done]);
    await done;
    const out = { statusCode: res.statusCode, headers, multiValueHeaders: multi };
    if (Buffer.isBuffer(body)) { out.body = body.toString("base64"); out.isBase64Encoded = true; } else out.body = String(body);
    return out;
  };
};
