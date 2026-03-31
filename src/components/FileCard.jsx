import React from 'react';
import { FileText, Zap, MoreVertical, Share2 } from 'lucide-react';

export default function FileCard({ file }) {
  return (
    <div className="group glass-panel p-6 border-l-4 border-l-[#ff4500] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(255,69,0,0.25)]">
      <div className="flex justify-between items-start mb-6">
        <div className="bg-[#ff4500]/10 p-3 rounded-xl border border-[#ff4500]/20">
          <FileText className="text-[#ff4500]" size={24} />
        </div>
        <div className="flex gap-2">
           <button className="text-slate-500 hover:text-white"><Share2 size={16}/></button>
           <button className="text-slate-500 hover:text-white"><MoreVertical size={16}/></button>
        </div>
      </div>

      <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#ff4500] transition-colors uppercase tracking-tight">
        {file.name}
      </h3>
      <p className="text-xs text-[#ff4500] font-medium tracking-widest mb-4">
        AI PROCESSED · {file.date}
      </p>

      <p className="text-sm text-slate-400 line-clamp-2 mb-6 leading-relaxed">
        {file.summary || "No semantic summary available for this node."}
      </p>

      <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
        {file.tags.map(tag => (
          <span key={tag} className="text-[10px] font-bold px-2 py-1 bg-white/5 rounded-md border border-white/10 text-slate-500 group-hover:border-[#ff4500]/30">
            #{tag.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}