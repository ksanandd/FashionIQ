# FashionIQ Backend Testing & Quality Assurance Report

**Project:** FashionIQ – AI-Powered Personalized Fashion Discovery Platform
**Author / Contributor:** Basawaraj Panchal (`PES1UG24AM350@stu.pes.edu`)
**Contribution Domain:** Independent Backend QA Engineering, API Validation, Security Testing & Quality Assurance
**Repository:** `https://github.com/ksanandd/FashionIQ`
**Feature Branch:** `feature/backend-testing-qa`
**Target Base Branch:** `main`
**Execution Date:** 14 November 2026

---

## 1. Project Overview

FashionIQ is a full-stack e-commerce and style curation platform designed to transform traditional catalog browsing into an AI-coordinated fashion experience. It unifies a Next.js 16 frontend, an Express 5 API gateway, a MySQL 8.0 relational database, and a Python FastAPI AI microservice powered by SentenceTransformers and ChromaDB vector search.

This independent contribution focuses exclusively on **Backend Testing, Automated Quality Assurance, API Input Validation, Security Enforcement, and Data Privacy Isolation** across the Express application tier.

---

## 2. Testing Objectives

1. **Defensive API Quality Assurance:** Validate that every Express endpoint enforces strict contract compliance, rejects malformed payloads with descriptive HTTP `400 Bad Request` messages, and never leaks internal exceptions or database stack traces.
2. **Authentication & Token Security:** Verify that stateless JWT authentication securely handles token verification, expiration, tampering, header malformations, and active session revocations.
3. **Role-Based Access Control (RBAC):** Confirm strict separation between `USER` and `ADMIN` privileges, preventing privilege escalation.
4. **Data Isolation & IDOR Prevention:** Test Insecure Direct Object Reference (IDOR) vulnerabilities across user profiles, private wardrobes, saved outfits, customer orders, and personalized style recommendations.
5. **Anti-Forgery & Business Rules:** Enforce anti-tampering guards, such as preventing users from manually injecting `source_type: 'PURCHASED'` into wardrobes without verified order settlement.
6. **Concurrency & Rate Limiting:** Verify in-flight request locks and rapid duplicate order debounce protection (`429 Too Many Requests`).
7. **Offline Microservice & DB Resilience:** Ensure that Express handles external microservice cold-starts or downtime deterministically without hanging or failing silently.

---

## 3. Backend Architecture Examined

* **Application Entrypoint:** `backend/server.js` exports the configured Express application instance (`app`), allowing ephemeral test servers to bind dynamically to port `0` without port collision.
* **Database Layer:** `backend/config/db.js` implements a pooled MySQL connection (`mysql2/promise`).
* **Authentication Middleware:** `backend/middleware/authMiddleware.js` provides mandatory (`authMiddleware`) and optional (`optionalAuthMiddleware`) token decoders and maintains an in-memory session revocation registry (`userRevocationTimestamps`).
* **RBAC Middleware:** `backend/middleware/roleMiddleware.js` verifies role hierarchies against `req.user.role`.
* **Rate Limiting Middleware:** `backend/middleware/rateLimitMiddleware.js` provides an in-memory sliding-window limiter (`SlidingWindowLimiter`) for security-sensitive auth routes.
* **Services Tier:** `backend/services/` encapsulates fallback recommendation algorithms (`recommendationService.js`), outfit composition logic (`outfitService.js`), password recovery flows (`passwordResetService.js`), and email transport (`emailService.js`).
* **Controllers & Routing:**
  - `authController.js` & `authRoutes.js` (`/api/auth`)
  - `userController.js` & `userRoutes.js` (`/api/users`)
  - `wardrobeController.js` & `wardrobeRoutes.js` (`/api/wardrobes`)
  - `outfitController.js` & `outfitRoutes.js` (`/api/outfits`)
  - `orderController.js` & `orderRoutes.js` (`/api/orders`)
  - `recommendationController.js` & `recommendationRoutes.js` (`/api/recommendations`)
  - `productController.js` & `productRoutes.js` (`/api/products`)
  - `categoryController.js` & `categoryRoutes.js` (`/api/categories`)
  - `brandController.js` & `brandRoutes.js` (`/api/brands`)
  - `interactionController.js` & `interactionRoutes.js` (`/api/interactions`)
  - `adminController.js` & `adminRoutes.js` (`/api/admin`)

