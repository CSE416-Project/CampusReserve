import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AccessibilityWidget, { SkipLink } from './a11y/AccessibilityWidget.jsx';
import { applySavedSettings } from './a11y/settings.js';
import './index.css';
import './a11y/a11y.css';

// Apply saved accessibility settings before the first paint, so the page never
// flashes with the wrong colors or size.
applySavedSettings();

createRoot(document.getElementById('root')).render(<><SkipLink /><App /></>);
// The accessibility button and panel get their own root outside #root, so page
// zoom and "hide images" never affect the panel itself.
createRoot(document.getElementById('a11y-root')).render(<AccessibilityWidget />);