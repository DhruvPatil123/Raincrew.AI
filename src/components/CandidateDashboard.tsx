import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Phone, Award, FileText, Play, CheckCircle2, 
  Calendar, ArrowRight, Settings, Edit3, HelpCircle, 
  Clock, Heart, RotateCcw, AlertCircle, Video, ExternalLink
} from 'lucide-react';
import { Campaign, Candidate } from '../types';
import { saveCandidates, getCandidates } from '../lib/storage';

interface CandidateDashboardProps {
  candidateName: string;
  candidateEmail: string;
  campaigns: Campaign[];
  candidates: Candidate[];
  onStartInterview: (campaign: Campaign, candidateId?: string) => void;
  onLogout: () => void;
  onViewReport: (candidate: Candidate, campaign: Campaign) => void;
  onRefresh: () => void;
}

export default function CandidateDashboard({
  candidateName,
  candidateEmail,
  campaigns,
  candidates,
  onStartInterview,
  onLogout,
  onViewReport,
  onRefresh
}: CandidateDashboardProps) {
  // Matching candidate records for this email
  const mySubmissions = candidates.filter(
    c => c.email.toLowerCase() === candidateEmail.toLowerCase()
  );

  // Profile fields editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(candidateName);
  const [profilePhone, setProfilePhone] = useState(() => {
    const firstWithPhone = mySubmissions.find(c => c.phone);
    return firstWithPhone ? firstWithPhone.phone : '';
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Statistics calculation
  const completedInterviews = mySubmissions.filter(c => ['Completed', 'Evaluated'].includes(c.status));
  const pendingInterviews = mySubmissions.filter(c => c.status === 'Pending');
  
  const evaluatedRatings = mySubmissions.filter(c => c.status === 'Evaluated' && c.score > 0);
  const avgFitScore = evaluatedRatings.length > 0
    ? Math.round(evaluatedRatings.reduce((sum, c) => sum + c.score, 0) / evaluatedRatings.length)
    : null;

  const scheduledInterviews = mySubmissions.filter(
    sub => sub.interviewStatus === 'Confirmed' && sub.interviewScheduledDate
  );

  const handleSaveProfile = () => {
    if (!profileName.trim()) return;

    // Update the custom candidate entries matching this email address locally
    const allStored = getCandidates();
    const updated = allStored.map(c => {
      if (c.email.toLowerCase() === candidateEmail.toLowerCase()) {
        return {
          ...c,
          name: profileName.trim(),
          phone: profilePhone.trim()
        };
      }
      return c;
    });

    saveCandidates(updated);
    onRefresh();

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    setIsEditingProfile(false);
  };

  const getFitBadgeColor = (category?: string) => {
    switch (category) {
      case 'Hire':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Shortlist':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Reject':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Upper personalized welcome hero with glass reflection */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0,transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 z-10 relative">
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider font-mono bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/15">
              Secure Candidate Workspace
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-200">{profileName}</span>!
            </h1>
            <p className="text-slate-400 text-xs max-w-xl leading-relaxed">
              Examine your digital vocal scorecards, modify your active applicant details, and complete pending real-time oral screening sessions safely.
            </p>
          </div>

          <div className="flex gap-4 shrink-0 font-mono">
            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl min-w-[100px] text-center">
              <span className="block text-[9px] uppercase font-sans font-bold text-slate-400">Interviews</span>
              <span className="text-xl font-bold text-white">{completedInterviews.length}</span>
            </div>
            
            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl min-w-[100px] text-center">
              <span className="block text-[9px] uppercase font-sans font-bold text-slate-400">Avg Fit Score</span>
              <span className="text-xl font-bold text-blue-400">
                {avgFitScore !== null ? `${avgFitScore}%` : '--'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* UPCOMING INTERVIEWS ALERT MODULE */}
      {scheduledInterviews.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 px-1">
            <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Confirmed Live Interviews Scheduled
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduledInterviews.map((sub) => {
              const associatedCamp = campaigns.find(c => c.id === sub.campaignId);
              return (
                <div 
                  key={sub.id} 
                  className="bg-emerald-50/40 border border-emerald-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden"
                >
                  <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-emerald-100/10 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] uppercase font-bold text-emerald-850 bg-emerald-100 p-1 rounded-md font-mono">
                        {associatedCamp ? associatedCamp.department : 'Vetting Round'}
                      </span>
                      <span className="text-[10px] text-emerald-800 font-mono font-bold flex items-center gap-1 mb-0.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Booked
                      </span>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-800 leading-snug">
                      Follow-up Roundtable: {associatedCamp ? associatedCamp.title : 'General Profile Review'}
                    </h4>

                    {/* Date Details */}
                    <div className="flex gap-2.5 pt-2 items-center text-xs text-slate-600">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span className="font-extrabold text-slate-800">
                        {sub.interviewScheduledDate 
                          ? new Date(sub.interviewScheduledDate).toLocaleString(undefined, {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              timeZoneName: 'short'
                            })
                          : 'Validating...'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-emerald-100/40 flex items-center gap-2">
                    {sub.interviewMeetLink ? (
                      <a 
                        href={sub.interviewMeetLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl text-center shadow-md shadow-blue-100 hover:shadow-lg transition-all flex items-center justify-center gap-1.5 leading-none uppercase cursor-pointer"
                        id={`btn-join-meet-${sub.id}`}
                      >
                        <Video className="w-3.5 h-3.5" />
                        Join Google Meet Room
                      </a>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Email confirmation dispatched</span>
                    )}

                    {sub.interviewEventLink && (
                      <a 
                        href={sub.interviewEventLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[10px] rounded-xl border border-slate-200 transition-colors uppercase flex items-center gap-1 cursor-pointer"
                        title="Add/View detail on Google Calendar"
                        id={`btn-view-cal-${sub.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Details
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Profile details editor */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">My Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> {isEditingProfile ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {isEditingProfile ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidate Name</label>
                    <input
                      type="text"
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address (Locked)</label>
                    <input
                      type="text"
                      disabled
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-150 rounded-xl bg-slate-50 text-slate-400"
                      value={candidateEmail}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Number</label>
                    <input
                      type="text"
                      placeholder="+1 (555) 000-0000"
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-blue-100"
                  >
                    Save Changes
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4"
                >
                  <div className="flex gap-3 items-start">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] uppercase font-bold text-slate-400">Full Name</span>
                      <p className="text-sm font-extrabold text-slate-800 leading-tight">{profileName}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] uppercase font-bold text-slate-400">Email Address</span>
                      <p className="text-xs font-bold text-slate-700 break-all">{candidateEmail}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] uppercase font-bold text-slate-400">Phone Number</span>
                      <p className="text-xs font-bold text-slate-700">
                        {profilePhone || <span className="text-slate-300 font-medium">Add phone number...</span>}
                      </p>
                    </div>
                  </div>

                  {saveSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-2.5 rounded-xl text-[10px] font-semibold text-center mt-1"
                    >
                      ✓ Local candidate records updated globally!
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick instructions container */}
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl space-y-3">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
              <HelpCircle className="w-4.5 h-4.5 text-blue-600" />
              <span>How Screening Works</span>
            </div>
            <ul className="text-[11px] text-slate-500 space-y-2 list-decimal list-inside pl-1 leading-relaxed leading-normal">
              <li>Choose an open vacancy listed under the <strong className="text-slate-700">hiring campaigns</strong>.</li>
              <li>Calibrate your microphone and allow browser camera proctor access for integrity auditing.</li>
              <li>Undergo active oral prompts with the full-duplex AI Voice sphere agent.</li>
              <li>Receive real-time evaluation logs, fit categories, and structured scorecards directly.</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Available vacancies & score history */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Active Vacancies Screen */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-100/40 p-2 border border-slate-200/40 rounded-2xl">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-mono ml-3">
                Active Hiring Opportunities
              </span>
              <span className="text-[10px] font-mono font-bold bg-white px-2.5 py-1 rounded-xl shadow-xs text-blue-600 border border-slate-100">
                {campaigns.length} Campaign{campaigns.length !== 1 && 's'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp) => {
                // Find if candidate already submitted OR has pending record for this campaign
                const history = mySubmissions.filter(s => s.campaignId === camp.id);
                const hasEvaluated = history.some(s => s.status === 'Evaluated');
                const hasPending = history.some(s => s.status === 'Pending');
                
                return (
                  <div
                    key={camp.id}
                    className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 hover:border-blue-200/60 transition-all group flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md font-mono">
                          {camp.department}
                        </span>
                        
                        {hasEvaluated ? (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Completed
                          </span>
                        ) : hasPending ? (
                          <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-1 select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Pending
                          </span>
                        ) : (
                          <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-100 select-none">
                            Eligible
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-800 line-clamp-1 leading-snug group-hover:text-blue-600 transition-colors">
                        {camp.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium font-sans">
                        Experience Req: {camp.experience || 'Flexible'}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                        {camp.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-50 flex items-center justify-between gap-2.5">
                      {hasEvaluated ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              // Find highest evaluated score candidate 
                              const highestScoreObj = history.reduce((max, s) => s.score > max.score ? s : max, history[0]);
                              onViewReport(highestScoreObj, camp);
                            }}
                            className="bg-slate-100 hover:bg-slate-150 text-slate-700 font-bold text-[10px] px-3 py-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 leading-none uppercase"
                          >
                            <FileText className="w-3 h-3" /> View Score
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => onStartInterview(camp)}
                            className="text-blue-600 hover:text-blue-700 font-bold text-[10px] px-2 py-1.5 rounded-md transition-all cursor-pointer inline-flex items-center gap-0.5 leading-none uppercase ml-1"
                            title="Undergo another vetting interview"
                          >
                            <RotateCcw className="w-3 h-3" /> Retry
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            // If has pending, use their candidate ID, else leave empty for auto-generation
                            const pendingObj = history.find(s => s.status === 'Pending');
                            onStartInterview(camp, pendingObj?.id);
                          }}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-blue-100 hover:shadow-lg hover:shadow-blue-200 leading-none uppercase"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> 
                          {hasPending ? 'Resume Assessment' : 'Start Screening Call'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Past Submissions Log Feed */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Award className="w-5 h-5 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">My Past Screenings & Evaluations</h3>
            </div>

            {mySubmissions.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <CheckCircle2 className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-xs font-bold text-slate-600">No completed screenings yet.</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-normal">
                  Toggle any active vacancies above, complete the microphone sound diagnostics and voice response module to populate your leaderboard score.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="py-2.5 pb-2">Hiring Role</th>
                      <th className="py-2.5 pb-2">Screening Date</th>
                      <th className="py-2.5 pb-2">Duration</th>
                      <th className="py-2.5 pb-2">Integrity Status</th>
                      <th className="py-2.5 pb-2 text-right">Adaptive Fit Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {mySubmissions.map((sub) => {
                      const associatedCamp = campaigns.find(c => c.id === sub.campaignId);
                      const isCompleteOrEvaluated = ['Completed', 'Evaluated'].includes(sub.status);
                      
                      return (
                        <tr 
                          key={sub.id} 
                          onClick={() => {
                            if (sub.status === 'Evaluated' && associatedCamp) {
                              onViewReport(sub, associatedCamp);
                            }
                          }}
                          className={`group text-xs transition-colors ${sub.status === 'Evaluated' ? 'hover:bg-slate-50/50 cursor-pointer' : ''}`}
                        >
                          <td className="py-3.5">
                            <span className="font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors block">
                              {associatedCamp ? associatedCamp.title : 'Legacy Custom Vetting Role'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {associatedCamp ? associatedCamp.department : 'General'}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-550 font-medium">
                            {new Date(sub.appliedDate || Date.now()).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3.5 text-slate-550 font-mono font-bold text-[11px]">
                            {sub.duration || '--'}
                          </td>
                          <td className="py-3.5">
                            <div className="flex items-center gap-1.5">
                              {sub.suspiciousVoiceNoise ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 select-none">
                                  <AlertCircle className="w-3 h-3" /> Attention Warning
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 select-none">
                                  ✓ Clear Integrity
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 text-right font-mono">
                            {sub.status === 'Evaluated' ? (
                              <div className="flex items-center justify-end gap-2.5">
                                <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-md border ${getFitBadgeColor(sub.fitCategory)}`}>
                                  {sub.fitCategory} ({sub.score}%)
                                </span>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all md:inline hidden" />
                              </div>
                            ) : sub.status === 'Completed' ? (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-205/60 px-2 py-0.5 rounded-lg">
                                Processing AI...
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">
                                Unfinished
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
