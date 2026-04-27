/**
 * Script to register the orders/paid webhook in your Shopify store.
 * Run once: node scripts/registerWebhook.js
 *
 * Usage:
 *   SHOPIFY_SHOP_DOMAIN=my-store.myshopify.com \
 *   SHOPIFY_API_CLIENT_SECRET=shpss_xxx \
 *   WEBHOOK_CALLBACK_URL=https://your-server.com/webhooks/orders/paid \
 *   node scripts/registerWebhook.js
 */

require("dotenv").config();
const axios = require("axios");

const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
const apiClient = process.env.SHOPIFY_API_CLIENT_ID;
const apiClientSecret = process.env.SHOPIFY_API_CLIENT_SECRET;
const callbackUrl = process.env.WEBHOOK_CALLBACK_URL || `https://your-server.com/webhooks/orders/paid`;
let token = null;
let tokenExpiresAt = 0;

if (!shopDomain || !apiClient || !apiClientSecret) {
    console.error("❌ SHOPIFY_SHOP_DOMAIN, SHOPIFY_API_CLIENT_ID and SHOPIFY_API_CLIENT_SECRET are required");
    process.exit(1);
}

async function getToken() {
    if (token && Date.now() < tokenExpiresAt - 60_000) return token;

    const tokenPayload = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: apiClient,
        client_secret: apiClientSecret,
    });

    try {
        const {data} = await axios.post(
            `https://${shopDomain}/admin/oauth/access_token`,
            tokenPayload, {
                headers: {
                    "Content-Type": 'application/x-www-form-urlencoded',
                    "Accept": "application/json",
                },
            });


        if (!data.access_token && !data.expires_in) throw new Error(`Token request failed`);

        const access_token = data.access_token;
        const expires_in = data.expires_in;

        token = access_token;
        tokenExpiresAt = Date.now() + expires_in * 1000;
        return token;

    } catch (err) {
        console.error(
            "❌ Failed to get access token:",
            err.response?.data || err.message
        );
        return null;
    }
}

async function registerWebhook() {
    const url = `https://${shopDomain}/admin/api/2023-10/webhooks.json`;
    const accessToken = await getToken();
    if (!accessToken) {
        console.error(
            "❌ Failed to register webhook: missing access token"
        );
        return;
    }

    const payload = {
        webhook: {
            topic: "orders/paid",
            address: callbackUrl,
            format: "json",
        },
    };

    try {
        const {data} = await axios.post(url, payload, {
            headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
            },
        });

        console.log("✅ Webhook registered successfully!");
        console.log(JSON.stringify(data.webhook, null, 2));
    } catch (err) {
        console.error(
            "❌ Failed to register webhook:",
            err.response?.data || err.message
        );
    }
}

registerWebhook();
