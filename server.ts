import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use a larger body parser size limit since we transmit base64 images of the products
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Lazy instantiate the GoogleGenAI instance inside endpoint calls to handle missing keys gracefully on startup
  const getAiClient = (req?: any) => {
    const customApiKey = req?.headers?.["x-custom-api-key"];
    const apiKey = typeof customApiKey === "string" && customApiKey.trim() ? customApiKey.trim() : process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in Secrets. Please configure it in your AI Studio Secrets panel, or configure your Custom API Key in the header widget.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  };

  // API Route for Sequential Images Generation
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { uploadedImages, promptText } = req.body;

      if (!uploadedImages || !Array.isArray(uploadedImages) || uploadedImages.length === 0) {
        return res.status(400).json({ error: "Please upload at least one image of the product." });
      }

      if (!promptText) {
        return res.status(400).json({ error: "No prompt text provided for the style." });
      }

      const ai = getAiClient(req);

      // Convert images into inlineParts for Gemini API
      const inlineDataParts = uploadedImages.map(img => {
        const base64Data = img.base64 || img.previewUrl?.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid base64 payload in uploaded images.");
        }
        return {
          inlineData: {
            mimeType: img.mimeType || "image/png",
            data: base64Data
          }
        };
      });

      // Assemble content prompt combination
      const contentParts = [
        ...inlineDataParts,
        { text: promptText }
      ];

      // Try gemini-2.5-flash-image first as recommended
      let base64Result = null;
      let lastError = null;

      try {
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: contentParts
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1"
            }
          }
        });

        if (result.candidates?.[0]?.content?.parts) {
          for (const part of result.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              base64Result = part.inlineData.data;
              break;
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to generate with gemini-2.5-flash-image, trying fallback...", err);
        lastError = err;
      }

      // Fallback: gemini-3.1-flash-image
      if (!base64Result) {
        try {
          const fallbackResult = await ai.models.generateContent({
            model: "gemini-3.1-flash-image",
            contents: {
              parts: contentParts
            },
            config: {
              imageConfig: {
                aspectRatio: "1:1"
              }
            }
          });

          if (fallbackResult.candidates?.[0]?.content?.parts) {
            for (const part of fallbackResult.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                base64Result = part.inlineData.data;
                break;
              }
            }
          }
        } catch (err: any) {
          console.error("Failed model fallback to gemini-3.1-flash-image:", err);
          lastError = err;
        }
      }

      if (!base64Result) {
        return res.status(500).json({ error: lastError?.message || "Failed to generate image via Gemini." });
      }

      res.json({ imageUrl: `data:image/png;base64,${base64Result}` });

    } catch (err: any) {
      console.error("Image generation backend error:", err);
      res.status(500).json({ error: err.message || "Failed to generate image via Gemini." });
    }
  });

  // API Route for Copyrighting Listing Formulations
  app.post("/api/generate-listing", async (req, res) => {
    try {
      const { uploadedImages, decoration, colorOverride, height, length, width } = req.body;

      if (!uploadedImages || !Array.isArray(uploadedImages) || uploadedImages.length === 0) {
        return res.status(400).json({ error: "Please upload at least one physical product reference photo." });
      }

      const ai = getAiClient(req);

      const specsText = `
        - Decoration Theme: ${decoration || "None specified"}
        - Color Override Selection: ${colorOverride || "Original colors"}
        - Size Specifications: ${height ? `${height}cm Height` : ''} ${length ? `${length}cm Length` : ''} ${width ? `${width}cm Width` : ''}
      `;

      const promptText = `
        You are an elite E-commerce Copywriter and Product Listing SEO Specialist.
        Analyze the uploaded product photos closely, focusing on visual detail, textures, style, branding, and use cases.
        
        Using the input product properties hereunder, draft an extremely engaging, high-converting product title and description.
        
        Input Product Detail Specs:
        ${specsText}
        
        Instructions:
        1. Write a highly persuasive title.
        2. Write a detailed SEO and marketing rich Product Description that frames unique sales arguments, target demographics, features checklist, dimensions guidelines, care tips, and a compelling purchasing CTA.
        
        You MUST strictly print the content using ONLY the tags "TITLE:" and "DESCRIPTION:" to let the application parse them neatly into UI panels.
        
        Required response structure:
        TITLE: [Insert your crafted listing title here - optimized and sleek]
        DESCRIPTION: [Insert the rich detailed description here with bullet points, value hooks, and specifications checklist]
        
        Do not add any additional chatbot greetings or summary wrapping outside of these tags.
      `;

      const inlineDataParts = uploadedImages.map(img => {
        const base64Data = img.base64 || img.previewUrl?.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid base64 payload in uploaded images.");
        }
        return {
          inlineData: {
            mimeType: img.mimeType || "image/png",
            data: base64Data
          }
        };
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            ...inlineDataParts,
            { text: promptText }
          ]
        }
      });

      let textResult = response.text || "";

      if (!textResult) {
        // Fallback to gemini-3.1-pro-preview which is standard complex reasoning model
        const fallbackRes = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: {
            parts: [
              ...inlineDataParts,
              { text: promptText }
            ]
          }
        });
        textResult = fallbackRes.text || "";
      }

      if (!textResult) {
        return res.status(500).json({ error: "Gemini did not return any copy text output." });
      }

      res.json({ text: textResult });

    } catch (err: any) {
      console.error("Listing copywriting backend error:", err);
      res.status(500).json({ error: err.message || "Failed to formulate product listings copywriting." });
    }
  });

  // Serve Vite assets in Dev mode or static files in Production mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server initialized on port ${PORT}`);
  });
}

startServer();
