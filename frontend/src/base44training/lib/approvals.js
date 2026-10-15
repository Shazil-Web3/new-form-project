// Approval logic shared by the manager's Tasks page and the admin's "Approve myself" action.
// Each function applies one approved request (data changes + marking the request approved).
// `opts.self = true` records that the admin approved their own request (no manager review).
import { base44 } from '../base44Client';
import { quizCorrectAnswer, cleanQuestion } from './training';

// A decision is "self-approved" when the admin approves a request they sent themselves
// (either through "Approve myself" or by opening it later in Tasks).
const isSelf = (opts, requestedById, user) => !!opts.self || (!!requestedById && String(requestedById) === String(user?.id));

const decision = (user, selfApproved) => ({
  approver_id: user?.id || '',
  approver_name: user?.full_name || user?.email || '',
  decided_date: new Date().toISOString(),
  ...(selfApproved ? { self_approved: true } : {}),
});

async function applyChange(req) {
  const p = req.payload || {};
  if (req.target_type === 'class') {
    if (req.operation === 'delete') {
      if (req.class_id) await base44.entities.Class.delete(req.class_id);
    } else if (req.operation === 'add') {
      // Class was already created provisionally when the request was submitted.
      if (req.class_id) await base44.entities.Class.update(req.class_id, p);
    } else if (req.operation === 'edit' && req.class_id) {
      await base44.entities.Class.update(req.class_id, p);
    }
  } else if (req.target_type === 'quiz' && req.class_id) {
    let quiz = null;
    const existing = await base44.entities.Quiz.filter({ class_id: req.class_id });
    if (existing.length > 0) quiz = existing[0];
    else quiz = await base44.entities.Quiz.create({ title: `${req.class_title || 'Class'} Quiz`, class_id: req.class_id, passing_score: p.passing_score ?? 70 });
    if (p.passing_score != null) await base44.entities.Quiz.update(quiz.id, { passing_score: p.passing_score });
    const oldQs = await base44.entities.QuizQuestion.filter({ quiz_id: quiz.id });
    await Promise.all((oldQs.items || oldQs).map((q) => base44.entities.QuizQuestion.delete(q.id)));
    const newQs = (p.questions || []).map((q) => ({ quiz_id: quiz.id, ...q }));
    if (newQs.length > 0) await base44.entities.QuizQuestion.bulkCreate(newQs);
    await base44.entities.Class.update(req.class_id, { has_quiz: (p.questions || []).length > 0 });
  }
}

// Delete a curriculum's classes, their quizzes and quiz questions. Used when
// trashing an unpublished curriculum during specialty archival.
async function deleteCurriculumContent(curriculumId) {
  const clsPage = await base44.entities.Class.filter({ curriculum_id: curriculumId });
  const cls = clsPage.items || clsPage;
  for (const cl of cls) {
    const quizzesPage = await base44.entities.Quiz.filter({ class_id: cl.id });
    const quizzes = quizzesPage.items || quizzesPage;
    for (const qz of quizzes) {
      const qsPage = await base44.entities.QuizQuestion.filter({ quiz_id: qz.id });
      const qs = qsPage.items || qsPage;
      await Promise.all(qs.map((q) => base44.entities.QuizQuestion.delete(q.id)));
      await base44.entities.Quiz.delete(qz.id);
    }
    await base44.entities.Class.delete(cl.id);
  }
}

// Delete a single class's quiz and quiz questions. Used when a class archive
// is approved, permanently removing the archived copy.
async function deleteClassContent(classId) {
  const quizzesPage = await base44.entities.Quiz.filter({ class_id: classId });
  const quizzes = quizzesPage.items || quizzesPage;
  for (const qz of quizzes) {
    const qsPage = await base44.entities.QuizQuestion.filter({ quiz_id: qz.id });
    const qs = qsPage.items || qsPage;
    await Promise.all(qs.map((q) => base44.entities.QuizQuestion.delete(q.id)));
    await base44.entities.Quiz.delete(qz.id);
  }
}

export async function approveChangeRequest(req, user, opts = {}) {
    await applyChange(req);
    await base44.entities.ChangeRequest.update(req.id, {
      status: 'approved',
      ...decision(user, isSelf(opts, req.requested_by_id, user)),
    });
}

