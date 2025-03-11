// DOM Elements
const configForm = document.getElementById('taskbot-config-form');
const apiUrlInput = document.getElementById('api-url');
const authTokenInput = document.getElementById('auth-token');
const taskDescriptionInput = document.getElementById('task-description');
const outputFieldsContainer = document.getElementById('output-fields');
const addFieldBtn = document.getElementById('add-field-btn');
const csvFileInput = document.getElementById('csv-file');
const fileUploadInfo = document.getElementById('file-upload-info');
const columnMappingContainer = document.getElementById('column-mapping-container');
const columnMappingDiv = document.getElementById('column-mapping');
const submitButton = document.getElementById('submit-button');
const statusIndicator = document.getElementById('status-indicator');
const statusLog = document.getElementById('status-log');
const batchProgressContainer = document.getElementById('batch-progress-container');
const progressBar = document.getElementById('progress-bar');
const processedCount = document.getElementById('processed-count');
const totalCount = document.getElementById('total-count');
const csvPreview = document.getElementById('csv-preview');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');

// State variables
let csvData = [];
let csvHeaders = [];
let processedData = [];
let suggestionTemplate = '';
let outputFields = [];
let isProcessing = false;

// Initialize the application
function init() {
    // Load saved configuration from localStorage if available
    loadSavedConfig();
    
    // Event listeners
    addFieldBtn.addEventListener('click', addOutputField);
    csvFileInput.addEventListener('change', handleCsvUpload);
    configForm.addEventListener('submit', handleFormSubmit);
    downloadBtn.addEventListener('click', downloadProcessedCsv);
    
    // Add initial output field if none exist
    if (outputFieldsContainer.children.length === 0) {
        addOutputField();
    }
    
    // Set up event delegation for remove field buttons
    outputFieldsContainer.addEventListener('click', event => {
        if (event.target.closest('.remove-field')) {
            const fieldDiv = event.target.closest('.output-field');
            if (outputFieldsContainer.children.length > 1) {
                fieldDiv.remove();
            }
        }
    });
    
    logStatus('Application initialized. Ready to process CSV files.', 'info');
}

// Load saved configuration from localStorage
function loadSavedConfig() {
    try {
        const savedConfig = JSON.parse(localStorage.getItem('taskbotBatchConfig'));
        if (savedConfig) {
            apiUrlInput.value = savedConfig.apiUrl || '';
            authTokenInput.value = savedConfig.authToken || '';
            taskDescriptionInput.value = savedConfig.taskDescription || '';
            
            // Load saved output fields
            if (savedConfig.outputFields && savedConfig.outputFields.length > 0) {
                outputFieldsContainer.innerHTML = '';
                savedConfig.outputFields.forEach(field => {
                    addOutputField(field.key, field.description);
                });
            }
            
            logStatus('Configuration loaded from saved settings.', 'info');
        }
    } catch (error) {
        console.error('Error loading saved configuration:', error);
    }
}

// Save current configuration to localStorage
function saveConfig() {
    try {
        const outputFields = Array.from(outputFieldsContainer.children).map(field => {
            return {
                key: field.querySelector('.output-key').value,
                description: field.querySelector('.output-description').value
            };
        });
        
        const config = {
            apiUrl: apiUrlInput.value,
            authToken: authTokenInput.value,
            taskDescription: taskDescriptionInput.value,
            outputFields: outputFields
        };
        
        localStorage.setItem('taskbotBatchConfig', JSON.stringify(config));
    } catch (error) {
        console.error('Error saving configuration:', error);
    }
}

// Add a new output field
function addOutputField(key = '', description = '') {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'output-field';
    fieldDiv.innerHTML = `
        <input type="text" class="output-key" placeholder="Key" value="${key}" required>
        <input type="text" class="output-description" placeholder="Description (optional)" value="${description}">
        <button type="button" class="remove-field"><i class="fas fa-times"></i></button>
    `;
    outputFieldsContainer.appendChild(fieldDiv);
}

// Handle CSV file upload
function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        fileUploadInfo.textContent = 'No file selected';
        return;
    }
    
    fileUploadInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
    logStatus(`File selected: ${file.name}`, 'info');
    
    // Parse CSV file
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csv = e.target.result;
            parseCSV(csv);
        } catch (error) {
            logStatus(`Error parsing CSV: ${error.message}`, 'error');
        }
    };
    reader.onerror = function() {
        logStatus('Error reading the file', 'error');
    };
    reader.readAsText(file);
}

