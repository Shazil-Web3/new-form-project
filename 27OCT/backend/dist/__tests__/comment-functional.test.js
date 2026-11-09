"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// FUNCTIONAL comment tests: content, trackable, identity, many comments,
// counting. Additive suite - the 411 combination tests are untouched.
// Run: npm run build && node --test "dist/__tests__/comment-functional.test.js"
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const commentStore_1 = require("../comment/commentStore");
let fn = 0;
const F = () => `F${String(++fn).padStart(3, "0")}`;
function mkActor(role, userId = `u-${role}`) { return { userId, role }; }
function mkDoc(over = {}) {
    return { id: "doc1", kind: "document", authorId: "u-author", creatorId: "u-author", state: "draft", ...over };
}
const anchor = (mark = "bold") => ({ mark, from: 0, to: 5, text: "hello" });
// ---------- content ----------
{
    const cases = [
        ["empty string", ""],
        ["whitespace only", "   \n\t  "],
        ["null", null],
        ["number", 42],
        ["undefined", undefined],
    ];
    for (const [name, body] of cases) {
        (0, node_test_1.test)(`[func] ${F()} content rejects ${name}`, () => {
            const doc = mkDoc();
            const store = new commentStore_1.CommentStore();
            strict_1.default.throws(() => store.add(doc, mkActor("author"), body), /COMMENT_BLOCKED/);
            strict_1.default.equal(store.count(doc.id), 0);
        });
    }
    (0, node_test_1.test)(`[func] ${F()} content accepts max length exactly`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        store.add(doc, mkActor("author"), "x".repeat(commentStore_1.CONTENT_MAX_LENGTH));
        strict_1.default.equal(store.count(doc.id), 1);
    });
    (0, node_test_1.test)(`[func] ${F()} content rejects over max length`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        strict_1.default.throws(() => store.add(doc, mkActor("author"), "x".repeat(commentStore_1.CONTENT_MAX_LENGTH + 1)), /COMMENT_BLOCKED/);
    });
    (0, node_test_1.test)(`[func] ${F()} content keeps unicode, emoji, multiline`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const body = "مرحبا 🎉 line1\nline2\t<tag>&amp;";
        const c = store.add(doc, mkActor("author"), body);
        strict_1.default.equal(c.body, body);
    });
    (0, node_test_1.test)(`[func] ${F()} content edit to empty rejected, original kept`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author"), "keep");
        strict_1.default.throws(() => store.edit(doc, mkActor("author"), c.id, "   "), /EDIT_BLOCKED/);
        strict_1.default.equal(store.list(doc.id)[0].body, "keep");
    });
    (0, node_test_1.test)(`[func] ${F()} content edit over max length rejected`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author"), "keep");
        strict_1.default.throws(() => store.edit(doc, mkActor("author"), c.id, "y".repeat(commentStore_1.CONTENT_MAX_LENGTH + 1)), /EDIT_BLOCKED/);
    });
}
// ---------- anchors: TipTap base marks ----------
for (const mark of commentStore_1.TIPTAP_MARKS) {
    (0, node_test_1.test)(`[func] ${F()} anchor accepts tiptap mark ${mark}`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author"), "on mark", null, { anchor: anchor(mark) });
        strict_1.default.deepEqual(c.anchor, anchor(mark));
    });
}
{
    const bad = [
        ["unknown mark", { mark: "strike", from: 0, to: 1, text: "x" }],
        ["negative from", { mark: "bold", from: -1, to: 1, text: "x" }],
        ["to before from", { mark: "bold", from: 5, to: 2, text: "x" }],
        ["empty anchor text", { mark: "bold", from: 0, to: 1, text: "" }],
        ["non-integer range", { mark: "bold", from: 0.5, to: 1, text: "x" }],
    ];
    for (const [name, a] of bad) {
        (0, node_test_1.test)(`[func] ${F()} anchor rejects ${name}`, () => {
            strict_1.default.throws(() => (0, commentStore_1.checkAnchor)(a), /COMMENT_BLOCKED/);
            const doc = mkDoc();
            const store = new commentStore_1.CommentStore();
            strict_1.default.throws(() => store.add(doc, mkActor("author"), "x", null, { anchor: a }), /COMMENT_BLOCKED/);
        });
    }
    (0, node_test_1.test)(`[func] ${F()} anchor caret range (from == to) allowed`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author"), "caret", null, { anchor: { mark: "italic", from: 3, to: 3, text: "|" } });
        strict_1.default.equal(c.anchor && c.anchor.from, 3);
    });
    (0, node_test_1.test)(`[func] ${F()} comment without anchor stores null anchor`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        strict_1.default.equal(store.add(doc, mkActor("author"), "plain").anchor, null);
    });
}
// ---------- trackable ----------
{
    (0, node_test_1.test)(`[func] ${F()} trackable: add stamps history with actor + timestamp`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const before = Date.now();
        const c = store.add(doc, mkActor("author", "u-w"), "v1");
        const h = store.historyOf(c.id);
        strict_1.default.equal(h.length, 1);
        strict_1.default.equal(h[0].action, "add");
        strict_1.default.equal(h[0].actorId, "u-w");
        strict_1.default.equal(h[0].actorRole, "author");
        strict_1.default.ok(h[0].at >= before);
    });
    (0, node_test_1.test)(`[func] ${F()} trackable: edit bumps version + appends event`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author"), "v1");
        strict_1.default.equal(c.version, 1);
        store.edit(doc, mkActor("author"), c.id, "v2");
        store.edit(doc, mkActor("author"), c.id, "v3");
        strict_1.default.equal(store.list(doc.id)[0].version, 3);
        strict_1.default.deepEqual(store.historyOf(c.id).map(e => e.action), ["add", "edit", "edit"]);
    });
    (0, node_test_1.test)(`[func] ${F()} trackable: resolve + delete appended in order`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author"), "x");
        store.resolve(doc, mkActor("review_approval", "u-r"), c.id);
        store.remove(doc, mkActor("author"), c.id);
        const acts = store.historyOf(c.id).map(e => e.action);
        strict_1.default.deepEqual(acts, ["add", "resolve", "delete"]);
        strict_1.default.equal(store.historyOf(c.id)[1].actorId, "u-r");
    });
    (0, node_test_1.test)(`[func] ${F()} trackable: history returns a copy (append-only store)`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author"), "x");
        const h = store.historyOf(c.id);
        h.push({ seq: 999, action: "add", actorId: "fake", actorRole: "author", at: 0 });
        strict_1.default.equal(store.historyOf(c.id).length, 1);
    });
    (0, node_test_1.test)(`[func] ${F()} trackable: history of missing comment blocked`, () => {
        const store = new commentStore_1.CommentStore();
        strict_1.default.throws(() => store.historyOf("nope"), /HISTORY_BLOCKED/);
    });
    (0, node_test_1.test)(`[func] ${F()} trackable: event seqs increase across comments`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const a = store.add(doc, mkActor("author"), "a");
        const b = store.add(doc, mkActor("author"), "b");
        const ha = store.historyOf(a.id)[0].seq;
        const hb = store.historyOf(b.id)[0].seq;
        strict_1.default.ok(hb > ha);
    });
}
// ---------- identity ----------
{
    (0, node_test_1.test)(`[func] ${F()} identity stamped from actor, role recorded`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("review_approval", "u-rev"), "hi");
        strict_1.default.equal(c.authorId, "u-rev");
        strict_1.default.equal(c.authorRole, "review_approval");
    });
    (0, node_test_1.test)(`[func] ${F()} identity survives edit (authorId/authorRole immutable)`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author", "u-orig"), "v1");
        store.edit(doc, mkActor("author", "u-orig"), c.id, "v2");
        const got = store.list(doc.id)[0];
        strict_1.default.equal(got.authorId, "u-orig");
        strict_1.default.equal(got.authorRole, "author");
    });
    (0, node_test_1.test)(`[func] ${F()} identity: two users same role counted separately`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        store.add(doc, mkActor("author", "u-1"), "a");
        store.add(doc, mkActor("author", "u-2"), "b");
        store.add(doc, mkActor("author", "u-2"), "c");
        strict_1.default.equal(store.countByAuthor(doc.id, "u-1"), 1);
        strict_1.default.equal(store.countByAuthor(doc.id, "u-2"), 2);
        strict_1.default.equal(store.count(doc.id), 3);
    });
    (0, node_test_1.test)(`[func] ${F()} identity: reply keeps replier identity, parent untouched`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const root = store.add(doc, mkActor("author", "u-a"), "root");
        const r = store.add(doc, mkActor("org_admin", "u-b"), "reply", root.id);
        strict_1.default.equal(r.authorId, "u-b");
        strict_1.default.equal(store.list(doc.id)[0].authorId, "u-a");
    });
    (0, node_test_1.test)(`[func] ${F()} identity: deleted comment keeps author stamp in listing`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const c = store.add(doc, mkActor("author", "u-gone"), "x");
        store.remove(doc, mkActor("author"), c.id);
        const all = store.list(doc.id, { includeDeleted: true });
        strict_1.default.equal(all.length, 1);
        strict_1.default.equal(all[0].authorId, "u-gone");
    });
}
// ---------- many comments ----------
{
    (0, node_test_1.test)(`[func] ${F()} many: 200 bulk adds count exactly`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        for (let i = 0; i < 200; i++)
            store.add(doc, mkActor("author", `u-${i % 5}`), `bulk ${i}`);
        strict_1.default.equal(store.count(doc.id), 200);
    });
    (0, node_test_1.test)(`[func] ${F()} many: author distribution across 5 users`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        for (let i = 0; i < 200; i++)
            store.add(doc, mkActor("author", `u-${i % 5}`), `bulk ${i}`);
        for (let k = 0; k < 5; k++)
            strict_1.default.equal(store.countByAuthor(doc.id, `u-${k}`), 40);
    });
    (0, node_test_1.test)(`[func] ${F()} many: pagination limit/offset walks all 200 in order`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        for (let i = 0; i < 200; i++)
            store.add(doc, mkActor("author"), `bulk ${i}`);
        const p1 = store.list(doc.id, { limit: 50, offset: 0 });
        const p2 = store.list(doc.id, { limit: 50, offset: 50 });
        const p5 = store.list(doc.id, { limit: 50, offset: 150 });
        strict_1.default.equal(p1.length, 50);
        strict_1.default.equal(p1[0].body, "bulk 0");
        strict_1.default.equal(p2[0].body, "bulk 50");
        strict_1.default.equal(p5[49].body, "bulk 199");
        strict_1.default.equal(store.list(doc.id, { limit: 50, offset: 200 }).length, 0);
    });
    (0, node_test_1.test)(`[func] ${F()} many: resolve 50 of 200 -> 150`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        for (let i = 0; i < 200; i++)
            store.add(doc, mkActor("author"), `bulk ${i}`);
        const ids = store.list(doc.id).slice(0, 50).map(c => c.id);
        for (const id of ids)
            store.resolve(doc, mkActor("author"), id);
        strict_1.default.equal(store.count(doc.id), 150);
        strict_1.default.equal(store.list(doc.id).length, 150);
        strict_1.default.equal(store.list(doc.id, { includeResolved: true }).length, 200);
    });
    (0, node_test_1.test)(`[func] ${F()} many: delete 50 of 200 -> 150, deleted hidden by default`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        for (let i = 0; i < 200; i++)
            store.add(doc, mkActor("author"), `bulk ${i}`);
        const ids = store.list(doc.id).slice(0, 50).map(c => c.id);
        for (const id of ids)
            store.remove(doc, mkActor("author"), id);
        strict_1.default.equal(store.count(doc.id), 150);
        strict_1.default.equal(store.list(doc.id).length, 150);
        strict_1.default.equal(store.list(doc.id, { includeDeleted: true }).length, 200);
    });
}
// ---------- counting (combined) ----------
{
    (0, node_test_1.test)(`[func] ${F()} counting: replies + resolves + deletes combine`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const me = mkActor("author");
        const r1 = store.add(doc, me, "root1");
        store.add(doc, me, "reply1", r1.id);
        const r2 = store.add(doc, me, "root2");
        strict_1.default.equal(store.count(doc.id), 3);
        store.resolve(doc, me, r1.id); // root resolved, reply still open
        strict_1.default.equal(store.count(doc.id), 2);
        store.remove(doc, me, r2.id);
        strict_1.default.equal(store.count(doc.id), 1);
    });
    (0, node_test_1.test)(`[func] ${F()} counting: unresolved() matches count()`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        const a = store.add(doc, mkActor("author"), "a");
        store.add(doc, mkActor("author"), "b");
        store.resolve(doc, mkActor("author"), a.id);
        strict_1.default.equal(store.unresolved(doc.id).length, store.count(doc.id));
    });
    (0, node_test_1.test)(`[func] ${F()} counting: send warning reflects bulk state`, () => {
        const doc = mkDoc();
        const store = new commentStore_1.CommentStore();
        for (let i = 0; i < 10; i++)
            store.add(doc, mkActor("author"), `c${i}`);
        let res = store.sendForReview(doc, mkActor("author"));
        strict_1.default.equal(res.unresolvedCount, 10);
        strict_1.default.match(res.warning, /some comments still not resolved/);
        for (const c of store.list(doc.id))
            store.resolve(doc, mkActor("author"), c.id);
        res = store.sendForReview(doc, mkActor("author"));
        strict_1.default.equal(res.warning, null);
    });
    (0, node_test_1.test)(`[func] ${F()} counting: per-doc isolation`, () => {
        const d1 = mkDoc({ id: "d1" });
        const d2 = mkDoc({ id: "d2" });
        const store = new commentStore_1.CommentStore();
        store.add(d1, mkActor("author"), "a");
        store.add(d1, mkActor("author"), "b");
        store.add(d2, mkActor("author"), "c");
        strict_1.default.equal(store.count("d1"), 2);
        strict_1.default.equal(store.count("d2"), 1);
    });
}
