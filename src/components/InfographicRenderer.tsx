import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, CheckCircle, AlertTriangle, ShieldCheck, List, BookOpen, Star, Zap, BarChart2, Sparkles } from 'lucide-react';

interface InfographicData {
  title: string;
  subtitle: string;
  summaryText?: string;
  keyStats?: { label: string; value: string }[];
  roadmap: string[];
  learnings: string[];
  details: { title: string; content: string }[];
  authenticityNote: string;
  caution: string;
}

interface Props {
  data: InfographicData;
}

type ThemeType = 'navy' | 'chalkboard' | 'forest' | 'sunset';

interface ThemeStyle {
  canvasBg: string;
  titleColor: string;
  subtitleBg: string;
  subtitleText: string;
  summaryBg: string;
  summaryText: string;
  statLabel: string;
  statValue: string;
  statBg: string;
  roadmapBorder: string;
  roadmapBg: string;
  roadmapTitleBg: string;
  roadmapTitleText: string;
  learningsBorder: string;
  learningsBg: string;
  learningsTitleBg: string;
  learningsTitleText: string;
  detailsBorder: string;
  detailsBg: string;
  detailItemBg: string;
  detailItemHeader: string;
  footerBorder: string;
  footerBg: string;
  footerText: string;
  signatureText: string;
}

const THEME_CONFIGS: Record<ThemeType, ThemeStyle> = {
  navy: {
    canvasBg: "bg-white text-slate-800 border-slate-300",
    titleColor: "text-blue-600",
    subtitleBg: "bg-pink-100 border-pink-300",
    subtitleText: "text-rose-600",
    summaryBg: "bg-blue-50/50 border-blue-100 text-slate-700",
    summaryText: "text-slate-600",
    statLabel: "text-slate-500",
    statValue: "text-blue-600",
    statBg: "bg-slate-50 border-slate-100",
    roadmapBorder: "border-blue-600",
    roadmapBg: "bg-white",
    roadmapTitleBg: "bg-blue-600",
    roadmapTitleText: "text-white",
    learningsBorder: "border-emerald-500",
    learningsBg: "bg-white",
    learningsTitleBg: "bg-emerald-100 border-emerald-500",
    learningsTitleText: "text-emerald-800",
    detailsBorder: "border-indigo-300",
    detailsBg: "bg-indigo-50/40",
    detailItemBg: "bg-white border-indigo-100",
    detailItemHeader: "text-indigo-700 border-indigo-200",
    footerBorder: "border-slate-400",
    footerBg: "bg-white",
    footerText: "text-slate-600",
    signatureText: "text-slate-500 border-slate-300"
  },
  chalkboard: {
    canvasBg: "bg-slate-900 text-slate-100 border-slate-800",
    titleColor: "text-amber-300",
    subtitleBg: "bg-slate-800 border-slate-700",
    subtitleText: "text-emerald-400",
    summaryBg: "bg-slate-800/40 border-slate-700 text-slate-300",
    summaryText: "text-slate-300",
    statLabel: "text-slate-400",
    statValue: "text-amber-300",
    statBg: "bg-slate-800/60 border-slate-700",
    roadmapBorder: "border-dashed border-slate-600",
    roadmapBg: "bg-slate-800/50",
    roadmapTitleBg: "bg-slate-700",
    roadmapTitleText: "text-white",
    learningsBorder: "border-dashed border-teal-500",
    learningsBg: "bg-slate-800/50",
    learningsTitleBg: "bg-slate-800 border-teal-500",
    learningsTitleText: "text-teal-300",
    detailsBorder: "border-dashed border-slate-700",
    detailsBg: "bg-slate-800/30",
    detailItemBg: "bg-slate-800 border-slate-700",
    detailItemHeader: "text-emerald-300 border-slate-700",
    footerBorder: "border-slate-700",
    footerBg: "bg-slate-800/40",
    footerText: "text-slate-300",
    signatureText: "text-slate-400 border-slate-700"
  },
  forest: {
    canvasBg: "bg-[#f4f1ea] text-emerald-950 border-emerald-900/10",
    titleColor: "text-emerald-800",
    subtitleBg: "bg-emerald-50 border-emerald-200",
    subtitleText: "text-emerald-700",
    summaryBg: "bg-emerald-100/30 border-emerald-200/50 text-emerald-900",
    summaryText: "text-emerald-800",
    statLabel: "text-emerald-700/70",
    statValue: "text-emerald-800",
    statBg: "bg-white/80 border-emerald-200/40",
    roadmapBorder: "border-emerald-800",
    roadmapBg: "bg-white",
    roadmapTitleBg: "bg-emerald-800",
    roadmapTitleText: "text-white",
    learningsBorder: "border-amber-600",
    learningsBg: "bg-white",
    learningsTitleBg: "bg-amber-50 border-amber-600",
    learningsTitleText: "text-amber-800",
    detailsBorder: "border-emerald-700",
    detailsBg: "bg-emerald-50/50",
    detailItemBg: "bg-white border-emerald-100",
    detailItemHeader: "text-emerald-800 border-emerald-200",
    footerBorder: "border-emerald-800/20",
    footerBg: "bg-white",
    footerText: "text-emerald-800",
    signatureText: "text-emerald-700/60 border-emerald-800/10"
  },
  sunset: {
    canvasBg: "bg-[#fffaf0] text-amber-950 border-amber-900/10",
    titleColor: "text-rose-700",
    subtitleBg: "bg-amber-50 border-amber-200",
    subtitleText: "text-amber-800",
    summaryBg: "bg-amber-100/20 border-amber-200/50 text-amber-900",
    summaryText: "text-amber-900",
    statLabel: "text-amber-800/70",
    statValue: "text-rose-700",
    statBg: "bg-white border-amber-200/40",
    roadmapBorder: "border-rose-600",
    roadmapBg: "bg-white",
    roadmapTitleBg: "bg-rose-600",
    roadmapTitleText: "text-white",
    learningsBorder: "border-amber-500",
    learningsBg: "bg-white",
    learningsTitleBg: "bg-amber-100 border-amber-500",
    learningsTitleText: "text-amber-900",
    detailsBorder: "border-amber-600",
    detailsBg: "bg-amber-50/40",
    detailItemBg: "bg-white border-amber-100",
    detailItemHeader: "text-rose-700 border-amber-200",
    footerBorder: "border-amber-700/20",
    footerBg: "bg-white",
    footerText: "text-amber-800",
    signatureText: "text-amber-800/60 border-amber-200"
  }
};

