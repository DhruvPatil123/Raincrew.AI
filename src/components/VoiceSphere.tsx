import { motion } from 'motion/react';
import { Mic, Volume2, Sparkles, AudioLines } from 'lucide-react';

interface VoiceSphereProps {
  state: 'idle' | 'speaking' | 'listening' | 'evaluating';
  transcriptText?: string;
}

export default function VoiceSphere({ state, transcriptText }: VoiceSphereProps) {
  // Define animations based on state
  const getOrbStyle = () => {
    switch (state) {
      case 'speaking':
        return {
          bg: 'from-blue-500 via-indigo-500 to-purple-600',
          shadow: 'shadow-[0_0_50px_rgba(99,102,241,0.5)]',
          pulseScale: [1, 1.15, 0.98, 1.12, 1],
          pulseDuration: 1.5
        };
      case 'listening':
        return {
          bg: 'from-emerald-400 via-teal-500 to-cyan-500',
          shadow: 'shadow-[0_0_50px_rgba(20,184,166,0.5)]',
          pulseScale: [1, 1.08, 1.02, 1.1, 1],
          pulseDuration: 2.0
        };
      case 'evaluating':
        return {
          bg: 'from-amber-400 via-orange-500 to-rose-500',
          shadow: 'shadow-[0_0_50px_rgba(245,158,11,0.4)]',
          pulseScale: [1, 1.05, 1],
          pulseDuration: 1.0
        };
      case 'idle':
      default:
        return {
          bg: 'from-slate-400 via-slate-500 to-slate-600',
          shadow: 'shadow-[0_0_30px_rgba(148,163,184,0.2)]',
          pulseScale: [1, 1.03, 1],
          pulseDuration: 3.0
        };
    }
  };

  const currentStyle = getOrbStyle();

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-3xl border border-slate-800 relative overflow-hidden h-96 shadow-2xl">
      {/* Background ambient mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0,transparent_60%)] pointer-events-none" />
      
      {/* Wave pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Floating Particle Orbs */}
      {state === 'speaking' && (
        <>
          <motion.div 
            animate={{ y: [-10, -80, -10], x: [0, 40, 0], opacity: [0, 0.6, 0] }}
            transition={{ repeat: Infinity, duration: 3, delay: 0 }}
            className="absolute bottom-1/2 w-8 h-8 rounded-full bg-blue-500/20 blur-xl md:block hidden" 
          />
          <motion.div 
            animate={{ y: [10, -60, 10], x: [0, -30, 0], opacity: [0, 0.4, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
            className="absolute bottom-1/2 w-10 h-10 rounded-full bg-indigo-500/10 blur-xl md:block hidden" 
          />
        </>
      )}

      {/* Main Core Voice Orb */}
      <div className="relative flex items-center justify-center w-52 h-52">
        {/* Soft Outer Aura */}
        <motion.div
          animate={{
            scale: currentStyle.pulseScale.map(val => val * 1.35),
            rotate: 360
          }}
          transition={{
            repeat: Infinity,
            duration: currentStyle.pulseDuration * 2.5,
            ease: "easeInOut"
          }}
          className={`absolute inset-0 rounded-full bg-gradient-to-tr ${currentStyle.bg} opacity-20 blur-2xl transition-all duration-700`}
        />

        {/* Medium Ripple Ring */}
        <motion.div
          animate={{
            scale: currentStyle.pulseScale.map(val => val * 1.15),
            rotate: -360
          }}
          transition={{
            repeat: Infinity,
            duration: currentStyle.pulseDuration * 1.8,
            ease: "easeInOut"
          }}
          className={`absolute inset-4 rounded-full bg-gradient-to-bl ${currentStyle.bg} opacity-30 blur-md transition-all duration-700`}
        />

        {/* Core Animated Sphere */}
        <motion.div
          animate={{
            scale: currentStyle.pulseScale,
          }}
          transition={{
            repeat: Infinity,
            duration: currentStyle.pulseDuration,
            ease: "easeInOut"
          }}
          className={`absolute inset-8 rounded-full bg-gradient-to-br ${currentStyle.bg} ${currentStyle.shadow} flex flex-col items-center justify-center border border-white/20 z-10 transition-all duration-700`}
        >
          {/* Inner Glowing Center */}
          <div className="absolute inset-2 rounded-full bg-slate-950/80 backdrop-blur-sm flex items-center justify-center border border-white/5 overflow-hidden">
            <motion.div 
              animate={state === 'speaking' || state === 'listening' ? { opacity: [0.4, 0.8, 0.4] } : { opacity: 0.3 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`absolute inset-0 bg-gradient-to-t ${currentStyle.bg} mix-blend-color-dodge`} 
            />
            
            {/* Status Icons */}
            <div className="relative z-10 flex flex-col items-center justify-center text-white">
              {state === 'speaking' && (
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Volume2 className="w-10 h-10 text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                </motion.div>
              )}
              {state === 'listening' && (
                <motion.div animate={{ scale: [0.95, 1.1, 0.95] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                  <Mic className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse" />
                </motion.div>
              )}
              {state === 'evaluating' && (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }}>
                  <Sparkles className="w-10 h-10 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                </motion.div>
              )}
              {state === 'idle' && (
                <AudioLines className="w-10 h-10 text-slate-400 opacity-60" />
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Dynamic Subtext Bar */}
      <div className="mt-8 z-10 max-w-md text-center h-20 flex flex-col justify-center">
        {state === 'speaking' && (
          <p className="text-blue-200 text-sm font-medium tracking-wide animate-pulse">
            AI Interviewer Speaking... (Listen carefully)
          </p>
        )}
        {state === 'listening' && (
          <div className="space-y-1">
            <p className="text-emerald-400 text-sm font-medium tracking-wide flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Mic Online • Express your thoughts
            </p>
            {transcriptText ? (
              <p className="text-slate-300 text-xs italic line-clamp-2 px-4 select-none">
                "{transcriptText}"
              </p>
            ) : (
              <p className="text-slate-500 text-xs italic">Waiting for your vocal response...</p>
            )}
          </div>
        )}
        {state === 'evaluating' && (
          <p className="text-amber-300 text-sm font-medium tracking-wide animate-bounce">
            Synthesizing responses and generating fit metrics with Gemini AI...
          </p>
        )}
        {state === 'idle' && (
          <p className="text-slate-400 text-sm font-medium tracking-wide">
            Voice Sync Setup Complete
          </p>
        )}
      </div>
    </div>
  );
}
