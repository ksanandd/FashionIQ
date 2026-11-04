/**
 * FashionIQ Rate Limiting Middleware
 * In-memory sliding-window rate limiters for security-sensitive auth routes.
 */

class SlidingWindowLimiter {
    constructor({ windowMs, maxRequests, keyGenerator }) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.keyGenerator = keyGenerator;
        this.hits = new Map();

        // Periodically purge stale entries (every 5 minutes)
        setInterval(() => this.purgeStale(), 5 * 60 * 1000).unref();
    }

    purgeStale() {
        const now = Date.now();
        for (const [key, timestamps] of this.hits.entries()) {
            const valid = timestamps.filter((t) => now - t < this.windowMs);
            if (valid.length === 0) {
                this.hits.delete(key);
            } else {
                this.hits.set(key, valid);
            }
        }
    }

    clear() {
        this.hits.clear();
    }

    check(key) {
        const now = Date.now();
        const timestamps = this.hits.get(key) || [];
        const valid = timestamps.filter((t) => now - t < this.windowMs);

        if (valid.length >= this.maxRequests) {
            const oldestValid = valid[0];
            const retryAfterSec = Math.ceil((oldestValid + this.windowMs - now) / 1000);
            return { allowed: false, retryAfterSec };
        }

        valid.push(now);
        this.hits.set(key, valid);
        return { allowed: true, remaining: this.maxRequests - valid.length };
    }

    middleware(errorMessage = "Too many requests. Please try again later.") {
        return (req, res, next) => {
            const key = this.keyGenerator(req);
            if (!key) return next();

            const result = this.check(key);
            if (!result.allowed) {
                res.setHeader("Retry-After", result.retryAfterSec);
                return res.status(429).json({
                    success: false,
                    message: errorMessage,
                    retryAfter: result.retryAfterSec,
                });
            }
            next();
        };
    }
}

// 5 requests per 15 minutes per IP
const forgotPasswordIpLimiter = new SlidingWindowLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || "global_ip",
});

// 3 requests per 15 minutes per normalized email
const forgotPasswordEmailLimiter = new SlidingWindowLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 3,
    keyGenerator: (req) => {
        const email = req.body && req.body.email;
        return email ? String(email).trim().toLowerCase() : null;
    },
});

// 10 password reset submissions per 15 minutes per IP
const resetPasswordIpLimiter = new SlidingWindowLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    keyGenerator: (req) => req.ip || req.connection.remoteAddress || "global_ip",
});

module.exports = {
    forgotPasswordIpLimiter,
    forgotPasswordEmailLimiter,
    resetPasswordIpLimiter,
    SlidingWindowLimiter,
};
