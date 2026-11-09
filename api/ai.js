// IA opcional (Claude): copia el estilo de marca a partir de capturas y arma ideas de contenido.
// Solo funciona si está cargada ANTHROPIC_API_KEY. Sin la clave, la app usa su modo sin IA.
const Anthropic = require("@anthropic-ai/sdk");
const { session, body } = require("../lib/auth");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const HEX = { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" };

const STYLE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "summary", "bg", "surface", "ink", "muted", "accent", "titleFont", "titleCase", "layout", "overlay"],
  properties: {
    name: { type: "string", description: "Nombre corto para el estilo, 2-3 palabras" },
    summary: { type: "string", description: "Una oración en español rioplatense describiendo el estilo detectado" },
    bg: HEX, surface: HEX, ink: HEX, muted: HEX, accent: HEX,
    titleFont: { type: "string", enum: ["sans-moderna", "sans-fina", "serif-elegante", "serif-clasica"] },
    titleCase: { type: "string", enum: ["mayusculas", "normal"] },
    layout: { type: "string", enum: ["foto-completa", "banda-abajo", "marco", "tarjeta", "arco"] },
    overlay: { type: "string", enum: ["degradado-oscuro", "sin-overlay", "claro"] }
  }
};
const STYLE_PROMPT = `Estas imágenes son publicaciones o una captura del perfil de Instagram de una inmobiliaria. Describí su estilo visual para poder copiarlo lo más parecido posible en placas nuevas.
- bg: color de fondo dominante de las placas (no de las fotos de las propiedades).
- surface: color de tarjetas o bandas de texto, si hay (si no, igual a bg).
- ink: color principal de los títulos.
- muted: color de textos secundarios.
- accent: color de detalles (líneas, botones, palabras destacadas).
- titleFont: la tipografía de títulos que más se parezca.
- titleCase: si los títulos van en mayúsculas.
- layout: foto-completa (foto a sangre con texto encima), banda-abajo (foto arriba y franja de color con el texto), marco (foto con borde de color alrededor), tarjeta (foto con un recuadro de texto encima), arco (foto recortada en forma de arco sobre fondo liso).
- overlay: cómo oscurecen o aclaran la foto para que se lea el texto.`;

const POST_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "slides", "cta", "caption", "photoQuery"],
  properties: {
    title: { type: "string", description: "Título de portada, máx. 7 palabras" },
    slides: { type: "array", items: { type: "object", additionalProperties: false, required: ["t", "b"],
      properties: { t: { type: "string", description: "Título de la placa, máx. 6 palabras" }, b: { type: "string", description: "Una o dos oraciones, máx. 30 palabras" } } } },
    cta: { type: "string", description: "Cierre que invita a escribir, máx. 10 palabras" },
    caption: { type: "string", description: "Caption para Instagram con emojis moderados y 6-10 hashtags al final" },
    photoQuery: { type: "string", description: "2-3 palabras en español para buscar una foto de stock de portada" }
  }
};

function client() { return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 9000, maxRetries: 0 }); }

async function ask(content, schema, maxTokens) {
  const r = await client().beta.messages.create({
    model: MODEL, max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    messages: [{ role: "user", content }]
  });
  if (r.stop_reason === "refusal") throw new Error("refusal");
  const t = r.content.find(b => b.type === "text");
  return JSON.parse(t ? t.text : "{}");
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  let code = null; try { code = await session(req); } catch (e) {}
  if (!code) return res.status(401).json({ error: "Tu sesión venció. Volvé a entrar con tu código." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(501).json({ error: "no_ai" });
  const b = await body(req);
  try {
    if (b.action === "style") {
      const imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 4)
        .map(u => String(u).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)).filter(Boolean);
      if (!imgs.length) return res.status(400).json({ error: "Faltan las imágenes." });
      const content = imgs.map(m => ({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }));
      content.push({ type: "text", text: STYLE_PROMPT });
      return res.status(200).json({ style: await ask(content, STYLE_SCHEMA, 1500) });
    }
    if (b.action === "post") {
      const p = b.profile || {};
      const avoid = (Array.isArray(b.avoid) ? b.avoid : []).slice(0, 15).map(String).join(" | ");
      const text = `Sos community manager de una inmobiliaria argentina. Escribí en español rioplatense (voseo), claro y cercano, sin inventar datos de mercado puntuales (precios, porcentajes, leyes con número) que no puedas asegurar.
Inmobiliaria: ${String(p.brand || "una inmobiliaria").slice(0, 80)}. Zona: ${String(p.city || "Argentina").slice(0, 80)}.
Pilar de contenido de hoy: ${String(b.pillar || "consejos").slice(0, 80)}.
Armá un carrusel de Instagram útil para sus seguidores: portada, ${Math.min(Math.max(parseInt(b.n, 10) || 4, 3), 5)} placas de contenido y un cierre.
No repitas estos temas: ${avoid || "ninguno"}.`;
      return res.status(200).json({ post: await ask([{ type: "text", text }], POST_SCHEMA, 2000) });
    }
    return res.status(400).json({ error: "Acción inválida." });
  } catch (e) {
    return res.status(502).json({ error: "La IA no respondió a tiempo. Probá de nuevo." });
  }
};
