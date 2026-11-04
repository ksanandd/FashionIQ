const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { sendPasswordResetEmail } = require("./emailService");
const { invalidateUserSessions } = require("../middleware/authMiddleware");

// Token validity window: 15 minutes
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Initiates the password reset workflow for the given email address.
 * Generates a high-entropy 256-bit token, stores only its SHA-256 hash in MySQL,
 * and dispatches an email via the emailService.
 *
 * Always returns a generic, identical response structure to prevent email enumeration.
 *
 * @param {string} email
 * @param {Object} metadata
 * @param {string} [metadata.ipAddress]
 * @param {string} [metadata.userAgent]
 * @returns {Promise<{ userFound: boolean, rawToken?: string, resetUrl?: string }>}
 */
const requestPasswordReset = async (email, { ipAddress, userAgent } = {}) => {
    if (!email || typeof email !== "string") {
        return { userFound: false };
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user by email
    const [users] = await db.execute(
        "SELECT user_id, first_name, last_name, email, role FROM `USER` WHERE email = ?",
        [normalizedEmail]
    );

    if (users.length === 0) {
        // Run dummy cryptographic operation to prevent timing analysis
        crypto.randomBytes(32);
        return { userFound: false };
    }

    const user = users[0];

    // Generate cryptographically secure random token (256 bits = 64 hex characters)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    // Invalidate any existing unused reset tokens for this user
    await db.execute(
        "UPDATE password_reset_token SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
        [user.user_id]
    );

    // Store the SHA-256 hash in MySQL (never store raw token in the database)
    await db.execute(
        `INSERT INTO password_reset_token
         (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [
            user.user_id,
            tokenHash,
            expiresAt,
            ipAddress ? String(ipAddress).substring(0, 45) : null,
            userAgent ? String(userAgent).substring(0, 255) : null,
        ]
    );

    const frontendBaseUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
    const resetUrl = `${frontendBaseUrl}/reset-password?token=${rawToken}`;

    // Dispatch email
    await sendPasswordResetEmail({
        toEmail: user.email,
        userName: `${user.first_name} ${user.last_name}`.trim(),
        resetToken: rawToken,
        resetUrl,
    });

    return {
        userFound: true,
        rawToken,
        resetUrl,
        userId: user.user_id,
        role: user.role,
    };
};

/**
 * Validates a reset token and returns status.
 * Rejects invalid, expired, and already-used tokens.
 *
 * @param {string} rawToken
 * @returns {Promise<{ valid: boolean, reason?: string, message: string, userId?: number, resetId?: number, role?: string }>}
 */
const verifyResetToken = async (rawToken) => {
    if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
        return {
            valid: false,
            reason: "invalid",
            message: "A valid password reset token is required.",
        };
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

    const [rows] = await db.execute(
        `SELECT prt.reset_id, prt.user_id, prt.expires_at, prt.used_at,
                u.email, u.first_name, u.role
         FROM password_reset_token prt
         JOIN \`USER\` u ON prt.user_id = u.user_id
         WHERE prt.token_hash = ?
         ORDER BY prt.reset_id DESC
         LIMIT 1`,
        [tokenHash]
    );

    if (rows.length === 0) {
        return {
            valid: false,
            reason: "invalid",
            message: "Invalid or unrecognized password reset token.",
        };
    }

    const record = rows[0];

    // Check if token was already used (prevent reuse)
    if (record.used_at !== null) {
        return {
            valid: false,
            reason: "used",
            message: "This password reset link has already been used. Please request a new one.",
        };
    }

    // Check if token has expired
    const expiresAtMs = new Date(record.expires_at).getTime();
    if (Date.now() > expiresAtMs) {
        return {
            valid: false,
            reason: "expired",
            message: "This password reset link has expired. Reset links are valid for 15 minutes. Please request a new one.",
        };
    }

    return {
        valid: true,
        resetId: record.reset_id,
        userId: record.user_id,
        role: record.role,
        message: "Reset token is valid.",
    };
};

/**
 * Completes the password reset process.
 * Updates the user's password with bcrypt hash, marks the token as used,
 * and invalidates existing JWT sessions.
 *
 * @param {string} rawToken
 * @param {string} newPassword
 * @returns {Promise<{ success: boolean, status: number, message: string, role?: string }>}
 */
const resetPassword = async (rawToken, newPassword) => {
    const tokenCheck = await verifyResetToken(rawToken);
    if (!tokenCheck.valid) {
        return {
            success: false,
            status: 400,
            message: tokenCheck.message,
            reason: tokenCheck.reason,
        };
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return {
            success: false,
            status: 400,
            message: "Password must contain at least 8 characters.",
        };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Mark this token as redeemed (prevent reuse)
        await connection.execute(
            "UPDATE password_reset_token SET used_at = NOW() WHERE reset_id = ?",
            [tokenCheck.resetId]
        );

        // 2. Invalidate all other pending tokens for this user
        await connection.execute(
            "UPDATE password_reset_token SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
            [tokenCheck.userId]
        );

        // 3. Update the user password - role column is strictly left untouched
        await connection.execute(
            "UPDATE `USER` SET password = ? WHERE user_id = ?",
            [hashedPassword, tokenCheck.userId]
        );

        await connection.commit();

        // 4. Invalidate existing sessions/JWT tokens issued prior to this instant
        invalidateUserSessions(tokenCheck.userId);

        return {
            success: true,
            status: 200,
            message: "Your password has been successfully reset. You can now sign in with your new password.",
            userId: tokenCheck.userId,
            role: tokenCheck.role,
        };
    } catch (err) {
        await connection.rollback();
        console.error("Password reset transaction error:", err);
        return {
            success: false,
            status: 500,
            message: "Failed to reset password due to a server error. Please try again.",
        };
    } finally {
        connection.release();
    }
};

module.exports = {
    TOKEN_EXPIRY_MS,
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
};
