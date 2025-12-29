import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { X, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import Escudo from '../assets/Escudo_UDSanse.png';

interface RouletteModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SEGMENTS = 20;

const RouletteModal: React.FC<RouletteModalProps> = ({ isOpen, onClose }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [result, setResult] = useState<'continuar' | 'abandonar' | null>(null);
    const [rotation, setRotation] = useState(0);
    const ballControls = useAnimation();

    // Create interleaved colors for the wheel
    const conicGradient = useMemo(() => {
        let gradient = 'conic-gradient(';
        for (let i = 0; i < SEGMENTS; i++) {
            const color = i % 2 === 0 ? '#22C55E' : '#EF4444'; // Green / Red
            const start = (i / SEGMENTS) * 360;
            const end = ((i + 1) / SEGMENTS) * 360;
            gradient += `${color} ${start}deg ${end}deg${i === SEGMENTS - 1 ? '' : ', '}`;
        }
        gradient += ')';
        return gradient;
    }, []);

    const spinRoulette = async () => {
        if (isSpinning) return;

        setIsSpinning(true);
        setResult(null);

        const isWinner = Math.random() > 0.5;
        const finalResult = isWinner ? 'continuar' : 'abandonar';

        // 0 is green, 1 is red, 2 is green...
        // Even index = winner
        const winningSegments = Array.from({ length: SEGMENTS }, (_, i) => i).filter(i => isWinner ? i % 2 === 0 : i % 2 !== 0);
        const chosenSegment = winningSegments[Math.floor(Math.random() * winningSegments.length)];

        const extraTurns = 8 + Math.floor(Math.random() * 5);
        const baseRotation = extraTurns * 360;

        // Position 0 is at the top. Pointer is at the top.
        // So if the wheel rotates clockwise, the segment that ends up at the top is (360 - rotation) % 360
        // Actually, it's easier to think about what segment is at 0 degrees.
        // If we want chosenSegment at the top (0 degrees):
        // targetRotation = baseRotation - (chosenSegment * (360/SEGMENTS))
        // But since we want the rotation to be positive (clockwise):
        const segmentAngle = 360 / SEGMENTS;
        const targetRotation = baseRotation + (360 - (chosenSegment * segmentAngle)) - (segmentAngle / 2);

        setRotation(prev => prev + targetRotation);

        // Ball bounce animation sequence
        // We want a bounce every time a segment divider passes the top
        const duration = 5000;
        const totalSegmentsPassed = extraTurns * SEGMENTS + (isWinner ? 0 : 1); // rough estimate

        // We'll simulate bounces based on duration
        const start = Date.now();
        const bounceInterval = setInterval(() => {
            const elapsed = Date.now() - start;
            const progress = elapsed / duration;
            if (progress >= 1) {
                clearInterval(bounceInterval);
                return;
            }

            // Decelerating frequency of bounces
            // Using a simple easing for bounce timing
            const shouldBounce = Math.random() > 0.3 * progress; // Less frequent as it stops
            if (shouldBounce) {
                ballControls.start({
                    y: [0, -10, 0],
                    transition: { duration: 0.1 + progress * 0.2 }
                });
            }
        }, 100);

        setTimeout(() => {
            clearInterval(bounceInterval);
            setIsSpinning(false);
            setResult(finalResult);
            ballControls.start({ y: 0 });
        }, duration);
    };

    useEffect(() => {
        if (isOpen) {
            setResult(null);
            setRotation(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    onClick={!isSpinning ? onClose : undefined}
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-[3rem] p-8 shadow-2xl overflow-hidden text-center"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">👑 ¿Rey o exiliado? 👋</h2>
                        {!isSpinning && (
                            <button
                                onClick={onClose}
                                className="text-neutral-500 hover:text-white transition-colors bg-neutral-800 p-2 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {/* Roulette Container */}
                    <div className="relative aspect-square w-full max-w-[320px] mx-auto mb-12 flex items-center justify-center">

                        {/* The Pointer Ball Container */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 z-30">
                            <motion.div
                                animate={ballControls}
                                className="w-10 h-10 bg-[#fdfdfd] rounded-full shadow-[0_5px_15px_rgba(0,0,0,1),0_0_20px_rgba(255,255,255,0.3)] border-2 border-neutral-200 relative flex items-center justify-center"
                            >
                                {/* Inner texture to make it look like a ping pong ball */}
                                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-neutral-200/50" />
                                {/* The "pin" that clicks on the wheel */}
                                <div className="w-1 h-6 bg-orange-400 absolute -bottom-4 rounded-full shadow-sm" />
                            </motion.div>
                        </div>

                        {/* The Wheel */}
                        <motion.div
                            animate={{ rotate: rotation }}
                            transition={{ duration: 5, ease: [0.12, 0, 0.1, 1] }}
                            className="w-full h-full rounded-full border-[12px] border-neutral-800 relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)]"
                            style={{ background: conicGradient }}
                        >
                            {/* Discrete dividers */}
                            {Array.from({ length: SEGMENTS }).map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute top-0 left-1/2 w-0.5 h-full bg-black/10 origin-bottom"
                                    style={{ transform: `translateX(-50%) rotate(${i * (360 / SEGMENTS)}deg)` }}
                                />
                            ))}

                            {/* Center Logo Area */}
                            <div className="absolute inset-0 m-auto w-32 h-32 bg-neutral-900 rounded-full border-8 border-neutral-800 z-20 flex items-center justify-center shadow-2xl overflow-hidden">
                                <img src={Escudo} alt="Sanse" className="w-20 h-20 object-contain opacity-90 brightness-110 drop-shadow-lg" />
                            </div>
                        </motion.div>

                        {/* Brass Ring/Outer decoration */}
                        <div className="absolute inset-[-12px] rounded-full border-4 border-neutral-700/50 pointer-events-none z-10" />
                    </div>

                    {/* Result / Action */}
                    <div className="h-28 flex flex-col items-center justify-center gap-4">
                        <AnimatePresence mode="wait">
                            {!isSpinning && !result && (
                                <motion.button
                                    key="spin-btn"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    onClick={spinRoulette}
                                    className="bg-white text-black font-black uppercase tracking-widest px-10 py-5 rounded-2xl text-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-xl"
                                >
                                    <RefreshCw size={24} className="animate-spin-slow" />
                                    GIRAR
                                </motion.button>
                            )}

                            {isSpinning && (
                                <motion.div
                                    key="spinning"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <div className="text-neutral-500 font-black uppercase tracking-[0.3em] text-lg animate-pulse">
                                        GIRANDO...
                                    </div>
                                </motion.div>
                            )}

                            {result && (
                                <motion.div
                                    key="result"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <div className={clsx(
                                        "text-5xl font-black uppercase tracking-tighter drop-shadow-md",
                                        result === 'continuar' ? "text-green-500" : "text-red-500"
                                    )}>
                                        {result === 'continuar' ? "¡TE QUEDAS!" : "¡FUERA!"}
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="text-neutral-500 font-bold hover:text-white transition-colors uppercase text-sm tracking-widest mt-2"
                                    >
                                        Cerrar
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer Decoration */}
                    <div className="mt-6 pt-6 border-t border-neutral-800/30">
                        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest opacity-50">Sanse Ping Pong Club • King of the Court</p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default RouletteModal;
