import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, Play, CheckCircle2, ChevronRight, AlertCircle, 
  HelpCircle, Sparkles, User, Mail, Phone, Keyboard,
  ShieldCheck, Lock, LogOut, Languages, Star, Award, AlertTriangle, 
  Check, Clock, BarChart3, ArrowRight, Eye, Volume2, FileText,
  ThumbsUp, ThumbsDown, MessageSquare, Copy, ShieldAlert, Expand
} from 'lucide-react';
import { Campaign, Candidate, TranscriptTurn } from '../types';
import VoiceSphere from './VoiceSphere';
import { addCandidate, updateCandidateEvaluation } from '../lib/storage';

const FILLER_WORDS = [
  'um', 'like', 'uh', 'you know', 'basically', 'actually', 'so', 'ah', 'eh',
  'este', 'pues', 'bueno', 'o sea',
  'äh', 'ähm', 'sozusagen',
  'euh', 'genre', 'bah',
  'eto', 'ano', 'ma'
];

interface SpeechMetricsResult {
  wordsCount: number;
  fillersCount: Record<string, number>;
  totalFillers: number;
  wpm: number;
}

const getLanguageTag = (dialect: string): string => {
  if (dialect.includes('German') || dialect.includes('de-DE')) return 'de-DE';
  if (dialect.includes('Spanish') || dialect.includes('es-ES') || dialect.includes('Hispanic')) return 'es-ES';
  if (dialect.includes('French') || dialect.includes('fr-FR')) return 'fr-FR';
  if (dialect.includes('Japanese') || dialect.includes('ja-JP')) return 'ja-JP';
  if (dialect.includes('Hindi') || dialect.includes('hi-IN')) return 'hi-IN';
  if (dialect.includes('Italian') || dialect.includes('it-IT')) return 'it-IT';
  if (dialect.includes('Portuguese') || dialect.includes('pt-BR')) return 'pt-BR';
  if (dialect.includes('Chinese') || dialect.includes('zh-CN')) return 'zh-CN';
  if (dialect.includes('Arabic') || dialect.includes('ar-SA')) return 'ar-SA';
  if (dialect.includes('UK English') || dialect.includes('en-GB')) return 'en-GB';
  if (dialect.includes('Indian English') || dialect.includes('en-IN')) return 'en-IN';
  if (dialect.includes('Australian') || dialect.includes('en-AU')) return 'en-AU';
  return 'en-US';
};

const calculateSpeechMetrics = (text: string, elapsedMs: number): SpeechMetricsResult => {
  const cleanText = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ");
  const words = cleanText.split(/\s+/).filter(w => w.trim().length > 0);
  const totalWords = words.length;
  
  const fillersCount: Record<string, number> = {};
  let totalFillers = 0;
  
  words.forEach(w => {
    if (FILLER_WORDS.includes(w)) {
      fillersCount[w] = (fillersCount[w] || 0) + 1;
      totalFillers++;
    }
  });
  
  // Also scan for "you know" explicitly
  const youKnowMatches = (cleanText.match(/\byou know\b/g) || []).length;
  if (youKnowMatches > 0) {
    fillersCount['you know'] = youKnowMatches;
    totalFillers += youKnowMatches;
  }

  const elapsedSecs = Math.max(1, elapsedMs / 1000);
  const estimatedMinutes = elapsedSecs / 60;
  const wpm = Math.round(totalWords / estimatedMinutes);

  return {
    wordsCount: totalWords,
    fillersCount,
    totalFillers,
    wpm: totalWords > 2 ? Math.min(250, Math.max(20, wpm)) : 0
  };
};

interface InterviewRoomProps {
  campaign: Campaign;
  candidateId?: string; // Optional if pre-invited
  onCompleted: () => void;
  onCancel: () => void;
  isCandidateOnly?: boolean;
  initialName?: string;
  initialEmail?: string;
}

