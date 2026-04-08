"use client";

import { useEffect } from "react";

export default function JSLibLoader() {
  useEffect(() => {
    // Check if already loaded
    if ((window as unknown as { JSZip?: unknown }).JSZip) {
      return;
    }
    
    // Load JSZip from CDN
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);
  
  return null;
}
