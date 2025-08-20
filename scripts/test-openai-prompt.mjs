import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testPrompt() {
  try {
    console.log('Testing OpenAI Responses API with your prompt...');
    
    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: [
        {
          "role": "developer",
          "content": [
            {
              "type": "input_text",
              "text": "You are a slide extraction engine. Extract slide information and return only JSON with the keys Title, Description, and Type.\n\nRules:\n- Title: Copy the main heading exactly as shown on the slide.\n- Description: Copy the exact visible body text from the slide, preserving capitalization, punctuation, and paragraph breaks. Do not paraphrase or add any words. Exclude photo credits, page numbers, or decorative labels unless instructed otherwise.\n- Type: Select from {Regular, Video, Quiz, Reference, Resources}. If unclear, use Regular.\n- If a field is missing, use an empty string.\n- Do not include any other keys (do not return \"reasoning\" or any explanations).\nReturn a single JSON object only."
            }
          ]
        }
      ],
      text: {
        "format": {
          "type": "json_object"
        },
        "verbosity": "medium"
      },
      reasoning: {
        "effort": "minimal"
      },
      tools: [],
      store: false
    });

    console.log('Response received:', JSON.stringify(response, null, 2));
    
    // Try to extract content
    const content = response?.output_text || 
                   response?.content?.[0]?.text || 
                   response?.output?.[0]?.content?.[0]?.text;
    
    console.log('Extracted content:', content);
    
    if (content) {
      try {
        const parsed = JSON.parse(content);
        console.log('Parsed JSON:', parsed);
      } catch (e) {
        console.log('Failed to parse as JSON:', e.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPrompt();
