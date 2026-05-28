import { motion } from 'motion/react';
import { MouseEvent, useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, Users, Plus, Trash2, ChevronRight, Play, Award, 
  CheckCircle2, Circle, User, Mail, Phone, Building, ShieldCheck, 
  FileText, ArrowRight, Settings, Edit3, Check, AlertCircle,
  Send, Palette, History, ShieldAlert, BarChart3, AudioLines
} from 'lucide-react';
import { Campaign, AppStats, Candidate, maskName, maskEmail } from '../types';
import StatsGrid from './StatsGrid';
import { ConfirmModal } from './ConfirmModal';
import { 
  fetchAuditLogsServer, fetchEmailLogsServer, dispatchSimulatedEmail, 
  fetchBrandingServer, saveBrandingServer, addCandidate 
} from '../lib/storage';
import AnalyticsDashboard from './AnalyticsDashboard';

interface DashboardProps {
  campaigns: Campaign[];
  stats: AppStats;
  candidates: Candidate[];
  onCreateNewCampaign: () => void;
  onSelectCampaign: (campaign: Campaign) => void;
  onLaunchInterview: (campaign: Campaign) => void;
  onDeleteCampaign: (campId: string) => void;
  activeCampaignId: string;
  onSetActiveCampaign: (campId: string) => void;
  onViewReport: (candidate: Candidate, campaign: Campaign) => void;
  isAnonymousMode?: boolean;
}

