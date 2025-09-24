
import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import Button from './shared/Button';
import Input from './shared/Input';

interface ScriptGeneratorTabProps {
  apiKey: string;
}

interface Scene {
  scene: number;
  description: string;
  prompt: string;
}

const ApiKeyPrompt: React.FC = () => (
  <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 text-center">
    <h3 className="text-lg font-bold text-white mb-2">Yêu cầu API Key</h3>
    <p className="text-gray-400">
      Vui lòng vào tab 'Profile' để nhập API key của bạn để sử dụng tính năng này.
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


const ScriptGeneratorTab: React.FC<ScriptGeneratorTabProps> = ({ apiKey }) => {
  const [idea, setIdea] = useState('');
  const [duration, setDuration] = useState('');
  const [results, setResults] = useState<Scene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedScene, setCopiedScene] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!apiKey) {
      setError("Please set your API key in the 'Profile' tab.");
      return;
    }
    if (!idea.trim()) {
      setError("Please enter a content idea.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResults([]);

    try {
      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `You are an expert scriptwriter and AI prompt engineer. Your task is to transform a user's simple idea into a detailed, thrilling script with corresponding high-quality video prompts.

**LANGUAGE REQUIREMENT (CRITICAL):**
- The "description" field MUST be written in VIETNAMESE. This is for the user to understand the scene.
- The "prompt" field MUST be written in ENGLISH. This is for the AI video generator.

- **Storytelling & Scene Generation:**
    - Develop a compelling narrative from the user's idea, with a clear beginning, rising action, a climax, and a resolution.
    - If the user specifies a number of scenes, generate exactly that number. Otherwise, aim for 10-20 scenes for a complete story.
    - Create thrilling, diverse scenes with unexpected twists and dramatic moments.

- **Output Format:** Your final output MUST be a valid JSON array of objects, with no other text or markdown.

- **JSON Object Schema:** Each object must strictly follow this structure: { "scene": number, "description": "string in VIETNAMESE", "prompt": "string in ENGLISH" }.

- **Video Prompt Crafting (Crucial - IN ENGLISH):**
    - For each scene, generate a single, highly detailed prompt.
    - **Cinematic Quality:** Use terms like "cinematic shot," "4K, high detail," "photorealistic."
    - **Camera Work:** Include specific camera movements and angles (e.g., "dynamic tracking shot," "extreme slow-motion close-up," "sweeping aerial drone shot").
    - **Vivid Details:** Describe lighting, environment, character appearance, emotions, and actions with rich detail.
    - **Character Consistency (Critical):** If a character appears in multiple scenes, you MUST describe their appearance with extreme consistency (clothing, hair, facial features, etc.). Repeat these details in every prompt where the character is present.
    - **Setting Consistency:** Ensure setting details remain consistent across all prompts.

- **Goal:** The final JSON should be directly usable. The user will copy each ENGLISH prompt to generate video scenes, using the VIETNAMESE description for context.`;
      
      let userPrompt = `Generate a script and video prompts based on these details:\n\nIdea: "${idea}"`;

      const totalSeconds = parseDurationToSeconds(duration);
      if (totalSeconds) {
          const requiredScenes = Math.ceil(totalSeconds / 8);
          userPrompt += `\n\nRequirement: The final video should be approximately ${duration} (${totalSeconds} seconds). To achieve this, you MUST generate exactly ${requiredScenes} scenes, as each scene will become an 8-second video clip.`;
      } else {
          userPrompt += `\n\nDesired Video Duration: "${duration || 'not specified'}"`;
      }

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
                scene: {
                  type: Type.INTEGER,
                  description: "The scene number, starting from 1.",
                },
                description: {
                  type: Type.STRING,
                  description: "A VIETNAMESE description of what happens in this scene.",
                },
                prompt: {
                  type: Type.STRING,
                  description: "A detailed, vivid prompt in ENGLISH for a text-to-video AI, based on the scene description.",
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

    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during generation.';
      setError(`Failed to generate script. Please check your API key and prompt. Error: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = (promptText: string, sceneNumber: number) => {
    navigator.clipboard.writeText(promptText);
    setCopiedScene(sceneNumber);
    setTimeout(() => setCopiedScene(null), 2000);
  };
  
  const handleDownloadPrompts = () => {
    const promptsOnly = results.reduce((acc, scene) => {
      acc[`scene_${scene.scene}`] = scene.prompt;
      return acc;
    }, {} as Record<string, string>);
    
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

  if (!apiKey) {
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
              className="w-full h-40 bg-slate-800 border border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
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
            ) : 'Tạo kịch bản & Prompt'}
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
                   <div className="bg-slate-900 p-2 rounded-md font-mono text-xs text-yellow-300 relative">
                    <pre className="whitespace-pre-wrap break-words">{scene.prompt}</pre>
                    <button 
                      onClick={() => handleCopyPrompt(scene.prompt, scene.scene)} 
                      className="absolute top-1 right-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-1 px-2 text-[10px] rounded"
                      aria-label={`Copy prompt for scene ${scene.scene}`}
                    >
                      {copiedScene === scene.scene ? 'Copied!' : 'Copy'}
                    </button>
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