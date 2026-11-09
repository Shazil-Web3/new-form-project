"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Standalone comment test server (no DB): backs `npx playwright test`.
// Run: node dist/comment/testServer.js [port]  (default 5051)
const express_1 = __importDefault(require("express"));
const commentRoutes_1 = require("./commentRoutes");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use("/api", (0, commentRoutes_1.createCommentRouter)());
app.get("/health", (_req, res) => res.json({ ok: true }));
const port = Number(process.argv[2] || 5051);
app.listen(port, "127.0.0.1", () => {
    console.log(`comment-test-server on http://127.0.0.1:${port}`);
});
