import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Plus, Calendar, Star, CheckCircle, Award, 
  Trash2, Mail, Phone, ExternalLink, Filter, UserCheck, Play,
  Sliders, Search, ArrowUpDown, Check, Copy, CheckSquare, Square,
  Sparkles, TrendingUp, TrendingDown, FileDown, BookOpen, Volume2,
  ShieldAlert, Download, Languages, Lock, Scale, X, Trello
} from 'lucide-react';
import { Campaign, Candidate, maskName, maskEmail } from '../types';
import { addCandidate, deleteCandidate, updateCampaignWeights, updateCandidateEvaluation, getHeaders } from '../lib/storage';
import { ConfirmModal } from './ConfirmModal';
import { RadarChart, RadarMetric, RadarCandidateData } from './RadarChart';
import KanbanBoard from './KanbanBoard';

interface CampaignDetailsProps {
  campaign: Campaign;
  candidates: Candidate[];
  onBack: () => void;
  onOpenReport: (candidate: Candidate) => void;
  onLaunchInterview: (candidateId?: string) => void;
  onRefresh: () => void;
  isAnonymousMode?: boolean;
}

export default function CampaignDetails({ 
  campaign, candidates, onBack, onOpenReport, onLaunchInterview, onRefresh, isAnonymousMode = false 
}: CampaignDetailsProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'Pending' | 'Evaluated'>('all');
  const [viewMode, setViewMode] = useState<'pipeline' | 'kanban' | 'leaderboard'>('pipeline');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState<string | null>(null);
  
  // Security Flag and language selection states
  const [showFlagsOnly, setShowFlagsOnly] = useState(false);
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<'all' | 'us' | 'accent'>('all');
  
  // Search, sort & select state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score-desc' | 'score-asc' | 'date-desc' | 'date-asc'>('score-desc');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Deletion helper state
  const [candidateToDelete, setCandidateToDelete] = useState<string | null>(null);

  // Weights modification state
  const [isTuningWeights, setIsTuningWeights] = useState(false);
  const [techWeight, setTechWeight] = useState(campaign.weights?.technical ?? 40);
  const [archWeight, setArchWeight] = useState(campaign.weights?.architecture ?? 30);
  const [commWeight, setCommWeight] = useState(campaign.weights?.communication ?? 30);
  const [voicePref, setVoicePref] = useState<'male' | 'female'>(campaign.voiceSex ?? 'female');
  const [weightsMessage, setWeightsMessage] = useState('');
  
  // Custom interactive email invitation states
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);

  // Sync state variables when campaign switches (crucial React bugfix)
  useEffect(() => {
    setTechWeight(campaign.weights?.technical ?? 40);
    setArchWeight(campaign.weights?.architecture ?? 30);
    setCommWeight(campaign.weights?.communication ?? 30);
    setVoicePref(campaign.voiceSex ?? 'female');
    setSelectedCandidates([]); // Clear comparative buffer
  }, [campaign.id]);

  // New candidate form
  const [candName, setCandName] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candPhone, setCandPhone] = useState('');
  const [formError, setFormError] = useState('');

  // AI Resume Scanner state
  const [modalTab, setModalTab] = useState<'manual' | 'ai'>('manual');
  const [rawResumeText, setRawResumeText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Extract component scores mapping to 3 pillars
  const getPillarScores = (cand: Candidate) => {
    const scores = cand.detailedScores || [];
    let technical = 80;
    let architecture = 80;
    let communication = 80;

    scores.forEach(s => {
      const criteriaLower = s.criteria.toLowerCase();
      if (
        criteriaLower.includes('tech') || 
        criteriaLower.includes('selling') || 
        criteriaLower.includes('depth') || 
        criteriaLower.includes('competency')
      ) {
        technical = s.score;
      } else if (
        criteriaLower.includes('architect') || 
        criteriaLower.includes('objection') || 
        criteriaLower.includes('ux') || 
        criteriaLower.includes('css') || 
        criteriaLower.includes('style')
      ) {
        architecture = s.score;
      } else if (
        criteriaLower.includes('comm') || 
        criteriaLower.includes('culture') || 
        criteriaLower.includes('lead') || 
        criteriaLower.includes('qualification')
      ) {
        communication = s.score;
      }
    });

    return { technical, architecture, communication };
  };

  // Compute weighted score
  const getWeightedScore = (cand: Candidate) => {
    if (cand.status !== 'Evaluated') return 0;
    const pillars = getPillarScores(cand);
    const totalWeight = techWeight + archWeight + commWeight;
    if (totalWeight === 0) return cand.score;
    return Math.round(
      (pillars.technical * techWeight + 
       pillars.architecture * archWeight + 
       pillars.communication * commWeight) / totalWeight
    );
  };

  const getCandidateRadarMetric = (cand: Candidate): RadarMetric => {
    const pillars = getPillarScores(cand);
    const qnaAvg = cand.qnaPairs && cand.qnaPairs.length > 0
      ? Math.round(cand.qnaPairs.reduce((acc, q) => acc + q.rating, 0) / cand.qnaPairs.length)
      : Math.round((pillars.technical + pillars.architecture) / 2);

    const scenario = Math.max(40, Math.min(100, qnaAvg));
    const proctorFlags = (cand.tabSwitchCount || 0) + (cand.longSilenceCount || 0) + (cand.suspiciousVoiceNoise ? 1 : 0) + (cand.fullscreenExitCount || 0) + (cand.screenChangeCount || 0);
    const fitPenalty = proctorFlags * 8;
    const fit = Math.max(30, Math.min(100, Math.round((cand.score || 80) * 0.95 + 5 - fitPenalty)));

    return {
      technical: pillars.technical,
      architecture: pillars.architecture,
      communication: pillars.communication,
      scenario: scenario,
      fit: fit
    };
  };

  // Filtering, searching & sorting sequence
  const processedCandidates = candidates
    .filter(c => {
      // Role match active filter
      if (activeFilter !== 'all' && c.status !== activeFilter) return false;
      
      // Security flags filter
      if (showFlagsOnly) {
        const hasFlags = (c.tabSwitchCount && c.tabSwitchCount > 0) || 
                         (c.longSilenceCount && c.longSilenceCount > 0) || 
                         c.suspiciousVoiceNoise === true ||
                         (c.fullscreenExitCount && c.fullscreenExitCount > 0) ||
                         (c.screenChangeCount && c.screenChangeCount > 0);
        if (!hasFlags) return false;
      }

      // Voice styles / languages filter
      if (selectedLanguageFilter !== 'all') {
        const lang = c.spokenLanguage?.toLowerCase() || '';
        if (selectedLanguageFilter === 'us') {
          if (!lang.includes('us') && lang !== '') return false;
        } else if (selectedLanguageFilter === 'accent') {
          if (lang.includes('us') || lang === '') return false;
        }
      }

      // Keyword match query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesTranscript = c.transcript?.some(t => t.text.toLowerCase().includes(query)) || false;
        const matchesQna = c.qnaPairs?.some(q => q.answer.toLowerCase().includes(query) || q.question.toLowerCase().includes(query)) || false;
        const matchesEval = c.overallEvaluation?.toLowerCase().includes(query) || false;
        return (
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          (c.phone && c.phone.includes(query)) ||
          matchesTranscript ||
          matchesQna ||
          matchesEval
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score-desc') {
        return getWeightedScore(b) - getWeightedScore(a);
      }
      if (sortBy === 'score-asc') {
        return getWeightedScore(a) - getWeightedScore(b);
      }
      if (sortBy === 'date-desc') {
        return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.appliedDate).getTime() - new Date(b.appliedDate).getTime();
      }
      return 0;
    });

  const handleInviteSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!candName.trim() || !candEmail.trim()) {
      setFormError('Name and email are required fields.');
      return;
    }
    setFormError('');
    
    addCandidate({
      campaignId: campaign.id,
      name: candName.trim(),
      email: candEmail.trim(),
      phone: candPhone.trim()
    });

    setCandName('');
    setCandEmail('');
    setCandPhone('');
    setShowInviteModal(false);
    onRefresh(); // Trigger parent reload
  };

  const handleResumeFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setScanError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex !== -1) {
          const base64 = dataUrl.substring(commaIndex + 1);
          setUploadedFile({
            base64: base64,
            mimeType: file.type || 'application/octet-stream',
            name: file.name
          });
          
          if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
            const textReader = new FileReader();
            textReader.onload = (textEvent) => {
              setRawResumeText(textEvent.target?.result as string || '');
            };
            textReader.readAsText(file);
          } else {
            setRawResumeText(`[Uploaded Binary File: ${file.name}]`);
          }
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleScanResume = async () => {
    if (!rawResumeText.trim() && !uploadedFile) {
      setScanError("Please paste or upload some resume content first.");
      return;
    }
    setScanError(null);
    setIsAiScanning(true);

    try {
      const response = await fetch('/api/parse_resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: rawResumeText.trim(),
          fileBase64: uploadedFile?.base64 || null,
          mimeType: uploadedFile?.mimeType || null,
          fileName: uploadedFile?.name || null,
          jobTitle: campaign.title,
          jobDescription: campaign.description
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to parse candidate resume matching.");
      }

      const parsedData = await response.json();

      // Create candidate via standard addCandidate
      const newCand = addCandidate({
        campaignId: campaign.id,
        name: parsedData.name || "Parsed Candidate",
        email: parsedData.email || "parsed@example.com",
        phone: parsedData.phone || ""
      });

      // Update their scorecard instantly with evaluation
      updateCandidateEvaluation(newCand.id, {
        status: 'Evaluated',
        duration: 'Resume Match',
        score: parsedData.score || 80,
        fitCategory: parsedData.fitCategory || 'Shortlist',
        overallEvaluation: parsedData.explanation || 'Analyzed automatically using Gemini Resume matching.',
        strengths: parsedData.strengths || [],
        weaknesses: parsedData.weaknesses || [],
        qnaPairs: [
          {
            question: "Automatic AI Resume Screening Alignment Fit",
            answer: parsedData.explanation || "No clarification details returned.",
            rating: parsedData.score || 80,
            feedback: "Parsed and graded against campaign criteria."
          }
        ]
      });

      // Reset
      setRawResumeText('');
      setUploadedFile(null);
      setModalTab('manual');
      setShowInviteModal(false);
      onRefresh(); // reload parent
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || "Network delay or key configurations prevented completion.");
    } finally {
      setIsAiScanning(false);
    }
  };

  const handleDeleteCandidate = (candId: string) => {
    setCandidateToDelete(candId);
  };

  const handleSaveWeights = () => {
    updateCampaignWeights(campaign.id, {
      technical: techWeight,
      architecture: archWeight,
      communication: commWeight
    }, voicePref);
    
    setWeightsMessage('Evaluation filters updated successfully! Candidate indexes reordered.');
    setTimeout(() => {
      setWeightsMessage('');
      setIsTuningWeights(false);
    }, 2000);
    onRefresh();
  };

  const toggleSelectCandidate = (candId: string) => {
    setSelectedCandidates(prev => {
      if (prev.includes(candId)) {
        return prev.filter(id => id !== candId);
      } else {
        return [...prev, candId];
      }
    });
  };

  const handleCopyInviteLink = (candName: string, candEmail: string) => {
    const interviewLink = `${window.location.origin}/?role=candidate&campId=${campaign.id}&name=${encodeURIComponent(candName)}&email=${encodeURIComponent(candEmail)}`;
    const inviteTemplate = `Hi ${candName},\n\nWe would love to invite you to do a secure oral screening interview for the ${campaign.title} vacancy at our firm.\n\nYou can start the digital interviewer anytime at:\n${interviewLink}\n\nBest of luck,\nHiring Operations Group`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteTemplate);
      setInviteLinkCopied(candName);
      setTimeout(() => setInviteLinkCopied(null), 3000);
    } else {
      alert("Invitation script copied! Link: " + interviewLink);
    }
  };

  const handleSendEmailInvite = async (candId: string, candName: string, candEmail: string) => {
    setSendingEmailId(candId);
    setEmailStatusMessage(null);
    const interviewLink = `${window.location.origin}/?role=candidate&campId=${campaign.id}&name=${encodeURIComponent(candName)}&email=${encodeURIComponent(candEmail)}`;
    
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email: candEmail,
          candidateName: candName,
          campaignTitle: campaign.title,
          interviewLink: interviewLink
        })
      });
      
      const resData = await response.json().catch(() => ({}));
      if (response.ok && resData.success) {
        setEmailStatusMessage(`Successfully dispatched invitation email to ${candEmail}! Status: ${resData.gatewayResponse || 'Delivered'}`);
        setTimeout(() => {
          setEmailStatusMessage(null);
        }, 5000);
        onRefresh();
      } else {
        setEmailStatusMessage(`Error dispatching email: ${resData.error || 'Server rejected request'}`);
      }
    } catch (err) {
      console.error(err);
      setEmailStatusMessage("Network error during invitation dispatch.");
    } finally {
      setSendingEmailId(null);
    }
  };

  const getFitBadgeColor = (category?: string) => {
    if (!category) return 'bg-slate-50 text-slate-400';
    switch (category) {
      case 'Hire':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Shortlist':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Reject':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Evaluated':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Completed':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'In-Progress':
        return 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse';
      case 'Pending':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Comparative metrics extraction for selected candidates
  const candidatesToCompare = candidates.filter(c => selectedCandidates.includes(c.id) && c.status === 'Evaluated');

  const exportCampaignCandidatesCSV = () => {
    // 1. Define columns headers
    const headers = [
      "Candidate Name",
      "Email Address",
      "Phone",
      "Status",
      "Fit Score %",
      "Adjusted Weighted Score %",
      "Hiring Verdict",
      "Vetting Applied Date",
      "Call Duration",
      "Vetted Strengths",
      "Identified Gaps",
      "Executive Summary Digest"
    ];

    // 2. Map row data
    const rows = candidates.map(cand => {
      const strengthsStr = cand.strengths ? cand.strengths.join("; ") : "";
      const weaknessesStr = cand.weaknesses ? cand.weaknesses.join("; ") : "";
      const score = cand.score || 0;
      const weightedScore = getWeightedScore(cand);
      
      const rowData = [
        cand.name || "",
        cand.email || "",
        cand.phone || "",
        cand.status || "Pending",
        score.toString(),
        weightedScore.toString(),
        cand.fitCategory || "Pending",
        cand.appliedDate ? new Date(cand.appliedDate).toLocaleDateString() : "",
        cand.duration || "N/A",
        strengthsStr,
        weaknessesStr,
        cand.overallEvaluation || ""
      ];

      // Escape quotes and double wrap to prevent column breaks
      return rowData.map(val => {
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(",");
    });

    // 3. Assemble CSV string
    const csvContent = [headers.join(","), ...rows].join("\n");
    
    // 4. Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const campaignTitleEscaped = campaign.title.replace(/\s+/g, '_').toLowerCase();
    link.setAttribute("download", `candidates_export_${campaignTitleEscaped}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6 max-w-7xl mx-auto pb-12 px-4"
    >
      {/* Upper header summary */}
      {emailStatusMessage && (
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-200 p-4.5 rounded-3xl flex items-center gap-3 text-xs text-indigo-900 font-semibold animate-pulse shadow-xs">
          <Mail className="w-5 h-5 text-indigo-600 animate-bounce" />
          <span>{emailStatusMessage}</span>
        </div>
      )}

      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm flex items-start justify-between flex-wrap gap-4">
        <div className="flex gap-4 items-center">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-50 border border-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">{campaign.title}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-white font-bold text-[10px] uppercase tracking-wider">{campaign.department}</span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">Campaign active since: {new Date(campaign.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCampaignCandidatesCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-all"
            title="Download full campaign candidates pipeline report in spreadsheet formats"
          >
            <Download className="w-4 h-4 text-emerald-100" /> Export CSV
          </button>
          <button
            onClick={() => setIsTuningWeights(!isTuningWeights)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
              isTuningWeights ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-4 h-4" /> Vetting Configuration
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" /> Add Candidate
          </button>
        </div>
      </div>

      {weightsMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-500" /> {weightsMessage}
        </motion.div>
      )}

      {/* Interactive Criteria Param Tuning Panel */}
      <AnimatePresence>
        {isTuningWeights && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 shadow-md"
          >
            <div className="max-w-4xl space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-extrabold flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5" /> Analytical Screening Weights customizer
                </span>
                <p className="text-slate-200 text-sm font-semibold">Tweak scoring category values, changing the relative priority of each core criteria:</p>
                <p className="text-slate-400 text-xs">This instantly recalculates the Adjusted Fit Score for each evaluated applicant and ranks them dynamically.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3">
                {/* Tech Slider */}
                <div className="space-y-2 bg-slate-850/50 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Technical Skill & Domain Depth</span>
                    <span className="font-mono font-bold text-blue-400">{techWeight}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={techWeight} 
                    onChange={(e) => setTechWeight(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[10px] text-slate-500">Evaluates React internals, CSS responsive mastery, Sales closing strategy, etc.</p>
                </div>

                {/* Arch Slider */}
                <div className="space-y-2 bg-slate-850/50 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Architectural Logic & Objections</span>
                    <span className="font-mono font-bold text-indigo-400">{archWeight}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={archWeight} 
                    onChange={(e) => setArchWeight(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500">Evaluates performance profiling, structural design, objection resilience, margins.</p>
                </div>

                {/* Communication Slider */}
                <div className="space-y-2 bg-slate-850/50 p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Clarity & Presentation Style</span>
                    <span className="font-mono font-bold text-purple-400">{commWeight}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={commWeight} 
                    onChange={(e) => setCommWeight(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-purple-500"
                  />
                  <p className="text-[10px] text-slate-500">Evaluates presentation clarity, structured delivery models, culture, tone.</p>
                </div>
              </div>

              {/* TTS AI voice selector preference */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-300">Digital Voice Identity Accent</h4>
                    <p className="text-[10px] text-slate-400">Choose gender synthesis of the AI recruiter conversation system for this active vacancy:</p>
                  </div>
                </div>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10 select-none">
                  <button
                    onClick={() => setVoicePref('female')}
                    className={`px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${voicePref === 'female' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Female (Default Puck/Samantha)
                  </button>
                  <button
                    onClick={() => setVoicePref('male')}
                    className={`px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${voicePref === 'male' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Male (Daniel/James)
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setTechWeight(campaign.weights?.technical ?? 40);
                    setArchWeight(campaign.weights?.architecture ?? 30);
                    setCommWeight(campaign.weights?.communication ?? 30);
                    setVoicePref(campaign.voiceSex ?? 'female');
                    setIsTuningWeights(false);
                  }}
                  className="px-4 py-1.5 rounded-xl border border-white/10 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveWeights}
                  className="px-4 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Apply & Recalculate
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Campaign configurations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b border-slate-50 pb-2 flex items-center gap-1.5">
              <BookOpen className="w-4.5 h-4.5 text-blue-500" /> Vacancy Outline
            </h2>
            
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400">Experience Requirement:</p>
              <p className="text-slate-800 text-sm font-semibold">{campaign.experience}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 font-sans">Role Summary:</p>
              <p className="text-slate-600 text-xs leading-relaxed text-justify">{campaign.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <p className="text-xs font-bold text-slate-755 uppercase tracking-wider font-mono">Screening Technology Configuration</p>
              
              <div className="space-y-2 text-xs">
                {/* Speech-to-Text Engine Details */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">STT ENGINE STACK</p>
                    <p className="font-semibold text-slate-850">
                      {campaign.sttEngine === 'assemblyai' ? 'AssemblyAI Universal-2' : 
                       campaign.sttEngine === 'whisper' ? 'Self-Hosted Whisper' : 'Deepgram Nova-3'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100/50">
                    {campaign.sttEngine === 'assemblyai' ? 'Post-Analytic' : 
                     campaign.sttEngine === 'whisper' ? 'On-Premise' : 'Sub-300ms WS'}
                  </span>
                </div>

                {/* MediaPipe Anti-Cheat Details */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CAMERA PROCTORING</p>
                    <p className="font-semibold text-slate-850">MediaPipe FaceLandmarker</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${
                    campaign.enableMediaPipeCameraProctor !== false 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : 'bg-rose-50 text-rose-700 border-rose-100'
                  }`}>
                    {campaign.enableMediaPipeCameraProctor !== false ? 'Active Check' : 'Disabled'}
                  </span>
                </div>

                {/* GDPR Consent text custom override indicator */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GDPR COMPLIANCE</p>
                    <p className="font-semibold text-slate-850">Biometric Statement</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-750 border border-indigo-100">
                    {campaign.gdprConsentTextOverride ? 'Customized' : 'Standard'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <p className="text-xs font-bold text-slate-755 uppercase tracking-wider font-mono">Evaluation Metrics Weights</p>
              <div className="grid grid-cols-3 text-center text-[10px] gap-2">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-slate-400 font-medium">Domain</p>
                  <p className="text-slate-700 font-bold mt-0.5">{techWeight}%</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-slate-400 font-medium">Logic</p>
                  <p className="text-slate-700 font-bold mt-0.5">{archWeight}%</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-slate-400 font-medium">Vocal Style</p>
                  <p className="text-slate-700 font-bold mt-0.5">{commWeight}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Oral Questions Board</span>
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            </h2>
            <div className="space-y-3.5">
              {campaign.questions.map((q, i) => (
                <div key={i} className="space-y-1">
                  <span className="font-mono text-[9px] font-bold text-blue-400 bg-slate-950 border border-white/5 p-1 py-0.5 rounded uppercase tracking-wide">Q{i + 1} SCREEN</span>
                  <p className="text-slate-200 text-xs leading-relaxed font-sans">{q}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Active candidate applicant pipeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            
            {/* Table Controller filter menu */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="w-4.5 h-4.5 text-blue-500" /> Vetting Pipeline ({processedCandidates.length})
                </h3>

                <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 flex gap-0.5 text-[11px] font-semibold dark:bg-slate-800 dark:border-slate-700">
                  <button
                    onClick={() => setViewMode('pipeline')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === 'pipeline' 
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' 
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Standard Pipeline
                  </button>
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'kanban' 
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' 
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Trello className="w-3.5 h-3.5 text-indigo-500" />
                    Status Kanban
                  </button>
                  <button
                    onClick={() => setViewMode('leaderboard')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      viewMode === 'leaderboard' 
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white' 
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/20" />
                    Interactive Leaderboard
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Search query box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search candidate name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400 w-44 bg-slate-50/50"
                  />
                </div>

                {/* Applied active filter menu tabs */}
                <div className="bg-slate-50 p-0.5 rounded-lg border border-slate-100 flex gap-0.5 font-medium">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeFilter === 'all' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-850'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setActiveFilter('Pending')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeFilter === 'Pending' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-850'}`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setActiveFilter('Evaluated')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeFilter === 'Evaluated' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-850'}`}
                  >
                    Evaluated
                  </button>
                </div>
              </div>
            </div>

            {/* Sub Filter: Sorting controller & comparative indicator bar */}
            <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 font-medium">Sort Order:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="score-desc">Highest Fit Score First</option>
                    <option value="score-asc">Lowest Fit Score First</option>
                    <option value="date-desc">Newest Applicants</option>
                    <option value="date-asc">Oldest Applicants</option>
                  </select>
                </div>

                {/* Comparative Drawer Activator */}
                <div className="flex items-center gap-2 text-xs">
                  {selectedCandidates.length > 0 && (
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-0.5 font-bold">
                      {selectedCandidates.length} selected for side comparison
                    </span>
                  )}
                  <button
                    disabled={selectedCandidates.length < 2}
                    onClick={() => setShowCompareModal(true)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
                      selectedCandidates.length >= 2 
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title="Select at least two evaluated candidates on checkboxes to activate"
                  >
                    Compare Side-by-Side
                  </button>
                </div>
              </div>

              {/* Integrity & Compliance filters bar */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Security Flag Filter Toggle */}
                  <button
                    onClick={() => setShowFlagsOnly(!showFlagsOnly)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-all ${
                      showFlagsOnly 
                        ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-55'
                    }`}
                  >
                    <ShieldAlert className={`w-3.5 h-3.5 ${showFlagsOnly ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
                    <span>Security Flags Only {candidates.filter(c => (c.tabSwitchCount && c.tabSwitchCount > 0) || (c.longSilenceCount && c.longSilenceCount > 0) || c.suspiciousVoiceNoise || (c.fullscreenExitCount && c.fullscreenExitCount > 0) || (c.screenChangeCount && c.screenChangeCount > 0)).length > 0 && `(${candidates.filter(c => (c.tabSwitchCount && c.tabSwitchCount > 0) || (c.longSilenceCount && c.longSilenceCount > 0) || c.suspiciousVoiceNoise || (c.fullscreenExitCount && c.fullscreenExitCount > 0) || (c.screenChangeCount && c.screenChangeCount > 0)).length})`}</span>
                  </button>

                  {/* Vocal Style Accent Filter */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Accent Style:</span>
                    <select
                      value={selectedLanguageFilter}
                      onChange={(e) => setSelectedLanguageFilter(e.target.value as any)}
                      className="bg-white border border-slate-200 rounded-md p-1 py-0.5 text-[10px] text-slate-600 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="all">All Styles</option>
                      <option value="us">US English Accent</option>
                      <option value="accent">Regional & Other Accents</option>
                    </select>
                  </div>
                </div>

                {/* GDPR Quick Audit Label */}
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                  <Lock className="w-3 h-3 text-slate-350" />
                  <span>ISO 27001 & GDPR Secure Pool</span>
                </div>
              </div>
            </div>

            {/* Pipeline list */}
            {viewMode === 'kanban' ? (
              <KanbanBoard
                campaign={campaign}
                candidates={processedCandidates}
                getWeightedScore={getWeightedScore}
                onRefresh={onRefresh}
                isAnonymousMode={isAnonymousMode}
                onOpenReport={onOpenReport}
                onLaunchInterview={onLaunchInterview}
              />
            ) : viewMode === 'pipeline' ? (
              processedCandidates.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-slate-400 text-sm italic">No entries match the active search or pipeline filters.</p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  Add candidate profile +
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 border border-slate-50 rounded-2xl overflow-hidden">
                {processedCandidates.map((cand, i) => {
                  const adjustedScore = getWeightedScore(cand);
                  const isCheckedForCompare = selectedCandidates.includes(cand.id);
                  const isEvaluated = cand.status === 'Evaluated';

                  return (
                    <motion.div
                      key={cand.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className={`p-4 flex flex-wrap items-center justify-between gap-4 group transition-all ${
                        isCheckedForCompare ? 'bg-indigo-50/20' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Basic details and Check selection for comparison */}
                      <div className="flex items-start gap-3 max-w-sm">
                        {/* Comparison selection tick box */}
                        {isEvaluated ? (
                          <button
                            onClick={() => toggleSelectCandidate(cand.id)}
                            className="text-slate-400 hover:text-indigo-600 focus:outline-none cursor-pointer mt-0.5 flex-shrink-0"
                            title="Choose to compare this candidate side-by-side"
                          >
                            {isCheckedForCompare ? (
                              <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                            ) : (
                              <Square className="w-4.5 h-4.5 text-slate-350" />
                            )}
                          </button>
                        ) : (
                          <div className="w-4.5 h-4.5 border border-slate-100 rounded-md bg-slate-50/40 flex-shrink-0 cursor-not-allowed" title="Candidate must take voice screening first" />
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800">{maskName(cand.name, isAnonymousMode)}</p>
                            <span className={`px-2 py-0.2 border text-[9px] font-bold rounded-full ${getStatusBadgeColor(cand.status)}`}>
                              {cand.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-350" /> {maskEmail(cand.email, isAnonymousMode)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-350" /> Applied: {new Date(cand.appliedDate).toLocaleDateString()}</span>
                          </div>

                          {/* Compliance & voice style visual badges */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {cand.spokenLanguage && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-semibold border border-slate-200">
                                <Languages className="w-2.5 h-2.5 text-slate-450" />
                                {cand.spokenLanguage}
                              </span>
                            )}
                            {cand.consentAgreedTime && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[9px] font-bold border border-emerald-100/60" title={`GDPR Consent stamped on ${new Date(cand.consentAgreedTime).toLocaleDateString()}`}>
                                <Lock className="w-2.5 h-2.5 text-emerald-500" />
                                GDPR Consent
                              </span>
                            )}
                            {/* Security Warning Telemetry indicators */}
                            {((cand.tabSwitchCount && cand.tabSwitchCount > 0) || (cand.longSilenceCount && cand.longSilenceCount > 0) || cand.suspiciousVoiceNoise || (cand.fullscreenExitCount && cand.fullscreenExitCount > 0) || (cand.screenChangeCount && cand.screenChangeCount > 0)) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[9px] font-extrabold border border-rose-100" title={`Threat factors detected: Tab switches: ${cand.tabSwitchCount || 0}, Pauses: ${cand.longSilenceCount || 0}, Fullscreen exits: ${cand.fullscreenExitCount || 0}, Screen changes: ${cand.screenChangeCount || 0}, Ambient mismatch: ${cand.suspiciousVoiceNoise ? 'Yes' : 'No'}`}>
                                <ShieldAlert className="w-2.5 h-2.5 text-rose-500 animate-pulse" />
                                Flagged ({ (cand.tabSwitchCount || 0) + (cand.longSilenceCount || 0) + (cand.suspiciousVoiceNoise ? 1 : 0) + (cand.fullscreenExitCount || 0) + (cand.screenChangeCount || 0) })
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pipeline analytics values */}
                      <div className="flex items-center gap-4">
                        {/* Evaluation index scores */}
                        {isEvaluated && (
                          <div className="text-right space-y-0.5">
                            <div className="flex items-center justify-end gap-1 font-bold text-slate-800">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
                              <span className="text-sm">{cand.score}</span>
                              <span className="text-slate-400 text-xs">/100</span>

                              {/* Adjusted score representation */}
                              {adjustedScore !== cand.score && (
                                <span className={`text-[10px] font-extrabold flex items-center gap-0.5 ml-1.5 px-1.5 py-0.2 rounded-md ${
                                  adjustedScore > cand.score ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'
                                }`}>
                                  {adjustedScore > cand.score ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3" />}
                                  Weighted: {adjustedScore}
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-0.2 border text-[9px] font-semibold rounded ${getFitBadgeColor(cand.fitCategory)}`}>
                              {cand.fitCategory}
                            </span>
                          </div>
                        )}

                        {/* Controls */}
                        <div className="flex items-center gap-1">
                          {isEvaluated ? (
                            <button
                              onClick={() => onOpenReport(cand)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-slate-150 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-all"
                            >
                              Open Report <ExternalLink className="w-3.5 h-3.5 opacity-55" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSendEmailInvite(cand.id, cand.name, cand.email)}
                                disabled={sendingEmailId !== null}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                                  sendingEmailId === cand.id
                                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                                    : 'bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50 text-indigo-700 hover:border-indigo-200'
                                }`}
                                title="Send live email invitation containing the candidate interview link via Resend API"
                              >
                                <Mail className="w-3 h-3 text-indigo-550" />
                                {sendingEmailId === cand.id ? 'Sending...' : 'Send Mail'}
                              </button>
                              <button
                                onClick={() => handleCopyInviteLink(cand.name, cand.email)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer ${
                                  inviteLinkCopied === cand.name 
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                                    : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'
                                }`}
                                title="Copy email screening request model copy for applicant"
                              >
                                {inviteLinkCopied === cand.name ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                {inviteLinkCopied === cand.name ? 'Invite Copied!' : 'Copy Invite'}
                              </button>
                              <button
                                onClick={() => onLaunchInterview(cand.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white text-[10px] font-bold rounded-lg shadow-sm cursor-pointer transition-all"
                              >
                                <Play className="w-2.5 h-2.5 fill-current text-blue-400" /> Start simulator
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteCandidate(cand.id)}
                            className="p-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-100 text-slate-300 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )) : (
              <div className="space-y-4">
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-150 rounded-2xl flex items-start gap-3 dark:bg-slate-900 dark:border-slate-800">
                  <Award className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-indigo-950 dark:text-indigo-350">Visual Multi-Applicant Ranking & Leaderboard</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Applicants are cataloged instantly into structural fit blocks based on evaluations. Tweak weighting thresholds inside the Left configurations panel to automatically re-rank candidate card priority in descending order.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* HIRE BLOCK */}
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3 flex flex-col min-h-[380px]">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-2.5">
                      <span className="text-xs font-extrabold text-emerald-850 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Hire Target
                      </span>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-extrabold uppercase font-mono">
                        {processedCandidates.filter(c => c.status === 'Evaluated' && c.fitCategory === 'Hire').length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px]">
                      {processedCandidates
                        .filter(c => c.status === 'Evaluated' && c.fitCategory === 'Hire')
                        .sort((a, b) => getWeightedScore(b) - getWeightedScore(a))
                        .map((cand) => {
                          const adjustedScore = getWeightedScore(cand);
                          const pillars = getPillarScores(cand);
                          return (
                            <motion.div
                              key={cand.id}
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-white dark:bg-slate-850 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-2.5"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-xs font-bold text-slate-850 dark:text-slate-200 truncate max-w-[120px]" title={cand.name}>
                                  {maskName(cand.name, isAnonymousMode)}
                                </span>
                                <div className="bg-emerald-50 dark:bg-emerald-950 px-2 py-1 rounded-lg text-emerald-850 dark:text-emerald-300 text-center select-none font-mono">
                                  <span className="text-xs font-extrabold leading-none">{adjustedScore}%</span>
                                </div>
                              </div>

                              <div className="space-y-1 text-[9px] text-slate-400 dark:text-slate-500">
                                <div className="flex justify-between">
                                  <span>Domain Mastery:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-350">{pillars.technical}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Vocal Clarity:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-350">{pillars.communication}%</span>
                                </div>
                              </div>

                              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 text-[9px] font-mono">{cand.duration}</span>
                                <button
                                  onClick={() => {
                                    onOpenReport(cand);
                                  }}
                                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold transition-all"
                                >
                                  Open Report →
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      {processedCandidates.filter(c => c.status === 'Evaluated' && c.fitCategory === 'Hire').length === 0 && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic text-center py-8">No matching applicants in Hire bucket.</p>
                      )}
                    </div>
                  </div>

                  {/* SHORTLIST BLOCK */}
                  <div className="bg-slate-55 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3 flex flex-col min-h-[380px]">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-2.5">
                      <span className="text-xs font-extrabold text-amber-805 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Shortlist
                      </span>
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-955 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-extrabold uppercase font-mono">
                        {processedCandidates.filter(c => c.status === 'Evaluated' && c.fitCategory === 'Shortlist').length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px]">
                      {processedCandidates
                        .filter(c => c.status === 'Evaluated' && c.fitCategory === 'Shortlist')
                        .sort((a, b) => getWeightedScore(b) - getWeightedScore(a))
                        .map((cand) => {
                          const adjustedScore = getWeightedScore(cand);
                          const pillars = getPillarScores(cand);
                          return (
                            <motion.div
                              key={cand.id}
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-white dark:bg-slate-850 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-2.5"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-xs font-bold text-slate-850 dark:text-slate-205 truncate max-w-[120px]" title={cand.name}>
                                  {maskName(cand.name, isAnonymousMode)}
                                </span>
                                <div className="bg-amber-50 dark:bg-amber-955 px-2 py-1 rounded-lg text-amber-805 dark:text-amber-300 text-center select-none font-mono">
                                  <span className="text-xs font-extrabold leading-none">{adjustedScore}%</span>
                                </div>
                              </div>

                              <div className="space-y-1 text-[9px] text-slate-400 dark:text-slate-500">
                                <div className="flex justify-between">
                                  <span>Domain Mastery:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-350">{pillars.technical}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Vocal Clarity:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-350">{pillars.communication}%</span>
                                </div>
                              </div>

                              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 text-[9px] font-mono">{cand.duration}</span>
                                <button
                                  onClick={() => {
                                    onOpenReport(cand);
                                  }}
                                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold transition-all"
                                >
                                  Open Report →
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      {processedCandidates.filter(c => c.status === 'Evaluated' && c.fitCategory === 'Shortlist').length === 0 && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic text-center py-8">No matching applicants in Shortlist bucket.</p>
                      )}
                    </div>
                  </div>

                  {/* REJECT/ARCHIVE BLOCK */}
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3 flex flex-col min-h-[380px]">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-850 pb-2.5">
                      <span className="text-xs font-extrabold text-rose-850 dark:text-rose-450 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Archive candidates
                      </span>
                      <span className="text-[10px] bg-rose-100 dark:bg-rose-955 text-rose-800 dark:text-rose-350 px-2 py-0.5 rounded-full font-extrabold uppercase font-mono">
                        {processedCandidates.filter(c => c.status === 'Evaluated' && c.fitCategory === 'Reject').length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[480px]">
                      {processedCandidates
                        .filter(c => c.status === 'Evaluated' && c.fitCategory === 'Reject')
                        .sort((a, b) => getWeightedScore(b) - getWeightedScore(a))
                        .map((cand) => {
                          const adjustedScore = getWeightedScore(cand);
                          const pillars = getPillarScores(cand);
                          return (
                            <motion.div
                              key={cand.id}
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-white dark:bg-slate-850 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all space-y-2.5"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-xs font-bold text-slate-855 dark:text-slate-205 truncate max-w-[120px]" title={cand.name}>
                                  {maskName(cand.name, isAnonymousMode)}
                                </span>
                                <div className="bg-rose-50 dark:bg-rose-955 px-2 py-1 rounded-lg text-rose-850 dark:text-rose-300 text-center select-none font-mono">
                                  <span className="text-xs font-extrabold leading-none">{adjustedScore}%</span>
                                </div>
                              </div>

                              <div className="space-y-1 text-[9px] text-slate-400 dark:text-slate-500">
                                <div className="flex justify-between">
                                  <span>Domain Mastery:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-350">{pillars.technical}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Vocal Clarity:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-350">{pillars.communication}%</span>
                                </div>
                              </div>

                              <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between items-center text-[10px]">
                                <span className="text-slate-400 text-[9px] font-mono">{cand.duration}</span>
                                <button
                                  onClick={() => {
                                    onOpenReport(cand);
                                  }}
                                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold transition-all"
                                >
                                  Open Report →
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      {processedCandidates.filter(c => c.status === 'Evaluated' && c.fitCategory === 'Reject').length === 0 && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic text-center py-8">No matching applicants in Reject/Archive bucket.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Candidate Modal Overlay */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-800">Add Candidate Profile</h3>
                <p className="text-slate-400 text-xs">Add an applicant to the evaluation pool manually or scan their CV directly.</p>
              </div>

              {/* Seamless Premium Tabs */}
              <div className="flex border-b border-slate-100 pb-1">
                <button
                  type="button"
                  onClick={() => { setModalTab('manual'); setScanError(null); }}
                  className={`flex-1 pb-2.5 text-center text-xs font-bold border-b-2 transition-all ${
                    modalTab === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'
                  }`}
                >
                  Manual Registration
                </button>
                <button
                  type="button"
                  onClick={() => { setModalTab('ai'); setFormError(''); }}
                  className={`flex-1 pb-2.5 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                    modalTab === 'ai' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> AI Resume Screen
                </button>
              </div>

              {modalTab === 'manual' ? (
                <form onSubmit={handleInviteSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Candidate Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. David Kim"
                      value={candName}
                      onChange={(e) => setCandName(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. david.kim@globalsecure.com"
                      value={candEmail}
                      onChange={(e) => setCandEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      placeholder="e.g. +1 (555) 434-1100"
                      value={candPhone}
                      onChange={(e) => setCandPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                  </div>

                  {formError && (
                    <p className="text-xs text-rose-500 font-semibold">{formError}</p>
                  )}

                  <div className="flex gap-2 justify-end pt-3 border-t border-slate-50">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow transition-colors cursor-pointer"
                    >
                      Confirm & Invite
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {/* File Upload Zone */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block">
                      Upload Resume (PDF, DOCX, or TXT)
                    </label>
                    
                    {!uploadedFile ? (
                      <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors relative cursor-pointer group">
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc,.txt"
                          onChange={handleResumeFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-105 transition-transform">
                            <FileDown className="w-5 h-5 text-blue-500" />
                          </div>
                          <p className="text-xs font-bold text-slate-700">Drag & Drop Resume or click to Browse</p>
                          <p className="text-[10px] text-slate-400">Supports PDF, DOCX, DOC, or TXT up to 10MB</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                            <FileDown className="w-4 h-4 text-blue-700" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-800 break-all">{uploadedFile.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {uploadedFile.mimeType.split('/')[1]?.toUpperCase() || 'FILE'} Document • Parsed Clean
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFile(null);
                            setRawResumeText('');
                          }}
                          className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Manual Paste Alternative */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide flex justify-between">
                      <span>Or Paste Resume Transcript Details</span>
                      {uploadedFile && <span className="text-[10px] text-blue-600">File Selected (Autofilled above)</span>}
                    </label>
                    <textarea
                      placeholder="Alternatively, paste the plain text of candidate's CV/Resume here..."
                      rows={4}
                      value={rawResumeText}
                      onChange={(e) => setRawResumeText(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 font-sans resize-none"
                    />
                  </div>

                  {scanError && (
                    <p className="text-xs text-rose-500 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 font-semibold">{scanError}</p>
                  )}

                  <div className="bg-gradient-to-tr from-blue-50/50 to-indigo-50/50 p-3 rounded-2xl border border-blue-50/80 text-[11px] text-slate-600 space-y-1">
                    <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Gemini Auto-Evaluation Matching
                    </p>
                    <p className="leading-relaxed">
                      Our intelligence parser will instantly harvest contact details, match candidate experience levels against campaign job roles, and issue a predicted Alignment fit score!
                    </p>
                  </div>

                  <div className="flex gap-2 justify-end pt-3 border-t border-slate-50">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      disabled={isAiScanning}
                      className="px-4 py-2 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleScanResume}
                      disabled={isAiScanning || !rawResumeText.trim()}
                      className="px-5 py-2 bg-gradient-to-tr from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isAiScanning ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Analyzing and Scoring...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Scan & Auto-Evaluate CV
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Side-by-Side Candidate Comparative Matrix Drawer */}
      <AnimatePresence>
        {showCompareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-5xl w-full h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center flex-shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-1.5 text-[8px] bg-indigo-500 font-extrabold uppercase rounded-md tracking-wider">Analysis Matrix</span>
                    <h3 className="text-lg font-extrabold tracking-tight">Active Candidate Benchmarking Matrix</h3>
                  </div>
                  <p className="text-slate-400 text-xs leading-none">Side-by-side screening report and competence profiling matching for {campaign.title}</p>
                </div>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="px-4 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Close Desk
                </button>
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-auto p-6 bg-slate-50">
                {(() => {
                  const COMPARE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
                  const overlayData: RadarCandidateData[] = candidatesToCompare.map((cand, idx) => ({
                    id: cand.id,
                    name: maskName(cand.name, isAnonymousMode),
                    color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
                    metrics: getCandidateRadarMetric(cand)
                  }));

                  return (
                    <>
                      {/* Comparative Top Insights Panel with Combined Radar Overlay */}
                      <div className="mb-6 bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                        {/* Left: Summary description and explanation */}
                        <div className="space-y-3 lg:col-span-1">
                          <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs uppercase tracking-wide">
                            <Scale className="w-4 h-4 text-blue-500" /> Multi-Pillar Comparison Overlay
                          </div>
                          <h4 className="text-md font-extrabold text-slate-800 leading-tight">Comparative Strength Footprints</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            This overlapping multi-dimension spider radar charts visualizes core capabilities of all compared candidates across 5 key pillars. Broad, complete footprints represent candidates with more versatile skill allocations.
                          </p>
                          
                          {/* Dynamic Legend list matching overlay colors */}
                          <div className="space-y-2 pt-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Compared Profiles</span>
                            <div className="flex flex-wrap gap-2">
                              {overlayData.map((candGroup) => {
                                const candScore = candidatesToCompare.find(c => c.id === candGroup.id)?.score || 0;
                                return (
                                  <div 
                                    key={candGroup.id}
                                    className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-105 p-1.5 px-2.5 rounded-xl transition-all"
                                  >
                                    <span 
                                      className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" 
                                      style={{ backgroundColor: candGroup.color }} 
                                    />
                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[110px]" title={candGroup.name}>
                                      {candGroup.name}
                                    </span>
                                    <span className="text-[10px] font-mono font-extrabold bg-white dark:bg-slate-800 px-1.5 py-0.2 rounded-md border border-slate-200/50 text-slate-500">
                                      {candScore}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Right: Actual Combined Radar chart centered */}
                        <div className="lg:col-span-2 flex justify-center py-2 bg-slate-50/50 rounded-2xl border border-slate-100 dark:bg-slate-900/10 dark:border-slate-800/60">
                          <RadarChart 
                            candidatesData={overlayData} 
                            width={320} 
                            height={280} 
                          />
                        </div>
                      </div>

                      <div className="min-w-[800px] grid grid-cols-1 md:grid-cols-3 gap-6">
                        {candidatesToCompare.map((cand, idx) => {
                          const pillars = getPillarScores(cand);
                          const originalScore = cand.score;
                          const adjustedScore = getWeightedScore(cand);

                          // Determine leader indicators amongst compared nodes
                          const otherScores = candidatesToCompare.filter(c => c.id !== cand.id).map(c => getWeightedScore(c));
                          const isOverallLeader = otherScores.every(s => adjustedScore >= s);

                          return (
                            <div 
                              key={cand.id} 
                              className={`bg-white border rounded-2xl p-5 space-y-4 shadow-sm relative ${
                                isOverallLeader ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-150'
                              }`}
                            >
                              {/* Leader Badge */}
                              {isOverallLeader && (
                                <div className="absolute -top-3 left-4 bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1 shadow-sm select-none animate-bounce">
                                  <Sparkles className="w-3 h-3 text-yellow-300 fill-yellow-300" /> Lead Match
                                </div>
                              )}

                              <div className="border-b border-slate-100 pb-3 space-y-1">
                                <p className="text-md font-extrabold text-slate-800">{maskName(cand.name, isAnonymousMode)}</p>
                                <p className="text-xs text-slate-400 font-mono">{maskEmail(cand.email, isAnonymousMode)}</p>
                                <div className="mt-2.5 flex items-center gap-2">
                                  <span className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full border ${getFitBadgeColor(cand.fitCategory)}`}>
                                    {cand.fitCategory}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">Talk time: {cand.duration}</span>
                                </div>
                              </div>

                              {/* Fit index overview dials */}
                              <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                                <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Weighted Screening Fit</p>
                                <div className="flex items-baseline justify-between select-none">
                                  <span className="text-3xl font-extrabold text-slate-900 leading-none">{adjustedScore}%</span>
                                  <span className="text-[10px] text-slate-400">Baseline Index: {originalScore}%</span>
                                </div>
                              </div>

                              {/* Individual Candidate Radar Chart Visualizer */}
                              <div className="flex justify-center py-2 bg-slate-50/50 rounded-2xl border border-slate-150">
                                <RadarChart
                                  candidatesData={[{
                                    id: cand.id,
                                    name: maskName(cand.name, isAnonymousMode),
                                    color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
                                    metrics: getCandidateRadarMetric(cand)
                                  }]}
                                  width={200}
                                  height={200}
                                />
                              </div>

                              {/* Pillar Scores side breakdown */}
                              <div className="space-y-3 pt-1">
                                <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Dimension Breakdowns</p>
                          
                          {/* Tech Skill Score */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-600 font-medium">
                              <span>Primary Domain Competency</span>
                              <span className="text-slate-900 font-bold">{pillars.technical} %</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${pillars.technical}%` }} />
                            </div>
                          </div>

                          {/* Architecture Score */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-600 font-medium">
                              <span>Architectural & Obj Logic</span>
                              <span className="text-slate-900 font-bold">{pillars.architecture} %</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${pillars.architecture}%` }} />
                            </div>
                          </div>

                          {/* Comm Score */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-600 font-medium">
                              <span>Verbal Clarity & Persona</span>
                              <span className="text-slate-900 font-bold">{pillars.communication} %</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500" style={{ width: `${pillars.communication}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Strengths mapping side-by-side */}
                        <div className="space-y-2 border-t border-slate-100 pt-3 flex-1">
                          <p className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">Top Vetted Competencies</p>
                          <ul className="space-y-1.5">
                            {cand.strengths?.slice(0, 3).map((str, sIdx) => (
                              <li key={sIdx} className="text-[11px] leading-relaxed text-slate-600 pl-3.5 relative before:absolute before:left-0.5 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-emerald-500 before:rounded-full">
                                {str}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Weakness mapping side-by-side */}
                        <div className="space-y-2 border-t border-slate-100 pt-3 bg-slate-50/20 p-2 rounded-xl">
                          <p className="text-[10px] font-extrabold uppercase text-rose-500 tracking-wider">Screened Flags / Growth Areas</p>
                          <ul className="space-y-1.5">
                            {cand.weaknesses?.slice(0, 2).map((wk, wIdx) => (
                              <li key={wIdx} className="text-[11px] leading-relaxed text-slate-500 pl-3.5 relative before:absolute before:left-0.5 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-rose-400 before:rounded-full">
                                {wk}
                              </li>
                            ))}
                            {(!cand.weaknesses || cand.weaknesses.length === 0) && (
                              <li className="text-[11px] text-slate-400 italic">No developmental flags recorded.</li>
                            )}
                          </ul>
                        </div>

                        {/* Trust Risk & Accent Audit profiling inside matrix */}
                        <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                          <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Screening Trust Indicators</p>
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span className="text-slate-400 block font-semibold leading-none mb-1">Compliance Scan</span>
                              <span className="text-slate-700 font-bold">{cand.consentAgreedTime ? 'GDPR Stamped' : 'No Consent'}</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <span className="text-slate-400 block font-semibold leading-none mb-1">Oral Accent Style</span>
                              <span className="text-slate-700 font-bold truncate block" title={cand.spokenLanguage || 'Not Evaluated'}>
                                {cand.spokenLanguage ? cand.spokenLanguage.split(' ')[0] : 'Evaluated'}
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 col-span-2 flex justify-between items-center">
                              <span className="text-slate-400 font-medium">Recorded Anomalies:</span>
                              {((cand.tabSwitchCount && cand.tabSwitchCount > 0) || (cand.longSilenceCount && cand.longSilenceCount > 0) || cand.suspiciousVoiceNoise || (cand.fullscreenExitCount && cand.fullscreenExitCount > 0) || (cand.screenChangeCount && cand.screenChangeCount > 0)) ? (
                                <span className="font-extrabold text-rose-600 flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                                  <ShieldAlert className="w-3 h-3 text-rose-500" />
                                  Flagged ({(cand.tabSwitchCount || 0) + (cand.longSilenceCount || 0) + (cand.suspiciousVoiceNoise ? 1 : 0) + (cand.fullscreenExitCount || 0) + (cand.screenChangeCount || 0)})
                                </span>
                              ) : (
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">Clean</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3 text-center">
                          <button
                            onClick={() => {
                              setShowCompareModal(false);
                              onOpenReport(cand);
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-500 font-bold"
                          >
                            Read Full Screen Audit →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>

              <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-between items-center text-xs text-slate-500 flex-shrink-0">
                <p>Note: Leader badge indicates the overall best fit based on custom parameters.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedCandidates([])}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    Reset Selected Benchmarks
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={candidateToDelete !== null}
        title="Remove Candidate"
        message="Are you sure you want to remove this candidate? This candidate's test scorecard and evaluation metrics will be permanently lost."
        onConfirm={() => {
          if (candidateToDelete) {
            deleteCandidate(candidateToDelete);
            setSelectedCandidates(prev => prev.filter(id => id !== candidateToDelete));
            onRefresh();
          }
          setCandidateToDelete(null);
        }}
        onCancel={() => setCandidateToDelete(null)}
        isDanger={true}
        confirmText="Remove Candidate"
      />
    </motion.div>
  );
}
