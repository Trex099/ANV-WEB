
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const NUM_PAPER_BITS = 10;
const NEW_BOWL_HEIGHT_PX = 208; // Corresponds to h-[13rem] approx.
const BOWL_Y_OFFSET_FROM_CENTER = 80;
const CIRCLE_RADIUS = 200;
const ANIMATION_DURATION_MS = 800;
const SHUFFLE_HOLD_DURATION_MS = 3000;
const SHUFFLE_UPDATE_INTERVAL_MS = 500;
const CIRCLE_Y_OFFSET_FACTOR = 1.2;
const INITIAL_PAPER_BIT_SCALE = 0.65;

const heartfeltMessages = [
  "You're someone's reason to smile.",
  "Believe in the magic within you.",
  "Every day is a fresh start.",
  "You are stronger than you think.",
  "Kindness changes everything.",
  "Dream big, sparkle more, shine bright.",
  "You are loved more than you know.",
  "Today is a gift, that's why it's called the present.",
  "Your potential is endless.",
  "Keep shining, the world needs your light."
];

interface PaperBitConfig {
  id: number;
  text: string;
  messageIndex: number;
  x: number;
  yBaseOffset: number; // Offset from the calculated paperPileCenterInBowlY
  rotate: number;
  zIndex: number;
}

// Define fixed positions for initial paper bits to match the image
const paperPileCenterInBowlY = (BOWL_Y_OFFSET_FROM_CENTER - (NEW_BOWL_HEIGHT_PX / 2) + 70);

const initialPaperBitConfigs: PaperBitConfig[] = [
  // Bottom layer (less visible)
  { id: 0, text: "Love Note 1", messageIndex: 0, x: -10, yBaseOffset: 15, rotate: 5, zIndex: 6 },
  { id: 1, text: "Love Note 2", messageIndex: 1, x: 10, yBaseOffset: 18, rotate: -3, zIndex: 7 },
  { id: 2, text: "Love Note 3", messageIndex: 2, x: -20, yBaseOffset: 12, rotate: 15, zIndex: 8 },
  { id: 3, text: "Love Note 4", messageIndex: 3, x: 25, yBaseOffset: 20, rotate: -10, zIndex: 9 },
  { id: 4, text: "Love Note 5", messageIndex: 4, x: -5, yBaseOffset: 22, rotate: 2, zIndex: 10 },
  { id: 5, text: "Love Note 6", messageIndex: 5, x: 15, yBaseOffset: 10, rotate: -8, zIndex: 11 },
  { id: 6, text: "Love Note 7", messageIndex: 6, x: 5, yBaseOffset: 25, rotate: 12, zIndex: 12 },
  // Top 3 visible bits from image (highest zIndex)
  { id: 7, text: "Love Note 8", messageIndex: 7, x: 38, yBaseOffset: 2, rotate: 10, zIndex: 13 }, // Rightmost in image
  { id: 8, text: "Love Note 9", messageIndex: 8, x: 0, yBaseOffset: 0, rotate: -6, zIndex: 14 }, // Center in image
  { id: 9, text: "Love Note 10", messageIndex: 9, x: -35, yBaseOffset: -5, rotate: 7, zIndex: 15 }, // Leftmost in image
];


interface PaperBitState {
  id: number;
  message: string;
  text: string;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
  zIndex: number;
  isChosenForOpening?: boolean;
  transitionDurationMs?: number;
}

const mapConfigToState = (config: PaperBitConfig): PaperBitState => ({
  id: config.id,
  message: heartfeltMessages[config.messageIndex % heartfeltMessages.length],
  text: config.text,
  x: config.x,
  y: paperPileCenterInBowlY + config.yBaseOffset,
  rotate: config.rotate,
  scale: INITIAL_PAPER_BIT_SCALE,
  opacity: 1,
  zIndex: config.zIndex,
  transitionDurationMs: ANIMATION_DURATION_MS,
});

const getInitialPaperBitsState = (): PaperBitState[] => {
  return initialPaperBitConfigs.map(mapConfigToState);
};


