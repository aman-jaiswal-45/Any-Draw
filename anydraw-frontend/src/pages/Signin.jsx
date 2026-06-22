import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Logo from "../components/Logo.jsx";

export default function Signin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showAlert, setShowAlert] = useState(false);

  const BASE_URL = import.meta.env.VITE_HTTP_BACKEND_URL || "http://localhost:8080/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    
    // Simple client-side validations
    const formErrors = {};
    if (!username) formErrors.username = "Email is required";
    if (!password) formErrors.password = "Password is required";
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setAuthLoading(true);

    try {
      const response = await axios.post(`${BASE_URL}/signin`, { username, password });
      
      if (response.data && response.data.token) {
        localStorage.setItem("authToken", response.data.token);
        setShowAlert(true);
        setTimeout(() => {
          navigate("/dashboard");
        }, 1500);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403 || error.response?.status === 400) {
          setErrors({ general: error.response.data.message || "Invalid email or password" });
        } else {
          setErrors({ general: "Connection failed. Please verify the backend is running." });
        }
      } else {
        setErrors({ general: "Login failed. Please try again." });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-red-600 via-blue-600 to-purple-600 min-h-screen text-white flex flex-col">
      <nav className="p-4">
        <Link to="/" className="flex items-center">
          <Logo className="h-16 w-auto" colorMode="dark" />
        </Link>
      </nav>

      <div className="flex flex-1 items-center justify-center py-12 px-4">
        <div className="w-full max-w-md p-8 space-y-8 bg-white/80 dark:bg-white/10 border border-blue-600 dark:border-white/20 backdrop-blur-sm shadow-2xl rounded-2xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Welcome Back
            </h2>
            <p className="mt-2 text-slate-700 dark:text-slate-200">
              Sign in to your account to continue
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-md">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={authLoading}
                  placeholder="your@email.com"
                  className="w-full p-3 bg-white dark:bg-slate-950/30 border border-blue-300 dark:border-white/10 rounded-md text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.username && <p className="text-red-500 dark:text-red-300 text-xs mt-1 px-1">{errors.username}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={authLoading}
                  placeholder="••••••••"
                  className="w-full p-3 bg-white dark:bg-slate-950/30 border border-blue-300 dark:border-white/10 rounded-md text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.password && <p className="text-red-500 dark:text-red-300 text-xs mt-1 px-1">{errors.password}</p>}
              </div>
            </div>

            {errors.general && (
              <p className="text-red-500 dark:text-red-300 text-sm text-center font-semibold pt-2">{errors.general}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-all shadow-md disabled:bg-blue-600/50 disabled:cursor-not-allowed"
              >
                {authLoading ? "Logging in..." : "Sign In"}
              </button>
            </div>
          </form>

          <div className="text-center text-sm text-slate-700 dark:text-slate-200">
            New user?{" "}
            <Link to="/signup" className="font-medium text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 underline">
              Sign Up
            </Link>
          </div>
        </div>
      </div>

      {showAlert && (
        <div className="fixed top-5 right-5 bg-blue-500 text-white py-3 px-6 rounded-lg shadow-lg font-semibold animate-pulse z-50">
          Success! Redirecting to Dashboard...
        </div>
      )}
    </div>
  );
}
