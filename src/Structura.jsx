import React, { useState, useEffect, useCallback } from 'react';
import './Structura.css';
import ProjectHeader from './ProjectHeader';

function Structura({ apiConfig }) {
  const [taskDescription, setTaskDescription] = useState('');
  const [outputFields, setOutputFields] = useState([{ key: '', description: '' }]);
  const [log, setLog] = useState([]);
  const [resultData, setResultData] = useState(null);
  const [isJsonVisible, setIsJsonVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const logMessage = useCallback((message, type = 'info') => {
    setLog(prevLog => [{ message, type }, ...prevLog]);
  }, []);

  useEffect(() => {
    if (!apiConfig) {
      logMessage('API Configuration is not set. Please configure it from the home page.', 'error');
    }
  }, [apiConfig, logMessage]);

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

    if (!apiConfig) {
      logMessage('Cannot process task: API Configuration is not set.', 'error');
      return;
    }

    setIsLoading(true);
    setLog([]);
    setResultData(null);

    const filledOutputFields = outputFields.filter(field => field.key.trim() !== '');

    if (filledOutputFields.length === 0) {
      logMessage('Error: At least one output field is required', 'error');
      setIsLoading(false);
      return;
    }

    const generatePrompt = (taskDescription, outputFields) => {
      const fieldDescriptions = outputFields.map(field => {
        return `- \"${field.key}\": ${field.description || 'No description provided'}`;
      }).join('\n');

      return `Task: ${taskDescription}\n\nPlease provide your response as structured data with the following fields:\n${fieldDescriptions}\n\nFormat your response as XML with each field wrapped in its own tag like this:
<output>
${outputFields.map(field => `  <${field.key}>${field.description || 'value'}</${field.key}>`).join('\n')}
</output>\n\nIMPORTANT: Only include the exact fields requested, with no additional text or explanation outside the <output> tags.`;
    };

    const prompt = generatePrompt(taskDescription, filledOutputFields);

    try {
      logMessage('Sending request to API...');
      const response = await fetch(apiConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model,
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

    } catch (error)
{
      logMessage(`Error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="content structura-container">
      <ProjectHeader 
        title="Structura"
        description="A tool to connect with any LLM, define your desired output schema, and get perfectly structured results every time—no matter the task."
      />
      <div className="main-content-grid">
        <form className="structura-form" onSubmit={handleSubmit}>
          <div className="form-group-scrollable">
            <div className="form-group">
              <label htmlFor="task-description">Task Description</label>
              <textarea id="task-description" className="form-control" rows="3" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)}></textarea>
            </div>

            <div className="form-group output-fields-container">
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
                    <button type="button" className="remove-button" onClick={() => removeField(index)}>
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="glass-button add-field-button" onClick={addField}>
                Add Field
              </button>
            </div>
          </div>

          <button type="submit" className="glass-button-glow submit-button" disabled={isLoading || !apiConfig}>
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
                  <button className="glass-button" onClick={() => setIsJsonVisible(!isJsonVisible)}>
                    {isJsonVisible ? 'Show Table' : 'Show JSON'}
                  </button>
                  <button className="glass-button" onClick={handleCopyJson}>Copy JSON</button>
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

export default Structura;