---

## 4. Testing Framework & Architecture

The testing architecture follows the project's native Node.js convention:
* **Ephemeral Server Harness:** Each test suite spins up an isolated `http.createServer(app)` on an operating-system-assigned port (`0`), ensuring zero port collisions and fast startup/teardown.
* **Native Client:** Uses native Node.js `fetch` (Node 18+) for HTTP communication.
* **In-Memory Mock Database Stubbing:** Designed an offline `mockDb` harness in `backend/tests/test_helpers.js` that intercepts pooled calls (`db.execute`, `db.query`, `db.getConnection`) with normalized SQL predicate routing. This allows comprehensive testing of success, conflict, and edge-case behaviors without requiring production database connections or destructive operations.
* **Strict Assertion Collector:** Tracks passed, failed, and total assertions with informative output and POSIX exit codes (`0` for complete pass, `1` on failure).

---

## 5. Summary of Test Execution Results

All five specialized QA integration test suites were executed sequentially using the newly implemented test runner.

| Module | Test File | Test Scenarios | Passed | Failed | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Authentication, Tokens & RBAC** | `test_auth_qa.js` | 47 | 47 | 0 | **PASSED** |
| **Wardrobe Management & Isolation** | `test_wardrobe_qa.js` | 47 | 47 | 0 | **PASSED** |
| **Outfit Engine & Custom Looks** | `test_outfit_qa.js` | 31 | 31 | 0 | **PASSED** |
| **Order Processing & Privacy** | `test_order_qa.js` | 35 | 35 | 0 | **PASSED** |
| **Recommendations, Catalog & Profile**| `test_recommendations_catalog_qa.js` | 38 | 38 | 0 | **PASSED** |
| **Total** | | **198** | **198** | **0** | **100% SUCCESS** |

*Total Execution Time:* **0.70 seconds**

---

## 6. Detailed Test Scenarios Implemented

### 6.1 Authentication, Token Security & RBAC (`test_auth_qa.js` – 47 tests)
* **Registration Validation:**
  - Rejection of missing `first_name` (400 Bad Request).
  - Rejection of missing `last_name` (400 Bad Request).
  - Rejection of missing `email` (400 Bad Request).
  - Rejection of missing `password` (400 Bad Request).
  - Password minimum length enforcement (< 8 characters rejected with 400).
  - Duplicate email collision rejection (409 Conflict).
  - Successful registration returns 201 Created without exposing password hash.
* **Login & Credential Verification:**
  - Rejection of missing email / password (400 Bad Request).
  - Rejection of non-existent account with generic error message to prevent user enumeration (401 Unauthorized).
  - Rejection of incorrect password (401 Unauthorized).
  - Successful login returns valid 24-hour JWT token and user metadata (200 OK).
* **JWT Security & Guard Verification (`/api/auth/me`):**
  - Rejection of missing `Authorization` header (401 Unauthorized).
  - Rejection of non-Bearer authorization schemes (401 Unauthorized).
  - Rejection of Bearer prefix with empty token string (401 Unauthorized).
  - Rejection of tampered or malformed JWT strings (401 Unauthorized).
  - Rejection of tokens signed with untrusted secret keys (401 Unauthorized).
  - Rejection of expired tokens (401 Unauthorized).
  - Verification of valid token decoded claims (200 OK).
* **Active Session Invalidation:**
  - Verification that session revocation timestamp rejects active tokens issued prior to password reset (401 Unauthorized).
  - Verification that newly issued tokens after revocation succeed (200 OK).
* **Role-Based Access Control (RBAC):**
  - Route guards on `/api/auth/user-dashboard`: 401 for unauthenticated, 200 for `USER`.
  - Route guards on `/api/auth/admin-dashboard`: 401 for unauthenticated, 403 Forbidden for `USER`, 200 OK for `ADMIN`.
* **Password Recovery Input Validation:**
  - Rejection of empty or non-string emails on `/api/auth/forgot-password` (400).
  - Rejection of missing token on `/api/auth/verify-reset-token` (400).
  - Rejection of missing token, short password, or mismatched passwords on `/api/auth/reset-password` (400).
