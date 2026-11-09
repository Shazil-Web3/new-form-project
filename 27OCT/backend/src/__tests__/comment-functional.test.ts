// FUNCTIONAL comment tests: content, trackable, identity, many comments,
// counting. Additive suite - the 411 combination tests are untouched.
// Run: npm run build && node --test "dist/__tests__/comment-functional.test.js"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Actor, DocRef, CommentStore, CommentAnchor,
  TIPTAP_MARKS, CONTENT_MAX_LENGTH, checkAnchor,
} from "../comment/commentStore";

let fn = 0;
const F = () => `F${String(++fn).padStart(3, "0")}`;
function mkActor(role: Actor["role"], userId = `u-${role}`): Actor { return { userId, role }; }
function mkDoc(over: Partial<DocRef> = {}): DocRef {
  return { id: "doc1", kind: "document", authorId: "u-author", creatorId: "u-author", state: "draft", ...over };
}
const anchor = (mark: CommentAnchor["mark"] = "bold"): CommentAnchor =>
  ({ mark, from: 0, to: 5, text: "hello" });

// ---------- content ----------
{
  const cases: [string, unknown][] = [
    ["empty string", ""],
    ["whitespace only", "   \n\t  "],
    ["null", null],
    ["number", 42],
    ["undefined", undefined],
  ];
  for (const [name, body] of cases) {
    test(`[func] ${F()} content rejects ${name}`, () => {
      const doc = mkDoc();
      const store = new CommentStore();
      assert.throws(() => store.add(doc, mkActor("author"), body as string), /COMMENT_BLOCKED/);
      assert.equal(store.count(doc.id), 0);
    });
  }
  test(`[func] ${F()} content accepts max length exactly`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    store.add(doc, mkActor("author"), "x".repeat(CONTENT_MAX_LENGTH));
    assert.equal(store.count(doc.id), 1);
  });
  test(`[func] ${F()} content rejects over max length`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    assert.throws(() => store.add(doc, mkActor("author"), "x".repeat(CONTENT_MAX_LENGTH + 1)), /COMMENT_BLOCKED/);
  });
  test(`[func] ${F()} content keeps unicode, emoji, multiline`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const body = "مرحبا 🎉 line1\nline2\t<tag>&amp;";
    const c = store.add(doc, mkActor("author"), body);
    assert.equal(c.body, body);
  });
  test(`[func] ${F()} content edit to empty rejected, original kept`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author"), "keep");
    assert.throws(() => store.edit(doc, mkActor("author"), c.id, "   "), /EDIT_BLOCKED/);
    assert.equal(store.list(doc.id)[0].body, "keep");
  });
  test(`[func] ${F()} content edit over max length rejected`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author"), "keep");
    assert.throws(() => store.edit(doc, mkActor("author"), c.id, "y".repeat(CONTENT_MAX_LENGTH + 1)), /EDIT_BLOCKED/);
  });
}

// ---------- anchors: TipTap base marks ----------
for (const mark of TIPTAP_MARKS) {
  test(`[func] ${F()} anchor accepts tiptap mark ${mark}`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author"), "on mark", null, { anchor: anchor(mark) });
    assert.deepEqual(c.anchor, anchor(mark));
  });
}
{
  const bad: [string, unknown][] = [
    ["unknown mark", { mark: "strike", from: 0, to: 1, text: "x" }],
    ["negative from", { mark: "bold", from: -1, to: 1, text: "x" }],
    ["to before from", { mark: "bold", from: 5, to: 2, text: "x" }],
    ["empty anchor text", { mark: "bold", from: 0, to: 1, text: "" }],
    ["non-integer range", { mark: "bold", from: 0.5, to: 1, text: "x" }],
  ];
  for (const [name, a] of bad) {
    test(`[func] ${F()} anchor rejects ${name}`, () => {
      assert.throws(() => checkAnchor(a), /COMMENT_BLOCKED/);
      const doc = mkDoc();
      const store = new CommentStore();
      assert.throws(() => store.add(doc, mkActor("author"), "x", null, { anchor: a as CommentAnchor }), /COMMENT_BLOCKED/);
    });
  }
  test(`[func] ${F()} anchor caret range (from == to) allowed`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author"), "caret", null,
      { anchor: { mark: "italic", from: 3, to: 3, text: "|" } });
    assert.equal(c.anchor && c.anchor.from, 3);
  });
  test(`[func] ${F()} comment without anchor stores null anchor`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    assert.equal(store.add(doc, mkActor("author"), "plain").anchor, null);
  });
}

