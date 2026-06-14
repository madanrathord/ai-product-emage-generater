import React, { useState } from "react";
import { 
  Upload, Image as ImageIcon, Cpu, Trash2, 
  Sliders, Copy, Check, Download, Share2, 
  Grid, FileText, AlertTriangle, RefreshCw, Sparkles
} from "lucide-react";

// Hardcoded array of 10 photography styles
const PHOTOGRAPHY_STYLES = [
  { 
    id: 1, 
    name: "Studio White", 
    desc: "Pure white seamless background, soft shadow", 
    promptWord: "studio shot, pure white seamless background, sharp focus, professional product photography, soft commercial shadows, clean look, professional studio lighting" 
  },
  { 
    id: 2, 
    name: "Minimal Desk", 
    desc: "Matte wooden desk, soft daylight", 
    promptWord: "placed on a professional dry raw wooden desk, minimal styling, soft natural daylight filtering from side, clean scandinavian cozy study aesthetic" 
  },
  { 
    id: 3, 
    name: "Outdoor Garden", 
    desc: "Natural surface, green garden bokeh", 
    promptWord: "resting on a flat natural wood bark piece, surrounded by elegant green leaves and delicate forest flowers, soft morning sunlight, lush green garden foliage bokeh background, fresh atmosphere" 
  },
  { 
    id: 4, 
    name: "Luxury Marble", 
    desc: "Marble surface, premium editorial lighting", 
    promptWord: "arranged on a premium highly polished solid white marble slab with elegant grey veins, luxurious jewelry lighting, soft editorial golden hour glow reflections, high-end catalog presentation" 
  },
  { 
    id: 5, 
    name: "Shelf Decor", 
    desc: "Modern shelf, blurred living room background", 
    promptWord: "displayed styled on a modern oak shelf, clean blurred cozy home living room interior design in background, subtle warm home lamps, elegant decorative styling" 
  },
  { 
    id: 6, 
    name: "Flat Lay", 
    desc: "Top-down 90 degree view, neat layout", 
    promptWord: "overhead 90 degree flat lay view, professional top down commercial catalog composition, product surrounded gracefully by simple complementary geometric aesthetic blocks" 
  },
  { 
    id: 7, 
    name: "Nature Travel", 
    desc: "Rock/wood surface, mountain background", 
    promptWord: "rugged stone plinth, set in nature, morning mist, majestic blurred snowcapped alpine mountain peaks in background, wild explorer travel background" 
  },
  { 
    id: 8, 
    name: "Cafe Vibes", 
    desc: "Wooden cafe table, blurred cafe interior", 
    promptWord: "resting on an authentic high-quality rustic coffee shop mahogany wooden table, soft beautiful cozy warm pendant light bulb bokeh background of a high-end cafe" 
  },
  { 
    id: 9, 
    name: "Dark Moody", 
    desc: "Black background, directional spotlight", 
    promptWord: "artistic dramatic dark moody layout, deep black modern volcanic stone surface, highly contrast intense directional spot lighting casting beautiful shadows" 
  },
  { 
    id: 10, 
    name: "In-Hand", 
    desc: "Held in a clean hand, natural background", 
    promptWord: "held carefully in a clean manicured hand, realistic authentic scale, soft focus cozy bright blurred domestic background, realistic lifelike capture" 
  }
];

