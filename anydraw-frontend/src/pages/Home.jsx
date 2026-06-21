import React from "react";
import { Link } from "react-router-dom";
import { Share2, Users2, Sparkles } from "lucide-react";
import { NavBar } from "../components/NavBar";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between">
      <div>
        <NavBar />
        
        {/* Hero Section */}
        <header className="relative overflow-hidden py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-white">
                Collaborative Whiteboarding
                <span className="text-blue-500 block mt-2">Made Simple</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
                Create, collaborate, and share beautiful diagrams and sketches with our intuitive drawing tool.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link to="/signin">
                  <button className="h-12 px-8 font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">
                    Sign in
                  </button>
                </Link>
                <Link to="/signup">
                  <button className="h-12 px-8 font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors border border-slate-700">
                    Sign up
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section className="py-20 bg-slate-950">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-slate-300">
            <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              
              {/* Feature 1 */}
              <div className="p-6 border border-slate-800 bg-slate-900 rounded-xl transition-all hover:border-blue-500/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Share2 className="h-6 w-6 text-blue-500" />
                  </div>
                  <h3 className="text-xl text-white font-semibold">Real-time Collaboration</h3>
                </div>
                <p className="mt-4 text-slate-400">
                  Work together with your team in real-time. Share your drawings instantly with a simple link.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 border border-slate-800 bg-slate-900 rounded-xl transition-all hover:border-blue-500/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Users2 className="h-6 w-6 text-blue-500" />
                  </div>
                  <h3 className="text-xl text-white font-semibold">Multiplayer Editing</h3>
                </div>
                <p className="mt-4 text-slate-400">
                  Multiple users can edit the same canvas simultaneously. See who's drawing what in real-time.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 border border-slate-800 bg-slate-900 rounded-xl transition-all hover:border-blue-500/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <Sparkles className="h-6 w-6 text-blue-500" />
                  </div>
                  <h3 className="text-xl text-white font-semibold">Smart Drawing</h3>
                </div>
                <p className="mt-4 text-slate-400">
                  Intelligent shape recognition and drawing assistance helps you create perfect diagrams.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-8 sm:p-16">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Ready to start creating?
                </h2>
                <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400">
                  Join thousands of users who are already creating amazing diagrams and sketches.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                  <Link to="/signin">
                    <button className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-md transition-colors">
                      Open Canvas
                    </button>
                  </Link>
                  <button className="h-12 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-md border border-slate-700 transition-colors">
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
