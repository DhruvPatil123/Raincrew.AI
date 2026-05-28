import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Calendar, Eye, Play, Trash2, Award, Star, 
  TrendingUp, TrendingDown, Clock, ShieldAlert, ArrowRight, 
  Check, CheckCircle, Flame, Compass, HeartOff, Phone
} from 'lucide-react';
import { Campaign, Candidate, maskName, maskEmail, maskPhone } from '../types';
import { updateCandidateEvaluation, deleteCandidate } from '../lib/storage';

interface KanbanBoardProps {
  campaign: Campaign;
  candidates: Candidate[];
  getWeightedScore: (cand: Candidate) => number;
  onRefresh: () => void;
  isAnonymousMode?: boolean;
  onOpenReport: (candidate: Candidate) => void;
  onLaunchInterview: (candidateId?: string) => void;
}

type KanbanStatus = 'Applied' | 'Interviewing' | 'Evaluated' | 'Hired' | 'Rejected';

export default function KanbanBoard({
  campaign,
  candidates,
  getWeightedScore,
  onRefresh,
  isAnonymousMode = false,
  onOpenReport,
  onLaunchInterview
}: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedOverCol, setDraggedOverCol] = useState<KanbanStatus | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<string | null>(null);

  // Columns definition with custom aesthetics
  const columns: { id: KanbanStatus; title: string; color: string; description: string; headerClass: string; bgClass: string; borderClass: string; ringClass: string }[] = [
    {
      id: 'Applied',
      title: 'Applied',
      color: 'slate-500',
      description: 'Newly entered applications',
      headerClass: 'text-slate-700 bg-slate-100 border-slate-200',
      bgClass: 'bg-slate-50/50 dark:bg-slate-900/40',
      borderClass: 'border-slate-200/60 dark:border-slate-800',
      ringClass: 'ring-slate-400'
    },
    {
      id: 'Interviewing',
      title: 'Interviewing',
      color: 'amber-500',
      description: 'Screening in progress',
      headerClass: 'text-amber-800 bg-amber-50 border-amber-100',
      bgClass: 'bg-amber-50/10 dark:bg-amber-955/10',
      borderClass: 'border-amber-200/50 dark:border-amber-900/30',
      ringClass: 'ring-amber-400'
    },
    {
      id: 'Evaluated',
      title: 'Evaluated',
      color: 'indigo-500',
      description: 'A.I. scorecard generated',
      headerClass: 'text-indigo-800 bg-indigo-50 border-indigo-105',
      bgClass: 'bg-indigo-50/10 dark:bg-indigo-955/10',
      borderClass: 'border-indigo-200/50 dark:border-indigo-900/30',
      ringClass: 'ring-indigo-400'
    },
    {
      id: 'Hired',
      title: 'Hired/Targeted',
      color: 'emerald-500',
      description: 'Passed requirements',
      headerClass: 'text-emerald-800 bg-emerald-50 border-emerald-100',
      bgClass: 'bg-emerald-50/10 dark:bg-emerald-950/10',
      borderClass: 'border-emerald-200/50 dark:border-emerald-900/30',
      ringClass: 'ring-emerald-400'
    },
    {
      id: 'Rejected',
      title: 'Rejected',
      color: 'rose-500',
      description: 'Lags or mismatch noted',
      headerClass: 'text-rose-800 bg-rose-50 border-rose-100',
      bgClass: 'bg-rose-50/10 dark:bg-rose-955/10',
      borderClass: 'border-rose-200/50 dark:border-rose-900/30',
      ringClass: 'ring-rose-450'
    }
  ];

  // Helper partition mapper
  const getColumnCandidates = (columnId: KanbanStatus) => {
    return candidates.filter(cand => {
      const status = cand.status;
      if (columnId === 'Applied') {
        return status === 'Pending' || status === 'Applied';
      }
      if (columnId === 'Interviewing') {
        return status === 'In-Progress' || status === 'Completed' || status === 'Interviewing';
      }
      return status === columnId;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: KanbanStatus) => {
    e.preventDefault();
    if (draggedOverCol !== columnId) {
      setDraggedOverCol(columnId);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDraggedOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumn: KanbanStatus) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData('text/plain');
    if (!candidateId) return;

    // Determine status mutation payload
    const updates: any = { status: targetColumn };

    // Align structural fit Category labels in DB to match
    if (targetColumn === 'Hired') {
      updates.fitCategory = 'Hire';
    } else if (targetColumn === 'Rejected') {
      updates.fitCategory = 'Reject';
    } else if (targetColumn === 'Evaluated') {
      updates.fitCategory = 'Shortlist';
    }

    updateCandidateEvaluation(candidateId, updates);
    onRefresh();
    handleDragEnd();
  };

  const executeDelete = (id: string) => {
    deleteCandidate(id);
    setCandidateToDelete(null);
    onRefresh();
  };

  // Get score pill configuration based on vetting marks
  const getScoreColorAndWeight = (cand: Candidate) => {
    const score = getWeightedScore(cand);
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-955/20 dark:text-amber-400';
    return 'text-rose-700 bg-rose-50 border-rose-100 dark:bg-rose-955/20 dark:text-rose-450';
  };

  return (
    <div className="space-y-6">
      {/* Visual Instruction & Drag Cues */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 p-4 rounded-2xl border border-slate-150 flex items-center justify-between flex-wrap gap-4 dark:from-slate-900/60 dark:to-slate-900/30 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-3xs">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-205">Drag-and-Drop Workflow Board</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Dynamically manipulate candidate stages by dragging individual scorecard panels across cols. System syncs data automatically.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 font-mono">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span>DRAG READY</span>
        </div>
      </div>

      {/* Main Grid Container for 5 columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
        {columns.map((col) => {
          const matchedCandidates = getColumnCandidates(col.id);
          const isOver = draggedOverCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              onDragLeave={() => setDraggedOverCol(null)}
              className={`flex flex-col min-h-[460px] max-h-[700px] rounded-2xl border transition-all duration-200 select-none ${
                isOver 
                  ? 'border-indigo-500 bg-indigo-50/20 shadow-md ring-2 ring-indigo-505/10 scale-[1.01]' 
                  : `${col.borderClass} ${col.bgClass}`
              }`}
            >
              {/* Column Title Block */}
              <div className={`p-3 rounded-t-2xl border-b border-inherit flex items-center justify-between font-bold ${col.headerClass}`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs tracking-tight">{col.title}</span>
                  </div>
                  <span className="text-[9px] font-medium opacity-70 block leading-none">{col.description}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700 shadow-3xs text-slate-700 dark:text-slate-300 font-extrabold font-mono transition-opacity">
                  {matchedCandidates.length}
                </span>
              </div>

              {/* Column Items list area */}
              <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto min-h-[300px]">
                <AnimatePresence>
                  {matchedCandidates.length === 0 ? (
                    <div className="h-full min-h-[140px] flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">Drop Here</span>
                      <p className="text-[9px] text-slate-350 dark:text-slate-500 mt-1">No candidate cards currently</p>
                    </div>
                  ) : (
                    matchedCandidates.map((cand) => {
                      const score = getWeightedScore(cand);
                      const isDraggingThisCard = draggingId === cand.id;
                      const hasFlags = (cand.tabSwitchCount && cand.tabSwitchCount > 0) || (cand.longSilenceCount && cand.longSilenceCount > 0) || cand.suspiciousVoiceNoise;

                      return (
                        <motion.div
                          key={cand.id}
                          layoutId={cand.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, cand.id)}
                          onDragEnd={handleDragEnd}
                          className={`p-3 bg-white dark:bg-slate-900 border border-slate-200/55 dark:border-slate-800 rounded-xl shadow-3xs cursor-grab active:cursor-grabbing hover:shadow-xs transition-all duration-150 flex flex-col space-y-2.5 group relative ${
                            isDraggingThisCard ? 'opacity-30 border-dashed border-indigo-500' : ''
                          }`}
                          whileHover={{ y: -1 }}
                        >
                          {/* Heading Detail */}
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <h5 className="text-[11.5px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                                {maskName(cand.name, isAnonymousMode)}
                              </h5>
                              {cand.status === 'Evaluated' && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold font-mono border ${getScoreColorAndWeight(cand)}`}>
                                  {score}%
                                </span>
                              )}
                            </div>
                            <span className="text-[9.5px] text-slate-400 dark:text-slate-500 flex items-center gap-1 leading-none break-all">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              {maskEmail(cand.email, isAnonymousMode)}
                            </span>
                            {cand.phone && (
                              <span className="text-[9.5px] text-slate-400 dark:text-slate-500 flex items-center gap-1 leading-none">
                                <Phone className="w-3 h-3 flex-shrink-0" />
                                {maskPhone(cand.phone, isAnonymousMode)}
                              </span>
                            )}
                          </div>

                          {/* Middle section for flags or details */}
                          <div className="flex items-center justify-between gap-2 border-t border-slate-50 dark:border-slate-800/40 pt-2 flex-wrap">
                            <span className="text-[9px] text-slate-400 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {new Date(cand.appliedDate).toLocaleDateString()}
                            </span>

                            {/* Flag pill alerts inside kanban */}
                            {hasFlags ? (
                              <span 
                                className="inline-flex items-center gap-0.5 px-1 rounded bg-rose-50 text-rose-700 text-[8.5px] font-extrabold border border-rose-100" 
                                title={`Security tab switches: ${cand.tabSwitchCount || 0}, Pauses: ${cand.longSilenceCount || 0}`}
                              >
                                <ShieldAlert className="w-2.5 h-2.5 text-rose-500 animate-pulse" />
                                Flagged
                              </span>
                            ) : null}
                          </div>

                          {/* Quick Actions Drawer inside cards */}
                          <div className="flex items-center justify-between gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-all">
                            {/* Launch Screen call */}
                            {cand.status !== 'Evaluated' ? (
                              <button
                                onClick={() => onLaunchInterview(cand.id)}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[9.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Bootstrap interview simulator caller"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" /> Call
                              </button>
                            ) : (
                              <button
                                onClick={() => onOpenReport(cand)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[9.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Open full feedback report and diagnostic grades"
                              >
                                <Eye className="w-2.5 h-2.5" /> Scorecard
                              </button>
                            )}

                            {/* Small delete click */}
                            <button
                              onClick={() => setCandidateToDelete(cand.id)}
                              className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-300 hover:text-rose-500 rounded cursor-pointer transition-colors"
                              title="Delete candidate completely"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal block inside Kanban */}
      {candidateToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-slate-950 dark:text-white">Confirm Removal</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete this applicant's profiling report? All voice recordings, transcripts, and evaluation history will be wiped.
            </p>
            <div className="flex justify-end gap-2.5 text-xs">
              <button
                onClick={() => setCandidateToDelete(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDelete(candidateToDelete)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg cursor-pointer"
              >
                Delete Permanent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
