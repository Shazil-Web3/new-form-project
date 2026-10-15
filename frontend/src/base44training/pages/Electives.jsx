import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '../base44Client';
import { getCurrentUser, addWeeks, toISODate, formatDate, REQUIRED_WEEKS } from '../lib/training';
import { Button } from '../components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '../components/ui/dialog';
import { Compass, BookOpen, FileText, Video, Radio, ListChecks, Plus, CheckCircle2, PlayCircle } from 'lucide-react';

const typeIcon = { pdf: FileText, on_demand_video: Video, live_class: Radio, linked_document: FileText };

export default function Electives() {
  const [user, setUser] = useState(null);
  const [curriculums, setCurriculums] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(null); // curriculum being enrolled
  const [dueDate, setDueDate] = useState(toISODate(addWeeks(new Date(), REQUIRED_WEEKS)));

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      setUser(me);
      if (!me) { setLoading(false); return; }
      const [curs, classes, assign] = await Promise.all([
        base44.entities.Curriculum.list(),
        base44.entities.Class.list(),
        base44.entities.Assignment.filter({ employee_id: me.id }),
      ]);
      setCurriculums(curs.filter((c) => c.type === 'elective'));
      setAllClasses(classes);
      setMyAssignments(assign);
      setLoading(false);
    })();
  }, []);

  async function enroll(cur) {
    await base44.entities.Assignment.create({
      employee_id: user.id,
      employee_name: user.full_name || user.email || '',
      curriculum_id: cur.id,
      curriculum_name: cur.name,
      assignment_type: 'elective',
      assigned_by_id: user.id,
      due_date: dueDate,
      status: 'assigned',
      extensions_used: 0,
    });
    const assign = await base44.entities.Assignment.filter({ employee_id: user.id });
    setMyAssignments(assign);
    setEnrolling(null);
  }

  async function enrollClass(cl) {
    await base44.entities.Assignment.create({
      employee_id: user.id,
      employee_name: user.full_name || user.email || '',
      curriculum_id: cl.curriculum_id,
      curriculum_name: cl.curriculum_name || '',
      class_id: cl.id,
      class_name: cl.title,
      assignment_type: 'elective',
      assigned_by_id: user.id,
      due_date: toISODate(addWeeks(new Date(), REQUIRED_WEEKS)),
      status: 'assigned',
      extensions_used: 0,
    });
    const assign = await base44.entities.Assignment.filter({ employee_id: user.id });
    setMyAssignments(assign);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /></div>;
  }

  const enrolledIds = new Set(myAssignments.filter((a) => a.assignment_type === 'elective' && a.curriculum_id).map((a) => a.curriculum_id));
  const enrolledClassIds = new Set(myAssignments.filter((a) => a.assignment_type === 'elective' && a.class_id).map((a) => a.class_id));
  const electiveClasses = allClasses.filter((cl) => cl.type === 'elective');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Browse Electives</h1>
        <p className="text-sm text-slate-500">Enroll in elective curriculums to expand your skills. Due dates can be extended up to 3 times.</p>
      </div>

      {curriculums.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Compass className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500">No electives available yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {curriculums.map((c) => {
            const classes = allClasses.filter((cl) => cl.curriculum_id === c.id);
            const enrolled = enrolledIds.has(c.id);
            return (
              <div key={c.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <p className="font-medium text-slate-900">{c.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.description || 'No description'}</p>
                <p className="mt-2 text-xs text-slate-400">{classes.length} class{classes.length !== 1 ? 'es' : ''}</p>

                <div className="mt-4 flex-1 space-y-1.5">
                  {classes.slice(0, 3).map((cl) => {
                    const CIcon = typeIcon[cl.content_type] || FileText;
                    return (
                      <div key={cl.id} className="flex items-center gap-2 text-xs text-slate-500">
                        <CIcon className="h-3.5 w-3.5" /> {cl.title}
                        {cl.has_quiz && <ListChecks className="h-3 w-3 text-violet-500" />}
                      </div>
                    );
                  })}
                  {classes.length > 3 && <p className="text-xs text-slate-400">+{classes.length - 3} more</p>}
                </div>

                <div className="mt-4">
                  {enrolled ? (
                    <Link to="/training/my-training">
                      <Button variant="outline" className="w-full">
                        <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-500" /> Enrolled — Go to training
                      </Button>
                    </Link>
                  ) : (
                    <Button onClick={() => { setEnrolling(c); setDueDate(toISODate(addWeeks(new Date(), REQUIRED_WEEKS))); }} className="w-full">
                      <Plus className="mr-1.5 h-4 w-4" /> Enroll
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {electiveClasses.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Individual Elective Classes</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {electiveClasses.map((cl) => {
              const enrolled = enrolledClassIds.has(cl.id);
              const CIcon = typeIcon[cl.content_type] || FileText;
              return (
                <div key={cl.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <CIcon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">{cl.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{cl.description || 'No description'}</p>
                  <p className="mt-1 text-xs text-slate-400">{cl.curriculum_name}</p>
                  <div className="mt-3">
                    {enrolled ? (
                      <Link to="/training/my-training">
                        <Button variant="outline" size="sm" className="w-full">
                          <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-500" /> Enrolled
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => enrollClass(cl)}>
                        <Plus className="mr-1.5 h-4 w-4" /> Enroll
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!enrolling} onOpenChange={(o) => !o && setEnrolling(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enroll in {enrolling?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Set your target completion date. You can extend it up to 3 times.</p>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <p className="text-xs text-slate-400">Default: {formatDate(addWeeks(new Date(), REQUIRED_WEEKS))}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => enroll(enrolling)}>Enroll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}