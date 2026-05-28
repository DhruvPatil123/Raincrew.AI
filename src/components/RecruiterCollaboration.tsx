import React, { useState, useEffect } from 'react';
import { 
  Lock, Unlock, MessageSquare, Plus, Trash2, User, Tag, 
  Sparkles, Eye, EyeOff, Send, MessageCircle, CheckCircle, 
  Users, AlertCircle, Bookmark, ShieldAlert, BadgeInfo 
} from 'lucide-react';
import { Candidate, CandidateComment } from '../types';
import { 
  getRecruiterCandidateNotes, 
  addRecruiterCandidateNote, 
  updateCandidateEvaluation 
} from '../lib/storage';

interface RecruiterCollaborationProps {
  candidate: Candidate;
  onRefreshCandidateData: (updatedCandidate: Candidate) => void;
  isAnonymousMode?: boolean;
}

export default function RecruiterCollaboration({
  candidate,
  onRefreshCandidateData,
  isAnonymousMode = false
}: RecruiterCollaborationProps) {
  // --- PRIVATE RECRUITER NOTES STUFF (Backend synced) ---
  const [privateNotes, setPrivateNotes] = useState<string[]>([]);
  const [newPrivateNote, setNewPrivateNote] = useState('');
  const [isPrivateNotesLoading, setIsPrivateNotesLoading] = useState(false);
  const [isNotesLocked, setIsNotesLocked] = useState(true); // Masked/Hidden preview toggle for screen shares

  // --- TEAM COMMENTS STUFF (Candidate object synced) ---
  const [teamComments, setTeamComments] = useState<CandidateComment[]>(candidate.recruiterComments || []);
  const [newCommentText, setNewCommentText] = useState('');
  const [commenterName, setCommenterName] = useState('Eleanor Vance');
  const [commenterRole, setCommenterRole] = useState<'Recruiter' | 'Hiring Manager' | 'Lead Engineer' | 'Team Member'>('Recruiter');
  
  // Tag annotations list helper
  const availableAnnotations = [
    { label: 'Ideal Match', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Strong Tech Depth', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { label: 'Stellar Communication', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Pacing Check', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Requires Live Call', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { label: 'Role Mismatch', color: 'bg-rose-50 text-rose-700 border-rose-200' }
  ];
  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([]);

  // Load private notes (confidential API synced)
  useEffect(() => {
    loadPrivateNotes();
  }, [candidate.id]);

  // Sync team comments if candidate changes
  useEffect(() => {
    setTeamComments(candidate.recruiterComments || []);
  }, [candidate.recruiterComments]);

  const loadPrivateNotes = async () => {
    setIsPrivateNotesLoading(true);
    try {
      const notes = await getRecruiterCandidateNotes(candidate.id);
      setPrivateNotes(notes);
    } catch (e) {
      console.error('Failed to grab backend private notes:', e);
    } finally {
      setIsPrivateNotesLoading(false);
    }
  };

  const handleAddPrivateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrivateNote.trim()) return;

    try {
      // Formatted with prompt username "Eleanor Vance" but editable or customizable
      const notes = await addRecruiterCandidateNote(candidate.id, newPrivateNote.trim());
      setPrivateNotes(notes);
      setNewPrivateNote('');
    } catch (e) {
      console.error('Failed to submit private note:', e);
    }
  };

  const handleAddTeamComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: CandidateComment = {
      id: `comm-${Date.now()}`,
      author: commenterName.trim() || 'Anonymous Reviewer',
      role: commenterRole,
      text: newCommentText.trim(),
      timestamp: new Date().toISOString(),
      annotations: selectedAnnotations.length > 0 ? [...selectedAnnotations] : undefined
    };

    const updatedComments = [...teamComments, newComment];
    setTeamComments(updatedComments);
    
    // Save to the Candidate record itself using existing PUT request
    const updatedCandidate = updateCandidateEvaluation(candidate.id, {
      recruiterComments: updatedComments
    });

    if (updatedCandidate) {
      onRefreshCandidateData(updatedCandidate);
    }

    setNewCommentText('');
    setSelectedAnnotations([]);
  };

  const handleDeleteTeamComment = (commentId: string) => {
    const updatedComments = teamComments.filter(c => c.id !== commentId);
    setTeamComments(updatedComments);

    const updatedCandidate = updateCandidateEvaluation(candidate.id, {
      recruiterComments: updatedComments
    });

    if (updatedCandidate) {
      onRefreshCandidateData(updatedCandidate);
    }
  };

  const toggleAnnotation = (label: string) => {
    if (selectedAnnotations.includes(label)) {
      setSelectedAnnotations(selectedAnnotations.filter(item => item !== label));
    } else {
      setSelectedAnnotations([...selectedAnnotations, label]);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Lead Engineer':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-950/20 dark:text-pink-400';
      case 'Hiring Manager':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-950/20 dark:text-violet-400';
      case 'Recruiter':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-950/20 dark:text-teal-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-405';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
      
      {/* 1. CONFIDENTIAL RECRUITER PRIVATE NOTES */}
      <div className="bg-slate-900 border border-slate-950 text-slate-100 rounded-3xl p-6 shadow-md flex flex-col justify-between space-y-4">
        
        {/* Header with Secret Eyes Controls */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-rose-950/40 text-rose-400 rounded-xl flex items-center justify-center border border-rose-900/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-350">Private Recruiter Workspace</h3>
              <p className="text-[10px] text-slate-500 font-medium">Synced securely to classified firestore logs</p>
            </div>
          </div>

          <button
            onClick={() => setIsNotesLocked(!isNotesLocked)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase font-bold rounded-lg border transition-all cursor-pointer ${
              isNotesLocked 
                ? 'bg-rose-950/30 text-rose-400 border-rose-900/40 hover:bg-rose-900/20' 
                : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40 hover:bg-emerald-900/20'
            }`}
            title={isNotesLocked ? "Reveal hidden notes" : "Hide sensitive notes for sharing"}
          >
            {isNotesLocked ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Masked (Click to Reveal)</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Unmasked</span>
              </>
            )}
          </button>
        </div>

        {/* Private Notes timeline */}
        <div className="flex-1 min-h-[180px] max-h-[300px] overflow-y-auto space-y-3 pr-1.5">
          {isNotesLocked ? (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4 border border-dashed border-rose-950/40 rounded-2xl bg-rose-955/5">
              <Lock className="w-8 h-8 text-rose-500/40 mb-2" />
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider font-mono">Confidential Mode Active</span>
              <p className="text-[10px] text-slate-500 max-w-xs mt-1">
                Candidate notes are hidden to prevent accidental screen leaks in multi-user review sessions. Click reveal to read.
              </p>
            </div>
          ) : isPrivateNotesLoading ? (
            <div className="h-full min-h-[180px] flex items-center justify-center">
              <span className="text-[10px] text-slate-500 font-mono animate-pulse">Decrypting logs...</span>
            </div>
          ) : privateNotes.length === 0 ? (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4">
              <BadgeInfo className="w-7 h-7 text-slate-700 mb-2" />
              <p className="text-[11px] text-slate-550 italic">No notes logged for this candidate.</p>
              <p className="text-[9.5px] text-slate-600 mt-1 max-w-[200px]">Use the input below to persist background evaluator remarks.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {privateNotes.map((note, index) => {
                // Parse timestamp if formatted as [date @ time] Sender: Message
                const match = note.match(/^\[(.*?)\] (.*?): (.*)$/);
                if (match) {
                  return (
                    <div key={index} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80 text-xs">
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono mb-1 pb-1 border-b border-slate-900">
                        <span className="font-bold text-rose-400">{match[2]}</span>
                        <span>{match[1]}</span>
                      </div>
                      <p className="text-slate-300 font-normal leading-normal whitespace-pre-wrap">{match[3]}</p>
                    </div>
                  );
                }
                return (
                  <div key={index} className="bg-slate-950/50 p-3 rounded-xl border border-slate-850 text-xs">
                    <p className="text-slate-300 font-normal leading-normal">{note}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleAddPrivateNote} className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={newPrivateNote}
              onChange={(e) => setNewPrivateNote(e.target.value)}
              placeholder="Append confidentially synchronized notes..."
              className="flex-1 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 placeholder-slate-600 focus:outline-none focus:border-rose-505"
            />
            <button
              type="submit"
              className="px-3 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[8.5px] text-slate-500 font-mono font-bold uppercase leading-none">
            <span className="inline-block w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
            <span>Encrypted transmission ready</span>
          </div>
        </form>
      </div>

      {/* 2. COLLABORATIVE TEAM COMMENTS & ANNOTATIONS */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100/50">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Team Commenting Matrix</h3>
              <p className="text-[10px] text-slate-400 font-medium font-sans">Collaborative review and multi-agent assessments</p>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100/60 font-mono font-bold px-2 py-0.5 rounded-full">
            {teamComments.length} review{teamComments.length !== 1 && 's'}
          </span>
        </div>

        {/* Comment log area */}
        <div className="flex-1 min-h-[180px] max-h-[300px] overflow-y-auto space-y-3 pr-1">
          {teamComments.length === 0 ? (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4">
              <MessageSquare className="w-7 h-7 text-indigo-200 mb-2" />
              <p className="text-[11px] text-slate-400 italic">No annotations logged yet.</p>
              <p className="text-[9px] text-slate-400 mt-1 max-w-[200px]">Simulate team collaboration using the scheduler below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamComments.map((comment) => (
                <div key={comment.id} className="bg-slate-50/50 hover:bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2 relative group-item transition-all">
                  
                  {/* Row 1: Header details */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase select-none">
                        {comment.author.split(' ').map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">{comment.author}</span>
                          <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-extrabold uppercase ${getRoleBadgeStyle(comment.role)}`}>
                            {comment.role}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-400 block font-mono">{new Date(comment.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Delete commentator */}
                    <button
                      onClick={() => handleDeleteTeamComment(comment.id)}
                      className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                      title="Remove comment annotation string"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Comment main content payload */}
                  <p className="text-slate-600 text-xs leading-relaxed leading-normal mb-1">{comment.text}</p>

                  {/* Active tagged annotations in post */}
                  {comment.annotations && comment.annotations.length > 0 && (
                    <div className="flex flex-wrap gap-1 border-t border-slate-100/50 pt-1.5">
                      {comment.annotations.map(anno => {
                        const style = availableAnnotations.find(a => a.label === anno);
                        return (
                          <span key={anno} className={`text-[8.5px] px-1.5 py-0.2 rounded-full border flex items-center gap-1 font-bold ${style?.color || 'bg-slate-100 text-slate-600'}`}>
                            <Tag className="w-2.5 h-2.5 opacity-60" />
                            {anno}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment assembly panel */}
        <form onSubmit={handleAddTeamComment} className="pt-2 border-t border-slate-100 space-y-3">
          
          {/* Identity Switcher Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Hiring Persona Email/Name</label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={commenterName}
                  onChange={(e) => setCommenterName(e.target.value)}
                  placeholder="Reviewer name"
                  className="w-full pl-7 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1 font-sans">Verification Role Selector</label>
              <select
                value={commenterRole}
                onChange={(e) => setCommenterRole(e.target.value as any)}
                className="w-full px-2 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 font-sans"
              >
                <option value="Recruiter">Recruiter</option>
                <option value="Lead Engineer">Lead Engineer</option>
                <option value="Hiring Manager">Hiring Manager</option>
                <option value="Team Member">Team Member</option>
              </select>
            </div>
          </div>

          {/* Quick Annotation Selection pill box */}
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-extrabold text-slate-400 block leading-none">Collaborative Review Pins / Tags</span>
            <div className="flex flex-wrap gap-1 pt-1">
              {availableAnnotations.map(anno => {
                const isSelected = selectedAnnotations.includes(anno.label);
                return (
                  <button
                    type="button"
                    key={anno.label}
                    onClick={() => toggleAnnotation(anno.label)}
                    className={`text-[8.5px] px-2 py-0.5 rounded-full border transition-all cursor-pointer font-bold flex items-center gap-1 ${
                      isSelected 
                        ? `${anno.color} ring-1 ring-offset-1 ring-indigo-500 font-extrabold scale-[1.02]` 
                        : 'bg-white border-slate-200/50 text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Plus className={`w-2.5 h-2.5 transition-transform ${isSelected ? 'rotate-45' : ''}`} />
                    {anno.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment description string input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Add collaborative hiring team note..."
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              className="px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-indigo-50" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
