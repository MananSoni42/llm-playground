import { Link } from 'react-router-dom';
import './ProjectHeader.css';

function ProjectHeader({ title, description }) {
  return (
    <div className="project-header">
      <Link to="/" className="home-link">← Back to Home</Link>
      <div className="project-title-container">
        <h1 className="project-title">{title}</h1>
        <p className="project-description">{description}</p>
      </div>
    </div>
  );
}

export default ProjectHeader;
