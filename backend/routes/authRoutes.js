
const express = require("express");
const router = express.Router();

const {
    registerUser,
    loginUser
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected route
router.get("/me", authMiddleware, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Authenticated user",
        user: req.user
    });
});

// User-only test route
router.get(
    "/user-dashboard",
    authMiddleware,
    roleMiddleware("USER"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Welcome to the User Dashboard"
        });
    }
);

// Admin-only test route
router.get(
    "/admin-dashboard",
    authMiddleware,
    roleMiddleware("ADMIN"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Welcome to the Admin Dashboard"
        });
    }
);

module.exports = router;
