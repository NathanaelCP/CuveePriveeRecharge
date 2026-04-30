const axios = require("axios");
const config = require("../../config");

const rechargeClient = axios.create({
    baseURL: config.recharge.baseUrl,
    headers: {
        "X-Recharge-Access-Token": config.recharge.apiKey,
        //"X-Recharge-Version": "2021-11",
        "Content-Type": "application/json",
    },
});

// ─── Response interceptor for logging ───────────────────────────────────────
rechargeClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const data = error.response?.data;
        console.error(`❌ Recharge API error [${status}]:`, JSON.stringify(data));
        return Promise.reject(error);
    }
);

// ─── Customer ────────────────────────────────────────────────────────────────

/**
 * Find an existing Recharge customer by email.
 * Returns the customer object or null if not found.
 */
async function findCustomerByEmail(email) {
    try {
        const {data} = await rechargeClient.get("/customers", {
            params: {email},
        });
        const customers = data.customers || [];
        return customers.length > 0 ? customers[0] : null;
    } catch (err) {
        console.error("Error searching Recharge customer:", err.message);
        throw err;
    }
}

/**
 * Create a new Recharge customer.
 */
async function createCustomer(customerData) {
    const payload = {
        email: customerData.email,
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        tax_exempt: false
    };

    const {data} = await rechargeClient.post("/customers", payload);

    console.log(`✅ Recharge customer created: ${data.customer.id}`);
    return data.customer;
}

/**
 * Find or create a Recharge customer based on Shopify order data.
 */
async function findOrCreateCustomer(shopifyOrder) {
    const email = shopifyOrder.email;
    const billing = shopifyOrder.billing_address || {};
    const customer = shopifyOrder.customer || {};

    let rechargeCustomer = await findCustomerByEmail(email);

    if (rechargeCustomer) {
        console.log(`ℹ️  Recharge customer already exists: ${rechargeCustomer.id}`);
        return rechargeCustomer;
    }

    return createCustomer({
        email,
        firstName: billing.first_name || customer.first_name || "",
        lastName: billing.last_name || customer.last_name || "",
        address1: billing.address1 || "",
        address2: billing.address2 || "",
        city: billing.city || "",
        province: billing.province_code || billing.province || "",
        zip: billing.zip || "",
        country: billing.country_code || billing.country || "",
        phone: billing.phone || customer.phone || "",
        shopifyCustomerId: customer.id,
    });
}

// ─── Address ─────────────────────────────────────────────────────────────────

/**
 * Get or create a Recharge shipping address for a customer.
 */
async function findOrCreateAddress(rechargeCustomerId, shopifyOrder) {
    const shipping = shopifyOrder.shipping_address || shopifyOrder.billing_address || {};

    // Fetch existing addresses
    const {data} = await rechargeClient.get(
        `/addresses`,
        {
            params: {
                customer_id: rechargeCustomerId
            }
        }
    );
    const addresses = data.addresses || [];

    // Try to match on zip + address1
    const existing = addresses.find(
        (a) =>
            a.zip === shipping.zip && a.address1 === shipping.address1
    );

    if (existing) {
        console.log(`ℹ️  Recharge address found: ${existing.id}`);
        return existing;
    }

    // Create new address
    const payload = {
        customer_id: rechargeCustomerId,
        address1: shipping.address1 || "",
        address2: shipping.address2 || "",
        city: shipping.city || "",
        company: shipping.company || "",
        country: shipping.country_code || shipping.country || "",
        first_name: shipping.first_name || "",
        last_name: shipping.last_name || "",
        phone: shipping.phone || "",
        province: shipping.province_code || shipping.province || "",
        zip: shipping.zip || "",
    };

    const {data: newData} = await rechargeClient.post(
        `/addresses`,
        payload
    );
    console.log(`✅ Recharge address created: ${newData.address.id}`);
    return newData.address;
}


// ─── Add credit to customer ─────────────────────────────────────────────────────────────

/**
 * Create a credit account for a given line item.
 */
async function addCustomerCredit(rechargeCustomerId, shopifyLineItem) {
    const payload = {
        customer_id: rechargeCustomerId,
        name: "Credit for prepaid subscription",
        initial_value: shopifyLineItem.price,
        type: "manual",
    };

    await rechargeClient.post("/credit_accounts", payload, {
        headers: {
            "X-Recharge-Version": "2021-11",
        }
    });

    console.log(
        `✅ Recharge credit account created: ${shopifyLineItem.price} for customer ${rechargeCustomerId}`
    );
}

// ─── Subscription ─────────────────────────────────────────────────────────────

/**
 * Create a Recharge subscription for a given line item.
 */
async function createSubscription({
                                      addressId,
                                      shopifyVariantId,
                                      shopifyProductId,
                                      quantity,
                                      price,
                                      title,
                                      intervalUnit,
                                      intervalFrequency,
                                  }) {
    const payload = {
        address_id: addressId,
        external_variant_id: {
            ecommerce: shopifyVariantId
        },
        external_product_id: {
            ecommerce: shopifyProductId
        },
        quantity,
        price,
        product_title: title,
        order_interval_unit: intervalUnit,
        order_interval_frequency: intervalFrequency,
        charge_interval_frequency: intervalFrequency,
        next_charge_scheduled_at: new Date().toISOString().split('T')[0]
    };

    const {data} = await rechargeClient.post("/subscriptions", payload, {
        headers: {
            "X-Recharge-Version": "2021-11",
        }
    });

    console.log(
        `✅ Recharge subscription created: ${data.subscription.id} for variant ${shopifyVariantId}`
    );
    return data.subscription;
}

module.exports = {
    findOrCreateCustomer,
    findOrCreateAddress,
    addCustomerCredit,
    createSubscription,
};
