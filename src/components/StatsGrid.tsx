import { motion } from 'motion/react';
import { Briefcase, Users, CheckCircle, Percent } from 'lucide-react';
import { AppStats } from '../types';

interface StatsGridProps {
  stats: AppStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const cards = [
    {
      id: "stats-1",
      title: 'Active Campaigns',
      value: stats.totalCampaigns,
      desc: 'Active job vacancy positions',
      icon: Briefcase,
      color: 'bg-blue-50/60 text-blue-600 border-blue-100/80',
      textColor: 'text-blue-600 font-display'
    },
    {
      id: "stats-2",
      title: 'Candidates Invited',
      value: stats.totalCandidates,
      desc: 'Total screens registered',
      icon: Users,
      color: 'bg-indigo-50/60 text-indigo-600 border-indigo-100/80',
      textColor: 'text-indigo-600 font-display'
    },
    {
      id: "stats-3",
      title: 'Completion Rate',
      value: `${stats.completionRate}%`,
      desc: 'Screen completion ratio',
      icon: CheckCircle,
      color: 'bg-emerald-50/60 text-emerald-600 border-emerald-100/80',
      textColor: 'text-emerald-500 font-display'
    },
    {
      id: "stats-4",
      title: 'Average AI Alignment',
      value: `${stats.averageScore}/100`,
      desc: 'Average evaluation score',
      icon: Percent,
      color: 'bg-purple-50/60 text-purple-600 border-purple-100/80',
      textColor: 'text-purple-600 font-display'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 text-slate-800">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="bg-white border border-slate-100/80 rounded-3xl p-6 shadow-[0_8px_30px_rgba(15,23,42,0.02)] flex items-center justify-between hover:shadow-[0_12px_40px_rgba(15,23,42,0.05)] hover:border-slate-200 transition-luxury cursor-default"
          >
            <div className="space-y-1.5">
              <p className="text-xs font-bold tracking-wider uppercase text-slate-400 font-sans">{card.title}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-display font-black text-slate-800 tracking-tight">{card.value}</span>
              </div>
              <p className="text-xs text-slate-500 font-light">{card.desc}</p>
            </div>
            <div className={`p-3.5 rounded-2xl border ${card.color} shadow-xs`}>
              <Icon className="w-5.5 h-5.5" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
