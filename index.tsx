import React from 'react';
import InteractiveBowlSection from './src/InteractiveBowlSection'; // Adjusted path

// No longer needed here: createRoot, useState, useEffect, useRef, useCallback
// No longer needed here: All constants, interfaces, and functions related to the bowl interaction

const App = () => {
  // The App component now only handles the overall page structure
  // and the Memories section.

  // These might be needed if Memories section becomes responsive or has its own state in the future
  // const windowSize = useWindowSize(); // If useWindowSize is moved to a shared util or also here
  // const isSmallScreen = windowSize.width < 640;

  return (
    // Outer container: flex flex-col to stack sections, min-h-screen for scrollability
    <div className="w-full min-h-screen flex flex-col select-none" aria-live="polite">
      {/* Top Interactive Bowl Section: h-screen and flex-shrink-0 to prevent shrinking */}
      <div className="relative w-full h-screen flex-shrink-0">
        {/* Split container for title, heart model, and bowl */}
        <div className="absolute inset-0 flex flex-col">
          {/* Title area - fixed height for the title */}
          <div className="h-16 sm:h-24 w-full relative" />
          
          {/* Spline Diamond Heart Container - centered in available space */}
          <div className="flex-grow relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full sm:w-3/4 md:w-2/3 lg:w-1/2 aspect-square relative">
                <iframe 
                  src='https://my.spline.design/diamondheart-hbQN0gppfiSZommAeSl9XaMX/' 
                  frameBorder='0' 
                  width='100%' 
                  height='100%'
                  title="Diamond Heart Background"
                  style={{ pointerEvents: 'none' }}
                />
              </div>
            </div>
          </div>
          
          {/* Space for bowl at bottom - approximate height needed */}
          <div className="h-40 sm:h-52 md:h-64 w-full relative" />
        </div>
        
        {/* Bowl section with z-index to ensure it appears properly */}
        <div className="relative z-10 w-full h-full">
          <InteractiveBowlSection />
        </div>
      </div>

      {/* Divider: Normal flow, with minimal vertical margin */}
      <hr className="border-t-2 border-rose-300 mt-0 mb-1 mx-auto max-w-3xl" />

      {/* Memories Section: Normal flow, with padding */}
      <div className="w-full max-w-3xl mx-auto px-6 sm:px-8 pb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-rose-700/80 mb-8 text-center">
          Memories
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 16 }).map((_, index) => (
            <div
              key={`memory-cube-${index}`}
              className="aspect-square bg-slate-300/50 rounded-lg shadow-md flex justify-center items-center"
              aria-label={`Memory ${index + 1}`}
            >
              {index % 2 === 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-1/2 w-1/2 text-slate-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-1/2 w-1/2 text-slate-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal is now part of InteractiveBowlSection */}
    </div>
  );
};

export default App;
