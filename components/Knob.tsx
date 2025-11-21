
import React, { useState, useRef, useEffect } from 'react';

interface KnobProps {
  value: number; // The base user-set value
  modulation?: number; // The LFO offset (-1 to 1) to animate the knob
  min: number;
  max: number;
  label: string;
  onChange: (val: number) => void;
  size?: number;
  color?: string;
  bipolar?: boolean; 
  logarithmic?: boolean;
}

const Knob: React.FC<KnobProps> = ({ 
  value, 
  modulation = 0,
  min, 
  max, 
  label, 
  onChange, 
  size = 48,
  color = '#06b6d4', 
  bipolar = false,
  logarithmic = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const startVal = useRef<number>(0);

  // Helper to convert value to 0-1 scale
  const getPercent = (v: number) => {
    if (logarithmic && min > 0) {
        const safeV = Math.max(v, min);
        const minLog = Math.log(min);
        const maxLog = Math.log(max);
        return (Math.log(safeV) - minLog) / (maxLog - minLog);
    }
    return (v - min) / (max - min);
  };

  // Calculate Base Angle
  const percent = getPercent(value);
  const baseAngle = -135 + (percent * 270);

  // Calculate Modulated Angle
  const modDegrees = modulation * 135; // +/- 135 degrees max swing
  let finalAngle = baseAngle + modDegrees;

  // Clamp visual rotation
  finalAngle = Math.max(-135, Math.min(135, finalAngle));

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.clientY;
      
      // Sensitivity adjustment:
      // Base 250px for full range (smoother than 200)
      // Shift key enables fine mode (1000px for full range = 4x precision)
      const baseSensitivity = 250; 
      const sensitivity = e.shiftKey ? baseSensitivity * 4 : baseSensitivity;
      
      // 1. Calculate starting percentage
      let startPercent = 0;
      if (logarithmic && min > 0) {
          startPercent = (Math.log(Math.max(startVal.current, min)) - Math.log(min)) / (Math.log(max) - Math.log(min));
      } else {
          startPercent = (startVal.current - min) / (max - min);
      }

      // 2. Apply Delta
      let newPercent = startPercent + (deltaY / sensitivity);
      newPercent = Math.max(0, Math.min(1, newPercent));
      
      // 3. Convert back to Value
      let newVal;
      if (logarithmic && min > 0) {
          const minLog = Math.log(min);
          const maxLog = Math.log(max);
          newVal = Math.exp(minLog + newPercent * (maxLog - minLog));
      } else {
          newVal = min + newPercent * (max - min);
      }
      
      onChange(newVal);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, onChange, logarithmic]);

  // Format label text
  const getLabelValue = () => {
      if (!isDragging) return '';
      // Improved precision for low values
      if (Math.abs(value) < 1.0) return value.toFixed(3);
      if (Math.abs(value) < 10) return value.toFixed(2);
      return value.toFixed(1);
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div 
        className="relative select-none touch-none group cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        title="Hold Shift for fine control"
      >
        {/* Background ring */}
        <div className="absolute inset-0 rounded-full border-2 border-slate-700 bg-slate-800 shadow-knob" />
        
        {/* Indicator Line wrapper - rotated based on value + modulation */}
        <div 
          className="absolute inset-0 transition-transform duration-75 ease-linear will-change-transform"
          style={{ transform: `rotate(${finalAngle}deg)` }}
        >
           {/* The marker tick */}
           <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1/3 origin-bottom">
              <div 
                className={`w-1 h-2 rounded-full shadow-[0_0_5px_currentColor] transition-colors duration-200 ${isDragging ? 'bg-white' : ''}`}
                style={{ backgroundColor: isDragging ? '#fff' : color }}
              />
           </div>
        </div>

        {/* Ghost Indicator (Shows true set value if modulating) */}
        {Math.abs(modulation) > 0.01 && !isDragging && (
           <div 
           className="absolute inset-0 opacity-30"
           style={{ transform: `rotate(${baseAngle}deg)` }}
         >
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1/3 origin-bottom">
               <div className="w-1 h-2 rounded-full bg-slate-500" />
            </div>
         </div>
        )}

        {/* Center cap */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 rounded-full bg-slate-900 border border-slate-700/50" />
      </div>
      
      {/* Label */}
      <div className="text-center">
        <div className="text-[9px] text-slate-500 font-bold tracking-wider uppercase leading-none mb-0.5">{label}</div>
        <div className="text-[9px] text-cyan-400 font-mono h-3 leading-none">
            {getLabelValue()}
        </div>
      </div>
    </div>
  );
};

export default Knob;
