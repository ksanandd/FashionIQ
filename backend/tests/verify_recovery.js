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

async function verifyRecovery() {
    console.log("======================================================================");
    console.log("FASHIONIQ: OFFLINE FALLBACK TO LIVE AI RECOVERY VERIFICATION");
    console.log("======================================================================\n");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
        // Step 1: Simulate FastAPI stopped by targeting unreachable port
        console.log("STEP 1: Probing Express while FastAPI is offline (simulated)...");
        process.env.AI_SERVICE_URL = "http://localhost:9999";
        const resOff = await fetch(`${baseUrl}/api/recommendations/similar/1`);
        const dataOff = await resOff.json();
        console.log(`  HTTP Status: ${resOff.status}`);
        console.log(`  Source: '${dataOff.source}' (Clean SQL Fallback active)`);
        console.log(`  Item count: ${dataOff.count}`);
        if (dataOff.source !== "fallback") {
            throw new Error(`Expected 'fallback', got '${dataOff.source}'`);
        }

        // Step 2: Probe Express now that FastAPI is started on 8000
        console.log("\nSTEP 2: Probing Express with FastAPI microservice online on port 8000...");
        process.env.AI_SERVICE_URL = "http://localhost:8000";

        // Test similar products
        const resSim = await fetch(`${baseUrl}/api/recommendations/similar/1?limit=4`);
        const dataSim = await resSim.json();
        console.log(`  Similar Products -> HTTP ${resSim.status} | Source: '${dataSim.source}' | Count: ${dataSim.count}`);
        if (dataSim.source !== "ai") {
            throw new Error(`Expected 'ai', got '${dataSim.source}'`);
        }
        for (const item of dataSim.recommendations) {
            console.log(`    -> [AI MATCH] Product #${item.product_id} (${item.product_name}) - Match: ${Math.round(item.similarity_score * 100)}%`);
        }

        // Test personalized recommendations
        const resUser = await fetch(`${baseUrl}/api/recommendations/user`, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        const dataUser = await resUser.json();
        console.log(`\n  User Personalized -> HTTP ${resUser.status} | Source: '${dataUser.source}' | Count: ${dataUser.count}`);
        if (dataUser.source !== "ai") {
            throw new Error(`Expected 'ai', got '${dataUser.source}'`);
        }
        for (const item of dataUser.recommendations) {
            console.log(`    -> [AI PERSONALIZED] Product #${item.product_id} (${item.product_name}) - Score: ${item.recommendation_score} | Reason: ${item.reason}`);
        }

        // Test wardrobe recommendations
        const resWardrobe = await fetch(`${baseUrl}/api/recommendations/wardrobe`, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        const dataWardrobe = await resWardrobe.json();
        console.log(`\n  Wardrobe Complements -> HTTP ${resWardrobe.status} | Source: '${dataWardrobe.source}' | Count: ${dataWardrobe.count}`);
        if (dataWardrobe.source !== "ai") {
            throw new Error(`Expected 'ai', got '${dataWardrobe.source}'`);
        }
        for (const item of dataWardrobe.recommendations) {
            console.log(`    -> [AI WARDROBE] Product #${item.product_id} (${item.product_name}) - Reason: ${item.reason}`);
        }

        console.log("\n[SUCCESS] AI recommendations recovered seamlessly upon service startup!");
        console.log("======================================================================\n");
        server.close();
        process.exit(0);
    } catch (err) {
        console.error("Recovery verification error:", err);
        server.close();
        process.exit(1);
    }
}

verifyRecovery();
