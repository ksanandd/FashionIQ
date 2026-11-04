const jwt = require("jsonwebtoken");

/**
 * In-memory map of user_id -> timestamp (in whole seconds) when their sessions were invalidated.
 * Matches JWT 'iat' (issued-at) second-level granularity to immediately revoke active JWTs upon password reset.
 */
const userRevocationTimestamps = new Map();

/**
 * Invalidates all active JWT tokens issued before this second for a user.
 * @param {number|string} userId
 */
const invalidateUserSessions = (userId) => {
    userRevocationTimestamps.set(Number(userId), Math.floor(Date.now() / 1000));
};

/**
 * Clears revocation entry (primarily for testing purposes).
 * @param {number|string} userId
 */
const clearUserSessionRevocation = (userId) => {
    if (userId) {
        userRevocationTimestamps.delete(Number(userId));
    } else {
        userRevocationTimestamps.clear();
    }
};

const authMiddleware = (req, res, next) => {
    try {
        // Read Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token provided."
            });
        }

        // Extract token
        const token = authHeader.split(" ")[1];

        // Verify JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Check if token was issued prior to a password reset
        const userId = Number(decoded.user_id);
        const invalidatedAtSec = userRevocationTimestamps.get(userId);
        if (invalidatedAtSec !== undefined && decoded.iat !== undefined) {
            if (decoded.iat < invalidatedAtSec) {
                return res.status(401).json({
                    success: false,
                    message: "Session has been invalidated due to a password reset. Please sign in again."
                });
            }
        }

        // Attach authenticated user information
        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

/**
 * Optional authentication: If token is provided and valid, attaches req.user.
 * If no token or invalid, proceeds gracefully without throwing 401.
 */
const optionalAuthMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const userId = Number(decoded.user_id);
            const invalidatedAtSec = userRevocationTimestamps.get(userId);
            if (invalidatedAtSec === undefined || !decoded.iat || decoded.iat >= invalidatedAtSec) {
                req.user = decoded;
            }
        }
    } catch (error) {
        // In case of invalid/expired token, proceed as guest
    }
    next();
};

authMiddleware.optional = optionalAuthMiddleware;
authMiddleware.optionalAuthMiddleware = optionalAuthMiddleware;
authMiddleware.invalidateUserSessions = invalidateUserSessions;
authMiddleware.clearUserSessionRevocation = clearUserSessionRevocation;

module.exports = authMiddleware;
module.exports.optional = optionalAuthMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;
module.exports.invalidateUserSessions = invalidateUserSessions;
module.exports.clearUserSessionRevocation = clearUserSessionRevocation;
