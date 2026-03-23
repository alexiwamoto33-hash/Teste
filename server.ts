import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for OpenAI
  app.post("/api/openai", async (req, res) => {
    try {
      const { prompt, model } = req.body;
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "OPENAI_API_KEY not configured" });
      }
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: model || "gpt-4o", // Default to current best if gpt-5.4 doesn't exist yet
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      res.json({ text: response.data.choices?.[0]?.message?.content || "No response" });
    } catch (error: any) {
      console.error("OpenAI Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // Proxy for Claude
  app.post("/api/claude", async (req, res) => {
    try {
      const { prompt, model } = req.body;
      const apiKey = process.env.CLAUDE_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "CLAUDE_API_KEY not configured" });
      }
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: model || "claude-3-5-sonnet-20240620",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
        }
      );
      res.json({ text: response.data.content?.[0]?.text || "No response" });
    } catch (error: any) {
      console.error("Claude Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // Proxy for Grok
  app.post("/api/grok", async (req, res) => {
    try {
      const { prompt, model } = req.body;
      const apiKey = process.env.GROK_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "GROK_API_KEY not configured" });
      }
      const response = await axios.post(
        "https://api.x.ai/v1/chat/completions",
        {
          model: model || "grok-beta",
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      res.json({ text: response.data.choices?.[0]?.message?.content || "No response" });
    } catch (error: any) {
      console.error("Grok Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
