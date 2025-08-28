import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useQuery } from '@tanstack/react-query';


export interface EditableTemplate { subject: string; content: string; }

interface TemplateReviewModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTemplates: EditableTemplate[];
  initialSubjectLines?: string[];
  campaignId?: string;
  numberOfTemplates?: number;
  daysBetweenMessages?: number;
  onSaved: (templates: EditableTemplate[], subjectLines?: string[]) => void;
}

export default function TemplateReviewModal({
  open,
  onOpenChange,
  initialTemplates,
  initialSubjectLines = [],
  campaignId,
  numberOfTemplates,
  daysBetweenMessages,
  onSaved
}: TemplateReviewModalProps) {
  const [templates, setTemplates] = useState<EditableTemplate[]>(initialTemplates);
  const [subjects, setSubjects] = useState<string[]>(initialSubjectLines);
  const { data: agentConfigs } = useQuery({ queryKey: ['/api/ai-agent-configs'] });
  const [agentPreviewId, setAgentPreviewId] = useState<string | ''>('');

  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [openPreviews, setOpenPreviews] = useState<Set<number>>(new Set());

  const togglePreview = (i: number) => {
    setOpenPreviews(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const renderPreview = (content: string) => {
    // Optional: simulate tone/personality by annotating preview header
    const agentLabel = Array.isArray(agentConfigs)
      ? (agentConfigs.find((a: any) => a.id === agentPreviewId)?.name || (agentPreviewId ? 'Selected Agent' : 'Active Agent'))
      : (agentPreviewId ? 'Selected Agent' : 'Active Agent');

    const sample = content
      .replace(/\[Name\]/gi, 'John')
      .replace(/\[vehicleInterest\]/gi, '2025 Toyota Prius')
      .replace(/\n/g, '\n')
      .trim();
    const header = `<div class='text-xs text-gray-500 mb-2'>Previewing as: ${agentLabel}</div>`;
    const lines = sample.split(/\n+/).map((l, i) => `<p key="l-${i}" class='mb-2 leading-relaxed'>${l.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`).join('');
    return { __html: header + lines };
  };

  useEffect(() => {
    if (open) {
      setTemplates(initialTemplates);
      setSubjects(initialSubjectLines);
      setDirty(false);
    }
  }, [open, initialTemplates, initialSubjectLines]);

  const updateTemplate = (idx: number, patch: Partial<EditableTemplate>) => {
    setTemplates(t => t.map((tpl, i) => i === idx ? { ...tpl, ...patch } : tpl));
    setDirty(true);
  };

  const addTemplate = () => {
    setTemplates(t => [...t, { subject: 'New Subject', content: 'Hi [Name], ...' }]);
    setDirty(true);
  };

  const removeTemplate = (idx: number) => {
    setTemplates(t => t.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const addSubject = () => { setSubjects(s => [...s, 'New subject line']); setDirty(true); };
  const updateSubject = (i: number, val: string) => { setSubjects(s => s.map((v, idx) => idx === i ? val : v)); setDirty(true); };
  const removeSubject = (i: number) => { setSubjects(s => s.filter((_, idx) => idx !== i)); setDirty(true); };

  const handleSave = async () => {
    if (!campaignId) { onSaved(templates, subjects); setDirty(false); return; }
    try {
      setIsSaving(true);
      const res = await fetch(`/api/campaigns/${campaignId}/templates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates, subjectLines: subjects, numberOfTemplates: templates.length, daysBetweenMessages })
      });
      if (!res.ok) throw new Error('save failed');
      onSaved(templates, subjects);
      setDirty(false);
      onOpenChange(false);
    } catch (e) {
      console.error('Save templates failed', e);
      // Basic alert fallback (replace with toast if available in parent scope)
      alert('Failed to save templates.');
    } finally {
      setIsSaving(false);
    }
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Preview agent:</label>
              <select
                className="border rounded px-2 py-1 text-xs"
                value={agentPreviewId}
                onChange={(e) => setAgentPreviewId(e.target.value)}
              >
                <option value="">Active Agent</option>
                {Array.isArray(agentConfigs) && agentConfigs.map((cfg: any) => (
                  <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
                ))}
              </select>
            </div>

  };

  return (
    <Dialog open={open} onOpenChange={v => !isSaving && onOpenChange(v)}>
      <DialogContent className="max-w-4xl h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">Review & Edit Email Templates</DialogTitle>
          <p className="text-xs text-muted-foreground">Make any adjustments before launch. Personalization tokens like [Name] and [vehicleInterest] will be replaced automatically.</p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm tracking-wide text-gray-700 uppercase">Templates ({templates.length})</h3>
              <Button size="sm" variant="outline" onClick={addTemplate}>Add Template</Button>
            </div>
            <div className="space-y-4">
              {templates.map((tpl, i) => (
                <div key={i} className="border rounded p-3 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500">Template {i+1}</span>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => togglePreview(i)}>
                        {openPreviews.has(i) ? 'Hide Preview' : 'Preview'}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeTemplate(i)} disabled={templates.length <= 1}>Remove</Button>
                    </div>
                  </div>
                  <Input
                    value={tpl.subject}
                    onChange={e => updateTemplate(i, { subject: e.target.value })}
                    placeholder="Subject"
                    className="mb-2"
                  />
                  <Textarea
                    value={tpl.content}
                    onChange={e => updateTemplate(i, { content: e.target.value })}
                    className="min-h-[160px] text-sm"
                  />
                  {openPreviews.has(i) && (
                    <div className="mt-3 border rounded bg-gray-50 p-3 text-sm">
                      <div className="text-xs font-medium text-gray-500 mb-2">Rendered Preview (sample tokens applied)</div>
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={renderPreview(tpl.content)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between mb-2 mt-6">
              <h3 className="font-medium text-sm tracking-wide text-gray-700 uppercase">Subject Line Variations ({subjects.length})</h3>
              <Button size="sm" variant="outline" onClick={addSubject}>Add Subject</Button>
            </div>
            <div className="space-y-2">
              {subjects.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={s} onChange={e => updateSubject(i, e.target.value)} className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => removeSubject(i)}>✕</Button>
                </div>
              ))}
              {subjects.length === 0 && <div className="text-xs text-muted-foreground">No alternates yet.</div>}
            </div>
          </section>
        </div>
        <div className="flex justify-between items-center pt-3 border-t mt-3 gap-4">
          <div className="text-xs text-muted-foreground">{dirty ? 'Unsaved changes' : 'All changes saved'}{isSaving && ' · Saving...'}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>Close</Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !templates.length}>{isSaving ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
