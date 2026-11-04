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

async function verifyLive() {
    console.log("=== Testing Express Gateway with Live AI Microservice ===");
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    let success = true;

    try {
        // 1. Similar Products via AI
        console.log("1. Probing /api/recommendations/similar/1 via Express -> FastAPI...");
        const resSimilar = await fetch(`${baseUrl}/api/recommendations/similar/1`);
        const dataSimilar = await resSimilar.json();
        console.log(`   Source: ${dataSimilar.source}, Count: ${dataSimilar.count}`);
        if (dataSimilar.source !== "ai") {
            console.warn(`   Expected source 'ai', got '${dataSimilar.source}'`);
            success = false;
        }

        // 2. Personalized User via AI
        console.log("2. Probing /api/recommendations/user via Express -> FastAPI...");
        const resUser = await fetch(`${baseUrl}/api/recommendations/user`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataUser = await resUser.json();
        console.log(`   Source: ${dataUser.source}, Count: ${dataUser.count}`);
        if (dataUser.source !== "ai") {
            console.warn(`   Expected source 'ai', got '${dataUser.source}'`);
            success = false;
        }

        // 3. Wardrobe Recommendations via AI
        console.log("3. Probing /api/recommendations/wardrobe via Express -> FastAPI...");
        const resWardrobe = await fetch(`${baseUrl}/api/recommendations/wardrobe`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataWardrobe = await resWardrobe.json();
        console.log(`   Source: ${dataWardrobe.source}, Count: ${dataWardrobe.count}`);
        if (dataWardrobe.source !== "ai") {
            console.warn(`   Expected source 'ai', got '${dataWardrobe.source}'`);
            success = false;
        }

    } catch (e) {
        console.error("Live verification error:", e);
        success = false;
    } finally {
        server.close();
    }

    if (success) {
        console.log("\nALL LIVE AI INTEGRATION CHECKS PASSED (source: 'ai')!");
        process.exit(0);
    } else {
        console.error("\nLIVE AI INTEGRATION VERIFICATION FAILED!");
        process.exit(1);
    }
}

verifyLive();
