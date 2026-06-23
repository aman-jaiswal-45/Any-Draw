import React from "react";

export function IconButton({ icon, onClick, activated, disabled }) {
  return (
    <button
      disabled={disabled}
      className={`m-0.5 rounded-lg border p-2 transition-all focus:outline-none ${
        disabled
          ? "opacity-30 cursor-not-allowed border-transparent text-slate-400 dark:text-slate-600"
          : activated
          ? "text-blue-600 dark:text-blue-400 border-blue-500 bg-blue-50 dark:bg-blue-500/10 cursor-pointer"
          : "text-slate-600 dark:text-slate-350 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
      }`}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