// Parse CSV content
function parseCSV(csvContent) {
    // Simple CSV parsing (can be replaced with more robust library)
    const lines = csvContent.split(/\r\n|\n/);
    
    if (lines.length < 2) {
        logStatus('CSV file must contain headers and at least one data row', 'error');
        return;
    }
    
    // Extract headers (first line)
    csvHeaders = lines[0].split(',').map(header => header.trim());
    
    // Parse data rows
    csvData = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        // Handle commas in quoted fields
        const row = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let char of lines[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        // Add the last value
        row.push(currentValue.trim());
        
        // Ensure row has the correct number of columns
        if (row.length === csvHeaders.length) {
            const rowObj = {};
            csvHeaders.forEach((header, index) => {
                rowObj[header] = row[index];
            });
            csvData.push(rowObj);
        } else {
            logStatus(`Warning: Row ${i} has ${row.length} columns, expected ${csvHeaders.length}. Row skipped.`, 'warning');
        }
    }
    
    logStatus(`CSV file parsed successfully: ${csvHeaders.length} columns, ${csvData.length} rows.`, 'success');
    
    // Ask LLM for input suggestions before displaying column mapping
    getInputSuggestions();
}

// Get input suggestions from LLM
async function getInputSuggestions() {
    try {
        logStatus('Analyzing CSV structure to suggest input formats...', 'info');
        updateStatus('processing');
        
        // Get sample data (first few rows)
        const sampleData = csvData.slice(0, 3);
        
        // Build description of available columns
        const columnsDescription = csvHeaders.map(header => {
            const values = sampleData.map(row => `"${row[header]}"`).join(', ');
            return `${header}: Sample values: ${values}`;
        }).join('\n');
        
        // Create prompt for LLM
        const suggestionsPrompt = `
        I have a CSV file with the following columns and sample data:
        
        ${columnsDescription}
        
        I want to use this data for the following task:
        ${taskDescriptionInput.value}
        
        Based on the columns and the task, please suggest:
        1. Which columns should be used as input for the task
        2. A template format for how to include these columns in the prompt
        
        Provide your response in XML format like this:
        <suggestion>
          <relevantColumns>
            <column>column_name_1</column>
            <column>column_name_2</column>
            ...
          </relevantColumns>
          <promptTemplate>Your suggested template with all relevant {columns}</promptTemplate>
        </suggestion>
        `;
        
        // Send to API
        const result = await callLLMAPI(suggestionsPrompt);
        
        // Parse XML response
        const xmlResponse = parseXMLResponse(result);
        
        if (!xmlResponse || !xmlResponse.suggestion || !xmlResponse.suggestion.promptTemplate) {
            throw new Error('Invalid suggestion format received from API');
        }
        
        // Extract suggestion template
        suggestionTemplate = xmlResponse.suggestion.promptTemplate;
        
        logStatus('Received input suggestions from AI', 'success');
        
        // Now display column mapping with the suggestion
        displayColumnMapping(suggestionTemplate);
    } catch (error) {
        logStatus(`Error getting input suggestions: ${error.message}`, 'error');
        // Fallback to default mapping
        displayColumnMapping();
    } finally {
        updateStatus('waiting');
    }
}

// Parse XML response
function parseXMLResponse(xmlString) {
    try {
        // Clean up possible text before and after the XML
        const xmlRegex = /<suggestion>[\s\S]*?<\/suggestion>/;
        const match = xmlString.match(xmlRegex);
        
        if (!match) {
            throw new Error('Could not find valid XML in response');
        }
        
        const cleanXml = match[0];
        
        // Create a DOM parser
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanXml, "text/xml");
        
        // Check for parser errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML parse error');
        }
        
        // Extract data from XML
        const result = { suggestion: {} };
        
        // Get relevant columns
        const columnsElements = xmlDoc.querySelectorAll('relevantColumns column');
        if (columnsElements.length > 0) {
            result.suggestion.relevantColumns = Array.from(columnsElements).map(el => el.textContent);
        }
        
        // Get prompt template
        const templateElement = xmlDoc.querySelector('promptTemplate');
        if (templateElement) {
            result.suggestion.promptTemplate = templateElement.textContent;
        }
        
        return result;
    } catch (error) {
        console.error('Error parsing XML:', error);
        throw new Error('Could not parse the XML response: ' + error.message);
    }
}

