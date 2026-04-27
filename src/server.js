const express = require("express");
const config = require("../config");
const webhookRoutes = require("./routes/webhooks");

const app = express();

// ─── Raw body capture (required for HMAC verification) ───────────────────────
// Must be registered BEFORE express.json()
app.use(
    express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    })
);

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        app: "shopify-recharge-webhook",
        env: config.app.nodeEnv,
        timestamp: new Date().toISOString(),
    });
});

// ─── Webhook routes ───────────────────────────────────────────────────────────
app.use("/webhooks", webhookRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({error: "Route not found"});
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({error: "Internal server error"});
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(config.app.port, () => {
    console.log(`
🚀 Shopify → Recharge webhook app running
   Port    : ${config.app.port}
   Env     : ${config.app.nodeEnv}
   Endpoint: POST /webhooks/orders/paid
   Health  : GET  /health
  `);
});

module.exports = app;
