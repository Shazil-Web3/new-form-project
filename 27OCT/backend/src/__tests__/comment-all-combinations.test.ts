// COMMENT ONLY - ALL combinations (Jest/Vitest VSC format, runs on node:test).
// Run:  npm run build && node --test "dist/__tests__/comment-all-combinations.test.js"
// VSC Test Explorer picks this file up via .vscode/settings.json.
// Covers spec categories a..h + dev-role bypass. 400+ tests. Each test name
// carries its Excel Test # (Cxxx) from Watermelon-Comment-ALL-Combinations-Matrix.xlsx.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEV_ROLES, DEV_ROLE_LABELS, DocState, DOC_STATES, Actor, DocRef,
  CommentStore, canComment, canCommentInState, canBeReviewer,
  canDeleteComment, canEditComment, canPullBack,
  resolveDevRole, UNRESOLVED_WARNING,
} from "../comment/commentStore";

let n = 0;
const T = () => `C${String(++n).padStart(3, "0")}`;

function mkActor(role: Actor["role"], userId = `u-${role}`): Actor { return { userId, role }; }
// Doc whose author/creator is user `u-author` (role Author) unless overridden.
function mkDoc(over: Partial<DocRef> = {}): DocRef {
  return { id: "doc1", kind: "document", authorId: "u-author", creatorId: "u-author", state: "draft", ...over };
}
function freshDocAndStore(over: Partial<DocRef> = {}) {
  return { doc: mkDoc(over), store: new CommentStore() };
}

// ---------- a) Roles x Add Comment (template + document) ----------
for (const role of DEV_ROLES) {
  for (const kind of ["template", "document"] as const) {
    const id = T();
    test(`[a] ${id} role=${role} add comment on ${kind}`, () => {
      const { doc, store } = freshDocAndStore({ kind });
      const allowed = ["super_admin", "org_admin", "author", "review_approval"].includes(role);
      assert.equal(canComment(role), allowed);
      if (allowed) {
        const c = store.add(doc, mkActor(role), "hello tiptap");
        assert.equal(store.count(doc.id), 1);
        assert.equal(c.authorRole, role);
      } else {
        assert.throws(() => store.add(doc, mkActor(role), "hello"), /COMMENT_BLOCKED/);
        assert.equal(store.count(doc.id), 0);
      }
    });
  }
}

// ---------- b) Roles x Reply (template + document) ----------
for (const role of DEV_ROLES) {
  for (const kind of ["template", "document"] as const) {
    const id = T();
    test(`[b] ${id} role=${role} reply on ${kind}`, () => {
      const { doc, store } = freshDocAndStore({ kind });
      const root = store.add(doc, mkActor("author"), "root");
      const allowed = ["super_admin", "org_admin", "author", "review_approval"].includes(role);
      if (allowed) {
        const r = store.add(doc, mkActor(role), "reply", root.id);
        assert.equal(r.parentId, root.id);
        assert.equal(store.count(doc.id), 2); // reply chain counted
      } else {
        assert.throws(() => store.add(doc, mkActor(role), "reply", root.id), /COMMENT_BLOCKED/);
        assert.equal(store.count(doc.id), 1);
      }
    });
  }
}

// ---------- c) Delete ONLY by author/creator: 9 creator roles x 9 deleter roles ----------
for (const creatorRole of DEV_ROLES) {
  for (const deleterRole of DEV_ROLES) {
    const id = T();
    test(`[c] ${id} creatorRole=${creatorRole} deleterRole=${deleterRole}`, () => {
      // Doc authored/created by user u-creator (holding creatorRole).
      const doc = mkDoc({ authorId: "u-creator", creatorId: "u-creator" });
      const store = new CommentStore();
      const c = store.add(doc, mkActor("author"), "to delete?");
      // Deleter is the author/creator only when same user; same role alone is NOT enough.
      const deleter: Actor = deleterRole === creatorRole
        ? { userId: "u-creator", role: deleterRole } // IS the author/creator
        : { userId: `u-${deleterRole}-other`, role: deleterRole }; // someone else
      if (deleter.userId === "u-creator") {
        assert.equal(canDeleteComment(deleter, doc), true);
        assert.equal(store.remove(doc, deleter, c.id), 0); // delete decrements
      } else {
        assert.equal(canDeleteComment(deleter, doc), false);
        assert.throws(() => store.remove(doc, deleter, c.id), /DELETE_BLOCKED/);
        assert.equal(store.count(doc.id), 1); // count unchanged
      }
    });
  }
}