// Display column mapping interface
function displayColumnMapping(suggestedTemplate = '') {
    columnMappingDiv.innerHTML = '';
    
    // Get output fields
    outputFields = Array.from(outputFieldsContainer.children).map(field => {
        return {
            key: field.querySelector('.output-key').value,
            description: field.querySelector('.output-description').value
        };
    });
    
    // Create prompt template field
    const promptTemplateField = document.createElement('div');
    promptTemplateField.className = 'form-group';
    promptTemplateField.innerHTML = `
        <label for="prompt-template">Prompt Template:</label>
        <textarea id="prompt-template" rows="6" placeholder="Customize your prompt template using {column_name} as placeholders..."></textarea>
        <div class="available-columns">
            <p>Available columns: ${csvHeaders.map(h => `<code>{${h}}</code>`).join(' ')}</p>
        </div>
    `;
    columnMappingDiv.appendChild(promptTemplateField);
    
    // Set default template (either suggested or fallback)
    let defaultTemplate;
    if (suggestedTemplate) {
        defaultTemplate = suggestedTemplate;
    } else {
        defaultTemplate = `${taskDescriptionInput.value}\n\nData: ${csvHeaders.map(h => `${h}: {${h}}`).join(', ')}`;
    }
    document.getElementById('prompt-template').value = defaultTemplate;
    
    // Show the column mapping container
    columnMappingContainer.style.display = 'block';
    
    // Show CSV preview
    displayCsvPreview(csvData.slice(0, 5), csvHeaders);
}

// Display CSV preview
function displayCsvPreview(data, headers) {
    if (!data || data.length === 0) {
        csvPreview.innerHTML = '<p>No data available for preview</p>';
        return;
    }
    
    const tableHTML = `
        <table>
            <thead>
                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${data.map(row => `
                    <tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>
                `).join('')}
            </tbody>
        </table>
        ${data.length < csvData.length ? `<p>Showing ${data.length} of ${csvData.length} rows</p>` : ''}
    `;
    
    csvPreview.innerHTML = tableHTML;
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (isProcessing) {
        logStatus('Processing already in progress', 'warning');
        return;
    }
    
    if (!csvData || csvData.length === 0) {
        logStatus('No CSV data to process. Please upload a valid CSV file.', 'error');
        return;
    }
    
    // Validate form
    if (!validateForm()) {
        return;
    }
    
    // Save configuration
    saveConfig();
    
    // Get output fields
    outputFields = Array.from(outputFieldsContainer.children).map(field => {
        return {
            key: field.querySelector('.output-key').value,
            description: field.querySelector('.output-description').value
        };
    });
    
    // Get prompt template
    const promptTemplate = document.getElementById('prompt-template').value;
    
    // Begin processing
    isProcessing = true;
    updateStatus('processing');
    submitButton.disabled = true;
    
    // Reset processed data
    processedData = JSON.parse(JSON.stringify(csvData));
    
    // Show progress bar
    batchProgressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    processedCount.textContent = '0';
    totalCount.textContent = csvData.length;
    
    logStatus('Starting batch processing...', 'info');
    
    // Process data row by row
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        
        // Update progress
        processedCount.textContent = i;
        progressBar.style.width = `${(i / csvData.length) * 100}%`;
        
        try {
            // Create prompt for this row by replacing {placeholders} with actual values
            let rowPrompt = promptTemplate;
            for (const [key, value] of Object.entries(row)) {
                rowPrompt = rowPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
            }
            
            logStatus(`Processing row ${i+1}/${csvData.length}...`, 'info');
            
            // Create XML format instruction based on output fields
            const xmlFormat = `
            <output>
                ${outputFields.map(field => `<${field.key}>${field.description ? `<!-- ${field.description} -->` : ''}</${field.key}>`).join('\n                ')}
            </output>`;
            
            // Add XML format instructions to the prompt
            const finalPrompt = `${rowPrompt}
            
            Return your response using the following XML format:
            ${xmlFormat}`;
            
            // Send to API
            const result = await processRowWithLLM(finalPrompt);
            
            // Parse XML result
            const resultObj = parseOutputXML(result);
            
            // Add results to processed data
            for (const field of outputFields) {
                processedData[i][field.key] = resultObj[field.key] || '';
            }
            
            successCount++;
        } catch (error) {
            logStatus(`Error processing row ${i+1}: ${error.message}`, 'error');
            // Add error message to processed data
            for (const field of outputFields) {
                processedData[i][field.key] = 'ERROR: ' + error.message;
            }
            errorCount++;
        }
    }
    
    // Complete processing
    isProcessing = false;
    updateStatus('success');
    submitButton.disabled = false;
    progressBar.style.width = '100%';
    processedCount.textContent = csvData.length;
    
    logStatus(`Batch processing complete. ${successCount} successes, ${errorCount} errors.`, 'success');
    
    // Show final results and download button
    const updatedHeaders = [...csvHeaders, ...outputFields.map(f => f.key)];
    displayCsvPreview(processedData.slice(0, 10), updatedHeaders);
    downloadSection.style.display = 'block';
}

