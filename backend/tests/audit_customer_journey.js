require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";

const userToken = jwt.sign(
    { user_id: 1, email: "anand.demo@example.com", role: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

async function runCustomerJourneyAudit() {
    console.log("================================================================================");
    console.log("FashionIQ Phase 7: Customer Journey End-to-End Simulation Audit");
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

    try {
        // Step 1 & 2: Open Outfit Studio & Generate Personalized Outfits
        console.log("\n[Step 1 & 2] Customer opens Outfit Studio and requests personalized looks:");
        const resPersonalized = await fetch(`${baseUrl}/api/outfits/recommendations?limit=4`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataPersonalized = await resPersonalized.json();
        assert(resPersonalized.status === 200, "Successfully fetched personalized outfits (HTTP 200)");
        assert(dataPersonalized.outfits.length > 0, `Engine returned ${dataPersonalized.outfits.length} complete outfits`);

        const samplePersonalized = dataPersonalized.outfits[0];
        console.log(`  Sample Outfit: "${samplePersonalized.outfit_name}"`);
        console.log(`  Occasion: ${samplePersonalized.occasion} | Season: ${samplePersonalized.season} | Price: ₹${samplePersonalized.purchase_price}`);
        console.log(`  Items: ${samplePersonalized.items.map((i) => `${i.role} (${i.product_name}, ${i.color})`).join(" + ")}`);

        // Step 3: Switch to "Style From My Wardrobe"
        console.log("\n[Step 3] Customer switches to 'Style From My Wardrobe' tab:");
        const resWardrobe = await fetch(`${baseUrl}/api/outfits/from-wardrobe?limit=4`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataWardrobe = await resWardrobe.json();
        assert(resWardrobe.status === 200, "Successfully fetched wardrobe-anchored looks (HTTP 200)");
        assert(dataWardrobe.outfits.length > 0, `Engine returned ${dataWardrobe.outfits.length} wardrobe-anchored outfits`);

        const sampleWardrobe = dataWardrobe.outfits[0];
        console.log(`  Sample Wardrobe Look: "${sampleWardrobe.outfit_name}"`);
        console.log(`  Owned pieces: ${sampleWardrobe.items.filter((i) => i.is_owned).map((i) => i.product_name).join(", ")}`);
        console.log(`  Suggested to buy: ${sampleWardrobe.items.filter((i) => !i.is_owned).map((i) => i.product_name).join(", ") || "None (All Owned)"}`);
        console.log(`  Total Value: ₹${sampleWardrobe.total_retail_price} | Wardrobe Savings: ₹${sampleWardrobe.owned_savings} | To Pay: ₹${sampleWardrobe.purchase_price}`);

        // Step 4: Apply Season, Occasion, and Budget Filters
        console.log("\n[Step 4] Customer applies filters: Occasion=Sports, Season=Summer, Budget=₹4,000:");
        const resFiltered = await fetch(`${baseUrl}/api/outfits/recommendations?occasion=Sports&season=Summer&budget_max=4000&limit=3`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataFiltered = await resFiltered.json();
        assert(resFiltered.status === 200, "Successfully applied filters (HTTP 200)");
        assert(dataFiltered.outfits.length > 0, `Filtered query returned ${dataFiltered.outfits.length} outfits`);
        assert(
            dataFiltered.outfits.every((o) => o.purchase_price <= 4000),
            "Every filtered outfit strictly complies with budget <= ₹4,000"
        );

        // Step 5: Save an Outfit
        console.log("\n[Step 5] Customer clicks 'Save Look' on an outfit:");
        const outfitToSave = {
            outfit_name: "Customer Journey Test Look",
            occasion: "Sports",
            season: "Summer",
            total_price: 3499.0,
            description: "High-contrast athletic monochrome ensemble",
            items: [
                { variant_id: 1, role: "Top", price: 1500.0, is_owned: true },
                { variant_id: 3, role: "Bottom", price: 1999.0, is_owned: false },
            ],
        };
        const resSave = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userToken}`,
            },
            body: JSON.stringify(outfitToSave),
        });
        const dataSave = await resSave.json();
        assert(resSave.status === 201, "Outfit saved successfully (HTTP 201 Created)");
        assert(dataSave.outfit_id > 0, `Saved outfit assigned ID #${dataSave.outfit_id}`);
        const savedId = dataSave.outfit_id;

        // Step 6: Retrieve Saved Outfits
        console.log("\n[Step 6] Customer navigates to 'Saved Outfits' tab:");
        const resSaved = await fetch(`${baseUrl}/api/outfits/saved`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataSaved = await resSaved.json();
        assert(resSaved.status === 200, "Retrieved user's saved outfits (HTTP 200)");
        const retrieved = dataSaved.outfits.find((o) => o.outfit_id === savedId);
        assert(retrieved !== undefined, `Saved outfit #${savedId} is present in user's collection`);
        assert(retrieved.items.length === 2, "Outfit items properly loaded with variant metadata");

        // Step 7: Delete Saved Outfit
        console.log("\n[Step 7] Customer clicks trash icon to delete saved look:");
        const resDelete = await fetch(`${baseUrl}/api/outfits/saved/${savedId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${userToken}` },
        });
        assert(resDelete.status === 200, "Outfit deleted successfully (HTTP 200)");

        const resVerifyDeleted = await fetch(`${baseUrl}/api/outfits/saved`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataVerifyDeleted = await resVerifyDeleted.json();
        const stillExists = dataVerifyDeleted.outfits.some((o) => o.outfit_id === savedId);
        assert(stillExists === false, "Confirmed outfit no longer appears in saved list");

        // Step 8 & 9: Buy Needed Pieces Simulation
        console.log("\n[Step 8 & 9] Customer clicks 'Buy Needed Pieces' on a mixed outfit:");
        // Pick an outfit with both owned and unowned items
        const mixedOutfit = dataWardrobe.outfits.find((o) => o.items.some((i) => i.is_owned) && o.items.some((i) => !i.is_owned)) || {
            outfit_name: "Simulated Mixed Look",
            items: [
                { product_id: 1, variant_id: 1, product_name: "Nike T-shirt", price: 1500, is_owned: true },
                { product_id: 2, variant_id: 3, product_name: "Adidas Track Pants", price: 1999, is_owned: false },
            ],
            purchase_price: 1999,
        };

        const cartItemsToAdd = mixedOutfit.items.filter((it) => !it.is_owned);
        console.log(`  Items in outfit: ${mixedOutfit.items.length}`);
        console.log(`  Owned pieces (NOT added to cart): ${mixedOutfit.items.filter((i) => i.is_owned).map((i) => i.product_name).join(", ")}`);
        console.log(`  Unowned pieces added to cart: ${cartItemsToAdd.map((i) => `${i.product_name} (₹${i.price})`).join(", ")}`);

        assert(cartItemsToAdd.length > 0, "Only unowned pieces are selected for cart");
        assert(cartItemsToAdd.every((i) => i.is_owned === false), "Zero owned items selected for purchase");
        const cartTotal = cartItemsToAdd.reduce((sum, it) => sum + it.price, 0);
        assert(cartTotal === mixedOutfit.purchase_price, `Cart total ₹${cartTotal} matches outfit purchase_price ₹${mixedOutfit.purchase_price}`);

    } catch (err) {
        console.error("Customer journey audit failure:", err);
        failed++;
    } finally {
        server.close();
    }

    console.log("\n================================================================================");
    console.log(`Customer Journey Audit Summary: ${passed} Passed, ${failed} Failed`);
    console.log("================================================================================\n");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runCustomerJourneyAudit();
