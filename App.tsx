
import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Mic, Save, FolderOpen, Waves, Loader, Maximize2, Minimize2, RotateCcw, Menu } from 'lucide-react';
import { AudioEngine } from './services/audioEngine';
import { TrackData, AudioState, Preset, AiProvider } from './types';
import TrackStrip from './components/TrackStrip';
import Visualizer from './components/Visualizer';
import Knob from './components/Knob';
import AiAssistant from './components/AiAssistant';
import MainMenu from './components/MainMenu';

// Sample Pool for Demo Kit (Fallback)
const DEMO_SAMPLES = [
  "https://tonejs.github.io/audio/berklee/gong_1.mp3",
  "https://tonejs.github.io/audio/berklee/gong_2.mp3",
  "https://tonejs.github.io/audio/berklee/ice_cream.mp3",
  "https://tonejs.github.io/audio/berklee/tube_1.mp3",
  "https://tonejs.github.io/audio/berklee/tube_2.mp3",
  "https://tonejs.github.io/audio/casio/A1.mp3",
  "https://tonejs.github.io/audio/casio/C2.mp3",
  "https://tonejs.github.io/audio/casio/E2.mp3",
  "https://tonejs.github.io/audio/salamander/A0.mp3",
  "https://tonejs.github.io/audio/salamander/C1.mp3",
  "https://tonejs.github.io/audio/salamander/D#1.mp3",
  "https://tonejs.github.io/audio/salamander/F#1.mp3",
  "https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3",
  "https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3",
  "https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3",
  "https://tonejs.github.io/audio/drum-samples/KPR77/cymbal.mp3",
];

// Default Track State
const createDefaultTrack = (id: number): TrackData => ({
  id,
  name: `Track ${id + 1}`,
  file: null,
  buffer: null,
  isPlaying: false,
  isMuted: false,
  isSolo: false,
  volume: 0.6,
  pan: 0,
  playbackRate: 1.0,
  
  // EQ Defaults (0.5 = 0dB/Flat in our UI mapping logic later)
  eqLow: 0.5, 
  eqMid: 0.5,
  eqHigh: 0.5,

  // Independent LFOs
  lfoVol: { enabled: false, rate: 4.0, depth: 0.5 },
  lfoPan: { enabled: false, rate: 0.5, depth: 0.8 },
  lfoPitch: { enabled: false, rate: 2.0, depth: 0.1 },
  
  driftEnabled: false,
  linkNext: false,
  crossfadeSpeed: 0.1, // Default 0.1Hz (10s cycle)
  reverbSend: 0.2,
  
  // New Ecosystem Features
  granularSpray: 0.0,
  feedbackSend: 0.0,
  feedbackTargetId: (id + 1) % 8 // Default ring topology
});

