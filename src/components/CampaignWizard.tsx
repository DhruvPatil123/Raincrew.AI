import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Plus, Trash2, ArrowLeft, Send, ShieldCheck, Lock, Video, 
  Award, Bookmark, ClipboardCopy, Code2, Compass, Cpu, 
  Download, FileJson, Layers, MapPin, Save, Share2, Star, CheckCircle, HelpCircle, FileText
} from 'lucide-react';
import { Campaign } from '../types';
import { PRE_BUILT_TEMPLATES, COMMUNITY_TEMPLATES, JobTemplate } from '../data/jobTemplates';

interface CampaignWizardProps {
  onBack: () => void;
  onSave: (campaign: Omit<Campaign, 'id' | 'createdAt' | 'candidateCount'>) => void;
}

export default function CampaignWizard({ onBack, onSave }: CampaignWizardProps) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [experience, setExperience] = useState('Senior (5+ years)');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Loaded Template Alert State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Template Tab state
  const [templateTab, setTemplateTab] = useState<'roles' | 'community' | 'saved'>('roles');

  // Load custom saved templates from localStorage
  const [savedTemplates, setSavedTemplates] = useState<JobTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('saved_campaign_templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleLoadTemplate = (template: JobTemplate) => {
    setTitle(template.title);
    setDepartment(template.department);
    setExperience(template.experience);
    setDescription(template.description);
    setQuestions([...template.questions]);
    if (template.sttEngine) {
      setSttEngine(template.sttEngine);
    }
    setToastMessage(`Successfully loaded "${template.title}" template with ${template.questions.length} questions!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveAsTemplate = () => {
    if (!title.trim()) {
      setAiError("Please fill out the Job Title to save this configuration as a template.");
      return;
    }
    if (questions.length === 0) {
      setAiError("Can only save a template if there is at least 1 question on the vetting board.");
      return;
    }

    const newCustomTemplate: JobTemplate = {
      id: `custom-template-${Date.now()}`,
      title: title.trim(),
      department,
      experience,
      description: description.trim(),
      questions: [...questions],
      sttEngine,
      isCommunity: false,
      sharedBy: 'My Organization',
      downloads: 1
    };

    const updated = [newCustomTemplate, ...savedTemplates];
    setSavedTemplates(updated);
    try {
      localStorage.setItem('saved_campaign_templates', JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to persist custom template", e);
    }

    setToastMessage(`Saved "${title.trim()}" directly into "My Saved Templates"! Ready to reuse anytime.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRemoveSavedTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent loading it when hitting delete
    const filtered = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(filtered);
    try {
      localStorage.setItem('saved_campaign_templates', JSON.stringify(filtered));
    } catch (err) {
      console.error(err);
    }
    setToastMessage("Saved template deleted.");
    setTimeout(() => setToastMessage(null), 3050);
  };

  // New Voice, Anti-Cheat & Compliance States
  const [sttEngine, setSttEngine] = useState<'deepgram' | 'assemblyai' | 'whisper'>('deepgram');
  const [enableMediaPipeCameraProctor, setEnableMediaPipeCameraProctor] = useState(true);
  const [gdprConsentTextOverride, setGdprConsentTextOverride] = useState('');

  const generateAiQuestions = async () => {
    if (!title.trim() || !description.trim()) {
      setAiError("Please fill out the Job Title and Job Description first to help the AI contextualize questions.");
      return;
    }

    setAiError(null);
    setIsAiGenerating(true);

    try {
      const response = await fetch('/api/generate_questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          experience
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate questions. Is Gemini API key valid?");
      }

      const data = await response.json();
      if (Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        throw new Error("Invalid response format received from AI.");
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Something went wrong during generation. Please double-check your network or secrets.");
      // Fallback questions to prevent blockages
      setQuestions([
        `What primary challenges have you solved previously in respect to the core aspects of ${title || "this position"}?`,
        `Describe a scenario where you had to quickly learn or adopt a technical pattern to meet a critical deadline.`,
        `How do you collaborate across departments or teams to communicate progress or technical roadblocks?`,
        `Given the requirements for this role, which of your unique skills makes you a standout candidate for this fit?`
      ]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    setQuestions([...questions, newQuestionText.trim()]);
    setNewQuestionText('');
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!title.trim()) return;
    if (questions.length === 0) {
      setAiError("Please add at least one screening question before publishing the campaign.");
      return;
    }
    
    onSave({
      title: title.trim(),
      department,
      description: description.trim(),
      experience,
      questions,
      sttEngine,
      enableMediaPipeCameraProctor,
      gdprConsentTextOverride: gdprConsentTextOverride.trim() || undefined
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-3xl p-8 shadow-sm"
    >
      {/* Header row */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-50 border border-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-blue-600">Form Wizard</span>
          <h1 className="text-2xl font-bold text-slate-800">Launch New Screening Campaign</h1>
        </div>
      </div>

      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-800"
          >
            <CheckCircle className="w-5 h-5 text-emerald-450 shrink-0" />
            <p className="text-[11.5px] font-bold text-slate-100 leading-snug">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-8">
        {/* TEMPLATE PICKER BLOCK */}
        <div className="bg-slate-50/75 border border-slate-205 rounded-3xl p-5 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/50 pb-3">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-rose-500 animate-pulse" /> Interview Question Bank & Templates
              </h3>
              <p className="text-[10.5px] text-slate-400">Initialize your job descriptions and dynamic question decks instantly using proven frameworks.</p>
            </div>
            
            {/* Tab Switches */}
            <div className="flex bg-slate-200/50 p-1 rounded-xl self-start sm:self-center">
              <button
                type="button"
                onClick={() => setTemplateTab('roles')}
                className={`px-3 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                  templateTab === 'roles' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Role-Based Templates
              </button>
              <button
                type="button"
                onClick={() => setTemplateTab('community')}
                className={`px-3 py-1 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                  templateTab === 'community' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Community
              </button>
              <button
                type="button"
                onClick={() => setTemplateTab('saved')}
                className={`px-3 py-1 text-[10.5px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  templateTab === 'saved' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                My Saved ({savedTemplates.length})
              </button>
            </div>
          </div>

          <div>
            {templateTab === 'roles' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {PRE_BUILT_TEMPLATES.map(temp => (
                  <div 
                    key={temp.id} 
                    onClick={() => handleLoadTemplate(temp)}
                    className="bg-white hover:bg-slate-50/50 hover:border-indigo-200/90 border border-slate-150 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between hover:shadow-3xs group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                          {temp.department}
                        </span>
                        <Code2 className="w-3.5 h-3.5 text-slate-350 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors">
                          {temp.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {temp.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3 text-[10px] font-semibold text-slate-400">
                      <span>{temp.questions.length} questions</span>
                      <span className="text-indigo-500 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 font-bold">
                        Apply Profile <Bookmark className="w-3 h-3 text-indigo-400" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {templateTab === 'community' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {COMMUNITY_TEMPLATES.map(temp => (
                  <div 
                    key={temp.id} 
                    onClick={() => handleLoadTemplate(temp)}
                    className="bg-white hover:bg-indigo-50/20 hover:border-indigo-200/90 border border-slate-150 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between hover:shadow-3xs group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-purple-600 px-1.5 py-0.5 bg-purple-50 rounded border border-purple-100/50">
                          {temp.sharedBy}
                        </span>
                        <div className="flex items-center gap-1 text-[9.5px] font-bold text-slate-400">
                          <Download className="w-3 h-3 text-slate-300" />
                          <span>{temp.downloads}</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-snug group-hover:text-purple-600 transition-colors">
                          {temp.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {temp.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3 text-[10px] font-semibold text-slate-400">
                      <span>{temp.questions.length} questions</span>
                      <span className="text-purple-600 flex items-center gap-0.5 font-bold">
                        Load Template <Share2 className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {templateTab === 'saved' && (
              <div>
                {savedTemplates.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2">
                    <Bookmark className="w-6 h-6 text-slate-300 mx-auto" />
                    <h5 className="text-xs font-bold text-slate-700">No Custom Saved Templates yet</h5>
                    <p className="text-[10.5px] text-slate-400 max-w-sm mx-auto leading-normal">
                      Formulate specialized requirements, manual questions, and integrity rules below, then tap <strong className="text-slate-600">"Save Config as Template"</strong> to construct reusable internal models.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {savedTemplates.map(temp => (
                      <div 
                        key={temp.id} 
                        onClick={() => handleLoadTemplate(temp)}
                        className="bg-white hover:bg-emerald-50/10 hover:border-emerald-200 border border-slate-150 rounded-2xl p-4 cursor-pointer transition-all flex flex-col justify-between hover:shadow-3xs group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8.5px] font-bold uppercase tracking-wider text-emerald-600 px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-100">
                              Custom Saved
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveSavedTemplate(temp.id, e)}
                              className="p-1 hover:bg-rose-50 text-slate-350 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                              title="Delete template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 leading-snug group-hover:text-emerald-600 transition-colors">
                              {temp.title}
                            </h4>
                            <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                              {temp.description || 'No requirements summaries specified.'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3 text-[10px] font-semibold text-slate-400">
                          <span>{temp.questions.length} questions</span>
                          <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                            Load Saved <Save className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Form Details Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Job Title</label>
            <input
              type="text"
              placeholder="e.g. Senior Frontend Developer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm"
            >
              <option value="Engineering">Engineering</option>
              <option value="Product">Product Management</option>
              <option value="Sales & Growth">Sales & Growth</option>
              <option value="Design">UX/UI Design</option>
              <option value="Operations">Operations & HR</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Target Experience</label>
            <input
              type="text"
              placeholder="e.g. 3-5 years"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-semibold text-slate-700">Role Summary / Requirements</label>
            <textarea
              placeholder="Summarize key tools, skill sets, and objectives for the position to feed into the AI question model..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Voice Tech & Proctor Integrity Settings */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <ShieldCheck className="w-4.5 h-4.5 text-blue-600" /> Voice & Proctor Integrity Stack
            </h3>
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-extrabold text-[9px] uppercase tracking-wide">Enterprise Settings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* STT Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                Speech-to-Text (STT) Engine
              </label>
              <select
                value={sttEngine}
                onChange={(e) => setSttEngine(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 cursor-pointer text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
              >
                <option value="deepgram">Deepgram Nova-3 WebSocket (sub-300ms real-time conversational optimized)</option>
                <option value="assemblyai">AssemblyAI Universal-2 (Post-Interview Sentiment & Score Metrics)</option>
                <option value="whisper">Self-Hosted Whisper (On-Premise Privacy & Security Fallback)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                {sttEngine === 'deepgram' && "Fastest speech recognition, perfect for organic dynamic interruptions."}
                {sttEngine === 'assemblyai' && "Optimal for deep sentiment profiling, vocabulary grading, and multi-actor diarization."}
                {sttEngine === 'whisper' && "Complies with strict internal frameworks by ensuring speech stays in sandbox storage."}
              </p>
            </div>

            {/* MediaPipe Camera Anti-Cheat */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                Gaze & Multi-Face Camera Proctoring
              </label>
              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="enableMediaPipeCameraProctor"
                  checked={enableMediaPipeCameraProctor}
                  onChange={(e) => setEnableMediaPipeCameraProctor(e.target.checked)}
                  className="rounded border-slate-300 text-blue-650 focus:ring-blue-500 h-4.5 w-4.5 cursor-pointer"
                />
                <label htmlFor="enableMediaPipeCameraProctor" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Enable MediaPipe FaceLandmarker analysis
                </label>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Uses computer vision to detect gaze drift (looking away), head pose pitch/yaw fluctuations, and multiple faces. Active alongside Page Visibility Tab-Switch auditing.
              </p>
            </div>
          </div>

          {/* GDPR Consent Override Customizer */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> GDPR Biometric Consent Statement Override (Optional)
            </div>
            <textarea
              placeholder="Leave empty to load default global vetting consent boilerplate..."
              value={gdprConsentTextOverride}
              onChange={(e) => setGdprConsentTextOverride(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 placeholder-slate-400 bg-white leading-relaxed"
            />
            <p className="text-[10px] text-slate-400">
              Customize authorization language presented to candidates regarding voice logging, video frames processing, and tab visibility hooks before entering the interview room.
            </p>
          </div>
        </div>

        {/* AI Vetting Assistant Module */}
        <div className="bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-2xl p-6 border border-slate-800 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-widest bg-blue-500 text-white flex items-center gap-1 w-max">
                <Sparkles className="w-3 h-3" /> Gemini LLM Ready
              </span>
              <h2 className="text-lg font-semibold tracking-tight">Generate Candidate Vetting Questions</h2>
              <p className="text-slate-300 text-xs max-w-xl">
                Let Gemini design high-yield conversational questions matching your exact job requirements. Vetting focuses on technical logic and adaptive scenario behaviors.
              </p>
            </div>
            <button
              type="button"
              onClick={generateAiQuestions}
              disabled={isAiGenerating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium tracking-wide shadow-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isAiGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Suggest Questions
                </>
              )}
            </button>
          </div>

          {aiError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
              {aiError}
            </div>
          )}

          {/* Active Questions Pool */}
          <div className="space-y-3 mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Vetting Board ({questions.length})</label>
            
            {questions.length === 0 ? (
              <p className="text-slate-400 text-sm italic py-4 text-center border border-dashed border-slate-800 rounded-xl">
                Click "Suggest Questions" above or add them manually below to form your campaign screening logic.
              </p>
            ) : (
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 group"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-semibold mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-slate-200 text-sm leading-relaxed">{q}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(idx)}
                      className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Input field */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add custom vetting question manually..."
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddQuestion(); } }}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <button
              type="button"
              onClick={handleAddQuestion}
              className="p-2.5 bg-slate-800 hover:bg-slate-755 text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-slate-500 hover:bg-slate-50 font-medium text-sm rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            className="px-5 py-2.5 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-805 font-medium text-sm rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer bg-white"
          >
            <Bookmark className="w-4 h-4 text-emerald-500 shrink-0" /> Save Config as Template
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || questions.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Launch Campaign
          </button>
        </div>
      </div>
    </motion.div>
  );
}
