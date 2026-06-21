import React from "react";
import { Github } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-slate-700 bg-slate-900/50">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-sm text-slate-400">
            © 2026 Any Draw. All rights reserved.
          </p>
          <div className="flex flex-col items-center justify-between space-x-6">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white flex items-center gap-2">
              <Github className="w-5 h-5" /> - @Tushar
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
