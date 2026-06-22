import React from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

export const NavBar = () => {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div className="flex justify-between items-center py-4 px-6 bg-transparent dark:bg-slate-900/40 border-b border-white/10 dark:border-slate-800/40 transition-colors">
      <div className="flex items-center">
        <Logo className="h-14 w-auto" colorMode="dark" />
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle Select */}
        <div className="relative">
          <select
            value={theme === "system" ? (isDark ? "dark" : "light") : theme}
            onChange={(e) => setTheme(e.target.value)}
            className="appearance-none bg-white/20 dark:bg-slate-800 border border-white/20 dark:border-slate-700 hover:border-white/40 dark:hover:border-slate-600 text-white px-4 py-2 pr-8 rounded-full font-semibold focus:outline-none cursor-pointer text-sm transition-all"
          >
            <option value="light" className="text-slate-900 dark:text-white dark:bg-slate-800">☀️ Light</option>
            <option value="dark" className="text-slate-900 dark:text-white dark:bg-slate-800">🌙 Dark</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>

        <div className="flex gap-4 text-[0.85rem] md:text-[1rem] font-medium text-white">
          <Link to="/signin">
            <button className="h-10 px-6 font-semibold rounded-lg bg-[#cbd5e1] text-black hover:brightness-95 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 transition-all">
              Sign in
            </button>
          </Link>
          <Link to="/signup">
            <button className="h-10 px-6 font-semibold rounded-lg bg-[#cbd5e1] text-black hover:brightness-95 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 transition-all">
              Sign up
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};
