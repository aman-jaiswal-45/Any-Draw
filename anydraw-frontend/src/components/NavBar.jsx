import React from "react";
import { Link } from "react-router-dom";

export const NavBar = () => {
  return (
    <div className="flex justify-between items-center py-4 px-6 bg-slate-900/40">
      <div className="flex gap-2 items-center">
        <img src="/logo.png" alt="App Logo" className="w-10 h-10 object-contain" />
        <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Any Draw</span>
      </div>
      <div className="flex gap-4 text-[0.85rem] md:text-[1rem] font-medium text-white">
        <Link to="/signin">
          <button className="h-10 px-6 font-semibold rounded-lg bg-slate-200 text-black hover:bg-white transition-colors">
            Sign in
          </button>
        </Link>
        <Link to="/signup">
          <button className="h-10 px-6 font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors">
            Sign up
          </button>
        </Link>
      </div>
    </div>
  );
};
