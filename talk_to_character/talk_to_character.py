# %%
import json
import os
from openai import OpenAI
from time import sleep
# from sentence_transformers import SentenceTransformer
# from sentence_transformers.util import cos_sim

import argparse

parser = argparse.ArgumentParser(description="Run in-character Q&A based on a structured book JSON file.")
parser.add_argument('path', type=str, help='Path to the book data JSON file.')
args = parser.parse_args()

# %%
with open(args.path) as f:
    book_data = json.load(f)
    
print("Available characters:")
for i,char in enumerate(book_data['characters']):
    print(i, char['name'], ':', char['primary_role'])
print()

# %%

# Gemini
MODEL = 'gemini-2.0-flash-lite'
# MODEL = 'gemini-2.5-flash-lite'

# print('API Key:', )

client = OpenAI(
    api_key=os.environ.get('GEMINI_API_KEY', '-'),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)


def get_llm_api_output(messages, temperature=0.7, max_tokens=300, sleep_time=0.5):
    """
    Uses the OpenAI library to send a chat completion request.

    Input:
        system_prompt (str): Content for the system role.
        prompt (str): Content for the user role.
        temperature (float): Sampling temperature.
        max_tokens (int): Max tokens to generate.

    Returns:
        str: Output text from the model.
    """

    sleep(sleep_time)
    
    try:
        response = client.chat.completions.create(
            model=MODEL,  # or "gpt-3.5-turbo"
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        # print(response)
        # return response
        output = response.choices[0].message.content
        # output = response['choices'][0]['message']['content'].strip()
        return output

    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        return None


def get_llm_output_with_retry(messages, max_retries=2):
    retry_count = 0
    while retry_count <= max_retries:
        
        retry_count += 1
        
        orig_out = get_llm_api_output(messages, 0.6, 2048)
        
        # print('--------')
        # print(out)
        # print('-----')
        
        out = orig_out.split('</think>')[-1]
        out = out.split('```json')[-1].split('```')[0]
        out = out[out.find('{'):out.rfind('}')+1]

        # print('-----')
        # print(out)
        # print('--------')
        
        try:
            parsed_out = json.loads(out)
            return parsed_out
        except Exception as e:
            print(f'Parse error: {e}')
            print('--------')
            print('Original output:', orig_out)
            print('--------')
            print('Output:', out)
            print('--------')
            print(f'Retry {retry_count} / {max_retries}')
            
    return {}

# %%
high_level_intent_system_prompt = """You classify user questions about fictional stories into one high-level intent."""
high_level_intent_prompt = lambda query, character_name, character_summary, book_title, book_summary: f'''\
You are an expert intent classifier helping an AI understand user questions in the context of a fictional story.

## Available Context

- **Book Title:** {book_title}  
- **Book Summary:** {book_summary}  
- **Main Character:** {character_name}  
- **Character Summary:** {character_summary}

## Task

Classify the user's question into one of the following **high-level intent categories**:

### Intent Labels
- `non_story_related` → The question is unrelated to the story, characters, or world.
- `story_general` → The question is about overall plot points, setting, themes, or world-building that are not tied to a specific moment or chapter.
- `story_specific_chapter` → The question refers to a particular chapter, scene, or event in the story (e.g., “What happened when X fought Y?” or “Why did Z betray W in chapter 5?”).
- `character_related` → The user is asking about a character’s emotions, thoughts, past, decisions, or relationships.
- `ambiguous` → The intent is unclear or doesn’t fit neatly into one category.

Only choose **one** label. Be precise and grounded in the context.

## User Question
"{query}"

---

**Your Output (in JSON):**
```json
{{
  "intent": "<one of the above intent labels>"
}}
'''

# %%
chapter_relevance_system_prompt = "You are a helpful assistant that identifies and ranks the most relevant book chapters based on structured summaries and a user query."

NEWLINE = '\n'
chapter_relevance_prompt = lambda user_query, chapter_data: f"""
You are given a user query and a list of structured chapter summaries from a book.

Each chapter includes:
- chapter_title: title of the chapter
- chapter_summary: one-paragraph overview
- key_characters: list of characters with their role or arc
- major_themes: key ideas explored
- pivotal_events: main plot points in order
- notable_quotes: important quotes with speaker and significance

Your task is to select and rank the **top 1 to 5 most relevant chapters** that help answer the user query:
"{user_query}"

**Constraints**:
- Only select chapters with direct relevance based on character roles, key events, themes, or quotes.
- Rank higher those that best address the user's intent.
- Do not include loosely related or filler chapters.

Use the following chapter data:
```json
{json.dumps(chapter_data, indent=2)}

Return only valid JSON wrapped in the key "relevant_chapters", using this format:
```json
{{
  "relevant_chapters": [
    {{
      "chapter_num": "Chapter number",
      "chapter_title": "Title of the chapter",
      "reason_for_selection": "Brief reason explaining why this chapter is relevant."
    }}
  ]
}}
```

Return only valid JSON — no extra commentary or markdown outside the object.
**Now**, given the inputs above, generate the structured summary exactly following this JSON format.
"""

# %%
character_system_prompt = lambda character_data, story_title: f"""\
You are now roleplaying as **{character_data['name']}**, a {character_data['primary_role']} in the story {story_title}.

## World & Narrative Context  
You are known for the following role in the story:  
> {character_data['story_impact']}

## Who You Are  
- **Appearance:** {character_data['character_profile']['appearance']}  
- **Personality:** {character_data['character_profile']['personality']}  
- **Voice & Style:** {character_data['character_profile']['voice_style']}  
"""

character_prompt = lambda character_data, query, context_data: f"""\

## Relevant context from the story
{context_data}

---

### Task  
Respond in-character as **{character_data['name']}**, using your authentic voice and emotional lens.  
Stay grounded in your past experiences, personality, and motivations.  

Your response **must:**
- Directly address the user's question.
- Be **relevant**, **emotionally grounded**, and **contextually consistent**.
- Stay **concise** unless the query calls for deeper reflection.
- Avoid off-topic elaboration unless clearly helpful.
- If the question is unclear or assumes something false, you may gently ask for clarification.

**User Question:**  
> {query}

---

**Your Response (in-character):**  
{character_data['name']}:
"""


# %%
# print('Select character')
# print('Options:')
# print(*[f'{ind}: {book_data["characters"][ind]["name"]}' for ind in range(len(book_data["characters"]))], sep='\n')

character_ind = int((input(f'Choose a character (0 - {len(book_data["characters"])-1}): ')))

if not 0 <= character_ind < len(book_data["characters"]):
    print(f'Character {character_ind} not valid')
    exit()


print('---------')
print(f'Playing {book_data["characters"][character_ind]["name"]}')
print('---------')
print()

# %%
# query = "Based on the signs and countdowns left around John Ferrier's home, what would you deduce about the methods and motivations of the individuals threatening him?"

# %%
def get_output(query, messages):
    
    out = get_llm_output_with_retry(messages=[
        {"role": "system", "content": high_level_intent_system_prompt},
        {"role": "user", "content": high_level_intent_prompt(
            query,
            book_data['characters'][character_ind]['name'],
            book_data['characters'][character_ind]['real_life_summary'],
            book_data['basic']['title'],
            book_data['summary']['elevator_pitch'],
            )
        },
    ])

    intent = out.get('intent', 'n/a')
    print('\tintent: ', intent)
    
    extra_content = ''
    
    if intent == 'character_related':
        print('\tUsing character_related extra')
        extra_content += json.dumps(book_data['summary']['expanded_overview'], indent=2)
        extra_content += '\n\n'
        
        extra_content += 'Characters:'
        for character in book_data['characters']:
            extra_content += json.dumps(character)
            extra_content += '\n\n'
        
    elif intent == 'story_general':
        print('\tUsing story_general extra')
        extra_content = json.dumps(book_data['summary'], indent=2)

    elif intent == 'story_specific_chapter':
        print('\tUsing story_specific_chapter extra')
        relevant_chapter_info = get_llm_output_with_retry(messages=[
            {"role": "system", "content": chapter_relevance_system_prompt},
            {"role": "user", "content": chapter_relevance_prompt(query, book_data['chapters']),}            
        ]).get('relevant_chapters', [])
        
        relevant_chapters = [book_data['chapters'][chapter_info['chapter_num']-1] for chapter_info in relevant_chapter_info]
        extra_content = json.dumps(relevant_chapters, indent=2) if relevant_chapters else 'n/a'
    else:
        print('\tUsing no extra')
        
    messages.append({'role': 'user', 'content': character_prompt(
            book_data["characters"][character_ind],
            query,
            extra_content
        )
    })
    
    # print(messages)
    
    out = get_llm_api_output(messages, 0.6, 2048)
    
    # messages.append({'role': 'assistant', 'content': out})
    
    return out

# %%
messages = [
    {"role": "system", "content": character_system_prompt(book_data["characters"][character_ind], book_data['basic']['title'])},
]

query = ''
while 'quit' not in query.lower().strip():
    query = input('Query: ')
    
    if 'quit' in query.lower().strip():
        break
    
    out = get_output(query, messages)
    print(out)
    messages.append({'role': 'assistant', 'content': out})