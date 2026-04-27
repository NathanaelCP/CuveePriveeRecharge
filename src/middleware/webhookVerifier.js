const crypto = require("crypto");
const config = require("../../config");

/**
 * Middleware to verify Shopify webhook authenticity via HMAC signature.
 * Must be applied BEFORE express.json() on the webhook route so the raw body is available.
 */
function verifyShopifyWebhook(req, res, next) {
    const hmacHeader = req.headers["x-shopify-hmac-sha256"];

    if (!hmacHeader) {
        console.warn("⚠️  Webhook received without HMAC header");
        return res.status(401).json({error: "Missing HMAC header"});
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
        console.error("❌ Raw body not available for HMAC verification");
        return res.status(400).json({error: "Raw body not available"});
    }

    const digest = crypto
        .createHmac("sha256", config.shopify.apiClientSecret)
        .update(rawBody, "utf8")
        .digest("base64");

    const isValid = crypto.timingSafeEqual(
        Buffer.from(digest),
        Buffer.from(hmacHeader)
    );

    if (!isValid) {
        console.warn("⚠️  Invalid webhook signature — request rejected");
        return res.status(401).json({error: "Invalid webhook signature"});
    }

    console.log("✅ Webhook signature verified");
    next();
}

module.exports = {verifyShopifyWebhook};
