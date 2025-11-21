
import { TrackData, LFOConfig } from '../types';

interface TrackNodes {
    source: AudioBufferSourceNode | null;
    
    // Signal Chain
    tremoloGain: GainNode; // LFO Vol
    
    // 3-Band EQ
    eqLow: BiquadFilterNode;
    eqMid: BiquadFilterNode;
    eqHigh: BiquadFilterNode;
    
    panner: StereoPannerNode;
    
    // Stages
    volGain: GainNode; // Main Volume + Drift
    fadeGain: GainNode; // Crossfade Modulation
    muteGain: GainNode; // Hard Mute/Solo Gate (The silencer)
    
    // LFOs
    lfoVol: OscillatorNode | null;
    lfoVolGain: GainNode | null;
    
    lfoPan: OscillatorNode | null;
    lfoPanGain: GainNode | null;
    
    lfoPitch: OscillatorNode | null;
    lfoPitchGain: GainNode | null;

    // Drift
    driftLfo: OscillatorNode | null;
    driftGain: GainNode | null;

    // Crossfade
    fadeOsc: OscillatorNode | null;
    fadeGainOsc: GainNode | null; // The gain node controlling the depth of the fade osc

    // FX
    reverbSend: GainNode;
    
    // Granular Spray (Noise Modulation)
    sprayGain: GainNode;
    
    // Feedback Loop (Output -> Next Track Control)
    feedbackGain: GainNode;
    feedbackFMGain: GainNode; // For FM Synthesis (Pitch Modulation)
}

export class AudioEngine {
  public context: AudioContext;
  public masterGain: GainNode;
  public compressor: DynamicsCompressorNode;
  public analyser: AnalyserNode;
  public dest: MediaStreamAudioDestinationNode;
  
  // Global FX
  private reverbConvolver: ConvolverNode;
  private reverbGain: GainNode;
  
  // Global Sources
  private noiseBuffer: AudioBuffer; // For Granular Spray
  private noiseSource: AudioBufferSourceNode | null = null;

  // Track Nodes Map
  private tracks: Map<number, TrackNodes> = new Map();

  constructor() {
    this.context = new (window.AudioContext || (window as any).webkitAudioContext)({ 
      latencyHint: 'playback',
      sampleRate: 44100 
    });
    
    this.masterGain = this.context.createGain();
    
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -16; 
    this.compressor.knee.value = 30; 
    this.compressor.ratio.value = 12; 
    this.compressor.attack.value = 0.05;
    this.compressor.release.value = 0.25;

    this.analyser = this.context.createAnalyser();
    this.dest = this.context.createMediaStreamDestination();
    
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.85;

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.analyser.connect(this.dest); 

    this.reverbGain = this.context.createGain();
    this.reverbConvolver = this.context.createConvolver();
    this.createImpulseResponse(); 
    
    this.reverbGain.connect(this.masterGain);
    this.reverbConvolver.connect(this.reverbGain);
    
    // Generate Brown Noise for Granular Spray
    this.noiseBuffer = this.createNoiseBuffer();
    this.startGlobalNoise();
  }
  
