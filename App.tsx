
import React, { useState } from 'react';
import Header from './components/Header';
import Button from './components/shared/Button';
import ScriptGeneratorTab from './components/ScriptGeneratorTab';
import SettingsTab from './components/SettingsTab';

type Tab = 'script' | 'profile';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('script');
  // FIX: Removed Google API key state. It must be read from environment variables.
  const [openaiApiKey, setOpenaiApiKey] = useState<string>(() => localStorage.getItem('openaiApiKey') || '');

  // FIX: Removed handler for saving Google API key.
  const handleOpenaiKeySave = (key: string) => {
    setOpenaiApiKey(key);
    localStorage.setItem('openaiApiKey', key);
  };

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
      <div className="max-w-7xl mx-auto mt-10">
        <Header />
        <main className="bg-[#1e293b] text-gray-300 p-3 sm:p-6 rounded-lg border border-slate-700 shadow-2xl space-y-6">
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 border-b border-slate-700 pb-4">
            <TabButton tabName="script" label="WorkFlow" />
            <TabButton tabName="profile" label="Profile" />
          </div>

          <div>
            {/* FIX: Removed googleApiKey prop. */}
            {activeTab === 'script' && <ScriptGeneratorTab openaiApiKey={openaiApiKey} />}
            {/* FIX: Removed googleApiKey and onGoogleKeySave props. */}
            {activeTab === 'profile' && <SettingsTab 
                openaiApiKey={openaiApiKey}
                onOpenaiKeySave={handleOpenaiKeySave}
            />}
          </div>

        </main>
      </div>
    </div>
  );
};

export default App;