* **Production Secret Guard:**
  - Automated check verifying `server.js` refuses to boot in `production` if `JWT_SECRET` is missing, default, or under 32 characters.

### 6.2 Wardrobe Management & Data Isolation (`test_wardrobe_qa.js` – 47 tests)
* **Authentication Enforcement:** All 6 wardrobe routes reject unauthenticated requests with 401 Unauthorized.
* **Collection Creation Validation:**
  - Rejection of missing or whitespace-only collection name (400 Bad Request).
  - Collection name character length constraint (> 100 characters rejected with 400).
  - Duplicate collection name for same user returns 409 Conflict.
  - Successful wardrobe collection creation (201 Created).
* **Wardrobe Item Addition Validation:**
  - Rejection of missing or non-positive variant IDs (400 Bad Request).
  - Quantity bounds validation (<= 0 or > 50 units rejected with 400).
  - Season taxonomy validation (Summer, Winter, Monsoon, All Season) (400 Bad Request).
  - **Anti-Forgery Security Check:** Client attempting to manually set `source_type: "PURCHASED"` is rejected with `403 Forbidden` (strictly reserved for verified order synchronization).
  - Unsupported `source_type` rejected with 400 Bad Request.
  - Non-existent catalog variant rejected with 400 Bad Request.
  - Product-to-variant relationship mismatch rejected with 400 Bad Request.
  - Duplicate variant addition to same wardrobe collection rejected with 409 Conflict.
  - Valid manual item addition saved with default `SAVED` source type (201 Created).
* **Data Isolation & IDOR Protection:**
  - Non-numeric wardrobe collection ID in URL rejected with 400 Bad Request.
  - Non-existent wardrobe collection returns 404 Not Found.
  - **IDOR Check:** User 2 attempting to view User 1's wardrobe returns `404 Not Found (Access Denied)`.
  - Owner retrieves filtered wardrobe items (200 OK).
* **Item Deletion & Ownership Verification:**
  - Non-numeric item ID rejected with 400 Bad Request.
  - Deleting an item belonging to another user returns 404 Not Found.
  - Successful deletion of owned wardrobe item (200 OK).
* **Order-to-Wardrobe Synchronization:**
  - Invalid order ID parameter rejected with 400 Bad Request.
  - Syncing from an order owned by another user rejected with 404 Not Found.
  - Successful synchronization of verified purchased line items to user wardrobe (200 OK).

### 6.3 Outfit Engine & Custom Looks (`test_outfit_qa.js` – 31 tests)
* **Authentication Guards:** Protected endpoints (`/recommendations`, `/from-wardrobe`, `/save`, `/saved`, `/saved/:id`) reject unauthenticated requests with 401.
* **Outfit Composition & Rule Validation:**
  - Saving outfit without `outfit_name` rejected with 400 Bad Request.
  - Saving outfit without `items` array rejected with 400 Bad Request.
  - Minimum piece rule: Outfits with fewer than 2 items rejected with 400 Bad Request.
  - Garment role validation: items must conform to `Top`, `Bottom`, `Shoes`, `Outerwear`, `Accessory`, or `Other` (400 Bad Request).
  - Missing `variant_id` in item piece rejected with 400 Bad Request.
  - **Anti-Duplication Guard:** Duplicate variant IDs in the same outfit ensemble rejected with 400 Bad Request.
  - Valid transactional outfit persistence returns 201 Created with generated `outfit_id`.
* **Saved Outfits Retrieval:** User retrieves only their saved ensembles with enriched piece metadata (200 OK).
* **Data Isolation & IDOR Protection:**
  - Non-numeric outfit ID on deletion rejected with 400 Bad Request.
  - Non-existent outfit returns 404 Not Found.
  - **IDOR Check:** User 2 attempting to delete User 1's saved outfit returns 404 Not Found.
  - Owner deleting own outfit succeeds with 200 OK.
* **Public / Optional Auth Endpoints:** Product look suggestions (`/api/outfits/product/:productId`) and dynamic outfit generation (`/api/outfits/generate`) remain accessible to guest visitors via safe fallback (200 OK).