  private createNoiseBuffer(): AudioBuffer {
      const bufferSize = this.context.sampleRate * 2; // 2 seconds
      const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          // Brown noise filter
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5; // Compensate gain
      }
      return buffer;
  }
  
  private startGlobalNoise() {
      this.noiseSource = this.context.createBufferSource();
      this.noiseSource.buffer = this.noiseBuffer;
      this.noiseSource.loop = true;
      this.noiseSource.start();
  }

  private createImpulseResponse() {
    const rate = this.context.sampleRate;
    const length = rate * 4.0; 
    const decay = 3.0;
    const impulse = this.context.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i; 
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    this.reverbConvolver.buffer = impulse;
  }

  public async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  public async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return await this.context.decodeAudioData(arrayBuffer);
  }

  // --- Helper: Decode Raw PCM (Int16) from Gemini API to AudioBuffer ---
  public createBufferFromRawPCM(pcmData: Uint8Array, sampleRate: number = 24000): AudioBuffer {
    const dataInt16 = new Int16Array(pcmData.buffer);
    const numChannels = 1;
    const frameCount = dataInt16.length;
    const buffer = this.context.createBuffer(numChannels, frameCount, sampleRate);
    
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        // Normalize Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }

  // --- Helper: Decode Base64 to Uint8Array ---
  public base64ToUint8Array(base64: string): Uint8Array {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
  }

  // --- Helper: Async Encode AudioBuffer to Base64 WAV (Prevents UI Freezing) ---
  public async encodeAudioBuffer(buffer: AudioBuffer): Promise<string> {
    const wavData = this.audioBufferToWav(buffer);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
  }

  /**
   * Analyzes an AudioBuffer to extract lightweight features for AI Context.
   * Replaces sending heavy Base64 WAV files.
   * Calculates RMS (Volume) and Zero Crossing Rate (Spectral Brightness/Frequency).
   */
  public getAudioFeatures(buffer: AudioBuffer): { loudness: string, brightness: string, texture: string } {
    const data = buffer.getChannelData(0);
    const len = data.length;
    const step = 100; // Downsample for performance (we don't need sample-perfect accuracy for this)
    
    // 1. Calculate RMS (Root Mean Square) - "Loudness"
    let sumSq = 0;
    let count = 0;
    for(let i = 0; i < len; i += step) {
        const val = data[i];
        sumSq += val * val;
        count++;
    }
    const rms = Math.sqrt(sumSq / count);

    // 2. Calculate Zero Crossing Rate (ZCR) - "Brightness / Pitch"
    // A high ZCR means the wave changes direction often (High frequency or Noise)
    // A low ZCR means long waves (Bass or Drone)
    let crossings = 0;
    for(let i = 0; i < len - step; i += step) {
        const current = data[i];
        const next = data[i + step];
        if ((current > 0 && next < 0) || (current < 0 && next > 0)) {
            crossings++;
        }
    }
    const zcr = crossings / count;

    // 3. Interpret Results into English for the LLM
    let loudness = "Moderate";
    if (rms < 0.05) loudness = "Silent/Background";
    else if (rms < 0.15) loudness = "Quiet";
    else if (rms > 0.4) loudness = "Loud";

    let brightness = "Mid-Range";
    let texture = "Tonal";
    
    if (zcr < 0.02) {
        brightness = "Dark/Bass";
        texture = "Drone";
    } else if (zcr > 0.15) {
        brightness = "Bright/High";
        texture = "Noisy/Hats";
    }

    return { loudness, brightness, texture };
  }

  public audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let result: Float32Array;
    if (numChannels === 2) {
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        result = new Float32Array(left.length + right.length);
        for (let i = 0; i < left.length; i++) {
            result[i * 2] = left[i];
            result[i * 2 + 1] = right[i];
        }
    } else {
        result = buffer.getChannelData(0);
    }

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const bufferLength = 44 + result.length * bytesPerSample;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + result.length * bytesPerSample, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, result.length * bytesPerSample, true);

    let offset = 44;
    for (let i = 0; i < result.length; i++) {
        const s = Math.max(-1, Math.min(1, result[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }

    return arrayBuffer;
  }

  public initTrack(track: TrackData) {
    if (this.tracks.has(track.id)) return; 

    // Graph: Source -> Tremolo -> EQ -> Panner -> Vol -> Fade -> Mute -> Master
    
    const tremoloGain = this.context.createGain();
    
    const eqLow = this.context.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 200; 

    const eqMid = this.context.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 2500; 
    eqMid.Q.value = 1.0; 

    const eqHigh = this.context.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 8000; 

    const panner = this.context.createStereoPanner();
    const volGain = this.context.createGain(); 
    const fadeGain = this.context.createGain(); 
    const muteGain = this.context.createGain();
    
    const reverbSend = this.context.createGain();
    const sprayGain = this.context.createGain(); // Connects Noise -> PlaybackRate
    
    // Feedback Loop: Signal comes from volGain
    const feedbackGain = this.context.createGain();
    feedbackGain.gain.value = 0;
    
    const feedbackFMGain = this.context.createGain();
    feedbackFMGain.gain.value = 0;

    // Connections
    tremoloGain.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(panner);
    
    panner.connect(volGain);
    volGain.connect(fadeGain);
    fadeGain.connect(muteGain);
    muteGain.connect(this.masterGain);
    
    // Ecosystem: Connect VolGain to Feedback Sends
    volGain.connect(feedbackGain);
    volGain.connect(feedbackFMGain);
    
    // Reverb
    muteGain.connect(reverbSend); 
    reverbSend.connect(this.reverbConvolver);
    
    // Connect Global Noise to Spray Gain (but sprayGain not connected to source yet)
    if (this.noiseSource) {
        this.noiseSource.connect(sprayGain);
    }

    // Init Values
    volGain.gain.value = track.volume;
    muteGain.gain.value = (track.isMuted) ? 0 : 1; 
    panner.pan.value = track.pan;
    reverbSend.gain.value = track.reverbSend;
    
    this.tracks.set(track.id, {
      source: null,
      tremoloGain,
      eqLow, eqMid, eqHigh,
      volGain, fadeGain, muteGain,
      panner, reverbSend,
      sprayGain, feedbackGain, feedbackFMGain,
      
      lfoVol: null, lfoVolGain: null,
      lfoPan: null, lfoPanGain: null,
      lfoPitch: null, lfoPitchGain: null,
      
      driftLfo: null, driftGain: null,
      fadeOsc: null, fadeGainOsc: null
    });

    this.updateTrackLFOs(track);
    this.updateTrackDrift(track);
    this.updateTrackEQ(track);
  }

  public reset() {
    this.tracks.forEach((nodes, id) => {
        this.stopTrack(id);
        
        const killOsc = (osc: OscillatorNode | null) => {
            if(osc) {
                try { osc.stop(); } catch(e) {}
                try { osc.disconnect(); } catch(e) {}
            }
        };
        killOsc(nodes.lfoVol); nodes.lfoVol = null;
        killOsc(nodes.lfoPan); nodes.lfoPan = null;
        killOsc(nodes.lfoPitch); nodes.lfoPitch = null;
        killOsc(nodes.driftLfo); nodes.driftLfo = null;
        killOsc(nodes.fadeOsc); nodes.fadeOsc = null;
        
        // Reset Gains
        const now = this.context.currentTime;
        const resetParam = (p: AudioParam, v: number) => {
            p.cancelScheduledValues(now);
            p.value = v;
        };
        
        if (nodes.volGain) resetParam(nodes.volGain.gain, 0.6);
        if (nodes.muteGain) resetParam(nodes.muteGain.gain, 1.0);
        if (nodes.fadeGain) resetParam(nodes.fadeGain.gain, 1.0);
        if (nodes.panner) resetParam(nodes.panner.pan, 0);
        if (nodes.reverbSend) resetParam(nodes.reverbSend.gain, 0.2);
        if (nodes.sprayGain) resetParam(nodes.sprayGain.gain, 0);
        if (nodes.feedbackGain) resetParam(nodes.feedbackGain.gain, 0);
        if (nodes.feedbackFMGain) resetParam(nodes.feedbackFMGain.gain, 0);
    });
    
    this.updateMasterVolume(0.8);
    
    // Ensure noise is running
    if (!this.noiseSource) this.startGlobalNoise();
  }

  public playTrack(track: TrackData) {
    this.resume();
    const nodes = this.tracks.get(track.id);
    if (!nodes || !track.buffer) return;

    if (nodes.source) return; 

    const source = this.context.createBufferSource();
    source.buffer = track.buffer;
    source.loop = true; 
    source.playbackRate.value = track.playbackRate;
    
    const now = this.context.currentTime;
    nodes.muteGain.gain.cancelScheduledValues(now);
    
    const isSilent = track.isMuted;
    nodes.muteGain.gain.setValueAtTime(isSilent ? 0 : 1, now);

    source.connect(nodes.tremoloGain); 
    source.start(0);
    nodes.source = source;

    // Connect Pitch LFO
    if (track.lfoPitch.enabled && nodes.lfoPitchGain) {
        nodes.lfoPitchGain.connect(source.playbackRate);
    }
    
    // Connect Granular Spray (Noise -> PlaybackRate)
    nodes.sprayGain.connect(source.playbackRate);
  }

  public stopTrack(trackId: number) {
    const nodes = this.tracks.get(trackId);
    if (nodes && nodes.source) {
      try {
        const now = this.context.currentTime;
        nodes.muteGain.gain.cancelScheduledValues(now);
        nodes.muteGain.gain.setTargetAtTime(0, now, 0.05);
        
        // Disconnect spray to prevent lingering connections to dead nodes
        nodes.sprayGain.disconnect();
        if (this.noiseSource) this.noiseSource.connect(nodes.sprayGain);

        const oldSource = nodes.source;
        nodes.source = null; 

        setTimeout(() => {
            try {
                oldSource.stop();
                oldSource.disconnect();
            } catch(e) {}
        }, 100);
      } catch (e) {}
    }
  }

  public updateTrackParams(track: TrackData, masterVolume: number, soloActive: boolean, soloTrackId: number | null) {
    const nodes = this.tracks.get(track.id);
    if (!nodes) return;

    // 1. Transport
    if (track.isPlaying && !nodes.source && track.buffer) {
        this.playTrack(track);
    } else if (!track.isPlaying && nodes.source) {
        this.stopTrack(track.id);
    }

    // 2. Volume + Mute
    nodes.volGain.gain.setTargetAtTime(track.volume, this.context.currentTime, 0.1);

    let isAudible = true;
    if (track.isMuted) isAudible = false;
    if (soloActive && !track.isSolo) isAudible = false;
    nodes.muteGain.gain.setTargetAtTime(isAudible ? 1.0 : 0.0, this.context.currentTime, 0.02);

    // 3. Pan / Pitch
    nodes.panner.pan.setTargetAtTime(track.pan, this.context.currentTime, 0.1);
    if (nodes.source) {
        nodes.source.playbackRate.setTargetAtTime(track.playbackRate, this.context.currentTime, 0.2);
    }
    
    // 4. EQ / FX
    this.updateTrackEQ(track);
    nodes.reverbSend.gain.setTargetAtTime(track.reverbSend, this.context.currentTime, 0.1);
    
    // 5. Modulation
    this.updateTrackLFOs(track);
    this.updateTrackDrift(track);
    
    if (track.id % 2 === 0) {
         this.updateCrossfade(track);
    }

    // 6. Granular Spray (Grain Jitter)
    const sprayAmount = track.granularSpray ? track.granularSpray * 0.8 : 0;
    nodes.sprayGain.gain.setTargetAtTime(sprayAmount, this.context.currentTime, 0.1);
    
    // 7. Feedback Loop (Ecosystem)
    
    // Disconnect old connections first
    try {
        nodes.feedbackGain.disconnect();
        nodes.feedbackFMGain.disconnect();
    } catch(e) {}

    // Determine Target: If feedbackTargetId is -1, it means "OFF"
    // Legacy support: If undefined, fallback to ring ((id+1)%8)
    const rawTarget = track.feedbackTargetId;
    const targetId = (rawTarget !== undefined) ? rawTarget : (track.id + 1) % 8;

    if (targetId !== -1) {
        const targetNodes = this.tracks.get(targetId);
        
        if (targetNodes) {
            // Logic: 
            // 0.0 - 0.5: Subtle Modulation of EQ Mid Frequency
            // 0.5 - 1.0: Introduces FM Synthesis (Modulating Playback Rate) for drastic sci-fi tones
            
            // EQ Mid Mod
            const feedbackAmt = track.feedbackSend * 3000; 
            nodes.feedbackGain.gain.setTargetAtTime(feedbackAmt, this.context.currentTime, 0.1);
            
            // FM Mod (Only kicks in heavily after 50%)
            let fmAmt = 0;
            if (track.feedbackSend > 0.5) {
                // Map 0.5-1.0 to 0.0-2.0 playback rate deviation
                fmAmt = (track.feedbackSend - 0.5) * 4.0;
            }
            nodes.feedbackFMGain.gain.setTargetAtTime(fmAmt, this.context.currentTime, 0.1);

            if (track.feedbackSend > 0.01) {
                // Always connect to EQ Mid
                nodes.feedbackGain.connect(targetNodes.eqMid.frequency);
                
                // If high enough, connect to Pitch (FM Synthesis)
                if (fmAmt > 0 && targetNodes.source) {
                   nodes.feedbackFMGain.connect(targetNodes.source.playbackRate);
                }
            }
        }
    } else {
        // Explicitly zero out logic for safety if OFF
        nodes.feedbackGain.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
        nodes.feedbackFMGain.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
    }
  }
  
  private updateTrackEQ(track: TrackData) {
      const nodes = this.tracks.get(track.id);
      if (!nodes) return;
      
      const mapGain = (val: number) => {
          if (val <= 0.5) {
              return -40 + (val * 2 * 40); 
          } else {
              return (val - 0.5) * 2 * 12;
          }
      };

      nodes.eqLow.gain.setTargetAtTime(mapGain(track.eqLow), this.context.currentTime, 0.1);
      nodes.eqMid.gain.setTargetAtTime(mapGain(track.eqMid), this.context.currentTime, 0.1);
      nodes.eqHigh.gain.setTargetAtTime(mapGain(track.eqHigh), this.context.currentTime, 0.1);
  }

  public updateMasterVolume(vol: number) {
    this.masterGain.gain.setTargetAtTime(vol, this.context.currentTime, 0.05);
  }

  private updateTrackLFOs(track: TrackData) {
      const nodes = this.tracks.get(track.id);
      if (!nodes) return;

      this.manageLFO('lfoVol', 'lfoVolGain', track.lfoVol, nodes, nodes.tremoloGain.gain, 0.5);
      this.manageLFO('lfoPan', 'lfoPanGain', track.lfoPan, nodes, nodes.panner.pan, 1.0);
      
      const pitchParam = nodes.source ? nodes.source.playbackRate : null;
      this.manageLFO('lfoPitch', 'lfoPitchGain', track.lfoPitch, nodes, pitchParam, 0.2);
  }

  private manageLFO(
      oscKey: 'lfoVol' | 'lfoPan' | 'lfoPitch', 
      gainKey: 'lfoVolGain' | 'lfoPanGain' | 'lfoPitchGain',
      config: LFOConfig,
      nodes: TrackNodes,
      targetParam: AudioParam | null,
      depthScalar: number
  ) {
      if (config.enabled) {
          if (!nodes[oscKey]) {
              const osc = this.context.createOscillator();
              const gain = this.context.createGain();
              osc.type = 'sine';
              osc.start();
              osc.connect(gain);
              nodes[oscKey] = osc;
              nodes[gainKey] = gain;
          }

          const osc = nodes[oscKey]!;
          const gain = nodes[gainKey]!;

          osc.frequency.setTargetAtTime(config.rate, this.context.currentTime, 0.1);
          gain.gain.setTargetAtTime(config.depth * depthScalar, this.context.currentTime, 0.1);

          if (targetParam) {
              try {
                gain.disconnect(); 
                gain.connect(targetParam);
              } catch(e) {}
          }
      } else {
          if (nodes[oscKey]) {
              try {
                nodes[oscKey]!.stop();
                nodes[oscKey]!.disconnect();
                nodes[gainKey]?.disconnect();
              } catch(e) {}
              nodes[oscKey] = null;
              nodes[gainKey] = null;
          }
      }
  }

  private updateTrackDrift(track: TrackData) {
    const nodes = this.tracks.get(track.id);
    if (!nodes) return;

    if (track.driftEnabled) {
      if (!nodes.driftLfo) {
        nodes.driftLfo = this.context.createOscillator();
        nodes.driftGain = this.context.createGain();
        nodes.driftLfo.type = 'sine';
        const randomFreq = 0.01 + (Math.random() * 0.04); 
        nodes.driftLfo.frequency.value = randomFreq; 
        nodes.driftLfo.start(this.context.currentTime);
        nodes.driftLfo.connect(nodes.driftGain);
        nodes.driftGain.connect(nodes.volGain.gain); 
      }
      nodes.driftGain!.gain.setTargetAtTime(0.3, this.context.currentTime, 1.0);
    } else {
      if (nodes.driftLfo) {
         nodes.driftGain?.gain.setTargetAtTime(0, this.context.currentTime, 2.0);
         setTimeout(() => {
             if(nodes.driftLfo) {
                try {
                    nodes.driftLfo.stop();
                    nodes.driftLfo.disconnect();
                    nodes.driftGain?.disconnect();
                } catch(e) {}
                nodes.driftLfo = null;
                nodes.driftGain = null;
             }
         }, 2100);
      }
    }
  }

  private updateCrossfade(trackA: TrackData) {
      const nodesA = this.tracks.get(trackA.id);
      const nodesB = this.tracks.get(trackA.id + 1); 

      if (!nodesA) return;

      if (trackA.linkNext && nodesB) {
          if (!nodesA.fadeOsc) {
              nodesA.fadeOsc = this.context.createOscillator();
              nodesA.fadeGainOsc = this.context.createGain();
              
              nodesA.fadeOsc.type = 'sine';
              nodesA.fadeOsc.start();
              nodesA.fadeOsc.connect(nodesA.fadeGainOsc);
              
              nodesA.fadeGainOsc.gain.value = 0.5;
              nodesA.fadeGain.gain.value = 0.5;
              nodesA.fadeGainOsc.connect(nodesA.fadeGain.gain);
              
              nodesB.fadeGain.gain.value = 0.5;
              const inverter = this.context.createGain();
              inverter.gain.value = -1;
              nodesA.fadeGainOsc.connect(inverter);
              inverter.connect(nodesB.fadeGain.gain);
          }
          
          if (nodesA.fadeOsc) {
              nodesA.fadeOsc.frequency.setTargetAtTime(trackA.crossfadeSpeed, this.context.currentTime, 0.1);
          }

      } else {
          if (nodesA.fadeOsc) {
              try {
                  nodesA.fadeOsc.stop();
                  nodesA.fadeOsc.disconnect();
                  nodesA.fadeGainOsc?.disconnect();
              } catch(e) {}
              nodesA.fadeOsc = null;
              nodesA.fadeGainOsc = null;
              
              nodesA.fadeGain.gain.setTargetAtTime(1, this.context.currentTime, 0.1);
              if (nodesB) nodesB.fadeGain.gain.setTargetAtTime(1, this.context.currentTime, 0.1);
          }
      }
  }

  public generateTestBuffer(): AudioBuffer {
    const rate = this.context.sampleRate;
    const length = rate * (20 + Math.random() * 10); 
    const buffer = this.context.createBuffer(2, length, rate);
    const freq = 55 * (Math.floor(Math.random() * 4) + 1); 
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            const t = i / rate;
            const mod1 = Math.sin(t * 0.5) * 5; 
            const carrier = Math.sin(t * freq * Math.PI * 2 + mod1);
            const noise = (Math.random() * 2 - 1) * 0.05;
            const fadeIn = Math.min(t / 2, 1.0);
            const fadeOut = Math.min(1.0, (length/rate - t) / 2);
            data[i] = (carrier + noise) * 0.5 * fadeIn * fadeOut;
        }
    }
    return buffer;
  }
}