// Parse output XML
function parseOutputXML(xmlString) {
    try {
        // Extract XML part from the response
        const xmlRegex = /<output>[\s\S]*?<\/output>/;
        const match = xmlString.match(xmlRegex);
        
        if (!match) {
            throw new Error('Could not find valid XML in response');
        }
        
        const cleanXml = match[0];
        
        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanXml, "text/xml");
        
        // Check for parser errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML parse error');
        }
        
        // Extract data from XML
        const result = {};
        for (const field of outputFields) {
            const element = xmlDoc.querySelector(field.key);
            if (element) {
                result[field.key] = element.textContent;
            } else {
                result[field.key] = '';
            }
        }
        
        return result;
    } catch (error) {
        console.error('Error parsing XML:', error);
        throw new Error('Could not parse the XML output: ' + error.message);
    }
}

// Validate form inputs
function validateForm() {
    // Check API URL
    if (!apiUrlInput.value) {
        logStatus('API URL is required', 'error');
        return false;
    }
    
    // Check task description
    if (!taskDescriptionInput.value) {
        logStatus('Task description is required', 'error');
        return false;
    }
    
    // Check output fields
    const keys = new Set();
    const outputFields = Array.from(outputFieldsContainer.children);
    for (const field of outputFields) {
        const key = field.querySelector('.output-key').value;
        if (!key) {
            logStatus('All output keys must be filled', 'error');
            return false;
        }
        
        if (keys.has(key)) {
            logStatus(`Duplicate output key: ${key}`, 'error');
            return false;
        }
        
        // Ensure XML-safe keys (no spaces or special characters)
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
            logStatus(`Output key "${key}" must start with a letter and contain only letters, numbers, and underscores`, 'error');
            return false;
        }
        
        keys.add(key);
    }
    
    // Check for output key conflicts with existing CSV headers
    for (const key of keys) {
        if (csvHeaders.includes(key)) {
            logStatus(`Output key "${key}" conflicts with existing CSV column name`, 'error');
            return false;
        }
    }
    
    return true;
}

// Call LLM API with a prompt
async function callLLMAPI(prompt) {
    try {
        const apiUrl = apiUrlInput.value;
        const authToken = authTokenInput.value;
        
        // Construct the API request based on a generic LLM API format
        const apiRequest = {
            model: "gpt-3.5-turbo", // Example model name
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7
            // No response_format here - we want raw text with XML
        };
        
        // Make API request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken ? `Bearer ${authToken}` : undefined
            },
            body: JSON.stringify(apiRequest)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Extract the content from the response based on API structure
        let content;
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            content = data.choices[0].message.content;
        } else {
            content = data.content || data.output || data.result || JSON.stringify(data);
        }
        
        return content;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Process a single row with the LLM
async function processRowWithLLM(prompt) {
    // This is just a wrapper around callLLMAPI for processing a single row
    return callLLMAPI(prompt);
}

// Download processed CSV
function downloadProcessedCsv() {
    if (!processedData || processedData.length === 0) {
        logStatus('No processed data to download', 'error');
        return;
    }
    
    try {
        // Build CSV headers (original + output fields)
        const headers = [...csvHeaders, ...outputFields.map(f => f.key)];
        
        // Convert data to CSV format
        let csvContent = headers.join(',') + '\n';
        
        processedData.forEach(row => {
            const csvRow = headers.map(header => {
                const value = row[header] || '';
                // Escape values that contain commas, quotes, or newlines
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csvContent += csvRow.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'taskbot_processed_data.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        logStatus('CSV download initiated', 'success');
    } catch (error) {
        logStatus(`Error creating download: ${error.message}`, 'error');
    }
}

// Utility function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add log entry to status log
function logStatus(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = message;
    statusLog.appendChild(logEntry);
    statusLog.scrollTop = statusLog.scrollHeight;
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Update status indicator
function updateStatus(status) {
    statusIndicator.className = `status-${status}`;
    switch (status) {
        case 'waiting':
            statusIndicator.textContent = 'Waiting for input';
            break;
        case 'processing':
            statusIndicator.textContent = 'Processing';
            break;
        case 'success':
            statusIndicator.textContent = 'Completed';
            break;
        case 'error':
            statusIndicator.textContent = 'Error';
            break;
    }
}

// Initialize application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);