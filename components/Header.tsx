import React from 'react';

const Header: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes subtle-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(236, 72, 153, 0.4), 0 0 5px rgba(168, 85, 247, 0.3); }
          50% { box-shadow: 0 0 25px rgba(236, 72, 153, 0.7), 0 0 10px rgba(168, 85, 247, 0.5); }
        }
        .sparkle-button {
          animation: subtle-glow 4s ease-in-out infinite;
        }
      `}</style>
      <header className="flex flex-col gap-y-4 sm:flex-row sm:justify-between sm:items-center text-white mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start text-center sm:text-left gap-4">
          <h1 className="text-base sm:text-lg font-bold flex items-center flex-wrap justify-center sm:justify-start gap-x-2">
            <span>Tạo kịch bản & Prompt JSON</span>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="font-bold text-lg sm:text-xl">
                <span className="text-white">AI</span><span className="text-blue-500">Creators</span>
                <span className="text-slate-400 mx-1.5">|</span>
                <span className="text-white">Làm </span><span className="text-red-600">Youtube</span><span className="text-white"> AI</span>
            </span>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span>Tặng MIỄN PHÍ</span>
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <a
            href="https://lamyoutubeai.com/vip"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 text-base font-bold text-white bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-lg shadow-lg hover:scale-110 transform transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-purple-400 sparkle-button"
          >
            Giải Đáp Và Hỗ Trợ
          </a>
          <a
            href="https://lamyoutubeai.com/academy"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 text-base font-bold text-white bg-gradient-to-r from-green-400 via-teal-500 to-cyan-600 rounded-lg shadow-lg hover:scale-110 transform transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-teal-400"
          >
            Tham gia khóa học AI
          </a>
        </div>
      </header>
    </>
  );
};

export default Header;
