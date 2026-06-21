import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, UserIcon } from "lucide-react";
import axios from "axios";
import { CreateRoomModal } from "../components/CreateRoomModal";
import { JoinRoomModal } from "../components/JoinRoomModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [userdata, setUserdata] = useState(null);
  const [error, setError] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const HTTP_BACKEND_URL = import.meta.env.VITE_HTTP_BACKEND_URL || "http://localhost:8080/api";
  const loading = loadingRooms || loadingUser;

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      navigate("/signin");
      return;
    }

    const fetchRooms = async () => {
      try {
        const response = await axios.get(`${HTTP_BACKEND_URL}/rooms`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRooms(response.data.rooms ?? []);
      } catch (err) {
        console.error("Failed to fetch rooms:", err);
        setError("Failed to fetch rooms. Please try again later.");
      } finally {
        setLoadingRooms(false);
      }
    };

    const fetchUser = async () => {
      try {
        const response = await axios.get(`${HTTP_BACKEND_URL}/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserdata(response.data.user ?? null);
      } catch (err) {
        console.error("Failed to fetch user data:", err);
        setError("Failed to fetch user profile. Please login again.");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchRooms();
    fetchUser();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/signin");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span>Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="max-w-7xl mx-auto">
        
        {/* Dashboard Header */}
        <div className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Any Draw</span>
          </div>

          <button
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-full transition-colors"
          >
            <UserIcon className="w-5 h-5" /> Profile
          </button>
        </div>

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white">Dashboard</h1>
        </div>

        {error && (
          <p className="text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-md mb-6">
            {error}
          </p>
        )}

        {/* Create & Join Actions */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-slate-950/40 border border-slate-800 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:border-slate-700 transition-colors">
            <h2 className="text-2xl font-semibold mb-4">Create a New Room</h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-blue-600/10"
            >
              Open Create Room Modal
            </button>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:border-slate-700 transition-colors">
            <h2 className="text-2xl font-semibold mb-4">Join an Existing Room</h2>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Open Join Room Modal
            </button>
          </div>
        </div>

        {/* Room List */}
        <div>
          <h2 className="text-3xl font-semibold mb-6 text-slate-300">Your Rooms</h2>
          {rooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="bg-slate-950/40 border border-slate-800 p-6 rounded-xl shadow-lg flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="mb-4 space-y-2">
                    <span className="text-xl font-bold text-white block">Room: {room.slug}</span>
                    <span className="text-sm text-slate-400 block">Room ID: {room.id}</span>
                    <span className="text-sm text-slate-400 block">Created: {new Date(room.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => navigate(`/canvas/${room.id}`)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-5 rounded-lg transition-colors"
                    >
                      Enter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-lg">You haven't joined or created any rooms yet.</p>
          )}
        </div>
      </div>

      {/* Profile Sidebar */}
      {isProfileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 transition-opacity"
            onClick={() => setIsProfileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed right-0 top-0 h-full w-80 z-50 transform bg-slate-800 border-l border-slate-700 p-6 text-white shadow-2xl transition-transform duration-300"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex flex-col h-full">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-6 border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold">Profile</h2>
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  aria-label="Close profile"
                >
                  ✕
                </button>
              </div>

              {/* Profile Content */}
              <div className="flex-1 space-y-4 overflow-y-auto">
                {userdata ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white">{userdata.name}</div>
                        <div className="text-sm text-slate-400">{userdata.email}</div>
                      </div>
                    </div>

                    <div className="border-t border-slate-700 pt-4 space-y-1">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">User ID</p>
                      <p className="text-sm text-slate-300 break-all">{userdata.id}</p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span>Loading profile...</span>
                  </div>
                )}
              </div>

              {/* Logout Button */}
              <div className="pt-4 border-t border-slate-700">
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-500 transition-colors font-semibold"
                >
                  Logout
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRoomCreated={() => window.location.reload()}
      />
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  );
}
