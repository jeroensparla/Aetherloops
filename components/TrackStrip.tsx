import React, { useRef, useState, useEffect } from 'react';
import { TrackData, LFOConfig } from '../types';
import Knob from './Knob';
import { FileAudio, Activity, Wind, Play, Square, Link, Copy, Zap, Waves, ArrowRight, XCircle } from 'lucide-react';

interface TrackStripProps {
  track: TrackData;
  allTracks: TrackData[];
  onUpdate: (id: number, changes: Partial<TrackData>) => void;
  onLoadFile: (id: number, file: File) => void;
  onCopyTrack: (sourceId: number, targetId: number) => void;
}

type LfoTab = 'VOL' | 'PAN' | 'PITCH';

const TrackStrip: React.FC<TrackStripProps> = ({ track, allTracks, onUpdate, onLoadFile, onCopyTrack }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const crossfadeRef = useRef<HTMLDivElement>(null);
  
  const [activeLfoTab, setActiveLfoTab] = useState<LfoTab>('VOL');
  const [modOffsets, setModOffsets] = useState({ pan: 0, vol: 0, pitch: 0, eqMid: 0 });
  
  // Refs to hold mutable values without triggering re-renders
  const lastTimeRef = useRef<number>(0);
  const phaseRef = useRef({ vol: 0, pan: 0, pitch: 0, fade: 0, feedbackNoise: 0, playTime: 0 });
  
  // Ref to store latest calculated mods so the throttled UI loop can read them
  const currentModsRef = useRef({ pan: 0, vol: 0, pitch: 0, eqMid: 0 });

  // Keep a ref to allTracks to access latest data in animation loop without restarting the effect
  const latestTracksRef = useRef(allTracks);
  useEffect(() => {
      latestTracksRef.current = allTracks;
  }, [allTracks]);

  // --- LOOP 1: Crossfade Animation (Pure DOM, High Performance, Independent) ---
  useEffect(() => {
      if (!track.linkNext || track.id % 2 !== 0) return;

      let frameId: number;
      let lastTime = 0;

      const animateCrossfade = (time: number) => {
          if (lastTime === 0) lastTime = time;
          const delta = (time - lastTime) / 1000;
          lastTime = time;
          const safeDelta = Math.min(delta, 0.1);

          phaseRef.current.fade += safeDelta * track.crossfadeSpeed;
          const phase = (Math.sin(phaseRef.current.fade * 2 * Math.PI) + 1) / 2;
            
          if (crossfadeRef.current) {
               crossfadeRef.current.style.top = `${phase * 80}%`;
          }
          
          frameId = requestAnimationFrame(animateCrossfade);
      };

      frameId = requestAnimationFrame(animateCrossfade);
      return () => cancelAnimationFrame(frameId);
  }, [track.linkNext, track.id, track.crossfadeSpeed]); 
  // Only restarts if crossfade settings change. Independent of isPlaying.


  // --- LOOP 2: Audio Visualization & LFO Calc (Pure DOM for Progress, Ref Update for Mods) ---
  useEffect(() => {
    if (!track.isPlaying) {
         // Reset Progress Bar when stopped
         if (progressRef.current) progressRef.current.style.width = '0%';
         phaseRef.current.playTime = 0;
         
         // Reset Mods visual
         setModOffsets({ pan: 0, vol: 0, pitch: 0, eqMid: 0 });
         return;
    }

    let frameId: number;
    let lastTime = 0;

    const animateAudio = (time: number) => {
        if (lastTime === 0) lastTime = time;
        const delta = (time - lastTime) / 1000;
        lastTime = time;
        const safeDelta = Math.min(delta, 0.1);

        // 1. Calculate LFOs (Math only)
        let p = 0, v = 0, pi = 0, em = 0;

        if (track.lfoPan.enabled) {
            phaseRef.current.pan += safeDelta * track.lfoPan.rate;
            p = Math.sin(phaseRef.current.pan * 2 * Math.PI) * track.lfoPan.depth;
        }
        if (track.lfoVol.enabled) {
            phaseRef.current.vol += safeDelta * track.lfoVol.rate;
            v = Math.sin(phaseRef.current.vol * 2 * Math.PI) * track.lfoVol.depth;
        }
        if (track.lfoPitch.enabled) {
            phaseRef.current.pitch += safeDelta * track.lfoPitch.rate;
            pi = Math.sin(phaseRef.current.pitch * 2 * Math.PI) * track.lfoPitch.depth;
        }

        // 2. Calculate Feedback/FM
        const currentAllTracks = latestTracksRef.current;
        const modulators = currentAllTracks.filter(t => {
            const tTarget = t.feedbackTargetId !== undefined ? t.feedbackTargetId : (t.id + 1) % 8;
            return tTarget === track.id && tTarget !== -1 && t.isPlaying && t.feedbackSend > 0.01;
        });
        
        if (modulators.length > 0) {
            const totalFeed = modulators.reduce((acc, curr) => acc + curr.feedbackSend, 0);
            
            // EQ Jitter
            phaseRef.current.feedbackNoise += safeDelta * (10 + totalFeed * 20);
            const noise = Math.sin(phaseRef.current.feedbackNoise) * Math.cos(phaseRef.current.feedbackNoise * 2.5);
            em = noise * Math.min(1.0, totalFeed) * 0.8; 
            
            // FM Jitter
            const fmModulators = modulators.filter(t => t.feedbackSend > 0.5);
            if (fmModulators.length > 0) {
                    const fmAmt = fmModulators.reduce((acc, t) => acc + (t.feedbackSend - 0.5), 0) * 2.0; 
                    pi += (Math.random() - 0.5) * fmAmt * 0.8; 
            }
        }

        // Store for UI Loop
        currentModsRef.current = { pan: p, vol: v, pitch: pi, eqMid: em };

        // 3. Update Progress Bar (Direct DOM - 60fps smooth)
        if (track.buffer) {
            const effectiveRate = Math.max(0, track.playbackRate + (pi * 0.2));
            phaseRef.current.playTime += safeDelta * effectiveRate;
            
            const duration = track.buffer.duration;
            if (duration > 0) {
                const pct = (phaseRef.current.playTime % duration) / duration;
                if (progressRef.current) {
                    progressRef.current.style.width = `${pct * 100}%`;
                }
            }
        }

        frameId = requestAnimationFrame(animateAudio);
    };

    frameId = requestAnimationFrame(animateAudio);
    return () => cancelAnimationFrame(frameId);
  }, [track.isPlaying, track.id, track.lfoPan, track.lfoVol, track.lfoPitch, track.playbackRate, track.buffer]);


  // --- LOOP 3: UI Knob State Sync (Throttled) ---
  // This separates the heavy React State updates from the smooth DOM loops.
  useEffect(() => {
      if (!track.isPlaying) return;

      const interval = setInterval(() => {
          // Sync the Refs to React State for the Knobs
          // We assume Knobs don't need true 60fps to look good, 30fps (33ms) is fine and saves CPU
          setModOffsets({ ...currentModsRef.current });
      }, 33); 

      return () => clearInterval(interval);
  }, [track.isPlaying]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLoadFile(track.id, e.target.files[0]);
    }
  };

  const isEven = track.id % 2 === 0;

  const updateLfoConfig = (type: 'lfoVol' | 'lfoPan' | 'lfoPitch', changes: Partial<LFOConfig>) => {
      onUpdate(track.id, {
          [type]: { ...track[type], ...changes }
      });
  };

  const getCurrentLfoConfig = () => {
      switch (activeLfoTab) {
          case 'VOL': return track.lfoVol;
          case 'PAN': return track.lfoPan;
          case 'PITCH': return track.lfoPitch;
      }
  };

  const updateCurrentLfo = (changes: Partial<LFOConfig>) => {
      switch (activeLfoTab) {
          case 'VOL': updateLfoConfig('lfoVol', changes); break;
          case 'PAN': updateLfoConfig('lfoPan', changes); break;
          case 'PITCH': updateLfoConfig('lfoPitch', changes); break;
      }
  };

  const currentLfo = getCurrentLfoConfig();

  const incomingModulators = allTracks
      .filter(t => {
          const tTarget = t.feedbackTargetId !== undefined ? t.feedbackTargetId : (t.id + 1) % 8;
          return tTarget === track.id && tTarget !== -1 && t.feedbackSend > 0;
      })
      .map(t => (t.id + 1).toString().padStart(2, '0'));

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col gap-3 shadow-lg relative group transition-all hover:border-slate-700">
      
      {/* Background Number Watermark */}
      <div className="absolute -bottom-6 -right-2 text-[90px] font-black text-slate-800/30 pointer-events-none select-none z-0 leading-none tracking-tighter font-mono overflow-hidden">
          {(track.id + 1).toString().padStart(2, '0')}
      </div>

      {/* Bridge Module: Link / Crossfade Handle (Only for Even tracks) */}
      {isEven && (
          <div className="hidden sm:flex absolute -right-4 top-0 bottom-0 z-50 w-5 flex-col items-center justify-center pointer-events-none">
            {/* The Bridge Background - Taller and Narrower */}
            <div className="absolute top-10 bottom-10 left-0 right-0 bg-slate-950/90 border border-slate-700 rounded-full shadow-xl -z-10 pointer-events-auto flex flex-col items-center justify-start pt-3 gap-2">
                
                {/* Connection Lines */}
                {track.linkNext && (
                    <div className="absolute top-4 bottom-4 w-full opacity-30 pointer-events-none">
                         <svg className="w-full h-full" preserveAspectRatio="none">
                             <line x1="50%" y1="0" x2="50%" y2="100%" stroke="cyan" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                         </svg>
                    </div>
                )}

                {/* Link Button - Higher up */}
                <button 
                    onClick={() => onUpdate(track.id, { linkNext: !track.linkNext })}
                    className={`w-4 h-4 rounded-full flex items-center justify-center border shadow-lg transition-all transform pointer-events-auto z-20
                        ${track.linkNext 
                            ? 'bg-cyan-500 border-cyan-400 text-slate-900 scale-110' 
                            : 'bg-slate-800 border-slate-600 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                        }`}
                    title="Link & Crossfade with next track"
                >
                    <Link size={8} className={track.linkNext ? 'rotate-45' : ''} />
                </button>
                
                {/* Crossfade Control Container - Fills remaining height */}
                <div className={`transition-all duration-300 overflow-hidden flex flex-col items-center w-full flex-1 min-h-0 pb-2 ${track.linkNext ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    
                    {/* Knob */}
                    <div className="scale-[0.6] origin-center pointer-events-auto mt-1 shrink-0">
                        <Knob 
                            label=""
                            value={track.crossfadeSpeed}
                            min={0.01} max={2.0}
                            size={24}
                            onChange={(v) => onUpdate(track.id, { crossfadeSpeed: v })}
                            color="#8b5cf6"
                            logarithmic
                        />
                    </div>
                    
                    {/* Visual Fader - Fills remaining vertical space */}
                    <div className="w-1 bg-slate-800 rounded-full mt-2 border border-slate-700 relative flex-1 overflow-hidden">
                         {/* Moving Indicator - Controlled via ref for performance */}
                         <div 
                            ref={crossfadeRef}
                            className="absolute left-0 right-0 h-[20%] bg-gradient-to-b from-cyan-500 to-purple-500 rounded-full shadow-[0_0_5px_rgba(6,182,212,0.5)] will-change-transform"
                            style={{ 
                                top: '0%', // Initial position handled by Ref Loop
                            }}
                         />
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* Header: Play/Load */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-1 relative z-10">
        <div className="flex items-center gap-2">
            {/* Track Number Pill */}
            <div className="text-[11px] font-black font-mono bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800 shadow-inner">
                {(track.id + 1).toString().padStart(2, '0')}
            </div>

            <button 
                onClick={() => onUpdate(track.id, { isPlaying: !track.isPlaying })}
                className={`w-6 h-6 rounded flex items-center justify-center transition-colors
                    ${track.isPlaying 
                        ? 'text-cyan-400 hover:text-cyan-300' 
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
            >
                {track.isPlaying ? <Square size={12} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}
            </button>
            
            <div className="flex flex-col max-w-[70px]">
                <div 
                    className={`text-xs font-bold truncate cursor-default ${track.buffer ? 'text-cyan-100' : 'text-slate-700'}`}
                    title={track.name}
                >
                    {track.name || "Empty"}
                </div>
                
                {/* Progress Bar */}
                <div className="h-0.5 w-full bg-slate-800 mt-0.5 rounded-full overflow-hidden">
                    <div 
                        ref={progressRef}
                        className="h-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.8)] w-0"
                    />
                </div>

                {incomingModulators.length > 0 && (
                     <div className="text-[8px] text-emerald-500 font-mono animate-pulse mt-0.5">
                        FM &lt; {incomingModulators.join(', ')}
                     </div>
                )}
            </div>
        </div>
        <div className="flex gap-1 items-center">
            <div className="relative group/copy">
                <button className="text-slate-600 hover:text-white transition-colors p-1" title="Copy Sample To...">
                   <Copy size={12} />
                </button>
                <select
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value=""
                    onChange={(e) => {
                        const targetId = Number(e.target.value);
                        onCopyTrack(track.id, targetId);
                    }}
                >
                    <option value="" disabled>Copy to...</option>
                    {allTracks.map(t => (
                        <option key={t.id} value={t.id} disabled={t.id === track.id} className="bg-slate-900 text-slate-200">
                            Track {t.id + 1} {t.name ? `(${t.name})` : ''}
                        </option>
                    ))}
                </select>
            </div>

            <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-600 hover:text-white transition-colors p-1"
                title="Load Sample"
            >
                <FileAudio size={14} />
            </button>
        </div>
        <input 
            ref={fileInputRef} 
            type="file" 
            accept="audio/*" 
            className="hidden" 
            onChange={handleFileChange}
        />
      </div>

      {/* Main Knobs */}
      <div className="flex justify-between items-end py-2 relative z-10">
        <Knob 
            label="VOL" 
            value={track.volume} 
            modulation={modOffsets.vol}
            min={0} max={1} 
            onChange={(v) => onUpdate(track.id, { volume: v })} 
        />
        <Knob 
            label="PAN" 
            value={track.pan} 
            modulation={modOffsets.pan}
            min={-1} max={1} 
            bipolar 
            onChange={(v) => onUpdate(track.id, { pan: v })} 
            color="#f59e0b" 
        />
        <Knob 
            label="SPEED" 
            value={track.playbackRate} 
            modulation={modOffsets.pitch}
            min={0.1} max={2.0} 
            onChange={(v) => onUpdate(track.id, { playbackRate: v })} 
            color="#a855f7" 
        />
      </div>

      {/* 3-Band EQ Section */}
      <div className="flex items-center justify-between gap-2 px-1 pb-2 mb-1 border-b border-slate-800/50 relative z-10">
         <div className="text-[8px] font-bold text-slate-500 writing-mode-vertical -rotate-180">EQ</div>
         <div className="flex gap-3 flex-1 justify-around">
            <Knob 
                label="LOW" 
                value={track.eqLow} 
                min={0} max={1} 
                onChange={(v) => onUpdate(track.id, { eqLow: v })}
                color="#ef4444"
                size={32}
            />
            <Knob 
                label="MID" 
                value={track.eqMid} 
                modulation={modOffsets.eqMid}
                min={0} max={1} 
                onChange={(v) => onUpdate(track.id, { eqMid: v })}
                color="#10b981"
                size={32}
            />
            <Knob 
                label="HIGH" 
                value={track.eqHigh} 
                min={0} max={1} 
                onChange={(v) => onUpdate(track.id, { eqHigh: v })}
                color="#3b82f6"
                size={32}
            />
         </div>
      </div>

      {/* Multi-LFO Section */}
      <div className="rounded border border-slate-800 bg-slate-950/50 p-1.5 mt-1 relative z-10">
          <div className="flex gap-1 mb-2">
              {(['VOL', 'PAN', 'PITCH'] as LfoTab[]).map(tab => {
                  let isActive = activeLfoTab === tab;
                  let isEnabled = false;
                  if (tab === 'VOL') isEnabled = track.lfoVol.enabled;
                  if (tab === 'PAN') isEnabled = track.lfoPan.enabled;
                  if (tab === 'PITCH') isEnabled = track.lfoPitch.enabled;

                  return (
                    <button
                        key={tab}
                        onClick={() => setActiveLfoTab(tab)}
                        className={`flex-1 text-[9px] font-bold py-1 rounded transition-all
                            ${isActive 
                                ? 'bg-slate-700 text-white shadow-sm' 
                                : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                            }
                            ${isEnabled && !isActive ? 'text-cyan-500' : ''}
                        `}
                    >
                        {tab}
                        {isEnabled && <span className="ml-1 text-cyan-400">•</span>}
                    </button>
                  );
              })}
          </div>

          <div className="flex items-center justify-between px-1">
              <button 
                onClick={() => updateCurrentLfo({ enabled: !currentLfo.enabled })}
                className={`w-6 h-6 rounded flex items-center justify-center border transition-colors
                    ${currentLfo.enabled 
                        ? 'bg-cyan-500 border-cyan-400 text-slate-900' 
                        : 'bg-slate-800 border-slate-700 text-slate-600'
                    }`}
                title="Toggle LFO"
              >
                  <Activity size={12} />
              </button>

              <div className={`flex gap-2 transition-opacity ${currentLfo.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <Knob 
                    label="RATE" 
                    value={currentLfo.rate} 
                    min={0.01} max={4.0} 
                    onChange={(v) => updateCurrentLfo({ rate: v })}
                    size={32}
                    color="#22d3ee"
                    logarithmic={true}
                  />
                  <Knob 
                    label="DEPTH" 
                    value={currentLfo.depth} 
                    min={0} max={1.0} 
                    onChange={(v) => updateCurrentLfo({ depth: v })}
                    size={32}
                    color="#22d3ee"
                  />
              </div>
          </div>
      </div>

      {/* Effects / Utility Row */}
      <div className="grid grid-cols-2 gap-1 mt-2 bg-slate-900/50 p-1 rounded border border-slate-800/50 relative z-10">
         {/* Granular Spray */}
         <div className="flex flex-col items-center justify-center border-r border-slate-800 pr-1">
            <div className="flex items-center gap-1 mb-1">
                <Wind size={10} className="text-slate-500" />
                <span className="text-[9px] text-slate-500 font-bold">GRAIN</span>
            </div>
            <Knob 
                label="" 
                value={track.granularSpray || 0} 
                min={0} max={1} 
                size={28}
                onChange={(v) => onUpdate(track.id, { granularSpray: v })}
                color="#94a3b8"
            />
         </div>
         
         {/* Feedback / Modulation Section */}
         <div className="flex flex-col items-center justify-center pl-1">
            <div className="flex items-center gap-1 mb-1 w-full justify-center relative">
                <Waves size={10} className="text-slate-500" />
                <span className="text-[9px] text-slate-500 font-bold mr-1">FEED</span>
                
                {/* Target Selector Dropdown */}
                <div className="absolute right-0 -top-0.5">
                     <div className="relative group/target">
                        <div className={`flex items-center gap-0.5 text-[8px] px-1 rounded border cursor-pointer transition-colors
                             ${(track.feedbackTargetId === -1) 
                                ? 'bg-slate-900 border-slate-800 text-slate-500'
                                : 'bg-slate-800 border-slate-700 text-cyan-500 hover:text-cyan-300'
                             }
                        `}>
                            {(track.feedbackTargetId !== undefined && track.feedbackTargetId !== -1) 
                                ? <ArrowRight size={8} />
                                : <XCircle size={8} />
                            }
                            <span>
                                {(track.feedbackTargetId !== undefined && track.feedbackTargetId !== -1) 
                                    ? (track.feedbackTargetId + 1).toString().padStart(2, '0') 
                                    : 'OFF'
                                }
                            </span>
                        </div>
                        <select
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            value={track.feedbackTargetId !== undefined ? track.feedbackTargetId : (track.id + 1) % 8}
                            onChange={(e) => onUpdate(track.id, { feedbackTargetId: Number(e.target.value) })}
                        >
                            <option value={-1} className="bg-slate-950 text-slate-400 font-bold">OFF (Disconnect)</option>
                            {allTracks.map(t => (
                                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                                    To Track {(t.id + 1).toString().padStart(2, '0')} {t.name ? `(${t.name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            <Knob 
                label="" 
                value={track.feedbackSend || 0} 
                min={0} max={1} 
                size={28}
                onChange={(v) => onUpdate(track.id, { feedbackSend: v })}
                color="#10b981"
            />
         </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex justify-between items-center mt-2 gap-2 relative z-10">
         <button 
            onClick={() => onUpdate(track.id, { driftEnabled: !track.driftEnabled })}
            className={`flex-1 flex items-center justify-center gap-1 text-[9px] p-1 rounded border transition-all
                ${track.driftEnabled 
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400' 
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-800'
                }`}
            title="Slow random pitch drift"
        >
            <Zap size={10} /> DRIFT
        </button>
        
        <div className="flex items-center justify-center scale-90 origin-right">
            <Knob 
                label="REVERB"
                size={24}
                value={track.reverbSend}
                min={0} max={1}
                onChange={(v) => onUpdate(track.id, { reverbSend: v })}
                color="#ec4899"
            />
        </div>
      </div>

      {/* Mixer Mute/Solo */}
      <div className="flex gap-1 mt-auto pt-2 border-t border-slate-800/50 relative z-10">
        <button 
            onClick={() => {
                if (!track.isMuted) {
                    onUpdate(track.id, { isMuted: true, isSolo: false });
                } else {
                    onUpdate(track.id, { isMuted: false });
                }
            }}
            className={`flex-1 text-[10px] font-bold py-1 rounded border transition-colors
                ${track.isMuted 
                    ? 'bg-red-500 text-white border-red-600' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
        >
            MUTE
        </button>
        <button 
            onClick={() => {
                if (!track.isSolo) {
                    onUpdate(track.id, { isSolo: true, isMuted: false });
                } else {
                    onUpdate(track.id, { isSolo: false });
                }
            }}
            className={`flex-1 text-[10px] font-bold py-1 rounded border transition-colors
                ${track.isSolo 
                    ? 'bg-yellow-400 text-black border-yellow-500' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
        >
            SOLO
        </button>
      </div>

      {/* Active Indicator */}
      {track.isPlaying && !track.isMuted && (
        <div className="absolute top-2 right-2 animate-pulse z-20">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-glow"></div>
        </div>
      )}
    </div>
  );
};

export default TrackStrip;