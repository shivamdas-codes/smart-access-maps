import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles.css';

const initialMarkup = document.getElementById('root').innerHTML;

function App() {
  useEffect(() => {
    window.L = L;
    import('../legacy-app.js').catch((error) => {
      console.error('Unable to initialize the Wayfinder interface:', error);
    });
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: initialMarkup }} />;
}

createRoot(document.getElementById('root')).render(<App />);
