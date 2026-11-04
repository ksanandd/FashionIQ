const express = require("express");
const router = express.Router();

const {
    registerUser,
    loginUser,
    forgotPassword,
    verifyResetTokenController,
    resetPasswordController,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
    forgotPasswordIpLimiter,
    forgotPasswordEmailLimiter,
    resetPasswordIpLimiter,
} = require("../middleware/rateLimitMiddleware");

// Authentication core
router.post("/register", registerUser);
router.post("/login", loginUser);

// Password recovery routes
router.post(
    "/forgot-password",
    forgotPasswordIpLimiter.middleware("Too many password reset requests from this IP. Please try again after 15 minutes."),
    forgotPasswordEmailLimiter.middleware("Too many password reset requests for this email address. Please try again after 15 minutes."),
    forgotPassword
);

router.get("/verify-reset-token", verifyResetTokenController);

router.post(
    "/reset-password",
    resetPasswordIpLimiter.middleware("Too many password reset attempts. Please try again after 15 minutes."),
    resetPasswordController
);

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
