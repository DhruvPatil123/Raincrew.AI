import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, CheckCircle2, AlertTriangle, Play, Pause, 
  MessageSquare, BarChart3, Star, Clock, Mail, Phone, Calendar,
  Download, Copy, Check, FileText, Sparkles, FileDown,
  ShieldAlert, Languages, Lock, Scale, ShieldCheck, Trash2,
  BookOpen, ExternalLink, Compass, GraduationCap, MessageCircle
} from 'lucide-react';
import { Candidate, Campaign, maskName, maskEmail, maskPhone } from '../types';
import { deleteCandidate } from '../lib/storage';
import { jsPDF } from 'jspdf';
import RecruiterCollaboration from './RecruiterCollaboration';
import CalendarBooking from './CalendarBooking';

interface CandidateReportProps {
  candidate: Candidate;
  campaign: Campaign;
  onBack: () => void;
  isAnonymousMode?: boolean;
}

export default function CandidateReport({ candidate: initialCandidate, campaign, onBack, isAnonymousMode = false }: CandidateReportProps) {
  const [activeCandidate, setActiveCandidate] = useState<Candidate>(initialCandidate);

  useEffect(() => {
    setActiveCandidate(initialCandidate);
  }, [initialCandidate]);

  const candidate = activeCandidate;

  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null);
  const [currentSynth, setCurrentSynth] = useState<SpeechSynthesis | null>(null);
  
  // GDPR and trust state managers
  const [gdprReceipt, setGdprReceipt] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedShareKey, setCopiedShareKey] = useState(false);
  
  // Communication & Exporter State variables
  const [comMode, setComMode] = useState<'offer' | 'shortlist' | 'feedback'>(
    candidate.fitCategory === 'Hire' ? 'offer' : candidate.fitCategory === 'Shortlist' ? 'shortlist' : 'feedback'
  );
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [jsonExportSuccess, setJsonExportSuccess] = useState(false);

  const startReciting = (turnId: string, text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any pending recitations First
      
      if (playingTurnId === turnId) {
        setPlayingTurnId(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      
      const voices = window.speechSynthesis.getVoices();
      // Try to select standard natural sounding voices if available
      if (text.startsWith("AI") || text.includes("Welcome") || text.includes("Thank you")) {
        // AI Interviewer Sound (Puck or Samantha)
        const voice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
        if (voice) utterance.voice = voice;
      } else {
        // Candidate Sound (Male or soft pitch)
        const voice = voices.find(v => v.name.includes("Google UK English") || v.name.includes("Daniel"));
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => {
        setPlayingTurnId(null);
      };

      utterance.onerror = () => {
        setPlayingTurnId(null);
      };

      setPlayingTurnId(turnId);
      window.speechSynthesis.speak(utterance);
    } else {
      // Speech Synthesis is not supported in this frame, normal local mock feedback
      setPlayingTurnId(turnId);
      setTimeout(() => setPlayingTurnId(null), 3000);
    }
  };

  const downloadJSONReport = () => {
    const reportData = {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        department: campaign.department,
        questions: campaign.questions
      },
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        status: candidate.status,
        duration: candidate.duration,
        overallFitIndex: candidate.score,
        verdict: candidate.fitCategory,
        executiveDigest: candidate.overallEvaluation,
        strengths: candidate.strengths,
        weaknesses: candidate.weaknesses,
        detailedScores: candidate.detailedScores,
        qnaPairs: candidate.qnaPairs,
        transcript: candidate.transcript,
        skillsGap: candidate.skillsGap,
        learningResources: candidate.learningResources,
        followUpFocusAreas: candidate.followUpFocusAreas
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${candidate.name.replace(/\s+/g, '_')}_vetting_scorecard.json`);
    dlAnchorElem.click();
    
    setJsonExportSuccess(true);
    setTimeout(() => setJsonExportSuccess(false), 3000);
  };

  const printReport = () => {
    window.print();
  };

  const exportPDFReport = () => {
    // Correct initialize jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [15, 23, 42]; // Slate 900
    const accentColor = [79, 70, 229]; // Indigo 605
    const emeraldColor = [16, 185, 129]; // Emerald 500

    let pageNum = 1;
    let y = 25;

    const drawHeaderFooter = () => {
      // Draw minimal header
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Gray-400
      doc.text("FOLOUP | GEN AI CANDIDATE VETTING REPORT", 20, 12);
      
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.3);
      doc.line(20, 14, 190, 14);

      // Draw minimal footer
      doc.line(20, 282, 190, 282);
      doc.setFont("Helvetica", "normal");
      doc.text(`Page ${pageNum}`, 190, 286, { align: 'right' });
      doc.text("CONFIDENTIAL - FOR EMPLOYER INTERNAL USE ONLY", 20, 286);
    };

    const addPage = () => {
      doc.addPage();
      pageNum++;
      y = 22;
      drawHeaderFooter();
    };

    const checkSpace = (needed: number) => {
      if (y + needed > 275) {
        addPage();
      }
    };

    // Draw Page 1 header/footer immediately
    drawHeaderFooter();

    // TITLE SECTION
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Candidate Evaluation Scorecard", 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Role: ${campaign.title} (${campaign.department})`, 20, y);
    y += 12;

    // CANDIDATE PROFILE CARD (Draw a neat light-gray bg box)
    checkSpace(55);
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.4);
    doc.roundedRect(20, y, 170, 42, 3, 3, "FD");

    // Details Inside Frame
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(maskName(candidate.name, isAnonymousMode), 26, y + 8);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Email: ${maskEmail(candidate.email, isAnonymousMode)}`, 26, y + 15);
    doc.text(`Phone: ${maskPhone(candidate.phone, isAnonymousMode) || 'N/A'}`, 26, y + 20);
    doc.text(`Vetting Date: ${new Date().toLocaleDateString()}`, 26, y + 25);
    doc.text(`Oral Call Duration: ${candidate.duration || 'N/A'}`, 26, y + 30);

    // FIT SCORE ACCENT BOX (Inside Profile Card)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(79, 70, 229); // Accent line
    doc.setLineWidth(0.8);
    doc.roundedRect(120, y + 6, 62, 30, 2, 2, "FD");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(79, 70, 229);
    doc.text("OVERALL FIT RATIO", 151, y + 12, { align: 'center' });
    
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${candidate.score}%`, 151, y + 20, { align: 'center' });

    doc.setFontSize(8);
    const fitCat = candidate.fitCategory || 'Vetted';
    const fitCatColor = fitCat === 'Hire' ? [16, 185, 129] : fitCat === 'Shortlist' ? [245, 158, 11] : [244, 63, 94];
    doc.setTextColor(fitCatColor[0], fitCatColor[1], fitCatColor[2]);
    doc.text(fitCat.toUpperCase(), 151, y + 26, { align: 'center' });

    y += 48;

    // SECTION: EXECUTIVE DIGEST
    checkSpace(40);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("Executive Summary Digest", 20, y);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y + 2, 190, y + 2);
    y += 7;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const rawEval = candidate.overallEvaluation || "No executive summary available.";
    const splitEval = doc.splitTextToSize(rawEval, 170);
    doc.text(splitEval, 20, y);
    y += splitEval.length * 5 + 4;

    // SECTION: TARGETED COMPETENCY BREAKDOWN
    if (candidate.detailedScores && candidate.detailedScores.length > 0) {
      checkSpace(45);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text("Targeted Competency Breakdown", 20, y);
      doc.line(20, y + 2, 190, y + 2);
      y += 8;

      candidate.detailedScores.forEach((score) => {
        checkSpace(18);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(score.criteria, 20, y);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9.5);
        doc.text(`${score.score} / ${score.maxScore}`, 190, y, { align: 'right' });
        y += 4;

        // Draw track bar
        doc.setFillColor(241, 245, 249);
        doc.rect(20, y, 170, 2, "F");
        
        // Progress percent fill
        const pct = Math.max(0, Math.min(100, (score.score / score.maxScore) * 100));
        const barFillColor = pct >= 80 ? [16, 185, 129] : pct >= 60 ? [245, 158, 11] : [244, 63, 94];
        doc.setFillColor(barFillColor[0], barFillColor[1], barFillColor[2]);
        doc.rect(20, y, pct * 1.7, 2, "F");
        y += 4;

        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const splitFeedback = doc.splitTextToSize(score.feedback, 170);
        doc.text(splitFeedback, 20, y);
        y += splitFeedback.length * 4.5 + 4;
      });
      y += 2;
    }

    // SECTION: SWOT METRICS (STRENGTHS & WEAKNESSES)
    checkSpace(40);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("SWOT Competency Metrics", 20, y);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, y + 2, 190, y + 2);
    y += 7;

    const doubleColY = y;
    let col1Y = doubleColY;
    let col2Y = doubleColY;

    // LEFT Column - Strengths
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text("Vetted Core Strengths", 20, col1Y);
    col1Y += 5;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    if (candidate.strengths && candidate.strengths.length > 0) {
      candidate.strengths.forEach(str => {
        const splitStr = doc.splitTextToSize(`• ${str}`, 80);
        doc.text(splitStr, 20, col1Y);
        col1Y += splitStr.length * 4.5 + 2;
      });
    } else {
      doc.text("No strengths reported.", 20, col1Y);
      col1Y += 6;
    }

    // RIGHT Column - Weaknesses
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(244, 63, 94); // Rose
    doc.text("Identified Lags & Gaps", 110, col2Y);
    col2Y += 5;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    if (candidate.weaknesses && candidate.weaknesses.length > 0) {
      candidate.weaknesses.forEach(wk => {
        const splitWk = doc.splitTextToSize(`• ${wk}`, 80);
        doc.text(splitWk, 110, col2Y);
        col2Y += splitWk.length * 4.5 + 2;
      });
    } else {
      doc.text("No substantial gaps highlighted.", 110, col2Y);
      col2Y += 6;
    }

    // Move Y past the taller column
    y = Math.max(col1Y, col2Y) + 4;

    // SECTION: INDIVIDUAL QUESTION EVALUATIONS
    if (candidate.qnaPairs && candidate.qnaPairs.length > 0) {
      addPage();
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text("Structured Question Ratings and Transcripts", 20, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(20, y + 2, 190, y + 2);
      y += 8;

      candidate.qnaPairs.forEach((pair, idx) => {
        checkSpace(40);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.text(`Question ${idx + 1}: Rating Score ${pair.rating}%`, 20, y);
        y += 4.5;

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
        const splitQ = doc.splitTextToSize(`"${pair.question}"`, 170);
        doc.text(splitQ, 20, y);
        y += splitQ.length * 4.5 + 3;

        // Answer box
        const splitA = doc.splitTextToSize(`Candidate Response: ${pair.answer || "N/A"}`, 164);
        const boxHeight = splitA.length * 4 + 6;
        checkSpace(boxHeight + 10);

        doc.setFillColor(248, 250, 252); // Soft background
        doc.setDrawColor(241, 245, 249);
        doc.roundedRect(20, y, 170, boxHeight, 1.5, 1.5, "FD");
        
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(splitA, 23, y + 5);
        y += boxHeight + 4;

        // Feedback
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const splitF = doc.splitTextToSize(`AI Evaluator Remarks: ${pair.feedback}`, 170);
        doc.text(splitF, 20, y);
        y += splitF.length * 4.5 + 6;
      });
    }

    // Save File
    const rawFileName = candidate.name.replace(/\s+/g, '_').toLowerCase();
    doc.save(`${rawFileName}_vetting_profile.pdf`);
  };

  const handleCopyShareLink = () => {
    const shareUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "?reportId=" + candidate.id;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedShareKey(true);
      setTimeout(() => setCopiedShareKey(false), 2500);
    }
  };

  const handleGdprDelete = () => {
    setIsDeleting(true);
    const receiptCode = `GDPR-DEL-${Math.floor(100000 + Math.random() * 900000)}-${candidate.id.toUpperCase()}`;
    
    try {
      deleteCandidate(candidate.id);
      setGdprReceipt(receiptCode);
    } catch (err) {
      console.error("GDPR purger failure:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getEmailContent = () => {
    if (comMode === 'offer') {
      return `Subject: Interview Invitation & Vetting Results: ${campaign.title} - ${candidate.name}

Dear ${candidate.name},

Thank you for completing our automated voice screening interview on FoloUp for the ${campaign.title} vacancy.

Our hiring team has examined your performance metrics. We were exceptionally impressed with your scoring index of ${candidate.score}% and your strong competence in:
${candidate.strengths?.map(s => ` - ${s}`).join('\n') || ' - Core professional skills and general domain answers'}

We would like to invite you to a virtual final round call with our team to discuss next steps. Please select a spot in our calendar here: [LINK].

Best regards,
Hiring Operations Team
${campaign.department} Group`;
    }

    if (comMode === 'shortlist') {
      return `Subject: Status Update: Vetting Interview for ${campaign.title} - ${candidate.name}

Dear ${candidate.name},

Thank you for taking the time to complete our vocal diagnostic screening call for the ${campaign.title} role.

You achieved an excellent score of ${candidate.score}%! Your evaluation indicators placed you directly on our shortlist matrix on account of your strengths:
${candidate.strengths?.map(s => ` - ${s}`).join('\n') || ' - Structured domain presentation style'}

We are currently completing screening runs for the active cohort. We will finalize shortlist selections over the coming days and reach out in case of matches.

Best regards,
Hiring Operations Team
${campaign.department} Group`;
    }

    return `Subject: Performance Feedback & Next Steps: ${campaign.title} - ${candidate.name}

Dear ${candidate.name},

We sincerely appreciate your participation in our FoloUp automated voice screening for the ${campaign.title} vacancy.

We wanted to share some constructive feedback parsed by our AI evaluators based on your response transcripts:

Your Vetted Strengths:
${candidate.strengths?.map(s => ` - ${s}`).join('\n') || ' - Professional approach & active communication'}

Suggested Areas for Growth:
${candidate.weaknesses?.map(w => ` - ${w}`).join('\n') || ' - Enhancing depth on complex scenarios or consultative frameworks'}

While we are not proceeding with your candidacy for this specific vacancy, we will keep your profile in our storage system for appropriate future highlights. We wish you outstanding success in your upcoming search!

Best,
Talent Acquisition Team
${campaign.department} Group`;
  };

  const handleCopyEmail = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(getEmailContent());
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    } else {
      alert("Email copy simulation copied to system.");
    }
  };

  const getFitBadgeColor = (category: string) => {
    switch (category) {
      case 'Hire':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Shortlist':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Reject':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const scoreColor = candidate.score >= 85 ? 'text-emerald-500 bg-emerald-50' : candidate.score >= 70 ? 'text-amber-500 bg-amber-50' : 'text-rose-500 bg-rose-50';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-6 max-w-6xl mx-auto pb-12"
    >
      {/* Printable Only Branding Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">FoloUp Verification Engine</span>
            <h1 className="text-2xl font-bold text-slate-900">Candidate Evaluation Scorecard</h1>
            <p className="text-xs text-slate-500 font-medium">Position: {campaign.title} — {campaign.department} Group</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400">STATUS: OFFICIAL RECORD</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Vetted Fit Index: {candidate.score}%</p>
          </div>
        </div>
      </div>

      {/* Top action row */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-50 border border-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Return to Candidates Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">{maskName(candidate.name, isAnonymousMode)}</h1>
              <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${getFitBadgeColor(candidate.fitCategory || '')}`}>
                Recruiter Verdict: {candidate.fitCategory}
              </span>
            </div>
            <p className="text-slate-400 text-sm">Vetted for {campaign.title} ({campaign.department})</p>
          </div>
        </div>

        {/* Action Toolbox and Contacts */}
        <div className="flex items-center gap-4 flex-wrap text-xs font-semibold">
          <div className="flex items-center gap-6 text-xs text-slate-500 border-r border-slate-100 pr-6 md:flex hidden">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{maskEmail(candidate.email, isAnonymousMode)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{maskPhone(candidate.phone, isAnonymousMode) || 'No phone registered'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyShareLink}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs cursor-pointer select-none font-bold ${
                copiedShareKey ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500' : 'bg-white border-slate-150 text-slate-705 hover:bg-slate-50'
              }`}
              title="Copy a secure verification view URL of this scorecard to clipboard for recruiters/candidates"
            >
              {copiedShareKey ? <Check className="w-4 h-4 text-white font-bold" /> : <Sparkles className="w-4 h-4 text-indigo-550 fill-none" />}
              {copiedShareKey ? 'Share Link Copied!' : 'Share Scorecard'}
            </button>
            <button
              onClick={downloadJSONReport}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs cursor-pointer ${
                jsonExportSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
              }`}
              title="Download full candidate profile, transcripts & ratings in structured JSON format"
            >
              {jsonExportSuccess ? <Check className="w-4 h-4 text-emerald-500" /> : <Download className="w-4 h-4" />}
              {jsonExportSuccess ? 'JSON Downloaded' : 'Export JSON'}
            </button>
            <button
              onClick={exportPDFReport}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-all"
              title="Export complete vetting report and individual scorecards as formatted PDF"
            >
              <FileDown className="w-4 h-4" /> Export PDF
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs cursor-pointer transition-colors"
              title="Print standard hiring matrix scorecard documentation sheet"
            >
              <FileText className="w-4 h-4" /> Print Matrix Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left is summary metrics / strengths, Right is Transcript & Qnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Overview metrics & SWOT */}
        <div className="lg:col-span-1 space-y-6">
          {/* Fit Rating Dial Box */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 w-full text-left border-b border-slate-50 pb-2">Overall Fit Rating</h2>
            
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Circular track */}
              <svg className="absolute transform -rotate-90 w-full h-full">
                <circle cx="72" cy="72" r="60" stroke="#f1f5f9" strokeWidth="10" fill="transparent" />
                <motion.circle 
                  cx="72" 
                  cy="72" 
                  r="60" 
                  stroke={candidate.score >= 85 ? '#10b981' : candidate.score >= 70 ? '#f59e0b' : '#f43f5e'} 
                  strokeWidth="10" 
                  fill="transparent" 
                  strokeDasharray={2 * Math.PI * 60}
                  initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                  animate={{ strokeDashoffset: ((100 - candidate.score) / 100) * (2 * Math.PI * 60) }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="text-center z-10">
                <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{candidate.score}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Fit Index</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs w-full border-t border-slate-50 pt-2 text-slate-500">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Call Duration: {candidate.duration}</span>
              </div>
            </div>
          </div>

          {/* AI Semantic Paragraph Report */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" /> Executive Digest
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed text-justify">
              {candidate.overallEvaluation}
            </p>
          </div>

          {/* Strengths & Weaknesses (SWOT) */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            {/* Strengths */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Strong Competencies
              </h4>
              {candidate.strengths && candidate.strengths.length > 0 ? (
                <ul className="space-y-1.5">
                  {candidate.strengths.map((str, idx) => (
                    <li key={idx} className="text-slate-600 text-xs pl-4 relative before:absolute before:left-1 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-emerald-500 before:rounded-full">
                      {str}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">No significant strengths recorded yet.</p>
              )}
            </div>

            {/* Weaknesses */}
            <div className="space-y-2 pt-2 border-t border-slate-50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Areas for Growth
              </h4>
              {candidate.weaknesses && candidate.weaknesses.length > 0 ? (
                <ul className="space-y-1.5">
                  {candidate.weaknesses.map((wk, idx) => (
                    <li key={idx} className="text-slate-600 text-xs pl-4 relative before:absolute before:left-1 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-rose-500 before:rounded-full">
                      {wk}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic">No structural flags or weaknesses reported.</p>
              )}
            </div>
          </div>

          {/* Hiring Dispatcher Hub */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                <Mail className="w-4 h-4" /> Hiring Dispatcher Desk
              </h3>
              <p className="text-slate-400 text-[10px] leading-relaxed">Choose an optimized template below. FoloUp auto-injects candidate screening diagnostics into the message copy:</p>
            </div>

            {/* Selector tabs */}
            <div className="grid grid-cols-3 bg-slate-50 border border-slate-105 p-1 rounded-xl text-[10px] font-bold">
              <button
                onClick={() => setComMode('offer')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  comMode === 'offer' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Schedule Next
              </button>
              <button
                onClick={() => setComMode('shortlist')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  comMode === 'shortlist' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Keep Warm
              </button>
              <button
                onClick={() => setComMode('feedback')}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                  comMode === 'feedback' ? 'bg-white shadow-xs text-rose-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Reject & Feed
              </button>
            </div>

            {/* Email Output Frame */}
            <div className="bg-slate-950 text-slate-350 p-4 rounded-2xl border border-slate-800 relative select-text">
              <pre className="text-[10px] leading-relaxed font-mono whitespace-pre-wrap max-h-[180px] overflow-y-auto">
                {getEmailContent()}
              </pre>

              <button
                onClick={handleCopyEmail}
                className={`absolute right-3 bottom-3 flex items-center gap-1 px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  copiedSuccess 
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white' 
                    : 'bg-white text-slate-900 hover:bg-slate-100 shadow-sm'
                }`}
              >
                {copiedSuccess ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                {copiedSuccess ? 'Text Copied!' : 'Copy Script'}
              </button>
            </div>
          </div>

          {/* Trust Risk, Accents & GDPR deletion controls */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-750 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-blue-500" /> Trust & Compliance Audit
            </h3>

            {gdprReceipt ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-[11px] text-emerald-800 space-y-2">
                <span className="font-extrabold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> GDPR Data Purge Complete
                </span>
                <p className="leading-relaxed">Candidate metadata, recordings, and audit scores have been scrubbed from system servers in compliance with Article 17 (Right to Erasure).</p>
                <div className="font-mono bg-white p-1.5 rounded border border-emerald-200/85 mt-1 select-all break-all text-[10px]">
                  RECEIPT: <span className="font-bold">{gdprReceipt}</span>
                </div>
                <button
                  onClick={onBack}
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg text-[10px] font-bold transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600">
                <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Consent & Privacy</p>
                  <p className="font-bold text-slate-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> ISO/IEC 27001 Secure Node
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Consent timestamped: {candidate.consentAgreedTime ? new Date(candidate.consentAgreedTime).toLocaleDateString() : 'Explicit verbal consent recorded on start'}
                  </p>
                </div>

                <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Integrity Check factors</p>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-400">Browser Focus Lost:</span>
                      <span className={`font-bold ${candidate.tabSwitchCount && candidate.tabSwitchCount >= 3 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {candidate.tabSwitchCount || 0} event{candidate.tabSwitchCount !== 1 && 's'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-400">Suspicious Pauses:</span>
                      <span className={`font-bold ${candidate.longSilenceCount && candidate.longSilenceCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {candidate.longSilenceCount || 0} warning{candidate.longSilenceCount !== 1 && 's'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-400">Fullscreen Exits:</span>
                      <span className={`font-bold ${candidate.fullscreenExitCount && candidate.fullscreenExitCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {candidate.fullscreenExitCount || 0} violation{candidate.fullscreenExitCount !== 1 && 's'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-400">Layout (Screen) Shifts:</span>
                      <span className={`font-bold ${candidate.screenChangeCount && candidate.screenChangeCount >= 2 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {candidate.screenChangeCount || 0} incident{candidate.screenChangeCount !== 1 && 's'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-400">Ambient Noise Warning:</span>
                      <span className={`font-bold ${candidate.suspiciousVoiceNoise ? 'text-rose-600' : 'text-slate-700'}`}>
                        {candidate.suspiciousVoiceNoise ? 'Detected' : 'Nominal Level'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-400">Speech Engine (STT):</span>
                      <span className="font-bold text-slate-700 uppercase text-[9.5px] px-1.5 py-0.5 rounded bg-slate-200">
                        {campaign.sttEngine === 'assemblyai' ? 'AssemblyAI Uni-2' : 
                         campaign.sttEngine === 'whisper' ? 'Whisper Latency fallback' : 'Deepgram Nova-3'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-400">Camera Face Proctor:</span>
                      <span className={`font-bold ${campaign.enableMediaPipeCameraProctor !== false ? 'text-blue-600' : 'text-slate-500'}`}>
                        {campaign.enableMediaPipeCameraProctor !== false ? 'MediaPipe Active' : 'Off'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Primary Voice Dialect:</span>
                      <span className="font-bold text-slate-700 flex items-center gap-1 text-[10px]">
                        <Languages className="w-3 h-3 text-slate-400" /> {candidate.spokenLanguage || 'English (US Accent)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Verbal Speech Delivery Health Check</p>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-500">Speech Pacing (WPM):</span>
                      <span className="font-extrabold text-slate-800">
                        {candidate.deliveryMetrics?.wpm || 135} WPM
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-500">Overall Cadence:</span>
                      <span className="font-bold text-slate-750">
                        {candidate.deliveryMetrics?.overallPacing || "Structured & Balanced (135 WPM)"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-0.5 border-b border-slate-200/40">
                      <span className="text-slate-500">Filler-Word Ratio:</span>
                      <span className={`font-bold text-[10.5px] px-2 py-0.5 rounded ${
                        candidate.deliveryMetrics?.clarityLevel === 'Needs Improvement' ? 'bg-rose-50 text-rose-700' :
                        candidate.deliveryMetrics?.clarityLevel === 'Moderate' ? 'bg-amber-50 text-amber-700' :
                        candidate.deliveryMetrics?.clarityLevel === 'Good' ? 'bg-blue-50 text-blue-700' :
                        'bg-emerald-50 text-emerald-700'
                      }`}>
                        {candidate.deliveryMetrics?.clarityLevel || "Good"}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-slate-500">Filler Words Flagged:</span>
                      <span className="font-extrabold text-slate-800">
                        {candidate.deliveryMetrics?.totalFillers ?? 3} total
                      </span>
                    </div>
                    {candidate.deliveryMetrics?.fillerWords && Object.keys(candidate.deliveryMetrics.fillerWords).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1.5 justify-end">
                        {Object.entries(candidate.deliveryMetrics.fillerWords).map(([word, freq]) => (
                          <span key={word} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[9px] text-slate-600">
                            "{word}": {freq}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Simulated Right to Deletion Controls */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={handleGdprDelete}
                    disabled={isDeleting}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>Scrubbing Database Entry...</>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Purge Candidate GDPR Records
                      </>
                    )}
                  </button>
                  <p className="text-[9px] text-slate-400 mt-1.5 leading-relaxed text-center">Permanently scrubs logs and scores for right-to-be-forgotten compliance audit logs.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Transcript & QnA Pairs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Competency Ratings Section */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" /> Targeted Competency Breakdown
            </h3>
            
            {candidate.detailedScores && candidate.detailedScores.length > 0 ? (
              <div className="space-y-4">
                {candidate.detailedScores.map((score, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-700">{score.criteria}</span>
                      <span className="text-slate-900">{score.score} / {score.maxScore}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(score.score / score.maxScore) * 100}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={`h-full rounded-full ${score.score >= 80 ? 'bg-emerald-500' : score.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal italic">{score.feedback}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No competency evaluations available yet.</p>
            )}
          </div>

          {/* Skills Gap & Ideal Profile Analysis */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-rose-500 shrink-0" /> 📉 Skills Gap Analysis (vs. Ideal Profile)
                </h3>
                <p className="text-[11px] text-slate-400">Comparing candidate answers against requirements to identify core lags & guide vetting follow-ups.</p>
              </div>
            </div>

            {/* Missing Skills Grid / List */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Identified Gaps vs. Ideal Profile</h4>
              {candidate.skillsGap && candidate.skillsGap.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidate.skillsGap.map((gap, index) => {
                    const importanceColors = {
                      High: 'bg-rose-50 text-rose-700 border-rose-100',
                      Medium: 'bg-amber-50 text-amber-700 border-amber-100',
                      Low: 'bg-slate-50 text-slate-600 border-slate-100'
                    };
                    const importanceBadge = gap.importance || 'Medium';

                    return (
                      <div key={index} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-200 transition-colors">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-semibold text-slate-800 text-xs leading-normal">{gap.skillName}</h5>
                            <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${importanceColors[importanceBadge] || importanceColors.Medium}`}>
                              {importanceBadge} Priority
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-normal">{gap.gapDescription}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100/50">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Excellent alignment! No severe skill gaps identified versus the ideal profile template.</span>
                </div>
              )}
            </div>

            {/* Strategic Follow-Up Focus Areas for Hiring Managers */}
            {candidate.followUpFocusAreas && candidate.followUpFocusAreas.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-indigo-500" /> Strategic Follow-Up Focus Areas
                </h4>
                <p className="text-[10px] text-slate-400">Tailored topics and drilling queries recommended for future interview loops or technical assessments:</p>
                <ul className="space-y-2">
                  {candidate.followUpFocusAreas.map((area, idx) => (
                    <li key={idx} className="bg-slate-50/40 hover:bg-slate-50 border border-slate-100/50 rounded-xl p-3 text-[11px] text-slate-700 flex items-start gap-2.5 transition-colors">
                      <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[9.5px] mt-0.5 shrink-0 select-none">
                        {idx + 1}
                      </span>
                      <span className="italic leading-normal text-slate-600">"{area}"</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Course & Learning Resources Segment */}
            {candidate.learningResources && candidate.learningResources.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-emerald-600" /> Suggested Learning Resources
                  </h4>
                  <p className="text-[10px] text-slate-400">Custom recommended materials to help this candidate up-skill and fill the identified technology gaps:</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidate.learningResources.map((res, index) => {
                    const typeColors = {
                      Course: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                      Book: 'text-amber-600 bg-amber-50 border-amber-100',
                      Article: 'text-sky-600 bg-sky-50 border-sky-100',
                      Documentation: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                      Video: 'text-rose-600 bg-rose-50 border-rose-100'
                    };
                    const typeBadge = res.type || 'Course';

                    return (
                      <div key={index} className="bg-slate-50/40 hover:bg-white border border-slate-100 hover:border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between space-y-4 transition-all hover:shadow-xs group">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={`text-[9.5px] font-bold uppercase px-2 py-0.5 rounded border ${typeColors[typeBadge] || 'text-slate-600 bg-slate-50 border-slate-100'}`}>
                              {typeBadge}
                            </span>
                            <BookOpen className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-800 text-[11.5px] leading-snug group-hover:text-slate-900">{res.title}</h5>
                            <p className="text-[10.5px] text-slate-500 leading-normal mt-1">{res.description}</p>
                          </div>
                        </div>

                        <a
                          href={res.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-150 text-[10px] font-bold text-slate-600 hover:text-slate-800 rounded-xl flex items-center justify-center gap-1 transition-all group-hover:border-slate-300 shadow-3xs"
                        >
                          Access Reference Guide <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Question and Answer Breakdown */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Individual Question Ratings
            </h3>

            {candidate.qnaPairs && candidate.qnaPairs.length > 0 ? (
              <div className="space-y-4 divide-y divide-slate-50">
                {candidate.qnaPairs.map((pair, idx) => (
                  <div key={idx} className={`space-y-2 ${idx > 0 ? 'pt-4' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Question {idx + 1}</span>
                        <p className="text-slate-800 text-sm font-semibold">{pair.question}</p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${pair.rating >= 80 ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : pair.rating >= 60 ? 'text-amber-700 bg-amber-50 border border-amber-100' : 'text-rose-700 bg-rose-50 border border-rose-100'}`}>
                        {pair.rating}% Score
                      </span>
                    </div>
                    <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Candidate Response Summary:</p>
                      <p className="text-slate-700 text-xs leading-relaxed italic">"{pair.answer}"</p>
                    </div>
                    <p className="text-xs text-slate-500 pl-1 leading-normal"><span className="font-semibold text-slate-700">AI Feedback:</span> {pair.feedback}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Individual QnA evaluation arrays were not completed during runtime.</p>
            )}
          </div>

          {/* Dialog Dialogue Audio Room */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" /> Interactive Dialog Playback
              </h3>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest md:block hidden">Click play to read turn details</p>
            </div>

            {candidate.transcript && candidate.transcript.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {candidate.transcript.map((turn) => (
                  <div key={turn.id} className={`flex gap-3 items-start ${turn.speaker === 'AI' ? 'justify-start' : 'justify-end'}`}>
                    {/* Left avatar if AI */}
                    {turn.speaker === 'AI' && (
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-slate-800">
                        AI
                      </div>
                    )}

                    {/* Speech box */}
                    <div className={`group relative max-w-[80%] rounded-2xl p-4 border text-xs leading-relaxed space-y-1.5 shadow-sm transition-shadow hover:shadow ${turn.speaker === 'AI' ? 'bg-slate-50/40 border-slate-100 text-slate-800 rounded-tl-none' : 'bg-blue-600 border-blue-500 text-white rounded-tr-none'}`}>
                      <div className="flex justify-between items-center gap-6">
                        <span className={`font-bold ${turn.speaker === 'AI' ? 'text-slate-500' : 'text-blue-100'}`}>{turn.speaker === 'AI' ? 'Interviewer' : maskName(candidate.name, isAnonymousMode)}</span>
                        <span className={`text-[9px] ${turn.speaker === 'AI' ? 'text-slate-400' : 'text-blue-200'}`}>{turn.timestamp}</span>
                      </div>
                      
                      <p className="leading-relaxed">{turn.text}</p>

                      {/* Play Button Overlay */}
                      <button
                        onClick={() => startReciting(turn.id, turn.text)}
                        className={`absolute right-2.5 bottom-2 p-1.5 rounded-lg border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${turn.speaker === 'AI' ? 'bg-slate-900/90 text-white border-slate-800 hover:bg-slate-850' : 'bg-white/90 text-slate-900 border-white/10 hover:bg-white'}`}
                      >
                        {playingTurnId === turn.id ? (
                          <Pause className="w-3 h-3 animate-pulse" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Right avatar if Candidate */}
                    {turn.speaker === 'Candidate' && (
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-blue-100">
                        {isAnonymousMode ? 'C' : candidate.name.split(' ').map(n=>n[0]).join('')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No verbal dialog transcript recorded for this candidate.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recruiter & Team Collaborative Center */}
      <div className="bg-slate-50 border border-slate-150 p-6 rounded-3xl dark:bg-slate-900/40 dark:border-slate-800/80 space-y-4 shadow-sm no-print">
        <div className="flex items-center gap-2 border-b border-slate-200/65 dark:border-slate-850 pb-3">
          <MessageCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Recruiter Notes & Shared Team Commentary</h2>
            <p className="text-xs text-slate-400">Collaborative hiring workspace for notes, feedback annotations, and recruiter thoughts.</p>
          </div>
        </div>
        
        <RecruiterCollaboration 
          candidate={candidate}
          onRefreshCandidateData={(updatedCand) => {
            setActiveCandidate(updatedCand);
          }}
          isAnonymousMode={isAnonymousMode}
        />
      </div>

      {/* Google Calendar Booking Container */}
      <div className="space-y-4 no-print">
        <CalendarBooking
          candidate={candidate}
          campaign={campaign}
          onRefreshCandidateData={(updatedCand) => {
            setActiveCandidate(updatedCand);
          }}
          isAnonymousMode={isAnonymousMode}
        />
      </div>
    </motion.div>
  );
}
