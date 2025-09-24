
import React, { useState, useRef } from 'react';
import Button from './shared/Button';
import Input from './shared/Input';
import { GoogleGenAI } from '@google/genai';

interface VideoTask {
  id: string;
  imageFile: File;
  imageDataUrl: string;
  prompt: string;
  status: 'Pending' | 'Generating...' | 'Downloading...' | 'Done' | 'Error';
  error?: string;
}

interface WorkflowTabProps {
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

const WorkflowTab: React.FC<WorkflowTabProps> = ({ addLog, apiKey }) => {
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [promptText, setPromptText] = useState('');
  
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // FIX: Explicitly type 'file' as 'File' to resolve type inference issues.
    // This fixes errors where `file.name` was not accessible and `createObjectURL(file)` failed.
    const newTasks: VideoTask[] = Array.from(files).map((file: File) => {
      const existingTask = tasks.find(t => t.imageFile.name === file.name);
      return existingTask || {
        id: `${file.name}-${Date.now()}`,
        imageFile: file,
        imageDataUrl: URL.createObjectURL(file),
        prompt: '',
        status: 'Pending',
      }
    });
    setTasks(newTasks);
    addLog(`Selected ${files.length} images. Ready for prompts.`, 'info');
    // Reset file input value to allow re-selection of the same file
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleApplyPromptsFromText = () => {
    if (tasks.length === 0 || !promptText.trim()) return;

    const prompts = promptText.split('\n').filter(p => p.trim() !== '');
    
    setTasks(currentTasks => 
      currentTasks.map((task, index) => ({
        ...task,
        prompt: prompts[index] || task.prompt || 'No prompt provided for this image.',
      }))
    );
    addLog(`Applied ${prompts.length} prompts from the text area.`, 'success');
  };

  const moveTask = (id: string, direction: 'up' | 'down') => {
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tasks.length) return;

    const newTasks = [...tasks];
    const [movedItem] = newTasks.splice(index, 1);
    newTasks.splice(newIndex, 0, movedItem);
    setTasks(newTasks);
  };
  
  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }
  
  const setTaskStatus = (id: string, status: VideoTask['status'], error?: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status, error } : t));
  };

  const runSingleTask = async (task: VideoTask) => {
    const taskName = task.imageFile.name;
    try {
        addLog(`[${taskName}] Starting task...`, 'info');
        setTaskStatus(task.id, 'Generating...');
        
        const ai = new GoogleGenAI({ apiKey });

        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(task.imageFile);
        });

        const request: any = {
            model: 'veo-2.0-generate-001',
            prompt: task.prompt,
            image: {
                imageBytes: base64Data,
                mimeType: task.imageFile.type,
            },
            config: {
                numberOfVideos: 1,
            }
        };

        addLog(`[${taskName}] Generating video... This may take several minutes.`, 'info');
        let operation = await ai.models.generateVideos(request);
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            addLog(`[${taskName}] Polling for video status...`, 'info');
        }

        if (operation.error) {
            throw new Error(`API Error: ${operation.error.message}`);
        }
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error('Video generation succeeded, but no download link was provided.');
        }

        setTaskStatus(task.id, 'Downloading...');
        addLog(`[${taskName}] Downloading video...`, 'info');
        const videoResponse = await fetch(`${downloadLink}&key=${apiKey}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }
        
        const videoBlob = await videoResponse.blob();
        const url = window.URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const cleanName = taskName.substring(0, taskName.lastIndexOf('.')).replace(/[\s/\\?%*:|"<>]/g, '_');
        a.download = `${cleanName}.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        setTaskStatus(task.id, 'Done');
        addLog(`[${taskName}] Task completed successfully.`, 'success');
    } catch (error) {
        console.error(`[${taskName}] Task failed:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog(`Error in task "${taskName}": ${errorMessage}`, 'error');
        setTaskStatus(task.id, 'Error', errorMessage);
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      addLog('API Key is missing. Please set it in the Profile tab.', 'error');
      return;
    }
    if (tasks.some(t => !t.prompt)) {
      addLog('Some images are missing prompts. Please paste prompts and click "Apply Prompts".', 'warning');
      return;
    }
    
    setIsProcessing(true);
    addLog(`Starting batch generation for ${tasks.length} videos...`, 'info');

    for (const task of tasks) {
      if (task.status === 'Pending' || task.status === 'Error') {
        await runSingleTask(task);
      }
    }
    
    setIsProcessing(false);
    addLog('Batch processing finished.', 'info');
  };
  
  const getStatusColor = (status: VideoTask['status']) => {
    switch (status) {
      case 'Generating...':
      case 'Downloading...':
         return 'text-yellow-400 animate-pulse';
      case 'Done': return 'text-green-400';
      case 'Error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };
  
  if (!apiKey) {
    return <ApiKeyPrompt />;
  }
  
  const allTasksDone = tasks.length > 0 && tasks.every(t => t.status === 'Done' || t.status === 'Error');
  const readyToGenerate = tasks.length > 0 && tasks.some(t => t.prompt);

  return (
    <div className="space-y-6">
       <input type="file" hidden ref={imageInputRef} accept="image/*" multiple onChange={handleImageSelect} />

        {/* --- Section 1: Setup --- */}
        <div>
            <h3 className="text-lg font-bold text-white mb-2">1. Configuration</h3>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-3">
                 <div>
                    <label className="block text-sm font-semibold mb-1">Download Folder</label>
                    <Input 
                        placeholder="Defaults to your browser's Downloads folder"
                        disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">Note: Due to browser security, this tool cannot select a custom download folder.</p>
                </div>
            </div>
        </div>

        {/* --- Section 2: Inputs --- */}
        <div>
          <h3 className="text-lg font-bold text-white mb-2">2. Upload hình ảnh</h3>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-4">
              <div>
                  <Button variant="secondary" className="w-full" onClick={() => imageInputRef.current?.click()}>Select Images</Button>
              </div>
              <div>
                  <label htmlFor="prompt-textarea" className="block text-sm font-semibold mb-1">
                      Dán Prompts (mỗi dòng một câu lệnh)
                  </label>
                  <textarea
                      id="prompt-textarea"
                      className="w-full h-24 bg-slate-800 border border-slate-600 rounded-md p-2 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder={tasks.length > 0 ? "Câu lệnh cho ảnh 1\nCâu lệnh cho ảnh 2\n..." : "Vui lòng chọn ảnh trước..."}
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      disabled={tasks.length === 0}
                      aria-label="Paste prompts here"
                  />
                  <Button
                      variant="secondary"
                      className="w-full mt-2"
                      onClick={handleApplyPromptsFromText}
                      disabled={tasks.length === 0 || !promptText.trim()}
                  >
                      Apply Prompts
                  </Button>
              </div>
          </div>
        </div>
      
        {/* --- Section 3: Generation Queue --- */}
        <div>
           <h3 className="text-lg font-bold text-white mb-2">3. Review and Generate</h3>
           <div className="bg-slate-900/50 border border-slate-700 rounded-lg max-h-[500px] overflow-y-auto">
                {tasks.length === 0 ? (
                    <p className="text-center text-gray-500 p-8">Please select images to begin.</p>
                ) : (
                    <ul className="divide-y divide-slate-700">
                        {tasks.map((task, index) => (
                          <li key={task.id} className="p-3 flex items-center space-x-2 sm:space-x-4">
                              <span className="text-sm font-mono text-gray-500">{index + 1}.</span>
                              <img src={task.imageDataUrl} alt={task.imageFile.name} className="h-12 w-12 sm:h-16 sm:w-16 object-cover rounded-md bg-slate-800 flex-shrink-0" />
                              <div className="flex-grow min-w-0">
                                  <p className="font-semibold text-white truncate" title={task.imageFile.name}>{task.imageFile.name}</p>
                                  <p className="text-sm text-gray-400 truncate" title={task.prompt}>{task.prompt || 'Waiting for prompt...'}</p>
                                  <p className={`text-xs font-mono font-bold ${getStatusColor(task.status)}`}>{task.status}</p>
                              </div>
                              <div className="flex flex-col space-y-1">
                                  <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => moveTask(task.id, 'up')} disabled={index === 0}>↑</Button>
                                  <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => moveTask(task.id, 'down')} disabled={index === tasks.length - 1}>↓</Button>
                              </div>
                              <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => removeTask(task.id)}>X</Button>
                          </li>
                        ))}
                    </ul>
                )}
           </div>
        </div>
        
        {/* --- Section 4: Controls --- */}
        <div className="pt-4">
            <Button 
                variant="primary" 
                className="w-full text-lg py-3" 
                onClick={handleGenerate} 
                disabled={isProcessing || !readyToGenerate || allTasksDone}
            >
                {isProcessing ? 'Processing...' : `Generate All Videos (${tasks.filter(t=>t.status==='Pending').length})`}
            </Button>
        </div>
    </div>
  );
};

export default WorkflowTab;