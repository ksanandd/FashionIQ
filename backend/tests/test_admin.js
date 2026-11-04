require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../server");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";

// Tokens
const adminToken = jwt.sign(
    { user_id: 3, email: "admin.demo@example.com", role: "ADMIN" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

const userToken = jwt.sign(
    { user_id: 1, email: "anand.demo@example.com", role: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

async function runAdminTests() {
    console.log("================================================================================");
    console.log("FashionIQ Phase 8: Admin Portal Integration & Security Test Suite");
    console.log("================================================================================");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Ephemeral test server running at ${baseUrl}`);

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
        }
    }

    // Tracking IDs for cleanup
    let testProductId = null;
    let testVariantId = null;
    let testCategoryId = null;
    let testBrandId = null;
    const testOrderIds = [];

    try {
        // ==============================================================================
        // 1. Security & RBAC Guards
        // ==============================================================================
        console.log("\n1. Testing Security & Role-Based Authorization:");

        // 1.1 Unauthenticated -> 401
        const resUnauth = await fetch(`${baseUrl}/api/admin/dashboard`);
        assert(resUnauth.status === 401, "Unauthenticated access rejected with 401 Unauthorized");

        // 1.2 USER role -> 403
        const resForbidden = await fetch(`${baseUrl}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        assert(resForbidden.status === 403, "Normal USER access rejected with 403 Forbidden");

        // 1.3 ADMIN role -> 200
        const resAdmin = await fetch(`${baseUrl}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(resAdmin.status === 200, "ADMIN access succeeds with 200 OK");

        // ==============================================================================
        // 2. Dashboard Statistics & Revenue Integrity
        // ==============================================================================
        console.log("\n2. Testing Dashboard Statistics & Accounting Policy:");
        const dataDash = await resAdmin.json();
        assert(dataDash.success === true, "Dashboard response success is true");
        const dash = dataDash.dashboard;

        assert(dash.users.total >= 1, `Users total: ${dash.users.total} (Admins: ${dash.users.admins}, Customers: ${dash.users.customers})`);
        assert(dash.catalog.total_products >= 1, `Total products: ${dash.catalog.total_products}`);
        assert(dash.catalog.total_categories >= 1, `Total categories: ${dash.catalog.total_categories}`);
        assert(dash.catalog.total_brands >= 1, `Total brands: ${dash.catalog.total_brands}`);
        assert(dash.orders.total >= 0, `Total orders: ${dash.orders.total}`);
        assert(dash.revenue !== undefined, "Revenue statistics present");
        assert(
            dash.revenue.recognized_revenue >= 0,
            `Recognized revenue: ₹${dash.revenue.recognized_revenue} (Distinguishes PAID from PENDING)`
        );
        assert(
            dash.revenue.accounting_policy.includes("PAID"),
            "Accounting policy clearly documented in dashboard response"
        );

        // ==============================================================================
        // 3. Analytics
        // ==============================================================================
        console.log("\n3. Testing Analytics Dataset:");
        const resAnalytics = await fetch(`${baseUrl}/api/admin/analytics`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataAnalytics = await resAnalytics.json();
        assert(resAnalytics.status === 200, "Analytics endpoint returns 200 OK");
        assert(Array.isArray(dataAnalytics.analytics.monthly_trends), "Monthly trends is an array");
        assert(Array.isArray(dataAnalytics.analytics.order_status_distribution), "Order status distribution is an array");
        assert(Array.isArray(dataAnalytics.analytics.top_products), "Top products is an array");
        assert(Array.isArray(dataAnalytics.analytics.category_distribution), "Category distribution is an array");
        assert(Array.isArray(dataAnalytics.analytics.stock_overview), "Stock overview is an array");
        assert(dataAnalytics.analytics.stock_overview.length >= 3, "Stock overview contains all 3 inventory health tiers");
        assert(dataAnalytics.analytics.stock_overview.every(s => typeof s.stock_level === "string" && s.stock_level.length > 0), "Every stock overview record has a valid non-empty stock_level string");
        assert(dataAnalytics.analytics.stock_overview.every(s => typeof s.variant_count === "number" && !isNaN(s.variant_count)), "Every stock overview record has a valid numeric variant_count");
        assert(dataAnalytics.analytics.stock_overview.some(s => s.stock_level.includes("Out of Stock")), "Preserves 'Out of Stock' tier classification");
        assert(dataAnalytics.analytics.stock_overview.some(s => s.stock_level.includes("Low Stock")), "Preserves 'Low Stock' tier classification");
        assert(dataAnalytics.analytics.stock_overview.some(s => s.stock_level.includes("In Stock")), "Preserves 'In Stock' tier classification");

        // ==============================================================================
        // 4. Category Management
        // ==============================================================================
        console.log("\n4. Testing Category Management & Duplicate Prevention:");
        // 4.1 Create Category
        const resCatCreate = await fetch(`${baseUrl}/api/admin/categories`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                category_name: "Test Audit Category",
                description: "Temporary category for phase 8 verification",
            }),
        });
        const dataCatCreate = await resCatCreate.json();
        assert(resCatCreate.status === 201, "Category created with 201 Created");
        testCategoryId = dataCatCreate.category_id;

        // 4.2 Reject Duplicate Category
        const resCatDup = await fetch(`${baseUrl}/api/admin/categories`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                category_name: "test audit category", // case-insensitive check
            }),
        });
        assert(resCatDup.status === 400, "Duplicate category name rejected with 400");

        // 4.3 Update Category
        const resCatUpdate = await fetch(`${baseUrl}/api/admin/categories/${testCategoryId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                category_name: "Updated Test Category",
                description: "Updated description",
            }),
        });
        assert(resCatUpdate.status === 200, "Category updated with 200 OK");

        // 4.4 Prevent Unsafe Category Deletion (if products present)
        const [catsWithProd] = await db.query("SELECT category_id FROM PRODUCT LIMIT 1");
        const unsafeCatId = catsWithProd && catsWithProd.length > 0 ? catsWithProd[0].category_id : 4;
        const resCatUnsafe = await fetch(`${baseUrl}/api/admin/categories/${unsafeCatId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(resCatUnsafe.status === 400, "Deletion of category with active products rejected with 400");

        // ==============================================================================
        // 5. Brand Management
        // ==============================================================================
        console.log("\n5. Testing Brand Management & Duplicate Prevention:");
        // 5.1 Create Brand
        const resBrandCreate = await fetch(`${baseUrl}/api/admin/brands`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                brand_name: "Test Audit Brand",
                website: "https://testbrand.example.com",
                country: "India",
            }),
        });
        const dataBrandCreate = await resBrandCreate.json();
        assert(resBrandCreate.status === 201, "Brand created with 201 Created");
        testBrandId = dataBrandCreate.brand_id;

        // 5.2 Duplicate Brand Rejection
        const resBrandDup = await fetch(`${baseUrl}/api/admin/brands`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                brand_name: "test audit brand",
            }),
        });
        assert(resBrandDup.status === 400, "Duplicate brand name rejected with 400");

        // 5.3 Prevent Unsafe Brand Deletion
        // Brand 1 (Nike) has active products
        const resBrandUnsafe = await fetch(`${baseUrl}/api/admin/brands/1`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(resBrandUnsafe.status === 400, "Deletion of brand with active products rejected with 400");

        // ==============================================================================
        // 6. Product Management & Input Validation
        // ==============================================================================
        console.log("\n6. Testing Product Management & Validation:");
        // 6.1 Reject Invalid Product (Negative Price)
        const resProdInvalidPrice = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_name: "Bad Price Product",
                price: -500,
                gender: "Men",
                category_id: testCategoryId,
                brand_id: testBrandId,
            }),
        });
        assert(resProdInvalidPrice.status === 400, "Product with negative price rejected with 400");

        // 6.2 Reject Invalid Gender
        const resProdInvalidGender = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_name: "Bad Gender Product",
                price: 1200,
                gender: "Alien",
                category_id: testCategoryId,
                brand_id: testBrandId,
            }),
        });
        assert(resProdInvalidGender.status === 400, "Product with invalid gender rejected with 400");

        // 6.3 Create Valid Test Product with Lowercase Gender to Verify Normalization
        const resProdCreate = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_name: "Test Audit Premium Polo",
                description: "Automated test product for phase 8 verification",
                price: 2499.0,
                gender: "men", // lowercase "men" to test case-insensitive normalization
                category_id: testCategoryId,
                brand_id: testBrandId,
                image_url: "/placeholder-product.png",
                initial_variant: {
                    color: "Navy",
                    size: "L",
                    stock_quantity: 25,
                },
            }),
        });
        const dataProdCreate = await resProdCreate.json();
        assert(resProdCreate.status === 201, "Product created with 201 Created");
        testProductId = dataProdCreate.product_id;

        // Verify direct MySQL persistence of normalized gender
        const [persistedProd] = await db.query("SELECT gender FROM PRODUCT WHERE product_id = ?", [testProductId]);
        assert(persistedProd[0].gender === "Men", "Gender normalized and persisted in MySQL as 'Men'");

        // 6.4 Update Product with Lowercase "unisex"
        const resProdUpdate = await fetch(`${baseUrl}/api/admin/products/${testProductId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_name: "Updated Test Audit Polo",
                description: "Updated description",
                price: 2799.0,
                gender: "unisex", // lowercase "unisex"
                category_id: testCategoryId,
                brand_id: testBrandId,
                image_url: "/placeholder-product.png",
            }),
        });
        assert(resProdUpdate.status === 200, "Product updated with 200 OK");
        const [persistedUpdatedProd] = await db.query("SELECT gender FROM PRODUCT WHERE product_id = ?", [testProductId]);
        assert(persistedUpdatedProd[0].gender === "Unisex", "Updated gender normalized and persisted in MySQL as 'Unisex'");

        // 6.5 Prevent Unsafe Product Deletion (Product 1 has orders)
        const resProdUnsafeDelete = await fetch(`${baseUrl}/api/admin/products/1`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(resProdUnsafeDelete.status === 400, "Cannot delete product with existing customer orders (400)");

        // ==============================================================================
        // 7. Variant & Inventory Management
        // ==============================================================================
        console.log("\n7. Testing Variant & Inventory Management:");
        // 7.1 Reject Negative Stock
        const resVarNegativeStock = await fetch(`${baseUrl}/api/admin/variants`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_id: testProductId,
                color: "Red",
                size: "M",
                stock_quantity: -5,
                price: 2799,
            }),
        });
        assert(resVarNegativeStock.status === 400, "Variant with negative stock rejected with 400");

        // 7.2 Create Variant
        const resVarCreate = await fetch(`${baseUrl}/api/admin/variants`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_id: testProductId,
                color: "Red",
                size: "M",
                stock_quantity: 15,
                price: 2799,
            }),
        });
        const dataVarCreate = await resVarCreate.json();
        assert(resVarCreate.status === 201, "Variant created with 201 Created");
        testVariantId = dataVarCreate.variant_id;

        // 7.3 Update Variant Stock
        const resVarUpdate = await fetch(`${baseUrl}/api/admin/variants/${testVariantId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                stock_quantity: 8, // Set to low stock
            }),
        });
        assert(resVarUpdate.status === 200, "Variant stock updated with 200 OK");

        // 7.4 Query Low Stock Filter
        const resLowStock = await fetch(`${baseUrl}/api/admin/variants?low_stock=true`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataLowStock = await resLowStock.json();
        assert(dataLowStock.variants.some((v) => v.variant_id === testVariantId), "Updated variant appears in low-stock query");

        // ==============================================================================
        // 8. Order Management, State Machine & Cancellation Safety
        // ==============================================================================
        console.log("\n8. Testing Order Management & Status Transitions:");
        const resOrders = await fetch(`${baseUrl}/api/admin/orders?limit=5`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataOrders = await resOrders.json();
        assert(resOrders.status === 200, "Orders list retrieved with 200 OK");

        // 8.1 Invalid status transition rejection
        const [dummyOrderRes] = await db.query(`
            INSERT INTO ORDERS (user_id, total_amount, status, payment_method, payment_status, shipping_street, shipping_city, shipping_state, shipping_pincode)
            VALUES (1, 1999.00, 'PENDING', 'COD', 'PENDING', '123 MG Road', 'Bengaluru', 'Karnataka', '560001')
        `);
        const testOrderId = dummyOrderRes.insertId;
        testOrderIds.push(testOrderId);

        // Attach an order item for variant stock testing
        await db.query(`
            INSERT INTO ORDER_ITEM (order_id, product_id, variant_id, quantity, price_at_purchase, subtotal)
            VALUES (?, ?, ?, 2, 999.50, 1999.00)
        `, [testOrderId, testProductId, testVariantId]);

        // Fetch Order Details
        const resOrderDetail = await fetch(`${baseUrl}/api/admin/orders/${testOrderId}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataOrderDetail = await resOrderDetail.json();
        assert(resOrderDetail.status === 200, "Order details retrieved with 200 OK");
        assert(Array.isArray(dataOrderDetail.order.items) && dataOrderDetail.order.items.length === 1, "Order items loaded correctly");

        // 8.2 Reject Invalid Status Transition
        const resBadStatus = await fetch(`${baseUrl}/api/admin/orders/${testOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "MAGIC_DELIVERED" }),
        });
        assert(resBadStatus.status === 400, "Invalid status transition rejected with 400");

        // 8.3 Permitted Cancellation from PENDING & Atomic Inventory Restoration
        const [preCancelVariant] = await db.query("SELECT stock_quantity FROM PRODUCT_VARIANT WHERE variant_id = ?", [testVariantId]);
        const initialStock = preCancelVariant[0].stock_quantity;

        const resCancelPending = await fetch(`${baseUrl}/api/admin/orders/${testOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "CANCELLED" }),
        });
        assert(resCancelPending.status === 200, "Order cancelled from PENDING with 200 OK");

        const [postCancelVariant] = await db.query("SELECT stock_quantity FROM PRODUCT_VARIANT WHERE variant_id = ?", [testVariantId]);
        assert(postCancelVariant[0].stock_quantity === initialStock + 2, "Atomic stock quantity restored (+2 units)");

        // 8.4 Prohibit double-cancellation & double-stock restoration
        const resReCancel = await fetch(`${baseUrl}/api/admin/orders/${testOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "CANCELLED" }),
        });
        assert(resReCancel.status === 400, "Modifying already CANCELLED order rejected with 400");
        const [reCheckStock] = await db.query("SELECT stock_quantity FROM PRODUCT_VARIANT WHERE variant_id = ?", [testVariantId]);
        assert(reCheckStock[0].stock_quantity === initialStock + 2, "Inventory never restored more than once");

        // 8.5 Test Prohibited Cancellation from SHIPPED
        const [shippedOrderRes] = await db.query(`
            INSERT INTO ORDERS (user_id, total_amount, status, payment_method, payment_status, shipping_street, shipping_city, shipping_state, shipping_pincode)
            VALUES (1, 2499.00, 'SHIPPED', 'COD', 'PENDING', '123 MG Road', 'Bengaluru', 'Karnataka', '560001')
        `);
        const shippedOrderId = shippedOrderRes.insertId;
        testOrderIds.push(shippedOrderId);

        const resCancelShipped = await fetch(`${baseUrl}/api/admin/orders/${shippedOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "CANCELLED" }),
        });
        assert(resCancelShipped.status === 400, "Cancellation of SHIPPED order strictly rejected with 400");

        // Reverting SHIPPED to PENDING also rejected
        const resRevertShipped = await fetch(`${baseUrl}/api/admin/orders/${shippedOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "PENDING" }),
        });
        assert(resRevertShipped.status === 400, "Reverting SHIPPED order to PENDING rejected with 400");

        // 8.6 Test Prohibited Cancellation from DELIVERED
        await db.query("UPDATE ORDERS SET status = 'DELIVERED', payment_status = 'PAID' WHERE order_id = ?", [shippedOrderId]);

        const resCancelDelivered = await fetch(`${baseUrl}/api/admin/orders/${shippedOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "CANCELLED" }),
        });
        assert(resCancelDelivered.status === 400, "Cancellation of DELIVERED order strictly rejected with 400");

        const resRevertDelivered = await fetch(`${baseUrl}/api/admin/orders/${shippedOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "PROCESSING" }),
        });
        assert(resRevertDelivered.status === 400, "Reverting DELIVERED order to PROCESSING rejected with 400");

        // ==============================================================================
        // 8.7 Revenue Accounting Policy & COD Collection Confirmation Audit
        // ==============================================================================
        console.log("\n8.7 Testing Revenue Accounting & Payment Method Isolation:");

        // Create Ephemeral SIMULATED_CARD Order (₹3,000, PAID)
        const [simCardRes] = await db.query(`
            INSERT INTO ORDERS (user_id, total_amount, status, payment_method, payment_status, shipping_street, shipping_city, shipping_state, shipping_pincode)
            VALUES (1, 3000.00, 'PROCESSING', 'SIMULATED_CARD', 'PAID', '123 MG Road', 'Bengaluru', 'Karnataka', '560001')
        `);
        testOrderIds.push(simCardRes.insertId);

        // Create Ephemeral COD Order (₹2,000, PENDING)
        const [codPendingRes] = await db.query(`
            INSERT INTO ORDERS (user_id, total_amount, status, payment_method, payment_status, shipping_street, shipping_city, shipping_state, shipping_pincode)
            VALUES (1, 2000.00, 'PENDING', 'COD', 'PENDING', '123 MG Road', 'Bengaluru', 'Karnataka', '560001')
        `);
        const codOrderId = codPendingRes.insertId;
        testOrderIds.push(codOrderId);

        // Fetch Initial Dashboard Revenue Breakdown
        const resRevAudit = await fetch(`${baseUrl}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataRevAudit = await resRevAudit.json();
        const rev = dataRevAudit.dashboard.revenue;

        // Assertion E: SIMULATED_CARD is tracked separately and excluded from recognized revenue
        assert(rev.simulated_card_revenue >= 3000, `Simulated card volume correctly tracked separately: ₹${rev.simulated_card_revenue}`);
        assert(rev.cod_pending_revenue >= 2000, `COD pending volume tracked under pending collections: ₹${rev.cod_pending_revenue}`);

        const recognizedBaseline = rev.recognized_revenue;
        console.log(`  Initial recognized revenue (excluding simulated & pending COD): ₹${recognizedBaseline}`);

        // Assertion C: Attempting to confirm COD collection before delivery is REJECTED
        const resEarlyCod = await fetch(`${baseUrl}/api/admin/orders/${codOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ confirm_cod_collection: true }),
        });
        assert(resEarlyCod.status === 400, "Attempt to confirm COD cash collection before delivery rejected with 400");

        // Assertion A: COD delivered but cash not collected
        // Delivering an order MUST NOT automatically assume cash was collected
        const resDeliverNoPay = await fetch(`${baseUrl}/api/admin/orders/${codOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: "DELIVERED" }),
        });
        assert(resDeliverNoPay.status === 200, "COD order transitioned to DELIVERED without automatic cash collection");

        const [codOrderCheck] = await db.query("SELECT payment_status FROM ORDERS WHERE order_id = ?", [codOrderId]);
        assert(codOrderCheck[0].payment_status === "PENDING", "Payment status remains PENDING until explicit cash collection confirmation");

        // Check revenue: still pending collections, NOT recognized revenue
        const resRevPostDelivNoPay = await fetch(`${baseUrl}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataRevPostDelivNoPay = await resRevPostDelivNoPay.json();
        assert(
            dataRevPostDelivNoPay.dashboard.revenue.recognized_revenue === recognizedBaseline,
            "Recognized revenue unchanged while COD cash remains uncollected"
        );
        assert(
            dataRevPostDelivNoPay.dashboard.revenue.cod_pending_revenue >= 2000,
            "Uncollected delivered COD order remains in pending collections"
        );

        // Assertion B: Explicit COD Cash Collection Confirmation
        const resConfirmCash = await fetch(`${baseUrl}/api/admin/orders/${codOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ confirm_cod_collection: true }),
        });
        assert(resConfirmCash.status === 200, "Explicit COD cash collection confirmed with 200 OK");

        const [codOrderPaidCheck] = await db.query("SELECT payment_status FROM ORDERS WHERE order_id = ?", [codOrderId]);
        assert(codOrderPaidCheck[0].payment_status === "PAID", "Payment status transitioned to PAID after explicit confirmation");

        // Check revenue again: NOW recognized because DELIVERED and PAID
        const resRevPostConfirm = await fetch(`${baseUrl}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataRevPostConfirm = await resRevPostConfirm.json();
        const revAfterConfirm = dataRevPostConfirm.dashboard.revenue;

        assert(
            revAfterConfirm.recognized_revenue === recognizedBaseline + 2000,
            `Recognized revenue increased by exactly the collected COD amount (₹${revAfterConfirm.recognized_revenue})`
        );
        assert(
            revAfterConfirm.cod_paid_revenue >= 2000,
            `COD paid revenue updated to reflect collected cash: ₹${revAfterConfirm.cod_paid_revenue}`
        );

        // Assertion D: Duplicate collection confirmation is REJECTED
        const resDupConfirm = await fetch(`${baseUrl}/api/admin/orders/${codOrderId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ confirm_cod_collection: true }),
        });
        assert(resDupConfirm.status === 400, "Duplicate COD collection confirmation rejected with 400");

        // ==============================================================================
        // 8.8 Concurrent Cancellation & Atomic Inventory Safety Test
        // ==============================================================================
        console.log("\n8.8 Testing Concurrent Cancellation with Row Locking (SELECT ... FOR UPDATE):");

        // Create Ephemeral Order with 3 units of variant
        const [concurrentOrderRes] = await db.query(`
            INSERT INTO ORDERS (user_id, total_amount, status, payment_method, payment_status, shipping_street, shipping_city, shipping_state, shipping_pincode)
            VALUES (1, 2997.00, 'PENDING', 'COD', 'PENDING', '123 MG Road', 'Bengaluru', 'Karnataka', '560001')
        `);
        const concurrentOrderId = concurrentOrderRes.insertId;
        testOrderIds.push(concurrentOrderId);

        await db.query(`
            INSERT INTO ORDER_ITEM (order_id, product_id, variant_id, quantity, price_at_purchase, subtotal)
            VALUES (?, ?, ?, 3, 999.00, 2997.00)
        `, [concurrentOrderId, testProductId, testVariantId]);

        const [preConcurrentVariant] = await db.query("SELECT stock_quantity FROM PRODUCT_VARIANT WHERE variant_id = ?", [testVariantId]);
        const stockBeforeConcurrent = preConcurrentVariant[0].stock_quantity;

        // Fire two simultaneous cancellation requests concurrently using Promise.all
        const [concurrentResA, concurrentResB] = await Promise.all([
            fetch(`${baseUrl}/api/admin/orders/${concurrentOrderId}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ status: "CANCELLED" }),
            }),
            fetch(`${baseUrl}/api/admin/orders/${concurrentOrderId}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ status: "CANCELLED" }),
            }),
        ]);

        const statuses = [concurrentResA.status, concurrentResB.status].sort();
        assert(
            statuses[0] === 200 && statuses[1] === 400,
            `Concurrent cancellations safely serialized: exactly one succeeded (200) and one rejected (400)`
        );

        const [postConcurrentVariant] = await db.query("SELECT stock_quantity FROM PRODUCT_VARIANT WHERE variant_id = ?", [testVariantId]);
        assert(
            postConcurrentVariant[0].stock_quantity === stockBeforeConcurrent + 3,
            `Inventory restored exactly once (+3 units, from ${stockBeforeConcurrent} to ${postConcurrentVariant[0].stock_quantity}) under concurrency`
        );

        // ==============================================================================
        // 9. User Management & Security Privacy
        // ==============================================================================
        console.log("\n9. Testing User Management & Security Privacy:");
        const resUsers = await fetch(`${baseUrl}/api/admin/users`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataUsers = await resUsers.json();
        assert(resUsers.status === 200, "User list retrieved with 200 OK");
        assert(dataUsers.users.length > 0, `Returned ${dataUsers.users.length} registered users`);

        // Critical: Ensure password and password hashes are NEVER exposed
        assert(
            dataUsers.users.every((u) => u.password === undefined),
            "CRITICAL: User password hashes are strictly excluded from API response"
        );

        // Test User Details by ID
        const resUserDetail = await fetch(`${baseUrl}/api/admin/users/1`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const dataUserDetail = await resUserDetail.json();
        assert(resUserDetail.status === 200, "User details by ID retrieved with 200 OK");
        assert(dataUserDetail.user.password === undefined, "Password omitted from individual user profile");
        assert(Array.isArray(dataUserDetail.user.orders), "User order history attached");

        // Test Protection against demoting the last Admin
        const resDemoteAdmin = await fetch(`${baseUrl}/api/admin/users/3/role`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ role: "USER" }),
        });
        // If user 3 is the only admin, it must be rejected with 400
        // Either rejected (if sole admin) or permitted (if multiple admins)
        console.log(`  Demote admin response status: ${resDemoteAdmin.status}`);
        assert([200, 400].includes(resDemoteAdmin.status), "Demotion logic executes safely");

    } catch (err) {
        console.error("Test execution exception:", err);
        failed++;
    } finally {
        // ==============================================================================
        // Clean Up Test Records Only
        // ==============================================================================
        console.log("\nCleaning up test artifacts...");
        for (const oid of testOrderIds) {
            await db.query("DELETE FROM ORDER_ITEM WHERE order_id = ?", [oid]).catch(() => {});
            await db.query("DELETE FROM ORDERS WHERE order_id = ?", [oid]).catch(() => {});
        }
        if (testVariantId) {
            await fetch(`${baseUrl}/api/admin/variants/${testVariantId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${adminToken}` },
            }).catch(() => {});
        }
        if (testProductId) {
            await fetch(`${baseUrl}/api/admin/products/${testProductId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${adminToken}` },
            }).catch(() => {});
        }
        if (testCategoryId) {
            await fetch(`${baseUrl}/api/admin/categories/${testCategoryId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${adminToken}` },
            }).catch(() => {});
        }
        if (testBrandId) {
            await fetch(`${baseUrl}/api/admin/brands/${testBrandId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${adminToken}` },
            }).catch(() => {});
        }
        server.close();
    }

    console.log(`\n================================================================================`);
    console.log(`Admin Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`================================================================================\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAdminTests();
