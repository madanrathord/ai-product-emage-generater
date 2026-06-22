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

  // API Route for Sequential Images Generation or alternative provider generation
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { uploadedImages, promptText } = req.body;

      if (!promptText) {
        return res.status(400).json({ error: "No prompt text provided for the style." });
      }

      const imageProvider = (req.headers["x-image-provider"] as string) || "gemini";
      let base64Result: string | null = null;
      let lastError: any = null;

      if (imageProvider === "gemini") {
        if (!uploadedImages || !Array.isArray(uploadedImages) || uploadedImages.length === 0) {
          return res.status(400).json({ error: "Please upload at least one image of the product." });
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

        const requestedModel = (req.headers["x-custom-image-model"] as string) || "gemini-2.5-flash-image";

        try {
          const result = await ai.models.generateContent({
            model: requestedModel,
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
          console.error(`Failed to generate with requested model ${requestedModel}, trying fallback...`, err);
          lastError = err;
        }

        // Fallback: gemini-3.1-flash-image
        if (!base64Result && requestedModel !== "gemini-3.1-flash-image") {
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

      } else if (imageProvider === "pollinations") {
        const pollinationsModel = (req.headers["x-pollinations-model"] as string) || "flux";
        const seedValue = Math.floor(Math.random() * 10000000);
        // Build direct Pollinations URL
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=1024&height=1024&seed=${seedValue}&model=${pollinationsModel}&enhance=false&nologo=true`;
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Pollinations API returned status code ${response.status}`);
          }
          const buffer = await response.arrayBuffer();
          base64Result = Buffer.from(buffer).toString("base64");
        } catch (err: any) {
          console.error("Failed image generation via Pollinations:", err);
          return res.status(500).json({ error: `Pollinations API keyless generation failed: ${err.message}` });
        }

      } else if (imageProvider === "openai") {
        const apiKey = req.headers["x-openai-api-key"] as string;
        const openaiModel = (req.headers["x-openai-model"] as string) || "dall-e-3";

        if (!apiKey) {
          return res.status(400).json({ error: "OpenAI requires an API Key. Please configure it in Settings." });
        }

        try {
          const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: openaiModel,
              prompt: promptText,
              n: 1,
              size: openaiModel === "dall-e-3" ? "1024x1024" : "512x512",
              response_format: "b64_json"
            })
          });

          if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            const errMessage = errJson.error?.message || response.statusText;
            throw new Error(`OpenAI API Error ${response.status}: ${errMessage}`);
          }

          const resJson = await response.json();
          const base64Data = resJson.data?.[0]?.b64_json || resJson.data?.[0]?.url;

          if (!base64Data) {
            throw new Error("No image data returned from OpenAI API response.");
          }

          if (base64Data.startsWith("http://") || base64Data.startsWith("https://")) {
            const urlFetch = await fetch(base64Data);
            if (!urlFetch.ok) {
              throw new Error(`Failed to download returned OpenAI image: ${base64Data}`);
            }
            const buffer = await urlFetch.arrayBuffer();
            base64Result = Buffer.from(buffer).toString("base64");
          } else {
            base64Result = base64Data;
          }
        } catch (err: any) {
          console.error("OpenAI generation failure:", err);
          return res.status(500).json({ error: `OpenAI DALL-E generation failed: ${err.message}` });
        }

      } else if (imageProvider === "huggingface") {
        const token = req.headers["x-huggingface-token"] as string;
        const hfModel = (req.headers["x-huggingface-model"] as string) || "stabilityai/stable-diffusion-3.5-large";

        if (!token) {
          return res.status(400).json({ error: "Hugging Face requires a User Access Token (Bearer). Please configure it in Settings." });
        }

        const url = `https://api-inference.huggingface.co/models/${hfModel}`;
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ inputs: promptText })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Hugging Face API Error ${response.status}: ${errText || response.statusText}`);
          }

          const buffer = await response.arrayBuffer();
          base64Result = Buffer.from(buffer).toString("base64");
        } catch (err: any) {
          console.error("Hugging Face generation error:", err);
          return res.status(500).json({ error: `Hugging Face generation failed: ${err.message}` });
        }

      } else if (imageProvider === "custom") {
        const customUrl = req.headers["x-custom-api-url"] as string;
        const customHeadersStr = req.headers["x-custom-api-headers"] as string;
        const customBodyStr = req.headers["x-custom-api-body"] as string;
        const customResultPath = (req.headers["x-custom-api-result-path"] as string) || "imageUrl";

        if (!customUrl) {
          return res.status(400).json({ error: "Custom API requires a valid Endpoint URL. Please configure it in Settings." });
        }

        let headers: any = { "Content-Type": "application/json" };
        if (customHeadersStr) {
          try {
            headers = { ...headers, ...JSON.parse(customHeadersStr) };
          } catch (e: any) {
            return res.status(400).json({ error: `Failed to parse Custom JSON Headers: ${e.message}` });
          }
        }

        let bodyPayload: any = null;
        if (customBodyStr) {
          try {
            const compiledBody = customBodyStr.replace(/{prompt}/g, JSON.stringify(promptText).slice(1, -1));
            bodyPayload = JSON.parse(compiledBody);
          } catch (e) {
            bodyPayload = customBodyStr.replace(/{prompt}/g, promptText);
          }
        } else {
          bodyPayload = { prompt: promptText };
        }

        try {
          const response = await fetch(customUrl, {
            method: "POST",
            headers: typeof headers === "object" ? headers : {},
            body: typeof bodyPayload === "object" ? JSON.stringify(bodyPayload) : bodyPayload
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Custom API returned error Status ${response.status}: ${errText || response.statusText}`);
          }

          const responseJson = await response.json();

          // Extract using dot-notated result path
          let extractedVal: any = responseJson;
          const paths = customResultPath.split(/[.\[\]]/).filter(Boolean);
          for (const p of paths) {
            if (extractedVal && typeof extractedVal === "object") {
              const isNum = !isNaN(Number(p));
              const key = isNum ? Number(p) : p;
              extractedVal = extractedVal[key];
            }
          }

          if (typeof extractedVal === "string") {
            if (extractedVal.startsWith("data:image")) {
              base64Result = extractedVal.split(",")[1];
            } else if (extractedVal.startsWith("http://") || extractedVal.startsWith("https://")) {
              // Fetch image URL and convert to Base64
              const fetchImg = await fetch(extractedVal);
              if (!fetchImg.ok) {
                throw new Error(`Failed to fetch image from returned URL: ${extractedVal}`);
              }
              const buffer = await fetchImg.arrayBuffer();
              base64Result = Buffer.from(buffer).toString("base64");
            } else {
              base64Result = extractedVal;
            }
          } else {
            throw new Error(`Could not find a string image URL or base64 at path "${customResultPath}" in the JSON response.`);
          }
        } catch (err: any) {
          console.error("Custom Image API generation error:", err);
          return res.status(500).json({ error: `Custom API generation failed: ${err.message}` });
        }
      }

      if (!base64Result) {
        return res.status(500).json({ error: "Failed to compile generated image." });
      }

      res.json({ imageUrl: `data:image/png;base64,${base64Result}` });

    } catch (err: any) {
      console.error("Image generation backend error:", err);
      res.status(500).json({ error: err.message || "Failed to generate image." });
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
