// Busca fotos de stock (para cuando faltan fotos).
// Usa Pixabay si hay PIXABAY_API_KEY; si no, Pexels con PEXELS_API_KEY.
const { session } = require("../lib/auth");

async function pixabay(key, q, o, page) {
  const orientation = o === "landscape" ? "horizontal" : o === "portrait" ? "vertical" : "all";
  const u = `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&orientation=${orientation}&safesearch=true&per_page=18&page=${page}&lang=en`;
  const r = await fetch(u);
  if (r.status === 400 || r.status === 401 || r.status === 403) {
    const t = await r.text();
    if (/key/i.test(t)) return { error: "The Pixabay key isn't valid." };
    return { photos: [], more: false };
  }
  if (!r.ok) return { error: "Pixabay didn't respond. Try again in a while." };
  const d = await r.json();
  return {
    source: "Pixabay",
    photos: (d.hits || []).map(p => ({
      id: p.id, w: p.imageWidth, h: p.imageHeight, alt: p.tags || "",
      thumb: p.webformatURL, full: p.largeImageURL || p.webformatURL,
      by: p.user, link: p.pageURL
    })),
    more: page * 18 < Math.min(d.totalHits || 0, 500)
  };
}

async function pexels(key, q, o, page) {
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=18&page=${page}&orientation=${o}&locale=en-US`;
  const r = await fetch(u, { headers: { Authorization: key } });
  if (r.status === 401 || r.status === 403) return { error: "The Pexels key isn't valid." };
  if (!r.ok) return { error: "Pexels didn't respond. Try again in a while." };
  const d = await r.json();
  return {
    source: "Pexels",
    photos: (d.photos || []).map(p => ({
      id: p.id, w: p.width, h: p.height, alt: p.alt || "",
      thumb: p.src.medium, full: p.src.original + "?auto=compress&cs=tinysrgb&w=2160",
      by: p.photographer, link: p.url
    })),
    more: !!d.next_page
  };
}

module.exports = async (req, res) => {
  let who = null; try { who = await session(req); } catch (e) {}
  if (!who) return res.status(401).json({ error: "Your session expired. Log in again with your code." });
  const pxb = process.env.PIXABAY_API_KEY, pxl = process.env.PEXELS_API_KEY;
  if (!pxb && !pxl) return res.status(200).json({ error: "Stock photo search isn't set up yet (PIXABAY_API_KEY)." });
  const q = String((req.query && req.query.q) || "").trim().slice(0, 80);
  if (!q) return res.status(400).json({ error: "Type what photo you need." });
  const o = ["portrait", "landscape", "square"].includes(req.query.o) ? req.query.o : "portrait";
  const page = Math.max(1, Math.min(20, parseInt(req.query.page) || 1));
  try {
    const out = pxb ? await pixabay(pxb, q, o, page) : await pexels(pxl, q, o, page);
    if (!out.error) res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).json(out);
  } catch (e) { res.status(200).json({ error: "Couldn't connect to the stock photo service." }); }
};