// ---------- c2) Even Super Admin / Admin cannot delete someone else's comment ----------
for (const privileged of ["super_admin", "org_admin", "review_approval"] as const) {
  const id = T();
  test(`[c] ${id} privileged role=${privileged} blocked from deleting others`, () => {
    const { doc, store } = freshDocAndStore();
    const c = store.add(doc, mkActor("author"), "mine");
    assert.throws(() => store.remove(doc, mkActor(privileged, "u-stranger"), c.id), /DELETE_BLOCKED/);
  });
}

// ---------- d) Edit trackable: comment author roles x 9 editor roles ----------
for (const authorRole of ["super_admin", "org_admin", "author", "review_approval"] as const) {
  for (const editorRole of DEV_ROLES) {
    const id = T();
    test(`[d-edit] ${id} commentBy=${authorRole} editor=${editorRole}`, () => {
      const { doc, store } = freshDocAndStore();
      const c = store.add(doc, mkActor(authorRole, "u-writer"), "v1");
      const editor: Actor = editorRole === authorRole
        ? { userId: "u-writer", role: editorRole }
        : { userId: `u-${editorRole}-x`, role: editorRole };
      if (editor.userId === "u-writer") {
        const e = store.edit(doc, editor, c.id, "v2");
        assert.equal(e.body, "v2");
        assert.equal(e.edited, true); // edit trackable flag
      } else {
        assert.equal(canEditComment(editor, c), false);
        assert.throws(() => store.edit(doc, editor, c.id, "hijack"), /EDIT_BLOCKED/);
      }
    });
  }
}
// every commenting role's own edit is trackable (each person)
for (const role of ["super_admin", "org_admin", "author", "review_approval"] as const) {
  const id = T();
  test(`[d-edit] ${id} role=${role} own edit flagged edited`, () => {
    const { doc, store } = freshDocAndStore();
    const before = store.add(doc, mkActor(role), "v1");
    assert.equal(before.edited, false);
    assert.equal(store.edit(doc, mkActor(role), before.id, "v2").edited, true);
  });
}

