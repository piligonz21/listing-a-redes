// Lee un aviso inmobiliario y devuelve los datos que encuentra.
// Lo que no encuentra vuelve vacío y se lista en "missing".
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re);
  if (!tag) return "";
  const c = tag[0].match(/content=["']([^"']*)["']/i);
  return c ? decode(c[1]).trim() : "";
}
function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim());
      const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { out.push(o); if (o["@graph"]) walk(o["@graph"]); } };
      walk(j);
    } catch (e) {}
  }
  return out;
}
function text(html) {
  return decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
}
const num = (re, t) => { const m = t.match(re); return m ? m[1].replace(/\s/g, "") : ""; };

// Fotos en la mejor calidad: de cada foto se queda con la versión más grande que encuentre.
const SMALL = /(thumb|thumbnail|small|mini|_s\.|_t\.|_xs|_sm|-\d{2,3}x\d{2,3}\.|\/w_\d{2,3}|resize=\d{2,3}|[?&](w|width)=\d{2,3}\b)/i;
function score(u, w) { return (w || 0) + (SMALL.test(u) ? 0 : 5000) + (/\d{2,4}x\d{2,4}|[?&](w|width|h|height)=/i.test(u) ? 0 : 100) + u.length / 1000; }
// Clave para reconocer la misma foto en distintos tamaños o direcciones (sin parámetros ni medidas).
function baseKey(u) {
  try {
    const x = new URL(u);
    let p = decodeURIComponent(x.pathname).toLowerCase();
    p = p.replace(/\/(?:thumbs?|small|medium|large|big|resized?|original|full|xl|lg|md|sm|xs|fit-in|crop|scale|filters?:[^/]*|[whcs]_\d+[^/]*|\d{2,4}x\d{2,4}[^/]*|\d{2,4}(?:w|h|px)?)(?=\/)/g, "");
    p = p.replace(/(?:[_\-.@](?:thumb|thumbnail|small|mini|medium|large|big|xs|sm|md|lg|xl|xxl|scaled|orig|original|full|hd|\d{2,4}x\d{2,4}|\d{2,4}[wh]|\dx|w\d{2,4}|h\d{2,4}))+(?=\.[a-z0-9]+$)/g, "");
    p = p.replace(/\.(jpe?g|png|webp|avif)$/, "");
    const file = p.split("/").pop();
    // Nombres largos y únicos (hash/uuid) identifican la foto aunque cambie la carpeta o el dominio del CDN.
    if (/[a-f0-9-]{16,}|\d{6,}/.test(file) && file.length >= 12) return file;
    return x.hostname.replace(/^(?:img|images?|static|cdn|media|photos?)\d*\./, "") + p;
  } catch (e) { return u; }
}
function images(html, base, ld) {
  const best = new Map();
  const add = (u, w) => {
    if (!u) return;
    try {
      const abs = new URL(decode(u).trim(), base).href;
      if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(abs) && !/image|img|foto|photo|media|cdn|picture/i.test(abs)) return;
      if (/logo|icon|avatar|sprite|placeholder|banner|whatsapp|facebook|google|\.svg/i.test(abs)) return;
      const k = baseKey(abs), cur = best.get(k);
      if (!cur || score(abs, w) > score(cur.u, cur.w)) best.set(k, { u: abs, w: w || 0, order: cur ? cur.order : best.size });
    } catch (e) {}
  };
  add(meta(html, "og:image"), 1200);
  ld.forEach(o => { const im = o.image || o.photo; (Array.isArray(im) ? im : [im]).forEach(x => add(typeof x === "string" ? x : x && (x.url || x.contentUrl), 1200)); });
  for (const m of html.matchAll(/(?:data-)?srcset=["']([^"']+)["']/gi))
    m[1].split(",").forEach(part => { const [u, d] = part.trim().split(/\s+/); add(u, parseInt(d) || 0); });
  for (const m of html.matchAll(/(?:src|data-src|data-lazy|data-original|data-full|data-zoom-image|data-large|href)=["']([^"']+\.(?:jpe?g|webp|png|avif)(?:\?[^"']*)?)["']/gi)) add(m[1], /data-(full|zoom|large|original)/i.test(m[0]) ? 3000 : 0);
  // Sitios que cargan las fotos con JavaScript: las direcciones están dentro de datos JSON en la página.
  if (best.size < 4) {
    const og = meta(html, "og:image"); let ogHost = ""; try { if (og) ogHost = new URL(og, base).hostname; } catch (e) {}
    for (const m of html.matchAll(/https?:(?:\\?\/){2}[^"'\s<>()]+?\.(?:jpe?g|webp|png)(?:\?[^"'\s<>()]*)?(?=["'\s<>()]|\\")/gi)) {
      const u = m[0].replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
      try { if (!ogHost || new URL(u).hostname === ogHost) add(u, 0); } catch (e) {}
    }
  }
  return [...best.values()].sort((a, b) => a.order - b.order).map(v => v.u).slice(0, 15);
}
// Si la foto es una miniatura, prueba la versión grande quitando el tamaño del nombre o de la dirección.
async function upgrade(u) {
  if (!SMALL.test(u)) return u;
  const tries = [
    u.replace(/(_|-)(thumb|thumbnail|small|mini|xs|sm)(?=\.)/i, ""),
    u.replace(/\/(thumbs?|small)\//i, "/"),
    u.replace(/-\d{2,3}x\d{2,3}(?=\.)/, ""),
    u.replace(/([?&])(w|width|h|height|resize)=\d+&?/gi, "$1").replace(/[?&]$/, "")
  ].filter(x => x !== u);
  for (const t of tries) {
    try {
      const r = await fetch(t, { method: "HEAD", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(2500) });
      if (r.ok && (r.headers.get("content-type") || "").startsWith("image/")) return t;
    } catch (e) {}
  }
  return u;
}

const HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
  "Cache-Control": "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
};
// ¿La página trae datos del aviso (título y fotos), o es un esqueleto que se arma con JavaScript?
function looksUseful(h) {
  if (!h) return false;
  const imgs = (h.match(/\.(?:jpe?g|webp|png)\b/gi) || []).length;
  return imgs >= 3 && text(h).length > 400;
}
// Lector externo gratuito (r.jina.ai) que abre la página en un navegador real y devuelve el HTML ya armado.
async function reader(url) {
  try {
    const h = { "X-Return-Format": "html", "X-Timeout": "12", Accept: "text/html" };
    if (process.env.JINA_API_KEY) h.Authorization = "Bearer " + process.env.JINA_API_KEY;
    const r = await fetch("https://r.jina.ai/" + url, { headers: h, signal: AbortSignal.timeout(16000) });
    if (!r.ok) return "";
    return await r.text();
  } catch (e) { return ""; }
}

const { session } = require("../lib/auth");

module.exports = async (req, res) => {
  let who = null; try { who = await session(req); } catch (e) {}
  if (!who) return res.status(401).json({ error: "Your session expired. Log in again with your code." });
  const url = (req.query && req.query.url) || "";
  res.setHeader("Cache-Control", "s-maxage=600");
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Paste a link that starts with http:// or https://" });
  let html = "", status = 0;
  try {
    const r = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(8000) });
    status = r.status;
    if (r.ok) html = await r.text();
  } catch (e) {}
  const blockedPage = h => !h || (/captcha|cf-chl|Attention Required|Just a moment|Access denied|Pardon Our Interruption|px-captcha/i.test(h) && h.length < 80000);
  // Si el sitio bloquea o arma la página con JavaScript, la pedimos a un lector que abre la página como un navegador.
  if (blockedPage(html) || !looksUseful(html)) {
    const alt = await reader(url);
    if (alt && !blockedPage(alt) && (looksUseful(alt) || blockedPage(html))) html = alt;
  }
  if (!html) return res.status(200).json({ blocked: true, status, error: status ? `The site didn't let us read the listing (code ${status}). Paste the text and add the photos by hand.` : "Couldn't connect to the site. Paste the text and add the photos by hand." });
  if (blockedPage(html))
    return res.status(200).json({ blocked: true, error: "The site asked for a bot check (common on big portals). Try the listing on the agency's own website, or paste the text." });

  const ld = jsonLd(html);
  const t = text(html);
  const offer = ld.find(o => o.offers || o.price) || {};
  const priceLd = offer.offers ? [].concat(offer.offers)[0] : offer;
  let price = "";
  if (priceLd && priceLd.price) price = `${priceLd.priceCurrency === "USD" ? "USD" : priceLd.priceCurrency || "$"} ${Number(priceLd.price).toLocaleString("en-US")}`;
  if (!price) { const p = t.match(/(USD|U\$S|US\$|u\$d)\s?([\d.,]{4,})/i); if (p) price = "USD " + p[2].replace(/[.,]+$/, ""); }
  if (!price) { const p = t.match(/\$\s?(\d{1,3}(?:,\d{3})+)/); if (p) price = "$" + p[1]; }

  const title = meta(html, "og:title") || (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
  const description = meta(html, "og:description") || meta(html, "description");
  const addr = ld.find(o => o.address) ;
  const loc = addr ? [addr.address.addressLocality, addr.address.addressRegion].filter(Boolean).join(", ") : "";

  const data = {
    title: decode(title).split(/\s[|–-]\s/)[0].trim().slice(0, 90),
    description: description.slice(0, 1500),
    location: loc,
    price,
    m2: num(/(\d[\d.,]*)\s*m(?:²|2|ts2?)\s*(?:cub|cubiertos?)/i, t) || num(/(?:sup(?:erficie)?\.?\s*cubierta)\D{0,12}(\d[\d.,]*)/i, t),
    lot: num(/(\d[\d.,]*)\s*m(?:²|2|ts2?)\s*(?:de\s*)?(?:terreno|lote|tot|totales?)/i, t) || num(/(?:terreno|sup(?:erficie)?\.?\s*total)\D{0,12}(\d[\d.,]*)/i, t),
    sqft: num(/(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)/i, t),
    rooms: num(/(\d+)\s*(?:ambientes?|amb\.)/i, t),
    bedrooms: num(/(\d+)\s*(?:dormitorios?|dorm\.|habitaciones?|bedrooms?|beds?|bd)\b/i, t),
    bathrooms: num(/(\d+(?:\.\d)?)\s*(?:baños?|bathrooms?|baths?|ba)\b/i, t),
    parking: num(/(\d+)\s*(?:-?\s*car\s*)?(?:cocheras?|garages?|parking\s*spaces?)/i, t),
    op: /alquiler\s+temporario|vacation\s+rental/i.test(t) ? "temporario" : /\balquiler\b|for\s+rent|for\s+lease/i.test(title + " " + description) ? "alquiler" : "venta",
    images: await Promise.all(images(html, url, ld).map(upgrade)),
    source: url
  };
  if (!data.m2 && data.sqft) { data.m2 = data.sqft; data.unit = "sqft"; } else if (data.m2) data.unit = "m2";
  delete data.sqft;
  const labels = { title: "Headline", location: "Neighborhood and city", price: "Price", m2: "Living area", lot: "Lot size", rooms: "Rooms", bedrooms: "Bedrooms", bathrooms: "Bathrooms", parking: "Parking" };
  data.missing = Object.keys(labels).filter(k => !data[k]).map(k => labels[k]);
  if (!data.images.length) data.missing.push("Photos");
  res.status(200).json(data);
};
