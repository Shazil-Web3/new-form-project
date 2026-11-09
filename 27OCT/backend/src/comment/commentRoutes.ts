// Comment API routes (dev-role bypass): Auth NOT built yet, no password.
// Identity comes from X-Dev-Role / ?devRole= (+ X-Dev-User / ?devUser=,
// default u-<role>). Backed by the tested CommentStore. RBAC roles only -
// no Access Levels. Mount: app.use("/api", createCommentRouter()).
import { Request, Response, NextFunction, Router } from "express";
import {
  Actor, CommentStore, DevRole, DocRef,
  canBeReviewer, canPullBack, DEV_ROLES, resolveDevRole,
} from "./commentStore";

export interface RouterState {
  store: CommentStore;
  docs: Map<string, DocRef>;
}

export function actorFromReq(req: Request): Actor | null {
  const header = req.headers["x-dev-role"];
  const headerValue = Array.isArray(header) ? header[0] : header;
  const role: DevRole | null = resolveDevRole(
    typeof headerValue === "string" ? headerValue : undefined,
    typeof req.query.devRole === "string" ? req.query.devRole : undefined);
  if (!role) return null;
  const uHeader = req.headers["x-dev-user"];
  const uq = req.query.devUser;
  const userId = (Array.isArray(uHeader) ? uHeader[0] : uHeader) ||
    (typeof uq === "string" ? uq : undefined) || `u-${role}`;
  return { userId, role };
}

export function requireActor(req: Request, res: Response, next: NextFunction): void {
  const actor = actorFromReq(req);
  if (!actor) {
    res.status(401).json({ code: "DEV_ROLE_REQUIRED", message: "Set X-Dev-Role header or ?devRole=" });
    return;
  }
  (req as Request & { actor: Actor }).actor = actor;
  next();
}

function err(res: Response, e: unknown): void {
  const code = (e as { code?: string }).code || "ERROR";
  const status = code === "DEV_ROLE_REQUIRED" ? 401
    : code.endsWith("_BLOCKED") ? 403 : 400;
  res.status(status).json({ code, message: (e as Error).message });
}

export function createCommentRouter(state?: RouterState): Router {
  const r = Router();
  const s: RouterState = state || { store: new CommentStore(), docs: new Map() };
  const actor = (req: Request): Actor => (req as Request & { actor: Actor }).actor;
  const docOf = (id: string): DocRef | undefined => s.docs.get(id);

  // Create (or reset) a template/document thread. Author/creator = caller.
  r.post("/docs", requireActor, (req: Request, res: Response) => {
    try {
      const a = actor(req);
      const id = typeof req.body.id === "string" ? req.body.id : `doc-${Date.now()}`;
      const kind = req.body.kind === "template" ? "template" : "document";
      const doc: DocRef = { id, kind, authorId: a.userId, creatorId: a.userId, state: "draft" };
      s.docs.set(id, doc);
      res.status(201).json({ doc });
    } catch (e) { err(res, e); }
  });

  r.patch("/docs/:id/state", requireActor, (req: Request, res: Response) => {
    try {
      const doc = docOf(req.params.id);
      if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
      doc.state = req.body.state;
      res.json({ doc });
    } catch (e) { err(res, e); }
  });

  r.post("/docs/:id/comments", requireActor, (req: Request, res: Response) => {
    try {
      const doc = docOf(req.params.id);
      if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
      const c = s.store.add(doc, actor(req), req.body.body,
        req.body.parentId === undefined ? null : req.body.parentId,
        { anchor: req.body.anchor });
      res.status(201).json({ comment: c, count: s.store.count(doc.id) });
    } catch (e) { err(res, e); }
  });

  r.get("/docs/:id/comments", requireActor, (req: Request, res: Response) => {
    try {
      const doc = docOf(req.params.id);
      if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
      res.json({ comments: s.store.list(doc.id), count: s.store.count(doc.id) });
    } catch (e) { err(res, e); }
  });

  r.patch("/comments/:cid", requireActor, (req: Request, res: Response) => {
    try {
      const doc = docOf(String(req.body.docId || req.query.docId || ""));
      if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
      const c = s.store.edit(doc, actor(req), req.params.cid, req.body.body);
      res.json({ comment: c, count: s.store.count(doc.id) });
    } catch (e) { err(res, e); }
  });

  r.delete("/comments/:cid", requireActor, (req: Request, res: Response) => {
    try {
      const doc = docOf(String(req.body.docId || req.query.docId || ""));
      if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
      const count = s.store.remove(doc, actor(req), req.params.cid);
      res.json({ count });
    } catch (e) { err(res, e); }
  });

  r.post("/comments/:cid/resolve", requireActor, (req: Request, res: Response) => {
    try {
      const doc = docOf(String(req.body.docId || req.query.docId || ""));
      if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
      const count = s.store.resolve(doc, actor(req), req.params.cid);
      res.json({ count });
    } catch (e) { err(res, e); }
  });

  // Save draft: no mutation, count preserved.
  r.post("/docs/:id/save", requireActor, (req: Request, res: Response) => {
    const doc = docOf(req.params.id);
    if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
    res.json({ saved: true, count: s.store.count(doc.id) });
  });

  // Send for Review: unresolved warning + authorized reviewer dropdown.
  r.post("/docs/:id/send", requireActor, (req: Request, res: Response) => {
    const doc = docOf(req.params.id);
    if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
    const { warning, unresolvedCount } = s.store.sendForReview(doc, actor(req));
    doc.state = "in_review";
    const reviewers = (DEV_ROLES as readonly string[]).filter((r) => canBeReviewer(r as DevRole));
    res.json({ warning, unresolvedCount, reviewers, state: doc.state });
  });

  // Pull back: only author/creator; comments preserved.
  r.post("/docs/:id/pullback", requireActor, (req: Request, res: Response) => {
    try {
      const doc = docOf(req.params.id);
      if (!doc) { res.status(404).json({ code: "NOT_FOUND" }); return; }
      const a = actor(req);
      if (!canPullBack(a, doc)) {
        throw Object.assign(new Error("PULLBACK_BLOCKED: only author/creator"), { code: "PULLBACK_BLOCKED" });
      }
      doc.state = "draft";
      res.json({ state: doc.state, count: s.store.count(doc.id) });
    } catch (e) { err(res, e); }
  });

  return r;
}
