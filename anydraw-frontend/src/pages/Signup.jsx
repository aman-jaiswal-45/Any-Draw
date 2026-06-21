import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showAlert, setShowAlert] = useState(false);

  const BASE_URL = import.meta.env.VITE_HTTP_BACKEND_URL || "http://localhost:8080/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Simple validation checks
    const formErrors = {};
    if (!name || name.length < 2) formErrors.name = "Name must be at least 2 characters";
    if (!username || !username.includes("@")) formErrors.username = "Invalid email format";
    if (!password || password.length < 6) formErrors.password = "Password must be at least 6 characters";

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setAuthLoading(true);

    try {
      await axios.post(`${BASE_URL}/signup`, { name, username, password });
      setShowAlert(true);
      setTimeout(() => {
        navigate("/signin");
      }, 2000);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setErrors({ general: error.response?.data?.message || "Registration failed. Email might already be in use." });
      } else {
        setErrors({ general: "An unexpected error occurred. Please try again." });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-red-600 via-blue-600 to-purple-600 min-h-screen text-white flex flex-col">
      <nav className="p-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="App Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold bg-white/90 bg-clip-text text-transparent">Any Draw</span>
        </Link>
      </nav>

      <div className="flex flex-1 items-center justify-center py-12 px-4">
        <div className="w-full max-w-md p-8 space-y-8 bg-white/10 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Create Your Account
            </h2>
            <p className="mt-2 text-slate-200">
              And start collaborating in seconds.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-md">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="name">Your Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={authLoading}
                  placeholder="John Doe"
                  className="w-full p-3 bg-slate-950/30 border border-white/10 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.name && <p className="text-red-300 text-xs mt-1 px-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={authLoading}
                  placeholder="your@email.com"
                  className="w-full p-3 bg-slate-950/30 border border-white/10 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.username && <p className="text-red-300 text-xs mt-1 px-1">{errors.username}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={authLoading}
                  placeholder="••••••••"
                  className="w-full p-3 bg-slate-950/30 border border-white/10 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.password && <p className="text-red-300 text-xs mt-1 px-1">{errors.password}</p>}
              </div>
            </div>

            {errors.general && (
              <p className="text-red-300 text-sm text-center font-semibold pt-2">{errors.general}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-all shadow-md disabled:bg-blue-600/50 disabled:cursor-not-allowed"
              >
                {authLoading ? "Creating Account..." : "Sign Up"}
              </button>
            </div>
          </form>

          <div className="text-center text-sm text-slate-200">
            Already have an account?{" "}
            <Link to="/signin" className="font-medium text-blue-300 hover:text-blue-100 underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {showAlert && (
        <div className="fixed top-5 right-5 bg-blue-500 text-white py-3 px-6 rounded-lg shadow-lg font-semibold animate-pulse z-50">
          Success! Account created. Redirecting to login...
        </div>
      )}
    </div>
  );
}
