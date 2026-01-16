
import { GoogleGenAI, Type } from "@google/genai";

// Always use the API key directly from process.env.API_KEY for initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeLeaveReason = async (reason: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this leave request reason and provide a professional summary and priority score (1-5): "${reason}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            priority: { type: Type.NUMBER },
            sentiment: { type: Type.STRING }
          },
          required: ["summary", "priority", "sentiment"]
        }
      }
    });
    // Access response.text as a property as per current SDK guidelines
    const text = response.text;
    if (!text) return { summary: reason, priority: 3, sentiment: "Neutral" };
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { summary: reason, priority: 3, sentiment: "Neutral" };
  }
};
