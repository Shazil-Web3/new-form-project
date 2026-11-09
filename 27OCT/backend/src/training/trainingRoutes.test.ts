import { test } from "node:test";
import assert from "node:assert/strict";
import registerTrainingRoutes from "./trainingRoutes";

test("administrator assignments query uses PostgreSQL placeholders", async () => {
  const routes = new Map<string, Array<(...args: any[]) => any>>();
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const register = (method: string) => (route: string, ...handlers: Array<(...args: any[]) => any>) => {
    routes.set(`${method} ${route}`, handlers);
  };
  const app = {
    get: register("GET"),
    post: register("POST"),
    put: register("PUT"),
    delete: register("DELETE"),
  };
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    },
  };
  const originalSetInterval = global.setInterval;
  global.setInterval = (() => 0) as any;

  try {
    registerTrainingRoutes({
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
      logAuditEvent: async () => {},
    });

    const handlers = routes.get("GET /api/training/assignments");
    assert.ok(handlers?.length);
    const req = { user: { userId: 7, organization_id: 42, role: "admin" }, query: {} };
    let response: unknown;
    const res = {
      status() {
        return this;
      },
      json(body: unknown) {
        response = body;
        return body;
      },
    };

    await handlers[handlers.length - 1](req, res);

    const assignmentQuery = queries.find(({ sql }) => sql.includes("FROM lms_assignments a"));
    assert.ok(assignmentQuery);
    assert.match(assignmentQuery.sql, /WHERE e\.organization_id = \$1/);
    assert.deepEqual(assignmentQuery.params, [42]);
    assert.deepEqual(response, []);
  } finally {
    global.setInterval = originalSetInterval;
  }
});
