import { useState, useEffect } from 'react';
import './Storybound.css';
import ProjectHeader from './ProjectHeader';

const books = [
  'hitchikers_guide_to_the_galaxy',
  'house_in_the_cerulean_sea',
  'study_in_scarlet'
];

function Storybound({ apiConfig }) {
  const [book, setBook] = useState(books[0]);
  const [bookData, setBookData] = useState(null);
  const [characterName, setCharacterName] = useState(null);
  const [selectedCharacterRole, setSelectedCharacterRole] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState({});
  const [selectionComplete, setSelectionComplete] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        setError(null);
        setLoading(true);
        const promptNames = [
          'high_level_intent_system_prompt',
          'high_level_intent_prompt',
          'chapter_relevance_system_prompt',
          'chapter_relevance_prompt',
          'character_system_prompt',
          'character_prompt'
        ];
        const fetchedPrompts = {};
        const baseUrl = import.meta.env.BASE_URL;
        for (const name of promptNames) {
          const response = await fetch(`${baseUrl}prompts/${name}.txt`);
          if (!response.ok) {
            throw new Error(`Failed to fetch prompt: ${name}`);
          }
          fetchedPrompts[name] = await response.text();
        }
        setPrompts(fetchedPrompts);
      } catch (e) {
        setError(e.message);
        console.error(e);
      }
    };
    fetchPrompts();
  }, []);

  useEffect(() => {
    const fetchBookData = async () => {
      try {
        setLoading(true);
        setError(null);
        const baseUrl = import.meta.env.BASE_URL;
        const response = await fetch(`${baseUrl}talk_to_character/books/${book}.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch book data for: ${book}`);
        }
        const data = await response.json();
        setBookData(data);
        const initialCharacter = data.characters[0];
        setCharacterName(initialCharacter.name);
        setSelectedCharacterRole(initialCharacter.primary_role);
        setMessages([]);
      } catch (e) {
        setError(e.message);
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (Object.keys(prompts).length > 0) {
      fetchBookData();
    }
  }, [book, prompts]);

  const getLlmApiOutput = async (userMessages, systemInstruction, temperature = 0.7, max_tokens = 300) => {
    if (!apiConfig || !apiConfig.apiKey) {
      alert('API key not configured.');
      return null;
    }

    let body;
    let headers = { 'Content-Type': 'application/json' };
    let url = apiConfig.apiUrl;

    switch (apiConfig.provider) {
      case 'google':
        body = {
          contents: userMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          })),
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature,
            maxOutputTokens: max_tokens,
          }
        };
        url = `${apiConfig.apiUrl}?key=${apiConfig.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = apiConfig.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = {
          model: apiConfig.model,
          messages: userMessages,
          system: systemInstruction,
          max_tokens: max_tokens,
          temperature: temperature,
        };
        break;
      case 'openai':
      case 'local':
        headers['Authorization'] = `Bearer ${apiConfig.apiKey}`;
        body = {
          model: apiConfig.model,
          messages: [
            { role: 'system', content: systemInstruction },
            ...userMessages
          ],
          max_tokens: max_tokens,
          temperature: temperature,
        };
        break;
      default:
        setError("Unsupported API provider");
        return null;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      setError(`API Error: ${errorText}`);
      return null;
    }

    const data = await response.json();

    switch (apiConfig.provider) {
        case 'google':
            return data.candidates[0].content.parts[0].text;
        case 'anthropic':
            return data.content[0].text;
        case 'openai':
        case 'local':
            return data.choices[0].message.content;
        default:
            setError("Unsupported API provider");
            return null;
    }
  };

  const getLlmOutputWithRetry = async (userMessages, systemInstruction, max_retries = 2) => {
    let retry_count = 0;
    while (retry_count <= max_retries) {
      retry_count += 1;
      const orig_out = await getLlmApiOutput(userMessages, systemInstruction, 0.6, 2048);
      if (!orig_out) return {};

      let out = orig_out.split('</think>').pop();
      out = out.split('```json').pop().split('```')[0];
      out = out.substring(out.indexOf('{'), out.lastIndexOf('}') + 1);

      try {
        return JSON.parse(out);
      } catch (e) {
        console.error('Parse error:', e);
        console.log('Original output:', orig_out);
        console.log('Output:', out);
        console.log(`Retry ${retry_count} / ${max_retries}`);
      }
    }
    return {};
  };

  const getOutput = async (query, history) => {
    const characterData = bookData.characters.find(c => c.name === characterName);

    const intentPrompt = prompts.high_level_intent_prompt
      .replace('{query}', query)
      .replace('{character_name}', characterData.name)
      .replace('{character_summary}', characterData.real_life_summary)
      .replace('{book_title}', bookData.basic.title)
      .replace('{book_summary}', bookData.summary.elevator_pitch);

    const intentResult = await getLlmOutputWithRetry(
      [{ role: 'user', content: intentPrompt }],
      prompts.high_level_intent_system_prompt
    );

    const intent = intentResult.intent || 'n/a';
    const newLog = { intent, chapter: null, characters: [] };

    let extra_content = '';
    if (intent === 'character_related') {
      extra_content += JSON.stringify(bookData.summary.expanded_overview, null, 2);
      extra_content += '\n\nCharacters:\n';
      bookData.characters.forEach(character => {
        extra_content += JSON.stringify(character, null, 2) + '\n\n';
      });
      newLog.characters = bookData.characters.map(c => c.name);
    } else if (intent === 'story_general') {
      extra_content = JSON.stringify(bookData.summary, null, 2);
    } else if (intent === 'story_specific_chapter') {
      const relevancePrompt = prompts.chapter_relevance_prompt
        .replace('{user_query}', query)
        .replace('{chapter_data}', JSON.stringify(bookData.chapters, null, 2));
      const relevantChapterInfo = await getLlmOutputWithRetry(
        [{ role: 'user', content: relevancePrompt }],
        prompts.chapter_relevance_system_prompt
      );
      const relevantChapters = (relevantChapterInfo.relevant_chapters || []).map(
        chapter_info => bookData.chapters[chapter_info.chapter_num - 1]
      );
      extra_content = relevantChapters.length > 0 ? JSON.stringify(relevantChapters, null, 2) : 'n/a';
      newLog.chapter = relevantChapters.map(c => c.number).join(', ');
    }

    setLogs([newLog, ...logs]);

    const systemPrompt = prompts.character_system_prompt
      .replace('{character_name}', characterData.name)
      .replace('{character_primary_role}', characterData.primary_role)
      .replace('{story_title}', bookData.basic.title)
      .replace('{character_story_impact}', characterData.story_impact)
      .replace('{character_appearance}', characterData.character_profile.appearance)
      .replace('{character_personality}', characterData.character_profile.personality)
      .replace('{character_voice_style}', characterData.character_profile.voice_style);

    const userPrompt = prompts.character_prompt
      .replace('{context_data}', extra_content)
      .replace('{character_name}', characterData.name)
      .replace('{query}', query);
    
    const response = await getLlmApiOutput(
      [...history, {role: 'user', content: userPrompt}],
      systemPrompt,
      0.6,
      2048
    );
    return response;
  };

  const handleSend = async () => {
    if (!input.trim() || loading || Object.keys(prompts).length === 0) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);

    const response = await getOutput(input, messages);
    if (response) {
      const characterData = bookData.characters.find(c => c.name === characterName);
      let processedResponse = response;

      // Remove everything before the first colon if it's within the first 20 characters
      const firstColonIndex = processedResponse.indexOf(':');
      if (firstColonIndex !== -1 && firstColonIndex < 50) {
        processedResponse = processedResponse.substring(firstColonIndex + 1);
      }

      // Remove "{character_name}:" or actual character name from the beginning
      const regex = new RegExp(`^(${characterName}|\{character_name\}):\s*`, 'i');
      processedResponse = processedResponse.replace(regex, '');

      // Remove leading/trailing empty lines
      processedResponse = processedResponse.split('\n').filter(line => line.trim() !== '').join('\n');

      setMessages([...newMessages, { role: 'assistant', content: processedResponse }]);
    }
    setLoading(false);
  };

  const handleStartChat = () => {
    if (bookData && characterName) {
      setMessages([]);
      setSelectionComplete(true);
    }
  };

  if (!selectionComplete) {
    return (
      <div className="storybound-container">
      <ProjectHeader 
        title="Storybound"
        description="Interact with characters that remember events and relationships from their books, useful for roleplay, teaching, or writing sparring partners."
        className="storybound-header"
      />
      <div className="selection-container">
        {error && <div className="error-message">{error}</div>}
        <div className="selection-controls">
          <div className="setting">
            <label htmlFor="book-select">Book:</label>
            <select id="book-select" value={book} onChange={(e) => setBook(e.target.value)} disabled={loading}>
              {books.map((b) => (
                <option key={b} value={b}>
                  {b.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          {bookData && (
            <div className="setting">
              <label htmlFor="character-select">Character:</label>
              <select
                id="character-select"
                value={characterName}
                onChange={(e) => {
                  const newCharacterName = e.target.value;
                  setCharacterName(newCharacterName);
                  const selectedChar = bookData.characters.find(c => c.name === newCharacterName);
                  if (selectedChar) {
                    setSelectedCharacterRole(selectedChar.primary_role);
                  }
                }}
                disabled={loading}
              >
                {bookData.characters.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button onClick={handleStartChat} className="glass-button-glow" disabled={loading || !bookData || error}>
          {loading ? 'Loading Assets...' : 'Start Chat'}
        </button>
      </div>
    </div>
    );
  }

  return (
    <div className="storybound-container">
      <ProjectHeader 
        title={characterName}
        description={selectedCharacterRole}
        onBackClick={() => setSelectionComplete(false)}
      />
      <div className={`storybound book-${book}`}>
        <div className="chat-area">
          <div className="logs-area">
            <h3>Logs</h3>
            {logs.map((log, index) => (
              <div key={index} className="log-item">
                <p><strong>Intent:</strong> {log.intent}</p>
                {log.chapter && <p><strong>Chapter:</strong> {log.chapter}</p>}
                {log.characters.length > 0 && <p><strong>Characters:</strong> {log.characters.join(', ')}</p>}
              </div>
            ))}
          </div>
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <pre>{msg.content}</pre>
              </div>
            ))}
            {loading && <div className="message assistant">...</div>}
            {error && <div className="message error">{error}</div>}
          </div>
          <div className="input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Message ${characterName}...`}
              disabled={loading || Object.keys(prompts).length === 0}
            />
            <button onClick={handleSend} className="glass-button-glow" disabled={loading || Object.keys(prompts).length === 0}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Storybound;