### 6.4 Order Processing & Privacy (`test_order_qa.js` – 35 tests)
* **Authentication Guards:** All order endpoints require active authentication (401).
* **Order Payload & Item Validation:**
  - Rejection of missing `items` array (400 Bad Request).
  - Rejection of empty cart submission (400 Bad Request).
  - Rejection of invalid variant ID (400 Bad Request).
  - Quantity limits enforcement (0 or > 50 units per line rejected with 400).
  - Shipping address completeness validation (missing street, city, state, or pincode rejected with 400).
  - Payment method validation: only `COD` and `SIMULATED_CARD` are permitted (400 Bad Request).
* **Inventory Stock Validation & Transaction Execution:**
  - Rejection when requested quantity exceeds available stock (400 Bad Request).
  - **Cumulative Quantity Check:** Rejection when repeated line items for the same variant cumulatively exceed available stock (400 Bad Request).
  - Variant-product relationship mismatch rejected with 400 Bad Request.
  - Valid atomic order creation deducts inventory, calculates price server-side, logs telemetry, and returns 201 Created.
* **Concurrency & Rate Limiting Guards:**
  - Rapid duplicate order submission within 3-second debounce window rejected with `429 Too Many Requests`.
* **Multi-Tenant Privacy & IDOR Protection:**
  - Invalid order ID parameter rejected with 400 Bad Request.
  - Non-existent order returns 404 Not Found.
  - **IDOR Check:** User 2 attempting to inspect User 1's order returns `404 Not Found` (strict privacy boundary).
  - Owner inspecting own order receives complete line items and price-at-purchase records (200 OK).
  - Administrator granted oversight access to inspect customer order for fulfillment tracking (200 OK).

### 6.5 Recommendations, Catalog & Profile (`test_recommendations_catalog_qa.js` – 38 tests)
* **Recommendation Security & IDOR:**
  - Unauthenticated access to `/api/recommendations/wardrobe` or `/api/recommendations/:userId` rejected with 401.
  - Invalid user ID parameter rejected with 400 Bad Request.
  - **IDOR Check:** User 1 attempting to view User 2's personalized recommendations via URL parameter rejected with `403 Forbidden`.
  - Administrator permitted to view user recommendations (200 OK).
  - Similar products parameter validation (invalid ID rejected with 400).
  - Transparent SQL fallback executed when AI microservice is offline (200 OK, source: `fallback`).
  - Vector re-indexing trigger restricted strictly to `ADMIN` role (401 unauth, 403 for `USER`).
* **Catalog Filter Validation:**
  - Non-numeric or negative `category_id` and `brand_id` filters rejected with 400 Bad Request.
  - Non-numeric price filters rejected with 400 Bad Request.
  - Constraint check: `min_price > max_price` rejected with 400 Bad Request.
  - Product lookup with invalid ID (400) or non-existent ID (404).
* **Category & Brand Lookups:** Invalid IDs (400) and non-existent records (404) handled cleanly.
* **Behavioral Telemetry Interactions:**
  - Unauthenticated interaction logging rejected with 401.
  - Missing `product_id` or `interaction_type` rejected with 400.
  - Unsupported interaction type rejected with 400 (allowed: `VIEW`, `LIKE`, `DISLIKE`, `ADD_TO_CART`, `PURCHASE`).
  - Valid interaction recorded with 201 Created.
* **User Profile & Address Validation:**
  - Profile and address updates require authentication (401).
  - Fashion profile budget constraint: `budget_range_min > budget_range_max` rejected with 400 Bad Request.
  - Address update missing required fields rejected with 400 Bad Request.
  - Valid address update succeeds with 200 OK.

---

## 7. Security Observations & Minimal Production Fix

