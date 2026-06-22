import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Signin from "./pages/Signin.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import RoomCanvasPage from "./pages/RoomCanvasPage.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/canvas/:roomId" element={<RoomCanvasPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
