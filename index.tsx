import React from 'react';
import InteractiveBowlSection from './src/InteractiveBowlSection';
import NetflixBackground from './src/NetflixBackground';

const App = () => {
  return (
    <>
      {/* Netflix-style background positioned behind everything */}
      <NetflixBackground />
      
      <div className="w-full min-h-screen flex flex-col select-none relative" aria-live="polite">
        {/* Top Interactive Bowl Section: h-screen and flex-shrink-0 to prevent shrinking */}
        <div className="relative w-full h-screen flex-shrink-0">
          {/* Bowl section with normal structure */}
          <InteractiveBowlSection />
        </div>
      </div>
    </>
  );
};

export default App;
