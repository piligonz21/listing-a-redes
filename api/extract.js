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

function images(html, base, ld) {
  const set = new Set();
  const add = u => { if (!u) return; try { const abs = new URL(decode(u), base).href; if (/\.(jpe?g|png|webp)(\?|$)/i.test(abs) || /image|img|foto|photo|media|cdn/i.test(abs)) set.add(abs); } catch (e) {} };
  add(meta(html, "og:image"));
  ld.forEach(o => { const im = o.image || o.photo; (Array.isArray(im) ? im : [im]).forEach(x => add(typeof x === "string" ? x : x && (x.url || x.contentUrl))); });
  for (const m of html.matchAll(/(?:src|data-src|data-lazy|href)=["']([^"']+\.(?:jpe?g|webp|png)(?:\?[^"']*)?)["']/gi)) add(m[1]);
  return [...set].filter(u => !/logo|icon|avatar|sprite|placeholder|banner|whatsapp|facebook|google/i.test(u)).slice(0, 12);
}

module.exports = async (req, res) => {
  const url = (req.query && req.query.url) || "";
  res.setHeader("Cache-Control", "s-maxage=600");
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Pegá un link que empiece con http:// o https://" });
  let html = "";
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9,en;q=0.8", Accept: "text/html" }, redirect: "follow" });
    if (!r.ok) return res.status(200).json({ blocked: true, status: r.status, error: `El sitio no dejó leer el aviso (código ${r.status}). Pegá el texto y subí las fotos a mano.` });
    html = await r.text();
  } catch (e) {
    return res.status(200).json({ blocked: true, error: "No pude conectarme con el sitio. Pegá el texto y subí las fotos a mano." });
  }
  if (/captcha|cf-chl|Attention Required|Just a moment/i.test(html) && html.length < 60000)
    return res.status(200).json({ blocked: true, error: "El sitio pidió verificación anti-robots (pasa seguido con Zonaprop). Probá con el aviso en la web de la inmobiliaria o pegá el texto." });

  const ld = jsonLd(html);
  const t = text(html);
  const offer = ld.find(o => o.offers || o.price) || {};
  const priceLd = offer.offers ? [].concat(offer.offers)[0] : offer;
  let price = "";
  if (priceLd && priceLd.price) price = `${priceLd.priceCurrency === "USD" ? "USD" : priceLd.priceCurrency || "$"} ${Number(priceLd.price).toLocaleString("es-AR")}`;
  if (!price) { const p = t.match(/(USD|U\$S|US\$|u\$d)\s?([\d.,]{4,})/i); if (p) price = "USD " + p[2]; }

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
    rooms: num(/(\d+)\s*(?:ambientes?|amb\.)/i, t),
    bedrooms: num(/(\d+)\s*(?:dormitorios?|dorm\.|habitaciones?)/i, t),
    bathrooms: num(/(\d+)\s*baños?/i, t),
    parking: num(/(\d+)\s*(?:cocheras?|garages?)/i, t),
    op: /alquiler\s+temporario/i.test(t) ? "temporario" : /\balquiler\b/i.test(title + " " + description) ? "alquiler" : "venta",
    images: images(html, url, ld),
    source: url
  };
  const labels = { title: "Titular", location: "Barrio y ciudad", price: "Precio", m2: "m² cubiertos", lot: "m² terreno", rooms: "Ambientes", bedrooms: "Dormitorios", bathrooms: "Baños", parking: "Cocheras" };
  data.missing = Object.keys(labels).filter(k => !data[k]).map(k => labels[k]);
  if (!data.images.length) data.missing.push("Fotos");
  res.status(200).json(data);
};