### 7.1 JWT Fallback Secret Security Issue
* **Observation:** During initial inspection, all test files referenced a fallback secret string (`FashionIQ_YourOwnLongRandomSecret_2026`). While helpful for local testing, the Express backend entrypoint (`backend/server.js`) did not validate `JWT_SECRET` during startup. In a production environment (`NODE_ENV === "production"`), a missing or default secret could allow unauthorized parties to sign arbitrary JWTs if the fallback was ever enabled.
* **Security Impact:** Potential authentication bypass or privilege escalation if deployed with missing or default environment configurations.
* **Minimal Appropriate Fix:**
  In `backend/server.js`, introduced a production configuration security guard matching the existing `CORS_ORIGIN` guard:
  ```javascript
  const isProduction = process.env.NODE_ENV === "production";
  const DEV_FALLBACK_JWT_SECRET = "FashionIQ_YourOwnLongRandomSecret_2026";

  if (isProduction) {
      if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim() || process.env.JWT_SECRET === DEV_FALLBACK_JWT_SECRET) {
          throw new Error("CRITICAL SECURITY CONFIGURATION ERROR: A secure, non-default JWT_SECRET must be explicitly configured in production (minimum 32 characters).");
      }
      if (process.env.JWT_SECRET.length < 32) {
          throw new Error("CRITICAL SECURITY CONFIGURATION ERROR: JWT_SECRET must be at least 32 characters long in production.");
      }
  } else {
      // Safe development / test fallback for seamless local test execution
      if (!process.env.JWT_SECRET) {
          process.env.JWT_SECRET = DEV_FALLBACK_JWT_SECRET;
      }
  }
  ```
* **Regression Verification:** Added automated scenario in `test_auth_qa.js` (Section 7) verifying that the server refuses to boot in `production` when `JWT_SECRET` is unset, default, or under 32 characters.

---

## 8. Test Execution Commands

From the `backend/` directory:

```bash
# Execute all 5 QA test suites sequentially
npm test

# Alternatively, run via explicit QA script
npm run test:qa

# Run individual specialized QA suites
npm run test:qa:auth       # Suite 1: Authentication, Tokens & RBAC (47 tests)
npm run test:qa:wardrobe   # Suite 2: Wardrobe Management & Isolation (47 tests)
npm run test:qa:outfits    # Suite 3: Outfit Engine & Custom Looks (31 tests)
npm run test:qa:orders     # Suite 4: Order Processing & Privacy (35 tests)
npm run test:qa:catalog    # Suite 5: Recommendations, Catalog & Profile (38 tests)
```

---

## 9. Known Environmental Limitations

1. **MySQL Daemon:** On Linux testing containers where a live MySQL daemon is not running at `127.0.0.1:3306`, the comprehensive mock database layer in `test_helpers.js` provides 100% test isolation, eliminating flaky dependencies on unseeded database engines.
2. **FastAPI AI Microservice:** The recommendation and outfit suites transparently test both FastAPI gateway communication and Express's resilient SQL fallback handlers without requiring active Python model embeddings during unit QA.

---

## 10. Summary of Files Contributed / Modified

| File | Status | Description |
| :--- | :---: | :--- |
| `backend/tests/test_helpers.js` | **Added** | Shared test server harness, JWT token minting, assertion collector, and mock DB engine. |
| `backend/tests/test_auth_qa.js` | **Added** | Suite 1: Authentication, registration validation, JWT security, session revocation, and RBAC guards (47 tests). |
| `backend/tests/test_wardrobe_qa.js` | **Added** | Suite 2: Wardrobe collection CRUD, item validation, anti-forgery, and IDOR isolation (47 tests). |
| `backend/tests/test_outfit_qa.js` | **Added** | Suite 3: Outfit composition, piece count constraints, role taxonomy, duplicate variant guards, and saved looks (31 tests). |
| `backend/tests/test_order_qa.js` | **Added** | Suite 4: Order creation, stock bounds, address validation, concurrency lock, debounce, and order privacy (35 tests). |
| `backend/tests/test_recommendations_catalog_qa.js` | **Added** | Suite 5: Recommendations IDOR, catalog filter validation, category/brand lookup, interactions, and user profile (38 tests). |
| `backend/tests/run_all_qa_tests.js` | **Added** | Unified test runner executing all 5 suites with summary table reporting. |
| `backend/tests/BACKEND_QA_REPORT.md` | **Added** | Comprehensive QA documentation, scenario matrix, test results, and security findings. |
| `backend/server.js` | **Modified** | Minimal security fix: Added production JWT secret configuration check and development fallback. |
| `backend/package.json` | **Modified** | Configured `npm test` and modular `npm run test:qa:*` scripts. |
