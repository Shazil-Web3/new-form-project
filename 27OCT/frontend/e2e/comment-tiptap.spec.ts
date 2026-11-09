// Playwright robot plays RBAC roles against the comment API.
// Standalone server (no DB): node dist/comment/testServer.js 5051
// Run: npx playwright test --config playwright.config.ts
// (API-only: uses the `request` fixture, no browser launch needed.)
// Auth NOT built yet: identity = X-Dev-Role header (+ X-Dev-User).
import { test, expect, APIRequestContext } from "@playwright/test";

const BASE = process.env.COMMENT_API || "http://127.0.0.1:5051";
const ROLES = ["system", "super_admin", "org_admin", "author", "review_approval",
  "project_manager", "people_manager", "view_only", "temporary_view"] as const;
const COMMENTERS = ["super_admin", "org_admin", "author", "review_approval"];
let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++n}`;

const H = (role: string, user?: string) => ({
  "X-Dev-Role": role,
  ...(user ? { "X-Dev-User": user } : {}),
});

async function mkDoc(request: APIRequestContext, role: string, user: string, kind = "document") {
  const r = await request.post(`${BASE}/api/docs`, {
    headers: H(role, user), data: { id: uid("doc"), kind },
  });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).doc;
}

test.describe("robot plays roles: add comment", () => {
  for (const role of ROLES) {
    test(`[pw-a] ${role} add`, async ({ request }) => {
      const doc = await mkDoc(request, "author", "u-seed");
      const r = await request.post(`${BASE}/api/docs/${doc.id}/comments`, {
        headers: H(role), data: { body: `hi from ${role}` },
      });
      if ((COMMENTERS as readonly string[]).includes(role)) {
        expect(r.status()).toBe(201);
        expect((await r.json()).count).toBe(1);
      } else {
        expect(r.status()).toBe(403);
      }
    });
  }
});

test.describe("robot plays roles: reply", () => {
  for (const role of ROLES) {
    test(`[pw-b] ${role} reply`, async ({ request }) => {
      const doc = await mkDoc(request, "author", "u-seed");
      const root = await request.post(`${BASE}/api/docs/${doc.id}/comments`, {
        headers: H("author", "u-seed"), data: { body: "root" },
      });
      const rootId = (await root.json()).comment.id;
      const r = await request.post(`${BASE}/api/docs/${doc.id}/comments`, {
        headers: H(role), data: { body: "reply", parentId: rootId },
      });
      if ((COMMENTERS as readonly string[]).includes(role)) {
        expect(r.status()).toBe(201);
        expect((await r.json()).count).toBe(2);
      } else {
        expect(r.status()).toBe(403);
      }
    });
  }
});

test.describe("robot plays roles: delete ONLY author/creator (81)", () => {
  for (const creator of ROLES) {
    for (const deleter of ROLES) {
      test(`[pw-c] creator=${creator} deleter=${deleter}`, async ({ request }) => {
        const doc = await mkDoc(request, creator, "u-creator");
        // seed as the creator's own user (author-role identity; the 4
        // non-commenting creator roles cannot seed with their own role)
        const seeded = await request.post(`${BASE}/api/docs/${doc.id}/comments`, {
          headers: H("author", "u-creator"), data: { body: "x" },
        });
        expect(seeded.status()).toBe(201);
        const target = (await seeded.json()).comment.id;
        const same = creator === deleter;
        const r = await request.delete(`${BASE}/api/comments/${target}?docId=${doc.id}`, {
          headers: H(deleter, same ? "u-creator" : "u-stranger"),
        });
        if (same) {
          expect(r.status()).toBe(200);
          expect((await r.json()).count).toBe(0);
        } else {
          expect(r.status()).toBe(403);
        }
      });
    }
  }
});

test.describe("robot: counting + warning + save/send/pullback/states", () => {
  test("[pw-e] chain 0->1->2->1->0", async ({ request }) => {
    const doc = await mkDoc(request, "author", "u-a");
    const h = H("author", "u-a");
    const c1 = (await (await request.post(`${BASE}/api/docs/${doc.id}/comments`, { headers: h, data: { body: "1" } })).json()).comment;
    await request.post(`${BASE}/api/docs/${doc.id}/comments`, { headers: h, data: { body: "2" } });
    let g = await (await request.get(`${BASE}/api/docs/${doc.id}/comments`, { headers: h })).json();
    expect(g.count).toBe(2);
    await request.delete(`${BASE}/api/comments/${c1.id}?docId=${doc.id}`, { headers: h });
    g = await (await request.get(`${BASE}/api/docs/${doc.id}/comments`, { headers: h })).json();
    expect(g.count).toBe(1);
    await request.post(`${BASE}/api/comments/${g.comments[0].id}/resolve?docId=${doc.id}`, { headers: h });
    g = await (await request.get(`${BASE}/api/docs/${doc.id}/comments`, { headers: h })).json();
    expect(g.count).toBe(0);
  });

  const warns: [string, string[], boolean][] = [
    ["0 unresolved", [], false],
    ["1 unresolved", ["open"], true],
    ["1 resolved", ["resolved"], false],
    ["1+1 mixed", ["resolved", "open"], true],
    ["2 unresolved", ["open", "open"], true],
    ["2 resolved", ["resolved", "resolved"], false],
  ];
  for (const [name, seed, warn] of warns) {
    test(`[pw-f] send warns: ${name}`, async ({ request }) => {
      const doc = await mkDoc(request, "author", "u-a");
      const h = H("author", "u-a");
      for (const s of seed) {
        const c = (await (await request.post(`${BASE}/api/docs/${doc.id}/comments`, { headers: h, data: { body: "c" } })).json()).comment;
        if (s === "resolved") await request.post(`${BASE}/api/comments/${c.id}/resolve?docId=${doc.id}`, { headers: h });
      }
      const r = await request.post(`${BASE}/api/docs/${doc.id}/send`, { headers: h });
      const j = await r.json();
      expect(j.unresolvedCount).toBe(seed.filter(s => s === "open").length);
      if (warn) expect(j.warning).toMatch(/some comments still not resolved/);
      else expect(j.warning).toBeNull();
    });
  }

  for (const role of ROLES) {
    test(`[pw-g] ${role} save preserves count`, async ({ request }) => {
      const doc = await mkDoc(request, "author", "u-a");
      const h = H("author", "u-a");
      await request.post(`${BASE}/api/docs/${doc.id}/comments`, { headers: h, data: { body: "1" } });
      const r = await request.post(`${BASE}/api/docs/${doc.id}/save`, { headers: H(role) });
      expect((await r.json()).count).toBe(1);
    });
  }

  test("[pw-g] reviewer dropdown = 4 authorized roles", async ({ request }) => {
    const doc = await mkDoc(request, "author", "u-a");
    const r = await request.post(`${BASE}/api/docs/${doc.id}/send`, { headers: H("author", "u-a") });
    expect((await r.json()).reviewers).toEqual(["super_admin", "org_admin", "author", "review_approval"]);
  });

  test("[pw-h] author pullback keeps count, stranger blocked", async ({ request }) => {
    const doc = await mkDoc(request, "author", "u-a");
    const h = H("author", "u-a");
    await request.post(`${BASE}/api/docs/${doc.id}/comments`, { headers: h, data: { body: "1" } });
    await request.post(`${BASE}/api/docs/${doc.id}/comments`, { headers: h, data: { body: "2" } });
    await request.post(`${BASE}/api/docs/${doc.id}/send`, { headers: h });
    const bad = await request.post(`${BASE}/api/docs/${doc.id}/pullback`, { headers: H("org_admin", "u-x") });
    expect(bad.status()).toBe(403);
    const ok = await request.post(`${BASE}/api/docs/${doc.id}/pullback`, { headers: h });
    const j = await ok.json();
    expect(j.state).toBe("draft");
    expect(j.count).toBe(2);
  });

  for (const state of ["draft", "in_review", "in_comment", "approved", "revision", "archived"]) {
    test(`[pw-i] state=${state} add as author`, async ({ request }) => {
      const doc = await mkDoc(request, "author", "u-a");
      const h = H("author", "u-a");
      await request.patch(`${BASE}/api/docs/${doc.id}/state`, { headers: h, data: { state } });
      const r = await request.post(`${BASE}/api/docs/${doc.id}/comments`, { headers: h, data: { body: "x" } });
      if (["draft", "in_review", "in_comment", "revision"].includes(state)) expect(r.status()).toBe(201);
      else expect(r.status()).toBe(403);
    });
  }
});
