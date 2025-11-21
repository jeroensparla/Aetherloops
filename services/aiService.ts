
import { GoogleGenAI, Modality } from '@google/genai';
import { TrackData, AiProvider } from '../types';

export class AiService {
    
    // Helper: Exponential Backoff Retry
    private async withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 1000): Promise<T> {
        let lastError: any;
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (e: any) {
                lastError = e;
                const msg = (e.message || '').toLowerCase();
                const status = e.status || 0;

                // CRITICAL: Check for Quota/Billing errors. Do NOT retry these.
                // OpenAI returns 429 for BOTH Rate Limit AND Quota Exceeded. We must check the text.
                const isQuotaError = 
                    msg.includes('insufficient_quota') || 
                    msg.includes('billing') || 
                    msg.includes('quota exceeded') ||
                    msg.includes('you exceeded your current quota') ||
                    status === 401 || // Unauthorized (Invalid Key)
                    status === 403;   // Forbidden

                if (isQuotaError) {
                    console.error("[AiService] Fatal Auth/Quota Error:", e.message);
                    // Throw a clean error to stop the loop immediately
                    throw new Error(`Provider Access Denied: ${e.message}`);
                }

                // Check for Rate Limits (429) that ARE recoverable (just going too fast)
                const isRateLimit = status === 429 || msg.includes('429') || msg.includes('exhausted');
                const isServerOverload = status === 503 || status === 504; // Gateway Timeout
                
                if (i === retries - 1) break; // Last attempt failed

                if (isRateLimit || isServerOverload) {
                     const delay = baseDelay * Math.pow(2, i);
                     console.warn(`[AiService] Rate Limited (Attempt ${i + 1}/${retries}). Retrying in ${delay/1000}s...`);
                     await new Promise(resolve => setTimeout(resolve, delay));
                     continue;
                }
                
                // If it's another error (e.g. Network Error / CORS), throw immediately
                throw e; 
            }
        }
        throw lastError;
    }

    // Feature 1: AI "Conductor" / Morphing
    public async generateSynthMorph(
        prompt: string, 
        audioContext: string[] = [], 
        provider: AiProvider = 'GEMINI',
        keys: { gemini?: string, openai?: string, openaiBaseUrl?: string, openaiModel?: string }
    ): Promise<Partial<TrackData>[]> {
        
        const systemInstruction = `You are an algorithmic synth sound designer. 
        Generate a JSON configuration for 8 tracks based on the Mood.
        
        OUTPUT FORMAT:
        Return a SINGLE JSON Object with a "tracks" property containing an array of 8 objects.
        Each object must have:
        - volume (0.0-0.9)
        - playbackRate (0.1-2.0)
        - pan (-1.0 to 1.0)
        - reverbSend (0.0-1.0)
        - eqLow, eqMid, eqHigh (0.0-1.0)
        - driftEnabled (boolean)
        - lfoVol, lfoPan, lfoPitch: { enabled: bool, rate: 0.01-4.0, depth: 0.0-1.0 }
        - linkNext (bool), crossfadeSpeed (0.01-2.0)
        - granularSpray (0.0-1.0): High (>0.6) = Glitch/Storm.
        - feedbackSend (0.0-1.0): >0.5 triggers FM Synthesis (Metallic).
        - feedbackTargetId (0-7 or -1 for OFF).
        
        RULES:
        1. VARIATION: Every track must have different params.
        2. POLYRHYTHM: Use different LFO rates per track.
        3. MOOD: "${prompt}" -> Map this to the params.
        `;

        let contextInstruction = "";
        if (audioContext.length > 0) {
            contextInstruction = `\nCONTEXT:\n${audioContext.join('\n')}\nUse this to balance the mix.`;
        }

        const fullPrompt = `Generate 8 tracks for mood: ${prompt}. ${contextInstruction}`;

        // --- OPENAI / COMPATIBLE BRANCH ---
        if (provider === 'OPENAI') {
            if (!keys.openai) throw new Error("OpenAI API Key is missing.");
            
            // Configurable Base URL and Model
            const baseUrl = keys.openaiBaseUrl || "https://api.openai.com/v1";
            const model = keys.openaiModel || "gpt-4o-mini";
            
            console.log(`[AiService] Morphing via OpenAI Compatible: ${baseUrl} (${model})`);
            
            // Ensure URL ends correctly without double slashes
            const cleanBase = baseUrl.replace(/\/+$/, '');
            const endpoint = `${cleanBase}/chat/completions`;

            return this.withRetry(async () => {
                let response;
                try {
                    response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${keys.openai}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [
                                { role: "system", content: systemInstruction },
                                { role: "user", content: fullPrompt }
                            ],
                            response_format: { type: "json_object" },
                            temperature: 0.7
                        })
                    });
                } catch (netErr: any) {
                    // Provide specific hints for "Failed to fetch"
                    let hint = "";
                    if (!navigator.onLine) {
                        hint = " (You appear to be offline)";
                    } else if (netErr.name === 'TypeError' && netErr.message === 'Failed to fetch') {
                        hint = " (This is often caused by AdBlockers, Privacy Extensions, or CORS issues. Please disable extensions for this site.)";
                    }
                    
                    throw new Error(`Network Error connecting to ${baseUrl}${hint}: ${netErr.message}`);
                }

                if (!response.ok) {
                    const errText = await response.text();
                    let errMessage = `HTTP ${response.status} ${response.statusText}`;
                    try {
                        const errJson = JSON.parse(errText);
                        if (errJson.error && errJson.error.message) {
                            errMessage = errJson.error.message;
                        } else if (typeof errJson === 'string') {
                            errMessage = errJson;
                        }
                    } catch (e) {}

                    // Create error object with status for the retry logic
                    const error: any = new Error(errMessage);
                    error.status = response.status; 
                    throw error;
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content;
                if (!text) throw new Error("No content returned from Provider");
                
                try {
                    const result = JSON.parse(text);
                    return result.tracks || result;
                } catch (parseErr) {
                    console.error("JSON Parse Error", text);
                    throw new Error("Failed to parse JSON from Provider response. Check console.");
                }
            });
        }

        // --- GEMINI BRANCH ---
        const key = keys.gemini || process.env.API_KEY;
        if (!key) throw new Error("Gemini API Key is missing.");

        console.log(`[AiService] Morphing via Gemini`);
        const ai = new GoogleGenAI({ apiKey: key });

        return this.withRetry(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    temperature: 0.7, 
                }
            });

            let text = response.text;
            if (!text) throw new Error("No data returned from AI");
            
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(text);
            
            if (result.tracks && Array.isArray(result.tracks)) {
                return result.tracks;
            } else if (Array.isArray(result)) {
                return result;
            }
            throw new Error("Invalid JSON structure returned");
        });
    }

    // Feature 2: AI Voice Texture Generator (Always Gemini)
    public async generateVoiceSample(text: string, voiceName: string = 'Kore', apiKey?: string): Promise<{ data: Uint8Array, sampleRate: number }> {
        const key = apiKey || process.env.API_KEY;
        if (!key) throw new Error("Gemini API Key required for Voice Generation.");
        
        const maskedKey = key.length > 4 ? `...${key.slice(-4)}` : '***';
        console.log(`[AiService] Generating Voice with Gemini Key: ${maskedKey}`);

        const ai = new GoogleGenAI({ apiKey: key });

        return this.withRetry(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: [{
                    parts: [{ text: text }]
                }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceName },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            
            if (!base64Audio) {
                throw new Error("No audio generated from model.");
            }

            const audioBytes = this.base64ToUint8Array(base64Audio);
            return { data: audioBytes, sampleRate: 24000 };
        });
    }

    // Helper: Generate Onomatopoeia Text
    private async generateOnomatopoeia(description: string, apiKey: string): Promise<string> {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        
        return this.withRetry(async () => {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Convert "${description}" into a short phonetic onomatopoeia string. Output ONLY the string.`,
            });
            return response.text || description;
        });
    }

    // Feature 3: AI Sound Effect (Always Gemini)
    public async generateSoundEffect(description: string, apiKey?: string): Promise<{ data: Uint8Array, sampleRate: number }> {
        const key = apiKey || process.env.API_KEY;
        if (!key) throw new Error("Gemini API Key required for FX Generation.");
        
        try {
            const soundText = await this.generateOnomatopoeia(description, key);
            return await this.generateVoiceSample(soundText, 'Fenrir', key);
        } catch (e) {
            console.error("Sound FX Generation Failed", e);
            throw e;
        }
    }

    private base64ToUint8Array(base64: string): Uint8Array {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
}
