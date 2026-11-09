// Standalone comment test server (no DB): backs `npx playwright test`.
// Run: node dist/comment/testServer.js [port]  (default 5051)
import express from "express";
import { createCommentRouter } from "./commentRoutes";

const app = express();
app.use(express.json());
app.use("/api", createCommentRouter());
app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.argv[2] || 5051);
app.listen(port, "127.0.0.1", () => {
  console.log(`comment-test-server on http://127.0.0.1:${port}`);
});
