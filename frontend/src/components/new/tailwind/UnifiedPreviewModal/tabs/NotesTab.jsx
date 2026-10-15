/**
 * @file NotesTab.jsx
 * @description Displays and manages feedback notes thread for templates and documents.
 * @dependencies react, prop-types, api/documents, api/templates
 * @author Codegen
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getDocumentNotes, createDocumentNote } from '../../../../../api/documents';
import { getTemplateNotes, createTemplateNote } from '../../../../../api/templates';
import { successAlert, errorAlert } from '../../../../../utils/alerts';

export default function NotesTab({ item, isDocument }) {
  const [notesList, setNotesList] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const itemId = item?.id || item?.document_id;

  const fetchNotes = async () => {
    if (!itemId && !item?.notes) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let data = [];
      if (itemId) {
        data = isDocument
          ? await getDocumentNotes(itemId)
          : await getTemplateNotes(itemId);
      }
      
      let list = Array.isArray(data) ? [...data] : [];

      if (item?.notes) {
        try {
          const raw = item.notes;
          const parsed = typeof raw === 'string' && (raw.trim().startsWith('[') || raw.trim().startsWith('{')) 
            ? JSON.parse(raw.trim()) 
            : (Array.isArray(raw) ? raw : null);
          
          if (Array.isArray(parsed)) {
            const mapped = parsed.map(n => ({
              id: n.id,
              user_name: n.user?.email || n.user?.name || 'User',
              user_email: n.user?.email || '',
              content: n.text || n.content || '',
              created_at: n.timestamp || new Date().toISOString()
            }));
            
            const existingContents = new Set(list.map(l => l.content));
            mapped.forEach(m => {
              if (m.content && !existingContents.has(m.content)) {
                list.push(m);
              }
            });
          } else if (typeof raw === 'string' && raw.trim() && !raw.trim().startsWith('[') && !raw.trim().startsWith('{')) {
            if (!list.some(l => l.content === raw.trim())) {
              list.push({
                id: 'legacy-note',
                user_name: 'Author / Editor',
                user_email: '',
                content: raw.trim(),
                created_at: item.created_at || new Date().toISOString()
              });
            }
          }
        } catch (e) {
          console.warn('Error parsing item.notes:', e);
        }
      }

      setNotesList(list);
    } catch (e) {
      console.error('Error fetching notes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [itemId, isDocument, item?.notes]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      setSaving(true);
      if (isDocument) {
        await createDocumentNote(itemId, newNote);
      } else {
        await createTemplateNote(itemId, newNote);
      }
      setNewNote('');
      successAlert('Note Added', 'Feedback note posted successfully.');
      await fetchNotes();
    } catch (e) {
      errorAlert('Error', 'Failed to save notes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-5 select-none h-full flex flex-col min-h-[350px]">
      <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-3 shrink-0">
        <span className="material-symbols-outlined text-[18px] text-blue-700">rate_review</span>
        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">Feedback Notes Thread</h4>
      </div>

      {/* Notes List Container */}
      <div className="flex-1 overflow-y-auto max-h-[280px] pr-1 space-y-3.5 min-h-[150px]">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-on-surface-variant/60 font-semibold text-xs">
            <span className="material-symbols-outlined animate-spin text-sm">sync</span>
            <span>Loading feedback thread...</span>
          </div>
        ) : notesList.length > 0 ? (
          notesList.map((note) => {
            const initial = (note.user_name || 'U').charAt(0).toUpperCase();
            return (
              <div key={note.id} className="flex gap-3 bg-surface-container-low border border-outline-variant/30 rounded-xl p-3.5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-bold text-xs shrink-0 select-none">
                  {initial}
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant/80 font-bold select-none">
                    <span className="truncate">{note.user_name || 'Unknown User'}</span>
                    <span>{new Date(note.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-body-sm text-on-surface leading-relaxed font-semibold break-words whitespace-pre-line select-text">
                    {note.content}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-2 bg-surface-container-low rounded-xl border border-dashed border-outline-variant/50">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">edit_note</span>
            <p className="text-body-sm text-on-surface-variant/60 font-semibold">No feedback notes posted yet.</p>
          </div>
        )}
      </div>

      {/* Note Input Field */}
      <div className="space-y-3 pt-3 border-t border-outline-variant/20 shrink-0">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a feedback note to this thread..."
          className="w-full min-h-[90px] max-h-[140px] p-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 text-body-sm text-on-surface font-semibold"
        />
        <div className="flex justify-end">
          <button
            onClick={handleAddNote}
            disabled={saving || !newNote.trim()}
            className="p-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs h-9 px-4.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <span className="material-symbols-outlined text-md animate-spin">sync</span>
            ) : (
              <span className="material-symbols-outlined text-md">send</span>
            )}



          </button>
        </div>
      </div>
    </div>
  );
}

NotesTab.propTypes = {
  item: PropTypes.object.isRequired,
  isDocument: PropTypes.bool,
};
