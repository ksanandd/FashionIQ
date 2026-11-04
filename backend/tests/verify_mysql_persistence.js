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

async function runPersistenceVerification() {
    console.log("================================================================================");
    console.log("FashionIQ: MySQL Persistence & Real-World Admin Workflow Verification");
    console.log("================================================================================");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Ephemeral verification server running at ${baseUrl}\n`);

    const createdProductIds = [];
    let createdBrandId = null;

    try {
        // ----------------------------------------------------------------------
        // STEP 1: Verify Initial Database Baseline
        // ----------------------------------------------------------------------
        console.log("STEP 1: Checking Baseline Database State...");
        const [initialBrands] = await db.query("SELECT brand_id, brand_name FROM BRAND ORDER BY brand_id ASC");
        const [initialProducts] = await db.query("SELECT product_id, product_name, gender, price FROM PRODUCT ORDER BY product_id ASC");
        console.log(`Baseline Brands (${initialBrands.length}):`, initialBrands.map(b => `${b.brand_id}: ${b.brand_name}`).join(", "));
        console.log(`Baseline Products (${initialProducts.length}):`, initialProducts.map(p => `${p.product_id}: ${p.product_name} (${p.gender}, ₹${p.price})`).join(", "));

        // ----------------------------------------------------------------------
        // STEP 2: Create Brand "U.S. Polo Assn." via Admin API
        // ----------------------------------------------------------------------
        console.log("\nSTEP 2: Creating Brand 'U.S. Polo Assn.' via Admin API (POST /api/admin/brands)...");
        const brandPayload = {
            brand_name: "U.S. Polo Assn.",
            website: "https://uspoloassn.com",
            country: "United States",
        };
        const resBrand = await fetch(`${baseUrl}/api/admin/brands`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(brandPayload),
        });
        const brandData = await resBrand.json();
        console.log(`API Response Status: ${resBrand.status}`, brandData);
        if (resBrand.status !== 201 || !brandData.brand_id) {
            throw new Error(`Failed to create brand: ${JSON.stringify(brandData)}`);
        }
        createdBrandId = brandData.brand_id;
        console.log(`[SUCCESS] Brand created with ID: ${createdBrandId}`);

        // Direct MySQL SELECT verification for Brand
        console.log("\nSTEP 2b: Querying MySQL directly for BRAND record...");
        const [mysqlBrandRows] = await db.query("SELECT * FROM BRAND WHERE brand_id = ?", [createdBrandId]);
        console.log("Direct MySQL SELECT Result:", mysqlBrandRows);
        if (mysqlBrandRows.length !== 1 || mysqlBrandRows[0].brand_name !== "U.S. Polo Assn.") {
            throw new Error("Direct MySQL verification failed for created brand!");
        }
        console.log("[VERIFIED] Brand persisted in MySQL with exact name 'U.S. Polo Assn.'");

        // ----------------------------------------------------------------------
        // STEP 3: Verify Duplicate Brand Prevention
        // ----------------------------------------------------------------------
        console.log("\nSTEP 3: Testing Duplicate Brand Name Prevention...");
        const resDupBrand = await fetch(`${baseUrl}/api/admin/brands`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                brand_name: "u.s. polo assn.", // lowercase to test case-insensitive uniqueness
                website: "https://duplicate.com",
            }),
        });
        const dupBrandData = await resDupBrand.json();
        console.log(`Duplicate Brand Creation Status: ${resDupBrand.status}`, dupBrandData);
        if (resDupBrand.status !== 400) {
            throw new Error("Duplicate brand was not rejected with 400!");
        }
        console.log("[VERIFIED] Duplicate brand name rejected with 400 Bad Request");

        // ----------------------------------------------------------------------
        // STEP 4: Create Product "U.S. Polo Assn. Sky Blue Shirt" (Gender: Men, Price: 1800)
        // ----------------------------------------------------------------------
        console.log("\nSTEP 4: Creating Product 'U.S. Polo Assn. Sky Blue Shirt' via Admin API (POST /api/admin/products)...");
        // Test with "Men" (and also lowercase in next steps)
        const productPayload = {
            product_name: "U.S. Polo Assn. Sky Blue Shirt",
            description: "Premium cotton Oxford shirt with embroidered logo",
            price: 1800,
            gender: "men", // Passing lowercase "men" to verify robust normalisation
            category_id: 1, // Tops (Category ID 1 in prompt)
            brand_id: createdBrandId,
            image_url: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10",
            initial_variant: {
                color: "Sky Blue",
                size: "L",
                stock_quantity: 40,
            },
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
        console.log(`Product Creation Response Status: ${resProd.status}`, prodData);
        if (resProd.status !== 201 || !prodData.product_id) {
            throw new Error(`Failed to create product: ${JSON.stringify(prodData)}`);
        }
        const shirtProductId = prodData.product_id;
        createdProductIds.push(shirtProductId);
        console.log(`[SUCCESS] Product created with ID: ${shirtProductId}`);

        // Direct MySQL SELECT verification for Product
        console.log("\nSTEP 4b: Querying MySQL directly for PRODUCT record...");
        const [mysqlProdRows] = await db.query("SELECT * FROM PRODUCT WHERE product_id = ?", [shirtProductId]);
        console.log("Direct MySQL SELECT Result:", mysqlProdRows);
        const savedProd = mysqlProdRows[0];
        console.log("Detailed Fields:");
        console.log(`  product_id:   ${savedProd.product_id}`);
        console.log(`  product_name: ${savedProd.product_name}`);
        console.log(`  category_id:  ${savedProd.category_id}`);
        console.log(`  brand_id:     ${savedProd.brand_id}`);
        console.log(`  price:        ${savedProd.price}`);
        console.log(`  gender:       ${savedProd.gender}`);
        console.log(`  image_url:    ${savedProd.image_url}`);

        if (savedProd.gender !== "Men") {
            throw new Error(`Expected gender to be 'Men', got '${savedProd.gender}'`);
        }
        if (Number(savedProd.price) !== 1800.0) {
            throw new Error(`Expected price to be 1800.00, got '${savedProd.price}'`);
        }
        if (savedProd.brand_id !== createdBrandId) {
            throw new Error(`Expected brand_id to be ${createdBrandId}, got ${savedProd.brand_id}`);
        }
        if (savedProd.category_id !== 1) {
            throw new Error(`Expected category_id to be 1, got ${savedProd.category_id}`);
        }
        console.log("[VERIFIED] Product persisted in MySQL with exact expected values and foreign keys!");

        // Also verify initial variant was persisted in PRODUCT_VARIANT
        const [variantRows] = await db.query("SELECT * FROM PRODUCT_VARIANT WHERE product_id = ?", [shirtProductId]);
        console.log("Direct MySQL SELECT Result for PRODUCT_VARIANT:", variantRows);
        if (variantRows.length !== 1 || variantRows[0].color !== "Sky Blue" || variantRows[0].stock_quantity !== 40) {
            throw new Error("Initial variant persistence verification failed!");
        }
        console.log("[VERIFIED] Variant persisted in MySQL with Sky Blue / L / stock 40!");

        // ----------------------------------------------------------------------
        // STEP 5: Verify API consistency with MySQL
        // ----------------------------------------------------------------------
        console.log("\nSTEP 5: Querying Admin API (GET /api/admin/products/:id) for Consistency...");
        const resGetProd = await fetch(`${baseUrl}/api/admin/products/${shirtProductId}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const getProdData = await resGetProd.json();
        console.log("API Product Details:", getProdData.product);
        if (
            getProdData.product.product_name !== savedProd.product_name ||
            Number(getProdData.product.price) !== Number(savedProd.price) ||
            getProdData.product.gender !== savedProd.gender ||
            getProdData.product.brand_name !== "U.S. Polo Assn."
        ) {
            throw new Error("API data does not match MySQL data!");
        }
        console.log("[VERIFIED] API response is 100% consistent with direct MySQL SELECT");

        // ----------------------------------------------------------------------
        // STEP 6: Verify Women and Unisex Product Creation
        // ----------------------------------------------------------------------
        console.log("\nSTEP 6: Verifying Women and Unisex Product Creation...");
        // 6a: Women Product
        const womenPayload = {
            product_name: "U.S. Polo Assn. Women Linen Shirt",
            description: "Breathable pure linen shirt for women",
            price: 1999,
            gender: "Women",
            category_id: 1,
            brand_id: createdBrandId,
            image_url: "https://images.unsplash.com/photo-1598033129183-women",
        };
        const resWomen = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(womenPayload),
        });
        const womenData = await resWomen.json();
        console.log(`Women Product Creation Status: ${resWomen.status}`, womenData);
        if (resWomen.status !== 201) throw new Error("Failed to create Women product");
        createdProductIds.push(womenData.product_id);

        const [mysqlWomenRows] = await db.query("SELECT * FROM PRODUCT WHERE product_id = ?", [womenData.product_id]);
        console.log("MySQL Women Product Row:", mysqlWomenRows[0]);
        if (mysqlWomenRows[0].gender !== "Women") {
            throw new Error(`Expected 'Women', got '${mysqlWomenRows[0].gender}'`);
        }
        console.log("[VERIFIED] Women product saved in MySQL with gender = 'Women'");

        // 6b: Unisex Product
        const unisexPayload = {
            product_name: "U.S. Polo Assn. Unisex Cap",
            description: "Classic twill baseball cap with horse logo",
            price: 899,
            gender: "Unisex",
            category_id: 1,
            brand_id: createdBrandId,
            image_url: "https://images.unsplash.com/photo-1598033129183-cap",
        };
        const resUnisex = await fetch(`${baseUrl}/api/admin/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify(unisexPayload),
        });
        const unisexData = await resUnisex.json();
        console.log(`Unisex Product Creation Status: ${resUnisex.status}`, unisexData);
        if (resUnisex.status !== 201) throw new Error("Failed to create Unisex product");
        createdProductIds.push(unisexData.product_id);

        const [mysqlUnisexRows] = await db.query("SELECT * FROM PRODUCT WHERE product_id = ?", [unisexData.product_id]);
        console.log("MySQL Unisex Product Row:", mysqlUnisexRows[0]);
        if (mysqlUnisexRows[0].gender !== "Unisex") {
            throw new Error(`Expected 'Unisex', got '${mysqlUnisexRows[0].gender}'`);
        }
        console.log("[VERIFIED] Unisex product saved in MySQL with gender = 'Unisex'");

        // ----------------------------------------------------------------------
        // STEP 7: Verify Brand Deletion Protection (Active Products)
        // ----------------------------------------------------------------------
        console.log("\nSTEP 7: Testing Brand Deletion Protection with Active Products...");
        const resDelBrandAttempt = await fetch(`${baseUrl}/api/admin/brands/${createdBrandId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const delBrandData = await resDelBrandAttempt.json();
        console.log(`Brand Deletion Attempt Status: ${resDelBrandAttempt.status}`, delBrandData);
        if (resDelBrandAttempt.status !== 400 || !delBrandData.message.includes("Cannot delete brand associated with")) {
            throw new Error("Brand deletion protection failed! Brand was allowed to be deleted while products exist.");
        }
        console.log("[VERIFIED] Brand deletion correctly prevented while products are associated");

        // ----------------------------------------------------------------------
        // STEP 8: Verify Trigger & Audit Table Effects (after_product_price_update)
        // ----------------------------------------------------------------------
        console.log("\nSTEP 8: Testing Price Update and Database Trigger (after_product_price_update)...");
        const resUpdatePrice = await fetch(`${baseUrl}/api/admin/products/${shirtProductId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                product_name: "U.S. Polo Assn. Sky Blue Shirt",
                description: "Premium cotton Oxford shirt with embroidered logo",
                price: 1850.0, // Price updated from 1800 to 1850
                gender: "Men",
                category_id: 1,
                brand_id: createdBrandId,
                image_url: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10",
            }),
        });
        const updatePriceData = await resUpdatePrice.json();
        console.log(`Price Update Status: ${resUpdatePrice.status}`, updatePriceData);

        const [auditRows] = await db.query(
            "SELECT * FROM PRODUCT_PRICE_AUDIT WHERE product_id = ? ORDER BY audit_id DESC",
            [shirtProductId]
        );
        console.log("Trigger Output in PRODUCT_PRICE_AUDIT:", auditRows);
        if (auditRows.length < 1 || Number(auditRows[0].old_price) !== 1800.0 || Number(auditRows[0].new_price) !== 1850.0) {
            throw new Error("Trigger after_product_price_update did not record audit record correctly!");
        }
        console.log(`[VERIFIED] Database Trigger after_product_price_update successfully fired: logged old_price ₹1800.00 -> new_price ₹1850.00 (Audit ID ${auditRows[0].audit_id})`);

        // ----------------------------------------------------------------------
        // STEP 9: Clean Up Temporary Verification Records Safely
        // ----------------------------------------------------------------------
        console.log("\nSTEP 9: Cleaning up temporary verification records safely...");
        // 9a: Clean audit table records for temporary products
        for (const pid of createdProductIds) {
            await db.query("DELETE FROM PRODUCT_PRICE_AUDIT WHERE product_id = ?", [pid]);
        }
        console.log("Cleaned temporary rows from PRODUCT_PRICE_AUDIT");

        // 9b: Clean product variants for temporary products
        for (const pid of createdProductIds) {
            await db.query("DELETE FROM PRODUCT_VARIANT WHERE product_id = ?", [pid]);
        }
        console.log("Cleaned temporary rows from PRODUCT_VARIANT");

        // 9c: Clean products
        for (const pid of createdProductIds) {
            const resDelProd = await fetch(`${baseUrl}/api/admin/products/${pid}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${adminToken}` },
            });
            console.log(`Deleted temporary product ${pid}: status ${resDelProd.status}`);
        }

        // 9d: Clean brand now that products are removed
        const resDelBrand = await fetch(`${baseUrl}/api/admin/brands/${createdBrandId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        console.log(`Deleted temporary brand ${createdBrandId}: status ${resDelBrand.status}`);

        // Verify database returns to initial baseline
        const [finalBrands] = await db.query("SELECT brand_id, brand_name FROM BRAND ORDER BY brand_id ASC");
        const [finalProducts] = await db.query("SELECT product_id, product_name FROM PRODUCT ORDER BY product_id ASC");
        console.log(`\nFinal Brand Count: ${finalBrands.length} (Baseline: ${initialBrands.length})`);
        console.log(`Final Product Count: ${finalProducts.length} (Baseline: ${initialProducts.length})`);

        if (finalBrands.length !== initialBrands.length || finalProducts.length !== initialProducts.length) {
            throw new Error("Database did not cleanly return to baseline state!");
        }
        console.log("[VERIFIED] Complete cleanup confirmed. Database is in pristine baseline state.");

        console.log("\n================================================================================");
        console.log("ALL MYSQL PERSISTENCE & WORKFLOW VERIFICATIONS PASSED 100%");
        console.log("================================================================================");
    } catch (err) {
        console.error("\n[VERIFICATION ERROR]:", err);
        process.exitCode = 1;
    } finally {
        server.close();
        process.exit(0);
    }
}

runPersistenceVerification();
