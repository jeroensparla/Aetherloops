
export interface LFOConfig {
  enabled: boolean;
  rate: number; // Hz
  depth: number; // 0.0 to 1.0
}

export interface TrackData {
  id: number;
  name: string;
  file: File | null;
  buffer: AudioBuffer | null;
  base64Source?: string; // Used for saving presets with audio
  
  // Transport
  isPlaying: boolean;
  isMuted: boolean;
  isSolo: boolean;
  
  // Main Params
  volume: number; // 0.0 to 1.0
  pan: number; // -1.0 to 1.0
  playbackRate: number; // 0.5 to 2.0
  
  // EQ (New: 3-Band)
  // Values are gains in dB usually, but here we map 0.0-1.0 to -40dB to +10dB
  eqLow: number; 
  eqMid: number; 
  eqHigh: number; 
  
  // 3 Independent LFOs
  lfoVol: LFOConfig;
  lfoPan: LFOConfig;
  lfoPitch: LFOConfig;
  
  // Advanced
  driftEnabled: boolean; // Slow random volume modulation
  linkNext: boolean; // Crossfade with next track
  crossfadeSpeed: number; // Hz (frequency of crossfade cycle)
  reverbSend: number; // 0.0 to 1.0
  
  // New Ecosystem Features
  granularSpray: number; // 0.0 to 1.0 (Jitter intensity for granular feel)
  feedbackSend: number; // 0.0 to 1.0 (Amount of signal sent to modulate Target Track)
  feedbackTargetId: number; // ID of the track to modulate. -1 means OFF.
}

export interface Preset {
  name: string;
  tracks: Partial<TrackData>[];
  masterVolume: number;
}

export enum AudioState {
  STOPPED,
  PLAYING,
  RECORDING
}

export type AiProvider = 'GEMINI' | 'OPENAI';
