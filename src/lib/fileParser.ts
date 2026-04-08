"use client";

// Types for file parsing
export interface ParseProgress {
  stage: "idle" | "reading" | "parsing" | "analyzing" | "complete" | "error";
  percent: number;
  message: string;
}

export interface ParseResult {
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

// File size limit (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Update progress callback type
type ProgressCallback = (progress: ParseProgress) => void;

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

// Helper function to clean text
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

// Helper function to extract text from HTML using DOMParser for proper parsing
function extractParagraphsFromHtml(html: string): { paragraphs: string[]; headings: string[] } {
  const paragraphs: string[] = [];
  const headings: string[] = [];
  
  // Remove script and style tags first
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Try to use DOMParser for better parsing
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanHtml, "text/html");
    
    // Extract headings (h1-h6) directly
    const headingElements = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headingElements.forEach((el) => {
      const text = cleanText(decodeHtmlEntities(el.textContent || ""));
      if (text.length > 0) {
        headings.push(text);
      }
    });
    
    // Extract paragraphs directly using querySelector
    const paragraphElements = doc.querySelectorAll("p");
    paragraphElements.forEach((el) => {
      // Get text content, removing nested tags but preserving structure
      let text = el.textContent || "";
      text = decodeHtmlEntities(text);
      text = cleanText(text);
      // Only add non-empty paragraphs with meaningful content (at least 10 characters)
      if (text.length >= 10) {
        paragraphs.push(text);
      }
    });
    
    // If no paragraphs found via querySelector, fall back to regex approach
    if (paragraphs.length === 0) {
      return extractParagraphsFromHtmlFallback(html);
    }
    
    return { paragraphs, headings };
  } catch {
    // Fallback to regex-based extraction
    return extractParagraphsFromHtmlFallback(html);
  }
}

// Fallback function for extracting paragraphs when DOMParser fails
function extractParagraphsFromHtmlFallback(html: string): { paragraphs: string[]; headings: string[] } {
  const paragraphs: string[] = [];
  const headings: string[] = [];
  
  // Remove script and style tags first
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Extract headings using regex
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
    const headingText = cleanText(decodeHtmlEntities(headingMatch[2]));
    if (headingText.length > 0) {
      headings.push(headingText);
    }
  }
  
  // Extract paragraphs using regex - match <p> tags with their content
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let paragraphMatch;
  while ((paragraphMatch = paragraphRegex.exec(cleanHtml)) !== null) {
    let text = paragraphMatch[1];
    // Remove any nested HTML tags within the paragraph
    text = text.replace(/<[^>]+>/g, " ");
    text = decodeHtmlEntities(text);
    text = cleanText(text);
    if (text.length >= 10) {
      paragraphs.push(text);
    }
  }
  
  // If still no paragraphs, use the old approach of splitting by block elements
  if (paragraphs.length === 0) {
    // Replace block-level elements with double newlines
    cleanHtml = cleanHtml.replace(/<br\s*\/?>/gi, "\n\n");
    cleanHtml = cleanHtml.replace(/<\/p>/gi, "\n\n");
    cleanHtml = cleanHtml.replace(/<\/div>/gi, "\n\n");
    cleanHtml = cleanHtml.replace(/<\/h[1-6]>/gi, "\n\n");
    
    // Remove all remaining HTML tags
    cleanHtml = cleanHtml.replace(/<[^>]+>/g, " ");
    
    // Decode HTML entities
    cleanHtml = decodeHtmlEntities(cleanHtml);
    
    // Split by newlines and clean up
    const lines = cleanHtml.split(/\n+/);
    
    for (const line of lines) {
      const cleaned = cleanText(line);
      if (cleaned.length >= 10) {
        paragraphs.push(cleaned);
      }
    }
  }
  
  return { paragraphs, headings };
}

