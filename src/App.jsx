import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import './App.css';
import TaskBot from './TaskBot';
import TaskBotBatch from './TaskBotBatch';
import ApiConfig from './ApiConfig';
import TalkToCharacter from './TalkToCharacter';

const projects = [
  {
    name: 'TaskBot',
    description: 'Connect to any LLM, define your output, and get structured data for any task.',
    path: '/taskbot'
  },
  {
    name: 'TaskBot [Batch]',
    description: 'Process a CSV of inputs against an LLM in a single batch operation.',
    path: '/taskbot-batch'
  },
  {
    name: 'Talk to Character',
    description: 'Talk to your favourite book characters, immerse in their universe',
    path: '/talk-to-character'
  },  
];

function Home() {
  return (
    <div className="content">
      <header className="App-header">
        <h1>LLM Playground</h1>
        <p>A collection of my LLM projects.</p>
      </header>
      <div className="project-list">
        {projects.map(project => (
          <Link to={project.path} className="project-card" key={project.name}>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [isApiConfigOpen, setIsApiConfigOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState(null);

  useEffect(() => {
    const storedConfig = localStorage.getItem('apiConfig');
    if (storedConfig) {
      setApiConfig(JSON.parse(storedConfig));
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      document.documentElement.style.setProperty('--mouse-x', `${clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${clientY}px`);
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const handleApiConfigSave = (config) => {
    setApiConfig(config);
  };

  return (
    <div className="App">
      <button onClick={() => setIsApiConfigOpen(true)} className="api-config-button" title="API Configuration">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.2,5.22C8.61,5.46,8.08,5.78,7.58,6.16L5.19,5.2C4.97,5.12,4.72,5.2,4.6,5.42L2.68,8.74 c-0.11,0.2-0.06,0.47,0.12,0.61l2.03,1.58C4.77,11.36,4.75,11.68,4.75,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.41 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.48-0.41l0.36-2.41c0.59-0.24,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      <div className="interactive-background"></div>
      <div className="interactive-background2"></div>
      <div className="interactive-background3"></div>
      {isApiConfigOpen && (
        <ApiConfig
          onSave={handleApiConfigSave}
          onClose={() => setIsApiConfigOpen(false)}
        />
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/taskbot" element={<TaskBot apiConfig={apiConfig} />} />
        <Route path="/taskbot-batch" element={<TaskBotBatch apiConfig={apiConfig} />} />
        <Route path="/talk-to-character" element={<TalkToCharacter apiConfig={apiConfig} />} />
      </Routes>
    </div>
  );
}

export default App;

