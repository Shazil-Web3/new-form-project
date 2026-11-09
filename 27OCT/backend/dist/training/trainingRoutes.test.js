"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const trainingRoutes_1 = __importDefault(require("./trainingRoutes"));
(0, node_test_1.test)("administrator assignments query uses PostgreSQL placeholders", async () => {
    const routes = new Map();
    const queries = [];
    const register = (method) => (route, ...handlers) => {
        routes.set(`${method} ${route}`, handlers);
    };
    const app = {
        get: register("GET"),
        post: register("POST"),
        put: register("PUT"),
        delete: register("DELETE"),
    };
    const pool = {
        query: async (sql, params) => {
            queries.push({ sql, params });
            return { rows: [], rowCount: 0 };
        },
    };
    const originalSetInterval = global.setInterval;
    global.setInterval = (() => 0);
    try {
        (0, trainingRoutes_1.default)({
            app,
            pool,
            authenticateToken: (_req, _res, next) => next(),
            dbOps: {},
            transporter: null,
            generateInvitationToken: () => "",
            upload: { single: () => (_req, _res, next) => next() },
            uploadsDir: "",
            fs: {},
            path: {},
            logAuditEvent: async () => { },
        });
        const handlers = routes.get("GET /api/training/assignments");
        strict_1.default.ok(handlers?.length);
        const req = { user: { userId: 7, organization_id: 42, role: "admin" }, query: {} };
        let response;
        const res = {
            status() {
                return this;
            },
            json(body) {
                response = body;
                return body;
            },
        };
        await handlers[handlers.length - 1](req, res);
        const assignmentQuery = queries.find(({ sql }) => sql.includes("FROM lms_assignments a"));
        strict_1.default.ok(assignmentQuery);
        strict_1.default.match(assignmentQuery.sql, /WHERE e\.organization_id = \$1/);
        strict_1.default.deepEqual(assignmentQuery.params, [42]);
        strict_1.default.deepEqual(response, []);
    }
    finally {
        global.setInterval = originalSetInterval;
    }
});
