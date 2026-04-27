const express = require("express");
const {verifyShopifyWebhook} = require("../middleware/webhookVerifier");
const {processOrderPaid} = require("../handlers/orderHandler");

const router = express.Router();

/**
 * POST /webhooks/orders/paid
 *
 * Shopify fires this when an order is fully paid.
 * We verify the HMAC signature, then create Recharge subscriptions.
 */
router.post(
    "/orders/paid",
    verifyShopifyWebhook,
    async (req, res) => {
        // Respond immediately with 200 so Shopify doesn't retry
        res.status(200).json({received: true});

        // Process asynchronously — errors here won't affect the HTTP response
        try {
            const order = req.body;
            const result = await processOrderPaid(order);
            console.log("📬 Webhook processing result:", JSON.stringify(result, null, 2));
        } catch (err) {
            console.error("❌ Error processing orders/paid webhook:", err.message);
        }
    }
);

module.exports = router;