// ---------- trackable ----------
{
  test(`[func] ${F()} trackable: add stamps history with actor + timestamp`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const before = Date.now();
    const c = store.add(doc, mkActor("author", "u-w"), "v1");
    const h = store.historyOf(c.id);
    assert.equal(h.length, 1);
    assert.equal(h[0].action, "add");
    assert.equal(h[0].actorId, "u-w");
    assert.equal(h[0].actorRole, "author");
    assert.ok(h[0].at >= before);
  });
  test(`[func] ${F()} trackable: edit bumps version + appends event`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author"), "v1");
    assert.equal(c.version, 1);
    store.edit(doc, mkActor("author"), c.id, "v2");
    store.edit(doc, mkActor("author"), c.id, "v3");
    assert.equal(store.list(doc.id)[0].version, 3);
    assert.deepEqual(store.historyOf(c.id).map(e => e.action), ["add", "edit", "edit"]);
  });
  test(`[func] ${F()} trackable: resolve + delete appended in order`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author"), "x");
    store.resolve(doc, mkActor("review_approval", "u-r"), c.id);
    store.remove(doc, mkActor("author"), c.id);
    const acts = store.historyOf(c.id).map(e => e.action);
    assert.deepEqual(acts, ["add", "resolve", "delete"]);
    assert.equal(store.historyOf(c.id)[1].actorId, "u-r");
  });
  test(`[func] ${F()} trackable: history returns a copy (append-only store)`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author"), "x");
    const h = store.historyOf(c.id);
    h.push({ seq: 999, action: "add", actorId: "fake", actorRole: "author", at: 0 });
    assert.equal(store.historyOf(c.id).length, 1);
  });
  test(`[func] ${F()} trackable: history of missing comment blocked`, () => {
    const store = new CommentStore();
    assert.throws(() => store.historyOf("nope"), /HISTORY_BLOCKED/);
  });
  test(`[func] ${F()} trackable: event seqs increase across comments`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const a = store.add(doc, mkActor("author"), "a");
    const b = store.add(doc, mkActor("author"), "b");
    const ha = store.historyOf(a.id)[0].seq;
    const hb = store.historyOf(b.id)[0].seq;
    assert.ok(hb > ha);
  });
}

// ---------- identity ----------
{
  test(`[func] ${F()} identity stamped from actor, role recorded`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("review_approval", "u-rev"), "hi");
    assert.equal(c.authorId, "u-rev");
    assert.equal(c.authorRole, "review_approval");
  });
  test(`[func] ${F()} identity survives edit (authorId/authorRole immutable)`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author", "u-orig"), "v1");
    store.edit(doc, mkActor("author", "u-orig"), c.id, "v2");
    const got = store.list(doc.id)[0];
    assert.equal(got.authorId, "u-orig");
    assert.equal(got.authorRole, "author");
  });
  test(`[func] ${F()} identity: two users same role counted separately`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    store.add(doc, mkActor("author", "u-1"), "a");
    store.add(doc, mkActor("author", "u-2"), "b");
    store.add(doc, mkActor("author", "u-2"), "c");
    assert.equal(store.countByAuthor(doc.id, "u-1"), 1);
    assert.equal(store.countByAuthor(doc.id, "u-2"), 2);
    assert.equal(store.count(doc.id), 3);
  });
  test(`[func] ${F()} identity: reply keeps replier identity, parent untouched`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const root = store.add(doc, mkActor("author", "u-a"), "root");
    const r = store.add(doc, mkActor("org_admin", "u-b"), "reply", root.id);
    assert.equal(r.authorId, "u-b");
    assert.equal(store.list(doc.id)[0].authorId, "u-a");
  });
  test(`[func] ${F()} identity: deleted comment keeps author stamp in listing`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const c = store.add(doc, mkActor("author", "u-gone"), "x");
    store.remove(doc, mkActor("author"), c.id);
    const all = store.list(doc.id, { includeDeleted: true });
    assert.equal(all.length, 1);
    assert.equal(all[0].authorId, "u-gone");
  });
}

