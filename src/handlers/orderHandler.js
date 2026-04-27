const config = require("../../config");
const rechargeService = require("../services/rechargeService");

/**
 * Determine which line items in a Shopify order should trigger a subscription.
 *
 * Logic:
 * 1. If SUBSCRIPTION_VARIANT_IDS is configured → only those variant IDs
 * 2. If a line item has a selling_plan_allocation → it's a native subscription product
 * 3. Fallback: treat ALL line items as subscriptions (useful for simple setups)
 */
function getSubscribableLineItems(lineItems) {
    const {subscriptionVariantIds} = config.subscription;

    if (subscriptionVariantIds.length > 0) {
        // Filter to only configured variant IDs
        return lineItems.filter((item) =>
            subscriptionVariantIds.includes(String(item.variant_id))
        );
    }

    // Native Shopify subscription products (selling plan)
    const withSellingPlan = lineItems.filter(
        (item) => item.selling_plan_allocation != null
    );

    if (withSellingPlan.length > 0) {
        return withSellingPlan;
    }

    // Fallback: all items
    return lineItems;
}

/**
 * Extract subscription interval from a line item's selling plan (if present).
 * Falls back to app defaults.
 */
function getIntervalFromLineItem(lineItem) {
    const {defaultIntervalUnit, defaultIntervalFrequency} = config.subscription;

    const sellingPlan = lineItem.selling_plan_allocation?.selling_plan;
    if (!sellingPlan) {
        return {
            intervalUnit: defaultIntervalUnit,
            intervalFrequency: defaultIntervalFrequency,
        };
    }

    // Shopify selling plan names often contain hints like "Every 1 Month"
    // Try to parse them; otherwise fall back to defaults.
    const name = sellingPlan.name || "";
    const match = name.match(/every\s+(\d+)\s+(day|week|month)/i);
    if (match) {
        return {
            intervalFrequency: parseInt(match[1]),
            intervalUnit: match[2].toLowerCase(),
        };
    }

    return {
        intervalUnit: defaultIntervalUnit,
        intervalFrequency: defaultIntervalFrequency,
    };
}

/**
 * Main handler: process a Shopify `orders/paid` webhook payload.
 * Creates Recharge customer + address + one subscription per qualifying line item.
 */
async function processOrderPaid(order) {
    console.log(`\n📦 Processing order #${order.order_number} (${order.id})`);

    // 1. Validate order has a customer
    if (!order.email) {
        throw new Error("Order has no email — cannot create Recharge customer");
    }

    // 2. Identify subscribable line items
    const lineItems = getSubscribableLineItems(order.line_items || []);

    if (lineItems.length === 0) {
        console.log("ℹ️  No subscribable line items found — skipping");
        return {skipped: true, reason: "no_subscribable_items"};
    }

    console.log(`🔎 ${lineItems.length} subscribable item(s) found`);

    // 3. Find or create Recharge customer
    const rechargeCustomer = await rechargeService.findOrCreateCustomer(order);

    // 4. Find or create Recharge address
    const rechargeAddress = await rechargeService.findOrCreateAddress(
        rechargeCustomer.id,
        order
    );

    // 5. Create one subscription per line item
    const results = [];

    for (const item of lineItems) {
        const {intervalUnit, intervalFrequency} = getIntervalFromLineItem(item);

        try {
            const subscription = await rechargeService.createSubscription({
                addressId: rechargeAddress.id,
                shopifyVariantId: item.variant_id,
                shopifyProductId: item.product_id,
                quantity: item.quantity,
                price: item.price,
                title: item.title,
                intervalUnit,
                intervalFrequency,
            });

            results.push({
                lineItemId: item.id,
                variantId: item.variant_id,
                subscriptionId: subscription.id,
                status: "created",
            });
        } catch (err) {
            console.error(
                `❌ Failed to create subscription for variant ${item.variant_id}:`,
                err.message
            );
            results.push({
                lineItemId: item.id,
                variantId: item.variant_id,
                status: "error",
                error: err.message,
            });
        }
    }

    const successCount = results.filter((r) => r.status === "created").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    console.log(
        `✅ Order #${order.order_number} processed: ${successCount} subscription(s) created, ${errorCount} error(s)\n`
    );

    return {
        orderId: order.id,
        orderNumber: order.order_number,
        rechargeCustomerId: rechargeCustomer.id,
        rechargeAddressId: rechargeAddress.id,
        subscriptions: results,
    };
}

module.exports = {processOrderPaid};
