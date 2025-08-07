document.addEventListener('DOMContentLoaded', () => {
    const setupContainer = document.getElementById('setup-container');
    const chatPageContainer = document.getElementById('chat-page-container');
    const bookList = document.getElementById('book-list');
    const characterSelection = document.getElementById('character-selection');
    const characterList = document.getElementById('character-list');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const backButton = document.getElementById('back-button');

    let selectedBookData = null;
    let selectedCharacter = null;

    const bookData = {
        "hitchikers_guide_to_the_galaxy.json": {
            "basic": {"title": "Hitchhiker's Guide to the Galaxy", "author": "Douglas Adams"},
            "summary": {"elevator_pitch": "A bewildered Englishman's mundane life is shattered when Earth is demolished. He embarks on a chaotic interstellar journey with an alien friend, encountering bizarre situations and the universe's most absurd guide."},
            "characters": [
                {"name": "Arthur Dent", "primary_role": "Bewildered human protagonist", "character_profile": {"appearance": "Dressed in a bathrobe and pajamas", "personality": "Anxious, ordinary, and perpetually confused", "voice_style": "Slightly flustered and questioning"}},
                {"name": "Ford Prefect", "primary_role": "Alien travel writer", "character_profile": {"appearance": "Unassuming and slightly odd", "personality": "Eccentric, knowledgeable, and unflappable", "voice_style": "Calmly explanatory, with a hint of mischief"}}
            ]
        },
        "house_in_the_cerulean_sea.json": {
            "basic": {"title": "The House in the Cerulean Sea", "author": "TJ Klune"},
            "summary": {"elevator_pitch": "A lonely case worker investigates a remote orphanage for magical children, finding unexpected family and confronting prejudice. He must choose between his rigid duty and a life filled with love and chaos."},
            "characters": [
                {"name": "Linus Baker", "primary_role": "Dedicated but lonely caseworker", "character_profile": {"appearance": "Slightly overweight, balding, and meticulously dressed", "personality": "Rule-follower, kind-hearted, and prone to worrying", "voice_style": "Formal, polite, and thoughtful"}},
                {"name": "Arthur Parnassus", "primary_role": "Master of the orphanage", "character_profile": {"appearance": "Charming, with a warm smile and kind eyes", "personality": "Mysterious, protective, and deeply caring", "voice_style": "Gentle, reassuring, and firm when necessary"}}
            ]
        },
        "study_in_scarlet.json": {
            "basic": {"title": "A Study in Scarlet", "author": "Arthur Conan Doyle"},
            "summary": {"elevator_pitch": "A brilliant but eccentric detective and his loyal companion investigate a series of baffling murders in Victorian London. Their pursuit of truth uncovers a tale of revenge spanning decades and continents."},
            "characters": [
                {"name": "Sherlock Holmes", "primary_role": "Consulting detective", "character_profile": {"appearance": "Tall, thin, with a sharp, piercing gaze", "personality": "Brilliant, eccentric, and emotionally detached", "voice_style": "Precise, analytical, and often dismissive of others"}},
                {"name": "Dr. John Watson", "primary_role": "Medical doctor and Holmes's companion", "character_profile": {"appearance": "Sturdy, with a military bearing", "personality": "Loyal, practical, and grounded", "voice_style": "Observant, descriptive, and admiring of Holmes's abilities"}}
            ]
        }
    };

    function showSetupPage() {
        setupContainer.style.display = 'block';
        chatPageContainer.style.display = 'none';
    }

    function showChatPage() {
        setupContainer.style.display = 'none';
        chatPageContainer.style.display = 'block';
        document.getElementById('chat-character-name-header').textContent = `Talking to: ${selectedCharacter.name}`;
    }

    function loadBooks() {
        bookList.innerHTML = '';
        for (const fileName in bookData) {
            const book = bookData[fileName];
            const bookCard = document.createElement('div');
            bookCard.className = 'col-md-6 col-lg-4';
            bookCard.innerHTML = `
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${book.basic.title}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">${book.basic.author}</h6>
                        <p class="card-text">${book.summary.elevator_pitch}</p>
                    </div>
                </div>
            `;
            bookCard.addEventListener('click', () => {
                selectedBookData = book;
                displayCharacters(book.characters);
                document.querySelectorAll('#book-list .card').forEach(card => card.classList.remove('selected'));
                bookCard.querySelector('.card').classList.add('selected');
            });
            bookList.appendChild(bookCard);
        }
    }

    function displayCharacters(characters) {
        characterList.innerHTML = '';
        characters.forEach(character => {
            const characterCard = document.createElement('div');
            characterCard.className = 'col-md-6 col-lg-4';
            characterCard.innerHTML = `
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">${character.name}</h5>
                        <p class="card-text">${character.primary_role}</p>
                    </div>
                </div>
            `;
            characterCard.addEventListener('click', () => {
                selectedCharacter = character;
                showChatPage();
            });
            characterList.appendChild(characterCard);
        });
        characterSelection.style.display = 'block';
    }

    function addMessage(text, sender, isStreaming = false) {
        let messageElement;
        if (isStreaming) {
            messageElement = document.querySelector('.assistant-message.streaming');
            if (!messageElement) {
                messageElement = document.createElement('div');
                messageElement.className = 'message assistant-message streaming';
                chatMessages.appendChild(messageElement);
            }
            messageElement.innerHTML += text;
        } else {
            const streamingMessage = document.querySelector('.assistant-message.streaming');
            if (streamingMessage) {
                streamingMessage.classList.remove('streaming');
            }
            messageElement = document.createElement('div');
            messageElement.className = `message ${sender}-message`;
            messageElement.textContent = text;
            chatMessages.appendChild(messageElement);
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Generic function to call the LLM API
    async function getLlmResponseApi(prompt, systemPrompt = "You are a helpful assistant.", stream = false) {
        const apiUrl = document.getElementById('api-url').value;
        const apiKey = document.getElementById('api-key').value;
        const model = document.getElementById('model').value;

        if (!apiKey) {
            addMessage("Please enter your API key.", 'assistant');
            throw new Error("API key is missing.");
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ];

        // For intent classification, we only need the user prompt.
        if (systemPrompt === "You are a helpful assistant.") {
            messages.shift();
        }

        const response = await fetch(`${apiUrl}${stream ? '?alt=sse' : ''}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: stream
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        return response;
    }

    // Main function to get the character's response, mirroring the Python script's logic
    async function getCharacterResponse(userMessage) {
        try {
            // 1. Get the user's intent
            const intentPrompt = `
Analyze the user's input and classify its intent.

User Input: "${userMessage}"

Possible Intents:
- Greeting: User is starting the conversation (e.g., "hello", "hi").
- Question about the story: User is asking something about the plot, world, or other characters (e.g., "What was the deal with the Babel Fish?", "Tell me about your home planet.").
- Question about the character: User is asking something directly about the character they are talking to (e.g., "How are you feeling?", "What do you think of Earth?").
- Farewell: User is ending the conversation (e.g., "goodbye", "bye").
- General statement: A general comment that doesn't fit other categories.

Classification:`;

            const intentResponse = await getLlmResponseApi(intentPrompt, undefined, false);
            const intentData = await intentResponse.json();
            const intent = (intentData.choices[0]?.message?.content || 'General statement').trim();
            console.log("Intent:", intent);

            // 2. Create a prompt focus based on the intent
            let prompt_focus;
            const lowerCaseIntent = intent.toLowerCase();
            if (lowerCaseIntent.includes("greeting")) {
                prompt_focus = "a friendly greeting in character.";
            } else if (lowerCaseIntent.includes("question about the story")) {
                prompt_focus = "an answer based on your knowledge from the book, in character.";
            } else if (lowerCaseIntent.includes("question about the character")) {
                prompt_focus = "a personal reflection or answer, in character.";
            } else if (lowerCaseIntent.includes("farewell")) {
                prompt_focus = "a farewell message, in character.";
            } else {
                prompt_focus = "a response in character.";
            }

            // 3. Create the final prompt for the character
            const final_prompt = `---
**Book:** ${selectedBookData.basic.title}
**Elevator Pitch:** ${selectedBookData.summary.elevator_pitch}

**Your Character Profile:**
- **Name:** ${selectedCharacter.name}
- **Role:** ${selectedCharacter.primary_role}
- **Appearance:** ${selectedCharacter.character_profile.appearance}
- **Personality:** ${selectedCharacter.character_profile.personality}
- **Voice & Style:** ${selectedCharacter.character_profile.voice_style}

**User's Intent:** ${intent}
**Your Task:** Formulate ${prompt_focus}

**User's Input:** "${userMessage}"
---

**Your Response (as ${selectedCharacter.name}):**`;

            // 4. Get the final response from the LLM
            const system_prompt = `You are a master storyteller and roleplaying engine.
Your task is to embody the chosen character from the provided book details.
You must engage in a conversation with the user, staying true to the character's personality, voice, and the book's overall tone.
Do not break character.
Do not mention that you are an AI or a language model.
Generate responses that are consistent with the character's knowledge and experiences from the book.
Keep your responses concise and engaging, encouraging further interaction.
Base your portrayal on the provided character profile and the book's summary.`;

            const finalResponse = await getLlmResponseApi(final_prompt, system_prompt, true);

            // 5. Stream the response to the chat window
            const reader = finalResponse.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    addMessage('', 'assistant'); // Finalize streaming message
                    console.log('Full Response:', fullResponse);
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6);
                        if (jsonStr === '[DONE]') {
                            addMessage('', 'assistant');
                            console.log('Full Response:', fullResponse);
                            return;
                        }
                        try {
                            const chunk = JSON.parse(jsonStr);
                            let content = '';
                            if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                                content = chunk.choices[0].delta.content;
                            } else if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
                                content = chunk.candidates[0].content.parts[0].text;
                            }
                            if (content) {
                                fullResponse += content;
                                addMessage(content, 'assistant', true);
                            }
                        } catch (error) {
                            console.error('Error parsing stream chunk:', error, jsonStr);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Fetch error:', error);
            addMessage("An error occurred: " + error.message, 'assistant');
        }
    }

    sendButton.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (!message) return;
        addMessage(message, 'user');
        chatInput.value = '';
        getCharacterResponse(message);
    });

    backButton.addEventListener('click', () => {
        showSetupPage();
        characterSelection.style.display = 'none';
        chatMessages.innerHTML = '';
    });

    loadBooks();
    showSetupPage();
});