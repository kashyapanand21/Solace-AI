import React from 'react';
import { Cpu, Search, Mic, Activity } from 'lucide-react';

export default function Header() {
  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[1000] w-fit px-8 h-14 glass-panel flex items-center gap-8 border-white/20 shadow-2xl">
      <div className="flex items-center gap-2">
        <Cpu className="text-[#ff4500] animate-pulse" size={20} />
        <span className="font-bold text-sm tracking-widest uppercase">Smart <span className="text-[#ff4500]">Files</span></span>
      </div>
      
      <div className="h-6 w-[1px] bg-white/10" />

      <nav className="flex items-center gap-6">
        <a href="#" className="text-xs font-semibold hover:text-[#ff4500] transition-colors">DASHBOARD</a>
        <a href="#" className="text-xs font-semibold text-slate-500 hover:text-white">AI CLUSTERS</a>
        <a href="#" className="text-xs font-semibold text-slate-500 hover:text-white">SETTINGS</a>
      </nav>

      <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/5">
        <Search size={14} className="text-slate-500" />
        <input type="text" placeholder="Query Intelligence..." className="bg-transparent outline-none text-xs w-32 placeholder:text-slate-600" />
        <Mic size={14} className="text-[#ff4500] cursor-pointer" />
      </div>
    </div>
  );
}