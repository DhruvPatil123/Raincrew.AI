import { motion } from 'motion/react';

export interface RadarMetric {
  technical: number;
  architecture: number;
  communication: number;
  scenario: number;
  fit: number;
}

export interface RadarCandidateData {
  id: string;
  name: string;
  color: string;
  metrics: RadarMetric;
}

interface RadarChartProps {
  candidatesData: RadarCandidateData[];
  width?: number;
  height?: number;
}

export function RadarChart({ candidatesData, width = 260, height = 260 }: RadarChartProps) {
  // Center of the radar coordinate grid
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35; // Leaving padding for text labels

  // Definition of the 5 axes mapping
  const axesDef = [
    { key: 'technical' as const, label: 'Technical Domain' },
    { key: 'architecture' as const, label: 'Arch & Logic' },
    { key: 'communication' as const, label: 'Vocal Clarity' },
    { key: 'scenario' as const, label: 'Scenario Logic' },
    { key: 'fit' as const, label: 'Role Fit' },
  ];

  const numSides = axesDef.length;

  // Concentric circle background levels (20%, 40%, 60%, 80%, 100%)
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Get SVG coordinate for an axis at a specific normalized rating
  const getCoordinates = (axisIndex: number, scale: number) => {
    const angle = (axisIndex * 2 * Math.PI) / numSides - Math.PI / 2;
    const x = cx + radius * scale * Math.cos(angle);
    const y = cy + radius * scale * Math.sin(angle);
    return { x, y };
  };

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-slate-50/40 rounded-2xl border border-slate-100/60 dark:bg-slate-900/40 dark:border-slate-800">
      <svg width={width} height={height} className="overflow-visible select-none">
        {/* Concentric grid rings */}
        {levels.map((level, lIndex) => {
          const points = Array.from({ length: numSides }).map((_, i) => {
            const { x, y } = getCoordinates(i, level);
            return `${x},${y}`;
          }).join(' ');

          return (
            <polygon
              key={`ring-${lIndex}`}
              points={points}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeWidth={1}
              strokeDasharray={lIndex === levels.length - 1 ? 'none' : '2 2'}
            />
          );
        })}

        {/* Level grid markers (scores e.g. 20, 40, 60, 80, 100) */}
        {levels.map((level, lIndex) => {
          const { x, y } = getCoordinates(0, level); // Align along the top vertical line
          return (
            <text
              key={`val-label-${lIndex}`}
              x={x + 5}
              y={y + 4}
              fontSize="8"
              fontWeight="bold"
              className="fill-slate-400 dark:fill-slate-600 font-mono"
            >
              {Math.round(level * 100)}
            </text>
          );
        })}

        {/* Axes lines and outer text headings */}
        {axesDef.map((axis, i) => {
          const outerPt = getCoordinates(i, 1.0);
          const textPt = getCoordinates(i, 1.14); // Placed slightly outside of the outer ring

          // Refine text alignment depending on its positioning angle
          let textAnchor = 'middle';
          if (textPt.x > cx + 10) {
            textAnchor = 'start';
          } else if (textPt.x < cx - 10) {
            textAnchor = 'end';
          }

          let labelAdjustY = 3;
          // Compensate vertical index placement
          if (i === 0) labelAdjustY = -3;
          if (i === 2 || i === 3) labelAdjustY = 8;

          return (
            <g key={`axis-grp-${i}`}>
              <line
                x1={cx}
                y1={cy}
                x2={outerPt.x}
                y2={outerPt.y}
                stroke="currentColor"
                className="text-slate-250 dark:text-slate-805"
                strokeWidth={1}
              />
              <text
                x={textPt.x}
                y={textPt.y + labelAdjustY}
                textAnchor={textAnchor}
                fontSize="9"
                fontWeight="900"
                className="fill-slate-650 dark:fill-slate-350 tracking-tight font-sans uppercase font-mono"
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        {/* Candidate Poly-Shaded Areas */}
        {candidatesData.map((candData) => {
          const polyPoints = axesDef.map((axis, i) => {
            const scoreVal = candData.metrics[axis.key] || 0;
            // Normalize score value (max 100, min 5)
            const normalizedScore = Math.max(8, Math.min(100, scoreVal)) / 100;
            const { x, y } = getCoordinates(i, normalizedScore);
            return `${x},${y}`;
          }).join(' ');

          return (
            <g key={`cand-poly-${candData.id}`}>
              {/* Shaded Area with Micro-fade entrance animation */}
              <motion.polygon
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                points={polyPoints}
                fill={candData.color}
                fillOpacity={candidatesData.length > 1 ? 0.18 : 0.28}
                stroke={candData.color}
                strokeWidth={2.5}
                className="transition-all duration-300"
              />
              
              {/* Discrete score dots */}
              {axesDef.map((axis, i) => {
                const scoreVal = candData.metrics[axis.key] || 0;
                const normalizedScore = Math.max(8, Math.min(100, scoreVal)) / 100;
                const { x, y } = getCoordinates(i, normalizedScore);
                return (
                  <circle
                    key={`dot-${candData.id}-${i}`}
                    cx={x}
                    cy={y}
                    r={3.5}
                    fill={candData.color}
                    className="stroke-white dark:stroke-slate-950 stroke-2 cursor-pointer transition-all hover:scale-150"
                  >
                    <title>{`${candData.name} - ${axis.label}: ${scoreVal}%`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}

        {/* Center pivot point */}
        <circle cx={cx} cy={cy} r={3} className="fill-slate-400 dark:fill-slate-600" />
      </svg>

      {/* Embedded Mini Index Values (Only if single candidate view mode) */}
      {candidatesData.length === 1 && (
        <div className="grid grid-cols-5 gap-1.5 mt-2 text-[9px] font-mono text-center">
          {axesDef.map((axis) => {
            const score = candidatesData[0].metrics[axis.key];
            return (
              <div key={axis.key} className="bg-slate-100/50 p-1 rounded-md border border-slate-200/40 dark:bg-slate-800/50 dark:border-slate-700/50">
                <span className="text-slate-400 block truncate uppercase text-[7px] font-extrabold">{axis.key}</span>
                <span className="font-extrabold text-slate-850 dark:text-slate-200">{score}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