const App: React.FC = () => {
  const [paperBits, setPaperBits] = useState<PaperBitState[]>(getInitialPaperBitsState);
  const [appStatus, setAppStatus] = useState<'initial' | 'shuffling' | 'selected' | 'opened'>('initial');
  const [openedPaperContent, setOpenedPaperContent] = useState<PaperBitState | null>(null);
  const [unseenNoteIds, setUnseenNoteIds] = useState<number[]>(() => initialPaperBitConfigs.map(config => config.id));
  const shuffleButtonRef = useRef<HTMLButtonElement>(null);
  const shuffleIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
      }
    };
  }, []);

  const handleShuffle = () => {
    if (appStatus === 'shuffling' || appStatus === 'selected') return;

    setAppStatus('shuffling');
    setOpenedPaperContent(null);

    if (shuffleIntervalRef.current) {
      clearInterval(shuffleIntervalRef.current);
    }
    
    const circleCenterY = -(CIRCLE_RADIUS * CIRCLE_Y_OFFSET_FACTOR);

    setPaperBits(prevBits =>
      prevBits.map((bit, index) => {
        const angle = (index / NUM_PAPER_BITS) * 2 * Math.PI + Math.PI / NUM_PAPER_BITS;
        const currentBitConfig = initialPaperBitConfigs.find(b => b.id === bit.id) || initialPaperBitConfigs[0];
        return {
          ...bit, 
          x: CIRCLE_RADIUS * Math.cos(angle),
          y: circleCenterY + (CIRCLE_RADIUS * Math.sin(angle)),
          rotate: (Math.random() - 0.5) * 15,
          scale: 1,
          opacity: 1,
          zIndex: 20 + currentBitConfig.id,
          isChosenForOpening: false,
          transitionDurationMs: ANIMATION_DURATION_MS,
        };
      })
    );

    setTimeout(() => {
      setPaperBits(prevBitsInCircle => prevBitsInCircle.map(b => ({
          ...b,
          transitionDurationMs: SHUFFLE_UPDATE_INTERVAL_MS,
      })));

      shuffleIntervalRef.current = setInterval(() => {
        setPaperBits(prevBitsToShuffle =>
          prevBitsToShuffle.map((bit) => {
            const maxShuffleOffsetX = CIRCLE_RADIUS * 1.1;
            const maxShuffleOffsetY = CIRCLE_RADIUS * 0.5;

            const newTargetX = (Math.random() - 0.5) * 2 * maxShuffleOffsetX;
            const newTargetY = circleCenterY + (Math.random() - 0.5) * 2 * maxShuffleOffsetY;

            return {
              ...bit,
              x: newTargetX,
              y: newTargetY,
              rotate: (Math.random() - 0.5) * 45,
              transitionDurationMs: SHUFFLE_UPDATE_INTERVAL_MS,
            };
          })
        );
      }, SHUFFLE_UPDATE_INTERVAL_MS);

      setTimeout(() => {
        if (shuffleIntervalRef.current) {
          clearInterval(shuffleIntervalRef.current);
          shuffleIntervalRef.current = null;
        }

        let idsToPickFrom = unseenNoteIds;
        if (idsToPickFrom.length === 0) {
          const allIds = initialPaperBitConfigs.map(config => config.id);
          setUnseenNoteIds(allIds); 
          idsToPickFrom = allIds;   
        }

        const randomIndexOfAvailable = Math.floor(Math.random() * idsToPickFrom.length);
        const selectedNoteIdToHighlight = idsToPickFrom[randomIndexOfAvailable];
        
        const newUnseenIds = idsToPickFrom.filter(id => id !== selectedNoteIdToHighlight);
        setUnseenNoteIds(newUnseenIds);
        
        setPaperBits(prevBitsAfterShuffle => {
          const bitsToUpdate = [...prevBitsAfterShuffle];
          const finalBitsState: PaperBitState[] = new Array(NUM_PAPER_BITS);
          
          const selectedBitData = bitsToUpdate.find(b => b.id === selectedNoteIdToHighlight);
          if (!selectedBitData) { 
            console.error("Selected bit not found during selection phase with ID:", selectedNoteIdToHighlight);
            return prevBitsAfterShuffle; 
          }

          const selectedBitCurrentArrayIndex = bitsToUpdate.findIndex(b => b.id === selectedNoteIdToHighlight);
          if (selectedBitCurrentArrayIndex === -1) {
              console.error("Selected bit's current array index not found. ID:", selectedNoteIdToHighlight);
              return prevBitsAfterShuffle;
          }
          
          finalBitsState[selectedBitCurrentArrayIndex] = {
            ...selectedBitData,
            x: 0,
            y: circleCenterY,
            scale: 1.25,
            opacity: 1,
            zIndex: 100,
            isChosenForOpening: true,
            transitionDurationMs: ANIMATION_DURATION_MS,
          };
          
          const otherBitsOriginal = bitsToUpdate.filter(b => b.id !== selectedNoteIdToHighlight);
          let otherBitPlacementIndex = 0;

          for(let i=0; i < NUM_PAPER_BITS; i++) {
              if (i === selectedBitCurrentArrayIndex) continue; 
              
              if (otherBitPlacementIndex < otherBitsOriginal.length) {
                const originalBitForThisSlot = otherBitsOriginal[otherBitPlacementIndex];
                const angle = (otherBitPlacementIndex / (NUM_PAPER_BITS - 1)) * 2 * Math.PI;
                finalBitsState[i] = { 
                  ...originalBitForThisSlot,
                  x: CIRCLE_RADIUS * Math.cos(angle),
                  y: circleCenterY + (CIRCLE_RADIUS * Math.sin(angle)),
                  scale: 0.9,
                  opacity: 0.75,
                  zIndex: 20 + originalBitForThisSlot.id,
                  isChosenForOpening: false,
                  transitionDurationMs: ANIMATION_DURATION_MS,
                };
                otherBitPlacementIndex++;
              }
          }
          return finalBitsState.filter(bit => bit !== undefined);
        });
        setAppStatus('selected');
      }, SHUFFLE_HOLD_DURATION_MS);

    }, ANIMATION_DURATION_MS);
  };

  const handlePaperTap = (tappedBit: PaperBitState) => {
    if (appStatus !== 'selected' || !tappedBit.isChosenForOpening) return;

    setOpenedPaperContent(tappedBit);
    setAppStatus('opened');

    setPaperBits(prevBits =>
      prevBits.map(bit => {
        const duration = ANIMATION_DURATION_MS * 0.5;
        if (bit.id === tappedBit.id) {
          return { ...bit, opacity: 0, scale: 0.8, transitionDurationMs: duration };
        }
        return {
            ...bit,
            opacity: 0.1,
            scale: 0.5,
            zIndex: 10 + bit.id,
            transitionDurationMs: duration,
         };
      })
    );
  };

  const handleClosePaper = () => {
    const paperElement = document.getElementById('openedPaperModalContent');
    if (paperElement) {
        paperElement.classList.remove('opened-paper-enter');
        paperElement.classList.add('opened-paper-exit');
    }

    setTimeout(() => {
        setAppStatus('initial');
        setOpenedPaperContent(null);
        setPaperBits(getInitialPaperBitsState()); // Reset visual state of paper bits
        // DO NOT reset unseenNoteIds here, to maintain cycle across shuffles.

        if (shuffleButtonRef.current) {
            shuffleButtonRef.current.focus();
        }
    }, 280);
  };

  const isButtonDisabled = appStatus === 'shuffling';

  return (
    <div className="relative w-full min-h-screen flex flex-col justify-center items-center overflow-hidden select-none p-4" aria-live="polite">
      {paperBits.map(bit => (
        <div
          key={bit.id}
          role="button"
          tabIndex={appStatus === 'selected' && bit.isChosenForOpening ? 0 : -1}
          aria-label={bit.isChosenForOpening ? `Tap to open ${bit.text}` : bit.text}
          onClick={() => handlePaperTap(bit)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePaperTap(bit)}
          className={`paper-bit absolute flex flex-col justify-center items-center w-28 h-16 bg-amber-50 border border-amber-200 shadow-md rounded-sm cursor-pointer p-1 text-amber-700 text-sm font-semibold ${ (appStatus === 'selected' && bit.isChosenForOpening) ? 'hover:shadow-xl hover:scale-[1.02]' : '' }`}
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${bit.x}px, ${bit.y}px) rotate(${bit.rotate}deg) scale(${bit.scale})`,
            opacity: bit.opacity,
            zIndex: bit.zIndex,
            transition: `transform ${bit.transitionDurationMs || ANIMATION_DURATION_MS}ms ease-in-out, opacity ${bit.transitionDurationMs || ANIMATION_DURATION_MS * 0.7}ms ease-in-out`,
          }}
        >
          <span>{bit.text}</span>
          {appStatus === 'selected' && bit.isChosenForOpening && (
            <span className="absolute -bottom-5 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded-sm tap-to-open-prompt whitespace-nowrap">
              Tap to open
            </span>
          )}
        </div>
      ))}

      <div
        className="absolute left-1/2 transform -translate-x-1/2"
        style={{
            top: `calc(50% + ${BOWL_Y_OFFSET_FROM_CENTER}px - ${NEW_BOWL_HEIGHT_PX / 2}px)`,
            zIndex: 5
        }}
        aria-hidden="true"
      >
        <svg 
            viewBox="0 0 300 204" 
            className="w-72 h-[13rem]"
            shapeRendering="geometricPrecision"
        >
            <defs>
              <filter id="bowlShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000000" floodOpacity="0.15" />
              </filter>
            </defs>
            <g filter="url(#bowlShadow)">
                <path d="M9,78 C9,174 45,204 150,204 C255,204 291,174 291,78 Z"
                      className="text-amber-800" fill="currentColor" />
                <ellipse cx="150" cy="75" rx="141" ry="48"
                         className="text-amber-600" fill="currentColor"/>
                <ellipse cx="150" cy="78" rx="120" ry="33"
                         className="text-amber-700" fill="currentColor"/>
                <path d="M60,57 C105,69 195,69 240,57"
                      stroke="rgba(255,255,255,0.3)" strokeWidth="7.5" fill="none" strokeLinecap="round"/>
            </g>
        </svg>
      </div>

      <button
        ref={shuffleButtonRef}
        onClick={handleShuffle}
        disabled={isButtonDisabled}
        className="absolute left-1/2 transform -translate-x-1/2 mt-4 px-10 py-4 text-lg bg-pink-500 text-white font-bold rounded-lg shadow-md hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-opacity-75 transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ top: `calc(50% + ${BOWL_Y_OFFSET_FROM_CENTER + (NEW_BOWL_HEIGHT_PX / 2) + 30}px)` }}
        aria-label="Shuffle messages"
      >
        Shuffle
      </button>

      {appStatus === 'opened' && openedPaperContent && (
        <div
            id="openedPaperModal"
            className="fixed inset-0 bg-black/60 flex justify-center items-center z-[200]"
            onClick={handleClosePaper}
            aria-modal="true"
            aria-labelledby="paperTitle"
            aria-describedby="paperMessageContent"
        >
          <div
            id="openedPaperModalContent"
            className="bg-rose-50 p-8 pt-12 rounded-lg shadow-2xl max-w-lg w-[90%] aspect-[4/3] relative flex flex-col justify-center items-center text-center text-rose-800 opened-paper-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="paperTitle" className="text-2xl font-bold mb-4">{openedPaperContent.text} Reveals:</h2>
            <p id="paperMessageContent" className="text-xl md:text-2xl leading-relaxed">
              "{openedPaperContent.message}"
            </p>
            <button
              onClick={handleClosePaper}
              className="absolute top-3 right-3 text-3xl text-rose-500 hover:text-rose-700 transition-colors"
              aria-label="Close message"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
