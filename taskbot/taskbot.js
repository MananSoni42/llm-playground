document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const taskbotForm = document.getElementById('taskbot-config-form');
    const outputFields = document.getElementById('output-fields');
    const addFieldBtn = document.getElementById('add-field-btn');
    const submitButton = document.getElementById('submit-button');
    const statusLog = document.getElementById('status-log');
    const outputResultTbody = document.getElementById('output-result-tbody');
    const outputJson = document.getElementById('output-json');
    const jsonContent = document.getElementById('json-content');
    const toggleJsonBtn = document.getElementById('toggle-json-btn');
    const copyResultsBtn = document.getElementById('copy-results-btn');
    const statusIndicator = document.getElementById('status-indicator');
    const clearLogBtn = document.getElementById('clear-log');
    const outputTable = document.getElementById('output-table');
    const noResults = document.getElementById('no-results');
    const togglePasswordBtn = document.getElementById('toggle-password');
    
    // State
    let resultData = null;
    let isJsonVisible = false;
    
    // Add field button handler
    addFieldBtn.addEventListener('click', function() {
        addOutputField();
    });
    
    // Clear log button handler
    clearLogBtn.addEventListener('click', function() {
        clearLog();
    });
    
    // Toggle password visibility
    togglePasswordBtn.addEventListener('click', function() {
        const authToken = document.getElementById('auth-token');
        const icon = togglePasswordBtn.querySelector('i');
        
        if (authToken.type === 'password') {
            authToken.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            authToken.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
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
    toggleJsonBtn.addEventListener('click', function() {
        isJsonVisible = !isJsonVisible;
        
        if (isJsonVisible) {
            outputJson.classList.remove('d-none');
            toggleJsonBtn.innerHTML = '<i class="fas fa-table me-1"></i> Show Table View';
        } else {
            outputJson.classList.add('d-none');
            toggleJsonBtn.innerHTML = '<i class="fas fa-code me-1"></i> Show Raw JSON';
        }
    });
    
    // Copy results
    copyResultsBtn.addEventListener('click', function() {
        if (!resultData) return;
        
        const jsonStr = JSON.stringify(resultData, null, 2);
        navigator.clipboard.writeText(jsonStr)
            .then(() => {
                const originalText = copyResultsBtn.innerHTML;
                copyResultsBtn.innerHTML = '<i class="fas fa-check me-1"></i> Copied!';
                setTimeout(() => {
                    copyResultsBtn.innerHTML = originalText;
                }, 2000);
            })
            .catch(err => {
                logMessage(`Error copying: ${err}`, 'error');
            });
    });
    
    // Form submission
    taskbotForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        resetUI();
        updateStatus('processing', 'Processing request');
        
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
            updateStatus('error', 'Error');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Processing...';
        
        try {
            await processTask(apiUrl, authToken, taskDescription, outputKeyValues);
            updateStatus('success', 'Completed successfully');
        } catch (error) {
            logMessage(`Error: ${error.message}`, 'error');
            updateStatus('error', 'Error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-play me-1"></i> Process Task';
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
            toggleJsonBtn.classList.remove('d-none');
            copyResultsBtn.classList.remove('d-none');
            
            // Show results
            noResults.classList.add('d-none');
            outputTable.classList.remove('d-none');
            
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
        if (!text) return null;
        
        try {
            // Remove any thinking tags if present
            text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            
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
            keyCell.className = 'fw-bold';
            keyCell.textContent = key;
            
            const valueCell = document.createElement('td');
            valueCell.textContent = value;
            
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            
            outputResultTbody.appendChild(row);
        });
    }
    
    // Display raw JSON result
    function displayJsonResult(data) {
        const json = JSON.stringify(data, null, 2);
        jsonContent.textContent = json;
    }
    
    // Add a new output field
    function addOutputField() {
        const newField = document.createElement('div');
        newField.className = 'output-field row g-2 mb-2';
        newField.innerHTML = `
            <div class="col-5">
                <input type="text" class="form-control output-key" placeholder="Key" required>
            </div>
            <div class="col">
                <input type="text" class="form-control output-description" placeholder="Description (optional)">
            </div>
            <div class="col-auto">
                <button type="button" class="btn btn-danger remove-field">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        outputFields.appendChild(newField);
        
        // Focus the new input
        newField.querySelector('.output-key').focus();
    }
    
    // Log a message to the status log
    function logMessage(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        let icon = '';
        switch(type) {
            case 'info':
                icon = '<i class="fas fa-info-circle me-1"></i>';
                break;
            case 'success':
                icon = '<i class="fas fa-check-circle me-1"></i>';
                break;
            case 'error':
                icon = '<i class="fas fa-exclamation-circle me-1"></i>';
                break;
            case 'warning':
                icon = '<i class="fas fa-exclamation-triangle me-1"></i>';
                break;
        }
        
        entry.innerHTML = `${icon}<span class="text-muted">[${time}]</span> ${message}`;
        
        statusLog.appendChild(entry);
        statusLog.scrollTop = statusLog.scrollHeight;
    }
    
    // Update status indicator
    function updateStatus(status, text) {
        statusIndicator.className = 'badge';
        
        switch(status) {
            case 'waiting':
                statusIndicator.classList.add('bg-secondary');
                break;
            case 'processing':
                statusIndicator.classList.add('bg-primary', 'status-processing');
                break;
            case 'success':
                statusIndicator.classList.add('bg-success');
                break;
            case 'error':
                statusIndicator.classList.add('bg-danger');
                break;
        }
        
        statusIndicator.textContent = text;
    }
    
    // Clear the log
    function clearLog() {
        statusLog.innerHTML = '';
        logMessage('System ready. Enter a task description and click "Process Task".', 'info');
    }
    
    // Reset UI for new task
    function resetUI() {
        clearLog();
        outputResultTbody.innerHTML = '';
        jsonContent.textContent = '';
        outputJson.classList.add('d-none');
        toggleJsonBtn.classList.add('d-none');
        copyResultsBtn.classList.add('d-none');
        noResults.classList.remove('d-none');
        outputTable.classList.add('d-none');
        isJsonVisible = false;
        toggleJsonBtn.innerHTML = '<i class="fas fa-code me-1"></i> Show Raw JSON';
        resultData = null;
    }
    
    // Initialize
    // logMessage('System ready. Enter a task description and click "Process Task".', 'info');
});