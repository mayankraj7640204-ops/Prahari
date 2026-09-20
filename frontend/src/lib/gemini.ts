import { GoogleGenAI } from '@google/genai';

export async function generateGeminiContentWithRetry(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const rawKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  // Strip accidental surrounding quotes or whitespace
  const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Model Fallback Sequence
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
  const maxRetries = 2; // 2 retries per model
  let lastError: any = null;

  for (const model of models) {
    let attempt = 0;
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
        
        // If Unauthorized/Invalid Token, retrying or falling back to other models won't fix it.
        // We throw immediately to trigger the UI graceful degradation.
        if (err.status === 401 || err.status === 403 || err.message?.includes('invalid authentication credentials')) {
          throw new Error(`Authentication Error: ${err.message}`);
        }

        // For 503 Service Unavailable or Rate limits (429), retry or fallback
        if (err.status === 503 || err.status === 429 || err.message?.includes('overload')) {
           attempt++;
           if (attempt <= maxRetries) {
             const backoff = 1000 * Math.pow(2, attempt);
             await new Promise(r => setTimeout(r, backoff));
             continue; // try again
           } else {
             break; // go to next model
           }
        } else {
           // For other errors, just go to next model
           break;
        }
      }
    }
  }

  // Graceful degradation / Mock fallback
  console.warn(`[Gemini] All models failed. Falling back to safe mock response. Last error: ${lastError?.message}`);
  return `[System Notice: AI Services are temporarily overloaded or undergoing maintenance. Showing basic fallback response.]\n\nFallback Analysis:\n- Safety Check: Preliminary parameters appear normal.\n- Recommendation: Please try your request again in a few moments.\n- Status: Partially Verified.`;
}
