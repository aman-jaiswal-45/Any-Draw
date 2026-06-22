import React from "react";
import { Github } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-white/20 dark:border-slate-800 bg-transparent dark:bg-slate-950/60 transition-colors">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-sm text-slate-300 dark:text-slate-400">
            © 2026 Any Draw. All rights reserved.
          </p>
          <div className="flex flex-col items-center justify-between space-x-6">
            <a
              href="https://github.com/aman-jaiswal-45"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-white/80 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              <Github className="w-5 h-5" /> - @Aman
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
