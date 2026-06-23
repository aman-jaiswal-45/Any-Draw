import axios from "axios";

const HTTP_BACKEND_URL = import.meta.env.VITE_HTTP_BACKEND_URL || "http://localhost:8080/api";

export async function getExistingShapes(roomId) {
  try {
    const token = localStorage.getItem("authToken");
    const res = await axios.get(`${HTTP_BACKEND_URL}/chats/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const messages = res.data.messages || [];

    const shapes = messages.map((x) => {
      const messageData = JSON.parse(x.message);
      return {
        id: String(x.id),
        shape: messageData.shape,
      };
    });

    return shapes;
  } catch (e) {
    console.error("Failed to fetch existing room shapes", e);
    return [];
  }
}
