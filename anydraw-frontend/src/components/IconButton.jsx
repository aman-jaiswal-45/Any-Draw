import React from "react";

export function IconButton({ icon, onClick, activated }) {
  return (
    <button
      className={`m-0.5 cursor-pointer rounded-lg border p-2 transition-all focus:outline-none ${
        activated
          ? "text-blue-600 dark:text-blue-400 border-blue-500 bg-blue-50 dark:bg-blue-500/10"
          : "text-slate-600 dark:text-slate-350 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
