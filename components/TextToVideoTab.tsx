
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import Button from './shared/Button';
import Input from './shared/Input';

// Define result structure for videos
interface VideoResult {
  id: number;
  prompt: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  videoUrl?: string; // Changed from imageUrl
  error?: string;
}

// Aspect ratio type
type AspectRatio = '1:1' | '16:9' | '9:16';

// Props for logging
interface TextToVideoTabProps {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  apiKey: string;
}

const ApiKeyPrompt: React.FC = () => (
    <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 text-center">
      <h3 className="text-lg font-bold text-white mb-2">Yêu cầu API Key</h3>
      <p className="text-gray-400">
        Vui lòng vào tab 'Profile' để nhập API key của bạn để sử dụng tính năng này.
      </p>
    </div>
);

const TextToVideoTab: React.FC<TextToVideoTabProps> = ({ addLog, apiKey }) => {
  // State variables, similar to ImageGeneratorTab
  const [prompts, setPrompts] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  
  // The main generation function
  const generateVideo = async (originalPrompt: string, index: number) => {
     // Set status to generating
     setResults(prev => prev.map((res, idx) => idx === index ? { ...res, status: 'generating' } : res));
     
     // Modify prompt with aspect ratio
     const promptWithRatio = `${originalPrompt}, aspect ratio ${aspectRatio}`;
     addLog(`[Task ${index+1}] Starting with prompt: "${promptWithRatio}"`);

     try {
        const ai = new GoogleGenAI({ apiKey });
        
        addLog(`[Task ${index+1}] Generating video... This may take several minutes.`);
        let operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: promptWithRatio,
            config: {
                numberOfVideos: 1,
            }
        });

        // Polling logic from WorkflowTab
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            addLog(`[Task ${index+1}] Polling for video status...`);
        }

        if (operation.error) {
            throw new Error(`API Error: ${operation.error.message}`);
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error('Video generation succeeded, but no download link was provided.');
        }

        const videoUrl = `${downloadLink}&key=${apiKey}`;

        // Update results with the video URL
        setResults(prev => prev.map((res, idx) => 
            idx === index ? { ...res, status: 'done', videoUrl: videoUrl } : res
        ));
        addLog(`[Task ${index+1}] Video ready!`, 'success');

     } catch(error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog(`[Task ${index+1}] Error: ${errorMessage}`, 'error');
        setResults(prev => prev.map((res, idx) => 
            idx === index ? { ...res, status: 'error', error: errorMessage } : res
        ));
     }
  };

  // Click handler for the main generate button
  const handleGenerateClick = async () => {
    if (!apiKey) {
      addLog('API Key is missing. Please set it in the Profile tab.', 'error');
      return;
    }
    const promptList = prompts.split('\n').filter(p => p.trim() !== '');
    if (promptList.length === 0) {
      addLog('Please enter at least one prompt.', 'warning');
      return;
    }

    setIsGenerating(true);
    addLog(`Starting generation for ${promptList.length} videos...`);
    setResults(promptList.map((prompt, i) => ({
      id: i,
      prompt,
      status: 'pending'
    })));

    // Generate videos one by one to avoid rate limiting and overwhelming the browser
    for (let i = 0; i < promptList.length; i++) {
        await generateVideo(promptList[i], i);
    }

    setIsGenerating(false);
    addLog('All generation tasks finished.', 'info');
  };
  
  // Aspect Ratio button component
  const AspectRatioButton: React.FC<{ value: AspectRatio, label: string }> = ({ value, label }) => (
    <Button
      variant={aspectRatio === value ? 'active' : 'secondary'}
      onClick={() => setAspectRatio(value)}
      className="flex-1"
      disabled={isGenerating}
    >
      {label}
    </Button>
  );
  
  if (!apiKey) {
    return <ApiKeyPrompt />;
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Configuration */}
      <div>
        <h3 className="text-lg font-bold text-white mb-2">1. Configuration</h3>
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
          <div>
            <label className="block text-sm font-semibold mb-2">Aspect Ratio (Tỉ lệ video)</label>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <AspectRatioButton value="1:1" label="Vuông (1:1)" />
              <AspectRatioButton value="16:9" label="Ngang (16:9)" />
              <AspectRatioButton value="9:16" label="Dọc (9:16)" />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Prompts */}
      <div>
        <h3 className="text-lg font-bold text-white mb-2">2. Enter Prompts</h3>
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
            <label htmlFor="prompt-textarea-video" className="block text-sm font-semibold mb-1">
                Prompts (mỗi dòng một câu lệnh)
            </label>
            <textarea
                id="prompt-textarea-video"
                className="w-full h-32 bg-slate-800 border border-slate-600 rounded-md p-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder={"Một cảnh quay điện ảnh về một chiếc ô tô lái qua thành phố đèn neon vào ban đêm\nMột cảnh quay bằng flycam bay qua một dãy núi\n..."}
                value={prompts}
                onChange={(e) => setPrompts(e.target.value)}
                disabled={isGenerating}
            />
            <Button
                variant="primary"
                className="w-full mt-4 text-lg py-3"
                onClick={handleGenerateClick}
                disabled={isGenerating || !prompts.trim()}
            >
                {isGenerating ? 'Generating...' : `Generate ${prompts.split('\n').filter(p=>p.trim()).length} Videos`}
            </Button>
        </div>
      </div>

      {/* Section 3: Results */}
      <div>
         <h3 className="text-lg font-bold text-white mb-2">3. Results</h3>
         <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 min-h-[200px]">
            {results.length === 0 ? (
                <p className="text-center text-gray-500 pt-8">Generated videos will appear here.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {results.map(res => (
                    <div key={res.id} className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col">
                        <div className="w-full aspect-square bg-slate-700 flex items-center justify-center">
                            {(res.status === 'generating' || res.status === 'pending') && <Spinner />}
                            {res.status === 'error' && <ErrorDisplay message={res.error || 'An unknown error occurred.'} />}
                            {res.status === 'done' && res.videoUrl && 
                              <video src={res.videoUrl} controls className="w-full h-full object-cover" />
                            }
                        </div>
                        <div className="p-3 flex-grow flex flex-col">
                          <p className="text-xs text-gray-400 flex-grow" title={res.prompt}>{res.prompt}</p>
                          {res.status === 'done' && res.videoUrl && (
                            <a 
                              href={res.videoUrl} 
                              download={`gemini_video_${res.prompt.slice(0, 20).replace(/[\s/\\?%*:|"<>]/g, '_')}_${res.id}.mp4`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <Button variant="secondary" className="w-full mt-2 text-xs py-1">Download</Button>
                            </a>
                          )}
                        </div>
                    </div>
                  ))}
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

// Helper components copied from ImageGeneratorTab
const Spinner = () => (
    <svg className="animate-spin h-10 w-10 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
    <div className="p-2 text-center">
        <p className="text-red-400 text-sm font-semibold">Error</p>
        <p className="text-xs text-red-300 mt-1">{message}</p>
    </div>
);

export default TextToVideoTab;