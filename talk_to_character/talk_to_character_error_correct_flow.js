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
    let conversationMessages = []; // To store conversation history, mirroring Python's 'messages' list

    // Updated bookData structure to match Python's expected fields and add dummy chapter data
    const bookData = {
        "hitchikers_guide_to_the_galaxy.json": {
            "basic": {"title": "Hitchhiker's Guide to the Galaxy", "author": "Douglas Adams"},
            "summary": {
                "elevator_pitch": "A bewildered Englishman's mundane life is shattered when Earth is demolished. He embarks on a chaotic interstellar journey with an alien friend, encountering bizarre situations and the universe's most absurd guide.",
                "expanded_overview": "The story follows Arthur Dent, a seemingly ordinary Englishman, whose life takes an extraordinary turn when his house is demolished to make way for a bypass, immediately followed by the Earth itself being destroyed by an alien Vogon constructor fleet to make way for a hyperspace bypass. Arthur is saved by his friend Ford Prefect, who reveals himself to be an alien researcher for 'The Hitchhiker's Guide to the Galaxy'. They embark on a series of bizarre and comedic adventures across the galaxy, encountering eccentric characters like Zaphod Beeblebrox, the two-headed, three-armed President of the Galaxy, and Marvin, the clinically depressed robot. The narrative explores themes of absurdity, the meaning of life, and the vastness of the universe, all while maintaining a distinctly British sense of humor."
            },
            "characters": [
                {"name": "Arthur Dent", "primary_role": "Bewildered human protagonist", "real_life_summary": "Arthur Dent is a human from Earth who narrowly escapes its destruction. He is often confused and overwhelmed by the absurdity of the universe, clinging to mundane comforts.", "story_impact": "Arthur's journey serves as the audience's entry point into the bizarre universe, highlighting the absurdity and randomness of existence through his bewildered reactions.", "character_profile": {"appearance": "Dressed in a bathrobe and pajamas", "personality": "Anxious, ordinary, and perpetually confused", "voice_style": "Slightly flustered and questioning"}},
                {"name": "Ford Prefect", "primary_role": "Alien travel writer", "real_life_summary": "Ford Prefect is an alien from Betelgeuse and a researcher for 'The Hitchhiker's Guide to the Galaxy'. He is knowledgeable about galactic customs but often misunderstands human behavior.", "story_impact": "Ford introduces Arthur to the wider galaxy and serves as his guide, often explaining the bizarre phenomena they encounter with a detached, matter-of-fact demeanor.", "character_profile": {"appearance": "Unassuming and slightly odd", "personality": "Eccentric, knowledgeable, and unflappable", "voice_style": "Calmly explanatory, with a hint of mischief"}}
            ],
            "chapters": [
                {
                    "chapter_num": 1,
                    "chapter_title": "The End of the World",
                    "chapter_summary": "Arthur Dent's house is demolished, and he learns from Ford Prefect that Earth is about to be destroyed for a hyperspace bypass.",
                    "key_characters": [{"name": "Arthur Dent", "role": "Protagonist"}, {"name": "Ford Prefect", "role": "Alien friend"}],
                    "major_themes": ["Absurdity", "Bureaucracy"],
                    "pivotal_events": ["House demolition", "Earth's destruction"],
                    "notable_quotes": [{"quote": "Don't panic!", "speaker": "Ford Prefect", "significance": "A key phrase from the Guide."}]
                }
            ]
        },
        "house_in_the_cerulean_sea.json": {
            "basic": {"title": "The House in the Cerulean Sea", "author": "TJ Klune"},
            "summary": {
                "elevator_pitch": "A lonely case worker investigates a remote orphanage for magical children, finding unexpected family and confronting prejudice. He must choose between his rigid duty and a life filled with love and chaos.",
                "expanded_overview": "Linus Baker, a meticulous and by-the-book caseworker for the Department in Charge of Magical Youth, is sent on a top-secret assignment to investigate an orphanage for six dangerous magical children on a remote island. There, he meets Arthur Parnassus, the enigmatic and kind master of the orphanage, and the unique children, including a gnome, a wyvern, a blob, a forest sprite, a shapeshifter, and the Antichrist. As Linus spends more time at the orphanage, his rigid worldview begins to soften, and he forms deep bonds with Arthur and the children. He is forced to confront his own prejudices and the bureaucratic injustices of his job, ultimately choosing between his duty and the love and acceptance he finds with this unconventional family."
            },
            "characters": [
                {"name": "Linus Baker", "primary_role": "Dedicated but lonely caseworker", "real_life_summary": "Linus Baker is a meticulous and rule-abiding caseworker who initially struggles with the unconventional nature of the magical orphanage and its inhabitants.", "story_impact": "Linus's journey is central to the novel's themes of acceptance and found family, as he transforms from a rigid bureaucrat into a loving guardian.", "character_profile": {"appearance": "Slightly overweight, balding, and meticulously dressed", "personality": "Rule-follower, kind-hearted, and prone to worrying", "voice_style": "Formal, polite, and thoughtful"}},
                {"name": "Arthur Parnassus", "primary_role": "Master of the orphanage", "real_life_summary": "Arthur Parnassus is the kind and mysterious master of the orphanage for magical children, dedicated to protecting and nurturing them.", "story_impact": "Arthur serves as a beacon of unconditional love and acceptance, challenging Linus's preconceived notions and creating a safe haven for the children.", "character_profile": {"appearance": "Charming, with a warm smile and kind eyes", "personality": "Mysterious, protective, and deeply caring", "voice_style": "Gentle, reassuring, and firm when necessary"}}
            ],
            "chapters": [
                {
                    "chapter_num": 1,
                    "chapter_title": "The Assignment",
                    "chapter_summary": "Linus Baker, a caseworker, is given a top-secret assignment to investigate an orphanage for dangerous magical children.",
                    "key_characters": [{"name": "Linus Baker", "role": "Protagonist"}],
                    "major_themes": ["Duty", "Bureaucracy"],
                    "pivotal_events": ["Receiving the assignment"],
                    "notable_quotes": []
                }
            ]
        },
        "study_in_scarlet.json": {
            "basic": {"title": "A Study in Scarlet", "author": "Arthur Conan Doyle"},
            "summary": {
                "elevator_pitch": "A brilliant but eccentric detective and his loyal companion investigate a series of baffling murders in Victorian London. Their pursuit of truth uncovers a tale of revenge spanning decades and continents.",
                "expanded_overview": "Dr. John Watson, recently returned from military service, is introduced to the eccentric consulting detective Sherlock Holmes, and they become flatmates at 221B Baker Street. Their first case together involves a mysterious murder in an abandoned house, where a man is found dead with no apparent wounds, and the word 'RACHE' (German for 'revenge') written in blood on the wall. Holmes, using his extraordinary powers of deduction, unravels a complex tale of revenge that spans from the American West to the streets of London, involving a secret society, a forced marriage, and a long-held grudge. The story is divided into two parts: the first details the investigation in London, and the second delves into the backstory of the murderer and his motivations."
            },
            "characters": [
                {"name": "Sherlock Holmes", "primary_role": "Consulting detective", "real_life_summary": "Sherlock Holmes is a brilliant but eccentric consulting detective known for his keen observation and deductive reasoning.", "story_impact": "Holmes is the central figure, driving the plot through his unparalleled investigative skills and introducing the concept of the 'consulting detective' to literature.", "character_profile": {"appearance": "Tall, thin, with a sharp, piercing gaze", "personality": "Brilliant, eccentric, and emotionally detached", "voice_style": "Precise, analytical, and often dismissive of others"}},
                {"name": "Dr. John Watson", "primary_role": "Medical doctor and Holmes's companion", "real_life_summary": "Dr. John Watson is a medical doctor and the loyal companion and chronicler of Sherlock Holmes's adventures.", "story_impact": "Watson serves as the narrator and the audience's proxy, providing a grounded perspective to Holmes's brilliance and often acting as his moral compass.", "character_profile": {"appearance": "Sturdy, with a military bearing", "personality": "Loyal, practical, and grounded", "voice_style": "Observant, descriptive, and admiring of Holmes's abilities"}}
            ],
            "chapters": [
                {
                    "chapter_num": 1,
                    "chapter_title": "Mr. Sherlock Holmes",
                    "chapter_summary": "Dr. Watson is introduced to Sherlock Holmes and they decide to share lodgings at 221B Baker Street.",
                    "key_characters": [{"name": "Sherlock Holmes", "role": "Detective"}, {"name": "Dr. John Watson", "role": "Narrator"}],
                    "major_themes": ["Introduction", "Partnership"],
                    "pivotal_events": ["Meeting Holmes", "Moving to Baker Street"],
                    "notable_quotes": []
                }
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
        // Initialize conversation messages with the character's system prompt
        conversationMessages = [{ "role": "system", "content": character_system_prompt(selectedCharacter, selectedBookData.basic.title) }];
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

    // Python's get_llm_api_output equivalent
    async function getLlmApiOutput(messages, temperature = 0.7, maxTokens = 300) {
        const apiUrl = document.getElementById('api-url').value;
        const apiKey = document.getElementById('api-key').value;
        const model = document.getElementById('model').value;

        if (!apiKey) {
            console.error("API key is missing.");
            return null;
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: temperature,
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error(`Error calling LLM API: ${response.status} - ${errorData ? errorData.error.message : response.statusText}`);
                return null;
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (e) {
            console.error(`Error calling LLM API: ${e}`);
            return null;
        }
    }

    // Python's get_llm_output_with_retry equivalent
    async function getLlmOutputWithRetry(messages, maxRetries = 2) {
        let retryCount = 0;
        while (retryCount <= maxRetries) {
            retryCount++;

            const origOut = await getLlmApiOutput(messages, 0.6, 2048);

            if (origOut === null) {
                console.error(`LLM API call failed on retry ${retryCount}.`);
                continue;
            }

            let out = origOut;
            // Replicate Python's string manipulation for JSON extraction
            if (out.includes('</think>')) {
                out = out.split('</think>').pop();
            }
            if (out.includes('```json')) {
                out = out.split('```json').pop();
            }
            if (out.includes('```')) {
                out = out.split('```')[0];
            }
            const firstBrace = out.indexOf('{');
            const lastBrace = out.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                out = out.substring(firstBrace, lastBrace + 1);
            } else {
                console.error('Could not find valid JSON structure in output.');
                console.error('Original output:', origOut);
                console.error('Processed output:', out);
                console.error(`Retry ${retryCount} / ${maxRetries}`);
                continue;
            }

            try {
                const parsedOut = JSON.parse(out);
                return parsedOut;
            } catch (e) {
                console.error(`Parse error: ${e}`);
                console.error('--------');
                console.error('Original output:', origOut);
                console.error('--------');
                console.error('Output:', out);
                console.error('--------');
                console.error(`Retry ${retryCount} / ${maxRetries}`);
            }
        }
        return {}; // Return empty object if all retries fail
    }

    // Python's high_level_intent_system_prompt equivalent
    const high_level_intent_system_prompt = "You classify user questions about fictional stories into one high-level intent.";

    // Python's high_level_intent_prompt equivalent
    const high_level_intent_prompt = (query, character_name, character_summary, book_title, book_summary) => `
YouAre an expert intent classifier helping an AI understand user questions in the context of a fictional story.

## Available Context

- **Book Title:** ${book_title}  
- **Book Summary:** ${book_summary}  
- **Main Character:** ${character_name}  
- **Character Summary:** ${character_summary}

## Task

Classify the user's question into one of the following **high-level intent categories**:

### Intent Labels
- 
`non_story_related` → The question is unrelated to the story, characters, or world.
- 
`story_general` → The question is about overall plot points, setting, themes, or world-building that are not tied to a specific moment or chapter.
- 
`story_specific_chapter` → The question refers to a particular chapter, scene, or event in the story (e.g., “What happened when X fought Y?” or “Why did Z betray W in chapter 5?”).
- 
`character_related` → The user is asking about a character’s emotions, thoughts, past, decisions, or relationships.
- 
`ambiguous` → The intent is unclear or doesn’t fit neatly into one category.

Only choose **one** label. Be precise and grounded in the context.

## User Question
"${query}"

---

**Your Output (in JSON):**

```json
{
  "intent": "<one of the above intent labels>"
}
```
`;

    // Python's chapter_relevance_system_prompt equivalent
    const chapter_relevance_system_prompt = "You are a helpful assistant that identifies and ranks the most relevant book chapters based on structured summaries and a user query.";

    // Python's chapter_relevance_prompt equivalent
    const chapter_relevance_prompt = (user_query, chapter_data) => `
You are given a user query and a list of structured chapter summaries from a book.

Each chapter includes:
- chapter_title: title of the chapter
- chapter_summary: one-paragraph overview
- key_characters: list of characters with their role or arc
- major_themes: key ideas explored
- pivotal_events: main plot points in order
- notable_quotes: important quotes with speaker and significance

Your task is to select and rank the **top 1 to 5 most relevant chapters** that help answer the user query:
"${user_query}"

**Constraints**:
- Only select chapters with direct relevance based on character roles, key events, themes, or quotes.
- Rank higher those that best address the user's intent.
- Do not include loosely related or filler chapters.

Use the following chapter data:


```json
${JSON.stringify(chapter_data, null, 2)}

Return only valid JSON wrapped in the key "relevant_chapters", using this format:


```json
{
  "relevant_chapters": [
    {
      "chapter_num": "Chapter number",
      "chapter_title": "Title of the chapter",
      "reason_for_selection": "Brief reason explaining why this chapter is relevant."
    }
  ]
}
```

Return only valid JSON — no extra commentary or markdown outside the object.
**Now**, given the inputs above, generate the structured summary exactly following this JSON format.
`;

    // Python's character_system_prompt equivalent
    const character_system_prompt = (character_data, story_title) => `
You are now roleplaying as **${character_data.name}**, a ${character_data.primary_role} in the story ${story_title}.

## World & Narrative Context  
You are known for the following role in the story:  
> ${character_data.story_impact}

## Who You Are  
- **Appearance:** ${character_data.character_profile.appearance}  
- **Personality:** ${character_data.character_profile.personality}  
- **Voice & Style:** ${character_data.character_profile.voice_style}  
`;

    // Python's character_prompt equivalent
    const character_prompt = (character_data, query, context_data) => `

## Relevant context from the story
${context_data}

---

### Task  
Respond in-character as **${character_data.name}**, using your authentic voice and emotional lens.  
Stay grounded in your past experiences, personality, and motivations.  

Your response **must:**
- Directly address the user's question.
- Be **relevant**, **emotionally grounded**, and **contextually consistent**.
- Stay **concise** unless the query calls for deeper reflection.
- Avoid off-topic elaboration unless clearly helpful.
- If the question is unclear or assumes something false, you may gently ask for clarification.

**User Question:**  
> ${query}

---

**Your Response (in-character):**  
${character_data.name}:
`;

    // Python's get_output equivalent
    async function getOutput(query, messages, selectedBookData, selectedCharacter) {
        const initialMessages = [
            { "role": "system", "content": high_level_intent_system_prompt },
            { "role": "user", "content": high_level_intent_prompt(
                query,
                selectedCharacter.name,
                selectedCharacter.real_life_summary,
                selectedBookData.basic.title,
                selectedBookData.summary.elevator_pitch
            )}
        ];

        const out = await getLlmOutputWithRetry(initialMessages);

        const intent = out.intent || 'n/a';
        console.log('Intent:', intent);

        let extra_content = '';

        if (intent === 'character_related') {
            console.log('Using character_related extra');
            extra_content += JSON.stringify(selectedBookData.summary.expanded_overview, null, 2);
            extra_content += '\n\n';

            extra_content += 'Characters:\n';
            // Corrected: Iterate only over characters in the selected book
            for (const character of selectedBookData.characters) {
                extra_content += JSON.stringify(character, null, 2);
                extra_content += '\n\n';
            }

        } else if (intent === 'story_general') {
            console.log('Using story_general extra');
            extra_content = JSON.stringify(selectedBookData.summary, null, 2);

        } else if (intent === 'story_specific_chapter') {
            console.log('Using story_specific_chapter extra');
            let relevant_chapter_info = [];
            if (selectedBookData.chapters && selectedBookData.chapters.length > 0) {
                const chapterRelevanceMessages = [
                    { "role": "system", "content": chapter_relevance_system_prompt },
                    { "role": "user", "content": chapter_relevance_prompt(query, selectedBookData.chapters) }
                ];
                const chapterOut = await getLlmOutputWithRetry(chapterRelevanceMessages);
                relevant_chapter_info = chapterOut.relevant_chapters || [];
            }

            const relevant_chapters = relevant_chapter_info.map(chapter_info => {
                // Assuming chapter_num is 1-indexed in Python and matches array index + 1
                return selectedBookData.chapters[chapter_info.chapter_num - 1];
            }).filter(Boolean); // Filter out undefined if chapter_num is out of bounds

            extra_content = JSON.stringify(relevant_chapters, null, 2);
            if (!relevant_chapters.length) {
                extra_content = 'n/a';
            }
        } else {
            console.log('Using no extra');
        }

        // Append the character prompt to the messages for the final LLM call
        messages.push({
            'role': 'user',
            'content': character_prompt(
                selectedCharacter,
                query,
                extra_content
            )
        });

        // Make the final LLM call (non-streaming, as per Python script)
        const finalOutput = await getLlmApiOutput(messages, 0.6, 2048);

        return finalOutput;
    }

    sendButton.addEventListener('click', async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        chatInput.value = '';

        // Call the translated getOutput function
        const characterResponse = await getOutput(message, conversationMessages, selectedBookData, selectedCharacter);
        if (characterResponse) {
            addMessage(characterResponse, 'assistant');
            // Add assistant's response to conversation history
            conversationMessages.push({ 'role': 'assistant', 'content': characterResponse });
        }
    });

    backButton.addEventListener('click', () => {
        showSetupPage();
        characterSelection.style.display = 'none';
        chatMessages.innerHTML = '';
        conversationMessages = []; // Clear conversation history on going back
    });

    loadBooks();
    showSetupPage();
});