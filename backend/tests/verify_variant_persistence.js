require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../server");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";

const adminToken = jwt.sign(
    { user_id: 3, email: "admin.demo@example.com", role: "ADMIN" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

async function runVariantPersistenceVerification() {
    console.log("================================================================================");
    console.log("FashionIQ: Product Variant Management & MySQL Persistence Verification");
    console.log("================================================================================");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Ephemeral verification server running at ${baseUrl}\n`);

    let createdBrandId = null;
    let createdProductId = null;
    const createdVariantIds = [];

    try {
        // ----------------------------------------------------------------------
        // STEP 1: Verify Existing Seeded Products & Product 30 Individual Variants
        // ----------------------------------------------------------------------
        console.log("STEP 1: Checking Existing Seeded Products & Variants...");
        const [seededProducts] = await db.query(
            "SELECT product_id, product_name, price FROM PRODUCT WHERE product_id IN (1, 2, 3, 4, 30) ORDER BY product_id ASC"
        );
        console.log("Verified Products:", seededProducts);

        const [p30Variants] = await db.query(
            "SELECT variant_id, product_id, color, size, stock_quantity, price FROM PRODUCT_VARIANT WHERE product_id = 30 ORDER BY variant_id ASC"
        );
        console.log("Product 30 ('U.S. Polo Tailored Fit Shirt') Individual Variants in MySQL:");
        console.table(p30Variants);
        if (p30Variants.length !== 6) {
            throw new Error(`Expected 6 individual variants for Product 30, got ${p30Variants.length}`);
        }
        console.log("[VERIFIED] Product 30 has 6 distinct individual PRODUCT_VARIANT rows in MySQL.\n");

        // ----------------------------------------------------------------------
        // STEP 2: Create a Temporary Brand for Testing
        // ----------------------------------------------------------------------
        console.log("STEP 2: Creating Temporary Brand for Variant Testing...");
        const resBrand = await fetch(`${baseUrl}/api/admin/brands`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                brand_name: `Variant Test Brand ${Date.now()}`,
                website: "https://varianttest.example.com",
                country: "United States",
            }),
        });
        const brandData = await resBrand.json();
        createdBrandId = brandData.brand_id;
        console.log(`[SUCCESS] Temporary Brand created with ID #${createdBrandId}`);

        // ----------------------------------------------------------------------
        // STEP 3: Test Product Creation with Multiple Individual Variants in One Payload
        // ----------------------------------------------------------------------
        console.log("\nSTEP 3: Testing Product Creation with Multiple Individual Variants (POST /api/admin/products)...");
        const productPayload = {
            product_name: "Test Oxford Tailored Fit Shirt",
            description: "Oxford shirt with multiple individual size/color variants",
            price: 1899.00,
            gender: "Men",
            category_id: 1,
            brand_id: createdBrandId,
            image_url: "https://images.unsplash.com/photo-test-shirt",
            variants: [
                { color: "Sky Blue", size: "S", stock_quantity: 10, price: 1899.00 },
                { color: "Sky Blue", size: "M", stock_quantity: 15, price: 1899.00 },
                { color: "Sky Blue", size: "L", stock_quantity: 20, price: 1899.00 },
                { color: "Sky Blue", size: "XL", stock_quantity: 12, price: 1899.00 },
                { color: "Sky Blue", size: "XXL", stock_quantity: 8, price: 1999.00 }, // variant-specific price
                { color: "White", size: "M", stock_quantity: 10, price: 1899.00 },
            ],
        };

        const resProd = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(productPayload),
        });
        const prodData = await resProd.json();
        console.log("Product Creation Response:", prodData);
        if (resProd.status !== 201 || !prodData.product_id) {
            throw new Error(`Failed to create product: ${JSON.stringify(prodData)}`);
        }
        createdProductId = prodData.product_id;
        console.log(`[SUCCESS] Product created with ID #${createdProductId}`);

        // ----------------------------------------------------------------------
        // STEP 4: Direct MySQL SELECT Query to Verify All Variants
        // ----------------------------------------------------------------------
        console.log("\nSTEP 4: Direct MySQL SELECT to inspect individual PRODUCT_VARIANT rows...");
        const [mysqlVariants] = await db.query(
            "SELECT variant_id, product_id, color, size, stock_quantity, price FROM PRODUCT_VARIANT WHERE product_id = ? ORDER BY variant_id ASC",
            [createdProductId]
        );
        console.log("Actual MySQL Rows in PRODUCT_VARIANT:");
        console.table(mysqlVariants);

        if (mysqlVariants.length !== 6) {
            throw new Error(`Expected 6 rows in PRODUCT_VARIANT, got ${mysqlVariants.length}`);
        }
        mysqlVariants.forEach(v => createdVariantIds.push(v.variant_id));

        // Verify each row matches expected combination
        const expectedVariants = [
            { color: "Sky Blue", size: "S", stock: 10, price: "1899.00" },
            { color: "Sky Blue", size: "M", stock: 15, price: "1899.00" },
            { color: "Sky Blue", size: "L", stock: 20, price: "1899.00" },
            { color: "Sky Blue", size: "XL", stock: 12, price: "1899.00" },
            { color: "Sky Blue", size: "XXL", stock: 8, price: "1999.00" },
            { color: "White", size: "M", stock: 10, price: "1899.00" },
        ];

        for (let i = 0; i < expectedVariants.length; i++) {
            const exp = expectedVariants[i];
            const act = mysqlVariants[i];
            if (act.color !== exp.color || act.size !== exp.size || act.stock_quantity !== exp.stock || Number(act.price) !== Number(exp.price)) {
                throw new Error(`Mismatch at row ${i}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(act)}`);
            }
        }
        console.log("[VERIFIED] All 6 variants independently stored in MySQL with distinct variant_ids, individual sizes, colors, stocks, and prices.");

        // ----------------------------------------------------------------------
        // STEP 5: Test In-Payload Duplicate Variant Validation
        // ----------------------------------------------------------------------
        console.log("\nSTEP 5: Testing In-Payload Duplicate Color/Size Validation...");
        const resDupPayload = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_name: "Duplicate Test Shirt",
                price: 1500,
                gender: "Men",
                category_id: 1,
                brand_id: createdBrandId,
                variants: [
                    { color: "Navy", size: "L", stock_quantity: 10 },
                    { color: "Navy", size: "L", stock_quantity: 5 }, // duplicate color and size
                ],
            }),
        });
        const dupPayloadData = await resDupPayload.json();
        console.log("Duplicate In-Payload Response:", resDupPayload.status, dupPayloadData);
        if (resDupPayload.status !== 400 || !dupPayloadData.message.includes("Duplicate variant combination")) {
            throw new Error("Expected in-payload duplicate to be rejected with 400!");
        }
        console.log("[VERIFIED] In-payload duplicate color/size combination rejected with 400 Bad Request");

        // ----------------------------------------------------------------------
        // STEP 6: Test Negative Stock Validation
        // ----------------------------------------------------------------------
        console.log("\nSTEP 6: Testing Negative Stock Quantity Validation...");
        const resNegStock = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_name: "Negative Stock Shirt",
                price: 1500,
                gender: "Men",
                category_id: 1,
                brand_id: createdBrandId,
                variants: [
                    { color: "Black", size: "M", stock_quantity: -10 },
                ],
            }),
        });
        const negStockData = await resNegStock.json();
        console.log("Negative Stock Response:", resNegStock.status, negStockData);
        if (resNegStock.status !== 400 || !negStockData.message.includes("non-negative integer")) {
            throw new Error("Expected negative stock to be rejected with 400!");
        }
        console.log("[VERIFIED] Negative stock quantity rejected with 400 Bad Request");

        // ----------------------------------------------------------------------
        // STEP 7: Test Adding an Individual Variant After Product Creation
        // ----------------------------------------------------------------------
        console.log("\nSTEP 7: Testing Adding New Variant via POST /api/admin/variants...");
        const resAddVar = await fetch(`${baseUrl}/api/admin/variants`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_id: createdProductId,
                color: "White",
                size: "L", // new size for White
                stock_quantity: 14,
                price: 1899.00,
            }),
        });
        const addVarData = await resAddVar.json();
        console.log("Add Variant Response:", addVarData);
        if (resAddVar.status !== 201 || !addVarData.variant_id) {
            throw new Error("Failed to add individual variant!");
        }
        createdVariantIds.push(addVarData.variant_id);
        console.log(`[SUCCESS] New variant added with ID #${addVarData.variant_id}`);

        // Direct MySQL check
        const [mysqlNewVar] = await db.query("SELECT * FROM PRODUCT_VARIANT WHERE variant_id = ?", [addVarData.variant_id]);
        console.log("MySQL record for newly added variant:", mysqlNewVar[0]);
        if (mysqlNewVar[0].color !== "White" || mysqlNewVar[0].size !== "L" || mysqlNewVar[0].stock_quantity !== 14) {
            throw new Error("Direct MySQL check failed for newly added variant!");
        }
        console.log("[VERIFIED] New variant correctly stored in MySQL.");

        // ----------------------------------------------------------------------
        // STEP 8: Test Existing Duplicate Prevention via POST /api/admin/variants
        // ----------------------------------------------------------------------
        console.log("\nSTEP 8: Testing Duplicate Prevention on Existing Product (POST /api/admin/variants)...");
        const resDupExisting = await fetch(`${baseUrl}/api/admin/variants`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_id: createdProductId,
                color: "white", // lowercase to test case-insensitive match
                size: "l",     // lowercase
                stock_quantity: 20,
            }),
        });
        const dupExistingData = await resDupExisting.json();
        console.log("Existing Duplicate Response:", resDupExisting.status, dupExistingData);
        if (resDupExisting.status !== 400 || !dupExistingData.message.includes("already exists for this product")) {
            throw new Error("Expected duplicate variant to be rejected with 400!");
        }
        console.log("[VERIFIED] Duplicate variant rejected with 400 Bad Request");

        // ----------------------------------------------------------------------
        // STEP 9: Test Updating Variant Safely (PUT /api/admin/variants/:id)
        // ----------------------------------------------------------------------
        console.log("\nSTEP 9: Testing Variant Update (PUT /api/admin/variants/:id)...");
        const targetVarId = addVarData.variant_id;
        const resUpdateVar = await fetch(`${baseUrl}/api/admin/variants/${targetVarId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                color: "Off-White",
                size: "XL",
                stock_quantity: 25,
                price: 1950.00,
            }),
        });
        const updateVarData = await resUpdateVar.json();
        console.log("Update Variant Response:", resUpdateVar.status, updateVarData);
        if (resUpdateVar.status !== 200) {
            throw new Error("Failed to update variant!");
        }

        const [mysqlUpdatedVar] = await db.query("SELECT * FROM PRODUCT_VARIANT WHERE variant_id = ?", [targetVarId]);
        console.log("MySQL record after update:", mysqlUpdatedVar[0]);
        if (
            mysqlUpdatedVar[0].color !== "Off-White" ||
            mysqlUpdatedVar[0].size !== "XL" ||
            mysqlUpdatedVar[0].stock_quantity !== 25 ||
            Number(mysqlUpdatedVar[0].price) !== 1950.00
        ) {
            throw new Error("Direct MySQL check failed for updated variant!");
        }
        console.log("[VERIFIED] Variant update persisted in MySQL with new color, size, stock, and price.");

        // ----------------------------------------------------------------------
        // STEP 10: Test Safe Variant Deletion (Unreferenced)
        // ----------------------------------------------------------------------
        console.log("\nSTEP 10: Testing Safe Variant Deletion (DELETE /api/admin/variants/:id)...");
        const resDelVar = await fetch(`${baseUrl}/api/admin/variants/${targetVarId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const delVarData = await resDelVar.json();
        console.log("Delete Variant Response:", resDelVar.status, delVarData);
        if (resDelVar.status !== 200) {
            throw new Error("Failed to delete unreferenced variant!");
        }

        const [mysqlCheckDeleted] = await db.query("SELECT * FROM PRODUCT_VARIANT WHERE variant_id = ?", [targetVarId]);
        if (mysqlCheckDeleted.length !== 0) {
            throw new Error("Deleted variant still exists in MySQL!");
        }
        console.log("[VERIFIED] Unreferenced variant safely deleted from MySQL.");
        // Remove targetVarId from createdVariantIds since it was deleted
        const idxDel = createdVariantIds.indexOf(targetVarId);
        if (idxDel !== -1) createdVariantIds.splice(idxDel, 1);

        // ----------------------------------------------------------------------
        // STEP 11: Test Customer Public API (GET /api/products/:id/variants)
        // ----------------------------------------------------------------------
        console.log("\nSTEP 11: Testing Customer Public API (GET /api/products/:id/variants)...");
        const resPublicVars = await fetch(`${baseUrl}/api/products/${createdProductId}/variants`);
        const publicVarsData = await resPublicVars.json();
        console.log(`Public Variants for Product #${createdProductId} (count: ${publicVarsData.count}):`);
        console.table(publicVarsData.variants);
        if (publicVarsData.variants.length !== 6) {
            throw new Error(`Expected 6 public variants, got ${publicVarsData.variants.length}`);
        }
        console.log("[VERIFIED] Public API returns all 6 variants with individual sizes, colors, and stock.");

        // ----------------------------------------------------------------------
        // STEP 12: Clean Up Temporary Verification Records Safely
        // ----------------------------------------------------------------------
        console.log("\nSTEP 12: Cleaning up temporary verification records safely...");
        for (const vid of createdVariantIds) {
            await db.query("DELETE FROM PRODUCT_VARIANT WHERE variant_id = ?", [vid]);
        }
        console.log(`Cleaned ${createdVariantIds.length} temporary variants from PRODUCT_VARIANT`);

        if (createdProductId) {
            await db.query("DELETE FROM PRODUCT WHERE product_id = ?", [createdProductId]);
            console.log(`Cleaned temporary product #${createdProductId}`);
        }

        if (createdBrandId) {
            await db.query("DELETE FROM BRAND WHERE brand_id = ?", [createdBrandId]);
            console.log(`Cleaned temporary brand #${createdBrandId}`);
        }

        console.log("\n================================================================================");
        console.log("ALL PRODUCT VARIANT PERSISTENCE & MANAGEMENT VERIFICATIONS PASSED 100%");
        console.log("================================================================================\n");
    } catch (err) {
        console.error("\n[VERIFICATION ERROR]:", err);
        process.exitCode = 1;
    } finally {
        server.close();
        process.exit(process.exitCode || 0);
    }
}

runVariantPersistenceVerification();
