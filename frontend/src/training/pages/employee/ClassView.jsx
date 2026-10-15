import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { message } from 'antd';
import { BackLink, EmptyState } from '../../components/common';
import { downloadCertificate } from '../../certificate';
import Modal from '../../components/Modal';
import apiClient from '../../../api/apiClient';
import { useTrainingContext } from '../../context';
import { formatDateTime } from '../../dates';
import { progressOfClass, questionsOf, quizOf } from '../../selectors';
import { trainingService, useTrainingState } from '../../store';
import { CONTENT_TYPES, ui } from '../../theme';

// Uploaded files live outside any public/static folder, so they're only reachable through
// an authenticated route — fetch it as a blob (the auth header rides along automatically)
// and hand the viewer a local object URL, the same pattern the Documents/Tasks attachment
// viewers already use elsewhere in the app.
function useClassFileUrl(classId, enabled) {
  const [fileUrl, setFileUrl] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let objectUrl;
    let cancelled = false;
    apiClient
      .get(`/api/training/classes/${classId}/content`, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setFileUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFileUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [classId, enabled]);
  return fileUrl;
}

function AcknowledgeModal({ open, onClose, onAcknowledge }) {
  return (
    <Modal open={open} title="Before you continue" onClose={onClose} width="max-w-sm">
      <p className="text-sm text-slate-600">Please review the material above, then confirm below.</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ui.btnLight}>
          Cancel
        </button>
        <button type="button" onClick={onAcknowledge} className={ui.btnDark}>
          I have read and understood the material
        </button>
      </div>
    </Modal>
  );
}

