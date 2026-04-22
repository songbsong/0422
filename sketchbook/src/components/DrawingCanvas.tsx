import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { doc, onSnapshot, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { cn } from '../lib/utils';

interface DrawingLine {
  tool: string;
  points: number[];
  color: string;
  width: number;
}

interface CanvasProps {
  canvasId: string;
  isOwner: boolean;
  onPost?: (lines: DrawingLine[]) => void;
}

export default function DrawingCanvas({ canvasId, isOwner, onPost }: CanvasProps) {
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const linesRef = useRef<DrawingLine[]>([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const isDrawing = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Resize handling
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Sync with Firestore
  useEffect(() => {
    const canvasDoc = doc(db, 'canvases', canvasId);
    const unsubscribe = onSnapshot(canvasDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.lines && !isDrawing.current) {
          setLines(data.lines);
          linesRef.current = data.lines;
        }
      } else if (isOwner) {
        // Initialize if not exists
        setDoc(canvasDoc, {
          id: canvasId,
          type: canvasId === 'shared' ? 'shared' : 'individual',
          lines: [],
          lastUpdated: serverTimestamp()
        });
      }
    });

    return () => unsubscribe();
  }, [canvasId, isOwner]);

  const handleMouseDown = (e: any) => {
    if (!auth.currentUser) return;
    if (!isOwner && canvasId !== 'shared') return;
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    
    setLines(prev => {
      const newLines = [...prev, { tool, points: [pos.x, pos.y], color, width: strokeWidth }];
      linesRef.current = newLines;
      return newLines;
    });
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    setLines(prev => {
      if (prev.length === 0) return prev;
      const newLines = [...prev];
      const lastLine = { ...newLines[newLines.length - 1] };
      lastLine.points = [...lastLine.points, point.x, point.y];
      newLines[newLines.length - 1] = lastLine;
      linesRef.current = newLines;
      return newLines;
    });
  };

  const handleMouseUp = async () => {
    isDrawing.current = false;
    await syncCanvas(linesRef.current);
  };

  const syncCanvas = async (newLines: DrawingLine[]) => {
    try {
      setIsSyncing(true);
      const canvasDoc = doc(db, 'canvases', canvasId);
      await updateDoc(canvasDoc, {
        lines: newLines,
        lastUpdated: serverTimestamp()
      });
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClear = async () => {
    if (window.confirm("캔버스를 비우시겠습니까?")) {
      setLines([]);
      linesRef.current = [];
      await syncCanvas([]);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full gap-6">
      {/* Stage Container */}
      <div 
        ref={containerRef}
        className="flex-1 bg-white border-4 border-black relative overflow-hidden cursor-crosshair min-h-[400px]"
      >
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(#000 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }}
        />
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.color}
                strokeWidth={line.width}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
        {/* Decorative Label from theme */}
        {canvasId === 'shared' && lines.length > 0 && (
           <div className="absolute bottom-4 left-4 bg-black text-white px-3 py-1 text-[8px] font-black uppercase tracking-tighter z-10">
             Last update synchronized to global stream
           </div>
        )}
      </div>

      {/* ToolBar - Vertical Sidebar on Right */}
      <div className="w-full md:w-32 lg:w-40 flex flex-col p-6 bg-white border-4 border-black gap-10">
        {/* Tool Selection */}
        <div className="flex flex-col gap-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tools</label>
          <div className="flex flex-col border-2 border-black">
            <button
              onClick={() => setTool('pen')}
              className={cn(
                "p-3 transition-all font-black uppercase text-[10px] tracking-widest border-b-2 border-black",
                tool === 'pen' ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100"
              )}
            >
              PEN
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={cn(
                "p-3 transition-all font-black uppercase text-[10px] tracking-widest",
                tool === 'eraser' ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100"
              )}
            >
              ERASE
            </button>
          </div>
        </div>

        {/* Color Palette */}
        <div className="flex flex-col gap-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Palette</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              '#000000', '#FF3E11', '#0000FF', '#FFD700', '#10b981', '#8b5cf6'
            ].map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "aspect-square border-2 border-black hover:scale-110 transition-transform",
                  color === c ? "ring-2 ring-black ring-offset-2 scale-110 z-10" : ""
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Size</label>
            <span className="text-[10px] font-black">{strokeWidth}</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="50" 
            value={strokeWidth} 
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="w-full h-2 bg-neutral-200 appearance-none cursor-pointer accent-black"
          />
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-3 pt-6 border-t-2 border-black border-dashed">
          <button
            onClick={handleClear}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
          >
            Clear Sheet
          </button>
          
          {isSyncing && (
             <div className="bg-black text-white px-2 py-1 text-[7px] font-black uppercase animate-pulse text-center">
               Syncing State...
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
