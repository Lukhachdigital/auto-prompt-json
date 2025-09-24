
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="flex flex-col gap-y-3 sm:flex-row sm:justify-between sm:items-center text-white mb-6">
      <div className="flex items-center justify-center sm:justify-start text-center sm:text-left">
        <h1 className="text-lg sm:text-xl font-bold">
          Tạo kịch bản & Prompt JSON | By. <span className="text-yellow-400">LỮ KHÁCH</span> | Tặng MIỄN PHÍ
        </h1>
      </div>
    </header>
  );
};

export default Header;