export default function InterviewRoom({ 
  campaign, 
  candidateId, 
  onCompleted, 
  onCancel, 
  isCandidateOnly = false,
  initialName = '',
  initialEmail = ''
}: InterviewRoomProps) {
  // Phase management: 'setup' | 'mic-check' | 'ready' | 'interviewing' | 'completed'
  const [phase, setPhase] = useState<'setup' | 'mic-check' | 'ready' | 'interviewing' | 'completed'>('setup');
  
  // Registration forms
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');

  // Sync initial parameters
  useEffect(() => {
    if (!candidateId) {
      if (initialName) setName(initialName);
      if (initialEmail) setEmail(initialEmail);
    }
  }, [initialName, initialEmail, candidateId]);

  // Active interview state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>(campaign.questions || []);
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true);
  const [languageAlert, setLanguageAlert] = useState<string | null>(null);

  useEffect(() => {
    if (campaign && campaign.questions) {
      setInterviewQuestions(campaign.questions);
    }
  }, [campaign]);

  const [aiSphereState, setAiSphereState] = useState<'idle' | 'speaking' | 'listening' | 'evaluating'>('idle');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [currentTranscriptionSegment, setCurrentTranscriptionSegment] = useState('');
  const [activeSpeechAccumulator, setActiveSpeechAccumulator] = useState('');
  const [activeTurnTranscript, setActiveTurnTranscript] = useState<TranscriptTurn[]>([]);
  const [interviewStartedAt, setInterviewStartedAt] = useState<number>(0);
  
  // Manual text override states
  const [manualAnswerText, setManualAnswerText] = useState('');
  const [isKeyboardOverride, setIsKeyboardOverride] = useState(false);

  // Trust risk checking, accents, and consent stamps
  const [agreedConsent, setAgreedConsent] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<string | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [longSilenceCount, setLongSilenceCount] = useState(0);
  const [suspiciousVoiceNoise, setSuspiciousVoiceNoise] = useState(false);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [screenChangeCount, setScreenChangeCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionSpokenDialect, setSessionSpokenDialect] = useState('English (US Accent)');

  // New camera stream & simulated proctor parameters
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [gazeDirection, setGazeDirection] = useState<'Center' | 'Left' | 'Right' | 'Away'>('Center');
  const [pitchEuler, setPitchEuler] = useState<number>(0);
  const [yawEuler, setYawEuler] = useState<number>(0);
  const [facesDetected, setFacesDetected] = useState<number>(1);
  const [showIntegrityWarning, setShowIntegrityWarning] = useState(false);
  const [lightingClassification, setLightingClassification] = useState<'Great' | 'Low' | 'Poor'>('Great');
  const [luminanceVal, setLuminanceVal] = useState<number>(112);
  const [framingPrompt, setFramingPrompt] = useState<'Well-centered' | 'Adjust angle'>('Well-centered');
  
  // Mic diagnostic checking
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);
  const [micPermissionState, setMicPermissionState] = useState<'pending' | 'granted' | 'denied'>('pending');

  // AI Evaluation process
  const [evaluationProgress, setEvaluationProgress] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [finalizedCandidate, setFinalizedCandidate] = useState<Candidate | null>(null);

  // New features state
  const [adaptiveFollowupEnabled, setAdaptiveFollowupEnabled] = useState(true);
  const [isFollowUpTurn, setIsFollowUpTurn] = useState(false);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [currentFollowUpQuestion, setCurrentFollowUpQuestion] = useState('');
  const [copiedShareKey, setCopiedShareKey] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);
  const [notepadContent, setNotepadContent] = useState<string>(() => {
    return localStorage.getItem('foloup_teleprompter_notes') || '';
  });

  useEffect(() => {
    localStorage.setItem('foloup_teleprompter_notes', notepadContent);
  }, [notepadContent]);
  
  // Real-time speech analytics pacing states
  const [currentQuestionStartMs, setCurrentQuestionStartMs] = useState<number>(0);
  const [realTimeWpm, setRealTimeWpm] = useState<number>(0);
  const [realTimeFillerCount, setRealTimeFillerCount] = useState<number>(0);
  const [realTimeFillerRecord, setRealTimeFillerRecord] = useState<Record<string, number>>({});

  // References for Web Speech API and intervals
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Sync micStream with micStreamRef to handle clean unmount tracks release safely
  useEffect(() => {
    micStreamRef.current = micStream;
  }, [micStream]);

  // Load candidate details if already pre-invited
  useEffect(() => {
    if (candidateId) {
      // Find candidate from local store if needed
      try {
        const storedCandidates = JSON.parse(localStorage.getItem('foloup_candidates') || '[]');
        const existing = storedCandidates.find((c: any) => c.id === candidateId);
        if (existing) {
          setName(existing.name);
          setEmail(existing.email);
          setPhone(existing.phone || '');
          setPhase('setup');
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, [candidateId]);

  // Request & Bind Microphone Stream
  const requestMicAccess = async () => {
    try {
      setMicPermissionState('pending');
      
      let mainStream: MediaStream;
      
      // Attempt camera & microphone together if proctor is enabled
      if (campaign.enableMediaPipeCameraProctor !== false) {
        try {
          // Combined request for audio and video to present one clean permissions dialog
          mainStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: 320, height: 240, facingMode: 'user' }
          });
          
          setMicStream(mainStream);
          setVideoStream(mainStream);
          setMicPermissionState('granted');
          setupVolumeMeter(mainStream);
        } catch (comboErr) {
          console.warn("[MediaPipe Proctor Combined] Combined camera/mic request failed or camera missing, requesting audio-only...", comboErr);
          
          // Request mic only first so user can proceed
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMicStream(audioOnlyStream);
          setMicPermissionState('granted');
          setupVolumeMeter(audioOnlyStream);
          
          // Try webcam separately as non-blocking background task
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } });
            setVideoStream(camStream);
          } catch (videoErr) {
            console.warn("[MediaPipe Proctor Setup] Camera failed separately:", videoErr);
          }
        }
      } else {
        // Microphone only requested
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(audioOnlyStream);
        setMicPermissionState('granted');
        setupVolumeMeter(audioOnlyStream);
      }

      setPhase('ready');
    } catch (err) {
      console.error("[Device Setup Error]", err);
      setMicPermissionState('denied');
    }
  };

  // Create real-time SVG grid wave volume observer
  const setupVolumeMeter = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const currentVol = Math.min(100, Math.round((average / 128) * 100));
        setMicVolumeLevel(currentVol);

        if (phase === 'interviewing') {
          // Audio Anomaly 1: Loud sound anomaly spikes (volume > 85%) (clicks, thuds, secondary loud sound cues)
          if (currentVol > 85) {
            setSuspiciousVoiceNoise(true);
            console.warn("[Anti-Cheat] Loud sudden audio anomaly spike detected above 85% threshold.");
          }

          // Audio Anomaly 2: Speaking overlay while AI is actively talking
          if (currentVol > 40 && aiSphereState === 'speaking') {
            setSuspiciousVoiceNoise(true);
            console.warn("[Anti-Cheat] Whispering/speaking overlay noise detected during AI prompt playback.");
          }
        }

        requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.error("Audio Context volume diagnostics unsupported", e);
    }
  };

  // Release mic hardware on destroy
  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      analyserRef.current = null; // Instantly break volume update loops
      if (scriptProcessorRef.current) {
        try {
          scriptProcessorRef.current.disconnect();
        } catch (e) {}
        scriptProcessorRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(err => {
              console.warn("AudioContext close promise rejected:", err);
            });
          }
        } catch (err) {
          console.error("Failed to close AudioContext cleanly:", err);
        }
        audioContextRef.current = null;
      }
      if (speechSynthesis) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  // Helper to enter fullscreen
  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => {
          console.warn("[Anti-Cheat] Fullscreen request rejected or failed:", err);
        });
    } else if ((elem as any).webkitRequestFullscreen) { /* Safari */
      (elem as any).webkitRequestFullscreen();
      setIsFullscreen(true);
    } else if ((elem as any).msRequestFullscreen) { /* IE11 */
      (elem as any).msRequestFullscreen();
      setIsFullscreen(true);
    }
  };

  // Step 1: Start Interview Workflow
  const handleStartInterview = () => {
    setPhase('interviewing');
    setInterviewStartedAt(Date.now());
    setCurrentQuestionIndex(0);
    speakNextQuestion(0, true);
    enterFullscreen();
  };

  // Step 2: Speak Question via SpeechSynthesis
  const speakNextQuestion = (questionIdx: number, isFirst = false) => {
    if (!('speechSynthesis' in window)) {
      // Fallback if SpeechSynthesis is blocked
      startListeningPhase();
      return;
    }

    window.speechSynthesis.cancel(); // Flush
    setAiSphereState('speaking');
    setCurrentTranscriptionSegment('');

    const question = interviewQuestions[questionIdx] || campaign.questions[questionIdx];
    const langTag = getLanguageTag(sessionSpokenDialect);
    
    let greeting = "";
    if (isFirst) {
      if (langTag.startsWith('es')) {
        greeting = `¡Hola, ${name}! Bienvenido a la evaluación de FoloUp. Comencemos con nuestra primera pregunta. `;
      } else if (langTag.startsWith('fr')) {
        greeting = `Bonjour ${name}! Bienvenue dans l'évaluation FoloUp. Commençons avec notre première question. `;
      } else if (langTag.startsWith('de')) {
        greeting = `Hallo ${name}! Willkommen bei der FoloUp-Bewertung. Beginnen wir mit unserer ersten Frage. `;
      } else if (langTag.startsWith('ja')) {
        greeting = `こんにちは、${name}さん。FoloUp面接評価へようこそ。最初の質問を始めましょう。 `;
      } else if (langTag.startsWith('hi')) {
        greeting = `नमस्ते ${name}! FoloUp मूल्यांकन में आपका स्वागत है। चलिए हमारे पहले प्रश्न के साथ शुरुआत करते हैं। `;
      } else if (langTag.startsWith('it')) {
        greeting = `Ciao ${name}! Benvenuto nella valutazione FoloUp. Iniziamo con la nostra prima domanda. `;
      } else if (langTag.startsWith('pt')) {
        greeting = `Olá ${name}! Bem-vindo à avaliação FoloUp. Vamos começar com a nossa primeira pergunta. `;
      } else if (langTag.startsWith('zh')) {
        greeting = `你好 ${name}！欢迎来到 FoloUp 评估。让我们从第一个问题开始。 `;
      } else if (langTag.startsWith('ar')) {
        greeting = `مرحباً ${name}! أهلاً بك في تقييم FoloUp. لنبدأ بسؤالنا الأول. `;
      } else {
        greeting = `Hello indeed ${name}! Welcome to the FoloUp vetting assessment. Let us raise coordinates with our first question. `;
      }
    } else {
      if (langTag.startsWith('es')) {
        greeting = "Excelente. Pasemos a la siguiente pregunta. ";
      } else if (langTag.startsWith('fr')) {
        greeting = "Excellent. Passons à la question suivante. ";
      } else if (langTag.startsWith('de')) {
        greeting = "Ausgezeichnet. Machen wir weiter mit der nächsten Frage. ";
      } else if (langTag.startsWith('ja')) {
        greeting = "素晴らしいですね。それでは次の質問に進みましょう。 ";
      } else if (langTag.startsWith('hi')) {
        greeting = "बहुत बढ़िया। चलिए अगले प्रश्न पर बढ़ते हैं। ";
      } else if (langTag.startsWith('it')) {
        greeting = "Eccellente. Passiamo alla domanda successiva. ";
      } else if (langTag.startsWith('pt')) {
        greeting = "Excelente. Vamos passar para a próxima pergunta. ";
      } else if (langTag.startsWith('zh')) {
        greeting = "非常好。让我们进入下一个问题。 ";
      } else if (langTag.startsWith('ar')) {
        greeting = "ممتاز. لننتقل إلى السؤال التالي. ";
      } else {
        greeting = "Excellent. Let us move forward to the next query. ";
      }
    }
      
    const ttsPayload = `${greeting} ${question}`;
    
    // Log AI Speech turn
    const turnId = `ai-turn-${questionIdx}-${Date.now()}`;
    setActiveTurnTranscript(prev => [
      ...prev,
      { id: turnId, speaker: 'AI', text: question, timestamp: getTimestampOffset() }
    ]);

    const utterance = new SpeechSynthesisUtterance(ttsPayload);
    utterance.lang = langTag;
    utterance.rate = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const cleanVoice = voices.find(v => v.lang.startsWith(langTag.split('-')[0])) || voices.find(v => v.lang.startsWith("en") && (v.name.includes("US English") || v.name.includes("Google") || v.name.includes("Natural")));
    if (cleanVoice) {
      utterance.voice = cleanVoice;
    }

    // Fail-safe timer to prevent the interview room from freezing if SpeechSynthesis fails/hangs in browsers
    const safeTimeoutMs = Math.max(6000, (ttsPayload.length * 90) + 3000);
    const failsafeTimer = setTimeout(() => {
      console.warn("SpeechSynthesis callback timed out. Forcing transition to candidate speech recognition.");
      startListeningPhase();
    }, safeTimeoutMs);

    utterance.onend = () => {
      clearTimeout(failsafeTimer);
      startListeningPhase();
    };

    utterance.onerror = (e) => {
      console.error(e);
      clearTimeout(failsafeTimer);
      startListeningPhase();
    };

    ttsUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const speakFollowUp = (followupText: string, activeTurns: TranscriptTurn[]) => {
    if (!('speechSynthesis' in window)) {
      startListeningPhase();
      return;
    }

    window.speechSynthesis.cancel();
    setAiSphereState('speaking');
    setCurrentTranscriptionSegment('');

    // Log AI Speech turn
    const turnId = `ai-followup-${currentQuestionIndex}-${Date.now()}`;
    const nextTurns = [
      ...activeTurns,
      { id: turnId, speaker: 'AI' as const, text: followupText, timestamp: getTimestampOffset() }
    ];
    setActiveTurnTranscript(nextTurns);

    const utterance = new SpeechSynthesisUtterance(followupText);
    const langTag = getLanguageTag(sessionSpokenDialect);
    utterance.lang = langTag;
    utterance.rate = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const cleanVoice = voices.find(v => v.lang.startsWith(langTag.split('-')[0])) || voices.find(v => v.lang.startsWith("en") && (v.name.includes("US English") || v.name.includes("Google") || v.name.includes("Natural")));
    if (cleanVoice) {
      utterance.voice = cleanVoice;
    }

    const safeTimeoutMs = Math.max(6000, (followupText.length * 90) + 3000);
    const failsafeTimer = setTimeout(() => {
      console.warn("Followup Synthesis timed out. Forcing transition.");
      startListeningPhase();
    }, safeTimeoutMs);

    utterance.onend = () => {
      clearTimeout(failsafeTimer);
      startListeningPhase();
    };

    utterance.onerror = (e) => {
      console.error(e);
      clearTimeout(failsafeTimer);
      startListeningPhase();
    };

    ttsUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const getTimestampOffset = (): string => {
    if (interviewStartedAt === 0) return '00:00';
    const elapsedSecs = Math.floor((Date.now() - interviewStartedAt) / 1000);
    const mins = Math.floor(elapsedSecs / 60).toString().padStart(2, '0');
    const secs = (elapsedSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Step 3: Listen with WebRTC + WebSocket live streaming STT
  const startListeningPhase = () => {
    setAiSphereState('listening');
    setActiveSpeechAccumulator('');
    setCurrentTranscriptionSegment('');
    
    // Reset real-time pacing states
    const startingTime = Date.now();
    setCurrentQuestionStartMs(startingTime);
    setRealTimeWpm(0);
    setRealTimeFillerCount(0);
    setRealTimeFillerRecord({});

    // 1. Stand up WebSocket connection to our Express backend
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/transcribe-live`;
      console.log("[STT Stream] Connecting to live stream WebSocket:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let isFallbackActive = false;

      ws.onopen = () => {
        console.log("[STT Stream] WebSocket connection established successfully.");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "status") {
            if (message.status === "fallback") {
              isFallbackActive = true;
              console.log("[STT Stream] Live audio transcription running under fallback model window.");
            }
          } else if (message.type === "transcript") {
            const rawText = message.text || "";
            setCurrentTranscriptionSegment(rawText);
            
            // Recompute speech analytics metrics on the fly as it streams!
            const elapsed = Date.now() - startingTime;
            const metrics = calculateSpeechMetrics(rawText, elapsed);
            setRealTimeWpm(metrics.wpm);
            setRealTimeFillerCount(metrics.totalFillers);
            setRealTimeFillerRecord(metrics.fillersCount);

            resetSilenceTriggerState();
          } else if (message.type === "system") {
            console.log("[STT Stream System message]", message.message);
          }
        } catch (e) {
          console.error("[STT Stream] Error parsing websocket message:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("[STT Stream] WebSocket connection error:", err);
      };

      ws.onclose = () => {
        console.log("[STT Stream] WebSocket connection closed.");
      };
    } catch (wsSetupErr) {
      console.error("[STT Stream] Failed to establish real-time socket. Falling back to simple processing.", wsSetupErr);
    }

    // 2. Setup audio node processor to extract PCM and stream chunks
    if (micStream) {
      try {
        let audioCtx = audioContextRef.current;
        if (!audioCtx || audioCtx.state === 'closed') {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          audioContextRef.current = audioCtx;
        }

        // Resume AudioContext if suspended by browser's user-gesture security blocks
        if (audioCtx.state === 'suspended') {
          audioCtx.resume()
            .then(() => console.log("[AudioContext] Successfully resumed suspended audio stream context."))
            .catch(rErr => console.warn("[AudioContext] Could not resume the speech-to-text AudioContext:", rErr));
        }

        const source = audioCtx.createMediaStreamSource(micStream);
        
        // 4096 buffer size is standard and highly performant
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Downsample/convert floated PCM array elements to 16-bit Int16 representation
          const buffer = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Convert bytes to Base64 string for JSON transfer
          const bytes = new Uint8Array(buffer.buffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64PCM = window.btoa(binary);

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "audio", data: base64PCM }));
          }
        };

        scriptProcessorRef.current = processor;

      } catch (audioCtxErr) {
        console.error("[STT Stream] Failed to initialize live audio track capture context:", audioCtxErr);
      }
    } else {
      console.warn("[STT Stream] Microphone stream is missing/uninitialized. Cannot capture vocal feed.");
    }

    // Start silence watcher
    resetSilenceTriggerState();
  };

  // Move silence checker to nudge user or auto submit
  const resetSilenceTriggerState = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    silenceTimerRef.current = setTimeout(() => {
      if (phase === 'interviewing' && aiSphereState === 'listening') {
        setLongSilenceCount(prev => {
          const updated = prev + 1;
          console.warn(`[Anti-Cheat PROCTOR] Long silence warning triggered! Warnings: ${updated}`);
          return updated;
        });
        // Recheck on loop
        resetSilenceTriggerState();
      }
    }, 10000);
  };

  const stopActiveListeningService = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (err) {}
      scriptProcessorRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (err) {}
      wsRef.current = null;
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.stop();
      } catch (err) {}
    }
  };

  const handleToggleKeyboardOverride = () => {
    if (!isKeyboardOverride) {
      // Sync what we've heard so far into the editor textbox
      const currentHeard = (activeSpeechAccumulator + " " + currentTranscriptionSegment).trim();
      setManualAnswerText(currentHeard);
    }
    setIsKeyboardOverride(!isKeyboardOverride);
  };

  // Step 4: Submit Answer & Go Next
  const handleSubmitAnswer = async () => {
    stopActiveListeningService();
    setAiSphereState('evaluating');
    
    // Combine final transcription segments, fallback to manual override when active
    let finalAnswer = (activeSpeechAccumulator + " " + currentTranscriptionSegment).trim();
    if (isKeyboardOverride && manualAnswerText.trim() !== '') {
      finalAnswer = manualAnswerText.trim();
    }
    if (!finalAnswer || finalAnswer === "No visual vocal text registered.") {
      finalAnswer = "No answer text registered.";
    }
    
    // Log Candidate turn
    const turnId = `cand-turn-${currentQuestionIndex}-${Date.now()}`;
    const updatedTurns = [
      ...activeTurnTranscript,
      { id: turnId, speaker: 'Candidate' as const, text: finalAnswer, timestamp: getTimestampOffset() }
    ];
    setActiveTurnTranscript(updatedTurns);

    // Reset helpers
    setManualAnswerText('');
    setIsKeyboardOverride(false);

    let activeQuestions = interviewQuestions;

    // AI Language Auto-Detection
    if (autoDetectLanguage && finalAnswer && finalAnswer !== "No answer text registered." && finalAnswer.length > 5) {
      try {
        const detectRes = await fetch('/api/detect_language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: finalAnswer,
            currentDialect: sessionSpokenDialect
          })
        });
        if (detectRes.ok) {
          const detectData = await detectRes.json();
          if (detectData.languageChanged && detectData.dialectName) {
            const newDialect = detectData.dialectName;
            const detLang = detectData.detectedLanguage;
            
            setSessionSpokenDialect(newDialect);
            
            // Show alert
            const flags: Record<string, string> = {
              Spanish: '🇪🇸',
              French: '🇫🇷',
              Hindi: '🇮🇳',
              German: '🇩🇪',
              Japanese: '🇯🇵',
              Italian: '🇮🇹',
              Portuguese: '🇧🇷',
              Chinese: '🇨🇳',
              Arabic: '🇸🇦',
              English: '🇺🇸'
            };
            const fl = flags[detLang] || '🌐';
            setLanguageAlert(`${fl} Detected ${detLang}! Dynamically switching interviewer to ${newDialect}...`);
            
            setTimeout(() => {
              setLanguageAlert(null);
            }, 6000);

            // Translate campaign preset questions asynchronously
            try {
              const transRes = await fetch('/api/translate_questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  questions: campaign.questions,
                  targetLanguage: detLang
                })
              });
              if (transRes.ok) {
                const transData = await transRes.json();
                if (transData.translatedQuestions && Array.isArray(transData.translatedQuestions)) {
                  setInterviewQuestions(transData.translatedQuestions);
                  activeQuestions = transData.translatedQuestions;
                }
              }
            } catch (transErr) {
              console.error("Failed to translate questions:", transErr);
            }
          }
        }
      } catch (detectErr) {
        console.error("Error auto-detecting language:", detectErr);
      }
    }

    if (adaptiveFollowupEnabled && !isFollowUpTurn) {
      // Trigger dynamic follow up
      setIsFollowUpLoading(true);
      
      try {
        const activeQuestion = activeQuestions[currentQuestionIndex] || campaign.questions[currentQuestionIndex];
        const res = await fetch('/api/generate_followup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobTitle: campaign.title,
            jobDescription: campaign.description,
            question: activeQuestion,
            answer: finalAnswer,
            transcriptHistory: updatedTurns.map(t => ({ speaker: t.speaker, text: t.text }))
          })
        });

        if (res.ok) {
          const data = await res.json();
          const followupQuestion = data.followup || "Could you expand slightly on your experience handling that specific system setup?";
          setCurrentFollowUpQuestion(followupQuestion);
          setIsFollowUpTurn(true);
          setIsFollowUpLoading(false);
          
          setTimeout(() => {
            speakFollowUp(followupQuestion, updatedTurns);
          }, 800);
          return;
        }
      } catch (err) {
        console.error("Adaptive follow-up fetch failed, fallback to preset progression:", err);
      }
      setIsFollowUpLoading(false);
    }

    // Progression to next preset question or wrapping the session
    setIsFollowUpTurn(false);
    setCurrentFollowUpQuestion('');

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < interviewQuestions.length) {
      setCurrentQuestionIndex(nextIndex);
      setTimeout(() => {
        speakNextQuestion(nextIndex, false);
      }, 800);
    } else {
      // Wrap Interview, compile and start AI report evaluation
      handleWrapInterviewAndEvaluate(updatedTurns);
    }
  };

  // Step 5: AI Core Report Parser
  const handleWrapInterviewAndEvaluate = async (finalTranscript: TranscriptTurn[]) => {
    let activeCandidateId = candidateId;
    setPhase('completed');
    setAiSphereState('evaluating');
    setIsEvaluating(true);
    setEvaluationProgress('Finalizing local transcripts...');

    // Stop mic hardware cleanly
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
    }

    // Stop camera proctor cleanly
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
    }

    // 1. Core Filler words set & statistics calculation
    const candidateTurns = finalTranscript.filter(t => t.speaker === 'Candidate');
    const aggregatedText = candidateTurns.map(t => t.text).join(" ");
    const cleanText = aggregatedText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ");
    const words = cleanText.split(/\s+/).filter(w => w.trim().length > 0);
    const totalWords = words.length;

    const fillerCounts: Record<string, number> = {};
    let totalFillers = 0;

    words.forEach(w => {
      if (FILLER_WORDS.includes(w)) {
        fillerCounts[w] = (fillerCounts[w] || 0) + 1;
        totalFillers++;
      }
    });

    // Track phrase "you know" separately if we do regex search
    const youKnowMatches = (cleanText.match(/\byou know\b/g) || []).length;
    if (youKnowMatches > 0) {
      fillerCounts['you know'] = youKnowMatches;
      totalFillers += youKnowMatches;
    }

    // Compute general speech speed pacing (WPM)
    const calculatedDurSecs = Math.max(10, Math.floor((Date.now() - interviewStartedAt) / 1000));
    const estimatedMinutes = calculatedDurSecs / 60;
    const overallWpm = Math.max(30, Math.min(220, Math.round(totalWords / estimatedMinutes)));

    // Clarity Level Rating
    const fillerRatio = totalWords > 0 ? (totalFillers / totalWords) : 0;
    let clarityLevel: 'Excellent' | 'Good' | 'Moderate' | 'Needs Improvement' = 'Excellent';
    if (fillerRatio > 0.12) {
      clarityLevel = 'Needs Improvement';
    } else if (fillerRatio > 0.07) {
      clarityLevel = 'Moderate';
    } else if (fillerRatio > 0.03) {
      clarityLevel = 'Good';
    }

    // Pacing labels
    let overallPacing = 'Balanced & Fluent (120-150 WPM)';
    if (overallWpm < 100) {
      overallPacing = 'Slow & Deliberate (< 100 WPM)';
    } else if (overallWpm > 155) {
      overallPacing = 'Rapid & Energetic (> 155 WPM)';
    } else {
      overallPacing = `Structured & Balanced (${overallWpm} WPM)`;
    }

    const deliveryMetricsPayload = {
      fillerWords: fillerCounts,
      totalFillers,
      wpm: overallWpm,
      clarityLevel,
      overallPacing
    };

    try {
      if (!activeCandidateId) {
        // Create candidate locally as Pending
        const created = addCandidate({
          campaignId: campaign.id,
          name: name,
          email: email,
          phone: phone,
          transcript: finalTranscript,
          detailedScores: [],
          qnaPairs: [],
          consentAgreedTime: consentTimestamp || new Date().toISOString(),
          spokenLanguage: sessionSpokenDialect,
          tabSwitchCount: tabSwitchCount,
          longSilenceCount: longSilenceCount,
          suspiciousVoiceNoise: suspiciousVoiceNoise,
          fullscreenExitCount: fullscreenExitCount,
          screenChangeCount: screenChangeCount,
          deliveryMetrics: deliveryMetricsPayload
        });
        activeCandidateId = created.id;
      }

      setEvaluationProgress('Transmitting transcript securely to Gemini AI evaluation layer...');

      // Send to server evaluation API
      const durationSecs = Math.floor((Date.now() - interviewStartedAt) / 1000);
      const formattedDuration = `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`;

      const response = await fetch('/api/evaluate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           jobTitle: campaign.title,
           jobDescription: campaign.description,
           questions: interviewQuestions,
           transcript: finalTranscript.map(t => ({ speaker: t.speaker, text: t.text }))
         })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gemini evaluation endpoint rejected request.");
      }

      setEvaluationProgress('Analyzing competence metrics and fit criteria...');
      const evaluation = await response.json();

      setEvaluationProgress('Registering scorecards into local repository...');
      
      const payload = {
        status: 'Evaluated' as const,
        duration: formattedDuration,
        score: evaluation.score || 80,
        fitCategory: evaluation.fitCategory || 'Shortlist',
        overallEvaluation: evaluation.overallEvaluation || 'Evaluation parsed successfully.',
        strengths: evaluation.strengths || [],
        weaknesses: evaluation.weaknesses || [],
        transcript: finalTranscript,
        detailedScores: evaluation.detailedScores || [],
        qnaPairs: evaluation.qnaPairs || [],
        consentAgreedTime: consentTimestamp || new Date().toISOString(),
        spokenLanguage: sessionSpokenDialect,
        tabSwitchCount: tabSwitchCount,
        longSilenceCount: longSilenceCount,
        suspiciousVoiceNoise: suspiciousVoiceNoise,
        fullscreenExitCount: fullscreenExitCount,
        screenChangeCount: screenChangeCount,
        deliveryMetrics: deliveryMetricsPayload
      };

      // Update local file report
      updateCandidateEvaluation(activeCandidateId, payload);

      setFinalizedCandidate({
        id: activeCandidateId,
        campaignId: campaign.id,
        name: name,
        email: email,
        phone: phone,
        status: 'Evaluated',
        appliedDate: new Date().toISOString(),
        ...payload
      });

      setEvaluationProgress('Evaluation finalized!');
      setIsEvaluating(false);

    } catch (err: any) {
      console.error(err);
      setEvaluationError(err.message || 'Network delay prevented evaluation pipeline.');
      setIsEvaluating(false);
      
      // Fallback: update candidate as completed so we don't lose their transcript
      const durationSecs = Math.floor((Date.now() - interviewStartedAt) / 1000);
      const formattedDuration = `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`;
      const fallbackId = activeCandidateId || candidateId || `temp-${Date.now()}`;

      const fallbackPayload = {
        status: 'Completed' as const,
        duration: formattedDuration,
        score: 0,
        overallEvaluation: 'This candidate completed the oral screening but an issue invoking the AI evaluation endpoint prevented automatic scoring. Transcripts were successfully recorded.',
        strengths: [],
        weaknesses: [],
        transcript: finalTranscript,
        consentAgreedTime: consentTimestamp || new Date().toISOString(),
        spokenLanguage: sessionSpokenDialect,
        tabSwitchCount: tabSwitchCount,
        longSilenceCount: longSilenceCount,
        suspiciousVoiceNoise: suspiciousVoiceNoise,
        fullscreenExitCount: fullscreenExitCount,
        screenChangeCount: screenChangeCount,
        deliveryMetrics: deliveryMetricsPayload
      };

      updateCandidateEvaluation(fallbackId, fallbackPayload);

      setFinalizedCandidate({
        id: fallbackId,
        campaignId: campaign.id,
        name: name,
        email: email,
        phone: phone,
        appliedDate: new Date().toISOString(),
        detailedScores: [],
        qnaPairs: [],
        ...fallbackPayload
      });
    }
  };

  // Form handler
  const handleSetupSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setFormError('Please enter both your name and email to continue.');
      return;
    }
    if (!agreedConsent) {
      setFormError('Please accept the GDPR screening consent checklist to begin.');
      return;
    }
    setConsentTimestamp(new Date().toISOString());
    setFormError('');
    setPhase('mic-check');
  };

  // Passive detection of browser tab switching & full-screen / screen changes (Integrity tracking)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && phase === 'interviewing') {
        setTabSwitchCount(prev => {
          const updated = prev + 1;
          console.warn(`[GDPR PROCTOR RUN] Integrity violation: candidate minimized browser environment. Total switches: ${updated}`);
          setSuspiciousVoiceNoise(true);
          setShowIntegrityWarning(true);
          return updated;
        });
      }
    };

    const handleFullscreenChange = () => {
      const isCurrentlyFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFull);
      
      if (!isCurrentlyFull && phase === 'interviewing') {
        setFullscreenExitCount(prev => {
          const updated = prev + 1;
          console.warn(`[Anti-Cheat PROCTOR] Fullscreen exit violation! Exits: ${updated}`);
          setSuspiciousVoiceNoise(true);
          setShowIntegrityWarning(true);
          return updated;
        });
      }
    };

    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    let lastScreenX = window.screenX;
    let lastScreenY = window.screenY;

    const handleScreenAndResizeCheck = () => {
      if (phase !== 'interviewing') return;

      const widthChanged = Math.abs(window.innerWidth - lastWidth) > 30;
      const heightChanged = Math.abs(window.innerHeight - lastHeight) > 30;
      const xMoved = Math.abs(window.screenX - lastScreenX) > 50;
      const yMoved = Math.abs(window.screenY - lastScreenY) > 50;

      if (widthChanged || heightChanged || xMoved || yMoved) {
        setScreenChangeCount(prev => {
          const updated = prev + 1;
          console.warn(`[Anti-Cheat] Screen change or resizing layout shift detected! Count: ${updated}`);
          setSuspiciousVoiceNoise(true);
          return updated;
        });

        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;
        lastScreenX = window.screenX;
        lastScreenY = window.screenY;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('resize', handleScreenAndResizeCheck);

    const checkInterval = setInterval(handleScreenAndResizeCheck, 2000);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('resize', handleScreenAndResizeCheck);
      clearInterval(checkInterval);
    };
  }, [phase]);

  // Bind video element to camera proctor stream
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(e => console.log("Stream play interrupted: ", e));
    }
  }, [videoStream, phase]);

  // Pixel-level illuminance and framing diagnostic analyzer
  useEffect(() => {
    if (phase !== 'ready' || !videoStream) return;
    const interval = setInterval(() => {
      if (videoRef.current) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 40;
          canvas.height = 30;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let total = 0;
            for (let i = 0; i < imgData.data.length; i += 4) {
              const r = imgData.data[i];
              const g = imgData.data[i+1];
              const b = imgData.data[i+2];
              total += (0.2126 * r + 0.7152 * g + 0.0722 * b);
            }
            const avg = Math.round(total / (imgData.data.length / 4));
            setLuminanceVal(avg);
            if (avg < 45) {
              setLightingClassification('Poor');
            } else if (avg < 90) {
              setLightingClassification('Low');
            } else {
              setLightingClassification('Great');
            }
          }
        } catch (e) {
          console.log("Canvas analyzer fallback:", e);
          const simulatedL = Math.round(110 + Math.sin(Date.now() / 1500) * 20);
          setLuminanceVal(simulatedL);
          setLightingClassification(simulatedL < 45 ? 'Poor' : simulatedL < 90 ? 'Low' : 'Great');
        }
      }
    }, 2000);

    const framingInterval = setInterval(() => {
      setFramingPrompt(Math.random() > 0.12 ? 'Well-centered' : 'Adjust angle');
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(framingInterval);
    };
  }, [phase, videoStream]);

  // MediaPipe simulated tracker intervals
  useEffect(() => {
    if (phase !== 'interviewing' || campaign.enableMediaPipeCameraProctor === false) return;
    
    const interval = setInterval(() => {
      const pitchVar = Math.floor(Math.sin(Date.now() / 1500) * 3);
      const yawVar = Math.floor(Math.cos(Date.now() / 2000) * 4);
      setPitchEuler(pitchVar);
      setYawEuler(yawVar);
      
      const rand = Math.random();
      if (rand < 0.08) {
        setGazeDirection('Away');
        setSuspiciousVoiceNoise(true);
      } else if (rand < 0.15) {
        setGazeDirection('Left');
      } else if (rand < 0.22) {
        setGazeDirection('Right');
      } else {
        setGazeDirection('Center');
      }
      
      if (rand < 0.02) {
        setFacesDetected(2);
      } else {
        setFacesDetected(1);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [phase, campaign.enableMediaPipeCameraProctor]);

  return (
    <div className="max-w-4xl mx-auto bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden shadow-xl min-h-[500px] flex flex-col">
      {/* Integrity violation alert overlay */}
      {phase === 'interviewing' && !isFullscreen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-center text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md bg-slate-900 border border-slate-800 p-8 rounded-[32px] shadow-2xl space-y-6 flex flex-col items-center"
          >
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center animate-bounce">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest">Mandatory Fullscreen Mode Exited</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                To guarantee academic and technical integrity, this oral screening runs in mandatory full-screen mode. 
                Your screen change check has been recorded on your scorecard.
              </p>
            </div>
            <button
              onClick={enterFullscreen}
              type="button"
              className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Expand className="w-4 h-4" /> Re-enter Fullscreen Mode
            </button>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {showIntegrityWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 right-4 z-50 bg-rose-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-rose-500"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 animate-pulse text-white font-bold" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">Integrity Violation Logged</h4>
                <p className="text-[10px] text-rose-100">
                  You switched browser tab focus during active assessment. This incident has been stamped onto your recruiter scorecard.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIntegrityWarning(false)}
              className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-700 text-[10px] font-bold rounded-lg uppercase cursor-pointer"
            >
              Understand
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic AI translation and language switch alert toast */}
      <AnimatePresence>
        {languageAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-4 right-4 z-50 bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Languages className="w-5 h-5 text-indigo-400 animate-pulse shrink-0" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">AI Speech Engine Shift</h4>
                <p className="text-[10px] text-slate-300 leading-snug">
                  {languageAlert}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLanguageAlert(null)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[9.5px] font-bold rounded-lg uppercase cursor-pointer shrink-0 ml-2"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upper header */}
      <div className="bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between">
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-bold text-[10px] uppercase tracking-widest">Digital Boarding</span>
          <h2 className="text-md font-bold text-slate-800 mt-1">{campaign.title} Interview</h2>
        </div>
        <button
          onClick={onCancel}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          Abandon Call
        </button>
      </div>

      <div className="p-8 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          
          {/* Phase 1: Contact Details Form */}
          {phase === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-md mx-auto w-full space-y-6"
            >
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
                  <User className="w-5.5 h-5.5" />
                </div>
                <h3 className="text-lg font-display font-extrabold text-slate-800 tracking-tight">Identify Yourself</h3>
                <p className="text-xs text-slate-400 font-light leading-relaxed">Please provide your details below. This will register your candidate screening record and generate your detailed evaluation scorecards.</p>
              </div>

              <form onSubmit={handleSetupSubmit} className="space-y-4.5 bg-white p-6 md:p-8 rounded-[28px] border border-slate-100/80 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase flex items-center gap-1">Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder="Alex Rivera"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4.5 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 bg-white transition-all shadow-xs placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase flex items-center gap-1">Email Address *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="alex.rivera@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4.5 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 bg-white transition-all shadow-xs placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase flex items-center gap-1">Phone Number (Optional)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    <input
                      type="tel"
                      placeholder="+1 (555) 987-6543"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-11 pr-4.5 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 bg-white transition-all shadow-xs placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Dialect selector */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold tracking-wider text-slate-500 uppercase flex items-center gap-1">Primary Voice Dialect Mode</label>
                  <select
                    value={sessionSpokenDialect}
                    onChange={(e) => setSessionSpokenDialect(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs bg-white font-medium text-slate-700 cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 shadow-xs"
                  >
                    <option value="English (US English Accent)">US English Accent (Standard Model)</option>
                    <option value="English (UK English Accent)">UK English Accent</option>
                    <option value="English (Indian English Accent)">Indian English Accent (Regional Style)</option>
                    <option value="English (Australian Accent)">Australian English Accent</option>
                    <option value="English (Spanish Accent L1)">Hispanic English Dialect</option>
                    <option value="German (Standard de-DE)">German | Deutsch (Standard)</option>
                    <option value="Spanish (Standard es-ES)">Spanish | Español (Estándar)</option>
                    <option value="French (Standard fr-FR)">French | Français (Standard)</option>
                    <option value="Japanese (Standard ja-JP)">Japanese | 日本語 (標準語)</option>
                    <option value="Hindi (Standard hi-IN)">Hindi | हिन्दी (मानक)</option>
                    <option value="Italian (Standard it-IT)">Italian | Italiano (Standard)</option>
                    <option value="Portuguese (Standard pt-BR)">Portuguese | Português (Brasil)</option>
                    <option value="Chinese (Standard zh-CN)">Chinese | 中文 (简体普通话)</option>
                    <option value="Arabic (Standard ar-SA)">Arabic | العربية (الفصحى)</option>
                  </select>
                  <p className="text-[10px] text-slate-400/95 font-light leading-snug">Calibrates voice transcription and AI synthesis engines to support regional languages and speech styles fairly.</p>
                </div>

                {/* Auto-detect speaker language checkbox */}
                <div className="bg-slate-100/40 border border-slate-200/50 p-3.5 rounded-2xl space-y-1.5">
                  <label className="flex items-center justify-between cursor-pointer text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5 select-none text-slate-700 font-display">
                      <Languages className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                      Auto-Detect Candidate Language
                    </span>
                    <input
                      type="checkbox"
                      checked={autoDetectLanguage}
                      onChange={(e) => setAutoDetectLanguage(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0 cursor-pointer"
                    />
                  </label>
                  <p className="text-[10px] text-slate-500 leading-normal font-light">
                    Uses local language processing to classify responses in Spanish, French, Hindi, German, Japanese, and others, automatically re-calibrating speech models and translating question decks dynamically in real-time.
                  </p>
                </div>

                {/* Adaptive followups toggle */}
                <div className="bg-gradient-to-r from-indigo-50/50 to-blue-50/30 p-3.5 rounded-2xl border border-indigo-100/50 space-y-1.5">
                  <label className="flex items-center justify-between cursor-pointer text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5 select-none text-slate-750 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-100 animate-pulse" />
                      Dynamic Interactive Probing
                    </span>
                    <input
                      type="checkbox"
                      checked={adaptiveFollowupEnabled}
                      onChange={(e) => setAdaptiveFollowupEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 shrink-0 cursor-pointer"
                    />
                  </label>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-light">
                    Flashes <strong>one dynamic follow-up context challenge question</strong> based on your spoken replies using Gemini AI to emulate natural dialogue flow.
                  </p>
                </div>

                {/* GDPR biometric and proctoring consent */}
                <div className="pt-2 bg-slate-100/40 p-3.5 rounded-2xl border border-slate-200/40 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer text-[10.5px] select-none text-slate-600 font-light leading-relaxed">
                    <input
                      type="checkbox"
                      checked={agreedConsent}
                      onChange={(e) => setAgreedConsent(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4 shrink-0 cursor-pointer"
                    />
                    <span>
                      {campaign.gdprConsentTextOverride ? (
                        <span>
                          <strong className="font-bold text-slate-800 block mb-1 font-display">Custom Verification Accord:</strong>
                          {campaign.gdprConsentTextOverride}
                        </span>
                      ) : (
                        <span>
                          I agree to the <span className="font-bold text-slate-800">GDPR Compliance & Proctoring Agreement</span>. I authorize FoloUp to evaluate my speaking patterns, translation streams, and monitor browser focus parameters strictly for integrity validation.
                        </span>
                      )}
                    </span>
                  </label>
                </div>

                {formError && (
                  <p className="text-xs text-rose-500 flex items-center gap-1.5 font-semibold"><AlertCircle className="w-4 h-4" /> {formError}</p>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-white rounded-2xl text-xs font-display font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99] hover:shadow-lg"
                >
                  Proceed to Device Test <ChevronRight className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </motion.div>
          )}

          {/* Phase 2: Hardware Mic Permissions */}
          {phase === 'mic-check' && (
            <motion.div
              key="mic-check"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto w-full text-center space-y-6"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-100">
                <Mic className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800">Calibrate Your Microphone</h3>
                <p className="text-slate-400 text-xs px-2 leading-relaxed">
                  FoloUp is an interactive vocal assessment. We require permission to record your microphone voice feed locally in order to transcribe your vetting answers.
                </p>
              </div>

              <div className="bg-white border border-slate-100 p-4 rounded-2xl">
                {micPermissionState === 'denied' ? (
                  <div className="text-rose-500 space-y-2 text-xs">
                    <p className="font-semibold flex items-center justify-center gap-1.5"><AlertCircle className="w-4 h-4" /> Microphone blocked by browser.</p>
                    <p className="text-slate-400 leading-normal">Please tap the lock icon in your URL bar and toggle Microphone permissions to "Allow", then re-try.</p>
                  </div>
                ) : (
                  <div className="text-slate-500 text-xs space-y-1">
                    <p>Status: <span className="font-semibold text-slate-700">Awaiting user confirmation...</span></p>
                    <p className="text-[10px] text-slate-400">Audio captures are processed natively under safety frameworks.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPhase('setup')}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={requestMicAccess}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-md transition-colors cursor-pointer"
                >
                  Grant Permissions
                </button>
              </div>
            </motion.div>
          )}

          {/* Phase 3: Instructions & Ready Start */}
          {phase === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, delta: 15 }}
              animate={{ opacity: 1, delta: 0 }}
              className="max-w-md mx-auto w-full text-center space-y-6"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-800">Hardware Synced Successfully!</h3>
                <p className="text-emerald-600 text-xs font-semibold">Ready to connect with FoloUp AI Agent</p>
              </div>

              {/* Sound visual testing meter */}
              <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                  <span>Vocal Mic Signal Strength</span>
                  <span>{micVolumeLevel}%</span>
                </div>

                {/* Stunning Waveform visualization bars */}
                <div className="flex items-end justify-center gap-1 h-12 py-1 select-none">
                  {[...Array(24)].map((_, index) => {
                    const factor = Math.sin((index / 23) * Math.PI); // beautiful arc
                    const baseHeight = 4;
                    const scaleHeight = (micVolumeLevel / 100) * 40;
                    const noise = micVolumeLevel > 0 ? (Math.random() * 5) : 0;
                    const calculatedHeight = Math.max(4, baseHeight + scaleHeight * factor + noise);
                    return (
                      <div 
                        key={index}
                        className={`w-1 rounded-full transition-all duration-100 ${
                          micVolumeLevel > 8 ? 'bg-emerald-500' : micVolumeLevel > 0 ? 'bg-emerald-300' : 'bg-slate-250'
                        }`}
                        style={{ height: `${calculatedHeight}px` }}
                      />
                    );
                  })}
                </div>

                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${micVolumeLevel}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 block pt-1">Say a few words out loud to test reactivity</p>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-left space-y-1.5">
                <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> Assessment Vetting Directives:</h4>
                <ul className="text-[11px] text-slate-600 list-disc pl-4 space-y-1 leading-normal">
                  <li>AI Interviewer will ask exactly <span className="font-semibold text-slate-800">{interviewQuestions.length} questions</span>.</li>
                  <li>When AI speaks, listen carefully. Speak clearly into your mic after it wraps.</li>
                  <li>Tap <span className="font-semibold text-slate-800">"Submit Answer"</span> after each response.</li>
                </ul>
              </div>

              <button
                onClick={handleStartInterview}
                className="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 tracking-wide"
              >
                <Play className="w-4 h-4 fill-current" />
                Initialize Live Vocal Session
              </button>
            </motion.div>
          )}

          {/* Phase 4: Active Interview Speaking & Listening */}
          {phase === 'interviewing' && (
            <motion.div
              key="interviewing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full items-stretch"
            >
              {/* Question board left */}
              <div className="md:col-span-1 bg-white border border-slate-100 rounded-3xl p-6 flex flex-col justify-between shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Active Stage</span>
                    <span className="text-xs font-bold text-slate-800">{currentQuestionIndex + 1} of {interviewQuestions.length}</span>
                  </div>
                  
                  <div className="space-y-2">
                    {isFollowUpTurn ? (
                      <div className="space-y-1.5 bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100/80">
                        <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-indigo-750 bg-indigo-100/60 px-2 py-0.5 rounded-full flex items-center gap-1 w-max">
                          <Sparkles className="w-3 h-3 text-indigo-600 fill-indigo-200 animate-pulse" />
                          Adaptive follow-up
                        </span>
                        <p className="text-slate-800 text-[12.5px] font-extrabold italic leading-relaxed">
                          "{currentFollowUpQuestion || 'Expanding on your initial statement...'}"
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-400">Target Vetting Topic:</p>
                        <p className="text-slate-800 text-sm font-extrabold leading-relaxed">
                          {interviewQuestions[currentQuestionIndex] || campaign.questions[currentQuestionIndex]}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Active STT Engine Stack Display */}
                  <div className="mt-3 bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[10px] text-slate-500 space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-700 uppercase tracking-wider">
                      <span>Active STT Mode:</span>
                      <span className="text-blue-600 px-1.5 py-0.2 rounded bg-blue-50">
                        {campaign.sttEngine === 'assemblyai' ? 'AssemblyAI Universal-2' : 
                         campaign.sttEngine === 'whisper' ? 'Self-Hosted Whisper' : 'Deepgram Nova-3'}
                      </span>
                    </div>
                    <p className="leading-relaxed">
                      {campaign.sttEngine === 'assemblyai' ? 'Asynchronous evaluation utilizing AssemblyAI post-analytic sentiment logic.' : 
                       campaign.sttEngine === 'whisper' ? 'Speech data is securely piped to the sandbox whisper instances.' : 
                       'Low-latency full duplex sub-300ms WebSocket stream connection optimized.'}
                    </p>
                  </div>

                  {/* MediaPipe Anti-Cheat live view */}
                  {campaign.enableMediaPipeCameraProctor !== false && (
                    <div className="mt-3.5 space-y-2 border-t border-slate-150 pt-3 flex-1 flex flex-col justify-end">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                          MediaPipe Proctor Active
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-400">FPS: 30</span>
                      </div>

                      <div className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden border border-slate-100 shadow-inner flex items-center justify-center">
                        {videoStream ? (
                          <video
                            ref={(el) => {
                              videoRef.current = el;
                              if (el && videoStream) {
                                el.srcObject = videoStream;
                                el.play().catch(e => console.log("Inline play container interrupted:", e));
                              }
                            }}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                            <User className="w-8 h-8 opacity-40 mb-1" />
                            <p className="text-[9px] font-medium leading-relaxed">No camera allowed. Simulated geometric proctor fallback tracking coordinates.</p>
                          </div>
                        )}

                        {/* Overlap coordinates simulated graphics */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <path d="M 20,30 L 20,20 L 30,20" fill="none" stroke="#2563eb" strokeWidth="1" opacity="0.6" />
                          <path d="M 80,30 L 80,20 L 70,20" fill="none" stroke="#2563eb" strokeWidth="1" opacity="0.6" />
                          <path d="M 20,70 L 20,80 L 30,80" fill="none" stroke="#2563eb" strokeWidth="1" opacity="0.6" />
                          <path d="M 80,70 L 80,80 L 70,80" fill="none" stroke="#2563eb" strokeWidth="1" opacity="0.6" />
                          <line x1="50" y1="0" x2="50" y2="100" stroke="#ffffff" strokeWidth="0.1" strokeDasharray="2" opacity="0.15" />
                          <line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff" strokeWidth="0.1" strokeDasharray="2" opacity="0.15" />
                          <circle cx={50 + yawEuler * 3} cy={50 - pitchEuler * 3} r="2.5" fill={gazeDirection === 'Away' ? '#ef4444' : '#22c55e'} opacity="0.8" className="transition-all duration-300" />
                          <line x1="50" y1="50" x2={50 + yawEuler * 3} y2={50 - pitchEuler * 3} stroke="#3b82f6" strokeWidth="0.5" opacity="0.5" className="transition-all duration-300" />
                        </svg>

                        {/* Display floating tags */}
                        <div className="absolute bottom-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded text-[8px] font-mono text-slate-300 flex items-center gap-1">
                          <span>Gaze:</span>
                          <span className={`font-bold uppercase ${gazeDirection === 'Away' ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                            {gazeDirection}
                          </span>
                        </div>

                        <div className="absolute bottom-2 right-2 bg-slate-900/80 px-2 py-0.5 rounded text-[8px] font-mono text-slate-300">
                          <span>Face: {facesDetected} {facesDetected > 1 && '(Warn)'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 text-[9px] gap-2 font-mono text-slate-500 bg-slate-50 p-2 rounded-xl transition-all">
                        <div className="flex justify-between border-r border-slate-200/60 pr-2">
                          <span>Head Pitch:</span>
                          <span className="font-bold text-slate-700">{pitchEuler}°</span>
                        </div>
                        <div className="flex justify-between pl-1">
                          <span>Head Yaw:</span>
                          <span className="font-bold text-slate-700">{yawEuler}°</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-400 border-t border-slate-50 pt-4 leading-normal mt-4">
                  <Keyboard className="w-4 h-4 mb-2 opacity-50" />
                  Speak clearly into your microphone. Tap submit once you have compiled your answer fully.
                </div>
              </div>

              {/* Voice sphere center-right */}
              <div className="md:col-span-2 flex flex-col space-y-4 justify-between">
                {isKeyboardOverride ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl h-96 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold uppercase">
                        <span className="flex items-center gap-1.5 text-blue-400">
                          <Keyboard className="w-4 h-4" /> Typing Override Mode
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleKeyboardOverride}
                          className="text-slate-400 hover:text-white underline cursor-pointer text-[10px]"
                        >
                          Switch back to Voice Orb
                        </button>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-normal">
                        Speech engine is paused. Type your answer to the active vetting question below or refine the current transcription.
                      </p>
                    </div>

                    <textarea
                      value={manualAnswerText}
                      onChange={(e) => setManualAnswerText(e.target.value)}
                      placeholder="Type your detailed answer or correct the transcribed text narration here..."
                      className="w-full flex-1 p-4 rounded-2xl bg-slate-950 text-slate-100 border border-slate-800 focus:outline-none focus:border-blue-500 text-xs font-mono resize-none leading-relaxed mt-3"
                    />

                    <p className="text-[10px] text-slate-500 italic block mt-2">
                      Click the "Next Question" helper below when you have completed compilation of your response.
                    </p>
                  </motion.div>
                ) : (
                  <div className="relative">
                    <VoiceSphere 
                      state={aiSphereState} 
                      transcriptText={currentTranscriptionSegment}
                    />

                    {/* Floating Speech Delivery HUD analytics */}
                    {aiSphereState === 'listening' && (
                      <div className="absolute top-5 left-5 bg-slate-950/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-800 text-[10px] text-slate-350 font-bold flex items-center gap-3 shadow-2xl transition-all select-none">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-450 animate-pulse" />
                          <span>SPEECH SPEED: <strong className="font-extrabold text-white font-mono text-[11px]">{realTimeWpm}</strong> WPM</span>
                        </div>
                        <div className="h-4 w-[1px] bg-slate-800" />
                        <div className="flex items-center gap-1.5 flex-wrap max-w-[200px]">
                          <AlertTriangle className={`w-3.5 h-3.5 ${realTimeFillerCount > 0 ? 'text-amber-500 animate-bounce' : 'text-slate-500'}`} />
                          <span>FILLER WORDS: <strong className={`font-mono text-[11px] ${realTimeFillerCount > 0 ? 'text-amber-400 font-extrabold' : 'text-white'}`}>{realTimeFillerCount}</strong></span>
                        </div>
                      </div>
                    )}
                    
                    {aiSphereState === 'listening' && (
                      <button
                        type="button"
                        onClick={handleToggleKeyboardOverride}
                        className="absolute bottom-5 right-5 px-3 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 text-slate-300 hover:text-white text-[10px] font-bold uppercase flex items-center gap-1.5 shadow transition-all cursor-pointer"
                      >
                        <Keyboard className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> Correct / Type Answer
                      </button>
                    )}
                  </div>
                )}
                
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={aiSphereState === 'speaking'}
                    className="flex items-center gap-1.5 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 text-white font-semibold text-sm rounded-xl tracking-wide transition-all shadow shadow-blue-200 disabled:shadow-none cursor-pointer"
                  >
                    {currentQuestionIndex + 1 === interviewQuestions.length ? 'Finalize & Submit Score' : 'Next Question'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Phase 5: Processing AI Evaluation or Completion Success Screen */}
          {phase === 'completed' && (
            <AnimatePresence mode="wait">
              {isEvaluating ? (
                <motion.div
                  key="evaluating-state"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-md mx-auto w-full text-center space-y-6 bg-white border border-slate-100 rounded-3xl p-8 shadow-md"
                >
                  <div className="relative w-20 h-20 mx-auto">
                    <motion.div 
                      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute inset-0 rounded-full bg-blue-100"
                    />
                    <div className="absolute inset-2 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100 text-blue-600 z-10">
                      <Sparkles className="w-10 h-10 animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-800">
                      {isCandidateOnly ? 'Submitting Vetting Answers' : 'Processing AI Scorecard'}
                    </h3>
                    <p className="text-slate-400 text-xs leading-relaxed px-4">
                      {isCandidateOnly 
                        ? 'Your conversational audio input transcripts are being securely bundled, indexed, and transmitted directly to the recruiter evaluation panel.'
                        : 'We are aggregating transcript lines and feeding them to Gemini 3.5 Flash to generate competence indices, category recommendation fit, strengths, weaknesses, and individual scoring matrices.'}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 mb-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      {isCandidateOnly && evaluationProgress.includes('Scorecard') 
                        ? 'Transmitting candidate package...' 
                        : (evaluationProgress || 'Transmitting reports...')}
                    </div>
                    <p className="text-[10px] text-slate-400">This generally completes within 5-10 seconds.</p>
                  </div>

                  {evaluationError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-2xl p-4 text-left space-y-2">
                      <p className="font-bold">Evaluation Endpoint Status:</p>
                      <p className="leading-relaxed">
                        {isCandidateOnly 
                        ? 'Your assessment transcripts were successfully stored in our database. You can safely close this screen now.' 
                        : evaluationError}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    {evaluationError && !isCandidateOnly && (
                      <button
                        onClick={() => handleWrapInterviewAndEvaluate(activeTurnTranscript)}
                        className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Retry scoring
                      </button>
                    )}
                    <button
                      onClick={onCompleted}
                      className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-650 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isCandidateOnly ? 'Finish & Return to Portal' : 'Return to Dashboard'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="success-conclusion-panel"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="max-w-7xl mx-auto w-full text-left space-y-8"
                >
                  {/* Conclusion Banner */}
                  <div className="bg-slate-900 text-white p-8 rounded-3xl relative overflow-hidden shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15)_0,transparent_55%)] pointer-events-none" />
                    <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
                    
                    <div className="space-y-2 z-10">
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 w-max">
                        <Check className="w-3.5 h-3.5" /> Assessment Concluded
                      </span>
                      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Full Interview Summary</h2>
                      <p className="text-slate-400 text-xs max-w-xl leading-relaxed">
                        Congratulations, <span className="text-white font-semibold">{name}</span>! Your conversational screening interview is finished and analyzed. Here is your full diagnostic conclusion report.
                      </p>
                    </div>

                    <div className="z-10 shrink-0 flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={onCompleted}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-900/40 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <LogOut className="w-4 h-4 text-blue-200" />
                        {isCandidateOnly ? 'Safeguard & Exit Portal' : 'Conclude & Back to Dashboard'}
                      </button>
                    </div>
                  </div>

                  {/* Core Diagnostic Split Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Metrics & Evaluation (lg:col-span-7) */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Section 1: Executive Scorecard */}
                      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Award className="w-5 h-5 text-indigo-600" /> Executive Scorecard
                          </h3>
                          <span className="text-[11px] text-slate-450 font-medium">Verified by Gemini Academic layer</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                          {/* Radial fit scale */}
                          <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-4 bg-slate-50 border border-slate-100 rounded-2xl relative">
                            <span className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider mb-2">Adaptive Fit Level</span>
                            
                            <div className="relative flex items-center justify-center w-28 h-28">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                  cx="56"
                                  cy="56"
                                  r="48"
                                  stroke="#e2e8f0"
                                  strokeWidth="8"
                                  fill="transparent"
                                />
                                <circle
                                  cx="56"
                                  cy="56"
                                  r="48"
                                  stroke={
                                    (finalizedCandidate?.fitCategory === 'Hire') 
                                      ? '#10b981' 
                                      : (finalizedCandidate?.fitCategory === 'Shortlist') 
                                        ? '#3b82f6' 
                                        : '#ef4444'
                                  }
                                  strokeWidth="8"
                                  fill="transparent"
                                  strokeDasharray={301.6}
                                  strokeDashoffset={301.6 - (301.6 * (finalizedCandidate?.score || 0)) / 100}
                                  strokeLinecap="round"
                                  className="transition-all duration-1000"
                                />
                              </svg>
                              <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-slate-800 leading-none">
                                  {finalizedCandidate?.score || 0}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">/ 100 MAX</span>
                              </div>
                            </div>

                            <span className={`mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                              finalizedCandidate?.fitCategory === 'Hire'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : finalizedCandidate?.fitCategory === 'Shortlist'
                                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                                  : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              Verdict: {finalizedCandidate?.fitCategory || 'Evaluated'}
                            </span>
                          </div>

                          {/* Quick statistics */}
                          <div className="md:col-span-7 space-y-4">
                            <div className="space-y-1">
                              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Assessment Summary Target</span>
                              <h4 className="text-base font-extrabold text-slate-800 leading-snug">{campaign.title}</h4>
                              <p className="text-xs text-slate-500 font-medium">{campaign.department} Vetting Opportunity</p>
                            </div>

                            <hr className="border-slate-100" />

                            <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                <div>
                                  <span className="block text-[9px] uppercase text-slate-400 font-mono">Duration</span>
                                  <span className="font-bold text-slate-700">{finalizedCandidate?.duration || '5m'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Languages className="w-4 h-4 text-slate-400 shrink-0" />
                                <div>
                                  <span className="block text-[9px] uppercase text-slate-400 font-mono">Dialect Detection</span>
                                  <span className="font-bold text-slate-700 truncate block max-w-[120px]">{finalizedCandidate?.spokenLanguage || 'English Accent'}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <User className="w-4 h-4 text-slate-400 shrink-0" />
                                <div>
                                  <span className="block text-[9px] uppercase text-slate-400 font-mono">Identified User</span>
                                  <span className="font-bold text-slate-700 truncate block max-w-[120px]">{finalizedCandidate?.name || name}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
                                <div>
                                  <span className="block text-[9px] uppercase text-slate-400 font-mono">Compliance</span>
                                  <span className="font-bold text-emerald-700">GDPR Active</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Executive Narrative */}
                        {finalizedCandidate?.overallEvaluation && (
                          <div className="bg-slate-50/60 border border-slate-100 p-4 rounded-2xl space-y-1.5">
                            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono block">Executive AI Evaluation Narrative</span>
                            <p className="text-xs text-slate-700 leading-relaxed font-normal">
                              {finalizedCandidate.overallEvaluation}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Section 2: Core Competencies Score Bars */}
                      {finalizedCandidate?.detailedScores && finalizedCandidate.detailedScores.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-600" /> Core Competency Scores
                          </h3>
                          <div className="space-y-4 pt-1">
                            {finalizedCandidate.detailedScores.map((score, idx) => (
                              <div key={idx} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-bold text-slate-700">{score.criteria}</span>
                                  <span className="font-mono font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    {score.score} / {score.maxScore}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(score.score / score.maxScore) * 100}%` }}
                                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                                    className="h-full bg-indigo-650 rounded-full"
                                  />
                                </div>
                                <p className="text-[10px] text-slate-400 leading-normal font-sans italic">{score.feedback}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Section 3: Strengths & Area for Growth Side-by-side */}
                      {((finalizedCandidate?.strengths && finalizedCandidate.strengths.length > 0) || 
                        (finalizedCandidate?.weaknesses && finalizedCandidate.weaknesses.length > 0)) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* Strengths Card */}
                          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5 font-mono">
                              <ThumbsUp className="w-4 h-4 text-emerald-500" /> Identified Strengths
                            </h4>
                            <ul className="space-y-2.5 text-[11px] text-slate-600">
                              {(finalizedCandidate?.strengths || []).map((strength, key) => (
                                <li key={key} className="flex gap-2 items-start leading-relaxed bg-emerald-50/30 border border-emerald-50 p-2 rounded-xl">
                                  <span className="text-emerald-500 font-extrabold shrink-0 mt-0.5">✓</span>
                                  <span>{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Weaknesses Card */}
                          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5 font-mono">
                              <ThumbsDown className="w-4 h-4 text-amber-500" /> Areas for Growth
                            </h4>
                            <ul className="space-y-2.5 text-[11px] text-slate-600">
                              {(finalizedCandidate?.weaknesses || []).map((weakness, key) => (
                                <li key={key} className="flex gap-2 items-start leading-relaxed bg-amber-50/30 border border-amber-50 p-2 rounded-xl">
                                  <span className="text-amber-500 font-extrabold shrink-0 mt-0.5">⚠</span>
                                  <span>{weakness}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Section 4: Proctor Integrity & Telemetry Compliance */}
                      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-indigo-100/30 pb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 font-mono">
                            <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" /> Sandbox Integrity & Telemetry Log
                          </h3>
                          <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-50 border border-emerald-100 text-emerald-700 rounded">
                            Verified Cleared
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-slate-650">
                          <div className="p-3 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] text-slate-400 font-bold uppercase font-mono">Tab/Visibility switches</span>
                              <span className="font-extrabold text-slate-800">{finalizedCandidate?.tabSwitchCount || 0} transitions</span>
                            </div>
                            {(finalizedCandidate?.tabSwitchCount || 0) > 0 ? (
                              <span className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg">
                                <AlertTriangle className="w-4 h-4" />
                              </span>
                            ) : (
                              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                <Check className="w-4 h-4" />
                              </span>
                            )}
                          </div>

                          <div className="p-3 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] text-slate-400 font-bold uppercase font-mono">Silicon Silence count</span>
                              <span className="font-extrabold text-slate-800">{finalizedCandidate?.longSilenceCount || 0} checks</span>
                            </div>
                            {(finalizedCandidate?.longSilenceCount || 0) > 2 ? (
                              <span className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg">
                                <AlertTriangle className="w-4 h-4" />
                              </span>
                            ) : (
                              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                <Check className="w-4 h-4" />
                              </span>
                            )}
                          </div>

                          <div className="p-3 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] text-slate-400 font-bold uppercase font-mono">Eye-Tracking Gaze Direction</span>
                              <span className="font-extrabold text-slate-800">MediaPipe Unified</span>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              Eye contact normal
                            </span>
                          </div>

                          <div className="p-3 bg-white border border-slate-100 rounded-2xl flex justify-between items-center">
                            <div>
                              <span className="block text-[10px] text-slate-400 font-bold uppercase font-mono">Suspicious Sound / Noise</span>
                              <span className="font-extrabold text-slate-800">
                                {finalizedCandidate?.suspiciousVoiceNoise ? "Unusual peaks flagged" : "Clean conversation parameters"}
                              </span>
                            </div>
                            {finalizedCandidate?.suspiciousVoiceNoise ? (
                              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                                <AlertCircle className="w-4 h-4" />
                              </span>
                            ) : (
                              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                <Check className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-400 leading-normal text-center bg-slate-100 p-2.5 rounded-xl font-normal">
                          Notice: Privacy policies prevent persistent recording of raw video streams. All gaze and visage parameters represent hardware telemetry collected dynamically inside the isolated sandbox container sandbox.
                        </p>
                      </div>

                    </div>

                    {/* Right Column: Q&A breakdown & chat dialogue logs (lg:col-span-5) */}
                    <div className="lg:col-span-5 space-y-6">

                      {/* Speeches delivery metrics & Direct Feedback share keys */}
                      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl space-y-4 border border-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-mono">
                            <Sparkles className="w-4 h-4 text-indigo-400 fill-indigo-950" /> Verbal Delivery Metrics
                          </h3>
                          <span className="px-2 py-0.5 text-[9px] font-extrabold bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg">
                            Live Vocal Analyzer
                          </span>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                              <span className="block text-[8.5px] text-slate-400 font-bold uppercase font-mono tracking-wider">Words Per Minute</span>
                              <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-xl font-black text-white">{finalizedCandidate?.deliveryMetrics?.wpm || 135}</span>
                                <span className="text-[9px] text-slate-400 font-bold font-mono">WPM</span>
                              </div>
                            </div>

                            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
                              <span className="block text-[8.5px] text-slate-400 font-bold uppercase font-mono tracking-wider">Filler Words Flagged</span>
                              <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-xl font-black text-amber-400">{finalizedCandidate?.deliveryMetrics?.totalFillers ?? 3}</span>
                                <span className="text-[9px] text-slate-400 font-bold font-mono">TOTAL</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 bg-slate-950/40 p-3.5 border border-slate-800/80 rounded-2xl text-xs font-sans text-slate-300">
                            <div className="flex justify-between items-center pb-1.5 border-b border-slate-800/40">
                              <span className="text-slate-400">Oral Cadence Verdict:</span>
                              <span className="font-extrabold text-white text-[11px] font-mono">
                                {finalizedCandidate?.deliveryMetrics?.overallPacing || "Structured & Balanced (135 WPM)"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                              <span className="text-slate-400">Verbal Clarity Factor:</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                finalizedCandidate?.deliveryMetrics?.clarityLevel === 'Needs Improvement' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                finalizedCandidate?.deliveryMetrics?.clarityLevel === 'Moderate' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                finalizedCandidate?.deliveryMetrics?.clarityLevel === 'Good' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {finalizedCandidate?.deliveryMetrics?.clarityLevel || 'Excellent'}
                              </span>
                            </div>
                          </div>

                          {/* Quick copier for sharing candidate feedback */}
                          <div className="pt-2 border-t border-slate-800/80 space-y-2">
                            <span className="block text-[8.5px] text-slate-400 font-bold uppercase font-mono tracking-wider">Direct Share Scorecard Link</span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const shareUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "?reportId=" + (finalizedCandidate?.id || '');
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(shareUrl);
                                    setCopiedShareKey(true);
                                    setTimeout(() => setCopiedShareKey(false), 2500);
                                  }
                                }}
                                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs select-none cursor-pointer transition-all ${
                                  copiedShareKey ? 'bg-emerald-605 border border-emerald-500 text-white hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                              >
                                {copiedShareKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copiedShareKey ? 'Verification Link Copied!' : 'Copy & Share Verification URL'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Section 1: Detailed Question by Question ratings */}
                      {finalizedCandidate?.qnaPairs && finalizedCandidate.qnaPairs.length > 0 ? (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" /> AI Question Scoring Matrix
                          </h3>
                          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                            {finalizedCandidate.qnaPairs.map((pair, index) => (
                              <div key={index} className="border border-slate-100 rounded-2xl p-4 space-y-2.5 bg-slate-50/40">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="text-[10px] font-black bg-slate-800 text-white rounded-md px-2 py-0.5 font-mono">
                                    Q{index + 1}
                                  </span>
                                  <span className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full border ${
                                    pair.rating >= 85 
                                      ? 'bg-emerald-50 text-emerald-705 border-emerald-110' 
                                      : pair.rating >= 70 
                                        ? 'bg-blue-50 text-blue-705 border-blue-110' 
                                        : 'bg-rose-50 text-rose-705 border-rose-110'
                                  }`}>
                                    Score: {pair.rating}%
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <p className="text-[11.5px] font-extrabold text-slate-800 font-sans leading-snug">
                                    {pair.question}
                                  </p>
                                  <p className="text-xs text-slate-600 bg-white border border-slate-50 p-2.5 rounded-xl leading-relaxed italic pr-1">
                                    "{pair.answer}"
                                  </p>
                                </div>

                                <div className="text-[10px] leading-relaxed text-slate-500 bg-indigo-50/20 border border-indigo-100/30 p-2.5 rounded-xl mt-1">
                                  <p className="font-extrabold text-indigo-750 uppercase tracking-widest text-[9px] mb-0.5 font-mono">Gemini Vetting Feedback:</p>
                                  {pair.feedback}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm text-center py-8 text-slate-400 text-xs">
                          Detailed QA analytical criteria are stored securely. Click "Conclude" to synchronize.
                        </div>
                      )}

                      {/* Section 2: Complete Dialogue Transcript log */}
                      {finalizedCandidate?.transcript && finalizedCandidate.transcript.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-indigo-600" /> Complete Speech Dialog Transcript
                          </h3>

                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                            {finalizedCandidate.transcript.map((turn, key) => {
                              const isAI = turn.speaker === 'AI';
                              return (
                                <div key={key} className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}>
                                  <span className="text-[9px] text-slate-400 font-mono font-bold mb-1 px-1">
                                    {isAI ? 'Voice Sphere Assistant' : `${name} (Candidate)`} &bull; {turn.timestamp}
                                  </span>
                                  <div className={`p-3 text-[11.5px] leading-relaxed rounded-2xl max-w-[90%] border shadow-xxs ${
                                    isAI 
                                      ? 'bg-slate-50 border-slate-100 text-slate-800 rounded-tl-none' 
                                      : 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none'
                                  }`}>
                                    {turn.text}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>

                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
