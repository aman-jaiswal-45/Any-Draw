import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { X } from "lucide-react";

export const CreateRoomModal = ({ isOpen, onClose, onRoomCreated }) => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_HTTP_BACKEND_URL || "http://localhost:8080/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setError("Room name cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError(null);

    const token = localStorage.getItem("authToken");
    if (!token) {
      setError("Authentication error. Please log in again.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/room`,
        { name: roomName.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const roomId = response.data.roomId;
      console.log("Room created with ID:", roomId);
      onRoomCreated();
      onClose();
      navigate(`/canvas/${roomId}`);
    } catch (err) {
      console.error("Error creating room:", err);
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 400 || err.response?.status === 411) {
          setError("A room with this name already exists.");
        } else if (err.response?.status === 401 || err.response?.status === 403) {
          setError("Session expired. Please log in again.");
        } else {
          setError("Failed to create room. Please try again later.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setRoomName("");
    setError(null);
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-white">Create a New Room</h3>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="text-sm text-slate-300 mb-4">
            Give your new collaborative space a name. This will be its unique identifier.
          </p>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g., project-brainstorm"
            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold transition-colors disabled:bg-blue-600/50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create & Join"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