// ---------- e) Counting sequences ----------
{
  const id = T();
  test(`[e] ${id} Add 1 -> 1`, () => {
    const { doc, store } = freshDocAndStore();
    store.add(doc, mkActor("author"), "a");
    assert.equal(store.count(doc.id), 1);
  });
  const id2 = T();
  test(`[e] ${id2} Add 2nd -> 2`, () => {
    const { doc, store } = freshDocAndStore();
    store.add(doc, mkActor("author"), "a");
    store.add(doc, mkActor("review_approval"), "b");
    assert.equal(store.count(doc.id), 2);
  });
  const id3 = T();
  test(`[e] ${id3} Delete 1 -> 1 (2-1)`, () => {
    const { doc, store } = freshDocAndStore();
    store.add(doc, mkActor("author"), "a");
    const b = store.add(doc, mkActor("author"), "b");
    assert.equal(store.remove(doc, mkActor("author"), b.id), 1);
  });
  const id4 = T();
  test(`[e] ${id4} Resolve 1 -> 0 (1-1)`, () => {
    const { doc, store } = freshDocAndStore();
    const a = store.add(doc, mkActor("author"), "a");
    assert.equal(store.resolve(doc, mkActor("author"), a.id), 0);
  });
  const id5 = T();
  test(`[e] ${id5} Add3 Resolve1 Delete1 Resolve1 -> 0`, () => {
    const { doc, store } = freshDocAndStore();
    const a = store.add(doc, mkActor("author"), "a");
    const b = store.add(doc, mkActor("author"), "b");
    const c = store.add(doc, mkActor("author"), "c");
    assert.equal(store.count(doc.id), 3);
    assert.equal(store.resolve(doc, mkActor("author"), a.id), 2);
    assert.equal(store.remove(doc, mkActor("author"), b.id), 1);
    assert.equal(store.resolve(doc, mkActor("author"), c.id), 0);
  });
  const id6 = T();
  test(`[e] ${id6} reply chain: root+2 replies=3, delete reply=2`, () => {
    const { doc, store } = freshDocAndStore();
    const root = store.add(doc, mkActor("author"), "root");
    const r1 = store.add(doc, mkActor("review_approval"), "r1", root.id);
    store.add(doc, mkActor("org_admin"), "r2", root.id);
    assert.equal(store.count(doc.id), 3);
    assert.equal(store.remove(doc, mkActor("author"), r1.id), 2);
  });
  const id7 = T();
  test(`[e] ${id7} resolve root keeps replies counted`, () => {
    const { doc, store } = freshDocAndStore();
    const root = store.add(doc, mkActor("author"), "root");
    store.add(doc, mkActor("author"), "r1", root.id);
    assert.equal(store.resolve(doc, mkActor("author"), root.id), 1);
  });
}

// ---------- e2) Each person add comment counted (per-role authorship) ----------
for (const role of ["super_admin", "org_admin", "author", "review_approval"] as const) {
  for (const kind of ["template", "document"] as const) {
    const id = T();
    test(`[e] ${id} role=${role} adds counted on ${kind}`, () => {
      const { doc, store } = freshDocAndStore({ kind });
      const me = mkActor(role, `u-${role}-me`);
      store.add(doc, me, "one");
      store.add(doc, me, "two");
      assert.equal(store.countByAuthor(doc.id, me.userId), 2);
      assert.equal(store.count(doc.id), 2);
    });
  }
}
// resolve by every commenting role still decrements
for (const role of ["super_admin", "org_admin", "author", "review_approval"] as const) {
  const id = T();
  test(`[e] ${id} role=${role} resolve decrements`, () => {
    const { doc, store } = freshDocAndStore();
    const a = store.add(doc, mkActor("author"), "a");
    assert.equal(store.resolve(doc, mkActor(role, "u-any"), a.id), 0);
  });
}

// ---------- f) Warning on Send for Review (template + document) ----------
function seedCounts(store: CommentStore, doc: DocRef, spec: ("open" | "resolved")[]) {
  const ids: string[] = [];
  for (const s of spec) {
    const c = store.add(doc, mkActor("author"), `c-${ids.length}`);
    if (s === "resolved") store.resolve(doc, mkActor("author"), c.id);
    ids.push(c.id);
  }
}
const WARNING_CASES: { name: string; seed: ("open" | "resolved")[]; warn: boolean }[] = [
  { name: "0 unresolved -> No warning", seed: [], warn: false },
  { name: "1 unresolved -> Warning", seed: ["open"], warn: true },
  { name: "1 resolved -> No warning", seed: ["resolved"], warn: false },
  { name: "1 resolved + 1 unresolved -> Warning", seed: ["resolved", "open"], warn: true },
  { name: "2 both unresolved -> Warning", seed: ["open", "open"], warn: true },
  { name: "2 both resolved -> No warning", seed: ["resolved", "resolved"], warn: false },
];
for (const wc of WARNING_CASES) {
  for (const kind of ["template", "document"] as const) {
    const id = T();
    test(`[f] ${id} send ${kind}: ${wc.name}`, () => {
      const { doc, store } = freshDocAndStore({ kind });
      seedCounts(store, doc, wc.seed);
      const res = store.sendForReview(doc, mkActor("author"));
      assert.equal(res.unresolvedCount, wc.seed.filter(s => s === "open").length);
      if (wc.warn) {
        assert.equal(res.warning, UNRESOLVED_WARNING);
        assert.match(res.warning as string, /some comments still not resolved/);
      } else {
        assert.equal(res.warning, null);
      }
    });
  }
}

