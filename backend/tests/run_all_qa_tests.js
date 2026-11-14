/**
 * FashionIQ Backend Comprehensive QA Test Suite Runner
 * File: backend/tests/run_all_qa_tests.js
 *
 * Sequentially executes all 5 specialized backend QA integration test suites:
 * 1. test_auth_qa.js
 * 2. test_wardrobe_qa.js
 * 3. test_outfit_qa.js
 * 4. test_order_qa.js
 * 5. test_recommendations_catalog_qa.js
 */

const runAuthQaTests = require("./test_auth_qa");
const runWardrobeQaTests = require("./test_wardrobe_qa");
const runOutfitQaTests = require("./test_outfit_qa");
const runOrderQaTests = require("./test_order_qa");
const runRecommendationsCatalogQaTests = require("./test_recommendations_catalog_qa");

async function runAllQaSuites() {
    console.log("\n################################################################################");
    console.log("             FASHIONIQ COMPLETE BACKEND QA VERIFICATION SUITE");
    console.log("################################################################################\n");

    const t0 = Date.now();
    const results = [];

    const suites = [
        { name: "Authentication, Tokens & RBAC", fn: runAuthQaTests },
        { name: "Wardrobe Management & Isolation", fn: runWardrobeQaTests },
        { name: "Outfit Engine & Custom Looks", fn: runOutfitQaTests },
        { name: "Order Processing & Privacy", fn: runOrderQaTests },
        { name: "Recommendations, Catalog & Profile", fn: runRecommendationsCatalogQaTests },
    ];

    let allPassed = true;

    for (const suite of suites) {
        console.log(`\n>>> STARTING SUITE: ${suite.name} >>>\n`);
        try {
            const success = await suite.fn();
            results.push({ name: suite.name, status: success ? "PASSED" : "FAILED" });
            if (!success) allPassed = false;
        } catch (err) {
            console.error(`Suite ${suite.name} threw fatal error:`, err);
            results.push({ name: suite.name, status: "ERROR", error: err.message });
            allPassed = false;
        }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

    console.log("\n################################################################################");
    console.log("                     FINAL QA SUITES EXECUTION SUMMARY");
    console.log("################################################################################\n");
    console.table(results);
    console.log(`Total Execution Time: ${elapsed} seconds\n`);

    if (allPassed) {
        console.log("ALL 5 BACKEND QA TEST SUITES PASSED CLEANLY (100% SUCCESS)\n");
        process.exit(0);
    } else {
        console.error("SOME QA TEST SUITES FAILED. Please review detailed logs above.\n");
        process.exit(1);
    }
}

if (require.main === module) {
    runAllQaSuites();
}

module.exports = runAllQaSuites;