export async function approveArchiveRequest(req, user, opts = {}) {
    if (req.target_type === 'class') {
      // Permanently remove the archived class copy and its quiz.
      if (req.class_id) {
        const target = await base44.entities.Class.get(req.class_id).catch(() => null);
        if (target && !target.curriculum_id && !target.library_class_id) {
          // A library class is kept (hidden from lists) so admins can still view and restore it.
          await base44.entities.Class.update(req.class_id, { archived: false, archive_status: 'archived', archived_date: new Date().toISOString() });
        } else {
          await deleteClassContent(req.class_id);
          await base44.entities.Class.delete(req.class_id);
        }
      }
    } else if (req.target_type === 'specialty') {
      // Archive the specialty, archive its published curriculums, and move
      // any unpublished (draft) curriculums and their content to trash.
      const reason = req.reason || '';
      await base44.entities.FieldSpecialty.update(req.specialty_id, {
        status: 'archived',
        archive_reason: reason,
      });
      const curPage = await base44.entities.Curriculum.filter({ field_specialty_id: req.specialty_id });
      const curs = curPage.items || curPage;
      for (const cur of curs) {
        if (cur.status === 'published') {
          await base44.entities.Curriculum.update(cur.id, { status: 'archived', archive_reason: reason });
        } else if (cur.status !== 'archived') {
          await deleteCurriculumContent(cur.id);
          await base44.entities.Curriculum.delete(cur.id);
        }
      }
    } else {
      await base44.entities.Curriculum.update(req.curriculum_id, {
        status: 'archived',
        archive_reason: req.reason || '',
      });
    }
    await base44.entities.ArchiveRequest.update(req.id, {
      status: 'approved',
      ...decision(user, isSelf(opts, req.requested_by_id, user)),
    });
}

export async function approvePublishRequest(req, user, opts = {}) {
    // Finalize staged class changes for this curriculum: remove classes marked
    // for deletion and clear the pending flag on added/edited classes.
    const clsPage = await base44.entities.Class.filter({ curriculum_id: req.curriculum_id });
    const cls = clsPage.items || clsPage;
    const toDelete = cls.filter((c) => c.pending_operation === 'delete');
    const survivors = cls.filter((c) => c.pending_operation !== 'delete');
    // Mirror the master quiz (the single bank) to each copy that has a quiz,
    // so every curriculum copy carries its own instance of the approved quiz.
    await Promise.all(survivors.filter((c) => c.has_quiz && c.library_class_id).map(async (c) => {
      const masterQuizzes = await base44.entities.Quiz.filter({ class_id: c.library_class_id });
      const masterQuiz = (masterQuizzes.items || masterQuizzes)[0];
      if (!masterQuiz) return;
      const existing = await base44.entities.Quiz.filter({ class_id: c.id });
      const existingList = existing.items || existing;
      let liveQuiz = existingList[0];
      if (!liveQuiz) {
        liveQuiz = await base44.entities.Quiz.create({ title: masterQuiz.title || `${c.title} Quiz`, class_id: c.id, passing_score: masterQuiz.passing_score ?? 70 });
      } else {
        await base44.entities.Quiz.update(liveQuiz.id, { passing_score: masterQuiz.passing_score ?? 70, title: masterQuiz.title || liveQuiz.title });
      }
      const oldQs = await base44.entities.QuizQuestion.filter({ quiz_id: liveQuiz.id });
      await Promise.all((oldQs.items || oldQs).map((q) => base44.entities.QuizQuestion.delete(q.id)));
      const masterQs = await base44.entities.QuizQuestion.filter({ quiz_id: masterQuiz.id });
      const newQs = (masterQs.items || masterQs).map((q) => ({ quiz_id: liveQuiz.id, question_type: q.question_type, question: q.question, options: q.options, correct_index: q.correct_index, acceptable_answers: q.acceptable_answers, match_pairs: q.match_pairs }));
      if (newQs.length > 0) await base44.entities.QuizQuestion.bulkCreate(newQs);
    }));
    await Promise.all(toDelete.map((c) => base44.entities.Class.delete(c.id)));
    const toClear = survivors.filter((c) => (c.pending_operation && c.pending_operation !== 'none') || c.quiz_pending_update || c.pending_quiz_payload);
    if (toClear.length > 0) {
      await base44.entities.Class.bulkUpdate(toClear.map((c) => ({ id: c.id, pending_operation: 'none', quiz_pending_update: false, pending_quiz_payload: null })));
    }
    await base44.entities.Curriculum.update(req.curriculum_id, { status: 'published', last_published_date: new Date().toISOString(), has_unpublished_changes: false });
    // Snapshot this published version as a revision, linked to its approval.
    try {
      const cur = await base44.entities.Curriculum.get(req.curriculum_id);
      const revCount = await base44.entities.CurriculumRevision.count({ curriculum_id: req.curriculum_id });
      // Build a frozen class list for this revision so the history shows exactly
      // what was approved, not whatever the curriculum currently contains.
      const finalClasses = (clsPage.items || clsPage).filter((c) => c.pending_operation !== 'delete');
      const quizClassIds = finalClasses.filter((c) => c.has_quiz).map((c) => c.id);
      let quizByClass = {};
      if (quizClassIds.length > 0) {
        const qp = await base44.entities.Quiz.filter({ class_id: { $in: quizClassIds } });
        (qp.items || qp).forEach((q) => { quizByClass[q.class_id] = q; });
      }
      let countsByQuiz = {};
      let questionsByQuiz = {};
      const quizIds = Object.values(quizByClass).map((q) => q.id);
      if (quizIds.length > 0) {
        const agg = await base44.entities.QuizQuestion.aggregate({ query: { quiz_id: { $in: quizIds } }, groupBy: 'quiz_id' });
        (agg.rows || []).forEach((r) => { countsByQuiz[r.quiz_id] = r.count; });
        // Freeze the approved questions (with only the correct answer) into the
        // snapshot so each revision's history stays accurate even after later
        // edits re-publish the quiz.
        const qqPage = await base44.entities.QuizQuestion.filter({ quiz_id: { $in: quizIds } }, { sort: 'created_date' });
        (qqPage.items || qqPage).forEach((qq) => { (questionsByQuiz[qq.quiz_id] ||= []).push(qq); });
      }
      const classesSnapshot = finalClasses.map((c) => {
        const q = quizByClass[c.id];
        const qs = q ? (questionsByQuiz[q.id] || []) : [];
        return {
          title: c.title,
          content_type: c.content_type,
          type: c.type,
          description: c.description || '',
          duration_minutes: c.duration_minutes || 0,
          has_quiz: !!c.has_quiz,
          quiz_title: q?.title || '',
          quiz_passing_score: q?.passing_score ?? 70,
          quiz_question_count: countsByQuiz[q?.id] || 0,
          quiz_questions: qs.map((qq) => ({
            question: qq.question,
            question_type: qq.question_type,
            correct_answer: quizCorrectAnswer(qq),
          })),
        };
      });
      await base44.entities.CurriculumRevision.create({
        curriculum_id: req.curriculum_id,
        revision_number: revCount + 1,
        name: cur.name,
        description: cur.description || '',
        status: 'published',
        publish_request_id: req.id,
        classes_snapshot: classesSnapshot,
      });
    } catch {
      /* best effort — revision tracking must not block the publish */
    }
    await base44.entities.PublishRequest.update(req.id, {
      status: 'approved',
      ...decision(user, isSelf(opts, req.requested_by_id, user)),
    });
}

