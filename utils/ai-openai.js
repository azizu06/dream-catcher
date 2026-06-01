import OpenAI from 'openai';

const getOpenAIConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_URL;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 350);
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT || 'minimal';

  return { apiKey, baseURL, model, maxOutputTokens, reasoningEffort };
};

// Call OpenAI API for dream interpretation
export async function getDreamInterpretation(dreamText) {
  const { apiKey, baseURL, model, maxOutputTokens, reasoningEffort } = getOpenAIConfig();

  if (!apiKey) {
    throw new Error('Server misconfigured: OPENAI_API_KEY is missing');
  }

  const openai = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  try {
    const message = await openai.chat.completions.create({
      model,
      max_completion_tokens: maxOutputTokens,
      reasoning_effort: reasoningEffort,
      messages: [
        {
          role: 'system',
          content: 'You are a thoughtful dream interpreter. Be insightful but gentle, and consider common dream symbolism. Keep your interpretation to 2-3 paragraphs.'
        },
        {
          role: 'user',
          content: `Dream: ${dreamText}`
        }
      ]
    });
    return message.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`API error: ${error.message}`);
  }
}
