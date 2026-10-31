
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const productRoutes = require("./routes/productRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/products", productRoutes);

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

app.listen(PORT, () => {
    console.log(`FashionIQ API running on port ${PORT}`);
});
