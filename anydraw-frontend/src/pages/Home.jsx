import React from "react";
import { Link } from "react-router-dom";
import { Share2, Users2, Sparkles } from "lucide-react";
import { NavBar } from "../components/NavBar";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-blue-600 to-purple-600 dark:bg-none dark:bg-slate-900 text-white flex flex-col justify-between transition-colors duration-200">
      <div>
        <NavBar />
        
        {/* Hero Section */}
        <header className="relative overflow-hidden py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-white animate-fade-in">
                Collaborative Whiteboarding
                <span className="text-white/70 dark:text-blue-500 block mt-2">Made Simple</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90 dark:text-slate-300">
                Create, collaborate, and share beautiful diagrams and sketches with our intuitive drawing tool.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link to="/signin">
                  <button className="h-12 px-8 font-semibold rounded-lg bg-white text-black hover:brightness-90 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 transition-all shadow-lg dark:shadow-blue-500/20">
                    Sign in
                  </button>
                </Link>
                <Link to="/signup">
                  <button className="h-12 px-8 font-semibold rounded-lg bg-white text-black hover:brightness-90 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 transition-all border border-transparent dark:border-slate-700 shadow-lg dark:shadow-none">
                    Sign up
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section className="py-20 bg-transparent transition-colors duration-200">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              
              {/* Feature 1 */}
              <div className="p-6 border-2 border-transparent bg-[#cbd5e1] hover:border-[#334155] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 rounded-xl transition-all shadow-md dark:shadow-none">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-600/10 dark:bg-blue-500/10">
                    <Share2 className="h-6 w-6 text-[#2563EB] dark:text-blue-500" />
                  </div>
                  <h3 className="text-xl text-[#2563EB] dark:text-white font-semibold">Real-time Collaboration</h3>
                </div>
                <p className="mt-4 text-[#101010] dark:text-slate-400">
                  Work together with your team in real-time. Share your drawings instantly with a simple link.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 border-2 border-transparent bg-[#cbd5e1] hover:border-[#334155] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 rounded-xl transition-all shadow-md dark:shadow-none">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-600/10 dark:bg-blue-500/10">
                    <Users2 className="h-6 w-6 text-[#2563EB] dark:text-blue-500" />
                  </div>
                  <h3 className="text-xl text-[#2563EB] dark:text-white font-semibold">Multiplayer Editing</h3>
                </div>
                <p className="mt-4 text-[#101010] dark:text-slate-400">
                  Multiple users can edit the same canvas simultaneously. See who's drawing what in real-time.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 border-2 border-transparent bg-[#cbd5e1] hover:border-[#334155] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/50 rounded-xl transition-all shadow-md dark:shadow-none">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-600/10 dark:bg-blue-500/10">
                    <Sparkles className="h-6 w-6 text-[#2563EB] dark:text-blue-500" />
                  </div>
                  <h3 className="text-xl text-[#2563EB] dark:text-white font-semibold">Smart Drawing</h3>
                </div>
                <p className="mt-4 text-[#101010] dark:text-slate-400">
                  Intelligent shape recognition and drawing assistance helps you create perfect diagrams.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-transparent">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#cbd5e1] border border-transparent dark:bg-slate-950/40 dark:border-slate-800 rounded-3xl p-8 sm:p-16 transition-colors shadow-lg dark:shadow-none">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-[#2563EB] dark:text-white sm:text-4xl">
                  Ready to start creating?
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg text-slate-700 dark:text-slate-400">
                  Join thousands of users who are already creating amazing diagrams and sketches.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                  <Link to="/signin">
                    <button className="h-12 px-6 bg-[#2563EB] hover:bg-white hover:text-[#6b7280] text-white font-semibold rounded-md transition-all shadow-md dark:bg-blue-600 dark:hover:bg-blue-500">
                      Open Canvas
                    </button>
                  </Link>
                  <button className="h-12 px-6 bg-[#2563EB] hover:bg-white hover:text-[#6b7280] text-white font-semibold rounded-md transition-all shadow-md dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700">
                    View Gallery
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
