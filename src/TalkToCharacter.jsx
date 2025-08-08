import { useState, useEffect } from 'react';
import './TalkToCharacter.css';
import ProjectHeader from './ProjectHeader';

const books = [
  'hitchikers_guide_to_the_galaxy',
  'house_in_the_cerulean_sea',
  'study_in_scarlet'
];

function TalkToCharacter({ apiConfig }) {
  const [book, setBook] = useState(books[0]);
  const [bookData, setBookData] = useState(null);
  const [characterName, setCharacterName] = useState(null);
  const [selectedCharacterRole, setSelectedCharacterRole] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState({});
  const [selectionComplete, setSelectionComplete] = useState(false);
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
        for (const name of promptNames) {
          const response = await fetch(`/prompts/${name}.txt`);
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
        const response = await fetch(`/talk_to_character/books/${book}.json`);
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

    const body = {
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

    const response = await fetch(`${apiConfig.apiUrl}?key=${apiConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      setError(`API Error: ${errorText}`);
      return null;
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
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
    console.log('Intent:', intent);

    let extra_content = '';
    if (intent === 'character_related') {
      extra_content += JSON.stringify(bookData.summary.expanded_overview, null, 2);
      extra_content += '\n\nCharacters:\n';
      bookData.characters.forEach(character => {
        extra_content += JSON.stringify(character, null, 2) + '\n\n';
      });
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
    }

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
      setMessages([...newMessages, { role: 'assistant', content: response }]);
    }
    setLoading(false);
  };

  const handleStartChat = () => {
    if (bookData && characterName) {
      setSelectionComplete(true);
    }
  };

  if (!selectionComplete) {
    return (
      <div className="selection-container">
        <ProjectHeader 
          title="Talk to Character"
          description="Talk to your favourite book characters, immerse in their universe"
          className="talk-to-character-header"
        />
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
    );
  }

  return (
    <div className={`talk-to-character book-${book}`}>
      <ProjectHeader 
        title={characterName}
        description={selectedCharacterRole}
        onBackClick={() => setSelectionComplete(false)}
      />
      <div className="chat-area">
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
  );
}

export default TalkToCharacter;