// Parse EPUB file
async function parseEpub(file: File, onProgress: ProgressCallback): Promise<{ title: string; content: string }> {
  onProgress({ stage: "reading", percent: 10, message: "正在读取文件..." });
  
  // @ts-expect-error - JSZip loaded via CDN
  const JSZip = (window as unknown as { JSZip: typeof import("jszip") }).JSZip;
  if (!JSZip) {
    throw new Error("JSZip library not loaded");
  }

  // Read file as array buffer
  const arrayBuffer = await file.arrayBuffer();
  onProgress({ stage: "reading", percent: 20, message: "正在读取文件..." });

  onProgress({ stage: "parsing", percent: 30, message: "正在解析文本..." });
  
  // Load the zip
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  let title = file.name.replace(/\.[^/.]+$/, "");
  let content = "";

  // Find and parse container.xml to get content path
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  let rootFilePath = "OEBPS/content.opf";
  
  if (containerXml) {
    const rootFileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (rootFileMatch) {
      rootFilePath = rootFileMatch[1];
    }
  }

  // Get the directory of the OPF file
  const opfDir = rootFilePath.split("/").slice(0, -1).join("/");
  const opfPrefix = opfDir ? opfDir + "/" : "";

  // Parse the OPF file to get spine and manifest
  const opfContent = await zip.file(rootFilePath)?.async("string");
  
  if (opfContent) {
    // Extract title from metadata
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Get spine items
    const spineMatches = opfContent.match(/<itemref[^>]*idref="([^"]+)"[^>]*>/g) || [];
    const spineIds = spineMatches.map((match: string) => {
      const idMatch = match.match(/idref="([^"]+)"/);
      return idMatch ? idMatch[1] : null;
    }).filter(Boolean);

    // Get manifest items
    const manifestMatches = opfContent.match(/<item[^>]+>/g) || [];
    const manifest: Record<string, string> = {};
    manifestMatches.forEach((item: string) => {
      const idMatch = item.match(/id="([^"]+)"/);
      const hrefMatch = item.match(/href="([^"]+)"/);
      if (idMatch && hrefMatch) {
        manifest[idMatch[1]] = hrefMatch[1];
      }
    });

    // Extract text from each spine item in order
    const chapterContents: string[] = [];
    const allHeadings: string[] = [];
    
    for (let i = 0; i < spineIds.length; i++) {
      const id = spineIds[i];
      const href = manifest[id as string];
      if (!href) continue;

      const chapterPath = opfPrefix + href;
      const chapterHtml = await zip.file(chapterPath)?.async("string");
      
      if (chapterHtml) {
        // Extract paragraphs and headings from chapter
        const { paragraphs, headings } = extractParagraphsFromHtml(chapterHtml);
        
        // Add headings to chapter headings list
        allHeadings.push(...headings);
        
        // Add chapter heading if found in chapter
        const chapterHeading = headings[0];
        if (chapterHeading && paragraphs.length > 0) {
          chapterContents.push(`\n\n--- ${chapterHeading} ---\n\n`);
        }
        
        // Add paragraphs
        if (paragraphs.length > 0) {
          chapterContents.push(paragraphs.join("\n\n"));
        }
      }
      
      // Update progress
      const progress = 30 + Math.round((i / spineIds.length) * 40);
      onProgress({ stage: "parsing", percent: progress, message: "正在解析文本..." });
    }

    // Join all content with clear separation
    content = chapterContents.filter(c => c.trim().length > 0).join("\n\n");
  } else {
    // Fallback: try to extract all text files
    const textFiles = Object.keys(zip.files).filter((name) => 
      name.endsWith(".xhtml") || name.endsWith(".html") || name.endsWith(".htm")
    );
    
    const allParagraphs: string[] = [];
    
    for (const filePath of textFiles) {
      const html = await zip.file(filePath)?.async("string");
      if (html) {
        const { paragraphs } = extractParagraphsFromHtml(html);
        allParagraphs.push(...paragraphs);
      }
    }
    
    content = allParagraphs.join("\n\n");
  }

  if (!content.trim()) {
    throw new Error("无法从EPUB文件中提取文本内容");
  }

  onProgress({ stage: "analyzing", percent: 90, message: "正在分析词汇..." });
  onProgress({ stage: "complete", percent: 100, message: "解析完成！" });

  return { title, content };
}

// Parse TXT file
async function parseTxt(file: File, onProgress: ProgressCallback): Promise<{ title: string; content: string }> {
  onProgress({ stage: "reading", percent: 5, message: "正在读取文件..." });
  
  // Add minimum delay for visual feedback
  const minDelay = new Promise((resolve) => setTimeout(resolve, 500));
  
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, "UTF-8");
  });

  onProgress({ stage: "parsing", percent: 30, message: "正在解析文本..." });
  
  // Simulate parsing for small files
  await minDelay;
  onProgress({ stage: "parsing", percent: 50, message: "正在解析文本..." });

  // Process content
  const paragraphs = content.split(/\n\n+/);
  const processedParagraphs = paragraphs.filter((p) => p.trim().length > 0);
  const finalContent = processedParagraphs.join("\n\n");

  onProgress({ stage: "analyzing", percent: 70, message: "正在分析词汇..." });
  onProgress({ stage: "analyzing", percent: 90, message: "正在分析词汇..." });
  
  await minDelay;
  
  onProgress({ stage: "complete", percent: 100, message: "解析完成！" });

  // Extract title from first line if it looks like a title
  let title = file.name.replace(/\.[^/.]+$/, "");
  const firstLine = content.split("\n")[0].trim();
  if (firstLine && firstLine.length < 200 && !firstLine.match(/^[A-Z\s]+$/)) {
    title = firstLine;
  }

  return { title, content: finalContent };
}

// Main parse function
export async function parseFile(
  file: File,
  onProgress: ProgressCallback
): Promise<ParseResult> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    onProgress({ stage: "error", percent: 0, message: "文件过大" });
    return {
      title: "",
      content: "",
      success: false,
      error: "该书籍内容过长，建议分章节上传",
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  try {
    let result: { title: string; content: string };

    switch (extension) {
      case "epub":
        result = await parseEpub(file, onProgress);
        break;
      case "txt":
      default:
        result = await parseTxt(file, onProgress);
        break;
    }

    // Final delay for completion state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      title: result.title,
      content: result.content,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    
    if (errorMessage === "无法从EPUB文件中提取文本内容") {
      onProgress({ stage: "error", percent: 0, message: "解析失败" });
      return {
        title: "",
        content: "",
        success: false,
        error: "该文件无法解析，请确认文件格式是否正确",
      };
    }

    onProgress({ stage: "error", percent: 0, message: "解析失败" });
    return {
      title: "",
      content: "",
      success: false,
      error: "该文件无法解析，请确认文件格式是否正确",
    };
  }
}
