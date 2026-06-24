# AnyDraw Frontend ⚛️

This is the React frontend client for **AnyDraw**, a real-time collaborative whiteboarding application. It implements an interactive HTML5 Canvas drawing board, synced cursors, laser pointers, top bar styling tools, and waitlist management UI.

---

## Tech Stack & Libraries 🛠️

- **Framework**: React 18
- **Bundler**: Vite
- **Canvas Interface**: HTML5 Canvas API (custom drawing engine logic)
- **Styling**: Tailwind CSS & Vanilla CSS (modern glassmorphism design)
- **HTTP Client**: Axios (for communicating with REST APIs)
- **Icons**: Lucide React
- **Router**: React Router DOM (client-side routing)

---

## Folder Structure & Modules 📁

```text
anydraw-frontend/
├── public/              # Static assets (logos, icons)
├── src/
│   ├── components/      # UI components (Canvas, Topbar, Modals, Forms)
│   ├── context/         # React Contexts (Theme toggle state)
│   ├── draw/            # Canvas rendering loops and tool handlers
│   │   ├── Game.js      # Main game loop, WebSocket listeners, and canvas states
│   │   ├── select.js    # Bounding box calculation & shape selection
│   │   ├── resize.js    # Shape transformation and handle drag resizing
│   │   └── tools.js     # pencil drawing tool trackers
│   ├── pages/           # Pages (Dashboard, Login, Signup)
│   └── App.jsx          # Route declarations
├── vercel.json          # SPA redirection setup for hosting
└── package.json         # Scripts and dependencies
```

---

## Configuration ⚙️

The frontend requires environment variables to locate the backend server endpoints. These can be configured in a `.env` file at the root of this folder.

| Key | Description | Example (Local) | Example (Production) |
| :--- | :--- | :--- | :--- |
| `VITE_HTTP_BACKEND_URL` | Base API URL | `http://localhost:8080/api` | `https://Your Backend Deployed URL/api` |
| `VITE_WS_BACKEND_URL` | WebSocket URL | `ws://localhost:8080/ws` | `wss://Backend Live URL/ws` |

---

## Local Development Setup 🚀

1. Install all dependencies:
   ```bash
   npm install
   ```
2. Start the Vite local development server:
   ```bash
   npm run dev
   ```
   The application will be live at `http://localhost:5173`.

---

## Production Build & Routing 📦

To build a minimized bundle for production:
```bash
npm run build
```

### SPA Redirection
Because this is a Single Page Application (SPA) utilizing React Router, you must route all HTTP requests back to `index.html` on reload. This is preconfigured inside `vercel.json` for Vercel deployment:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