export default function Dashboard({ 
  campaigns, 
  stats, 
  candidates,
  onCreateNewCampaign, 
  onSelectCampaign, 
  onLaunchInterview, 
  onDeleteCampaign,
  activeCampaignId,
  onSetActiveCampaign,
  onViewReport,
  isAnonymousMode = false
}: DashboardProps) {

  const [activeTab, setActiveTab] = useState<'campaigns' | 'analytics' | 'emails' | 'audit' | 'branding' | 'profile'>('campaigns');
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

  // Recruiter editable fields with localStorage mapping
  const [recruiterName, setRecruiterName] = useState(() => {
    return localStorage.getItem('recruiter_name') || 'Eleanor Vance';
  });
  const [recruiterTitle, setRecruiterTitle] = useState(() => {
    return localStorage.getItem('recruiter_title') || 'Director of Global Talent Acquisition';
  });
  const [recruiterEmail, setRecruiterEmail] = useState(() => {
    return localStorage.getItem('recruiter_email') || 'recruiter@raincrew.ai';
  });
  const [recruiterPhone, setRecruiterPhone] = useState(() => {
    return localStorage.getItem('recruiter_phone') || '+1 (555) 700-1122';
  });
  const [recruiterCompany, setRecruiterCompany] = useState(() => {
    return localStorage.getItem('recruiter_company') || 'Raincrew.AI Sandbox Technologies';
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Search filter for recruiter history log
  const [candidatesSearch, setCandidatesSearch] = useState('');

  // Competency Filters State
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [competencyMatchMode, setCompetencyMatchMode] = useState<'AND' | 'OR'>('OR');

  // Dynamically extract unique candidate competencies and combine with core tech competencies
  const availableCompetencies = useMemo(() => {
    const presets = ['React', 'System Design', 'Leadership', 'TypeScript', 'Node.js', 'DevOps', 'Kubernetes', 'Figma', 'Product Strategy', 'B2B Sales', 'API Security'];
    const dynamicStrengths = new Set<string>();
    
    candidates.forEach(cand => {
      if (cand.strengths) {
        cand.strengths.forEach(str => {
          const clean = str.trim();
          if (clean && clean.length < 30) {
            // Check if string is already represented case-insensitively
            const exists = Array.from(dynamicStrengths).some(
              item => item.toLowerCase() === clean.toLowerCase()
            );
            if (!exists) {
              dynamicStrengths.add(clean);
            }
          }
        });
      }
    });

    // Add presets that are not already present
    presets.forEach(preset => {
      const exists = Array.from(dynamicStrengths).some(
        item => item.toLowerCase() === preset.toLowerCase()
      );
      if (!exists) {
        dynamicStrengths.add(preset);
      }
    });

    return Array.from(dynamicStrengths);
  }, [candidates]);

  // Extended Full-Stack State Hooks
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [inviteEmailTarget, setInviteEmailTarget] = useState('');
  const [inviteNameTarget, setInviteNameTarget] = useState('');
  const [inviteCampaignTarget, setInviteCampaignTarget] = useState('');
  const [emailStatusMsg, setEmailStatusMsg] = useState('');
  
  const [brandConfig, setBrandConfig] = useState<any>({
    appName: 'Raincrew.AI',
    logoUrl: '/logo.svg',
    companyName: 'Raincrew.AI Sandbox Technologies',
    themeColor: '#0ea5e9',
    gdprText: 'By proceeding with this vocal-screening session, you explicitly agree that Raincrew.AI systems can record your voice, analyze speaking patterns (WPM, latency, filler word frequency) and query generative AI models to score your replies. All processing is strictly GDPR-compliant.',
    emailProvider: 'simulated',
    emailApiKey: '',
    senderEmail: 'onboarding@resend.dev',
    recruiterAlertEmail: 'recruiter@raincrew.ai'
  });

  // Pull branding config and seed updates
  useEffect(() => {
    fetchBrandingServer()
      .then(cfg => {
        if (cfg && cfg.companyName) {
          setBrandConfig(cfg);
          localStorage.setItem('recruiter_company', cfg.companyName);
          setRecruiterCompany(cfg.companyName);
        }
      })
      .catch(console.error);
  }, []);

  const loadAuditLogs = () => {
    fetchAuditLogsServer()
      .then(setAuditLogs)
      .catch(console.error);
  };

  const loadEmailLogs = () => {
    fetchEmailLogsServer()
      .then(setEmailLogs)
      .catch(console.error);
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    } else if (activeTab === 'emails') {
      loadEmailLogs();
    }
  }, [activeTab]);

  const handleSendInvite = async (e: any) => {
    e.preventDefault();
    if (!inviteNameTarget || !inviteEmailTarget || !inviteCampaignTarget) {
      setEmailStatusMsg("Error: Please provide name, email, and target campaign.");
      return;
    }
    
    setEmailStatusMsg("Preparing email environment...");
    const targetCamp = campaigns.find(c => c.id === inviteCampaignTarget);
    if (!targetCamp) {
      setEmailStatusMsg("Error: Invalid job vacancy campaign selected.");
      return;
    }
    
    // Register candidate inside internal database as Pending
    const pendingCand = addCandidate({
      campaignId: targetCamp.id,
      name: inviteNameTarget,
      email: inviteEmailTarget,
      phone: '+1 (555) 000-0000',
      gdprCompliantMode: true
    });

    const inviteLink = `${window.location.protocol}//${window.location.host}?campaignId=${targetCamp.id}&candidateId=${pendingCand.id}&name=${encodeURIComponent(inviteNameTarget)}&email=${encodeURIComponent(inviteEmailTarget)}`;
    const subjectLine = `Screening Call Invitation: ${targetCamp.title} at ${recruiterCompany}`;
    const emailBody = `Dear ${inviteNameTarget},

We are pleased to invite you to complete a vocal screen for our ${targetCamp.title} position in the ${targetCamp.department} team. 
Our systems use interactive Gemini AI speech follow-ups to highlight your background fluidly.

To engage with our automated recruiting officer, please launch your session link:
${inviteLink}

Please configure your camera, lighting levels, and microphones prior to starting.
Good luck!

Sincerely,
${recruiterName}
${recruiterCompany}`;

    const ok = await dispatchSimulatedEmail(inviteEmailTarget, subjectLine, emailBody);
    if (ok) {
      setEmailStatusMsg(`Successfully sent campaign invite and pre-scored candidacy record for ${inviteNameTarget}!`);
      setInviteNameTarget('');
      setInviteEmailTarget('');
      loadEmailLogs();
    } else {
      setEmailStatusMsg("Failed to dispatch simulated notification.");
    }
  };

  const handleSaveBrand = async () => {
    const res = await saveBrandingServer(brandConfig);
    if (res && res.companyName) {
      localStorage.setItem('recruiter_company', res.companyName);
      setRecruiterCompany(res.companyName);
      setSaveSuccess(true);
      // Dispatch database update event to trigger header refresh globally
      window.dispatchEvent(new Event('foloup_db_update'));
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleSetActiveClick = (e: MouseEvent, campId: string) => {
    e.stopPropagation();
    onSetActiveCampaign(campId);
  };

  const handleDeleteClick = (e: MouseEvent, campId: string) => {
    e.stopPropagation();
    setCampaignToDelete(campId);
  };

  const handleSaveProfile = () => {
    localStorage.setItem('recruiter_name', recruiterName);
    localStorage.setItem('recruiter_title', recruiterTitle);
    localStorage.setItem('recruiter_email', recruiterEmail);
    localStorage.setItem('recruiter_phone', recruiterPhone);
    localStorage.setItem('recruiter_company', recruiterCompany);
    
    setIsEditingProfile(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const getDeptColor = (dept: string) => {
    switch (dept) {
      case 'Engineering':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Product':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Sales & Growth':
        return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'Design':
        return 'bg-pink-50 text-pink-700 border-pink-100';
      case 'Operations':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getFitBadgeColor = (category?: string) => {
    switch (category) {
      case 'Hire':
        return 'bg-emerald-50 text-emerald-700 border-emerald-110';
      case 'Shortlist':
        return 'bg-blue-50 text-blue-700 border-blue-110';
      case 'Reject':
        return 'bg-rose-50 text-rose-700 border-rose-110';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-110';
    }
  };

  // Filtered recruiter candidate reports matching search queries, strengths, transcripts or evaluations
  const filteredCandidates = candidates.filter(cand => {
    // 1. Text Search matching name, email, campaign name, evaluation texts, or missing skills
    if (candidatesSearch.trim()) {
      const searchLow = candidatesSearch.toLowerCase();
      const camp = campaigns.find(c => c.id === cand.campaignId);
      
      const nameMatch = cand.name.toLowerCase().includes(searchLow);
      const emailMatch = cand.email.toLowerCase().includes(searchLow);
      const campaignNameMatch = camp ? camp.title.toLowerCase().includes(searchLow) : false;
      const generalEvalMatch = cand.overallEvaluation ? cand.overallEvaluation.toLowerCase().includes(searchLow) : false;
      const strengthsMatch = cand.strengths ? cand.strengths.some(s => s.toLowerCase().includes(searchLow)) : false;
      
      const textMatch = nameMatch || emailMatch || campaignNameMatch || generalEvalMatch || strengthsMatch;
      if (!textMatch) return false;
    }

    // 2. Competency Tag filtering
    if (selectedCompetencies.length > 0) {
      const matchResults = selectedCompetencies.map(comp => {
        const compLow = comp.toLowerCase();
        
        // Exact or partial strength array match
        const hasStrength = cand.strengths && cand.strengths.some(s => s.toLowerCase().includes(compLow));
        
        // Evaluation highlights match
        const hasEvalText = cand.overallEvaluation && cand.overallEvaluation.toLowerCase().includes(compLow);
        
        // Competencies mentioned in QnA pairs
        const hasQnA = cand.qnaPairs && cand.qnaPairs.some(qna => 
          qna.answer.toLowerCase().includes(compLow) || qna.question.toLowerCase().includes(compLow)
        );

        // Core candidate transcript trace match
        const hasTranscript = cand.transcript && cand.transcript.some(turn => 
          turn.text.toLowerCase().includes(compLow)
        );

        return hasStrength || hasEvalText || hasQnA || hasTranscript;
      });

      if (competencyMatchMode === 'AND') {
        return matchResults.every(res => res === true);
      } else {
        return matchResults.some(res => res === true);
      }
    }

    return true;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      
      {/* Upper header navigation tab bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/50 pb-2">
        <div className="bg-slate-100 p-1 rounded-2xl border border-slate-205 flex flex-wrap text-xs font-semibold w-max select-none gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('campaigns')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Briefcase className="w-4 h-4 text-blue-600" /> Campaigns Pipeline
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-rose-500" /> Trend Analytics
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'emails'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-4 h-4 text-emerald-600" /> Candidate Invites
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4 text-violet-600" /> Integrity Audit Logs
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'branding'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palette className="w-4 h-4 text-fuchsia-600" /> Branding Workspace
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4 text-indigo-600" /> Recruiter Profile
          </button>
        </div>

        {activeTab === 'campaigns' && (
          <button
            type="button"
            onClick={onCreateNewCampaign}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold leading-none uppercase tracking-wider transition-all shadow-md shadow-blue-105 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </button>
        )}
      </div>

      {activeTab === 'campaigns' && (
        <div className="space-y-8">
          {/* Dynamic greeting banner */}
          <div className="flex justify-between items-start flex-wrap gap-4 bg-slate-900 text-white p-8 rounded-3xl relative overflow-hidden shadow-xl border border-slate-800">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0,transparent_55%)] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
            
            <div className="space-y-2 z-10 p-1">
              <span className="px-2.5 py-0.5 bg-blue-500 text-white font-bold text-[9px] uppercase tracking-widest rounded-md flex items-center gap-1 w-max font-mono">
                <Award className="w-3.5 h-3.5" /> Workspace Active
              </span>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Raincrew.AI Hiring Workspace</h1>
              <p className="text-slate-300 text-xs max-w-lg leading-relaxed">
                Welcome to your vocal screening suite. Setup target job roles, generate high-yield questions with Gemini AI, and review semantic candidate scorecards based on oral interviews.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-3 z-10 self-center md:self-stretch justify-end">
              <div className="flex flex-col gap-1 text-left bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl min-w-[200px] shadow-sm">
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest font-mono">WORKSPACE IDENTITY</span>
                <p className="text-xs font-semibold text-slate-250 mt-1">{recruiterCompany}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Operator: {recruiterName}</p>
              </div>
            </div>
          </div>

          {/* Numerical Metrics Deck */}
          <StatsGrid stats={stats} />

          {/* Campaigns list row */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Recruitment Campaigns</h3>
              <p className="text-slate-450 text-xs font-medium md:block hidden">{campaigns.length} Active Campaigns</p>
            </div>

            {campaigns.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-6 shadow-sm flex flex-col items-center justify-center">
                <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl mx-auto w-max">
                  <Briefcase className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-slate-800 text-md font-bold">No active screening campaigns</p>
                  <p className="text-slate-400 text-xs px-2 leading-relaxed max-w-sm mx-auto">Launch a vetting campaign, generate customized question matrices with AI, and start screening candidates immediately.</p>
                </div>
                <button
                  type="button"
                  onClick={onCreateNewCampaign}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" /> Create First Campaign
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {campaigns.map((camp, i) => {
                  const isActive = camp.id === activeCampaignId;
                  return (
                    <motion.div
                      key={camp.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.08 }}
                      onClick={() => onSelectCampaign(camp)}
                      className={`bg-white border rounded-3xl p-6 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between h-80 cursor-pointer relative group ${
                        isActive ? 'border-indigo-400 ring-2 ring-indigo-50/50' : 'border-slate-100'
                      }`}
                    >
                      {/* Upper details */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2.5">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase tracking-wider ${getDeptColor(camp.department)}`}>
                            {camp.department}
                          </span>
                          
                          {isActive ? (
                            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider select-none shrink-0 font-mono">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 fill-emerald-100/50 hover:scale-105" /> Active Vacancy
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleSetActiveClick(e, camp.id)}
                              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer select-none shrink-0"
                              title="Set as Active Screening Job Vacancy"
                            >
                              <Circle className="w-2.5 h-2.5" /> Toggle Focus
                            </button>
                          )}
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-sm font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors leading-snug tracking-tight">{camp.title}</h4>
                          <p className="text-[11px] text-slate-400 font-medium">Req Experience: {camp.experience}</p>
                        </div>

                        {/* Question preview list */}
                        <div className="space-y-1 bg-slate-50/60 border border-slate-100 rounded-xl p-3">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">Questions Board Preview:</span>
                          <ul className="space-y-1">
                            {camp.questions.slice(0, 2).map((q, idx) => (
                              <li key={idx} className="text-slate-600 text-[10px] leading-relaxed truncate list-decimal pl-1 ml-3 font-sans">
                                {q}
                              </li>
                            ))}
                            {camp.questions.length > 2 && (
                              <li className="text-slate-450 text-[9px] font-semibold italic pl-4">
                                + {camp.questions.length - 2} more vetting questions
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Lower meta actions */}
                      <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-2">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-slate-700">{camp.candidateCount}</span> candidates
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Run test direct candidate simulation button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLaunchInterview(camp);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-700 text-[10px] font-bold tracking-wide transition-all cursor-pointer"
                            title="Direct Oral Interview Simulator Run"
                          >
                            <Play className="w-2.5 h-2.5 fill-current text-indigo-500" /> Run Simulator
                          </button>
                          <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all">
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard
          candidates={candidates}
          campaigns={campaigns}
        />
      )}

      {activeTab === 'emails' && (
        <motion.div
          key="emails-workspace"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
          {/* Send invite column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
                <Send className="w-4.5 h-4.5 text-emerald-650" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">Create Invite Link</h3>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Candidate Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Alex Rivera"
                    value={inviteNameTarget}
                    onChange={(e) => setInviteNameTarget(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-50 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Candidate Email</label>
                  <input
                    type="email"
                    required
                    placeholder="alex.rivera@example.com"
                    value={inviteEmailTarget}
                    onChange={(e) => setInviteEmailTarget(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-50 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Target Campaign Vacancy</label>
                  <select
                    required
                    value={inviteCampaignTarget}
                    onChange={(e) => setInviteCampaignTarget(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-50 focus:border-emerald-500 bg-white outline-none"
                  >
                    <option value="">-- Choose Vacancy --</option>
                    {campaigns.map(camp => (
                      <option key={camp.id} value={camp.id}>{camp.title}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-emerald-100 flex items-center justify-center gap-1 leading-none uppercase tracking-wider font-mono"
                >
                  <Send className="w-3.5 h-3.5" /> Dispatch Simulated Link
                </button>
              </form>

              {emailStatusMsg && (
                <div className="text-[10.5px] font-semibold text-slate-600 bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
                  {emailStatusMsg}
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl space-y-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">DELIVERY MECHANISM</span>
              <p className="text-[11px] text-slate-500 leading-relaxed font-light">
                Candidate dispatch creates a specialized, pre-scored profile inside the Raincrew.AI engine. Use the resulting link on the Candidate screen of the portal to simulate a real interview callback immediately.
              </p>
            </div>
          </div>

          {/* Email logs grid column */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">Simulated Delivery Tracking Logs</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">{emailLogs.length} emails dispatched</span>
              </div>

              {emailLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Mail className="w-8 h-8 opacity-25 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No invitations dispatched yet</p>
                  <p className="text-[10.5px] leading-relaxed max-w-xs mx-auto">Fill our Invite Form on the left to send simulated evaluation opportunities to candidates.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-2.5">To/Recipient</th>
                        <th className="py-2.5">Subject</th>
                        <th className="py-2.5">Date Dispatched</th>
                        <th className="py-2.5 text-right">Gate Delivery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                      {emailLogs.map((log, index) => (
                        <tr key={index}>
                          <td className="py-3 font-semibold text-slate-800 break-all">{log.to}</td>
                          <td className="py-3 text-slate-500 max-w-xs truncate">{log.subject}</td>
                          <td className="py-3 text-slate-450">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="py-3 text-right">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold font-mono">
                              Delivered
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'audit' && (
        <motion.div
          key="audit-workspace"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-violet-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">Integrity Timeline & Telemetry Trails</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">{auditLogs.length} telemetry points logged</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <History className="w-8 h-8 opacity-25 mx-auto animate-spin" />
                <p className="text-xs font-bold text-slate-600">No actions recorded on backend</p>
                <p className="text-[10.5px] max-w-xs mx-auto leading-relaxed">Activities, candidates completing screenings, or tab-shuffling proctoring logs will show up here continuously.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-2.5">Timestamp</th>
                      <th className="py-2.5">Vetting Category</th>
                      <th className="py-2.5">Actor Identity</th>
                      <th className="py-2.5">Security / Integrity Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {auditLogs.map((log, index) => {
                      const isDanger = ['Cheating Alert', 'TAB_SWITCH', 'ANOMALY'].includes(log.category);
                      return (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 text-slate-400 font-mono text-[10px]">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              isDanger ? 'bg-rose-50 border border-rose-100 text-rose-700' : 'bg-slate-50 border border-slate-200/50 text-slate-600'
                            }`}>
                              {log.category}
                            </span>
                          </td>
                          <td className="py-3 font-semibold text-slate-800">{log.userId}</td>
                          <td className="py-3 text-slate-550 italic pr-2">{log.details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'branding' && (
        <motion.div
          key="branding-workspace"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
          {/* Brand presets config */}
          <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Palette className="w-4.5 h-4.5 text-fuchsia-650" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">Enterprise Corporate Branding Configurations</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Agency / corporate Display Name</label>
                <input
                  type="text"
                  value={brandConfig.companyName}
                  onChange={(e) => setBrandConfig({ ...brandConfig, companyName: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-50 focus:border-fuchsia-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono font-mono">Platform App Name / Header Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Raincrew.AI"
                    value={brandConfig.appName || ''}
                    onChange={(e) => setBrandConfig({ ...brandConfig, appName: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-50 focus:border-fuchsia-500 outline-none"
                  />
                  <p className="text-[9px] text-slate-400 leading-none">Controls the top-left web header name</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono font-mono">Platform Logo URL (Image Link)</label>
                  <input
                    type="text"
                    placeholder="e.g. https://mycompany.com/logo.png"
                    value={brandConfig.logoUrl || ''}
                    onChange={(e) => setBrandConfig({ ...brandConfig, logoUrl: e.target.value })}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-50 focus:border-fuchsia-500 outline-none"
                  />
                  <p className="text-[9px] text-slate-400 leading-none">JPEG/PNG/SVG link. Leave blank to default to Wave logo</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Select Portal Primary Theme Gradient Color</label>
                <div className="flex flex-wrap gap-2 pt-1 font-display">
                  {[
                    { name: 'Celestial Indigo', hex: '#4f46e5', bg: 'bg-indigo-600' },
                    { name: 'Emerald Green', hex: '#10b981', bg: 'bg-emerald-600' },
                    { name: 'Royal Purple', hex: '#8b5cf6', bg: 'bg-purple-600' },
                    { name: 'Warm Amber', hex: '#f59e0b', bg: 'bg-amber-500' },
                    { name: 'Cosmic Ruby', hex: '#e11d48', bg: 'bg-rose-600' },
                    { name: 'Black Pearl', hex: '#0f172a', bg: 'bg-slate-900' }
                  ].map((col) => (
                    <button
                      type="button"
                      key={col.hex}
                      onClick={() => setBrandConfig({ ...brandConfig, themeColor: col.hex })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        brandConfig.themeColor === col.hex 
                          ? 'border-fuchsia-500 ring-2 ring-fuchsia-50 text-slate-900 bg-slate-50' 
                          : 'border-slate-100 hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-md ${col.bg} border border-slate-100 shrink-0`} />
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between pb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Vetting Consent & GDPR Statement Override text</label>
                  <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8.5px] font-extrabold uppercase rounded font-mono">Compliance Guaranteed</span>
                </div>
                <textarea
                  rows={4}
                  value={brandConfig.gdprText}
                  onChange={(e) => setBrandConfig({ ...brandConfig, gdprText: e.target.value })}
                  className="w-full text-xs font-light leading-relaxed px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-50 focus:border-fuchsia-500 outline-none"
                />
              </div>

              {/* Email Delivery Gateway & Recruiter Alerts Configuration */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="flex items-center gap-2 pb-1">
                  <span className="p-1 px-1.5 bg-fuchsia-50 text-fuchsia-650 rounded-lg">
                    <Mail className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Email Gateway & Alerts Controller</h4>
                    <p className="text-[10px] text-slate-400 leading-none mt-0.5">Configure transactional key integrations (Resend/SendGrid) & alerts</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Active Email service Provider</label>
                    <select
                      value={brandConfig.emailProvider || 'simulated'}
                      onChange={(e) => setBrandConfig({ ...brandConfig, emailProvider: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-50 focus:border-fuchsia-500 bg-white outline-none"
                    >
                      <option value="simulated">Simulated Logs (Default Sandbox)</option>
                      <option value="resend">Resend Developer API (Real Emails)</option>
                      <option value="sendgrid">SendGrid REST API (Real Emails)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Sender Email Identity (From:)</label>
                    <input
                      type="email"
                      placeholder="onboarding@resend.dev"
                      value={brandConfig.senderEmail || ''}
                      onChange={(e) => setBrandConfig({ ...brandConfig, senderEmail: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-50 focus:border-fuchsia-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Recruiter Alert Recipient Email</label>
                    <input
                      type="email"
                      placeholder="recruiter@raincrew.ai"
                      value={brandConfig.recruiterAlertEmail || ''}
                      onChange={(e) => setBrandConfig({ ...brandConfig, recruiterAlertEmail: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-50 focus:border-fuchsia-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Developer Integration API Key</label>
                    <input
                      type="password"
                      placeholder={brandConfig.emailProvider === 'simulated' ? 'Not Required (Sandbox Mode)' : 'Enter re_xxx... or SG.xxx...'}
                      disabled={brandConfig.emailProvider === 'simulated'}
                      value={brandConfig.emailApiKey || ''}
                      onChange={(e) => setBrandConfig({ ...brandConfig, emailApiKey: e.target.value })}
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-50 focus:border-fuchsia-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveBrand}
                className="w-full py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-fuchsia-100 font-mono uppercase tracking-wider"
              >
                Apply Corporate Branding & Integrations
              </button>
            </div>
          </div>

          {/* Real-time Candidate preview mock */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Live Candidate Portal Preview</span>
              <div className="border border-slate-200/65 rounded-2xl overflow-hidden shadow-xs">
                {/* Visual header */}
                <div className="p-4 flex items-center justify-between border-b border-indigo-50/50" style={{ backgroundColor: brandConfig.themeColor }}>
                  <div className="flex items-center gap-2">
                    {brandConfig.logoUrl ? (
                      <img 
                        src={brandConfig.logoUrl} 
                        className="h-5 w-auto object-contain rounded" 
                        alt="Mock Logo" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <AudioLines className="w-4 h-4 text-white animate-pulse" />
                    )}
                    <span className="text-white text-xs font-extrabold tracking-tight font-display">
                      {brandConfig.appName || 'FoloUp'}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/80 bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-widest font-mono">Vetting Port</span>
                </div>
                {/* Body details */}
                <div className="p-4 bg-slate-50 space-y-3">
                  <div className="bg-white border border-slate-150 p-3 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold text-slate-800 font-display">Candidate Statement of Consent:</span>
                    <p className="text-[10px] text-slate-400 leading-normal font-light italic">
                      "{brandConfig.gdprText}"
                    </p>
                  </div>
                  <div className="py-2 flex justify-center">
                    <button style={{ backgroundColor: brandConfig.themeColor }} className="text-white text-[10px] font-bold py-1.5 px-4 rounded-lg opacity-90 select-none">
                      Accept Consent & Begin Vetting
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {saveSuccess && (
              <div className="bg-emerald-50 border border-emerald-110 text-emerald-800 p-3 rounded-2xl text-[10.5px] font-semibold text-center">
                ✓ Branding preferences updated and applied globally!
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Recruiter Profile card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">Recruiter Access</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingProfile(!isEditingProfile);
                    // Reset if toggled back
                    if (isEditingProfile) {
                      setRecruiterName(localStorage.getItem('recruiter_name') || 'Eleanor Vance');
                      setRecruiterTitle(localStorage.getItem('recruiter_title') || 'Director of Global Talent Acquisition');
                      setRecruiterEmail(localStorage.getItem('recruiter_email') || 'recruiter@raincrew.ai');
                      setRecruiterPhone(localStorage.getItem('recruiter_phone') || '+1 (555) 700-1122');
                      setRecruiterCompany(localStorage.getItem('recruiter_company') || 'Raincrew.AI Sandbox Technologies');
                    }
                  }}
                  className="text-[11px] font-bold text-indigo-650 hover:text-indigo-750 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>

              {isEditingProfile ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">My Full Name</label>
                    <input
                      type="text"
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                      value={recruiterName}
                      onChange={(e) => setRecruiterName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Professional Title</label>
                    <input
                      type="text"
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                      value={recruiterTitle}
                      onChange={(e) => setRecruiterTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Company / Organization</label>
                    <input
                      type="text"
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                      value={recruiterCompany}
                      onChange={(e) => setRecruiterCompany(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Business Email (Sandbox)</label>
                    <input
                      type="email"
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                      value={recruiterEmail}
                      onChange={(e) => setRecruiterEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Mobile / Telephone Number</label>
                    <input
                      type="text"
                      className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                      value={recruiterPhone}
                      onChange={(e) => setRecruiterPhone(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-md shadow-indigo-100"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-3 items-start">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-indigo-600 rounded-xl">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] uppercase font-bold text-slate-400 font-mono">Recruiter Operator</span>
                      <p className="text-sm font-extrabold text-slate-800 leading-tight">{recruiterName}</p>
                      <span className="text-[10px] text-slate-400 font-medium leading-none">{recruiterTitle}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-indigo-600 rounded-xl">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] uppercase font-bold text-slate-400 font-mono">Organization</span>
                      <p className="text-xs font-bold text-slate-700">{recruiterCompany}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-indigo-600 rounded-xl">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] uppercase font-bold text-slate-400 font-mono">Work Email</span>
                      <p className="text-xs font-bold text-slate-700 break-all">{recruiterEmail}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-indigo-600 rounded-xl">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] uppercase font-bold text-slate-400 font-mono">Work Telephone</span>
                      <p className="text-xs font-bold text-slate-700">{recruiterPhone}</p>
                    </div>
                  </div>

                  {saveSuccess && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-2.5 rounded-xl text-[10px] font-semibold text-center mt-1">
                      ✓ Workspace operator profiles updated successfully!
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Workspace status panel */}
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl space-y-3">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs font-mono">
                <Settings className="w-4.5 h-4.5 text-indigo-600" />
                <span>WORKSPACE CREDENTIALS</span>
              </div>
              <ul className="text-[11px] text-slate-500 space-y-2 list-none pl-0 leading-relaxed">
                <li className="flex justify-between border-b border-slate-200/45 pb-1">
                  <span>Vocal AI Model:</span>
                  <strong className="text-slate-800 font-mono">Gemini 2.5 Flash</strong>
                </li>
                <li className="flex justify-between border-b border-slate-200/45 pb-1">
                  <span>Proctoring Module:</span>
                  <strong className="text-slate-800">MediaPipe Combined</strong>
                </li>
                <li className="flex justify-between border-b border-slate-200/45 pb-1">
                  <span>Active Licence:</span>
                  <strong className="text-indigo-600">Private Sandbox Access</strong>
                </li>
                <li className="flex justify-between pb-1">
                  <span>STT Layer:</span>
                  <strong className="text-slate-800 font-mono">Browser SpeechRecogn.</strong>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Consolidated evaluations across all campaigns */}
          <div className="lg:col-span-8 space-y-6">
            
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">Consolidated Candidate Evaluations</h3>
                </div>

                {/* Live sound search */}
                <input
                  type="text"
                  placeholder="Query candidate name, email, or role..."
                  value={candidatesSearch}
                  onChange={(e) => setCandidatesSearch(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium w-full sm:max-w-xs focus:ring-2 focus:ring-indigo-100 outline-none focus:border-indigo-400"
                />
              </div>

              {/* Intelligent Competency-Based Filter Layer */}
              <div className="bg-slate-50/75 p-4 rounded-2xl border border-slate-200/85 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      🎯 Vetted Competency Filter ({selectedCompetencies.length} active)
                    </span>
                    {selectedCompetencies.length > 0 && (
                      <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {competencyMatchMode} Mode Active
                      </span>
                    )}
                  </div>
                  
                  {/* AND/OR Toggle Switch */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-400">Match Logic:</span>
                    <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 border border-slate-205">
                      <button
                        type="button"
                        onClick={() => setCompetencyMatchMode('OR')}
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${competencyMatchMode === 'OR' ? 'bg-indigo-600 text-white shadow-3xs' : 'text-slate-500 hover:text-slate-800'}`}
                        title="Match candidate with ANY of the selected competencies"
                      >
                        ANY (OR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompetencyMatchMode('AND')}
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${competencyMatchMode === 'AND' ? 'bg-indigo-600 text-white shadow-3xs' : 'text-slate-500 hover:text-slate-800'}`}
                        title="Candidate must show competency in ALL selected items"
                      >
                        ALL (AND)
                      </button>
                    </div>
                    {selectedCompetencies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCompetencies([])}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer underline decoration-dotted transition-colors ml-1"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Popular competency selectors list */}
                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {availableCompetencies.map(comp => {
                    const isSelected = selectedCompetencies.some(c => c.toLowerCase() === comp.toLowerCase());
                    return (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCompetencies(selectedCompetencies.filter(c => c.toLowerCase() !== comp.toLowerCase()));
                          } else {
                            setSelectedCompetencies([...selectedCompetencies, comp]);
                          }
                        }}
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shadow-3xs' 
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{comp}</span>
                        {isSelected && <span className="text-[9px] font-extrabold text-indigo-500">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredCandidates.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                    <FileText className="w-6 h-6 opacity-40" />
                  </div>
                  <p className="text-xs font-bold text-slate-600">No evaluations matched criteria</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-normal">
                    Complete candidate screening calls in the sandbox or search with a different search query.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
                        <th className="py-2.5 pb-2">Candidate Info</th>
                        <th className="py-2.5 pb-2">Vetting Campaign</th>
                        <th className="py-2.5 pb-2">Screening Date</th>
                        <th className="py-2.5 pb-2">Vocal Alerts</th>
                        <th className="py-2.5 pb-2 text-right">Adaptive Suitability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredCandidates.map((cand) => {
                        const camp = campaigns.find(c => c.id === cand.campaignId) || campaigns[0];
                        const isEvaluated = ['Completed', 'Evaluated'].includes(cand.status);
                        
                        return (
                          <tr 
                            key={cand.id}
                            onClick={() => {
                              if (cand.status === 'Evaluated' && camp) {
                                onViewReport(cand, camp);
                              }
                            }}
                            className={`group text-xs transition-colors ${cand.status === 'Evaluated' && camp ? 'hover:bg-slate-50/50 cursor-pointer' : ''}`}
                          >
                            <td className="py-3.5 pr-2">
                              <span className="font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors block leading-tight">
                                {maskName(cand.name, isAnonymousMode)}
                              </span>
                              <span className="text-[10px] text-slate-400 block break-all">
                                {maskEmail(cand.email, isAnonymousMode)}
                              </span>
                              
                              {/* Candidate Strengths & Match Indicator */}
                              {cand.strengths && cand.strengths.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5 max-w-[200px]">
                                  {cand.strengths.slice(0, 4).map((str, idx) => {
                                    const isFilterMatch = selectedCompetencies.some(
                                      c => str.toLowerCase().includes(c.toLowerCase())
                                    );
                                    return (
                                      <span 
                                        key={idx} 
                                        className={`text-[8.5px] px-1 py-0.5 rounded font-medium select-none tracking-tight transition-all duration-150 ${
                                          isFilterMatch 
                                            ? 'bg-indigo-600 text-white font-extrabold' 
                                            : 'bg-slate-100/90 text-slate-500 border border-slate-200/40'
                                        }`}
                                      >
                                        {str}
                                      </span>
                                    );
                                  })}
                                  {cand.strengths.length > 4 && (
                                    <span className="text-[8px] text-slate-400 mt-0.5 font-bold">
                                      +{cand.strengths.length - 4} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 pr-2">
                              <span className="font-semibold text-slate-700 block">
                                {camp ? camp.title : 'General Vetting Opportunity'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {camp ? camp.department : 'General'}
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-550 font-medium">
                              {new Date(cand.appliedDate || Date.now()).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="py-3.5">
                              {cand.suspiciousVoiceNoise ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 select-none">
                                  <AlertCircle className="w-3 h-3" /> Integrity Check
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 select-none">
                                  ✓ Cleared
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 text-right font-mono pr-1">
                              {cand.status === 'Evaluated' ? (
                                <div className="flex items-center justify-end gap-2.5">
                                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${getFitBadgeColor(cand.fitCategory)}`}>
                                    {cand.fitCategory} ({cand.score}%)
                                  </span>
                                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all md:inline hidden" />
                                </div>
                              ) : cand.status === 'Completed' ? (
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                  AI Evaluating...
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
      )}

      <ConfirmModal
        isOpen={campaignToDelete !== null}
        title="Delete Recruitment Campaign"
        message="Are you sure you want to delete this recruitment campaign? All candidate evaluation scorecards inside this campaign will be lost permanently."
        onConfirm={() => {
          if (campaignToDelete) {
            onDeleteCampaign(campaignToDelete);
          }
          setCampaignToDelete(null);
        }}
        onCancel={() => setCampaignToDelete(null)}
        isDanger={true}
        confirmText="Permanently Delete"
      />
    </div>
  );
}
