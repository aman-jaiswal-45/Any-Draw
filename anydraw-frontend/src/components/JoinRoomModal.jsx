import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { X } from "lucide-react";

export const JoinRoomModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [roomSlug, setRoomSlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const BASE_URL = import.meta.env.VITE_HTTP_BACKEND_URL || "http://localhost:8080/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomSlug.trim()) {
      setError("Please enter a room name.");
      return;
    }

    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem("authToken");

    try {
      const response = await axios.get(`${BASE_URL}/room/${roomSlug.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data && response.data.room) {
        const roomId = response.data.room.id;
        console.log("Room found with ID:", roomId);
        navigate(`/canvas/${roomId}`);
        onClose();
      } else {
        setError("Room not found. Please verify the room name.");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          setError("Room not found. Please check the name and try again.");
        } else {
          setError("An error occurred while verifying the room.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Join an Existing Room</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <p className="text-slate-300 mb-6 text-sm">
          Enter the exact name (slug) of the room you want to join.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={roomSlug}
            onChange={(e) => {
              setRoomSlug(e.target.value);
              setError(null);
            }}
            placeholder="e.g., project-brainstorm"
            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md mb-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold transition-colors disabled:bg-blue-600/50"
            >
              {isLoading ? "Verifying..." : "Go to Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