// ---------- many comments ----------
{
  test(`[func] ${F()} many: 200 bulk adds count exactly`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    for (let i = 0; i < 200; i++) store.add(doc, mkActor("author", `u-${i % 5}`), `bulk ${i}`);
    assert.equal(store.count(doc.id), 200);
  });
  test(`[func] ${F()} many: author distribution across 5 users`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    for (let i = 0; i < 200; i++) store.add(doc, mkActor("author", `u-${i % 5}`), `bulk ${i}`);
    for (let k = 0; k < 5; k++) assert.equal(store.countByAuthor(doc.id, `u-${k}`), 40);
  });
  test(`[func] ${F()} many: pagination limit/offset walks all 200 in order`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    for (let i = 0; i < 200; i++) store.add(doc, mkActor("author"), `bulk ${i}`);
    const p1 = store.list(doc.id, { limit: 50, offset: 0 });
    const p2 = store.list(doc.id, { limit: 50, offset: 50 });
    const p5 = store.list(doc.id, { limit: 50, offset: 150 });
    assert.equal(p1.length, 50);
    assert.equal(p1[0].body, "bulk 0");
    assert.equal(p2[0].body, "bulk 50");
    assert.equal(p5[49].body, "bulk 199");
    assert.equal(store.list(doc.id, { limit: 50, offset: 200 }).length, 0);
  });
  test(`[func] ${F()} many: resolve 50 of 200 -> 150`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    for (let i = 0; i < 200; i++) store.add(doc, mkActor("author"), `bulk ${i}`);
    const ids = store.list(doc.id).slice(0, 50).map(c => c.id);
    for (const id of ids) store.resolve(doc, mkActor("author"), id);
    assert.equal(store.count(doc.id), 150);
    assert.equal(store.list(doc.id).length, 150);
    assert.equal(store.list(doc.id, { includeResolved: true }).length, 200);
  });
  test(`[func] ${F()} many: delete 50 of 200 -> 150, deleted hidden by default`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    for (let i = 0; i < 200; i++) store.add(doc, mkActor("author"), `bulk ${i}`);
    const ids = store.list(doc.id).slice(0, 50).map(c => c.id);
    for (const id of ids) store.remove(doc, mkActor("author"), id);
    assert.equal(store.count(doc.id), 150);
    assert.equal(store.list(doc.id).length, 150);
    assert.equal(store.list(doc.id, { includeDeleted: true }).length, 200);
  });
}

// ---------- counting (combined) ----------
{
  test(`[func] ${F()} counting: replies + resolves + deletes combine`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const me = mkActor("author");
    const r1 = store.add(doc, me, "root1");
    store.add(doc, me, "reply1", r1.id);
    const r2 = store.add(doc, me, "root2");
    assert.equal(store.count(doc.id), 3);
    store.resolve(doc, me, r1.id); // root resolved, reply still open
    assert.equal(store.count(doc.id), 2);
    store.remove(doc, me, r2.id);
    assert.equal(store.count(doc.id), 1);
  });
  test(`[func] ${F()} counting: unresolved() matches count()`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    const a = store.add(doc, mkActor("author"), "a");
    store.add(doc, mkActor("author"), "b");
    store.resolve(doc, mkActor("author"), a.id);
    assert.equal(store.unresolved(doc.id).length, store.count(doc.id));
  });
  test(`[func] ${F()} counting: send warning reflects bulk state`, () => {
    const doc = mkDoc();
    const store = new CommentStore();
    for (let i = 0; i < 10; i++) store.add(doc, mkActor("author"), `c${i}`);
    let res = store.sendForReview(doc, mkActor("author"));
    assert.equal(res.unresolvedCount, 10);
    assert.match(res.warning as string, /some comments still not resolved/);
    for (const c of store.list(doc.id)) store.resolve(doc, mkActor("author"), c.id);
    res = store.sendForReview(doc, mkActor("author"));
    assert.equal(res.warning, null);
  });
  test(`[func] ${F()} counting: per-doc isolation`, () => {
    const d1 = mkDoc({ id: "d1" });
    const d2 = mkDoc({ id: "d2" });
    const store = new CommentStore();
    store.add(d1, mkActor("author"), "a");
    store.add(d1, mkActor("author"), "b");
    store.add(d2, mkActor("author"), "c");
    assert.equal(store.count("d1"), 2);
    assert.equal(store.count("d2"), 1);
  });
}
