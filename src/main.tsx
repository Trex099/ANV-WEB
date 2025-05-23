import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../index'; // Corrected path to index.tsx
import '../index.css'; // Corrected path to index.css
import './interactive-section.css'; // Import new CSS file

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Failed to find the root element');
} 