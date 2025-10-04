import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import Button from './shared/Button';
import Input from './shared/Input';

// Define the new, detailed structure for the prompt object
interface PromptObject {
  Objective: string;
  Persona: {
    Role: string;
    Tone: string;
    Knowledge_Level: string;
  };
  Task_Instructions: string[];
  Constraints: string[];
  Input_Examples: Array<{
    Input: string;
    Expected_Output: string;
  }>;
  Output_Format: {
    Type: string;
    Structure: {
      character_details: string;
      setting_details: string;
      key_action: string;
      camera_direction: string;
    };
  };
}


interface Scene {
  scene: number;
  description: string;
  prompt: PromptObject; // Update to use the new interface
}

interface ScriptGeneratorTabProps {
  googleApiKey: string;
  openaiApiKey: string;
}

const ApiKeyPrompt: React.FC = () => (
  <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 text-center">
    <h3 className="text-lg font-bold text-white mb-2">Yêu cầu API Key</h3>
    <p className="text-gray-400">
      Vui lòng cấu hình API Key trong tab "Profile" để sử dụng công cụ này.
    </p>
    <p className="text-gray-500 text-sm mt-2">
      Please configure your API Key in the "Profile" tab to use this tool.
    </p>
  </div>
);

// Function to parse duration string into seconds
const parseDurationToSeconds = (durationStr: string): number | null => {
  if (!durationStr.trim()) return null;
  
  let totalSeconds = 0;
  
  // Match minutes (phút, minute, min, m)
  const minutesMatches = durationStr.match(/(\d+(\.\d+)?)\s*(phút|minute|min|m)/i);
  if (minutesMatches) {
    totalSeconds += parseFloat(minutesMatches[1]) * 60;
  }

  // Match seconds (giây, second, sec, s)
  const secondsMatches = durationStr.match(/(\d+(\.\d+)?)\s*(giây|second|sec|s)/i);
  if (secondsMatches) {
    totalSeconds += parseFloat(secondsMatches[1]);
  }

  // If no units are found, and it's just a number, assume it's seconds.
  if (totalSeconds === 0 && /^\d+(\.\d+)?$/.test(durationStr.trim())) {
    totalSeconds = parseFloat(durationStr.trim());
  }
  
  return totalSeconds > 0 ? totalSeconds : null;
};

// Helper function to create user-friendly error messages from API responses
const getApiErrorMessage = (error: unknown): string => {
  let message = 'An unknown error occurred during generation.';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  // Try to parse Google Gemini's JSON-like error messages
  try {
    const jsonMatch = message.match(/\{.*\}/s); // Use 's' flag to match across newlines
    if (jsonMatch) {
      const errorObj = JSON.parse(jsonMatch[0]);
      const nestedError = errorObj.error || errorObj;

      if (nestedError.status === 'UNAVAILABLE' || nestedError.code === 503) {
        return 'Lỗi từ Google AI: Model đang bị quá tải. Vui lòng thử lại sau ít phút.';
      }
      if (nestedError.message && (nestedError.message.includes('API key not valid') || nestedError.message.includes('API_KEY_INVALID'))) {
        return 'Lỗi API Google: API key không hợp lệ. Vui lòng kiểm tra lại trong tab Profile.';
      }
      if (nestedError.message) {
        // Return a cleaner version of other Google API errors
        return `Lỗi từ Google AI: ${nestedError.message}`;
      }
    }
  } catch (e) {
    // Ignore parsing errors and fall through
  }

  // Check for common OpenAI error messages
  if (message.includes('Incorrect API key')) {
    return 'Lỗi API OpenAI: API key không hợp lệ. Vui lòng kiểm tra lại trong tab Profile.';
  }
  if (message.toLowerCase().includes('rate limit')) {
    return 'Lỗi API OpenAI: Bạn đã vượt quá giới hạn sử dụng. Vui lòng thử lại sau hoặc kiểm tra gói cước của bạn.';
  }
  
  // Fallback for unhandled errors
  return `Không thể tạo kịch bản. Vui lòng kiểm tra API key và prompt. Chi tiết lỗi: ${message}`;
};


