
import React, { useState } from 'react';
import { Sparkles, Mic, Zap, Loader, Brain, Music, Ear } from 'lucide-react';
import { AiService } from '../services/aiService';
import { TrackData, AiProvider } from '../types';
import { AudioEngine } from '../services/audioEngine';

interface AiAssistantProps {
    onMorph: (configs: Partial<TrackData>[]) => void;
    onLoadSample: (trackId: number, buffer: AudioBuffer, name: string) => void;
    engine: AudioEngine | null;
    tracks: TrackData[];
    geminiKey: string;
    openaiKey: string;
    openaiBaseUrl?: string;
    openaiModel?: string;
    provider: AiProvider;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ onMorph, onLoadSample, engine, tracks, geminiKey, openaiKey, openaiBaseUrl, openaiModel, provider }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'MORPH' | 'VOICE' | 'SOUND'>('MORPH');
    const [prompt, setPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [selectedVoice, setSelectedVoice] = useState('Puck');
    const [targetTrackId, setTargetTrackId] = useState(0);
    const [analyzeAudio, setAnalyzeAudio] = useState(false);
    
    const aiService = new AiService();

    // Determine if the AI button should be shown at all
    // Logic: Show if we have ANY key suitable for the current provider, or if we have a Gemini key (needed for voice/sound)
    const hasAnyKey = geminiKey || (provider === 'OPENAI' && openaiKey);
    if (!hasAnyKey) return null;

    const handleMorph = async () => {
        if (!prompt) return;
        setIsProcessing(true);
        
        const providerName = provider === 'OPENAI' ? 'OpenAI/Compat' : 'Gemini';
        const activeKey = provider === 'OPENAI' ? openaiKey : geminiKey;
        const keyId = activeKey ? `...${activeKey.slice(-4)}` : 'N/A';
        
        setProcessingStatus(`${providerName} (${keyId})`);
        
        // Debug Log for User
        console.log(`[AiAssistant] Morphing using Provider: ${providerName}`);

        try {
            let audioContextDescription: string[] = [];
            
            // Feature: Context Aware Morphing (Token Optimized)
            if (analyzeAudio && engine) {
                setProcessingStatus(`Analyzing...`);
                // Wait for UI update
                await new Promise(resolve => setTimeout(resolve, 50));

                audioContextDescription = tracks.map((t) => {
                    if (t.buffer) {
                        try {
                            // Perform lightweight client-side FFT/Spectral Analysis
                            const features = engine.getAudioFeatures(t.buffer);
                            return `Track ${t.id + 1} (${t.name}): Volume=${features.loudness}, Spectral=${features.brightness}, Texture=${features.texture}`;
                        } catch (e) {
                            return `Track ${t.id + 1}: Unknown`;
                        }
                    }
                    return `Track ${t.id + 1}: Empty`;
                });
            }

            setProcessingStatus(`${providerName} Designing...`);

            const newConfigs = await aiService.generateSynthMorph(
                prompt, 
                audioContextDescription, 
                provider, 
                { 
                    gemini: geminiKey, 
                    openai: openaiKey,
                    openaiBaseUrl: openaiBaseUrl,
                    openaiModel: openaiModel 
                }
            );
            onMorph(newConfigs);
            setIsOpen(false);
        } catch (e: any) {
            console.error(e);
            alert(`AI Morph failed: ${JSON.stringify(e.message || e)}. Check console.`);
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const handleVoiceGen = async () => {
        if (!prompt) return;
        if (!geminiKey) {
            alert("Voice Generation requires a Google Gemini API Key. Please add one in Settings.");
            return;
        }
        if (!engine) {
            alert("Audio Engine is not ready yet. Please wait a moment.");
            return;
        }
        setIsProcessing(true);
        setProcessingStatus('Gemini TTS...');
        try {
            // Always uses Gemini Key
            const { data, sampleRate } = await aiService.generateVoiceSample(prompt, selectedVoice, geminiKey);
            const buffer = engine.createBufferFromRawPCM(data, sampleRate);
            onLoadSample(targetTrackId, buffer, `AI: ${prompt.substring(0, 8)}...`);
            setIsOpen(false);
        } catch (e: any) {
            console.error(e);
            alert(`AI Voice failed: ${e.message}. Check console for details.`);
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const handleSoundGen = async () => {
        if (!prompt) return;
        if (!geminiKey) {
            alert("FX Generation requires a Google Gemini API Key. Please add one in Settings.");
            return;
        }
        if (!engine) {
            alert("Audio Engine is not ready yet. Please wait a moment.");
            return;
        }
        setIsProcessing(true);
        setProcessingStatus('Gemini FX...');
        try {
            // Always uses Gemini Key
            const { data, sampleRate } = await aiService.generateSoundEffect(prompt, geminiKey);
            const buffer = engine.createBufferFromRawPCM(data, sampleRate);
            onLoadSample(targetTrackId, buffer, `FX: ${prompt.substring(0, 8)}...`);
            setIsOpen(false);
        } catch (e: any) {
            console.error(e);
            alert(`AI Sound FX failed: ${e.message}. Check console for details.`);
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

    return (
        <>
            {/* Trigger Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all hover:scale-110
                    ${isOpen ? 'bg-cyan-500 text-slate-900 rotate-90' : 'bg-slate-800 border border-cyan-500/50 text-cyan-400'}
                `}
                title="AI Assistant"
            >
                <Brain size={24} />
            </button>

            {/* Panel */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-80 bg-slate-900/95 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200">
                    
                    {/* Header */}
                    <div className="bg-slate-950/50 p-3 border-b border-slate-800 flex justify-between items-center">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setMode('MORPH')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${mode === 'MORPH' ? 'bg-cyan-500 text-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                MORPH
                            </button>
                            <button 
                                onClick={() => setMode('VOICE')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${mode === 'VOICE' ? 'bg-purple-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                VOICE
                            </button>
                            <button 
                                onClick={() => setMode('SOUND')}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${mode === 'SOUND' ? 'bg-emerald-500 text-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                SOUND
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex flex-col gap-4">
                        {mode === 'MORPH' && (
                            <>
                                <div className="text-xs text-cyan-200/80 leading-relaxed">
                                    <Sparkles size={12} className="inline mr-1" />
                                    Describe a mood (e.g., "Underwater Caves"). 
                                    <span className="block mt-1 opacity-70">
                                        Using: {provider === 'OPENAI' ? 'OpenAI / Compatible' : 'Google Gemini'}
                                    </span>
                                </div>
                                <textarea 
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none resize-none h-20"
                                    placeholder="Enter mood..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                                
                                {/* Audio Context Toggle */}
                                <div 
                                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${analyzeAudio ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                                    onClick={() => setAnalyzeAudio(!analyzeAudio)}
                                >
                                    <div className={`w-3 h-3 rounded-full border ${analyzeAudio ? 'bg-cyan-500 border-cyan-500' : 'bg-slate-800 border-slate-600'}`}></div>
                                    <Ear size={14} className={analyzeAudio ? 'text-cyan-400' : 'text-slate-500'} />
                                    <span className={`text-xs select-none ${analyzeAudio ? 'text-cyan-100' : 'text-slate-500'}`}>
                                        Analyze Spectra (Context)
                                    </span>
                                </div>

                                <button 
                                    onClick={handleMorph}
                                    disabled={isProcessing || !prompt}
                                    className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold py-2 rounded flex items-center justify-center gap-2 transition-all"
                                >
                                    {isProcessing ? <Loader className="animate-spin" size={16}/> : <Zap size={16} />}
                                    {isProcessing ? processingStatus : 'MORPH SOUNDSCAPE'}
                                </button>
                            </>
                        )}

                        {mode === 'VOICE' && (
                            <>
                                <div className="text-xs text-purple-200/80 leading-relaxed">
                                    <Mic size={12} className="inline mr-1" />
                                    Generate spoken-word textures, logs, or numbers stations.
                                    {provider === 'OPENAI' && !geminiKey && (
                                        <span className="block mt-1 text-red-400">Requires Gemini Key in Settings!</span>
                                    )}
                                </div>
                                <textarea 
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-purple-500 outline-none resize-none h-20"
                                    placeholder="Text to speak..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                                
                                <div className="flex gap-2">
                                    <select 
                                        className="bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 p-1 flex-1 outline-none"
                                        value={selectedVoice}
                                        onChange={(e) => setSelectedVoice(e.target.value)}
                                    >
                                        {voices.map(v => <option key={v} value={v}>{v}</option>)}
                                    </select>
                                    <select 
                                        className="bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 p-1 flex-1 outline-none"
                                        value={targetTrackId}
                                        onChange={(e) => setTargetTrackId(Number(e.target.value))}
                                    >
                                        {tracks.map(t => <option key={t.id} value={t.id}>Track {t.id + 1}</option>)}
                                    </select>
                                </div>

                                <button 
                                    onClick={handleVoiceGen}
                                    disabled={isProcessing || !prompt}
                                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition-all"
                                >
                                    {isProcessing ? <Loader className="animate-spin" size={16}/> : <Mic size={16} />}
                                    {isProcessing ? processingStatus : 'GENERATE VOICE'}
                                </button>
                            </>
                        )}

                        {mode === 'SOUND' && (
                            <>
                                <div className="text-xs text-emerald-200/80 leading-relaxed">
                                    <Music size={12} className="inline mr-1" />
                                    Generate sound effects, foley, or abstract noise.
                                    {provider === 'OPENAI' && !geminiKey && (
                                        <span className="block mt-1 text-red-400">Requires Gemini Key in Settings!</span>
                                    )}
                                </div>
                                <textarea 
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none resize-none h-20"
                                    placeholder="Ex: Thunder strike, Laser beam, Wind howling..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                                
                                <div className="flex gap-2">
                                    <div className="flex-1 flex items-center px-2 text-xs text-slate-500 bg-slate-900 rounded border border-slate-800">
                                        Target:
                                    </div>
                                    <select 
                                        className="bg-slate-800 text-xs text-slate-200 rounded border border-slate-700 p-1 flex-1 outline-none"
                                        value={targetTrackId}
                                        onChange={(e) => setTargetTrackId(Number(e.target.value))}
                                    >
                                        {tracks.map(t => <option key={t.id} value={t.id}>Track {t.id + 1}</option>)}
                                    </select>
                                </div>

                                <button 
                                    onClick={handleSoundGen}
                                    disabled={isProcessing || !prompt}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-bold py-2 rounded flex items-center justify-center gap-2 transition-all"
                                >
                                    {isProcessing ? <Loader className="animate-spin" size={16}/> : <Music size={16} />}
                                    {isProcessing ? processingStatus : 'GENERATE FX'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default AiAssistant;
