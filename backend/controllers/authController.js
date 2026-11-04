const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
} = require("../services/passwordResetService");

// Register a new user
const registerUser = async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            password
        } = req.body;

        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be provided"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        const [existingUsers] = await db.execute(
            "SELECT user_id FROM USER WHERE email = ?",
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const [result] = await db.execute(
            `INSERT INTO USER
            (first_name, last_name, email, password)
            VALUES (?, ?, ?, ?)`,
            [first_name, last_name, email, hashedPassword]
        );

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                user_id: result.insertId,
                first_name,
                last_name,
                email,
                role: "USER"
            }
        });

    } catch (error) {
        console.error("Registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Login an existing user
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find user by email
        const [users] = await db.execute(
            `SELECT user_id, first_name, last_name,
                    email, password, role
             FROM USER
             WHERE email = ?`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                user_id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Request password reset link (Forgot Password)
// Employs generic response to eliminate email enumeration
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers["user-agent"];

        const result = await requestPasswordReset(email, { ipAddress, userAgent });

        // Generic response prevents attackers from identifying registered accounts
        const responsePayload = {
            success: true,
            message: "If an account with that email exists, we have sent instructions to reset your password.",
        };

        // Development-only testing helper when SMTP is not configured in local environment
        if (process.env.NODE_ENV !== "production" && result.userFound && result.resetUrl) {
            responsePayload.dev_reset_url = result.resetUrl;
        }

        return res.status(200).json(responsePayload);
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again later.",
        });
    }
};

// Verify if a reset token is valid before rendering reset form
const verifyResetTokenController = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                valid: false,
                message: "Password reset token is missing.",
            });
        }

        const result = await verifyResetToken(token);

        if (!result.valid) {
            return res.status(400).json({
                success: false,
                valid: false,
                reason: result.reason,
                message: result.message,
            });
        }

        return res.status(200).json({
            success: true,
            valid: true,
            message: "Reset token is valid.",
        });
    } catch (error) {
        console.error("Verify reset token error:", error);
        return res.status(500).json({
            success: false,
            valid: false,
            message: "Internal server error.",
        });
    }
};

// Reset password with verified token
const resetPasswordController = async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Password reset token is required.",
            });
        }

        if (!password || typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must contain at least 8 characters.",
            });
        }

        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match.",
            });
        }

        const result = await resetPassword(token, password);

        return res.status(result.status).json({
            success: result.success,
            message: result.message,
            reason: result.reason,
        });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error. Please try again later.",
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    forgotPassword,
    verifyResetTokenController,
    resetPasswordController,
};
