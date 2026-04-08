"use client";

import { useEffect } from "react";

export default function JSLibLoader() {
  useEffect(() => {
    // JSZip is now loaded via npm package, no CDN needed
    return () => {};
  }, []);
  
  return null;
}
