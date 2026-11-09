"use strict";
// Shared comment-domain logic for the TipTap canvas comment feature.
//
// Single source of truth consumed by:
//   - backend/src/__tests__/comment-all-combinations.test.ts (node:test)
//   - the Express routes (dev-role bypass lives in ../auth/devRole)
//   - frontend/src/__tests__/comment-tiptap.spec.ts (Playwright expectations)
//   - Watermelon-Comment-ALL-Combinations-Matrix.xlsx (Expected columns)
//
// Spec (user's words):
//   - Built-in comment/edit trackable in TipTap canvas
//   - Reply/delete, delete ONLY by author of template/document OR creator
//     of template (only author/creator can delete)
//   - Counting: add increments, delete decrements, resolve decrements,
//     each person add comment counted
//   - Warning: when author sends template/document for review/approval,
//     warning if some comments still not resolved
//   - Save vs Send for Review, reviewer dropdown list of authorized users
//     per 24-row matrix 98/216, author can pull back template
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentStore = exports.UNRESOLVED_WARNING = exports.CONTENT_MAX_LENGTH = exports.TIPTAP_MARKS = exports.DOC_STATES = exports.DEV_ROLE_LABELS = exports.DEV_ROLES = void 0;
exports.checkAnchor = checkAnchor;
exports.canComment = canComment;
exports.canCommentInState = canCommentInState;
exports.canBeReviewer = canBeReviewer;
exports.canDeleteComment = canDeleteComment;
exports.canEditComment = canEditComment;
exports.canPullBack = canPullBack;
exports.resolveDevRole = resolveDevRole;
// 9 dev roles (display names shown in the App.tsx top-bar switcher).
exports.DEV_ROLES = [
    'system',
    'super_admin',
    'org_admin',
    'author',
    'review_approval',
    'project_manager',
    'people_manager',
    'view_only',
    'temporary_view',
];
exports.DEV_ROLE_LABELS = {
    system: 'System',
    super_admin: 'Super Admin',
    org_admin: 'Admin',
    author: 'Author',
    review_approval: 'Approver/Reviewer',
    project_manager: 'Project Manager',
    people_manager: 'People Manager',
    view_only: 'View',
    temporary_view: 'Temp View',
};
// Roles holding documents.comment in the approved 24-row matrix
// (backend/src/rbac/rbacCatalog.ts BUILTIN_PERMISSIONS; super_admin holds all).
const COMMENT_ROLES = ['super_admin', 'org_admin', 'author', 'review_approval'];
// Roles holding documents.review or templates.review (reviewer dropdown).
const REVIEW_ROLES = ['super_admin', 'org_admin', 'author', 'review_approval'];
exports.DOC_STATES = ['draft', 'in_review', 'in_comment', 'approved', 'revision', 'archived'];
// States where the TipTap canvas still accepts new comments.
const COMMENT_OPEN_STATES = ['draft', 'in_review', 'in_comment', 'revision'];
// TipTap base marks supported by the canvas (bold italic underline headings
// bullet font-style color). A comment anchors to one marked range.
exports.TIPTAP_MARKS = [
    'bold', 'italic', 'underline', 'heading', 'bullet', 'fontStyle', 'color',
];
/** Max comment body length (characters). */
exports.CONTENT_MAX_LENGTH = 5000;
function checkBody(body, what) {
    if (typeof body !== 'string' || body.trim().length === 0) {
        throw Object.assign(new Error(`${what}_BLOCKED: content empty`), { code: `${what}_BLOCKED` });
    }
    if (body.length > exports.CONTENT_MAX_LENGTH) {
        throw Object.assign(new Error(`${what}_BLOCKED: content exceeds ${exports.CONTENT_MAX_LENGTH}`), { code: `${what}_BLOCKED` });
    }
    return body;
}
function checkAnchor(anchor) {
    if (anchor === null || anchor === undefined)
        return null;
    const a = anchor;
    if (!exports.TIPTAP_MARKS.includes(a.mark)) {
        throw Object.assign(new Error('COMMENT_BLOCKED: unknown tiptap mark'), { code: 'COMMENT_BLOCKED' });
    }
    if (!Number.isInteger(a.from) || !Number.isInteger(a.to) || a.from < 0 || a.to < a.from) {
        throw Object.assign(new Error('COMMENT_BLOCKED: bad anchor range'), { code: 'COMMENT_BLOCKED' });
    }
    if (typeof a.text !== 'string' || a.text.length === 0) {
        throw Object.assign(new Error('COMMENT_BLOCKED: anchor text empty'), { code: 'COMMENT_BLOCKED' });
    }
    return { mark: a.mark, from: a.from, to: a.to, text: a.text };
}
exports.UNRESOLVED_WARNING = 'Warning: some comments still not resolved. Resolve all comments before sending for review/approval.';
function canComment(role) {
    return COMMENT_ROLES.includes(role);
}
function canCommentInState(role, state) {
    return canComment(role) && COMMENT_OPEN_STATES.includes(state);
}
// Reviewer dropdown (Send for Review): authorized users per 24-row matrix.
function canBeReviewer(role) {
    return REVIEW_ROLES.includes(role);
}
// Delete ONLY by author of template/document OR creator of template.
// Role-independent: even Super Admin cannot delete someone else's thread.
function canDeleteComment(actor, doc) {
    return actor.userId === doc.authorId || actor.userId === doc.creatorId;
}
// Edit is trackable: only the comment's own author may edit it.
function canEditComment(actor, comment) {
    return !comment.deleted && actor.userId === comment.authorId;
}
// Pull back after Send: only the author/creator.
function canPullBack(actor, doc) {
    return actor.userId === doc.authorId || actor.userId === doc.creatorId;
}
/** In-memory TipTap comment thread store. Count = unresolved, non-deleted. */
class CommentStore {
    comments = new Map();
    seq = 0;
    eventSeq = 0;
    log(c, action, actor) {
        this.eventSeq += 1;
        c.history.push({ seq: this.eventSeq, action, actorId: actor.userId, actorRole: actor.role, at: Date.now() });
    }
    add(doc, actor, body, parentId = null, opts = {}) {
        if (!canCommentInState(actor.role, doc.state)) {
            const why = !canComment(actor.role) ? `role ${actor.role} holds no documents.comment grant` : `state ${doc.state} is closed for comments`;
            throw Object.assign(new Error(`COMMENT_BLOCKED: ${why}`), { code: 'COMMENT_BLOCKED' });
        }
        const clean = checkBody(body, 'COMMENT');
        const anchor = checkAnchor(opts.anchor);
        if (parentId !== null) {
            const parent = this.comments.get(parentId);
            if (!parent || parent.deleted || parent.docId !== doc.id) {
                throw Object.assign(new Error('REPLY_BLOCKED: parent missing/deleted'), { code: 'REPLY_BLOCKED' });
            }
        }
        this.seq += 1;
        // Identity is server-stamped from the authenticated actor: authorId and
        // authorRole always equal the caller's identity, never client input.
        const rec = {
            id: `c${this.seq}`, docId: doc.id, authorId: actor.userId, authorRole: actor.role,
            body: clean, parentId, anchor, resolved: false, deleted: false,
            edited: false, version: 1, createdAt: Date.now(), history: [],
        };
        this.log(rec, 'add', actor);
        this.comments.set(rec.id, rec);
        return rec;
    }
    edit(doc, actor, commentId, body) {
        void doc;
        const c = this.comments.get(commentId);
        if (!c || c.deleted)
            throw Object.assign(new Error('EDIT_BLOCKED: missing/deleted'), { code: 'EDIT_BLOCKED' });
        if (!canEditComment(actor, c))
            throw Object.assign(new Error('EDIT_BLOCKED: only comment author'), { code: 'EDIT_BLOCKED' });
        c.body = checkBody(body, 'EDIT');
        c.edited = true;
        c.version += 1; // identity (authorId/authorRole) never changes on edit
        this.log(c, 'edit', actor);
        return c;
    }
    /** Delete: ONLY doc author/creator. Returns unresolved count after. */
    remove(doc, actor, commentId) {
        const c = this.comments.get(commentId);
        if (!c || c.deleted)
            throw Object.assign(new Error('DELETE_BLOCKED: missing'), { code: 'DELETE_BLOCKED' });
        if (!canDeleteComment(actor, doc)) {
            throw Object.assign(new Error('DELETE_BLOCKED: only author/creator can delete'), { code: 'DELETE_BLOCKED' });
        }
        c.deleted = true;
        this.log(c, 'delete', actor);
        return this.count(doc.id);
    }
    resolve(doc, actor, commentId) {
        void doc;
        const c = this.comments.get(commentId);
        if (!c || c.deleted)
            throw Object.assign(new Error('RESOLVE_BLOCKED: missing'), { code: 'RESOLVE_BLOCKED' });
        c.resolved = true;
        this.log(c, 'resolve', actor);
        return this.count(doc.id);
    }
    /** Trackable trail for one comment (returns a copy; store history is append-only). */
    historyOf(commentId) {
        const c = this.comments.get(commentId);
        if (!c)
            throw Object.assign(new Error('HISTORY_BLOCKED: missing'), { code: 'HISTORY_BLOCKED' });
        return c.history.map(e => ({ ...e }));
    }
    /** Ordered thread listing with resolved/deleted filters and pagination. */
    list(docId, opts = {}) {
        const all = [...this.comments.values()].filter(c => c.docId === docId &&
            (opts.includeDeleted || !c.deleted) &&
            (opts.includeResolved || !c.resolved));
        const start = Math.max(0, opts.offset || 0);
        return opts.limit === undefined ? all.slice(start) : all.slice(start, start + Math.max(0, opts.limit));
    }
    /** Unresolved, non-deleted count for a doc (replies each count 1). */
    count(docId) {
        let n = 0;
        for (const c of this.comments.values()) {
            if (c.docId === docId && !c.deleted && !c.resolved)
                n += 1;
        }
        return n;
    }
    countByAuthor(docId, authorId) {
        let n = 0;
        for (const c of this.comments.values()) {
            if (c.docId === docId && !c.deleted && !c.resolved && c.authorId === authorId)
                n += 1;
        }
        return n;
    }
    unresolved(docId) {
        return [...this.comments.values()].filter(c => c.docId === docId && !c.deleted && !c.resolved);
    }
    /** Send for Review: warns when some comments still not resolved. */
    sendForReview(doc, actor) {
        void actor;
        const n = this.count(doc.id);
        return { warning: n > 0 ? exports.UNRESOLVED_WARNING : null, unresolvedCount: n };
    }
}
exports.CommentStore = CommentStore;
/** Resolve a dev role from X-Dev-Role header or ?devRole= query (no password). */
function resolveDevRole(headerValue, queryValue) {
    const raw = (typeof headerValue === 'string' && headerValue.trim() !== '' ? headerValue : queryValue);
    if (typeof raw !== 'string')
        return null;
    const norm = raw.trim().toLowerCase().replace(/[\s_]+/g, '_');
    const labels = Object.fromEntries(Object.entries(exports.DEV_ROLE_LABELS).map(([k, v]) => [v.toLowerCase(), k]));
    const legacy = {
        admin: 'org_admin', reviewer: 'review_approval', approver: 'review_approval',
        viewer: 'view_only', view: 'view_only', temp: 'temporary_view', temp_view: 'temporary_view',
        approver_reviewer: 'review_approval', 'approver/reviewer': 'review_approval',
    };
    if (exports.DEV_ROLES.includes(norm))
        return norm;
    if (labels[norm])
        return labels[norm];
    if (legacy[norm])
        return legacy[norm];
    return null;
}