export async function approveBatchReviewRequest(review, user, opts = {}) {
    const batch = await base44.entities.LibraryBatch.get(review.batch_id);
    const changedItems = batch.changed_items || [];
    const hasCurriculum = !!review.curriculum_id; // a review without a curriculum approves a class that is not placed anywhere yet

    // The library class itself is now approved (it can be placed in curricula).
    for (const item of changedItems) {
      await base44.entities.Class.update(item.class_id, { library_approved: true });
    }

    // Archive the prior live state of each changed class as a revision, so the
    // Class Library history retains the superseded version. Done once per
    // batch (deduplicated by batch_id) since all copies share the same prior
    // content regardless of which curriculum's review is being approved.
    for (const item of changedItems) {
      const alreadyArchived = await base44.entities.ClassRevision.filter(
        { batch_id: batch.id, class_id: item.class_id },
        { limit: 1 }
      );
      if ((alreadyArchived.items || alreadyArchived).length > 0) continue;
      // The master class already holds the new content; copies still hold the
      // prior content, so read the prior state from any copy.
      const priorCopiesPage = await base44.entities.Class.filter(
        { library_class_id: item.class_id },
        { limit: 1 }
      );
      const priorCopies = priorCopiesPage.items || priorCopiesPage;
      if (priorCopies.length === 0) continue;
      const prior = priorCopies[0];
      const priorSnapshot = {
        title: prior.title,
        description: prior.description || '',
        content_type: prior.content_type,
        content_url: prior.content_url || '',
        document_id: prior.document_id || '',
        document_title: prior.document_title || '',
        available_timings: prior.available_timings || [],
        live_class_link: prior.live_class_link || '',
        live_class_date: prior.live_class_date || '',
        duration_minutes: prior.duration_minutes || 0,
        has_quiz: !!prior.has_quiz,
      };
      if (prior.has_quiz) {
        const qzPage = await base44.entities.Quiz.filter({ class_id: prior.id });
        const qz = (qzPage.items || qzPage)[0];
        if (qz) {
          const qsPage = await base44.entities.QuizQuestion.filter({ quiz_id: qz.id });
          priorSnapshot.quiz_snapshot = {
            passing_score: qz.passing_score ?? 70,
            questions: (qsPage.items || qsPage).map(cleanQuestion),
          };
        }
      }
      const revCount = await base44.entities.ClassRevision.count({ class_id: item.class_id });
      const master = await base44.entities.Class.get(item.class_id);
      await base44.entities.ClassRevision.create({
        class_id: item.class_id,
        class_title: prior.title,
        revision_number: revCount + 1,
        changed_by_id: user?.id || '',
        changed_by_name: user?.full_name || user?.email || '',
        change_note: master?.pending_change_note || 'Prior version archived on approval',
        batch_id: batch.id,
        snapshot: priorSnapshot,
      });
      // Clear the staged note now that the revision is recorded.
      await base44.entities.Class.update(item.class_id, { pending_change_note: '' });
    }

    // Roll out each changed library item to this curriculum's copy.
    for (const item of hasCurriculum ? changedItems : []) {
      const copiesPage = await base44.entities.Class.filter({
        library_class_id: item.class_id,
        curriculum_id: review.curriculum_id,
      });
      const copies = copiesPage.items || copiesPage;
      for (const copy of copies) {
        const cs = item.content_snapshot || {};
        await base44.entities.Class.update(copy.id, {
          title: cs.title ?? copy.title,
          description: cs.description ?? copy.description,
          content_type: cs.content_type ?? copy.content_type,
          content_url: cs.content_url ?? copy.content_url,
          document_id: cs.document_id !== undefined ? cs.document_id : copy.document_id,
          document_title: cs.document_title !== undefined ? cs.document_title : copy.document_title,
          available_timings: cs.available_timings ?? copy.available_timings,
          live_class_link: cs.live_class_link ?? copy.live_class_link,
          live_class_date: cs.live_class_date ?? copy.live_class_date,
          duration_minutes: cs.duration_minutes ?? copy.duration_minutes,
          certificate_validity_months: cs.certificate_validity_months !== undefined ? cs.certificate_validity_months : copy.certificate_validity_months,
          retraining_interval_months: cs.retraining_interval_months !== undefined ? cs.retraining_interval_months : copy.retraining_interval_months,
          has_quiz: cs.has_quiz ?? copy.has_quiz,
        });

        // Apply quiz snapshot if the batch includes quiz changes for this class.
        if (item.quiz_snapshot) {
          const qs = item.quiz_snapshot;
          let quiz = null;
          const existing = await base44.entities.Quiz.filter({ class_id: copy.id });
          const existingList = existing.items || existing;
          if (existingList.length > 0) {
            quiz = existingList[0];
            if (qs.passing_score != null) {
              await base44.entities.Quiz.update(quiz.id, { passing_score: qs.passing_score });
            }
          } else {
            quiz = await base44.entities.Quiz.create({
              title: `${cs.title || copy.title} Quiz`,
              class_id: copy.id,
              passing_score: qs.passing_score ?? 70,
            });
          }
          const oldQs = await base44.entities.QuizQuestion.filter({ quiz_id: quiz.id });
          await Promise.all((oldQs.items || oldQs).map((q) => base44.entities.QuizQuestion.delete(q.id)));
          const newQs = (qs.questions || []).map((q) => ({ quiz_id: quiz.id, ...q }));
          if (newQs.length > 0) await base44.entities.QuizQuestion.bulkCreate(newQs);
        }

        // Reset progress on this class so learners retrain on the changed material only.
        await base44.entities.ClassProgress.updateMany(
          { class_id: copy.id },
          { $set: { status: 'not_started', progress_percent: 0, completed_date: null, quiz_score: null, quiz_passed: null } }
        );
      }
    }

    // Record a curriculum revision entry for this library batch rollout.
    try {
      if (!hasCurriculum) throw new Error('no curriculum');
      const cur = await base44.entities.Curriculum.get(review.curriculum_id);
      const revCount = await base44.entities.CurriculumRevision.count({ curriculum_id: review.curriculum_id });
      await base44.entities.CurriculumRevision.create({
        curriculum_id: review.curriculum_id,
        revision_number: revCount + 1,
        name: cur.name,
        description: `Library batch update: ${changedItems.map((i) => i.class_title).join(', ')}`,
        status: cur.status,
        classes_snapshot: [],
      });
    } catch { /* best effort */ }

    await base44.entities.LibraryBatchReview.update(review.id, {
      status: 'approved',
      ...decision(user, isSelf(opts, batch.requested_by_id, user)),
      rolled_out: true,
    });

    // Mark the batch completed when every affected curriculum has been decided.
    const allReviewsPage = await base44.entities.LibraryBatchReview.filter({ batch_id: batch.id });
    const allReviews = allReviewsPage.items || allReviewsPage;
    const allDecided = allReviews.every((r) => r.status === 'approved' || r.status === 'rejected');
    if (allDecided) {
      await base44.entities.LibraryBatch.update(batch.id, { status: 'completed' });
    }
}