export default function AIProductStudio() {
  // Controls config state
  const [controlsConfig, setControlsConfig] = useState({
    groupingMode: "single", // "single" | "pairs"
    quantity: 1,
    decoration: "",
    colorOverride: "",
    height: "",
    length: "",
    width: ""
  });
  
  // Uploaded images state (Max 3)
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Right panel active tab
  const [activeTab, setActiveTab] = useState("gallery"); // "gallery" | "listing"
  
  // State for generated images (the 10 styles)
  const [results, setResults] = useState(() => {
    return PHOTOGRAPHY_STYLES.map(style => ({
      styleId: style.id,
      styleName: style.name,
      styleDesc: style.desc,
      status: 'waiting', // 'waiting' | 'loading' | 'done' | 'error'
      imageUrl: null,
      errorMessage: null
    }));
  });
  
  // General loaders
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  
  // Listing content
  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingError, setListingError] = useState(null);
  
  // Copied indicator triggers
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);

  // Helper utility to convert uploaded file into base64 object
  const handleFileRead = async (file) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg("Please upload an image file (PNG/JPG).");
      return;
    }
    
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const base64String = fileReader.result;
      const dataStr = base64String.split(',')[1];
      
      setUploadedImages(prev => {
        if (prev.length >= 3) {
          setErrorMsg("Maximum of 3 images can be uploaded.");
          return prev;
        }
        setErrorMsg("");
        return [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type,
          previewUrl: base64String,
          mimeType: file.type,
          base64: dataStr
        }];
      });
    };
    fileReader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => {
        handleFileRead(file);
      });
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(file => {
        handleFileRead(file);
      });
    }
  };

  const removeUploadedImage = (id) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  // Prompt compiler helper
  const compilePromptText = (style) => {
    let modeText = "";
    if (uploadedImages.length > 1) {
      if (controlsConfig.groupingMode === "pairs") {
        modeText = "COMBO PAIRS: Arrange multiple elements of the product in cohesive pairs side by side.";
      } else {
        modeText = "COMBO SHOT: Arrange multiple items of the product nicely in a combined cluster shot.";
      }
    } else {
      const qty = parseInt(controlsConfig.quantity) || 1;
      if (qty > 1) {
        modeText = `Multiple items: Arrange exactly ${qty} items of this product elegantly in the shot.`;
      } else {
        modeText = "Single product isolated shot.";
      }
    }

    let inputsText = "";
    if (controlsConfig.decoration) inputsText += `Decoration layout features: "${controlsConfig.decoration}". `;
    if (controlsConfig.colorOverride) inputsText += `Color overrides/flavors: "${controlsConfig.colorOverride}". `;
    if (controlsConfig.height || controlsConfig.length || controlsConfig.width) {
      inputsText += `Product physical size context: ${controlsConfig.height ? `Height ${controlsConfig.height}cm` : ''} ${controlsConfig.length ? `Length ${controlsConfig.length}cm` : ''} ${controlsConfig.width ? `Width ${controlsConfig.width}cm` : ''}. `;
    }

    return `${modeText} High-quality professional product photography styled in ${style.name} background atmosphere. Scene detailed instructions: ${style.promptWord}. ${inputsText} Crucial: preserve the perfect photorealistic shape, labels, branding details, and texture of the product seen in the uploaded input images. Place it beautiful, high resolution catalog rendering. Ensure cinematic soft shadows, pristine studio quality visual details and clear context.`;
  };

  // Call our secure server-side API endpoint for sequential rendering
  const processSingleImageCall = async (style) => {
    const promptText = compilePromptText(style);
    
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uploadedImages,
        promptText
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedError = "";
      try {
        const parsed = JSON.parse(errText);
        parsedError = parsed?.error || parsed?.message || errText;
      } catch(e) {
        parsedError = errText;
      }
      throw new Error(parsedError || `Status code ${response.status}`);
    }

    const data = await response.json();
    if (!data.imageUrl) {
      throw new Error("Backend did not return compiled image stream.");
    }

    return data.imageUrl;
  };

  // Sequence Generation of all 10 images
  const triggerImageGenerationSequence = async () => {
    setIsGeneratingImages(true);
    setActiveTab("gallery");

    // Initialize all as waiting
    setResults(prev => prev.map(item => ({
      ...item,
      status: 'waiting',
      imageUrl: null,
      errorMessage: null
    })));

    // Sequential loop over styles
    for (let i = 0; i < PHOTOGRAPHY_STYLES.length; i++) {
      const style = PHOTOGRAPHY_STYLES[i];
      
      // Update individual style card state to 'loading'
      setResults(prev => prev.map(item => item.styleId === style.id ? { ...item, status: 'loading' } : item));

      try {
        const imageResultUrl = await processSingleImageCall(style);
        setResults(prev => prev.map(item => item.styleId === style.id ? { 
          ...item, 
          status: 'done', 
          imageUrl: imageResultUrl 
        } : item));
      } catch (err) {
        console.error("Style " + style.name + " failed:", err);
        setResults(prev => prev.map(item => item.styleId === style.id ? { 
          ...item, 
          status: 'error', 
          errorMessage: err.message || "Failed to make call" 
        } : item));
      }
    }

    setIsGeneratingImages(false);
  };

  // Re-run single generation if failed/needed
  const retrySingleImageGeneration = async (styleId) => {
    const targetStyle = PHOTOGRAPHY_STYLES.find(s => s.id === styleId);
    if (!targetStyle) return;

    setResults(prev => prev.map(item => item.styleId === styleId ? { 
      ...item, 
      status: 'loading', 
      errorMessage: null 
    } : item));

    try {
      const imageResultUrl = await processSingleImageCall(targetStyle);
      setResults(prev => prev.map(item => item.styleId === styleId ? { 
        ...item, 
        status: 'done', 
        imageUrl: imageResultUrl 
      } : item));
    } catch (err) {
      console.error("Retry failed for " + targetStyle.name, err);
      setResults(prev => prev.map(item => item.styleId === styleId ? { 
        ...item, 
        status: 'error', 
        errorMessage: err.message || "Retry failed." 
      } : item));
    }
  };

  // Generate copywriting listing (Title & Description)
  const handleGenerateListing = async () => {
    setIsGeneratingText(true);
    setListingError(null);
    setListingTitle("");
    setListingDescription("");

    try {
      const response = await fetch("/api/generate-listing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uploadedImages,
          decoration: controlsConfig.decoration,
          colorOverride: controlsConfig.colorOverride,
          height: controlsConfig.height,
          length: controlsConfig.length,
          width: controlsConfig.width
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        let parsedError = "";
        try {
          const parsed = JSON.parse(errText);
          parsedError = parsed?.error || parsed?.message || errText;
        } catch (e) {
          parsedError = errText;
        }
        throw new Error(parsedError || `Status code ${response.status}`);
      }

      const data = await response.json();
      const textResult = data.text || "";

      if (!textResult) {
        throw new Error("Gemini returned successfully but didn't output any text block.");
      }

      // Parse with regex
      let parsedTitle = "";
      let parsedDesc = "";

      const titleMatch = textResult.match(/TITLE:\s*([\s\S]*?)(?=DESCRIPTION:|$)/i);
      const descMatch = textResult.match(/DESCRIPTION:\s*([\s\S]*?)$/i);

      if (titleMatch) {
        parsedTitle = titleMatch[1].trim();
      }
      if (descMatch) {
        parsedDesc = descMatch[1].trim();
      }

      // Fallback partitioning
      if (!parsedTitle && !parsedDesc) {
        const parts = textResult.split("\n");
        parsedTitle = parts[0] ? parts[0].replace(/TITLE:/i, "").trim() : "Premium Crafted Product Listing";
        parsedDesc = textResult.replace(/TITLE:/i, "").replace(/DESCRIPTION:/i, "").trim();
      }

      setListingTitle(parsedTitle);
      setListingDescription(parsedDesc);
      setActiveTab("listing"); // auto change tab to listing so they see the result

    } catch (err) {
      console.error(err);
      setListingError(err.message || "Something went wrong while formulating the copy.");
    } finally {
      setIsGeneratingText(false);
    }
  };

  // Utilities for Download & Share
  const handleDownloadImage = (imgBase64, styleName) => {
    try {
      const link = document.createElement("a");
      link.href = imgBase64;
      link.download = `AIProductStudio_${styleName.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  const handleShareImage = async (imgBase64, styleName) => {
    if (navigator.share) {
      try {
        const responseFile = await fetch(imgBase64);
        const fileBlob = await responseFile.blob();
        const fileObj = new File([fileBlob], `product_${styleName.toLowerCase()}.png`, { type: "image/png" });

        if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
          await navigator.share({
            files: [fileObj],
            title: `Product Photograph - ${styleName}`,
            text: `Generated via AI Product Studio under the ${styleName} theme!`
          });
        } else {
          // fallback string link share
          await navigator.share({
            title: `Product Photograph - ${styleName}`,
            text: `Generated beautiful photographs on AI Product Studio!`,
            url: window.location.href
          });
        }
      } catch (err) {
        console.warn("Share operation canceled or not fully supported:", err);
      }
    } else {
      // Fallback clip copy
      navigator.clipboard.writeText(imgBase64.substring(0, 50) + "...");
      alert("Social share API is unavailable on this browser. Mock image data reference copied to Clipboard.");
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'title') {
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    } else {
      setCopiedDesc(true);
      setTimeout(() => setCopiedDesc(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* HEADER SECTION */}
      <header id="header_section" className="border-b border-neutral-800 bg-neutral-900/85 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-indigo-400 bg-clip-text text-transparent">
              AI Product Studio
            </h1>
            <p className="text-xs text-neutral-400 font-medium">Professional E-commerce AI Suite</p>
          </div>
        </div>

        {/* SECURE STATUS INDICATOR */}
        <div className="flex items-center space-x-2 bg-neutral-900/60 border border-neutral-800 px-3.5 py-1.5 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
          <span className="text-xs text-neutral-400 font-semibold">Automatic Server-Side Key Active</span>
        </div>
      </header>

      {/* CORE WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT PANEL: CONTROLS & PHOTO INPUT RANGE */}
        <section id="left_panel_controls" className="lg:col-span-5 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-md font-bold tracking-wide uppercase text-neutral-400 flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Control Studio</span>
              </h2>
              {uploadedImages.length > 0 && (
                <span className="text-xs bg-neutral-800 px-2.5 py-1 rounded-full text-indigo-300 font-bold border border-neutral-700/60">
                  {uploadedImages.length}/3 Uploaded
                </span>
              )}
            </div>

            {/* DRAG-DROP IMAGE UPLOAD AREA */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-neutral-400">Step 1: Upload Product Images</label>
              
              <div 
                id="dropzone_upload_area"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 relative ${
                  isDragging 
                    ? "border-indigo-500 bg-indigo-950/10" 
                    : "border-neutral-800 bg-neutral-950/40 hover:bg-neutral-950/70 hover:border-neutral-700"
                }`}
              >
                <input 
                  type="file" 
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <Upload className="w-8 h-8 text-neutral-500 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-neutral-300">Drag & Drop product photos</p>
                <p className="text-xs text-neutral-500 mt-1">supports PNG, JPG style files (Max 3)</p>
              </div>

              {/* UPLOADED IMAGE PREVIEWS */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-neutral-700/50 aspect-square bg-neutral-950">
                      <img 
                        src={img.previewUrl} 
                        alt="Product preview" 
                        className="w-full h-full object-cover"
                      />
                      <button 
                        onClick={() => removeUploadedImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-neutral-900/80 hover:bg-red-950 hover:text-red-300 text-neutral-400 rounded-full transition-colors opacity-95 lg:opacity-0 group-hover:opacity-100"
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg flex items-start space-x-2 text-xs text-red-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* CUSTOMIZATION OPTIONS FORM */}
            <div className="border-t border-neutral-800/80 pt-5 space-y-4">
              <h3 className="block text-xs font-bold uppercase tracking-wide text-neutral-400">Step 2: Customize Parameters</h3>
              
              {/* Grouping Mode Selection */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5 font-semibold">Grouping Mode</label>
                <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1 border border-neutral-800 rounded-lg">
                  <button 
                    onClick={() => setControlsConfig(p => ({ ...p, groupingMode: "single" }))}
                    className={`py-1.5 rounded-md text-xs font-bold transition-all ${
                      controlsConfig.groupingMode === "single" 
                        ? "bg-neutral-800 text-white shadow-sm" 
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Single (1x)
                  </button>
                  <button 
                    onClick={() => setControlsConfig(p => ({ ...p, groupingMode: "pairs" }))}
                    className={`py-1.5 rounded-md text-xs font-bold transition-all ${
                      controlsConfig.groupingMode === "pairs" 
                        ? "bg-neutral-800 text-white shadow-sm" 
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Pairs (2x)
                  </button>
                </div>
              </div>

              {/* Numeric Quantity */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1 font-semibold">Quantity</label>
                <input 
                  type="number"
                  min="1"
                  max="10"
                  disabled={controlsConfig.groupingMode === "pairs"}
                  value={controlsConfig.groupingMode === "pairs" ? "2" : controlsConfig.quantity}
                  onChange={(e) => setControlsConfig(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-100"
                />
                {controlsConfig.groupingMode === "pairs" && (
                  <span className="text-[10px] text-neutral-500 mt-0.5 block">Locked to 2x for Pairs Mode.</span>
                )}
              </div>

              {/* Decoration details field */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1 font-semibold">Decoration Accent</label>
                <input 
                  type="text"
                  placeholder="e.g., green leaves, raw wooden pedestal, cherry blossom petals"
                  value={controlsConfig.decoration}
                  onChange={(e) => setControlsConfig(p => ({ ...p, decoration: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600 text-neutral-100"
                />
              </div>

              {/* Color Override */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1 font-semibold">Color Override (Aesthetic accent)</label>
                <input 
                  type="text"
                  placeholder="e.g., deep orange, midnight matte, chrome silver accents"
                  value={controlsConfig.colorOverride}
                  onChange={(e) => setControlsConfig(p => ({ ...p, colorOverride: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 placeholder:text-neutral-600 text-neutral-100"
                />
              </div>

              {/* Dimensions specs */}
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5 font-semibold">Item Dimensions (approx. cm)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-neutral-500 block mb-0.5 font-bold">Height (H)</span>
                    <input 
                      type="number"
                      placeholder="e.g. 15"
                      value={controlsConfig.height}
                      onChange={(e) => setControlsConfig(p => ({ ...p, height: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-neutral-100"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 block mb-0.5 font-bold">Length (L)</span>
                    <input 
                      type="number"
                      placeholder="e.g. 10"
                      value={controlsConfig.length}
                      onChange={(e) => setControlsConfig(p => ({ ...p, length: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-neutral-100"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 block mb-0.5 font-bold">Width (W)</span>
                    <input 
                      type="number"
                      placeholder="e.g. 10"
                      value={controlsConfig.width}
                      onChange={(e) => setControlsConfig(p => ({ ...p, width: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-neutral-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-4 border-t border-neutral-800/80 space-y-3">
            <button
              id="generate_images_action_btn"
              disabled={isGeneratingImages || isGeneratingText || uploadedImages.length === 0}
              onClick={triggerImageGenerationSequence}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:from-neutral-800 disabled:to-neutral-900 disabled:text-neutral-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-300 shadow-xl shadow-indigo-600/10 flex items-center justify-center space-x-2 text-sm border border-indigo-500/30 cursor-pointer"
            >
              {isGeneratingImages ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Generating Style Sequence...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  <span>Generate 10 Images (Styles Sequence)</span>
                </>
              )}
            </button>

            <button
              id="generate_listing_btn"
              disabled={isGeneratingImages || isGeneratingText || uploadedImages.length === 0}
              onClick={handleGenerateListing}
              className="w-full py-3 px-4 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:border-neutral-950 disabled:cursor-not-allowed border border-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isGeneratingText ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Formulating Professional Listing...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Generate E-commerce Listing Copy</span>
                </>
              )}
            </button>

            {uploadedImages.length === 0 && (
              <span className="block text-[10px] text-center text-amber-500/90 font-medium animate-pulse">
                * Please upload at least one base reference image to activate generator buttons.
              </span>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: GRID GALLERY & TABS CONTAINER */}
        <section id="right_panel_tabs" className="lg:col-span-7 bg-neutral-900/30 border border-neutral-800/40 rounded-2xl flex flex-col justify-between overflow-hidden">
          
          {/* TAB BAR */}
          <div className="border-b border-neutral-800/80 bg-neutral-900/50 p-4 flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                id="gallery_tab_btn"
                onClick={() => setActiveTab("gallery")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 transition-all ${
                  activeTab === "gallery" 
                    ? "bg-neutral-800 text-white shadow-sm border border-neutral-700/60" 
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>Rendered Gallery</span>
                {isGeneratingImages && (
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                )}
              </button>
              <button
                id="listing_tab_btn"
                onClick={() => setActiveTab("listing")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2 transition-all ${
                  activeTab === "listing" 
                    ? "bg-neutral-800 text-white shadow-sm border border-neutral-700/60" 
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Listing Content</span>
              </button>
            </div>

            <div className="text-xs text-neutral-500 font-medium hidden sm:block">
              {activeTab === "gallery" ? "10 Custom Styles" : "Copywriter AI Content"}
            </div>
          </div>

          {/* TAB PANELS ACTIVE VIEWPORT */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[750px]">
            
            {/* GALLERY TAB PANELS */}
            {activeTab === "gallery" && (
              <div className="space-y-6">
                
                {/* INSTRUCTION EMPTY GUIDE */}
                {!isGeneratingImages && results.every(r => r.imageUrl === null) && (
                  <div className="py-24 text-center space-y-4">
                    <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mx-auto border border-neutral-800">
                      <ImageIcon className="w-8 h-8 text-neutral-600" />
                    </div>
                    <div className="max-w-sm mx-auto">
                      <h4 className="text-sm font-bold text-neutral-300">Studio is empty</h4>
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        Upload some high-quality product frames on the left control dock, customize decorations and styling overrides, and trigger generation to run the photorealistic style sequences.
                      </p>
                    </div>
                  </div>
                )}

                {/* IMAGES GRID */}
                {(isGeneratingImages || results.some(r => r.imageUrl !== null)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {results.map((item) => (
                      <div 
                        key={item.styleId} 
                        className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-md flex flex-col justify-between group transition-all hover:border-neutral-700/80"
                      >
                        {/* THE CARD MEDIA STAGE */}
                        <div className="relative aspect-square w-full bg-neutral-950 flex items-center justify-center overflow-hidden border-b border-neutral-800">
                          {item.status === 'waiting' && (
                            <div className="text-center p-6 space-y-2">
                              <span className="text-[10px] uppercase font-bold text-neutral-600 bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                                Style {item.styleId}
                              </span>
                              <p className="text-sm font-semibold text-neutral-500">{item.styleName}</p>
                              <p className="text-[11px] leading-relaxed text-neutral-600 max-w-xs">{item.styleDesc}</p>
                            </div>
                          )}

                          {item.status === 'loading' && (
                            <div className="text-center p-6 space-y-3">
                              <div className="relative w-12 h-12 mx-auto">
                                <div className="absolute inset-0 border-4 border-indigo-600/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                              <div>
                                <span className="text-[10px] text-indigo-400 font-bold tracking-wider uppercase block animate-pulse">Rendering Stage</span>
                                <p className="text-xs text-neutral-400 font-bold">{item.styleName}</p>
                              </div>
                            </div>
                          )}

                          {item.status === 'error' && (
                            <div className="text-center p-6 space-y-3 max-w-[200px] sm:max-w-xs">
                              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                              <p className="text-xs font-semibold text-red-400">{item.styleName} Failed</p>
                              <p className="text-[10px] text-neutral-500 line-clamp-3 leading-relaxed">
                                {item.errorMessage || "Network fault or unexpected response."}
                              </p>
                              <button 
                                onClick={() => retrySingleImageGeneration(item.styleId)}
                                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold text-indigo-400 rounded-lg flex items-center space-x-1.5 mx-auto transition-all cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Failed - Retry</span>
                              </button>
                            </div>
                          )}

                          {item.status === 'done' && item.imageUrl && (
                            <img 
                              src={item.imageUrl} 
                              alt={item.styleName} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                          )}

                          {/* STYLE CHIP TOP CORNER */}
                          {item.status === 'done' && (
                            <div className="absolute top-2 left-2 px-2 py-1 bg-neutral-900/90 text-[10px] font-bold text-indigo-300 rounded border border-neutral-700/50 backdrop-blur">
                              {item.styleName}
                            </div>
                          )}
                        </div>

                        {/* WORK CARD BOTTOM METADATA ACTIONS */}
                        <div className="p-3 bg-neutral-900/80 flex items-center justify-between">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-neutral-200 truncate">{item.styleName}</h4>
                            <p className="text-[10px] text-neutral-500 truncate">{item.styleDesc}</p>
                          </div>

                          {item.status === 'done' && item.imageUrl && (
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => handleDownloadImage(item.imageUrl, item.styleName)}
                                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded transition-colors cursor-pointer"
                                title="Download image asset"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleShareImage(item.imageUrl, item.styleName)}
                                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded transition-colors cursor-pointer"
                                title="Share image"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LISTING COPYWRITER VIEW TAB */}
            {activeTab === "listing" && (
              <div className="space-y-6">
                
                {/* LOADER */}
                {isGeneratingText && (
                  <div className="py-24 text-center space-y-4">
                    <div className="relative w-12 h-12 mx-auto">
                      <div className="absolute inset-0 border-4 border-indigo-600/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-neutral-300">Formulating product marketing copy...</h4>
                      <p className="text-xs text-neutral-500 mt-1">Reviewing references and compiling conversion hooks.</p>
                    </div>
                  </div>
                )}

                {/* ERROR PANEL */}
                {!isGeneratingText && listingError && (
                  <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl space-y-2">
                    <div className="flex items-center space-x-2 text-red-300 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5" />
                      <span>Listing Generation Failed</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {listingError}
                    </p>
                    <button 
                      onClick={handleGenerateListing}
                      className="mt-3 px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-xs text-indigo-400 font-bold rounded-lg flex items-center space-x-1.5 transition-colors border border-neutral-700/60 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Formula</span>
                    </button>
                  </div>
                )}

                {/* CONTENT STAGE */}
                {!isGeneratingText && !listingError && !listingTitle && !listingDescription && (
                  <div className="py-24 text-center space-y-4">
                    <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mx-auto border border-neutral-800">
                      <FileText className="w-8 h-8 text-neutral-600" />
                    </div>
                    <div className="max-w-sm mx-auto">
                      <h4 className="text-sm font-bold text-neutral-300">No content is formulated yet</h4>
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        Customize dimensions and decoration details on the left dock, and click "Generate E-commerce Listing Copy" to synthesize descriptions tailored to your uploaded photographs.
                      </p>
                    </div>
                  </div>
                )}

                {/* RENDERED DOCUMENT */}
                {!isGeneratingText && !listingError && (listingTitle || listingDescription) && (
                  <div className="space-y-6">
                    
                    {/* TITLE BLOCK */}
                    {listingTitle && (
                      <div className="bg-neutral-900 border border-neutral-800/80 rounded-xl p-5 space-y-3 relative group">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-850">
                            SEO Optimized Listing Title
                          </span>
                          <button
                            onClick={() => copyToClipboard(listingTitle, 'title')}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 hover:text-white rounded-lg transition-colors flex items-center space-x-1 border border-neutral-700/60 cursor-pointer"
                          >
                            {copiedTitle ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Title</span>
                              </>
                            )}
                          </button>
                        </div>
                        <h3 className="text-lg font-bold text-white selection:bg-indigo-600 leading-relaxed pr-8">
                          {listingTitle}
                        </h3>
                      </div>
                    )}

                    {/* DESCRIPTION BLOCK */}
                    {listingDescription && (
                      <div className="bg-neutral-900 border border-neutral-800/80 rounded-xl p-5 space-y-3 relative group">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-850">
                            High-Converting Strategic Description
                          </span>
                          <button
                            onClick={() => copyToClipboard(listingDescription, 'desc')}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-300 hover:text-white rounded-lg transition-colors flex items-center space-x-1 border border-neutral-700/60 cursor-pointer"
                          >
                            {copiedDesc ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Description</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="text-sm text-neutral-300 whitespace-pre-line leading-relaxed selection:bg-indigo-600/60">
                          {listingDescription}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

          </div>

          {/* RIGHT PANEL FOOTER STATUS */}
          <footer className="px-6 py-4 bg-neutral-900/40 border-t border-neutral-800/60 text-[11px] text-neutral-500 font-medium flex items-center justify-between shrink-0">
            <span className="flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Engine Status: secure integration active</span>
            </span>
            <span>API model version: gemini-2.5/3.5</span>
          </footer>

        </section>

      </main>
    </div>
  );
}
