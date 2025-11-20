import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export interface StoryboardSegment {
  script: string;
  prompt: string;
}

// Generate Image for a Scene
export const generateSceneImage = async (visualDescription: string): Promise<string> => {
  const ai = getAiClient();
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      { text: visualDescription }
    ],
    config: {
        imageConfig: {
            aspectRatio: "16:9"
        }
    }
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("No image generated");
};

// Generate Storyboard (Script lines + Image Prompts) from Raw Text
export const generateStoryboard = async (rawText: string): Promise<StoryboardSegment[]> => {
  const ai = getAiClient();
  
  const styleInstruction = `
    CRITICAL VISUAL STYLE:
    Every single image prompt MUST be written in this specific style:
    "Whiteboard illustration on a clean white background, [SCENE DETAILS], simple whiteboard-style drawing, clean black outlines, flat pastel colors. Balanced composition, no clutter, no shadows, no 3D, no realistic textures, no extra elements."
  `;

  const prompt = `
    You are a professional storyboard artist. 
    I will provide a raw story or script text. 
    Your task is to break this text into distinct, sequential scenes (lines).
    
    For each scene, provide:
    1. "script": The exact text from the story to be spoken/displayed as a subtitle for this segment.
    2. "prompt": A detailed, creative image generation prompt describing the visual scene that matches the script.
    
    ${styleInstruction}
    
    Ensure every prompt starts with "Whiteboard illustration on a clean white background..." and follows the clean, flat pastel aesthetic described.

    Input Text:
    "${rawText}"
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            prompt: { type: Type.STRING }
          },
          required: ["script", "prompt"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  try {
    return JSON.parse(text) as StoryboardSegment[];
  } catch (e) {
    console.error("Failed to parse JSON", text);
    throw new Error("Failed to parse storyboard JSON");
  }
};