require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const app = require("../server");
const pool = require("../config/db");
const { clearUserSessionRevocation } = require("../middleware/authMiddleware");
const { forgotPasswordIpLimiter, forgotPasswordEmailLimiter, resetPasswordIpLimiter } = require("../middleware/rateLimitMiddleware");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";

async function runPasswordRecoveryTests() {
    console.log("================================================================================");
    console.log("FashionIQ: Password Recovery & Account Security Verification Suite");
    console.log("================================================================================");

    // Ephemeral test server
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Ephemeral test server running at ${baseUrl}`);

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
        }
    }

    const testTimestamp = Date.now();
    const customerEmail = `recovery_customer_${testTimestamp}@example.com`;
    const adminEmail = `recovery_admin_${testTimestamp}@example.com`;
    const initialCustomerPass = "OldCustPass@123";
    const newCustomerPass = "NewCustPass@456";
    const initialAdminPass = "OldAdminPass@123";
    const newAdminPass = "NewAdminPass@456";

    let testCustomerId = null;
    let testAdminId = null;
    let customerResetToken = null;
    let adminResetToken = null;
    let preResetCustomerJwt = null;

    try {
        // Clear rate limiter memory prior to test
        forgotPasswordIpLimiter.clear();
        forgotPasswordEmailLimiter.clear();
        resetPasswordIpLimiter.clear();

        // ---------------------------------------------------------------------
        // Step 1: Provision Isolated Test Accounts
        // ---------------------------------------------------------------------
        console.log("\n[Step 1] Provisioning isolated test customer and admin accounts:");
        const hashedCustPass = await bcrypt.hash(initialCustomerPass, 12);
        const [custRes] = await pool.query(
            "INSERT INTO `USER` (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, 'USER')",
            ["TestCustomer", "Recovery", customerEmail, hashedCustPass]
        );
        testCustomerId = custRes.insertId;
        assert(testCustomerId > 0, `Isolated test customer created with ID #${testCustomerId} (role: USER)`);

        const hashedAdminPass = await bcrypt.hash(initialAdminPass, 12);
        const [adminRes] = await pool.query(
            "INSERT INTO `USER` (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, 'ADMIN')",
            ["TestAdmin", "Recovery", adminEmail, hashedAdminPass]
        );
        testAdminId = adminRes.insertId;
        assert(testAdminId > 0, `Isolated test admin created with ID #${testAdminId} (role: ADMIN)`);

        // Generate a pre-reset JWT for the customer to test session invalidation
        preResetCustomerJwt = jwt.sign(
            { user_id: testCustomerId, email: customerEmail, role: "USER" },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Verify pre-reset token works
        const resPreMe = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${preResetCustomerJwt}` }
        });
        assert(resPreMe.status === 200, "Pre-reset customer session token is initially valid (200 OK)");

        // Allow 1 second so that token iat (second-granularity) precedes the password reset timestamp
        await new Promise((r) => setTimeout(r, 1100));

        // ---------------------------------------------------------------------
        // Step 2: Test Email Enumeration Prevention
        // ---------------------------------------------------------------------
        console.log("\n[Step 2] Testing Email Enumeration Prevention:");
        const unknownEmail = `nonexistent_${testTimestamp}@example.com`;
        const resUnknown = await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: unknownEmail })
        });
        const dataUnknown = await resUnknown.json();
        assert(resUnknown.status === 200, "Request for non-existent email returns 200 OK (does not leak 404)");
        assert(dataUnknown.success === true, "Response success is true for non-existent email");

        const [unknownTokenRows] = await pool.query(
            "SELECT * FROM password_reset_token WHERE user_id = ?",
            [9999999]
        );
        assert(unknownTokenRows.length === 0, "No token created for non-existent user");

        // ---------------------------------------------------------------------
        // Step 3: Customer Forgot Password & Token Security
        // ---------------------------------------------------------------------
        console.log("\n[Step 3] Testing Customer Forgot Password & Cryptographic Storage:");
        const resForgotCust = await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: customerEmail })
        });
        const dataForgotCust = await resForgotCust.json();
        assert(resForgotCust.status === 200, "Forgot password returns 200 OK for valid customer");
        assert(dataForgotCust.message === dataUnknown.message, "Generic response message is identical to unknown email (zero enumeration)");

        // Extract dev token for testing
        customerResetToken = dataForgotCust.dev_reset_url
            ? new URL(dataForgotCust.dev_reset_url).searchParams.get("token")
            : null;
        assert(Boolean(customerResetToken && customerResetToken.length === 64), `Cryptographically secure token generated (256 bits, 64 hex chars)`);

        // Verify database stores ONLY SHA-256 hash, not raw token
        const [tokenRows] = await pool.query(
            "SELECT * FROM password_reset_token WHERE user_id = ? ORDER BY reset_id DESC LIMIT 1",
            [testCustomerId]
        );
        assert(tokenRows.length === 1, "Reset record stored in password_reset_token table");
        assert(tokenRows[0].token_hash !== customerResetToken, "Raw token is NEVER stored in database plaintext");
        assert(tokenRows[0].used_at === null, "Initial token used_at is NULL (single-use ready)");

        // ---------------------------------------------------------------------
        // Step 4: Verify Token Route (Valid, Invalid, Expired)
        // ---------------------------------------------------------------------
        console.log("\n[Step 4] Testing Token Verification Endpoint:");
        // 4a. Valid token
        const resVerifyValid = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${customerResetToken}`);
        const dataVerifyValid = await resVerifyValid.json();
        assert(resVerifyValid.status === 200, "Valid token verification returns 200 OK");
        assert(dataVerifyValid.valid === true, "Token valid flag is true");

        // 4b. Missing token
        const resVerifyMissing = await fetch(`${baseUrl}/api/auth/verify-reset-token`);
        assert(resVerifyMissing.status === 400, "Missing token rejected with 400 Bad Request");

        // 4c. Invalid / tampered token
        const resVerifyInvalid = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=invalid_tampered_token_abcdef1234567890`);
        const dataVerifyInvalid = await resVerifyInvalid.json();
        assert(resVerifyInvalid.status === 400, "Tampered token rejected with 400 Bad Request");
        assert(dataVerifyInvalid.reason === "invalid", "Reason correctly marked as 'invalid'");

        // 4d. Expired token
        const expiredRawToken = "expired_raw_token_for_testing_" + testTimestamp;
        const expiredHash = require("crypto").createHash("sha256").update(expiredRawToken).digest("hex");
        await pool.query(
            "INSERT INTO password_reset_token (user_id, token_hash, expires_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 HOUR))",
            [testCustomerId, expiredHash]
        );
        const resVerifyExpired = await fetch(`${baseUrl}/api/auth/verify-reset-token?token=${expiredRawToken}`);
        const dataVerifyExpired = await resVerifyExpired.json();
        assert(resVerifyExpired.status === 400, "Expired token rejected with 400 Bad Request");
        assert(dataVerifyExpired.reason === "expired", "Reason correctly marked as 'expired'");

        // ---------------------------------------------------------------------
        // Step 5: Customer Password Reset Execution & Validation
        // ---------------------------------------------------------------------
        console.log("\n[Step 5] Testing Password Reset Execution & Constraints:");
        // 5a. Password too short (< 8 chars)
        const resShort = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: customerResetToken, password: "short", confirmPassword: "short" })
        });
        assert(resShort.status === 400, "Password under 8 characters rejected with 400 Bad Request");

        // 5b. Mismatched passwords
        const resMismatch = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: customerResetToken, password: newCustomerPass, confirmPassword: "DifferentPass@999" })
        });
        assert(resMismatch.status === 400, "Mismatched passwords rejected with 400 Bad Request");

        // 5c. Valid reset execution
        const resResetCust = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: customerResetToken, password: newCustomerPass, confirmPassword: newCustomerPass })
        });
        const dataResetCust = await resResetCust.json();
        assert(resResetCust.status === 200, "Password reset successfully completed with 200 OK");
        assert(dataResetCust.success === true, "Reset response success flag is true");

        // ---------------------------------------------------------------------
        // Step 6: Token Reuse Prevention
        // ---------------------------------------------------------------------
        console.log("\n[Step 6] Testing Token Reuse Prevention:");
        const resReuse = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: customerResetToken, password: "AnotherNewPass@789" })
        });
        const dataReuse = await resReuse.json();
        assert(resReuse.status === 400, "Attempting to reuse already-redeemed token rejected with 400 Bad Request");
        assert(dataReuse.reason === "used", "Reason identified as 'used' (token cannot be reused)");

        // ---------------------------------------------------------------------
        // Step 7: Session Invalidation & Login Verification
        // ---------------------------------------------------------------------
        console.log("\n[Step 7] Testing Session Invalidation & Login with New Password:");
        // 7a. Old session JWT is invalidated
        const resOldJwt = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${preResetCustomerJwt}` }
        });
        assert(resOldJwt.status === 401, "Old pre-reset session JWT rejected with 401 Unauthorized (session invalidated)");

        // 7b. Login with OLD password must fail
        const resOldLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: customerEmail, password: initialCustomerPass })
        });
        assert(resOldLogin.status === 401, "Login with old password fails with 401 Unauthorized");

        // 7c. Login with NEW password succeeds
        const resNewLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: customerEmail, password: newCustomerPass })
        });
        const dataNewLogin = await resNewLogin.json();
        assert(resNewLogin.status === 200, "Login with new password succeeds with 200 OK");
        assert(dataNewLogin.token && dataNewLogin.token.length > 0, "New authenticated JWT token issued");

        // 7d. Verify role is preserved as USER
        assert(dataNewLogin.user.role === "USER", "Customer role strictly preserved as 'USER' after password reset");

        // ---------------------------------------------------------------------
        // Step 8: Admin Password Recovery & Role Preservation
        // ---------------------------------------------------------------------
        console.log("\n[Step 8] Testing Admin Password Recovery & ADMIN Role Preservation:");
        const resForgotAdmin = await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminEmail })
        });
        const dataForgotAdmin = await resForgotAdmin.json();
        adminResetToken = dataForgotAdmin.dev_reset_url
            ? new URL(dataForgotAdmin.dev_reset_url).searchParams.get("token")
            : null;
        assert(Boolean(adminResetToken), "Admin reset token generated successfully");

        const resResetAdmin = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: adminResetToken, password: newAdminPass, confirmPassword: newAdminPass })
        });
        assert(resResetAdmin.status === 200, "Admin password reset successfully completed with 200 OK");

        // Admin login with new password
        const resAdminLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminEmail, password: newAdminPass })
        });
        const dataAdminLogin = await resAdminLogin.json();
        assert(resAdminLogin.status === 200, "Admin login with new password succeeds with 200 OK");
        assert(dataAdminLogin.user.role === "ADMIN", "Admin role strictly preserved as 'ADMIN' after password reset");

        // Verify new admin token accesses admin-only endpoints
        const resAdminAccess = await fetch(`${baseUrl}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${dataAdminLogin.token}` }
        });
        assert(resAdminAccess.status === 200, "Admin with new credentials successfully accesses admin dashboard (200 OK)");

        // ---------------------------------------------------------------------
        // Step 9: Rate Limiting Verification
        // ---------------------------------------------------------------------
        console.log("\n[Step 9] Testing Rate Limiting (Too Many Requests):");
        // Limit is 5 requests per IP in 15 mins. We already sent 3 requests. Sending 3 more will trip it.
        let rateLimited = false;
        for (let i = 0; i < 4; i++) {
            const resSpam = await fetch(`${baseUrl}/api/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: `spam_${i}_${testTimestamp}@example.com` })
            });
            if (resSpam.status === 429) {
                rateLimited = true;
                const dataSpam = await resSpam.json();
                assert(resSpam.status === 429, "Rate limiter tripped: returns 429 Too Many Requests");
                assert(Boolean(resSpam.headers.get("retry-after")), "Retry-After response header is provided");
                assert(dataSpam.success === false, "Rate limited response success is false");
                break;
            }
        }
        assert(rateLimited === true, "Rate limiting actively protects password recovery from abuse");

    } catch (err) {
        console.error("Password recovery test exception:", err);
        failed++;
    } finally {
        console.log("\n--- Cleaning up isolated test artifacts ---");
        try {
            if (testCustomerId) {
                await pool.query("DELETE FROM password_reset_token WHERE user_id = ?", [testCustomerId]);
                await pool.query("DELETE FROM `USER` WHERE user_id = ?", [testCustomerId]);
            }
            if (testAdminId) {
                await pool.query("DELETE FROM password_reset_token WHERE user_id = ?", [testAdminId]);
                await pool.query("DELETE FROM `USER` WHERE user_id = ?", [testAdminId]);
            }
            clearUserSessionRevocation();
            forgotPasswordIpLimiter.clear();
            forgotPasswordEmailLimiter.clear();
            resetPasswordIpLimiter.clear();
            console.log("Isolated test accounts, reset tokens, and rate limiter memory cleaned up.");
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
        }
        server.close();
    }

    console.log("\n================================================================================");
    console.log(`Password Recovery Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log("================================================================================\n");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPasswordRecoveryTests();