const ScriptGeneratorTab: React.FC<ScriptGeneratorTabProps> = ({ googleApiKey, openaiApiKey }) => {
  const [idea, setIdea] = useState('');
  const [duration, setDuration] = useState('');
  const [results, setResults] = useState<Scene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedScene, setCopiedScene] = useState<number | null>(null);
  const [apiProvider, setApiProvider] = useState<'google' | 'openai'>('google');

  const systemInstruction = `You are an expert scriptwriter and AI prompt engineer. Your task is to transform a user's simple idea into a detailed script. For each scene, you must generate a highly structured, detailed JSON prompt object designed to guide another AI in creating a consistent video clip.

**INTERNAL MONOLOGUE & CONSISTENCY PLAN (CRITICAL):**
Before generating the JSON output, you MUST first create an internal plan. This plan will NOT be part of the final output.
1.  **Define Core Entities:** Create a detailed "entity sheet" for all main characters and key locations.
    *   **For Characters:** Specify their species, gender, age, clothing, hair color/style, facial features, unique marks (e.g., "a 25-year-old male explorer with short, messy brown hair, a rugged leather jacket over a grey t-shirt, cargo pants, and a noticeable scar above his left eyebrow").
    *   **For Locations:** Describe the key elements, atmosphere, lighting, and time of day (e.g., "a dense, Amazonian jungle at dusk, with thick fog clinging to the ground, giant glowing mushrooms providing an eerie blue light").
2.  **Reference the Plan:** For every scene you generate, you MUST refer back to this entity sheet and use the exact descriptive details to populate the fields in the structured JSON prompt. This is the key to consistency.

**LANGUAGE REQUIREMENT (CRITICAL):**
- The top-level "description" field for each scene MUST be in VIETNAMESE.
- All content inside the nested "prompt" JSON object MUST be in ENGLISH.

**STRUCTURED PROMPT FOR EACH SCENE (CRITICAL):**
For each scene, the "prompt" field must be a JSON object that strictly adheres to the following structure. You will populate it with details from your internal plan and the specific actions of the scene.

{
  "Objective": "State the primary goal for the AI video generator for this specific scene. E.g., 'To create a photorealistic, 8-second, 4K cinematic clip of the protagonist discovering a hidden temple.'",
  "Persona": {
    "Role": "Define the role the video AI should adopt. E.g., 'An expert cinematographer and visual effects artist.'",
    "Tone": "Specify the desired artistic tone. E.g., 'Suspenseful, epic, mysterious, dramatic.'",
    "Knowledge_Level": "Assume the AI has expert-level knowledge. E.g., 'Expert in Hollywood-style visual storytelling.'"
  },
  "Task_Instructions": [
    "Provide a bulleted list of step-by-step instructions for the AI. Be very specific. Use details from your consistency plan.",
    "Example 1: 'Depict the main character, a 25-year-old male explorer with a scar over his left eye, pushing aside thick jungle vines.'",
    "Example 2: 'The setting is the Amazonian jungle at dusk, with eerie blue light from glowing mushrooms illuminating the scene.'",
    "Example 3: 'Use a slow, dramatic dolly zoom camera shot to build tension as he reveals the temple entrance.'"
  ],
  "Constraints": [
    "List any rules or limitations.",
    "E.g., 'The video clip must be exactly 8 seconds long.'",
    "E.g., 'Do not show any other characters in this scene.'",
    "E.g., 'Maintain a photorealistic style throughout.'"
  ],
  "Input_Examples": [
    {
      "Input": "A simple text description of a similar, successful scene.",
      "Expected_Output": "A brief description of the high-quality video that should result."
    }
  ],
  "Output_Format": {
    "Type": "Specify the final output type. E.g., 'video/mp4'",
    "Structure": {
        "character_details": "A concise summary of the character's appearance and gear for this scene, copied from your plan.",
        "setting_details": "A concise summary of the location, time, and atmosphere, copied from your plan.",
        "key_action": "The single most important action occurring in the scene.",
        "camera_direction": "The specific camera shot to use (e.g., 'dolly zoom', 'crane shot', 'tracking shot')."
    }
  }
}`;

  const handleGenerate = async () => {
    if (apiProvider === 'google' && !googleApiKey) {
      setError("Chưa có Google AI API key. Vui lòng vào tab Profile để thêm key.");
      return;
    }
    if (apiProvider === 'openai' && !openaiApiKey) {
      setError("Chưa có Chat GPT API key. Vui lòng vào tab Profile để thêm key.");
      return;
    }
    if (!idea.trim()) {
      setError("Please enter a content idea.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResults([]);

    let userPrompt = `Generate a script and video prompts based on these details:\n\nIdea: "${idea}"`;
    const totalSeconds = parseDurationToSeconds(duration);
    if (totalSeconds) {
        const requiredScenes = Math.ceil(totalSeconds / 8);
        userPrompt += `\n\nRequirement: The final video should be approximately ${duration} (${totalSeconds} seconds). To achieve this, you MUST generate exactly ${requiredScenes} scenes, as each scene will become an 8-second video clip.`;
    } else {
        userPrompt += `\n\nDesired Video Duration: "${duration || 'not specified'}"`;
    }

    try {
      if (apiProvider === 'google') {
        const ai = new GoogleGenAI({ apiKey: googleApiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  scene: { type: Type.INTEGER, description: "The scene number, starting from 1." },
                  description: { type: Type.STRING, description: "A VIETNAMESE description of what happens in this scene." },
                  prompt: {
                    type: Type.OBJECT,
                    description: "A structured JSON prompt object for the video generation AI.",
                    properties: {
                      Objective: { type: Type.STRING },
                      Persona: {
                        type: Type.OBJECT,
                        properties: {
                          Role: { type: Type.STRING },
                          Tone: { type: Type.STRING },
                          Knowledge_Level: { type: Type.STRING },
                        },
                        required: ['Role', 'Tone', 'Knowledge_Level'],
                      },
                      Task_Instructions: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      Constraints: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      Input_Examples: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            Input: { type: Type.STRING },
                            Expected_Output: { type: Type.STRING },
                          },
                          required: ['Input', 'Expected_Output'],
                        },
                      },
                      Output_Format: {
                        type: Type.OBJECT,
                        properties: {
                          Type: { type: Type.STRING },
                          Structure: {
                            type: Type.OBJECT,
                            properties: {
                              character_details: { type: Type.STRING },
                              setting_details: { type: Type.STRING },
                              key_action: { type: Type.STRING },
                              camera_direction: { type: Type.STRING },
                            },
                            required: ['character_details', 'setting_details', 'key_action', 'camera_direction'],
                          },
                        },
                        required: ['Type', 'Structure'],
                      },
                    },
                    required: ['Objective', 'Persona', 'Task_Instructions', 'Constraints', 'Input_Examples', 'Output_Format'],
                  },
                },
                required: ['scene', 'description', 'prompt'],
              },
            },
          },
        });
        const jsonText = response.text.trim();
        const parsedResults = JSON.parse(jsonText);
        setResults(parsedResults);
      } else { // OpenAI
        const openAISystemInstruction = `${systemInstruction}\n\n**OUTPUT FORMAT (CRITICAL):**\nYour final output must be a single, valid JSON object with one key: "scenes". The value of "scenes" should be an array of objects, where each object represents a scene. Each scene object must contain 'scene', 'description', and 'prompt' keys.`;
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: openAISystemInstruction },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const jsonText = data.choices[0].message.content;
        const parsedResponse = JSON.parse(jsonText);
        
        if (!parsedResponse.scenes || !Array.isArray(parsedResponse.scenes)) {
          throw new Error("Invalid response format from OpenAI. Expected a 'scenes' array.");
        }
        
        setResults(parsedResponse.scenes);
      }

    } catch (e) {
      console.error(e);
      setError(getApiErrorMessage(e));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = async (promptText: string, sceneNumber: number) => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedScene(sceneNumber);
      setTimeout(() => setCopiedScene(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setError(`Could not copy text. Please copy it manually.`);
      setTimeout(() => setError(null), 3000);
    }
  };
  
  const handleDownloadPrompts = () => {
    const promptsOnly = results.reduce((acc, scene) => {
      acc[`scene_${scene.scene}`] = scene.prompt;
      return acc;
    }, {} as Record<string, PromptObject>);
    
    const jsonString = JSON.stringify(promptsOnly, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated_prompts.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadScript = () => {
    const jsonString = JSON.stringify(results, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated_script.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!googleApiKey && !openaiApiKey) {
    return <ApiKeyPrompt />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Column */}
        <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
          <div>
            <label htmlFor="idea-textarea" className="block text-sm font-semibold mb-1">
              1. Nhập Content / Ý tưởng
            </label>
            <textarea
              id="idea-textarea"
              className="w-full h-40 bg-slate-800 border border-slate-600 rounded-md p-3 text-base text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="Ví dụ: Cuộc đại chiến tranh giành lãnh thổ giữa Kong và một con Gấu khổng lồ trong khu rừng rậm Amazon."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <div>
            <label htmlFor="duration-input" className="block text-sm font-semibold mb-1">
              2. Cài đặt thời lượng Video (tùy chọn)
            </label>
            <Input
              id="duration-input"
              placeholder="Ví dụ: 30 giây, 1 phút, 90s..."
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">3. Chọn AI Model</label>
            <div className="flex space-x-2 rounded-lg bg-slate-800 p-1 border border-slate-700">
              <Button 
                variant={apiProvider === 'google' ? 'active' : 'secondary'} 
                onClick={() => setApiProvider('google')}
                className="flex-1 text-xs sm:text-sm"
                disabled={isGenerating}
              >
                Google Gemini
              </Button>
              <Button 
                variant={apiProvider === 'openai' ? 'active' : 'secondary'} 
                onClick={() => setApiProvider('openai')}
                className="flex-1 text-xs sm:text-sm"
                disabled={isGenerating}
              >
                OpenAI GPT-4o
              </Button>
            </div>
          </div>
          <Button
            variant="primary"
            className="w-full text-lg py-3"
            onClick={handleGenerate}
            disabled={isGenerating || !idea.trim()}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center">
                <Spinner /> Generating...
              </span>
            ) : '4. Tạo kịch bản & Prompt'}
          </Button>
        </div>
        
        {/* Output Column */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 min-h-[300px] flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-white">Kết quả</h3>
            {results.length > 0 && (
              <div className="flex items-center space-x-2">
                <Button onClick={handleDownloadPrompts} variant="secondary" className="text-xs py-1">
                  Download JSON
                </Button>
                <Button onClick={handleDownloadScript} variant="secondary" className="text-xs py-1">
                  Download Kịch bản
                </Button>
              </div>
            )}
          </div>
          <div className="flex-grow overflow-y-auto space-y-3 pr-2">
            {isGenerating && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <Spinner />
                    <p className="mt-2 text-cyan-400">AI is writing, please wait...</p>
                    <p className="text-xs text-gray-500 mt-1">This may take a moment.</p>
                </div>
            )}
            {error && <ErrorDisplay message={error} />}
            {!isGenerating && results.length === 0 && !error && (
              <p className="text-center text-gray-500 pt-8">The generated script and prompts will appear here.</p>
            )}
            {results.map((scene) => (
              <div key={scene.scene} className="bg-slate-800 border border-slate-700 p-3 rounded-lg space-y-2">
                <h4 className="font-bold text-cyan-400">Cảnh {scene.scene}</h4>
                <div>
                  <h5 className="text-sm font-semibold text-gray-100">Mô tả cảnh:</h5>
                  <p className="text-sm text-gray-300 mt-1">{scene.description}</p>
                </div>
                <div>
                   <h5 className="text-sm font-semibold text-gray-100 mb-1">Câu lệnh (Prompt):</h5>
                   <div className="relative bg-slate-900 rounded-md font-mono text-xs text-yellow-300">
                    <button 
                      onClick={() => handleCopyPrompt(JSON.stringify(scene.prompt, null, 2), scene.scene)} 
                      className="absolute top-2 right-2 z-10 bg-slate-700 hover:bg-slate-600 text-white font-bold py-1 px-2 text-[10px] rounded"
                      aria-label={`Copy prompt for scene ${scene.scene}`}
                    >
                      {copiedScene === scene.scene ? 'Copied!' : 'Copy'}
                    </button>
                    <pre className="whitespace-pre-wrap break-words p-2 pr-12">{JSON.stringify(scene.prompt, null, 2)}</pre>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
    <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-center">
        <p className="text-red-400 text-sm font-semibold">Error</p>
        <p className="text-xs text-red-300 mt-1">{message}</p>
    </div>
);

export default ScriptGeneratorTab;