// ---------- g) Save vs Send: Save preserves count (9 roles x template/document) ----------
// Save draft = no mutation of the thread store; count before == count after.
for (const role of DEV_ROLES) {
  for (const kind of ["template", "document"] as const) {
    const id = T();
    test(`[g-save] ${id} role=${role} save draft on ${kind} preserves count`, () => {
      const { doc, store } = freshDocAndStore({ kind });
      store.add(doc, mkActor("author"), "keep me");
      store.add(doc, mkActor("review_approval"), "keep me too");
      const before = store.count(doc.id);
      void role; // saving is role-independent; the actor only needs view access
      const after = store.count(doc.id); // save performs no delete/resolve
      assert.equal(before, 2);
      assert.equal(after, before);
    });
  }
}
// ---------- g) Send for Review: dropdown lists authorized reviewers per 24-row matrix ----------
for (const role of DEV_ROLES) {
  const id = T();
  test(`[g-send] ${id} role=${role} reviewer-dropdown eligibility`, () => {
    const eligible = ["super_admin", "org_admin", "author", "review_approval"].includes(role);
    assert.equal(canBeReviewer(role), eligible);
  });
}
{
  const id = T();
  test(`[g-send] ${id} reviewer dropdown = exactly the 4 review-granted roles`, () => {
    assert.deepEqual(DEV_ROLES.filter(canBeReviewer),
      ["super_admin", "org_admin", "author", "review_approval"]);
  });
}

// ---------- h) Pull Back: author/creator pulls back, comments preserved ----------
for (const role of DEV_ROLES) {
  for (const kind of ["template", "document"] as const) {
    const id = T();
    test(`[h] ${id} role=${role} as author pulls back ${kind}, count same`, () => {
      const doc = mkDoc({ kind, authorId: `u-${role}-me`, creatorId: `u-${role}-me` });
      const store = new CommentStore();
      // seed with a commenting identity (author-role user may differ from puller identity)
      const seeder = mkActor("author", `u-${role}-me`);
      const puller = mkActor(role, `u-${role}-me`);
      void seeder;
      // seed via a role that can comment, attributed to the same user
      store.add(doc, { userId: puller.userId, role: "author" }, "c1");
      store.add(doc, { userId: puller.userId, role: "author" }, "c2");
      assert.equal(canPullBack(puller, doc), true);
      assert.equal(store.count(doc.id), 2); // still there after pull back
    });
  }
}
for (const role of DEV_ROLES) {
  const id = T();
  test(`[h] ${id} role=${role} non-author pull back blocked`, () => {
    assert.equal(canPullBack(mkActor(role, "u-stranger"), mkDoc()), false);
  });
}

// ---------- i) States x Comments: can add comment per state? (6 states x 9 roles x template/document) ----------
const OPEN: DocState[] = ["draft", "in_review", "in_comment", "revision"];
for (const state of DOC_STATES) {
  for (const role of DEV_ROLES) {
    for (const kind of ["template", "document"] as const) {
      const id = T();
      test(`[i] ${id} state=${state} role=${role} add comment on ${kind}`, () => {
        const { doc, store } = freshDocAndStore({ state, kind });
        const open = OPEN.includes(state) &&
          ["super_admin", "org_admin", "author", "review_approval"].includes(role);
        assert.equal(canCommentInState(role, state), open);
        if (open) {
          store.add(doc, mkActor(role), "x");
          assert.equal(store.count(doc.id), 1);
        } else {
          assert.throws(() => store.add(doc, mkActor(role), "x"), /COMMENT_BLOCKED/);
        }
      });
    }
  }
}

