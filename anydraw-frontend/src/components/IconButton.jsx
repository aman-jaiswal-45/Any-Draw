import React from "react";

export function IconButton({ icon, onClick, activated }) {
  return (
    <div
      className={`m-1.5 cursor-pointer rounded-full border p-2 bg-black/70 hover:bg-slate-800 transition-colors ${
        activated ? "text-blue-400 border-blue-500" : "text-white border-transparent"
      }`}
      onClick={onClick}
    >
      {icon}
    </div>
  );
}
