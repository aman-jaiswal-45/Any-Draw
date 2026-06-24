# AnyDraw 🎨

AnyDraw is a modern, premium, real-time collaborative whiteboarding application. Built with **React** on the frontend, **Spring Boot** on the backend, and powered by **WebSockets**, it enables multiple users to draw, write, and collaborate on a shared infinite canvas in real-time.

---

## Key Features 🚀

### 🎨 Creative Tools
- **Freehand Drawing**: Smooth pencil tool with customizable stroke widths and colors.
- **Shapes Library**: Rectangle, Circle, Line, Arrow, and Diamond tools.
- **Rich Text Tool**: Add text inside or outside shapes, with adjustable alignment, font families, and size.
- **Laser Pointer**: Glowing real-time red pointer with a fading tail for interactive presentations (without saving to the database).
- **Infinite Canvas & Zooming**: Pan and zoom (`Ctrl + Wheel` or pinch) to navigate large workspaces.

### 🛡️ Host & Administrative Controls
- **Waitlist Approval System**: Users must "knock" to enter. The host approves or rejects entries in real-time.
- **Room-Based User Blocking**: Hosts can block problematic users from a specific room. Blocked users are kicked instantly and banned from re-knocking.
- **Access Control Panel**: The host can view blocked users and unblock them if needed.
- **Canvas Freeze**: The host can lock the canvas globally, putting all collaborators into View-Only mode.
- **Collaborator Roles**: Demote/promote collaborators dynamically between **Editor**, **Laser Only**, and **Read-Only** modes.
- **Clear Canvas**: Wipe the board clean with full Undo/Redo integration.

### 🌓 User Experience
- **Dark Mode**: Sleek dark/light mode toggle with coordinated color palettes.
- **Real-Time Synced Cursor**: View collaborators' cursors moving in real-time.
- **Collaborator Drawer**: A panel showing active participants, roles, and blocked users.

---

## Tech Stack 💻

### Backend
- **Framework**: Spring Boot (Java 17)
- **Real-Time Communication**: Spring WebSocket
- **Security & Auth**: Spring Security, JWT (JSON Web Tokens), BCrypt hashing
- **Persistence**: Spring Data JPA, Hibernate
- **Database**: MySQL

### Frontend
- **Framework**: React (Vite)
- **Styling**: Vanilla CSS & Tailwind CSS (Glassmorphism & animations)
- **Rendering Engine**: HTML5 Canvas API
- **HTTP Client**: Axios

---

## Project Structure 📁

```text
Any-Draw/
├── anydraw-backend/        # Spring Boot application
│   ├── src/
│   ├── Dockerfile          # Eclipse Temurin container config
│   └── pom.xml
└── anydraw-frontend/       # React (Vite) application
    ├── src/
    ├── vercel.json         # SPA redirection configuration
    └── package.json
```

---

## Local Development Setup 🛠️

### 1. Database Configuration
Make sure you have a MySQL server running locally. Create a database named `anydraw`:
```sql
CREATE DATABASE anydraw;
```

### 2. Run the Backend
1. Navigate to the backend directory:
   ```bash
   cd anydraw-backend
   ```
2. Create a local secrets properties file named `src/main/resources/application-local.properties` (this file is ignored by Git):
   ```properties
   spring.datasource.password=YOUR_LOCAL_MYSQL_PASSWORD
   jwt.secret=your_local_secure_jwt_secret_key
   ```
3. Run the Spring Boot application using Maven:
   ```bash
   ./mvnw spring-boot:run
   ```
   *(The backend will start on port `8080`)*

### 3. Run the Frontend
1. Navigate to the frontend directory:
   ```bash
   cd ../anydraw-frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a local environment variables file `.env` (optional, as defaults are preconfigured for localhost):
   ```env
   VITE_HTTP_BACKEND_URL=http://localhost:8080/api
   VITE_WS_BACKEND_URL=ws://localhost:8080/ws
   ```
4. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   *(The frontend will start on port `5173`)*

---

## Production Hosting ☁️

For instructions on deploying the frontend (Vercel), backend (Render via Docker), and database (Aiven MySQL) to the cloud for free, refer to the [Hosting Guide](./hosting_guide.md).
