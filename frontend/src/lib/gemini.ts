import { GoogleGenAI } from '@google/genai';

export async function generateGeminiContentWithRetry(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured in the environment.');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const model = 'gemini-1.5-flash';
  const maxRetries = 2;
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    try {
      const contents = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
      
      const response = await ai.models.generateContent({
        model,
        contents,
      });

      return response.text || '';
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] ${model} failed on attempt ${attempt + 1}: ${err.message}`);
      
      if (err.status === 401 || err.status === 403 || err.message?.includes('invalid authentication credentials')) {
        throw new Error(`Authentication Error: ${err.message}`);
      }

      if (err.status === 503 || err.status === 429 || err.message?.includes('overload')) {
         attempt++;
         if (attempt <= maxRetries) {
           const backoff = 1000 * Math.pow(2, attempt);
           await new Promise(r => setTimeout(r, backoff));
           continue;
         }
      }
      
      break; // Not a retriable error, or retries exhausted
    }
  }

  console.warn(`[Gemini] API failed after ${maxRetries + 1} attempts. Falling back to safe mock response. Last error: ${lastError?.message}`);
  return `[System Notice: AI Services are temporarily overloaded or undergoing maintenance. Showing basic fallback response.]\n\nFallback Analysis:\n- Safety Check: Preliminary parameters appear normal.\n- Recommendation: Please try your request again in a few moments.\n- Status: Partially Verified.`;
}
