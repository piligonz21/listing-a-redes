const wrap = require("../adapter");
exports.handler = wrap(require("../../api/shopify/order-paid.js"));
