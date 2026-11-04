require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const wardrobeRoutes = require("./routes/wardrobeRoutes");
const interactionRoutes = require("./routes/interactionRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const orderRoutes = require("./routes/orderRoutes");
const outfitRoutes = require("./routes/outfitRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

const isProduction = process.env.NODE_ENV === "production";

let corsOptions;
if (isProduction) {
    if (!process.env.CORS_ORIGIN || !process.env.CORS_ORIGIN.trim()) {
        throw new Error("CRITICAL SECURITY CONFIGURATION ERROR: CORS_ORIGIN must be explicitly configured in production.");
    }
    const allowedOrigins = process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
    corsOptions = {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS policy violation: Origin '${origin}' is not permitted.`));
            }
        },
        credentials: true,
    };
} else {
    // Development mode: allow localhost and explicitly configured origins
    const devOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
        : ["http://localhost:3000", "http://127.0.0.1:3000"];
    corsOptions = {
        origin: devOrigins,
        credentials: true,
    };
}

app.use(cors(corsOptions));
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wardrobes", wardrobeRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/outfits", outfitRoutes);
app.use("/api/admin", adminRoutes);

// Basic health check
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to FashionIQ API",
        status: "Server is running"
    });
});

// Test MySQL connection
app.get("/api/db-test", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT DATABASE() AS database_name"
        );

        res.json({
            message: "MySQL connection successful!",
            database: rows[0].database_name
        });
    } catch (error) {
        console.error("Database connection error:", error.message);

        res.status(500).json({
            message: "MySQL connection failed",
            error: "Check backend database configuration"
        });
    }
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`FashionIQ API running on port ${PORT}`);
    });
}

module.exports = app;