function RatingWidget({ current, onRate }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-sm text-slate-500">{current ? 'Your rating' : 'How was this class?'}</span>
      <div className="flex" role="group" aria-label="Rate this class">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onRate(value)}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            className={`material-symbols-outlined text-[26px] transition ${value <= (current || 0) ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
            style={{ fontVariationSettings: value <= (current || 0) ? "'FILL' 1" : "'FILL' 0" }}
          >
            star
          </button>
        ))}
      </div>
    </div>
  );
}

const videoEmbed = (url) => {
  const youtube = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (youtube) return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url) || url.startsWith('blob:')) return { kind: 'video', src: url };
  return { kind: 'link', src: url };
};

function FileContent({ entry }) {
  const fileUrl = useClassFileUrl(entry.id, Boolean(entry.content_url));
  const name = entry.content_name || entry.content_url || '';
  const isImage = /\.(png|jpe?g|gif)(\?.*)?$/i.test(name);
  // Browsers can render PDFs and images inline — everything else (Word/PPT/Excel) can't be
  // opened in a tab, so those download instead.
  const isPdf = entry.content_type === 'pdf' || /\.pdf(\?.*)?$/i.test(name);
  const viewableInline = isImage || isPdf;

  if (!fileUrl) {
    return <div className={`${ui.card} px-6 py-10 text-center text-sm text-slate-400`}>Loading…</div>;
  }

  if (isPdf) {
    return (
      <div className={`${ui.card} overflow-hidden`}>
        <iframe title={entry.title} src={fileUrl} className="h-[70vh] w-full" />
        <div className="border-t border-slate-100 px-4 py-2 text-right">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={ui.link}>
            Open in a new tab
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`${ui.card} overflow-hidden`}>
      {isImage ? (
        <img src={fileUrl} alt={entry.title} className="max-h-[70vh] w-full object-contain bg-slate-50" />
      ) : (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="material-symbols-outlined text-[40px] text-slate-400">attach_file</span>
          <div className="text-sm font-medium text-slate-700">{entry.content_name || 'Document'}</div>
        </div>
      )}
      <div className="border-t border-slate-100 px-4 py-2 text-right">
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={viewableInline ? undefined : entry.content_name || true} className={ui.link}>
          {viewableInline ? 'Open in a new tab' : 'Download / Open file'}
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
        </a>
      </div>
    </div>
  );
}

function ContentArea({ entry }) {
  if (entry.content_type === 'live') {
    const when = formatDateTime(entry.live_class_date);
    return (
      <div className={`${ui.card} p-6`}>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] text-amber-500">sensors</span>
          <div>
            <div className="font-semibold text-slate-900">{when ? `Scheduled for ${when}` : 'No date has been scheduled yet.'}</div>
            <div className="text-sm text-slate-500">Join the session at the scheduled time.</div>
          </div>
        </div>
        {entry.live_class_link ? (
          <a href={entry.live_class_link} target="_blank" rel="noopener noreferrer" className={`${ui.btnDark} mt-4`}>
            <span className="material-symbols-outlined text-[20px]">videocam</span>
            Join live class
          </a>
        ) : null}
      </div>
    );
  }

  if (entry.content_type === 'linked_document') {
    if (!entry.linked_document) {
      return <div className={`${ui.card} px-6 py-10 text-center text-sm text-slate-400`}>This class's linked document isn't published yet.</div>;
    }
    return (
      <div className={`${ui.card} p-6`}>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] text-amber-500">link</span>
          <div>
            <div className="font-semibold text-slate-900">{entry.linked_document.title}</div>
            <div className="text-sm text-slate-500">Version {entry.linked_document.version} · updates automatically when republished</div>
          </div>
        </div>
        <a href={`/document/${entry.linked_document.id}?view=reference`} target="_blank" rel="noopener noreferrer" className={`${ui.btnDark} mt-4`}>
          <span className="material-symbols-outlined text-[20px]">open_in_new</span>
          Open Document
        </a>
      </div>
    );
  }

  if (!entry.content_url) {
    return <div className={`${ui.card} px-6 py-10 text-center text-sm text-slate-400`}>No content uploaded for this class yet.</div>;
  }

  if (entry.content_type === 'pdf' || entry.content_type === 'document') {
    return <FileContent entry={entry} />;
  }

  const embed = videoEmbed(entry.content_url);
  if (embed.kind === 'iframe') {
    return (
      <div className={`${ui.card} overflow-hidden`}>
        <iframe title={entry.title} src={embed.src} allowFullScreen className="aspect-video w-full" />
      </div>
    );
  }
  if (embed.kind === 'video') {
    return (
      <div className={`${ui.card} overflow-hidden`}>
        <video controls src={embed.src} className="aspect-video w-full bg-black" />
      </div>
    );
  }
  return (
    <div className={`${ui.card} p-6`}>
      <a href={embed.src} target="_blank" rel="noopener noreferrer" className={ui.btnDark}>
        <span className="material-symbols-outlined text-[20px]">play_circle</span>
        Open video
      </a>
    </div>
  );
}

export default function ClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const state = useTrainingState();
  const { persona } = useTrainingContext();
  // What the learner clicked and is confirming they've read the material for —
  // 'complete' or 'quiz' — not yet acted on until they acknowledge the modal.
  const [pendingAction, setPendingAction] = useState(null);

  const entry = state.classes.find((item) => item.id === classId);
  const enrolled = entry && state.assignments.some((item) => item.employee_id === persona.id && item.curriculum_id === entry.curriculum_id);

  useEffect(() => {
    if (entry && enrolled) trainingService.openClass(persona.id, classId);
  }, [entry, enrolled, persona.id, classId]);

  useEffect(() => {
    setPendingAction(null);
  }, [classId]);

  // Time-spent log: while this class page is open and visible, report elapsed seconds
  // every 30s (and once more on leaving) so the Reports page can show time per class.
  const lastBeat = useRef(Date.now());
  useEffect(() => {
    if (!entry || !enrolled) return undefined;
    lastBeat.current = Date.now();
    const flush = () => {
      const seconds = Math.round((Date.now() - lastBeat.current) / 1000);
      lastBeat.current = Date.now();
      if (seconds > 0 && document.visibilityState === 'visible') trainingService.logClassTime(classId, seconds).catch(() => {});
    };
    const timer = setInterval(flush, 30000);
    return () => {
      clearInterval(timer);
      flush();
    };
  }, [entry?.id, enrolled, classId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return <Navigate to="/training/my-training" replace />;

  if (!enrolled) {
    return (
      <div className={ui.narrow}>
        <BackLink to="/training/my-training" />
        <EmptyState icon="lock" message="You are not enrolled in the curriculum this class belongs to." actionLabel="Browse electives" actionTo="/training/electives" />
      </div>
    );
  }

  const prerequisite = entry.prerequisite_class_id ? state.classes.find((item) => item.id === entry.prerequisite_class_id) : null;
  const prerequisiteDone = !prerequisite || progressOfClass(state, persona.id, prerequisite.id)?.status === 'completed';
  if (prerequisite && !prerequisiteDone) {
    return (
      <div className={ui.narrow}>
        <BackLink to="/training/my-training" />
        <EmptyState icon="lock" message={`Complete "${prerequisite.title}" first to unlock this class.`} />
      </div>
    );
  }

  const quiz = entry.has_quiz ? quizOf(state, entry.id) : null;
  const questionCount = quiz ? questionsOf(state, quiz.id).length : 0;
  const attemptsExhausted = Boolean(quiz?.max_attempts) && quiz.attempts_used >= quiz.max_attempts;
  const record = progressOfClass(state, persona.id, entry.id);
  const completed = record?.status === 'completed';

  return (
    <div className={ui.narrow}>
      <BackLink to="/training/my-training" />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
        <span className="material-symbols-outlined text-[14px]">{CONTENT_TYPES[entry.content_type]?.icon}</span>
        {CONTENT_TYPES[entry.content_type]?.short}
      </span>
      <h1 className={`${ui.title} mt-3`}>{entry.title}</h1>
      {entry.description ? <p className={ui.subtitle}>{entry.description}</p> : null}

      <div className="mt-6">
        <ContentArea entry={entry} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {entry.has_quiz ? (
          <button
            type="button"
            disabled={attemptsExhausted}
            onClick={() => setPendingAction('quiz')}
            className={`${ui.btnDark} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="material-symbols-outlined text-[20px]">checklist</span>
            {attemptsExhausted ? 'No attempts left' : 'Take Quiz'}
          </button>
        ) : null}
        {!entry.has_quiz || questionCount === 0 ? (
          <button
            type="button"
            disabled={completed}
            onClick={() => setPendingAction('complete')}
            className={entry.has_quiz ? ui.btnLight : ui.btnDark}
          >
            <span className="material-symbols-outlined text-[20px]">task_alt</span>
            {completed ? 'Completed' : 'Mark as complete'}
          </button>
        ) : null}
        {completed ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            {record?.quiz_score !== null && record?.quiz_score !== undefined ? `Completed · Quiz ${record.quiz_score}%` : 'Completed'}
          </span>
        ) : null}
      </div>

      {completed && record?.certificate ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => downloadCertificate(persona.name, entry.title, record.certificate)}
            className={ui.btnLight}
          >
            <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
            Download certificate
          </button>
        </div>
      ) : null}

      {completed ? (
        <RatingWidget
          current={record?.rating}
          onRate={async (value) => {
            try {
              await trainingService.rateClass(entry.id, value);
              message.success('Thanks for your feedback', 1.5);
            } catch (error) {
              message.error(error?.response?.data?.error || 'Could not save your rating');
            }
          }}
        />
      ) : null}

      <AcknowledgeModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onAcknowledge={() => {
          if (pendingAction === 'quiz') navigate(`/training/quiz/${entry.id}`);
          if (pendingAction === 'complete') {
            trainingService.markClassComplete(persona.id, entry.id);
            message.success('Class marked as complete');
          }
          setPendingAction(null);
        }}
      />
    </div>
  );
}
