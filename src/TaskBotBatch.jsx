import React, { useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import './TaskBotBatch.css';
import ProjectHeader from './ProjectHeader';

function TaskBotBatch({ apiConfig }) {
  const [taskDescription, setTaskDescription] = useState('Extract the output below from the provided text');
  const [outputFields, setOutputFields] = useState([{ key: '', description: '' }]);
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [promptTemplate, setPromptTemplate] = useState('');
  
  const [log, setLog] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rightColumnView, setRightColumnView] = useState('template'); // 'template', 'results'

  const logStatus = useCallback((message, type = 'info') => {
    setLog(prevLog => [{ message, type, timestamp: new Date() }, ...prevLog]);
  }, []);

  useEffect(() => {
    if (!apiConfig) {
      logStatus('API Configuration is not set. Please configure it from the home page.', 'error');
    }
  }, [apiConfig, logStatus]);

  const addOutputField = () => {
    setOutputFields([...outputFields, { key: '', description: '' }]);
  };

  const removeOutputField = (index) => {
    if (outputFields.length > 1) {
      const newFields = [...outputFields];
      newFields.splice(index, 1);
      setOutputFields(newFields);
    }
  };

  const handleOutputFieldChange = (index, event) => {
    const newFields = [...outputFields];
    newFields[index][event.target.name] = event.target.value;
    setOutputFields(newFields);
  };

  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setCsvFile(file);
      setPromptTemplate('');
      logStatus(`File selected: ${file.name}`);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvHeaders(results.meta.fields);
          setCsvData(results.data);
          logStatus(`CSV parsed: ${results.data.length} rows, ${results.meta.fields.length} columns.`);
          setRightColumnView('template');
        },
        error: (error) => {
          logStatus(`Error parsing CSV: ${error.message}`, 'error');
        }
      });
    }
  };

  const handleGenerateTemplate = async () => {
    if (!apiConfig) {
      logStatus('Cannot generate template: API Configuration is not set.', 'error');
      return;
    }

    if (!csvFile || !taskDescription) {
      logStatus('Please upload a CSV and provide a task description first.', 'error');
      return;
    }

    setIsSuggesting(true);
    logStatus('Generating prompt template...');

    const columnsDescription = csvHeaders.join(', ');
    const sampleData = Papa.unparse(csvData.slice(0, 2), { header: true });

    const outputFieldsDescription = outputFields.map(field => {
      return `- "${field.key}": ${field.description || 'No description provided.'}`;
    }).join('\n');

    const suggestionsPrompt = `
I have a CSV file with the following columns:
${columnsDescription}

Here is the first row:
${sampleData}

I want to use this data for the following task:
${taskDescription}

I also need to extract the following information as output fields:
${outputFieldsDescription}

Based on the available columns, the task description, and the required output fields, please suggest a prompt template.
The template should use {column_name} syntax for placeholders and *only* include the columns from the CSV that are necessary as *inputs* to accomplish the task and derive the specified output fields. Do not include any extraneous columns or columns that are not direct inputs.

**Format the promptTemplate as follows:**

Task: [Your task description here]

Inputs:
- {column_1}
- {column_2}
...

Provide your response in XML format like this:
<suggestion>
  <promptTemplate>Your suggested template with all relevant {columns}</promptTemplate>
</suggestion>
`;

    try {
      const result = await callLLMAPI(suggestionsPrompt);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(result, "text/xml");
      const templateElement = xmlDoc.querySelector('promptTemplate');
      if (templateElement && templateElement.textContent) {
        setPromptTemplate(templateElement.textContent.trim());
        logStatus('Prompt template generated successfully.', 'success');
      } else {
        throw new Error("Could not find <promptTemplate> in the LLM response.");
      }
    } catch (error) {
      logStatus(`Error generating template: ${error.message}`, 'error');
      setPromptTemplate(''); // Clear template on error
    } finally {
      setIsSuggesting(false);
    }
  };

  const callLLMAPI = async (prompt) => {
    if (!apiConfig) {
        throw new Error("API configuration is missing.");
    }
    const response = await fetch(apiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  const parseOutputXML = (xmlString) => {
    const result = {};
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    for (const field of outputFields) {
      const element = xmlDoc.querySelector(field.key);
      result[field.key] = element ? element.textContent : '';
    }
    return result;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!apiConfig) {
        logStatus('Cannot process task: API Configuration is not set.', 'error');
        return;
    }

    if (!csvData.length) {
      logStatus('Please upload a CSV file.', 'error');
      return;
    }
    if (outputFields.some(f => !f.key)) {
      logStatus('All output field keys are required.', 'error');
      return;
    }
    if (!promptTemplate) {
      logStatus('Prompt template is empty. Please generate one first.', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessedData([]);
    setProgress(0);
    setRightColumnView('template'); // Keep template visible
    logStatus('Starting batch processing...', 'success');

    const tempProcessedData = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      let rowPrompt = promptTemplate;
      for (const [key, value] of Object.entries(row)) {
        rowPrompt = rowPrompt.replace(new RegExp(`{${key}}`, 'g'), value);
      }

      const xmlFormat = `<output>${outputFields.map(f => `<${f.key}></${f.key}>`).join('')}</output>`;
      const finalPrompt = `${rowPrompt}\n\nReturn your response using the following XML format:\n${xmlFormat}`;

      try {
        logStatus(`Processing row ${i + 1}/${csvData.length}...`);
        const result = await callLLMAPI(finalPrompt);
        const parsedResult = parseOutputXML(result);
        tempProcessedData.push({ ...row, ...parsedResult });
      } catch (error) {
        logStatus(`Error processing row ${i + 1}: ${error.message}`, 'error');
        const errorResult = outputFields.reduce((acc, field) => ({ ...acc, [field.key]: 'ERROR' }), {});
        tempProcessedData.push({ ...row, ...errorResult });
      }
      
      setProgress(Math.round(((i + 1) / csvData.length) * 100));
    }

    setProcessedData(tempProcessedData);
    setIsProcessing(false);
    setRightColumnView('results');
    logStatus('Batch processing complete.', 'success');
  };

  const downloadProcessedCsv = () => {
    const csv = Papa.unparse(processedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'processed_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logStatus('Downloaded processed CSV.', 'success');
  };

  return (
    <div className="taskbot-batch-container">
      <ProjectHeader 
        title="TaskBot [Batch]"
        description="Process a CSV of inputs against an LLM in a single batch operation."
      />
      <div className="main-content-grid">
        <form className="taskbot-form" onSubmit={handleSubmit}>
          <div className="form-content-wrapper">
            <div className="form-group">
              <label htmlFor="task-description">Task Description</label>
              <textarea id="task-description" className="form-control" rows="3" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Describe the task for the AI..." required></textarea>
            </div>
            <div className="form-group">
              <label htmlFor="csv-file">Upload CSV File</label>
              <input type="file" id="csv-file" className="form-control" accept=".csv" onChange={handleCsvUpload} required />
              {csvFile && <p className="file-info">Selected: {csvFile.name}</p>}
            </div>
            <div className="form-group">
              <label>Output Fields</label>
              {outputFields.map((field, index) => (
                <div className="output-field" key={index}>
                  <input type="text" name="key" className="form-control" placeholder="Key" value={field.key} onChange={(e) => handleOutputFieldChange(index, e)} required />
                  <input type="text" name="description" className="form-control" placeholder="Description (optional)" value={field.description} onChange={(e) => handleOutputFieldChange(index, e)} />
                  {outputFields.length > 1 && <button type="button" className="remove-button" onClick={() => removeOutputField(index)}>&times;</button>}
                </div>
              ))}
              <button type="button" className="glass-button add-field-button" onClick={addOutputField}>+ Add Field</button>
            </div>
          </div>

          <button type="submit" className="glass-button-glow submit-button" disabled={isProcessing || csvData.length === 0 || !apiConfig}>
            {isProcessing ? `Processing... ${progress}%` : 'Process Batch'}
          </button>
        </form>

        <div className="right-column">
          <div className="right-column-main-content">
            {rightColumnView === 'template' && (
              <div className="template-container">
                <div className="form-group">
                  <label htmlFor="prompt-template">Generate prompt template (editable):</label>
                  <button type="button" className="glass-button generate-button" onClick={handleGenerateTemplate} disabled={isSuggesting || !csvFile || !taskDescription || !apiConfig}>
                    {isSuggesting ? 'Generating...' : 'Generate Prompt Template'}
                  </button>
                  <textarea id="prompt-template" className="form-control" rows="10" value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)}></textarea>
                  <div className="available-columns">
                    <p>Available columns: {csvHeaders.map(h => <code key={h}>{`{${h}}`}</code>)}</p>
                  </div>
                </div>
              </div>
            )}

            {rightColumnView === 'results' && processedData.length > 0 && (
              <div className="results-container">
                <h2>Results</h2>
                <div className="csv-preview">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(processedData[0]).map(key => <th key={key}>{key}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {processedData.map((row, index) => (
                        <tr key={index}>
                          {Object.entries(row).map(([key, value]) => <td key={key}>{String(value)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="glass-button" onClick={downloadProcessedCsv}>Download Processed CSV</button>
              </div>
            )}
          </div>
          <div className="status-log">
            {log.map((entry, index) => (
              <div key={index} className={`log-entry log-${entry.type}`}>
                <span className="log-timestamp">{entry.timestamp.toLocaleTimeString()}</span>
                {entry.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskBotBatch;