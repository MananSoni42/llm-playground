import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './TaskBot.css';

function TaskBot() {
  const [apiUrl, setApiUrl] = useState('https://api.openai.com/v1/chat/completions');
  const [authToken, setAuthToken] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [outputFields, setOutputFields] = useState([{ key: '', description: '' }]);
  const [log, setLog] = useState([]);
  const [resultData, setResultData] = useState(null);
  const [isJsonVisible, setIsJsonVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopyJson = async () => {
    if (resultData) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(resultData, null, 2));
        logMessage('JSON copied to clipboard!', 'success');
      } catch (err) {
        logMessage('Failed to copy JSON: ' + err, 'error');
      }
    }
  };

  const addField = () => {
    setOutputFields([...outputFields, { key: '', description: '' }]);
  };

  const removeField = (index) => {
    const newFields = [...outputFields];
    newFields.splice(index, 1);
    setOutputFields(newFields);
  };

  const handleFieldChange = (index, event) => {
    const newFields = [...outputFields];
    newFields[index][event.target.name] = event.target.value;
    setOutputFields(newFields);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setLog([]);
    setResultData(null);

    const logMessage = (message, type = 'info') => {
        setLog(prevLog => [...prevLog, { message, type }]);
      };

      const filledOutputFields = outputFields.filter(field => field.key.trim() !== '');

      if (filledOutputFields.length === 0) {
        logMessage('Error: At least one output field is required', 'error');
        setIsLoading(false);
        return;
      }

    const generatePrompt = (taskDescription, outputFields) => {
      const fieldDescriptions = outputFields.map(field => {
        return `- "${field.key}": ${field.description || 'No description provided'}`;
      }).join('\n');

      return `Task: ${taskDescription}\n\nPlease provide your response as structured data with the following fields:\n${fieldDescriptions}\n\nFormat your response as XML with each field wrapped in its own tag like this:
<output>
${outputFields.map(field => `  <${field.key}>${field.description || 'value'}</${field.key}>`).join('\n')}
</output>\n\nIMPORTANT: Only include the exact fields requested, with no additional text or explanation outside the <output> tags.`;
    };

    const prompt = generatePrompt(taskDescription, filledOutputFields);

    try {
      logMessage('Sending request to API...');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are a helpful assistant that generates structured outputs." },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;

      if (!responseText) {
        throw new Error('No response text from API');
      }

      logMessage('Received response, parsing output...');
      const outputMatch = responseText.match(/<output>([\s\S]*?)<\/output>/i);

      if (!outputMatch || !outputMatch[1]) {
        throw new Error('Could not find <output> tags in response');
      }

      const outputContent = outputMatch[1];
      const result = {};
      const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
      let match;

      while ((match = tagRegex.exec(outputContent)) !== null) {
        const [, key, value] = match;
        result[key] = value.trim();
      }

      setResultData(result);
      logMessage('Successfully processed task!', 'success');

    } catch (error) {
      logMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="content taskbot-container">
      <Link to="/" className="back-link"> &larr; Back to Home</Link>
      <header className="App-header">
        <h1>TaskBot</h1>
        <p>TaskBot empowers you to connect to any LLM API and transform unstructured text into predictable, structured data. Simply describe the task, define the output fields you need, and TaskBot will handle the rest, ensuring you get consistent, machine-readable results every time.</p>
      </header>

      <div className="main-content-grid">
        <form className="taskbot-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="api-url">API URL</label>
            <input type="text" id="api-url" className="form-control" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="auth-token">Auth Token</label>
            <input type="password" id="auth-token" className="form-control" value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="task-description">Task Description</label>
            <textarea id="task-description" className="form-control" rows="3" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)}></textarea>
          </div>

          <div className="form-group">
            <label>Output Fields</label>
            <div className="output-field-wrapper">
              {outputFields.map((field, index) => (
                <div className="output-field" key={index}>
                  <input
                    type="text"
                    name="key"
                    className="form-control"
                    placeholder="Key"
                    value={field.key}
                    onChange={(e) => handleFieldChange(index, e)}
                  />
                  <input
                    type="text"
                    name="description"
                    className="form-control"
                    placeholder="Description (optional)"
                    value={field.description}
                    onChange={(e) => handleFieldChange(index, e)}
                  />
                  <button type="button" className="btn btn-danger" onClick={() => removeField(index)}>
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={addField}>
              Add Field
            </button>
          </div>

          <button type="submit" className="btn btn-success" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Process Task'}
          </button>
        </form>

        <div className="right-column">
          <div className="status-log">
            {log.map((entry, index) => (
              <div key={index} className={`log-entry log-${entry.type}`}>
                {entry.message}
              </div>
            ))}
          </div>

          {resultData && (
            <div className="results-container">
              <div className="results-header">
                <h2>Results</h2>
                <div className="results-actions">
                  <button className="btn btn-secondary" onClick={() => setIsJsonVisible(!isJsonVisible)}>
                    {isJsonVisible ? 'Show Table' : 'Show JSON'}
                  </button>
                  <button className="btn btn-secondary" onClick={handleCopyJson}>Copy JSON</button>
                </div>
              </div>

              {isJsonVisible ? (
                <pre className="json-result">{JSON.stringify(resultData, null, 2)}</pre>
              ) : (
                <table className="table-result">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(resultData).map(([key, value]) => (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskBot;
