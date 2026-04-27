require("dotenv").config();

const config = {
    shopify: {
        shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
        apiClient: process.env.SHOPIFY_API_CLIENT_ID,
        apiClientSecret: process.env.SHOPIFY_API_CLIENT_SECRET,
    },
    recharge: {
        apiKey: process.env.RECHARGE_API_KEY,
        apiVersion: process.env.RECHARGE_API_VERSION || "2021-11",
        baseUrl: "https://api.rechargeapps.com",
    },
    app: {
        port: parseInt(process.env.PORT) || 3000,
        nodeEnv: process.env.NODE_ENV || "development",
    },
    subscription: {
        defaultIntervalUnit: process.env.DEFAULT_ORDER_INTERVAL_UNIT || "month",
        defaultIntervalFrequency:
            parseInt(process.env.DEFAULT_ORDER_INTERVAL_FREQUENCY) || 1,
        subscriptionVariantIds: process.env.SUBSCRIPTION_VARIANT_IDS
            ? process.env.SUBSCRIPTION_VARIANT_IDS.split(",").map((id) => id.trim())
            : [],
        rechargeCollectionId: process.env.RECHARGE_COLLECTION_ID || null,
    },
};

// Validate required fields
const required = [
    ["SHOPIFY_SHOP_DOMAIN", config.shopify.shopDomain],
    ["SHOPIFY_API_CLIENT_ID", config.shopify.apiClient],
    ["SHOPIFY_API_CLIENT_SECRET", config.shopify.apiClientSecret],
    ["RECHARGE_API_KEY", config.recharge.apiKey],
];

const missing = required
    .filter(([, val]) => !val)
    .map(([key]) => key);

if (missing.length > 0) {
    console.error(
        `❌ Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
}

module.exports = config;
