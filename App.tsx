
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Button from './components/shared/Button';
import ScriptGeneratorTab from './components/ScriptGeneratorTab';
import SettingsTab from './components/SettingsTab';

type Tab = 'script' | 'profile';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('script');
  const [apiKey, setApiKey] = useState('');
  const [chatGptApiKey, setChatGptApiKey] = useState('');

  useEffect(() => {
    const savedApiKey = localStorage.getItem('googleApiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    const savedChatGptKey = localStorage.getItem('chatGptApiKey');
    if (savedChatGptKey) {
      setChatGptApiKey(savedChatGptKey);
    }
  }, []);

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('googleApiKey', newKey);
  };
  
  const handleChatGptApiKeyChange = (newKey: string) => {
    setChatGptApiKey(newKey);
    localStorage.setItem('chatGptApiKey', newKey);
  }

  const TabButton: React.FC<{ tabName: Tab; label: string }> = ({ tabName, label }) => (
    <Button
      variant={activeTab === tabName ? 'active' : 'secondary'}
      onClick={() => setActiveTab(tabName)}
      className="flex-1 text-xs sm:text-sm"
    >
      {label}
    </Button>
  );

  return (
    <div className="min-h-screen p-2 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Header />
        <main className="bg-[#1e293b] text-gray-300 p-3 sm:p-6 rounded-lg border border-slate-700 shadow-2xl space-y-6">
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 border-b border-slate-700 pb-4">
            <TabButton tabName="script" label="WorkFlow" />
            <TabButton tabName="profile" label="Profile" />
          </div>

          <div>
            {activeTab === 'script' && <ScriptGeneratorTab apiKey={apiKey} />}
            {activeTab === 'profile' && (
              <SettingsTab 
                apiKey={apiKey}
                onApiKeyChange={handleApiKeyChange}
                chatGptApiKey={chatGptApiKey}
                onChatGptApiKeyChange={handleChatGptApiKeyChange}
              />
            )}
          </div>

        </main>
      </div>
    </div>
  );
};

export default App;