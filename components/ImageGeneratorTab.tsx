
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import Button from './shared/Button';

interface ImageResult {
  id: number;
  prompt: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  imageUrl?: string;
  error?: string;
}

type AspectRatio = '1:1' | '16:9' | '9:16';

interface ImageGeneratorTabProps {
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

const ImageGeneratorTab: React.FC<ImageGeneratorTabProps> = ({ apiKey }) => {
  const [prompts, setPrompts] = useState('');
  const [results, setResults] = useState<ImageResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');

  const generateImage = async (prompt: string, index: number) => {
     setResults(prev => prev.map((res, idx) => idx === index ? { ...res, status: 'generating' } : res));
     try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: aspectRatio,
            },
        });

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/png;base64,${base64ImageBytes}`;

        setResults(prev => prev.map((res, idx) => 
            idx === index ? { ...res, status: 'done', imageUrl: imageUrl } : res
        ));

     } catch(error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setResults(prev => prev.map((res, idx) => 
            idx === index ? { ...res, status: 'error', error: errorMessage } : res
        ));
     }
  };

  const handleGenerateClick = async () => {
    if (!apiKey) {
        alert('Please set your API Key in the Profile tab first.');
        return;
    }
    const promptList = prompts.split('\n').filter(p => p.trim() !== '');
    if (promptList.length === 0) {
      alert('Please enter at least one prompt.');
      return;
    }

    setIsGenerating(true);
    setResults(promptList.map((prompt, i) => ({
      id: i,
      prompt,
      status: 'pending'
    })));

    // Use Promise.all to run generations in parallel
    await Promise.all(promptList.map((prompt, index) => generateImage(prompt, index)));

    setIsGenerating(false);
  };
  
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
            <label className="block text-sm font-semibold mb-2">Aspect Ratio (Tỉ lệ ảnh)</label>
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
            <label htmlFor="prompt-textarea" className="block text-sm font-semibold mb-1">
                Prompts (mỗi dòng một câu lệnh)
            </label>
            <textarea
                id="prompt-textarea"
                className="w-full h-32 bg-slate-800 border border-slate-600 rounded-md p-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder={"Một con mèo đội mũ phù thủy\nMột con chó lướt ván trên cầu vồng\n..."}
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
                {isGenerating ? 'Generating...' : `Generate ${prompts.split('\n').filter(p=>p.trim()).length} Images`}
            </Button>
        </div>
      </div>

      {/* Section 3: Results */}
      <div>
         <h3 className="text-lg font-bold text-white mb-2">3. Results</h3>
         <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 min-h-[200px]">
            {results.length === 0 ? (
                <p className="text-center text-gray-500 pt-8">Generated images will appear here.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {results.map(res => (
                    <div key={res.id} className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col">
                        <div className="w-full aspect-square bg-slate-700 flex items-center justify-center">
                            {(res.status === 'generating' || res.status === 'pending') && <Spinner />}
                            {res.status === 'error' && <ErrorDisplay message={res.error || 'An unknown error occurred.'} />}
                            {res.status === 'done' && res.imageUrl && <img src={res.imageUrl} alt={res.prompt} className="w-full h-full object-cover" />}
                        </div>
                        <div className="p-3 flex-grow flex flex-col">
                          <p className="text-xs text-gray-400 flex-grow" title={res.prompt}>{res.prompt}</p>
                          {res.status === 'done' && res.imageUrl && (
                            <a 
                              href={res.imageUrl} 
                              download={`gemini_${res.prompt.slice(0, 20).replace(/[\s/\\?%*:|"<>]/g, '_')}_${res.id}.png`} 
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

export default ImageGeneratorTab;