export default function InfographicRenderer({ data }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [activeTheme, setActiveTheme] = useState<ThemeType>('navy');

  const theme = THEME_CONFIGS[activeTheme];

  const handleDownload = async () => {
    if (printRef.current) {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
      const image = canvas.toDataURL("image/jpeg", 0.9);
      const link = document.createElement("a");
      link.href = image;
      link.download = `Infographic_${Date.now()}.jpg`;
      link.click();
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Control Actions & Theme Selector Bar */}
      <div className="w-[800px] flex items-center justify-between mb-5 bg-white p-4 border border-slate-200 rounded-2xl shadow-sm gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tông màu:</span>
          <div className="flex gap-1.5">
            {(['navy', 'chalkboard', 'forest', 'sunset'] as ThemeType[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTheme(t)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTheme === t
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {t === 'navy' && 'Lịch lãm'}
                {t === 'chalkboard' && 'Chalkboard'}
                {t === 'forest' && 'Sage Forest'}
                {t === 'sunset' && 'Warm Coral'}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handleDownload}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-blue-500 transition-all flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Tải ảnh Infographic
        </button>
      </div>

      {/* Infographic Canvas */}
      <div 
        ref={printRef}
        style={{ 
          fontFamily: "'Inter', sans-serif", 
          backgroundSize: activeTheme === 'navy' ? '100% 28px' : 'auto', 
          backgroundImage: activeTheme === 'navy' ? 'linear-gradient(#e5e7eb 1px, transparent 1px)' : 'none' 
        }}
        className={`w-[800px] min-h-[1050px] border-2 shadow-2xl relative p-10 overflow-hidden flex flex-col justify-between transition-colors duration-200 ${theme.canvasBg}`}
      >
        {/* Binder holes */}
        <div className="absolute left-4 top-10 flex flex-col gap-32">
          {[1,2,3,4].map(i => (
             <div key={i} className={`w-6 h-6 rounded-full border-2 bg-white shadow-inner ${activeTheme === 'chalkboard' ? 'border-slate-800' : 'border-slate-300'}`}></div>
          ))}
        </div>

        <div>
          {/* Header */}
          <div className="pl-12 flex flex-col items-center mb-8 relative">
            <div className="absolute top-0 right-4 text-yellow-400">
               <Star className="w-9 h-9 fill-current stroke-black stroke-2" />
            </div>
            <div className="absolute top-10 right-20 text-yellow-400">
               <Zap className="w-10 h-10 fill-current stroke-black stroke-2" />
            </div>
            <h1 className="text-5xl font-black tracking-tight text-center uppercase leading-none" style={{ textShadow: activeTheme === 'chalkboard' ? '1px 1px 0 #000' : '2px 2px 0 #fff, 3px 3px 0 #cbd5e1' }}>
              <span className={theme.titleColor}>{data.title}</span>
            </h1>
            <div className="relative mt-3">
              <span className={`absolute -inset-2 transform -skew-x-12 z-0 border rounded ${theme.subtitleBg}`}></span>
              <p className={`text-sm font-black relative z-10 px-4 uppercase tracking-wider ${theme.subtitleText}`}>{data.subtitle}</p>
            </div>
          </div>

          {/* New Summary Paragraph */}
          {data.summaryText && (
            <div className="pl-12 mb-6">
              <div className={`p-4 rounded-xl border leading-relaxed text-sm font-medium ${theme.summaryBg}`}>
                <p>{data.summaryText}</p>
              </div>
            </div>
          )}

          {/* New Key Statistics Panel */}
          {data.keyStats && data.keyStats.length > 0 && (
            <div className="pl-12 mb-8">
              <div className="grid grid-cols-3 gap-4">
                {data.keyStats.map((stat, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border text-center shadow-sm flex flex-col justify-center ${theme.statBg}`}>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{stat.label}</span>
                    <span className={`text-2xl font-black ${theme.statValue}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roadmap & Learnings Grid */}
          <div className="pl-12 grid grid-cols-2 gap-6 mb-8">
            {/* Roadmap */}
            <div className={`border-4 rounded-2xl p-5 relative ${theme.roadmapBorder} ${theme.roadmapBg}`}>
              <div className={`absolute -top-4 left-4 px-4 py-1 font-extrabold text-xs uppercase tracking-wider transform -skew-x-6 rounded border ${theme.roadmapTitleBg} ${theme.roadmapTitleText}`}>
                ROADMAP / LỘ TRÌNH
              </div>
              <ul className="mt-4 space-y-3.5">
                {data.roadmap.map((item, idx) => (
                  <li key={idx} className="flex gap-3 text-sm font-bold">
                    <span className={`w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${theme.roadmapTitleBg} ${theme.roadmapTitleText}`}>{idx + 1}</span>
                    <span className="leading-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Learnings */}
            <div className={`border-4 rounded-2xl p-5 relative ${theme.learningsBorder} ${theme.learningsBg}`}>
              <div className={`absolute -top-4 right-4 px-4 py-1 font-extrabold text-xs uppercase tracking-wider transform skew-x-6 rounded border ${theme.learningsTitleBg} ${theme.learningsTitleText}`}>
                Ghi nhớ cốt lõi
              </div>
              <ul className="mt-4 space-y-3.5">
                {data.learnings.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm font-bold">
                    <div className="mt-1.5 shrink-0">
                      <CheckCircle className={`w-4 h-4 ${activeTheme === 'chalkboard' ? 'text-teal-400' : 'text-emerald-600'}`} />
                    </div>
                    <span className="leading-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Details Grid */}
          {data.details && data.details.length > 0 && (
            <div className="pl-12 mb-8">
              <div className={`border border-dashed rounded-2xl p-5 ${theme.detailsBorder} ${theme.detailsBg}`}>
                 <div className="grid grid-cols-2 gap-4">
                   {data.details.map((detail, idx) => (
                     <div key={idx} className={`p-4 rounded-xl border shadow-sm transition-transform hover:scale-[1.01] ${theme.detailItemBg}`}>
                        <h4 className={`font-black text-base pb-1.5 mb-1.5 border-b flex items-center gap-2 ${theme.detailItemHeader}`}>
                          <Sparkles className="w-4 h-4 shrink-0" /> {detail.title}
                        </h4>
                        <p className="text-xs font-semibold leading-relaxed opacity-90">{detail.content}</p>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          )}
        </div>

        <div>
          {/* Footer Notes */}
          <div className="pl-12 grid grid-cols-2 gap-6 mt-4">
            <div className={`border rounded-xl p-4 flex gap-4 items-start shadow-sm ${theme.footerBorder} ${theme.footerBg}`}>
               <ShieldCheck className="w-8 h-8 text-slate-500 shrink-0 mt-0.5" />
               <div>
                 <h4 className="font-extrabold uppercase text-xs mb-1 border-b pb-1">Xác thực nội dung</h4>
                 <p className="text-[11px] font-semibold leading-tight opacity-85">{data.authenticityNote}</p>
               </div>
            </div>

            <div className={`border rounded-xl p-4 flex gap-4 items-start shadow-sm border-red-500/30 ${theme.footerBg}`}>
               <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0 mt-0.5" fill="#fecaca" />
               <div>
                 <h4 className="font-extrabold text-rose-600 uppercase text-xs mb-1 border-b border-rose-100 pb-1">Lưu ý quan trọng</h4>
                 <p className="text-[11px] font-semibold text-rose-700 leading-tight">{data.caution}</p>
               </div>
            </div>
          </div>
          
          {/* Footer signature */}
          <div className={`pl-12 mt-6 text-center text-[11px] font-bold border-t pt-3 flex items-center justify-between ${theme.signatureText}`}>
             <span className="flex items-center gap-1.5">
               <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
               EduCreate Studio Workspace
             </span>
             <span>Thiết kế bài học số chuẩn sư phạm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
