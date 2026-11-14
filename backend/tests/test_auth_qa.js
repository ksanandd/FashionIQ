/**
 * FashionIQ Backend QA Suite: Authentication, Token Security & RBAC Guards
 * File: backend/tests/test_auth_qa.js
 *
 * Verifies:
 * - User registration field validation and duplicate email conflict (400, 409, 201)
 * - User login validation, credential verification, and error masking (400, 401, 200)
 * - JWT token security: missing header, malformed prefix, tampered token, wrong signature, expiration (401)
 * - Session revocation tracking and active session invalidation (401, 200)
 * - Role-Based Access Control (RBAC): USER vs ADMIN route guards (401, 403, 200)
 * - Password recovery input validation and token verification (400)
 * - Production configuration security check for JWT secret enforcement
 */

const bcrypt = require("bcryptjs");
const app = require("../server");
const authMiddleware = require("../middleware/authMiddleware");
const {
    JWT_SECRET,
    createTestServer,
    createToken,
    createAssertionCollector,
    mockDb,
} = require("./test_helpers");

async function runAuthQaTests() {
    console.log("================================================================================");
    console.log("FashionIQ QA Test Suite 1: Authentication, Token Security & RBAC");
    console.log("================================================================================\n");

    const { baseUrl, close } = await createTestServer(app);
    const { assert, summarize } = createAssertionCollector("Authentication & RBAC QA Suite");

    mockDb.install();

    try {
        // =====================================================================
        // Section 1: User Registration Validation & Duplicate Prevention
        // =====================================================================
        console.log("--- 1. User Registration Validation & Conflict Handling ---");

        // 1.1 Missing first_name
        const resRegNoFirst = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ last_name: "Doe", email: "reg1@example.com", password: "Password123!" }),
        });
        assert(resRegNoFirst.status === 400, "Registration without first_name rejected with 400 Bad Request");
        const dataRegNoFirst = await resRegNoFirst.json();
        assert(dataRegNoFirst.success === false, "Registration response success is false for missing first_name");

        // 1.2 Missing last_name
        const resRegNoLast = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name: "Jane", email: "reg2@example.com", password: "Password123!" }),
        });
        assert(resRegNoLast.status === 400, "Registration without last_name rejected with 400 Bad Request");

        // 1.3 Missing email
        const resRegNoEmail = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name: "Jane", last_name: "Doe", password: "Password123!" }),
        });
        assert(resRegNoEmail.status === 400, "Registration without email rejected with 400 Bad Request");

        // 1.4 Missing password
        const resRegNoPass = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name: "Jane", last_name: "Doe", email: "reg4@example.com" }),
        });
        assert(resRegNoPass.status === 400, "Registration without password rejected with 400 Bad Request");

        // 1.5 Short password (< 8 characters)
        const resRegShortPass = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name: "Jane", last_name: "Doe", email: "reg5@example.com", password: "short" }),
        });
        assert(resRegShortPass.status === 400, "Registration with password < 8 characters rejected with 400 Bad Request");
        const dataShortPass = await resRegShortPass.json();
        assert(dataShortPass.message.includes("8 characters"), "Short password error message specifies 8-character requirement");

        // 1.6 Duplicate email conflict (409)
        mockDb.when(
            (sql) => sql.includes("SELECT user_id FROM USER WHERE email"),
            () => [[{ user_id: 99 }]]
        );
        const resRegDup = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name: "Jane", last_name: "Doe", email: "existing@example.com", password: "ValidPassword123!" }),
        });
        assert(resRegDup.status === 409, "Duplicate email registration rejected with 409 Conflict");
        const dataRegDup = await resRegDup.json();
        assert(dataRegDup.message.includes("already registered"), "Duplicate registration returns clear conflict message");

        // 1.7 Successful user registration (201)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT user_id FROM USER WHERE email"),
            () => [[]]
        );
        mockDb.when(
            (sql) => sql.includes("INSERT INTO USER"),
            () => [{ insertId: 101, affectedRows: 1 }]
        );
        const resRegSuccess = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name: "Alex", last_name: "Taylor", email: "alex.taylor@example.com", password: "StrongPassword123!" }),
        });
        assert(resRegSuccess.status === 201, "Valid user registration succeeds with 201 Created");
        const dataRegSuccess = await resRegSuccess.json();
        assert(dataRegSuccess.success === true, "Successful registration payload contains success: true");
        assert(dataRegSuccess.user.user_id === 101, "Returned user object has correct insertId");
        assert(dataRegSuccess.user.password === undefined, "Security: Password hash is not leaked in registration response");

        // =====================================================================
        // Section 2: User Login Validation & Credential Verification
        // =====================================================================
        console.log("\n--- 2. User Login Validation & Credential Verification ---");

        // 2.1 Missing email in login
        const resLoginNoEmail = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: "SecretPassword123" }),
        });
        assert(resLoginNoEmail.status === 400, "Login without email rejected with 400 Bad Request");

        // 2.2 Missing password in login
        const resLoginNoPass = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "user@example.com" }),
        });
        assert(resLoginNoPass.status === 400, "Login without password rejected with 400 Bad Request");

        // 2.3 Non-existent user email (401)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT user_id, first_name, last_name"),
            () => [[]]
        );
        const resLoginNonExistent = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "ghost@example.com", password: "Password123!" }),
        });
        assert(resLoginNonExistent.status === 401, "Login with non-existent email rejected with 401 Unauthorized");
        const dataNonExistent = await resLoginNonExistent.json();
        assert(dataNonExistent.message === "Invalid email or password", "Security: Generic error message prevents user enumeration");

        // 2.4 Incorrect password for existing user (401)
        const passwordHash = await bcrypt.hash("CorrectPassword123!", 10);
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT user_id, first_name, last_name"),
            () => [[{
                user_id: 5,
                first_name: "Sam",
                last_name: "Smith",
                email: "sam@example.com",
                password: passwordHash,
                role: "USER"
            }]]
        );
        const resLoginWrongPass = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "sam@example.com", password: "WrongPassword999!" }),
        });
        assert(resLoginWrongPass.status === 401, "Login with incorrect password rejected with 401 Unauthorized");

        // 2.5 Successful login (200)
        const resLoginSuccess = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "sam@example.com", password: "CorrectPassword123!" }),
        });
        assert(resLoginSuccess.status === 200, "Login with correct credentials returns 200 OK");
        const dataLoginSuccess = await resLoginSuccess.json();
        assert(typeof dataLoginSuccess.token === "string" && dataLoginSuccess.token.length > 20, "Login response returns valid JWT token string");
        assert(dataLoginSuccess.user.email === "sam@example.com", "Returned user matches logged-in account");
        assert(dataLoginSuccess.user.password === undefined, "Security: Password hash is not exposed in login response");

        // =====================================================================
        // Section 3: JWT Security & Token Verification (/api/auth/me)
        // =====================================================================
        console.log("\n--- 3. JWT Security & Token Verification ---");

        // 3.1 Missing Authorization header
        const resMeNoHeader = await fetch(`${baseUrl}/api/auth/me`);
        assert(resMeNoHeader.status === 401, "Protected /api/auth/me rejects request missing Authorization header with 401");

        // 3.2 Malformed Authorization header: non-Bearer scheme
        const resMeBasic = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: "Basic dXNlcjpwYXNz" },
        });
        assert(resMeBasic.status === 401, "Malformed Authorization header without Bearer scheme rejected with 401");

        // 3.3 Bearer prefix without token
        const resMeEmptyToken = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: "Bearer " },
        });
        assert(resMeEmptyToken.status === 401, "Authorization header with empty token rejected with 401");

        // 3.4 Tampered / garbage token string
        const resMeGarbage = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: "Bearer totally.invalid.token.signature" },
        });
        assert(resMeGarbage.status === 401, "Garbage JWT string rejected with 401 Invalid or expired token");

        // 3.5 Token signed with invalid / untrusted secret
        const forgedToken = createToken({ user_id: 1, role: "ADMIN" }, "UntrustedAttackerSecretKey12345678");
        const resMeForged = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${forgedToken}` },
        });
        assert(resMeForged.status === 401, "JWT signed with untrusted secret signature rejected with 401");

        // 3.6 Expired token (0-second validity)
        const expiredToken = createToken({ user_id: 1, role: "USER", expiresIn: "0s" });
        await new Promise((r) => setTimeout(r, 50));
        const resMeExpired = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${expiredToken}` },
        });
        assert(resMeExpired.status === 401, "Expired JWT token rejected with 401");

        // 3.7 Valid JWT token
        const validUserToken = createToken({ user_id: 10, email: "valid@example.com", role: "USER" });
        const resMeValid = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${validUserToken}` },
        });
        assert(resMeValid.status === 200, "Valid JWT token successfully authenticated at /api/auth/me with 200 OK");
        const dataMe = await resMeValid.json();
        assert(dataMe.user.user_id === 10, "Decoded user ID in req.user matches token claims");

        // =====================================================================
        // Section 4: Session Invalidation & Revocation
        // =====================================================================
        console.log("\n--- 4. Active Session Revocation Tracking ---");

        // 4.1 Create token issued in the past and invalidate session timestamp
        const jwt = require("jsonwebtoken");
        const revokedUserId = 77;
        const pastTimestamp = Math.floor(Date.now() / 1000) - 10;
        const preRevocationToken = jwt.sign(
            { user_id: revokedUserId, email: "revoked@example.com", role: "USER", iat: pastTimestamp },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Invalidate sessions for user 77 (current second > pastTimestamp)
        authMiddleware.invalidateUserSessions(revokedUserId);

        const resRevoked = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${preRevocationToken}` },
        });
        assert(resRevoked.status === 401, "Token issued prior to session revocation rejected with 401 Unauthorized");
        const dataRevoked = await resRevoked.json();
        assert(dataRevoked.message.includes("Session has been invalidated"), "Revoked session returns informative re-login message");

        // 4.2 Clear revocation for clean state
        authMiddleware.clearUserSessionRevocation(revokedUserId);
        const resAfterClear = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${preRevocationToken}` },
        });
        assert(resAfterClear.status === 200, "Token accepted once revocation record is cleared");

        // =====================================================================
        // Section 5: Role-Based Access Control (RBAC) Route Guards
        // =====================================================================
        console.log("\n--- 5. Role-Based Access Control (RBAC) Guards ---");

        const normalUserToken = createToken({ user_id: 1, email: "user@example.com", role: "USER" });
        const adminUserToken = createToken({ user_id: 9, email: "admin@example.com", role: "ADMIN" });

        // 5.1 /api/auth/user-dashboard - unauthenticated -> 401
        const resUserDashUnauth = await fetch(`${baseUrl}/api/auth/user-dashboard`);
        assert(resUserDashUnauth.status === 401, "Unauthenticated access to /api/auth/user-dashboard rejected with 401");

        // 5.2 /api/auth/user-dashboard - USER role -> 200
        const resUserDashUser = await fetch(`${baseUrl}/api/auth/user-dashboard`, {
            headers: { Authorization: `Bearer ${normalUserToken}` },
        });
        assert(resUserDashUser.status === 200, "USER role granted access to /api/auth/user-dashboard (200 OK)");

        // 5.3 /api/auth/admin-dashboard - unauthenticated -> 401
        const resAdminDashUnauth = await fetch(`${baseUrl}/api/auth/admin-dashboard`);
        assert(resAdminDashUnauth.status === 401, "Unauthenticated access to /api/auth/admin-dashboard rejected with 401");

        // 5.4 /api/auth/admin-dashboard - USER role -> 403 Forbidden
        const resAdminDashForbidden = await fetch(`${baseUrl}/api/auth/admin-dashboard`, {
            headers: { Authorization: `Bearer ${normalUserToken}` },
        });
        assert(resAdminDashForbidden.status === 403, "Normal USER role access to /api/auth/admin-dashboard rejected with 403 Forbidden");
        const dataForbidden = await resAdminDashForbidden.json();
        assert(dataForbidden.message.includes("Insufficient permissions"), "RBAC failure returns Insufficient permissions message");

        // 5.5 /api/auth/admin-dashboard - ADMIN role -> 200 OK
        const resAdminDashAdmin = await fetch(`${baseUrl}/api/auth/admin-dashboard`, {
            headers: { Authorization: `Bearer ${adminUserToken}` },
        });
        assert(resAdminDashAdmin.status === 200, "ADMIN role granted access to /api/auth/admin-dashboard (200 OK)");

        // =====================================================================
        // Section 6: Password Recovery Input Validation
        // =====================================================================
        console.log("\n--- 6. Password Recovery Request & Token Validation ---");

        // 6.1 Forgot password: empty email
        const resForgotEmpty = await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "" }),
        });
        assert(resForgotEmpty.status === 400, "Forgot password with empty email rejected with 400 Bad Request");

        // 6.2 Forgot password: non-string email
        const resForgotNonString = await fetch(`${baseUrl}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: 12345 }),
        });
        assert(resForgotNonString.status === 400, "Forgot password with non-string email rejected with 400 Bad Request");

        // 6.3 Verify reset token: missing token query parameter
        const resVerifyNoToken = await fetch(`${baseUrl}/api/auth/verify-reset-token`);
        assert(resVerifyNoToken.status === 400, "Verify reset token with missing query parameter rejected with 400 Bad Request");

        // 6.4 Reset password: missing token
        const resResetNoToken = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: "NewStrongPass123!" }),
        });
        assert(resResetNoToken.status === 400, "Reset password without token rejected with 400 Bad Request");

        // 6.5 Reset password: short password (< 8 chars)
        const resResetShortPass = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: "some_valid_token", password: "short" }),
        });
        assert(resResetShortPass.status === 400, "Reset password with < 8 character password rejected with 400 Bad Request");

        // 6.6 Reset password: password mismatch
        const resResetMismatch = await fetch(`${baseUrl}/api/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token: "some_valid_token",
                password: "NewStrongPassword123!",
                confirmPassword: "DifferentPassword123!"
            }),
        });
        assert(resResetMismatch.status === 400, "Reset password with mismatched confirmPassword rejected with 400 Bad Request");
        const dataMismatch = await resResetMismatch.json();
        assert(dataMismatch.message === "Passwords do not match.", "Reset password returns specific mismatch message");

        // =====================================================================
        // Section 7: Production Configuration Guard Verification
        // =====================================================================
        console.log("\n--- 7. Security Architecture: Production JWT Guard ---");

        // Verify that server requires 32-character secret in production
        const currentEnv = process.env.NODE_ENV;
        const currentSecret = process.env.JWT_SECRET;
        let productionGuardTriggered = false;

        try {
            process.env.NODE_ENV = "production";
            delete process.env.JWT_SECRET;
            // Clear require cache for server to test startup check
            delete require.cache[require.resolve("../server")];
            require("../server");
        } catch (guardErr) {
            productionGuardTriggered = guardErr.message.includes("CRITICAL SECURITY CONFIGURATION ERROR");
        } finally {
            // Restore test environment
            process.env.NODE_ENV = currentEnv;
            process.env.JWT_SECRET = currentSecret;
            delete require.cache[require.resolve("../server")];
        }
        assert(productionGuardTriggered === true, "Production mode safely halts startup if JWT_SECRET is unconfigured");

    } catch (err) {
        console.error("Test execution error in Auth QA Suite:", err);
        assert(false, `Unexpected exception: ${err.message}`);
    } finally {
        mockDb.restore();
        await close();
    }

    const { failed } = summarize();
    return failed === 0;
}

if (require.main === module) {
    runAuthQaTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = runAuthQaTests;
