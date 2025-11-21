
import React, { useState, useEffect } from 'react';
import { X, Key, BookOpen, Info, Globe, ExternalLink, Check, AlertTriangle, Anchor, Settings, Cpu, Server, List, Sliders, Mic, Music, Zap, Wind, Waves, Activity, Link, Play, Square, RotateCcw, Save } from 'lucide-react';
import { AiProvider } from '../types';

interface MainMenuProps {
  isOpen: boolean;
  onClose: () => void;
  geminiKey: string;
  openaiKey: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  provider: AiProvider;
  onSaveSettings: (provider: AiProvider, geminiKey: string, openaiKey: string, openaiBaseUrl: string, openaiModel: string) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ isOpen, onClose, geminiKey, openaiKey, openaiBaseUrl, openaiModel, provider, onSaveSettings }) => {
  const [activeTab, setActiveTab] = useState<'API' | 'HELP' | 'INFO'>('API');
  const [tempGeminiKey, setTempGeminiKey] = useState(geminiKey);
  const [tempOpenaiKey, setTempOpenaiKey] = useState(openaiKey);
  const [tempBaseUrl, setTempBaseUrl] = useState(openaiBaseUrl || "https://api.openai.com/v1");
  const [tempModel, setTempModel] = useState(openaiModel || "gpt-4o-mini");
  const [tempProvider, setTempProvider] = useState<AiProvider>(provider);
  const [lang, setLang] = useState<'NL' | 'EN'>('NL');

  useEffect(() => {
      setTempGeminiKey(geminiKey);
      setTempOpenaiKey(openaiKey);
      setTempBaseUrl(openaiBaseUrl || "https://api.openai.com/v1");
      setTempModel(openaiModel || "gpt-4o-mini");
      setTempProvider(provider);
  }, [geminiKey, openaiKey, openaiBaseUrl, openaiModel, provider, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
      onSaveSettings(tempProvider, tempGeminiKey, tempOpenaiKey, tempBaseUrl, tempModel);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden relative">
        
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-10"
        >
            <X size={24} />
        </button>

        {/* Sidebar / Tabs */}
        <div className="flex h-full">
            <div className="w-16 sm:w-48 bg-slate-950 border-r border-slate-800 flex flex-col pt-6 gap-2 shrink-0">
                <div className="px-4 mb-6 hidden sm:block">
                    <h2 className="text-lg font-bold text-white">MENU</h2>
                </div>
                
                <button 
                    onClick={() => setActiveTab('API')}
                    className={`flex items-center gap-3 px-4 py-3 transition-all border-l-4
                        ${activeTab === 'API' 
                            ? 'bg-slate-800 border-cyan-500 text-cyan-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                >
                    <Settings size={20} />
                    <span className="hidden sm:block font-bold text-xs tracking-wider">SETTINGS</span>
                </button>

                <button 
                    onClick={() => setActiveTab('HELP')}
                    className={`flex items-center gap-3 px-4 py-3 transition-all border-l-4
                        ${activeTab === 'HELP' 
                            ? 'bg-slate-800 border-purple-500 text-purple-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                >
                    <BookOpen size={20} />
                    <span className="hidden sm:block font-bold text-xs tracking-wider">MANUAL</span>
                </button>

                <button 
                    onClick={() => setActiveTab('INFO')}
                    className={`flex items-center gap-3 px-4 py-3 transition-all border-l-4
                        ${activeTab === 'INFO' 
                            ? 'bg-slate-800 border-emerald-500 text-emerald-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                >
                    <Info size={20} />
                    <span className="hidden sm:block font-bold text-xs tracking-wider">INFO</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar scroll-smooth bg-slate-900">
                
                {/* --- API / SETTINGS TAB --- */}
                {activeTab === 'API' && (
                    <div className="max-w-2xl animate-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Cpu className="text-cyan-400" /> Engine Settings
                        </h2>
                        
                        {/* 1. Logic Provider Selection */}
                        <div className="mb-8">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">
                                Primary Logic Provider (Morphing)
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setTempProvider('GEMINI')}
                                    className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all
                                        ${tempProvider === 'GEMINI' 
                                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="font-bold">Google Gemini</div>
                                    <div className="text-[10px] opacity-70">Fastest & Free Tier available</div>
                                </button>

                                <button 
                                    onClick={() => setTempProvider('OPENAI')}
                                    className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all
                                        ${tempProvider === 'OPENAI' 
                                            ? 'bg-green-500/10 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' 
                                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="font-bold">OpenAI / Compatible</div>
                                    <div className="text-[10px] opacity-70">GPT, Groq, Ollama, etc.</div>
                                </button>
                            </div>
                        </div>

                        {/* 2. API Keys */}
                        <div className="space-y-6">
                            
                            {/* Gemini Key Input */}
                            <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 shadow-inner">
                                <label className="flex justify-between text-xs font-bold text-cyan-500 uppercase mb-2">
                                    <span>Google Gemini API Key</span>
                                    <span className="text-[10px] opacity-70 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">REQUIRED FOR VOICE/FX</span>
                                </label>
                                <input 
                                    type="password" 
                                    value={tempGeminiKey}
                                    onChange={(e) => setTempGeminiKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded focus:border-cyan-500 outline-none transition-colors font-mono"
                                />
                                <div className="mt-2 text-[10px] text-slate-500">
                                    Required for the <strong>Voice</strong> and <strong>Sound FX</strong> features, even if Morphing uses OpenAI.
                                </div>
                            </div>

                            {/* OpenAI Key Input (Conditional Visuals) */}
                            <div className={`bg-slate-950 p-6 rounded-lg border transition-colors shadow-inner
                                ${tempProvider === 'OPENAI' ? 'border-green-500/50' : 'border-slate-800 opacity-50'}
                            `}>
                                <label className="flex justify-between text-xs font-bold text-green-500 uppercase mb-2">
                                    <span>OpenAI / Provider API Key</span>
                                    {tempProvider === 'OPENAI' && <span className="text-[10px] opacity-70 bg-green-900/20 px-2 py-0.5 rounded">ACTIVE</span>}
                                </label>
                                <input 
                                    type="password" 
                                    value={tempOpenaiKey}
                                    onChange={(e) => setTempOpenaiKey(e.target.value)}
                                    placeholder="sk-..."
                                    disabled={tempProvider !== 'OPENAI'}
                                    className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded focus:border-green-500 outline-none transition-colors disabled:cursor-not-allowed font-mono"
                                />

                                {/* Advanced OpenAI Settings */}
                                {tempProvider === 'OPENAI' && (
                                    <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                        <div>
                                            <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                <Server size={10} /> Base URL
                                            </label>
                                            <input 
                                                type="text" 
                                                value={tempBaseUrl}
                                                onChange={(e) => setTempBaseUrl(e.target.value)}
                                                placeholder="https://api.openai.com/v1"
                                                className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs px-2 py-2 rounded focus:border-green-500 outline-none font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                <Cpu size={10} /> Model Name
                                            </label>
                                            <input 
                                                type="text" 
                                                value={tempModel}
                                                onChange={(e) => setTempModel(e.target.value)}
                                                placeholder="gpt-4o-mini"
                                                className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs px-2 py-2 rounded focus:border-green-500 outline-none font-mono"
                                            />
                                        </div>
                                        <div className="col-span-full text-[9px] text-slate-500 p-2 bg-slate-900 rounded border border-slate-800">
                                            <div className="font-bold mb-1">Compatible Providers:</div>
                                            <ul className="list-disc list-inside space-y-1">
                                                <li><strong>OpenAI:</strong> https://api.openai.com/v1 (gpt-4o-mini, gpt-4)</li>
                                                <li><strong>Groq:</strong> https://api.groq.com/openai/v1 (llama3-70b-8192, mixtral-8x7b-32768)</li>
                                                <li><strong>Local (Ollama):</strong> http://localhost:11434/v1 (llama3, mistral)</li>
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="mt-8 flex justify-end">
                            <button 
                                onClick={handleSave}
                                className="bg-slate-100 hover:bg-white text-slate-900 px-8 py-3 rounded font-bold transition-colors flex items-center gap-2 shadow-lg"
                            >
                                <Check size={18} /> SAVE SETTINGS
                            </button>
                        </div>
                    </div>
                )}

                {/* --- INFO TAB --- */}
                {activeTab === 'INFO' && (
                    <div className="max-w-xl animate-in slide-in-from-right-4 duration-300 text-center sm:text-left">
                        <div className="w-20 h-20 bg-cyan-500 rounded-full flex items-center justify-center mx-auto sm:mx-0 mb-6 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
                             <Info size={40} className="text-slate-900" />
                        </div>
                        <h2 className="text-3xl font-black text-white mb-2">AETHER LOOP</h2>
                        <p className="text-cyan-400 text-sm font-mono tracking-widest uppercase mb-8">
                            Algorithmic Soundscape Engine
                        </p>

                        <p className="text-slate-300 leading-relaxed mb-6">
                            Aether Loop is an experimental web synthesizer designed to create infinite, 
                            evolving ambient textures. It combines traditional sampling with algorithmic 
                            probability and modern AI generation.
                        </p>

                        <a 
                            href="https://sites.google.com/view/sparlai/homepage" 
                            target="_blank"
                            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-lg transition-all group border border-slate-600 hover:border-cyan-400"
                        >
                            <span>Visit SparlAI Homepage</span>
                            <ExternalLink size={16} className="group-hover:translate-x-1 transition-transform" />
                        </a>
                        
                        <div className="mt-12 pt-8 border-t border-slate-800 text-xs text-slate-600">
                            <p>Created by Jeroen Sparla.</p>
                            <p>Built with React, Web Audio API, Google Gemini & OpenAI.</p>
                        </div>
                    </div>
                )}

                {/* --- HELP TAB (MANUAL) --- */}
                {activeTab === 'HELP' && (
                    <div className="max-w-5xl animate-in slide-in-from-right-4 duration-300 pb-20">
                        
                        {/* Language Toggle */}
                        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4 sticky top-0 bg-slate-900/95 backdrop-blur z-20 pt-2">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <BookOpen className="text-purple-400" /> 
                                {lang === 'NL' ? 'Handleiding & Manual' : 'User Manual & Guide'}
                            </h2>
                            <button 
                                onClick={() => setLang(prev => prev === 'NL' ? 'EN' : 'NL')}
                                className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-700 transition-colors border border-slate-700 hover:text-white"
                            >
                                <Globe size={14} />
                                {lang === 'NL' ? 'Switch to English' : 'Schakel naar Nederlands'}
                            </button>
                        </div>

                        <div className="space-y-16">
                            
                            {/* 1. INTRODUCTION */}
                            <section>
                                <h3 className="text-lg font-black text-cyan-500 mb-4 tracking-wider uppercase">1. {lang === 'NL' ? 'Het Concept' : 'The Concept'}</h3>
                                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 leading-relaxed text-slate-300 text-sm">
                                    <p className="mb-4">
                                        {lang === 'NL'
                                        ? "Aether Loop is een 'Asynchrone Loop Station'. In traditionele muzieksoftware (DAWs) loopt alles strak in de maat (Grid). Aether Loop is ontworpen om chaos te omarmen."
                                        : "Aether Loop is an 'Asynchronous Loop Station'. In traditional music software (DAWs), everything is locked to a rigid grid. Aether Loop is designed to embrace chaos."}
                                    </p>
                                    <p className="mb-4">
                                        <strong className="text-white">Polyrhythms:</strong> {lang === 'NL'
                                        ? "Elk spoor heeft zijn eigen lengte en snelheid. Een loop van 4 seconden en een loop van 4.1 seconden zullen langzaam uit fase lopen. Hierdoor onstaan steeds nieuwe combinaties van geluiden die zich nooit precies herhalen."
                                        : "Each track has its own length and playback speed. A 4-second loop and a 4.1-second loop will slowly drift out of phase. This creates ever-evolving combinations of sounds that never repeat exactly."}
                                    </p>
                                    <p>
                                        <strong className="text-white">Generative:</strong> {lang === 'NL'
                                        ? "Met LFO's (onzichtbare handen die aan knoppen draaien) en Drift (willekeurige afwijkingen) blijft het geluid in beweging, als een levend organisme."
                                        : "With LFOs (invisible hands turning knobs) and Drift (random fluctuations), the sound remains in constant motion, like a living organism."}
                                    </p>
                                </div>
                            </section>

                            {/* 2. INTERFACE OVERVIEW */}
                            <section>
                                <h3 className="text-lg font-black text-cyan-500 mb-4 tracking-wider uppercase">2. {lang === 'NL' ? 'De Interface' : 'The Interface'}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="bg-slate-900 p-4 rounded border border-slate-800 flex gap-3">
                                        <RotateCcw size={24} className="text-slate-500 shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-white text-sm">Global Transport</h4>
                                            <p className="text-xs text-slate-400 mt-1">{lang === 'NL' ? 'Reset (wist alles), Panic (stop alles), Play All, en Record Output.' : 'Reset (clears all), Panic (stops all), Play All, and Record Output.'}</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 p-4 rounded border border-slate-800 flex gap-3">
                                        <Save size={24} className="text-slate-500 shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-white text-sm">Presets</h4>
                                            <p className="text-xs text-slate-400 mt-1">{lang === 'NL' ? 'Sla je sessie op als .JSON bestand. Dit bevat alle instellingen én de audio samples (Base64).' : 'Save your session as a .JSON file. This includes all settings AND the audio samples (Base64).'}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* 3. TRACK STRIP - DETAILED */}
                            <section>
                                <h3 className="text-lg font-black text-cyan-500 mb-4 tracking-wider uppercase">3. {lang === 'NL' ? 'Spoor Bediening (Track Strip)' : 'Track Controls'}</h3>
                                <div className="space-y-8">
                                    
                                    {/* A. Basic Controls */}
                                    <div className="relative pl-6 border-l-2 border-slate-700">
                                        <h4 className="font-bold text-white text-base mb-3 flex items-center gap-2">
                                            <Sliders size={16} className="text-cyan-400" />
                                            {lang === 'NL' ? 'Basis Instellingen' : 'Basic Settings'}
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="bg-slate-950 p-3 rounded">
                                                <strong className="text-cyan-500 text-xs uppercase block mb-1">VOL (Volume)</strong>
                                                <p className="text-xs text-slate-400">{lang === 'NL' ? 'Het uitgangsvolume van het spoor.' : 'The output gain/volume of the track.'}</p>
                                            </div>
                                            <div className="bg-slate-950 p-3 rounded">
                                                <strong className="text-amber-500 text-xs uppercase block mb-1">PAN (Panorama)</strong>
                                                <p className="text-xs text-slate-400">{lang === 'NL' ? 'Plaatst het geluid links of rechts in het stereobeeld.' : 'Positions the sound left or right in the stereo field.'}</p>
                                            </div>
                                            <div className="bg-slate-950 p-3 rounded">
                                                <strong className="text-purple-500 text-xs uppercase block mb-1">SPEED (Playback Rate)</strong>
                                                <p className="text-xs text-slate-400">{lang === 'NL' ? 'Snelheid & Toonhoogte gekoppeld (Tape style). 0.5 = Octaaf lager, 2.0 = Octaaf hoger.' : 'Linked Speed & Pitch (Tape style). 0.5 = Octave down, 2.0 = Octave up.'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* B. EQ & FX */}
                                    <div className="relative pl-6 border-l-2 border-slate-700">
                                        <h4 className="font-bold text-white text-base mb-3 flex items-center gap-2">
                                            <List size={16} className="text-red-400" />
                                            {lang === 'NL' ? 'EQ & Effecten' : 'EQ & Effects'}
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="bg-slate-950 p-3 rounded">
                                                <strong className="text-red-400 text-xs uppercase block mb-1">3-Band EQ (Low/Mid/High)</strong>
                                                <p className="text-xs text-slate-400">{lang === 'NL' ? 'Vorm de klankkleur. Draai LOW weg om modderigheid te voorkomen in ambient mixen.' : 'Shape the tone. Cut LOWs to prevent mud in ambient mixes.'}</p>
                                            </div>
                                            <div className="bg-slate-950 p-3 rounded">
                                                <strong className="text-pink-500 text-xs uppercase block mb-1">REVERB</strong>
                                                <p className="text-xs text-slate-400">{lang === 'NL' ? 'Stuurt audio naar een "Algorithmic Convolver Reverb" voor een grote ruimtelijke klank.' : 'Sends audio to an "Algorithmic Convolver Reverb" for a massive spatial sound.'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* C. Modulation (LFOs) */}
                                    <div className="relative pl-6 border-l-2 border-slate-700">
                                        <h4 className="font-bold text-white text-base mb-3 flex items-center gap-2">
                                            <Activity size={16} className="text-cyan-400" />
                                            {lang === 'NL' ? 'LFO Modulatie' : 'LFO Modulation'}
                                        </h4>
                                        <p className="text-xs text-slate-300 mb-3 italic">
                                            {lang === 'NL' ? '"Low Frequency Oscillator" is een robot die automatisch aan knoppen draait.' : '"Low Frequency Oscillator" is a robot that automatically turns knobs for you.'}
                                        </p>
                                        <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                                            <li><strong>Tabs (VOL/PAN/PITCH):</strong> {lang === 'NL' ? 'Elk spoor heeft 3 onafhankelijke LFOs.' : 'Each track has 3 independent LFOs.'}</li>
                                            <li><strong>RATE:</strong> {lang === 'NL' ? 'Hoe snel de waarde verandert (Hz).' : 'How fast the value changes (Hz).'}</li>
                                            <li><strong>DEPTH:</strong> {lang === 'NL' ? 'Hoe ver de knop wordt opengedraaid.' : 'How far the knob is turned.'}</li>
                                        </ul>
                                    </div>

                                    {/* D. Ecosystem (Unique Features) */}
                                    <div className="relative pl-6 border-l-2 border-emerald-500/50 bg-emerald-900/5 p-4 rounded-r-lg">
                                        <h4 className="font-bold text-emerald-400 text-base mb-3 flex items-center gap-2">
                                            <Waves size={16} />
                                            {lang === 'NL' ? 'Ecosysteem (Geavanceerd)' : 'Ecosystem (Advanced)'}
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div>
                                                <strong className="text-slate-200 text-xs uppercase flex items-center gap-1 mb-1">
                                                    <Wind size={12} /> GRAIN (Granular Spray)
                                                </strong>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    {lang === 'NL' 
                                                    ? "Injecteert ruis in het afspeelmechanisme. Dit zorgt voor jitter in de afspeelsnelheid. Laag = Analoge Warmte. Hoog = Glitchy Chaos."
                                                    : "Injects noise into the playback engine. Creates jitter in playback rate. Low = Analog Warmth. High = Glitchy Chaos."}
                                                </p>
                                            </div>
                                            <div>
                                                <strong className="text-emerald-400 text-xs uppercase flex items-center gap-1 mb-1">
                                                    <Waves size={12} /> FEED (Feedback)
                                                </strong>
                                                <p className="text-xs text-slate-400 leading-relaxed">
                                                    {lang === 'NL' 
                                                    ? "Laat sporen elkaar beïnvloeden. Je stuurt het volume van DIT spoor naar een parameter van een ANDER spoor."
                                                    : "Allows tracks to influence each other. You send the volume envelope of THIS track to modulate ANOTHER track."}
                                                </p>
                                                <div className="mt-2 text-[10px] bg-slate-950 p-2 rounded border border-emerald-900/30 text-emerald-200/70">
                                                    <strong>Effect:</strong> {lang === 'NL' ? "Bij >50% ontstaat FM Synthese (Metaalachtige klanken)." : "At >50%, it triggers FM Synthesis (Metallic tones)."}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* E. The Bridge */}
                                    <div className="relative pl-6 border-l-2 border-indigo-500/50">
                                        <h4 className="font-bold text-indigo-400 text-base mb-3 flex items-center gap-2">
                                            <Link size={16} />
                                            {lang === 'NL' ? 'The Bridge (Crossfade)' : 'The Bridge (Crossfade)'}
                                        </h4>
                                        <p className="text-xs text-slate-400 leading-relaxed mb-2">
                                            {lang === 'NL'
                                            ? "Zichtbaar tussen de even en oneven sporen (bijv. tussen 1 en 2). Als je op het ketting-icoon klikt, worden de twee sporen aan elkaar gekoppeld."
                                            : "Visible between even and odd tracks (e.g., between 1 and 2). Clicking the chain icon links the two tracks together."}
                                        </p>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                            {lang === 'NL'
                                            ? "Er start een sinus-golf die het volume van spoor 1 omhoog duwt terwijl spoor 2 omlaag gaat, en andersom. De knop regelt de snelheid van deze automatische mix."
                                            : "A sine wave starts pushing Track 1's volume up while Track 2 goes down, and vice versa. The knob controls the speed of this automatic mix."}
                                        </p>
                                    </div>

                                </div>
                            </section>

                            {/* 4. AI ASSISTANT */}
                            <section>
                                <h3 className="text-lg font-black text-purple-500 mb-4 tracking-wider uppercase">4. {lang === 'NL' ? 'AI Assistent' : 'AI Assistant'}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-950 p-4 rounded border border-slate-800">
                                        <div className="flex items-center gap-2 mb-2 text-cyan-400">
                                            <Zap size={18} /> <strong className="text-sm">MORPH</strong>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            {lang === 'NL' 
                                            ? "De 'Dirigent'. Beschrijf een sfeer ('Onderwater Grot') en de AI past de instellingen van ALLE sporen aan (EQ, LFO, Pan) om die sfeer te creëren. Het gebruikt bestaande samples."
                                            : "The 'Conductor'. Describe a mood ('Underwater Cave') and the AI adjusts ALL settings on ALL tracks (EQ, LFO, Pan) to match that mood. Uses existing samples."}
                                        </p>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded border border-slate-800">
                                        <div className="flex items-center gap-2 mb-2 text-purple-400">
                                            <Mic size={18} /> <strong className="text-sm">VOICE</strong>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            {lang === 'NL' 
                                            ? "Text-to-Speech. Typ een zin en de AI genereert een gesproken sample en laadt deze direct in een spoor. Vereist Gemini Key."
                                            : "Text-to-Speech. Type a sentence, and the AI generates a spoken sample and loads it directly into a track. Requires Gemini Key."}
                                        </p>
                                    </div>
                                    <div className="bg-slate-950 p-4 rounded border border-slate-800">
                                        <div className="flex items-center gap-2 mb-2 text-emerald-400">
                                            <Music size={18} /> <strong className="text-sm">SOUND</strong>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            {lang === 'NL' 
                                            ? "FX Generator. Typ 'Laser' of 'Voetstappen'. De AI zet de woorden om in een klanknabootsing (Onomatopee) en maakt er audio van."
                                            : "FX Generator. Type 'Laser' or 'Footsteps'. The AI converts the words into an onomatopoeia and synthesizes audio from it."}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* 5. TROUBLESHOOTING */}
                            <section className="border-t border-slate-800 pt-8 mt-8">
                                <h3 className="text-lg font-black text-red-400 mb-4 tracking-wider uppercase flex items-center gap-2">
                                    <AlertTriangle size={20} /> Troubleshooting
                                </h3>
                                
                                <div className="space-y-4">
                                    <div className="bg-red-950/20 border border-red-500/20 p-4 rounded">
                                        <h4 className="font-bold text-red-300 text-sm mb-1">Error: "Network Error / Failed to Fetch"</h4>
                                        <p className="text-xs text-red-200/70 leading-relaxed">
                                            {lang === 'NL' 
                                            ? "Dit betekent dat de browser geen verbinding kan maken met de AI server. Oorzaken:" 
                                            : "This means the browser cannot connect to the AI server. Common causes:"}
                                        </p>
                                        <ul className="list-disc list-inside text-xs text-red-200/60 mt-2 space-y-1">
                                            <li><strong>AdBlockers / Privacy Extensions:</strong> (Privacy Badger, uBlock) {lang === 'NL' ? "blokkeren vaak API calls. Schakel ze uit voor deze site." : "often block API calls. Disable them for this site."}</li>
                                            <li><strong>Localhost CORS:</strong> {lang === 'NL' ? "Als u een lokale LLM (Ollama) gebruikt, blokkeert de browser HTTP calls vanuit HTTPS. Gebruik een tunnel of pas browser settings aan." : "If using local LLM (Ollama), browsers block HTTP calls from HTTPS. Use a tunnel or adjust browser settings."}</li>
                                            <li><strong>Internet:</strong> {lang === 'NL' ? "Controleer uw verbinding." : "Check your connection."}</li>
                                        </ul>
                                    </div>

                                    <div className="bg-amber-950/20 border border-amber-500/20 p-4 rounded">
                                        <h4 className="font-bold text-amber-300 text-sm mb-1">Error: "Quota Exceeded / 429"</h4>
                                        <p className="text-xs text-amber-200/70 leading-relaxed">
                                            {lang === 'NL' 
                                            ? "Dit komt van de Provider (OpenAI/Google). Uw API Key heeft geen tegoed meer. Dit is geen fout in de app. Controleer uw billing op platform.openai.com." 
                                            : "This comes from the Provider (OpenAI/Google). Your API Key has run out of credit. This is not an app error. Check your billing at platform.openai.com."}
                                        </p>
                                    </div>
                                </div>
                            </section>

                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
