/**
 * FashionIQ Backend QA Suite: Order Processing, Validation, Concurrency & Data Isolation
 * File: backend/tests/test_order_qa.js
 *
 * Verifies:
 * - Unauthenticated request rejection on order endpoints (401)
 * - Cart and line item payload validation: empty cart, non-array, missing items (400)
 * - Variant ID format validation and stock quantity bounds (1-50 units per item) (400)
 * - Shipping address validation: street, city, state, pincode completeness (400)
 * - Payment method whitelist validation: COD vs SIMULATED_CARD vs invalid methods (400)
 * - In-flight concurrency lock & rapid duplicate order rate limiting (429)
 * - Inventory stock check & cumulative quantity validation within same cart (400)
 * - Variant-to-product relationship verification (400)
 * - Atomic order creation with price calculation and stock reduction (201)
 * - Order detail retrieval parameter validation (400)
 * - Multi-tenant isolation & IDOR prevention: User B cannot inspect User A's order (404)
 * - Admin privileged inspection of customer orders (200)
 */

const app = require("../server");
const {
    createTestServer,
    createToken,
    createAssertionCollector,
    mockDb,
} = require("./test_helpers");

async function runOrderQaTests() {
    console.log("================================================================================");
    console.log("FashionIQ QA Test Suite 4: Order Processing & Privacy QA");
    console.log("================================================================================\n");

    const { baseUrl, close } = await createTestServer(app);
    const { assert, summarize } = createAssertionCollector("Order Processing QA Suite");

    mockDb.install();

    const user1Token = createToken({ user_id: 1, email: "buyer1@example.com", role: "USER" });
    const user2Token = createToken({ user_id: 2, email: "buyer2@example.com", role: "USER" });
    const adminToken = createToken({ user_id: 99, email: "admin@example.com", role: "ADMIN" });

    const validAddress = {
        street: "123 Fashion Blvd",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
    };

    try {
        // =====================================================================
        // Section 1: Authentication Guards (401)
        // =====================================================================
        console.log("--- 1. Authentication Guards on Order Endpoints ---");

        // 1.1 POST /api/orders without auth
        const resPostOrderUnauth = await fetch(`${baseUrl}/api/orders`, { method: "POST" });
        assert(resPostOrderUnauth.status === 401, "POST /api/orders requires authentication (401)");

        // 1.2 GET /api/orders without auth
        const resGetOrdersUnauth = await fetch(`${baseUrl}/api/orders`);
        assert(resGetOrdersUnauth.status === 401, "GET /api/orders requires authentication (401)");

        // 1.3 GET /api/orders/:id without auth
        const resGetOrderByIdUnauth = await fetch(`${baseUrl}/api/orders/1`);
        assert(resGetOrderByIdUnauth.status === 401, "GET /api/orders/:id requires authentication (401)");

        // =====================================================================
        // Section 2: Order Payload Validation
        // =====================================================================
        console.log("\n--- 2. Order Payload & Input Validation ---");

        // 2.1 Missing items array
        const resNoItems = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ shipping_address: validAddress }),
        });
        assert(resNoItems.status === 400, "Order without items array rejected with 400 Bad Request");
        const dataNoItems = await resNoItems.json();
        assert(dataNoItems.message.includes("Cart items are required"), "Error message notes cart items requirement");

        // 2.2 Empty items array
        const resEmptyItems = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ items: [], shipping_address: validAddress }),
        });
        assert(resEmptyItems.status === 400, "Order with empty items array rejected with 400 Bad Request");

        // 2.3 Invalid variant_id (non-numeric / <= 0)
        const resBadVariant = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: -1, quantity: 1 }],
                shipping_address: validAddress,
            }),
        });
        assert(resBadVariant.status === 400, "Invalid variant ID rejected with 400 Bad Request");

        // 2.4 Invalid quantity (0 or > 50 units)
        const resZeroQty = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 0 }],
                shipping_address: validAddress,
            }),
        });
        assert(resZeroQty.status === 400, "Quantity of 0 rejected with 400 Bad Request");

        const resExcessQty = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 51 }],
                shipping_address: validAddress,
            }),
        });
        assert(resExcessQty.status === 400, "Quantity exceeding 50 units rejected with 400 Bad Request");

        // 2.5 Shipping address completeness checks
        // Missing street
        const resNoStreet = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 1 }],
                shipping_address: { city: "Bengaluru", state: "Karnataka", pincode: "560001" },
            }),
        });
        assert(resNoStreet.status === 400, "Shipping address missing street rejected with 400 Bad Request");

        // Missing city
        const resNoCity = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 1 }],
                shipping_address: { street: "123 Blvd", state: "Karnataka", pincode: "560001" },
            }),
        });
        assert(resNoCity.status === 400, "Shipping address missing city rejected with 400 Bad Request");

        // Missing state
        const resNoState = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 1 }],
                shipping_address: { street: "123 Blvd", city: "Bengaluru", pincode: "560001" },
            }),
        });
        assert(resNoState.status === 400, "Shipping address missing state rejected with 400 Bad Request");

        // Missing pincode
        const resNoPincode = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 1 }],
                shipping_address: { street: "123 Blvd", city: "Bengaluru", state: "Karnataka" },
            }),
        });
        assert(resNoPincode.status === 400, "Shipping address missing pincode rejected with 400 Bad Request");
        const dataNoPincode = await resNoPincode.json();
        assert(dataNoPincode.message.includes("complete shipping address"), "Error message notes complete shipping address requirement");

        // 2.6 Unsupported payment method (400)
        const resBadPayment = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 1 }],
                shipping_address: validAddress,
                payment_method: "CRYPTOCURRENCY",
            }),
        });
        assert(resBadPayment.status === 400, "Unsupported payment method rejected with 400 Bad Request");
        const dataBadPayment = await resBadPayment.json();
        assert(dataBadPayment.message.includes("Allowed methods: COD, SIMULATED_CARD"), "Payment error lists supported methods");

        // =====================================================================
        // Section 3: Inventory Validation & Transactional Order Placement
        // =====================================================================
        console.log("\n--- 3. Inventory Validation & Transaction Execution ---");

        // 3.1 Insufficient stock for requested quantity (400)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM PRODUCT_VARIANT pv JOIN PRODUCT p") && sql.includes("FOR UPDATE"),
            () => [[{
                variant_id: 1,
                product_id: 10,
                stock_quantity: 2, // Only 2 in stock
                price: 999.00,
                product_name: "Graphic Tee",
                color: "Black",
                size: "M"
            }]]
        );
        const resInsufficientStock = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 5 }], // Requesting 5
                shipping_address: validAddress,
            }),
        });
        assert(resInsufficientStock.status === 400, "Order exceeding available stock rejected with 400 Bad Request");
        const dataStock = await resInsufficientStock.json();
        assert(dataStock.message.includes("Insufficient stock"), "Error message indicates insufficient stock");

        // 3.2 Cumulative quantity validation (repeating same variant in cart items)
        const resCumulativeStock = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                // Two lines for variant 1, each qty 2 => total 4 requested, but only 2 available
                items: [
                    { variant_id: 1, quantity: 2 },
                    { variant_id: 1, quantity: 2 },
                ],
                shipping_address: validAddress,
            }),
        });
        assert(resCumulativeStock.status === 400, "Cumulative quantity exceeding stock across duplicate cart lines rejected with 400");

        // 3.3 Variant product-id mismatch validation
        const resProductMismatch = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, product_id: 999, quantity: 1 }], // Mismatch: variant belongs to product 10
                shipping_address: validAddress,
            }),
        });
        assert(resProductMismatch.status === 400, "Variant submitted with mismatched product_id rejected with 400 Bad Request");

        // 3.4 Successful atomic order placement (201 Created)
        // Use a unique user token so rate limiting debounce doesn't block this test
        const freshUserToken = createToken({ user_id: 50, email: "freshbuyer@example.com", role: "USER" });
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM PRODUCT_VARIANT pv JOIN PRODUCT p") && sql.includes("FOR UPDATE"),
            () => [[{
                variant_id: 1,
                product_id: 10,
                stock_quantity: 10,
                price: 1500.00,
                product_name: "Tailored Blazer",
                color: "Navy",
                size: "40"
            }]]
        );
        mockDb.when(
            (sql) => sql.includes("INSERT INTO `orders`"),
            () => [{ insertId: 88, affectedRows: 1 }]
        );
        mockDb.when(
            (sql) => sql.includes("INSERT INTO `order_item`"),
            () => [{ insertId: 101, affectedRows: 1 }]
        );
        mockDb.when(
            (sql) => sql.includes("UPDATE PRODUCT_VARIANT SET stock_quantity"),
            () => [{ affectedRows: 1 }]
        );
        mockDb.when(
            (sql) => sql.includes("INSERT INTO USER_INTERACTION"),
            () => [{ insertId: 201, affectedRows: 1 }]
        );

        const resOrderSuccess = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${freshUserToken}`,
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, product_id: 10, quantity: 2 }],
                shipping_address: validAddress,
                payment_method: "COD",
            }),
        });
        assert(resOrderSuccess.status === 201, "Valid order placement succeeds with 201 Created");
        const dataOrderSuccess = await resOrderSuccess.json();
        assert(dataOrderSuccess.success === true, "Order placement response success is true");
        assert(dataOrderSuccess.order.order_id === 88, "Response returns generated order_id");
        assert(dataOrderSuccess.order.total_amount === 3000.00, "Server accurately calculates total amount (1500 * 2)");
        assert(dataOrderSuccess.order.status === "PENDING", "COD order initializes with status PENDING");

        // =====================================================================
        // Section 4: Concurrency & Rate Limiting Guards (429)
        // =====================================================================
        console.log("\n--- 4. Concurrency Guard & Rapid Duplicate Debounce ---");

        // Rapid duplicate order submission within 3-second debounce window (429)
        const resRapidDuplicate = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${freshUserToken}`, // Same user submitting within 3 seconds
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 1 }],
                shipping_address: validAddress,
            }),
        });
        assert(resRapidDuplicate.status === 429, "Rapid duplicate order submission within 3 seconds rejected with 429 Too Many Requests");
        const dataDuplicate = await resRapidDuplicate.json();
        assert(dataDuplicate.message.includes("recent order was just placed"), "Rate limiting error informs client of debounce protection");

        // =====================================================================
        // Section 5: Order Retrieval & Multi-Tenant Data Isolation (IDOR)
        // =====================================================================
        console.log("\n--- 5. Order Retrieval & Multi-Tenant Data Isolation (IDOR) ---");

        // 5.1 Invalid order ID parameter
        const resBadOrderId = await fetch(`${baseUrl}/api/orders/invalid-id`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resBadOrderId.status === 400, "Order retrieval with invalid ID format rejected with 400 Bad Request");

        // 5.2 Non-existent order (404)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM `orders` WHERE order_id = ?"),
            () => [[]]
        );
        const resOrderNotFound = await fetch(`${baseUrl}/api/orders/9999`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resOrderNotFound.status === 404, "Non-existent order returns 404 Not Found");

        // 5.3 IDOR Guard: User 2 attempting to inspect User 1's order (404)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM `orders` WHERE order_id = ?"),
            () => [[{
                order_id: 88,
                user_id: 1, // Owned by user 1
                total_amount: 3000.00,
                status: "PENDING",
                payment_method: "COD",
            }]]
        );
        const resIdorInspection = await fetch(`${baseUrl}/api/orders/88`, {
            headers: { Authorization: `Bearer ${user2Token}` }, // User 2 attempting access
        });
        assert(resIdorInspection.status === 404, "IDOR Guard: User 2 attempting to view User 1's order returns 404 Not Found");

        // 5.4 Owner inspecting own order (200 OK)
        mockDb.when(
            (sql) => sql.includes("FROM `order_item` oi JOIN `product` p"),
            () => [[{
                order_item_id: 1,
                order_id: 88,
                product_id: 10,
                variant_id: 1,
                quantity: 2,
                price_at_purchase: 1500.00,
                subtotal: 3000.00,
                product_name: "Tailored Blazer",
                color: "Navy",
                size: "40",
            }]]
        );
        const resOwnerInspection = await fetch(`${baseUrl}/api/orders/88`, {
            headers: { Authorization: `Bearer ${user1Token}` }, // User 1 owns order 88
        });
        assert(resOwnerInspection.status === 200, "Owner viewing own order returns 200 OK");
        const dataOwnerOrder = await resOwnerInspection.json();
        assert(dataOwnerOrder.order.order_id === 88, "Owner receives full order details");
        assert(dataOwnerOrder.order.items.length === 1, "Order line items are included");
        assert(dataOwnerOrder.order.items[0].product_name === "Tailored Blazer", "Line item product details are enriched");

        // 5.5 Admin inspecting customer order (200 OK - privileged oversight)
        const resAdminInspection = await fetch(`${baseUrl}/api/orders/88`, {
            headers: { Authorization: `Bearer ${adminToken}` }, // ADMIN inspecting customer order
        });
        assert(resAdminInspection.status === 200, "Admin role permitted to inspect customer order for fulfillment oversight (200 OK)");

    } catch (err) {
        console.error("Test execution error in Order QA Suite:", err);
        assert(false, `Unexpected exception: ${err.message}`);
    } finally {
        mockDb.restore();
        await close();
    }

    const { failed } = summarize();
    return failed === 0;
}

if (require.main === module) {
    runOrderQaTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = runOrderQaTests;
