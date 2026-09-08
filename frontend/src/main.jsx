import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Catch and suppress unhandled errors from browser extensions / injected VM scripts (e.g. Web Vitals / performance extension scripts)
window.addEventListener('error', (event) => {
    if (
        event.filename?.includes('VM') ||
        !event.filename ||
        event.message?.includes('reportAllChanges') ||
        event.message?.includes("reading 'startTime'")
    ) {
        event.stopImmediatePropagation();
    }
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
