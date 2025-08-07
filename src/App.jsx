import { useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import './App.css';
import TaskBot from './TaskBot';

const projects = [
  {
    name: 'TaskBot',
    description: 'Send your task to any LLM API and get predictable, structured output',
    path: '/taskbot'
  },
  {
    name: 'TaskBot Batch',
    description: 'A batch version of the TaskBot.',
    path: '/taskbot_batch'
  },
  {
    name: 'Talk to Character',
    description: 'A project that lets you talk to your favorite book characters.',
    path: '/talk_to_character'
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

  return (
    <div className="App">
      <div className="interactive-background"></div>
      <div className="interactive-background2"></div>
      <div className="interactive-background3"></div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/taskbot" element={<TaskBot />} />
      </Routes>
    </div>
  );
}

export default App;

