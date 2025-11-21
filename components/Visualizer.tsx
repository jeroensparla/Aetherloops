
import React, { useEffect, useRef, useState } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

// Modes:
// 0: Spectrum (Mirrored Bars)
// 1: Waveform (Oscilloscope)
// 2: Circular (Vortex / Portal)
// 3: Nebula (Particles)
const MODES = ['SPECTRUM', 'WAVEFORM', 'VORTEX', 'NEBULA'];

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState(0);

  // Helper to toggle modes
  const handleClick = () => {
      setMode(prev => (prev + 1) % MODES.length);
  };

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount; 
    const dataArray = new Uint8Array(bufferLength);
    const timeArray = new Uint8Array(bufferLength);
    
    let animationId: number;

    // --- Draw Implementations ---

    const drawSpectrum = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Slight fade for trails
        ctx.fillStyle = 'rgba(2, 6, 23, 0.3)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i];

            const hue = (i / bufferLength) * 360;
            const s = 80;
            const l = 50 + (barHeight / 255) * 30;
            
            ctx.fillStyle = `hsla(${hue}, ${s}%, ${l}%, 0.8)`;

            const h = (barHeight / 255) * (canvas.height / 2);
            
            // Mirrored
            ctx.fillRect(x, canvas.height / 2 - h, barWidth, h);
            ctx.fillRect(x, canvas.height / 2, barWidth, h * 0.5);

            x += barWidth + 1;
        }
    };

    const drawWaveform = () => {
        analyser.getByteTimeDomainData(timeArray);

        // Fast fade for sharp lines
        ctx.fillStyle = 'rgba(2, 6, 23, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#22d3ee'; // Cyan
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = timeArray[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    };

    const drawVortex = () => {
        analyser.getByteFrequencyData(dataArray);

        // Clear completely for sharp lines, or low opacity for trails
        ctx.fillStyle = 'rgba(2, 6, 23, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        
        // Add rotation over time
        const time = Date.now() / 1000;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(time * 0.2);

        for (let i = 0; i < bufferLength; i+=4) { // Skip bins for performance/aesthetic
            const barHeight = dataArray[i];
            if (barHeight < 10) continue;

            const rad = (i / bufferLength) * Math.PI * 2;
            
            // Start from center circle
            const baseR = 10;
            const length = (barHeight / 255) * radius;
            
            const xEnd = Math.cos(rad) * (baseR + length);
            const yEnd = Math.sin(rad) * (baseR + length);
            
            const xStart = Math.cos(rad) * baseR;
            const yStart = Math.sin(rad) * baseR;

            const hue = (i / bufferLength) * 360 + (time * 50); 
            ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xEnd, yEnd);
            ctx.stroke();
        }
        ctx.restore();
    };

    const drawNebula = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Very slow fade for misty look
        ctx.fillStyle = 'rgba(2, 6, 23, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const time = Date.now() / 2000;

        // Draw randomized particles based on intense frequencies
        for (let i = 0; i < 60; i++) {
             const bin = Math.floor(Math.random() * bufferLength);
             const val = dataArray[bin];
             
             if (val > 30) {
                 // Position based on frequency (low freq = center, high freq = outer)
                 // Add noise
                 const angle = Math.random() * Math.PI * 2;
                 const dist = (bin / bufferLength) * (canvas.width/2) + (Math.random() * 20);
                 
                 const x = centerX + Math.cos(angle + time) * dist;
                 const y = centerY + Math.sin(angle + time * 0.5) * dist;
                 
                 const size = (val / 255) * 3;
                 
                 // Color based on frequency
                 const hue = (bin / bufferLength) * 320;
                 
                 ctx.beginPath();
                 ctx.arc(x, y, size, 0, Math.PI * 2);
                 ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${val/255})`;
                 ctx.fill();
             }
        }
        
        // Center Pulse (Bass)
        const bass = dataArray[4]; // Low freq bin
        if (bass > 100) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, bass / 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(34, 211, 238, 0.05)`; // Very faint cyan
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, bass / 4, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 211, 238, 0.2)`;
            ctx.stroke();
        }
    };

    // --- Main Loop ---

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      switch(mode) {
          case 0: drawSpectrum(); break;
          case 1: drawWaveform(); break;
          case 2: drawVortex(); break;
          case 3: drawNebula(); break;
      }
    };

    if (isPlaying) {
        draw();
    } else {
        // Clear canvas when stopped
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw "Paused" line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height/2);
        ctx.lineTo(canvas.width, canvas.height/2);
        ctx.strokeStyle = '#1e293b';
        ctx.stroke();
        
        // Draw Mode text centered
        ctx.fillStyle = '#334155';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("VISUALIZER PAUSED", canvas.width/2, canvas.height/2 - 10);
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isPlaying, mode]);

  return (
    <div className="relative group w-full h-24 cursor-pointer overflow-hidden rounded-md border border-slate-800 shadow-inner" onClick={handleClick} title="Click to change visualization mode">
        <canvas 
        ref={canvasRef} 
        width={600} 
        height={100} 
        className="w-full h-full bg-slate-950 opacity-90"
        />
        
        <div className="absolute top-1 right-2 text-[9px] font-mono text-slate-600 group-hover:text-cyan-400 transition-colors pointer-events-none bg-slate-900/50 px-1 rounded">
            {MODES[mode]}
        </div>
        
        <div className="absolute bottom-1 left-2 text-[8px] font-mono text-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            CLICK TO CYCLE
        </div>
    </div>
  );
};

export default Visualizer;