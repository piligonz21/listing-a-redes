const wrap = require("../adapter");
exports.handler = wrap(require("../../api/claim.js"));
