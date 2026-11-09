// Build step for Netlify: puts app.html inside a JS module so the /app function can always find it.
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
fs.writeFileSync(path.join(__dirname, "..", "lib", "app-html.generated.js"), "module.exports = " + JSON.stringify(html) + ";\n");
console.log("app.html embedded");