const App: React.FC = () => {
  // --- State ---
  const [audioState, setAudioState] = useState<AudioState>(AudioState.STOPPED);
  const [tracks, setTracks] = useState<TrackData[]>(Array.from({ length: 8 }, (_, i) => createDefaultTrack(i)));
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [recorderTime, setRecorderTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isStudioMode, setIsStudioMode] = useState(false); // Compact mode for DAW usage
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Keys & Provider
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [aiProvider, setAiProvider] = useState<AiProvider>('GEMINI');
  
  // Use state for engine to ensure re-renders propagate to children
  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null);
  
  // Refs for callbacks/loops that don't need re-renders
  const engineRef = useRef<AudioEngine | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // --- Initialization ---
  useEffect(() => {
    const engine = new AudioEngine();
    setAudioEngine(engine);
    engineRef.current = engine;
    
    // Load API Keys & Provider
    const storedGemini = localStorage.getItem('aether_api_key');
    if (storedGemini) setGeminiKey(storedGemini);

    const storedOpenai = localStorage.getItem('aether_openai_key');
    if (storedOpenai) setOpenaiKey(storedOpenai);
    
    const storedBaseUrl = localStorage.getItem('aether_openai_base_url');
    if (storedBaseUrl) setOpenaiBaseUrl(storedBaseUrl);

    const storedModel = localStorage.getItem('aether_openai_model');
    if (storedModel) setOpenaiModel(storedModel);
    
    const storedProvider = localStorage.getItem('aether_ai_provider');
    if (storedProvider && (storedProvider === 'GEMINI' || storedProvider === 'OPENAI')) {
        setAiProvider(storedProvider as AiProvider);
    }
    
    // Initial Setup
    tracks.forEach(t => engine.initTrack(t));

    return () => {
      engine.context.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Settings Management ---
  const handleSaveSettings = (provider: AiProvider, gKey: string, oKey: string, oBaseUrl: string, oModel: string) => {
      setAiProvider(provider);
      setGeminiKey(gKey);
      setOpenaiKey(oKey);
      setOpenaiBaseUrl(oBaseUrl);
      setOpenaiModel(oModel);
      
      localStorage.setItem('aether_ai_provider', provider);
      
      if (gKey) localStorage.setItem('aether_api_key', gKey);
      else localStorage.removeItem('aether_api_key');
      
      if (oKey) localStorage.setItem('aether_openai_key', oKey);
      else localStorage.removeItem('aether_openai_key');

      if (oBaseUrl) localStorage.setItem('aether_openai_base_url', oBaseUrl);
      else localStorage.removeItem('aether_openai_base_url');

      if (oModel) localStorage.setItem('aether_openai_model', oModel);
      else localStorage.removeItem('aether_openai_model');
  };

  // --- Track Management ---
  const updateTrack = (id: number, changes: Partial<TrackData>) => {
    setTracks(prev => {
      const newTracks = prev.map(t => t.id === id ? { ...t, ...changes } : t);
      const updatedTrack = newTracks.find(t => t.id === id);
      if (updatedTrack && engineRef.current) {
        const soloActive = newTracks.some(t => t.isSolo);
        const soloTrackId = soloActive ? newTracks.find(t => t.isSolo)?.id || null : null;
        if ('isSolo' in changes || 'isMuted' in changes || 'linkNext' in changes || 'crossfadeSpeed' in changes || 'feedbackTargetId' in changes) {
            newTracks.forEach(t => {
                engineRef.current?.updateTrackParams(t, masterVolume, soloActive, soloTrackId);
            });
        } else {
            engineRef.current.updateTrackParams(updatedTrack, masterVolume, soloActive, soloTrackId);
        }
      }
      return newTracks;
    });
  };

  const handleLoadFile = async (id: number, file: File) => {
    if (!engineRef.current) return;
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await engineRef.current.decodeAudioData(arrayBuffer);
    updateTrack(id, { file, buffer: audioBuffer, name: file.name.substring(0, 12) });
  };

  const handleCopyTrack = (sourceId: number, targetId: number) => {
    if (!engineRef.current) return;
    const source = tracks.find(t => t.id === sourceId);
    const target = tracks.find(t => t.id === targetId);
    if (!source || !source.buffer || !target) return;
    if (target.isPlaying) engineRef.current.stopTrack(targetId);
    updateTrack(targetId, {
        buffer: source.buffer,
        file: source.file,
        name: source.name, 
        base64Source: undefined
    });
  };

  const handleReset = () => {
    if (engineRef.current) {
        try { engineRef.current.reset(); } catch(e) {}
    }
    setAudioState(AudioState.STOPPED);
    stopRecording();
    setTracks(Array.from({ length: 8 }, (_, i) => createDefaultTrack(i)));
    setMasterVolume(0.8);
  };

  const handleDemoLoad = async () => {
    if (!engineRef.current) return;
    try {
        await engineRef.current.resume();
        setIsLoading(true);
        let selectedUrls: string[] = [];
        const fetchRepoFiles = async (branch: string) => {
             const response = await fetch(`https://api.github.com/repos/jeroensparla/dronescapes/git/trees/${branch}?recursive=1&t=${Date.now()}`);
             if (!response.ok) return [];
             const data = await response.json();
             return data.tree
                .filter((item: any) => item.type === 'blob' && /\.(mp3|wav)$/i.test(item.path))
                .map((item: any) => `https://raw.githubusercontent.com/jeroensparla/dronescapes/${branch}/${encodeURI(item.path)}`);
        };
        let urls = await fetchRepoFiles('main');
        if (urls.length === 0) urls = await fetchRepoFiles('master');
        if (urls.length > 0) {
             const shuffled = urls.sort(() => 0.5 - Math.random());
             selectedUrls = shuffled.slice(0, 8);
        }
        if (selectedUrls.length === 0) {
             const shuffled = [...DEMO_SAMPLES].sort(() => 0.5 - Math.random());
             selectedUrls = shuffled.slice(0, 8);
        }
        const loadPromises = selectedUrls.map(async (url, index) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch ${url}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await engineRef.current!.decodeAudioData(arrayBuffer);
                let fileName = url.split('/').pop() || `Sample ${index + 1}`;
                fileName = decodeURIComponent(fileName);
                const cleanName = fileName.split('?')[0].replace(/\.[^/.]+$/, "").substring(0, 12);
                return { buffer: audioBuffer, name: cleanName };
            } catch (e) {
                return { buffer: engineRef.current!.generateTestBuffer(), name: "Synth (Fallback)" };
            }
        });
        const results = await Promise.all(loadPromises);
        const newTracks = [...tracks];
        for (let i = 0; i < 8; i++) {
            const data = results[i];
            if (data) {
                newTracks[i] = { 
                    ...newTracks[i], 
                    buffer: data.buffer, 
                    name: data.name,
                    playbackRate: 0.6 + (Math.random() * 0.8),
                    pan: (Math.random() * 1.6) - 0.8,
                    reverbSend: 0.1 + (Math.random() * 0.5),
                    eqLow: 0.4 + Math.random() * 0.3,
                    eqHigh: 0.4 + Math.random() * 0.3,
                    lfoPan: { enabled: Math.random() > 0.5, rate: 0.1 + Math.random() * 0.4, depth: 0.6 },
                    linkNext: i % 2 === 0 && Math.random() > 0.6
                };
                engineRef.current.initTrack(newTracks[i]);
                engineRef.current.updateTrackParams(newTracks[i], masterVolume, false, null);
            }
        }
        setTracks(newTracks);
    } catch (e) {
        alert("Could not fetch demo samples.");
    } finally {
        setIsLoading(false);
    }
  };

  // --- AI Functions ---
  
  const handleAiMorph = (configs: Partial<TrackData>[]) => {
      setTracks(prev => {
          const newTracks = prev.map((track, index) => {
             const conf = configs[index];
             if (conf) {
                 const safeNum = (val: any, min: number, max: number, fallback: number) => {
                    if (val === undefined || val === null || typeof val !== 'number' || !Number.isFinite(val)) return fallback;
                    return Math.max(min, Math.min(max, val));
                 };
                 const safeBool = (val: any, fallback: boolean) => typeof val === 'boolean' ? val : fallback;
                 const safeLFO = (base: any, input: any) => ({
                     enabled: safeBool(input?.enabled, base.enabled),
                     rate: safeNum(input?.rate, 0.01, 20.0, base.rate),
                     depth: safeNum(input?.depth, 0.0, 1.0, base.depth)
                 });
                 const merged = { ...track };
                 if (conf.name) merged.name = String(conf.name).substring(0, 15);
                 merged.volume = safeNum(conf.volume, 0, 1, track.volume);
                 merged.pan = safeNum(conf.pan, -1, 1, track.pan);
                 merged.playbackRate = safeNum(conf.playbackRate, 0.1, 4.0, track.playbackRate);
                 merged.reverbSend = safeNum(conf.reverbSend, 0, 1, track.reverbSend);
                 merged.driftEnabled = safeBool(conf.driftEnabled, track.driftEnabled);
                 merged.eqLow = safeNum(conf.eqLow, 0, 1, track.eqLow);
                 merged.eqMid = safeNum(conf.eqMid, 0, 1, track.eqMid);
                 merged.eqHigh = safeNum(conf.eqHigh, 0, 1, track.eqHigh);
                 merged.lfoVol = safeLFO(track.lfoVol, conf.lfoVol);
                 merged.lfoPan = safeLFO(track.lfoPan, conf.lfoPan);
                 merged.lfoPitch = safeLFO(track.lfoPitch, conf.lfoPitch);
                 if (index % 2 === 0) {
                     merged.linkNext = safeBool(conf.linkNext, track.linkNext);
                     merged.crossfadeSpeed = safeNum(conf.crossfadeSpeed, 0.01, 2.0, track.crossfadeSpeed);
                 }
                 merged.granularSpray = safeNum(conf.granularSpray, 0, 1, track.granularSpray);
                 merged.feedbackSend = safeNum(conf.feedbackSend, 0, 1, track.feedbackSend);
                 if (conf.feedbackTargetId !== undefined) {
                     merged.feedbackTargetId = Math.max(0, Math.min(7, Number(conf.feedbackTargetId)));
                 }
                 return merged;
             }
             return track;
          });
          
          const soloActive = newTracks.some(t => t.isSolo);
          const soloTrackId = soloActive ? newTracks.find(t => t.isSolo)?.id || null : null;
          newTracks.forEach(t => engineRef.current?.updateTrackParams(t, masterVolume, soloActive, soloTrackId));
          return newTracks;
      });
  };

  const handleAiSampleLoad = (trackId: number, buffer: AudioBuffer, name: string) => {
      updateTrack(trackId, { buffer: buffer, name: name, file: null });
  };

  const toggleGlobalPlay = () => {
    if (!engineRef.current) return;
    if (audioState === AudioState.PLAYING || audioState === AudioState.RECORDING) {
      tracks.forEach(t => engineRef.current?.stopTrack(t.id));
      setTracks(prev => prev.map(t => ({ ...t, isPlaying: false })));
      setAudioState(AudioState.STOPPED);
      stopRecording(); 
    } else {
      const soloActive = tracks.some(t => t.isSolo);
      const soloTrackId = soloActive ? tracks.find(t => t.isSolo)?.id || null : null;
      const newTracks = tracks.map(t => t.buffer ? ({ ...t, isPlaying: true }) : t);
      newTracks.forEach(t => {
          if (t.isPlaying) {
             engineRef.current?.playTrack(t);
             engineRef.current?.updateTrackParams(t, masterVolume, soloActive, soloTrackId);
          }
      });
      setTracks(newTracks);
      setAudioState(AudioState.PLAYING);
    }
  };

  const handleMasterVolume = (val: number) => {
      setMasterVolume(val);
      engineRef.current?.updateMasterVolume(val);
  };

  const toggleRecord = () => {
      if (audioState === AudioState.RECORDING) toggleGlobalPlay(); 
      else {
          if (audioState === AudioState.STOPPED) toggleGlobalPlay(); 
          startRecording();
      }
  };

  const startRecording = () => {
      if (!engineRef.current) return;
      const dest = engineRef.current.dest;
      const recorder = new MediaRecorder(dest.stream);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `aether-session-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setRecorderTime(0);
          if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      };
      recorder.start();
      setAudioState(AudioState.RECORDING);
      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => { setRecorderTime((Date.now() - startTime) / 1000); }, 100);
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
  };

  const savePreset = async () => {
      const date = new Date().toISOString().slice(0, 10);
      const filename = `aether-preset-${date}-${Date.now().toString().slice(-4)}.json`;
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      try {
          const presetTracks: Partial<TrackData>[] = [];
          for (const track of tracks) {
               const { buffer, file, isPlaying, ...rest } = track;
               let base64Source = undefined;
               if (buffer && engineRef.current) {
                   try {
                       await new Promise(resolve => setTimeout(resolve, 10));
                       base64Source = await engineRef.current.encodeAudioBuffer(buffer);
                   } catch (e) {}
               }
               presetTracks.push({ ...rest, base64Source });
          }
          const preset: Preset = { name: "User Preset", masterVolume, tracks: presetTracks };
          const blob = new Blob([JSON.stringify(preset)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) { alert("Failed to save preset."); } finally { setIsLoading(false); }
  };

  const loadPreset = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !engineRef.current) return;
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const preset = JSON.parse(ev.target?.result as string) as Preset;
              setMasterVolume(preset.masterVolume);
              engineRef.current?.updateMasterVolume(preset.masterVolume);
              const newTracks: TrackData[] = [];
              for (let i = 0; i < 8; i++) {
                  const tData = preset.tracks[i];
                  const base = createDefaultTrack(i);
                  const merged: TrackData = { ...base, ...tData, isPlaying: false, id: i };
                  if (merged.feedbackTargetId === undefined) merged.feedbackTargetId = (i + 1) % 8;
                  if (tData.base64Source) {
                      try {
                          const binaryString = atob(tData.base64Source);
                          const len = binaryString.length;
                          const bytes = new Uint8Array(len);
                          for (let k = 0; k < len; k++) bytes[k] = binaryString.charCodeAt(k);
                          merged.buffer = await engineRef.current!.decodeAudioData(bytes.buffer);
                          merged.base64Source = undefined; 
                      } catch(e) {}
                  }
                  engineRef.current!.initTrack(merged);
                  engineRef.current!.updateTrackParams(merged, preset.masterVolume, false, null);
                  newTracks.push(merged);
              }
              setTracks(newTracks);
          } catch (err) { alert("Could not load preset."); } finally { setIsLoading(false); }
      };
      reader.readAsText(file);
  };

  const formatTime = (s: number) => {
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden">
      
      <MainMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)}
        geminiKey={geminiKey}
        openaiKey={openaiKey}
        openaiBaseUrl={openaiBaseUrl}
        openaiModel={openaiModel}
        provider={aiProvider}
        onSaveSettings={handleSaveSettings}
      />

      <AiAssistant 
         onMorph={handleAiMorph} 
         onLoadSample={handleAiSampleLoad}
         engine={audioEngine}
         tracks={tracks}
         geminiKey={geminiKey}
         openaiKey={openaiKey}
         provider={aiProvider}
         // Pass through the configured URL/Model to AiAssistant (which passes to Service)
         openaiBaseUrl={openaiBaseUrl}
         openaiModel={openaiModel}
      />

      {isLoading && (
          <div className="absolute inset-0 z-50 bg-slate-900/80 flex items-center justify-center flex-col gap-4 backdrop-blur-sm">
              <Loader className="animate-spin text-cyan-400" size={48} />
              <div className="text-cyan-400 font-mono animate-pulse">PROCESSING DATA...</div>
          </div>
      )}

      <header className={`
          border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shadow-xl z-10 shrink-0 transition-all duration-300
          ${isStudioMode ? 'h-12' : 'h-20'}
      `}>
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsMenuOpen(true)}
                className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:text-cyan-400 transition-colors"
                title="Settings & Help"
            >
                <Menu size={20} />
            </button>

            <button 
                onClick={() => setIsStudioMode(!isStudioMode)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 transition-colors"
                title={isStudioMode ? "Maximize UI" : "Compact Studio Mode"}
            >
                {isStudioMode ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>

            {!isStudioMode && (
                <>
                <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center shadow-glow ml-2">
                    <Waves className="text-slate-900" />
                </div>
                <div>
                    <h1 className="font-bold text-xl tracking-wider text-white">AETHER<span className="font-light text-cyan-400">LOOP</span></h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                        ALGORITHMIC SOUNDSCAPE ENGINE <span className="text-slate-400">by JEROEN SPARLA</span>
                    </p>
                </div>
                </>
            )}
        </div>

        <div className={`flex-1 max-w-2xl mx-4 hidden md:block relative group transition-all ${isStudioMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <Visualizer analyser={engineRef.current?.analyser || null} isPlaying={tracks.some(t => t.isPlaying)} />
            {!tracks.some(t => t.buffer) && (
                 <button 
                 onClick={handleDemoLoad}
                 className="absolute inset-0 m-auto w-32 h-10 bg-cyan-600/20 border border-cyan-500/50 text-cyan-400 rounded uppercase text-xs tracking-widest hover:bg-cyan-500 hover:text-slate-900 transition-all shadow-glow"
               >
                 Load Demo Kit
               </button>
            )}
        </div>

        <div className="flex items-center gap-6">
             <div className="flex flex-col items-center">
                <span className={`text-xs font-mono ${audioState === AudioState.RECORDING ? 'text-red-500 animate-pulse' : 'text-slate-600'}`}>
                    {audioState === AudioState.RECORDING ? formatTime(recorderTime) : '0:00'}
                </span>
                <div className="flex gap-2 mt-1">
                    <button 
                        onClick={handleReset}
                        className={`rounded-full flex items-center justify-center border bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 active:scale-90 transition-transform ${isStudioMode ? 'w-8 h-8' : 'w-10 h-10'}`}
                        title="Reset All"
                    >
                        <RotateCcw size={12} />
                    </button>
                    <button 
                        onClick={() => {
                            tracks.forEach(t => engineRef.current?.stopTrack(t.id));
                            setTracks(prev => prev.map(t => ({ ...t, isPlaying: false })));
                            setAudioState(AudioState.STOPPED);
                        }}
                        className={`rounded-full flex items-center justify-center border bg-slate-800 border-slate-700 text-slate-400 hover:text-red-400 ${isStudioMode ? 'w-8 h-8' : 'w-10 h-10'}`}
                        title="Panic / Stop All"
                    >
                        <Square fill="currentColor" size={12} />
                    </button>
                    <button 
                        onClick={toggleGlobalPlay}
                        className={`rounded-full flex items-center justify-center border transition-all ${isStudioMode ? 'w-8 h-8' : 'w-10 h-10'}
                            ${audioState !== AudioState.STOPPED 
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-glow' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                            }`}
                         title="Play All"
                    >
                        <Play fill="currentColor" size={16} className="ml-0.5"/>
                    </button>
                    <button 
                        onClick={toggleRecord}
                        className={`rounded-full flex items-center justify-center border transition-all ${isStudioMode ? 'w-8 h-8' : 'w-10 h-10'}
                            ${audioState === AudioState.RECORDING
                                ? 'bg-red-500 text-white border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-900'
                            }`}
                        title="Record Output"
                    >
                         <Mic size={16} />
                    </button>
                </div>
             </div>
             
             <div className="h-10 w-px bg-slate-800 mx-2"></div>

             <Knob 
                label="MASTER" 
                value={masterVolume} 
                min={0} max={1} 
                onChange={handleMasterVolume}
                size={isStudioMode ? 40 : 56}
                color="#fff"
             />
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto pb-12">
            {tracks.map(track => (
                <TrackStrip 
                    key={track.id} 
                    track={track} 
                    allTracks={tracks}
                    onUpdate={updateTrack} 
                    onLoadFile={handleLoadFile}
                    onCopyTrack={handleCopyTrack}
                />
            ))}
        </div>
      </main>

      {!isStudioMode && (
        <footer className="h-12 border-t border-slate-800 bg-slate-950 flex items-center justify-between px-6 text-xs text-slate-500 shrink-0 z-10">
            <div className="flex gap-4">
                <button onClick={savePreset} className="flex items-center gap-1 hover:text-cyan-400 transition-colors">
                    <Save size={14} /> Save Preset (Incl. Audio)
                </button>
                <button onClick={() => presetInputRef.current?.click()} className="flex items-center gap-1 hover:text-cyan-400 transition-colors">
                    <FolderOpen size={14} /> Load Preset
                </button>
                <input ref={presetInputRef} type="file" accept=".json" className="hidden" onChange={loadPreset} />
            </div>
            <div>
                Aether Loop v2.0
            </div>
        </footer>
      )}
    </div>
  );
};

export default App;
