document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const taskbotForm = document.getElementById('taskbot-config-form');
    const outputFields = document.getElementById('output-fields');
    const addFieldBtn = document.getElementById('add-field-btn');
    const submitButton = document.getElementById('submit-button');
    const statusLog = document.getElementById('status-log');
    const outputResultTbody = document.getElementById('output-result-tbody');
    const outputJson = document.getElementById('output-json');
    const toggleJsonBtn = document.getElementById('toggle-json-btn');
    const statusIndicator = document.getElementById('status-indicator');
    
    // State
    let resultData = null;
    
    // Add field button handler
    addFieldBtn.addEventListener('click', function() {
        addOutputField();
    });
    
    // Remove field button handler (delegation)
    outputFields.addEventListener('click', function(e) {
        if (e.target.closest('.remove-field')) {
            const field = e.target.closest('.output-field');
            if (outputFields.children.length > 1) {
                field.remove();
            } else {
                // Clear fields instead of removing if it's the last one
                field.querySelector('.output-key').value = '';
                field.querySelector('.output-description').value = '';
            }
        }
    });
    
    // Toggle JSON view
    if (toggleJsonBtn) {
        toggleJsonBtn.addEventListener('click', function() {
            const isHidden = outputJson.classList.contains('hidden');
            
            if (isHidden) {
                outputJson.classList.remove('hidden');
                toggleJsonBtn.innerHTML = '<i class="fas fa-table"></i> Show Table View';
            } else {
                outputJson.classList.add('hidden');
                toggleJsonBtn.innerHTML = '<i class="fas fa-code"></i> Show Raw JSON';
            }
        });
    }
    
    // Form submission
    taskbotForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        clearLog();
        outputResultTbody.innerHTML = '';
        outputJson.innerHTML = '';
        toggleJsonBtn.classList.add('hidden');
        
        updateStatus('processing');
        
        const apiUrl = document.getElementById('api-url').value;
        const authToken = document.getElementById('auth-token').value;
        const taskDescription = document.getElementById('task-description').value;
        
        // Collect output fields
        const outputKeyValues = [];
        document.querySelectorAll('.output-field').forEach(field => {
            const key = field.querySelector('.output-key').value;
            const description = field.querySelector('.output-description').value;
            
            if (key) {
                outputKeyValues.push({
                    key: key,
                    description: description
                });
            }
        });
        
        if (outputKeyValues.length === 0) {
            logMessage('Error: At least one output field is required', 'error');
            updateStatus('error');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            await processTask(apiUrl, authToken, taskDescription, outputKeyValues);
            updateStatus('success');
        } catch (error) {
            logMessage(`Error: ${error.message}`, 'error');
            updateStatus('error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Process Task';
        }
    });
    
    // Process task with retries
    async function processTask(apiUrl, authToken, taskDescription, outputFields, attemptNum = 1) {
        const maxAttempts = 3;
        
        logMessage(`Attempt ${attemptNum} - Sending request to API...`, 'info');
        
        try {
            // Generate the prompt with task and output requirements
            const prompt = generatePrompt(taskDescription, outputFields);

            // Make API request
            const response = await fetchAPIResponse(apiUrl, authToken, prompt);
            
            // Try to parse the XML from the response
            logMessage('Received response, parsing output...', 'info');
            const parsedData = parseOutput(response);
            
            if (!parsedData) {
                throw new Error('Failed to parse structured output from response');
            }
            
            // Validate output against required fields
            const validationErrors = validateOutput(parsedData, outputFields);
            
            if (validationErrors.length > 0) {
                if (attemptNum < maxAttempts) {
                    logMessage(`Output validation failed: ${validationErrors.join(', ')}`, 'warning');
                    logMessage(`Retrying (${attemptNum}/${maxAttempts})...`, 'info');
                    return processTask(apiUrl, authToken, taskDescription, outputFields, attemptNum + 1);
                } else {
                    throw new Error(`Output validation failed after ${maxAttempts} attempts: ${validationErrors.join(', ')}`);
                }
            }
            
            // Format and display the result
            logMessage('Successfully processed task!', 'success');
            resultData = parsedData;
            displayTableResult(parsedData);
            displayJsonResult(parsedData);
            toggleJsonBtn.classList.remove('hidden');
            
        } catch (error) {
            if (attemptNum < maxAttempts) {
                logMessage(`Error: ${error.message}`, 'warning');
                logMessage(`Retrying (${attemptNum}/${maxAttempts})...`, 'info');
                return processTask(apiUrl, authToken, taskDescription, outputFields, attemptNum + 1);
            } else {
                throw new Error(`Failed after ${maxAttempts} attempts: ${error.message}`);
            }
        }
    }
    
    // Generate prompt with task and output requirements
    function generatePrompt(taskDescription, outputFields) {
        const fieldDescriptions = outputFields.map(field => {
            return `- "${field.key}": ${field.description || 'No description provided'}`;
        }).join('\n');
        
        return `Task: ${taskDescription}

Please provide your response as structured data with the following fields:
${fieldDescriptions}

Format your response as XML with each field wrapped in its own tag like this:
<output>
${outputFields.map(field => `  <${field.key}> ${field.description || 'value'} </${field.key}>`).join('\n')}
</output>

IMPORTANT: Only include the exact fields requested, with no additional text or explanation outside the <output> tags.`;
    }
    
    // Make API request
    async function fetchAPIResponse(apiUrl, authToken, prompt) {
        try {
            logMessage('Connecting to API...', 'info');
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo", // Default model, modify as needed
                    messages: [
                        { role: "system", content: "You are a helpful assistant that generates structured outputs." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3 // Lower temperature for more consistent results
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            
            logMessage('Response received from API', 'info');
            
            const data = await response.json();
            return data.choices && data.choices[0] && data.choices[0].message 
                ? data.choices[0].message.content 
                : null;
                
        } catch (error) {
            throw new Error(`API request failed: ${error.message}`);
        }
    }
    
    // Parse XML output
    function parseOutput(text) {

        text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        if (!text) return null;
        
        try {
            // Extract XML between <output> tags
            const outputMatch = text.match(/<output>([\s\S]*?)<\/output>/i);
            
            if (!outputMatch || !outputMatch[1]) {
                logMessage('Error: Could not find <output> tags in response', 'error');
                return null;
            }
            
            const outputContent = outputMatch[1];
            const result = {};
            
            // Extract each field
            const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
            let match;
            
            while ((match = tagRegex.exec(outputContent)) !== null) {
                const [, key, value] = match;
                result[key] = value.trim();
            }
            
            return result;
            
        } catch (error) {
            logMessage(`Parsing error: ${error.message}`, 'error');
            return null;
        }
    }
    
    // Validate output against required fields
    function validateOutput(data, requiredFields) {
        const errors = [];
        
        if (!data) {
            return ['No data received'];
        }
        
        requiredFields.forEach(field => {
            if (!data.hasOwnProperty(field.key) || data[field.key] === '') {
                errors.push(`Missing required field: ${field.key}`);
            }
        });
        
        return errors;
    }
    
    // Display result in table format
    function displayTableResult(data) {
        outputResultTbody.innerHTML = '';
        
        Object.entries(data).forEach(([key, value]) => {
            const row = document.createElement('tr');
            
            const keyCell = document.createElement('td');
            keyCell.className = 'field-key';
            keyCell.textContent = key;
            
            const valueCell = document.createElement('td');
            valueCell.className = 'field-value';
            valueCell.textContent = value;
            
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            
            outputResultTbody.appendChild(row);
        });
    }
    
    // Display raw JSON result
    function displayJsonResult(data) {
        const json = JSON.stringify(data, null, 2);
        outputJson.textContent = json;
    }
    
    // Add a new output field
    function addOutputField() {
        const newField = document.createElement('div');
        newField.className = 'output-field';
        newField.innerHTML = `
            <input type="text" class="output-key" placeholder="Key" required>
            <input type="text" class="output-description" placeholder="Description (optional)">
            <button type="button" class="remove-field"><i class="fas fa-times"></i></button>
        `;
        outputFields.appendChild(newField);
    }
    
    // Log a message to the status log
    function logMessage(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.textContent = `[${time}] ${message}`;
        
        statusLog.appendChild(entry);
        statusLog.scrollTop = statusLog.scrollHeight;
    }
    
    // Update status indicator
    function updateStatus(status) {
        statusIndicator.className = '';
        statusIndicator.classList.add(`status-${status}`);
        
        switch(status) {
            case 'waiting':
                statusIndicator.textContent = 'Waiting for input';
                break;
            case 'processing':
                statusIndicator.textContent = 'Processing request';
                break;
            case 'success':
                statusIndicator.textContent = 'Completed successfully';
                break;
            case 'error':
                statusIndicator.textContent = 'Error';
                break;
        }
    }
    
    // Clear the log
    function clearLog() {
        statusLog.innerHTML = '';
        logMessage('Starting task processing...', 'info');
    }
});