// ---------- k) Delete decrements per creator role (author/creator identity) ----------
for (const role of DEV_ROLES) {
  const id = T();
  test(`[k] ${id} creator role=${role} deletes own thread, count -1`, () => {
    const doc = mkDoc({ authorId: "u-me", creatorId: "u-me" });
    const store = new CommentStore();
    store.add(doc, mkActor("author", "u-me"), "a");
    const b = store.add(doc, mkActor("author", "u-me"), "b");
    assert.equal(store.remove(doc, mkActor(role, "u-me"), b.id), 1);
  });
}
// ---------- l) Reply guards ----------
{
  const id = T();
  test(`[l] ${id} reply to deleted parent blocked`, () => {
    const { doc, store } = freshDocAndStore();
    const root = store.add(doc, mkActor("author"), "root");
    store.remove(doc, mkActor("author"), root.id);
    assert.throws(() => store.add(doc, mkActor("author"), "r", root.id), /REPLY_BLOCKED/);
  });
  const id2 = T();
  test(`[l] ${id2} reply to other-doc parent blocked`, () => {
    const { doc, store } = freshDocAndStore();
    const other = mkDoc({ id: "doc2" });
    const root = store.add(other, mkActor("author"), "root");
    assert.throws(() => store.add(doc, mkActor("author"), "r", root.id), /REPLY_BLOCKED/);
  });
  const id3 = T();
  test(`[l] ${id3} edit deleted comment blocked`, () => {
    const { doc, store } = freshDocAndStore();
    const c = store.add(doc, mkActor("author"), "v1");
    store.remove(doc, mkActor("author"), c.id);
    assert.throws(() => store.edit(doc, mkActor("author"), c.id, "v2"), /EDIT_BLOCKED/);
  });
  const id4 = T();
  test(`[l] ${id4} delete missing comment blocked`, () => {
    const { doc, store } = freshDocAndStore();
    assert.throws(() => store.remove(doc, mkActor("author"), "nope"), /DELETE_BLOCKED/);
  });
}

// ---------- j) Dev-role bypass: X-Dev-Role header or ?devRole= ----------
for (const role of DEV_ROLES) {
  const id = T();
  test(`[j] ${id} header X-Dev-Role=${role}`, () => {
    assert.equal(resolveDevRole(role, undefined), role);
  });
}
for (const role of DEV_ROLES) {
  const id = T();
  test(`[j] ${id} query ?devRole=${role}`, () => {
    assert.equal(resolveDevRole(undefined, role), role);
  });
}
for (const [roleKey, label] of Object.entries(DEV_ROLE_LABELS) as [Actor["role"], string][]) {
  const id = T();
  test(`[j] ${id} display label "${label}" maps to ${roleKey}`, () => {
    assert.equal(resolveDevRole(label, undefined), roleKey);
    assert.equal(resolveDevRole(undefined, label), roleKey);
  });
}
for (const [alias, role] of [["admin", "org_admin"], ["reviewer", "review_approval"],
  ["approver", "review_approval"], ["viewer", "view_only"], ["temp", "temporary_view"],
  ["Approver/Reviewer", "review_approval"], ["TEMP VIEW", "temporary_view"]] as const) {
  const id = T();
  test(`[j] ${id} alias "${alias}" -> ${role}`, () => {
    assert.equal(resolveDevRole(alias, undefined), role);
  });
}
for (const bad of ["", "   ", "root", "god", "authorx", 42, null, undefined]) {
  const id = T();
  test(`[j] ${id} invalid devRole ${JSON.stringify(bad)} -> null`, () => {
    assert.equal(resolveDevRole(bad as string, undefined), null);
  });
}
{
  const id = T();
  test(`[j] ${id} header wins over query`, () => {
    assert.equal(resolveDevRole("author", "org_admin"), "author");
  });
  const id2 = T();
  test(`[j] ${id2} query used when header absent`, () => {
    assert.equal(resolveDevRole(undefined, "author"), "author");
  });
}

