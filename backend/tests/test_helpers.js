/**
 * FashionIQ Backend Test Helpers & Utilities
 * Provides ephemeral server lifecycle, token minting, mock database routing,
 * and standard assertions for automated QA integration suites.
 */

const http = require("http");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";

/**
 * Creates and starts an ephemeral HTTP server on a random available port.
 * @param {import("express").Application} app
 * @returns {Promise<{ server: http.Server, baseUrl: string, close: () => Promise<void> }>}
 */
async function createTestServer(app) {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    const close = () =>
        new Promise((resolve) => {
            server.close(() => resolve());
        });

    return { server, baseUrl, close };
}

/**
 * Generates a signed JWT token for test requests.
 * @param {object} payload
 * @param {number|string} [payload.user_id=1]
 * @param {string} [payload.email="tester@example.com"]
 * @param {string} [payload.role="USER"]
 * @param {string} [payload.expiresIn="1h"]
 * @param {string} [payload.secret]
 * @returns {string}
 */
function createToken(payload = {}, secret = JWT_SECRET) {
    const {
        user_id = 1,
        email = "tester@example.com",
        role = "USER",
        expiresIn = "1h",
        ...rest
    } = payload;

    return jwt.sign({ user_id, email, role, ...rest }, secret, { expiresIn });
}

/**
 * Creates an assertion collector that tracks passed and failed assertions.
 * @param {string} suiteName
 */
function createAssertionCollector(suiteName = "Test Suite") {
    let passed = 0;
    let failed = 0;
    const failures = [];

    function assert(condition, message) {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
            failures.push(message);
        }
    }

    function summarize() {
        console.log(`\n================================================================================`);
        console.log(`${suiteName} Results: ${passed} Passed, ${failed} Failed`);
        console.log(`================================================================================\n`);
        if (failed > 0) {
            console.error(`Failed Scenarios in ${suiteName}:`);
            failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
        }
        return { passed, failed, total: passed + failed };
    }

    return { assert, summarize, get passed() { return passed; }, get failed() { return failed; } };
}

/**
 * In-memory Mock Database helper for deterministic, offline database simulation.
 * Replaces db.execute, db.query, and db.getConnection with predictable responses.
 */
let originalExecute = null;
let originalQuery = null;
let originalGetConnection = null;
let isInstalled = false;

const mockDb = {
    handlers: [],

    when(predicate, responseFn) {
        this.handlers.unshift({ predicate, responseFn });
        return this;
    },

    clearHandlers() {
        this.handlers = [];
    },

    install() {
        if (!isInstalled) {
            originalExecute = db.execute.bind(db);
            originalQuery = db.query.bind(db);
            originalGetConnection = db.getConnection.bind(db);
            isInstalled = true;
        }

        db.execute = async (sql, params = []) => {
            const sqlStr = typeof sql === "string" ? sql : "";
            const normSql = sqlStr.replace(/\s+/g, " ");
            for (const h of this.handlers) {
                if (h.predicate(normSql, params) || h.predicate(sqlStr, params)) {
                    const res = await h.responseFn(normSql, params);
                    return Array.isArray(res) ? res : [res, []];
                }
            }
            return [ [], [] ];
        };

        db.query = async (sql, params = []) => {
            const sqlStr = typeof sql === "string" ? sql : "";
            const normSql = sqlStr.replace(/\s+/g, " ");
            for (const h of this.handlers) {
                if (h.predicate(normSql, params) || h.predicate(sqlStr, params)) {
                    const res = await h.responseFn(normSql, params);
                    return Array.isArray(res) ? res : [res, []];
                }
            }
            return [ [], [] ];
        };

        db.getConnection = async () => {
            return {
                beginTransaction: async () => {},
                query: async (sql, params = []) => {
                    const sqlStr = typeof sql === "string" ? sql : "";
                    const normSql = sqlStr.replace(/\s+/g, " ");
                    for (const h of this.handlers) {
                        if (h.predicate(normSql, params) || h.predicate(sqlStr, params)) {
                            const res = await h.responseFn(normSql, params);
                            return Array.isArray(res) ? res : [res, []];
                        }
                    }
                    return [ [], [] ];
                },
                execute: async (sql, params = []) => {
                    const sqlStr = typeof sql === "string" ? sql : "";
                    const normSql = sqlStr.replace(/\s+/g, " ");
                    for (const h of this.handlers) {
                        if (h.predicate(normSql, params) || h.predicate(sqlStr, params)) {
                            const res = await h.responseFn(normSql, params);
                            return Array.isArray(res) ? res : [res, []];
                        }
                    }
                    return [ [], [] ];
                },
                commit: async () => {},
                rollback: async () => {},
                release: () => {},
            };
        };
    },

    restore() {
        if (isInstalled) {
            db.execute = originalExecute;
            db.query = originalQuery;
            db.getConnection = originalGetConnection;
            isInstalled = false;
        }
        this.clearHandlers();
    }
};

module.exports = {
    JWT_SECRET,
    createTestServer,
    createToken,
    createAssertionCollector,
    mockDb,
};
