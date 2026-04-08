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

// Minimum word count for PDF to be considered valid
const MIN_PDF_WORDS = 50;

// Update progress callback type
type ProgressCallback = (progress: ParseProgress) => void;

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
    
    for (let i = 0; i < spineIds.length; i++) {
      const id = spineIds[i];
      const href = manifest[id as string];
      if (!href) continue;

      const chapterPath = opfPrefix + href;
      const chapterHtml = await zip.file(chapterPath)?.async("string");
      
      if (chapterHtml) {
        // Extract title from chapter
        const h1Match = chapterHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const h2Match = chapterHtml.match(/<h2[^>]*>([^<]+)<\/h2>/i);
        const chapterTitle = h1Match?.[1] || h2Match?.[1];
        
        // Strip HTML tags but keep structure
        const text = chapterHtml
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, " ")
          .trim();

        if (text.length > 50) {
          if (chapterTitle) {
            chapterContents.push(`\n\n=== ${chapterTitle.trim()} ===\n\n`);
          }
          chapterContents.push(text);
        }
      }
      
      // Update progress
      const progress = 30 + Math.round((i / spineIds.length) * 40);
      onProgress({ stage: "parsing", percent: progress, message: "正在解析文本..." });
    }

    content = chapterContents.join("\n");
  } else {
    // Fallback: try to extract all text files
    const textFiles = Object.keys(zip.files).filter((name) => 
      name.endsWith(".xhtml") || name.endsWith(".html") || name.endsWith(".htm")
    );
    
    for (const filePath of textFiles) {
      const html = await zip.file(filePath)?.async("string");
      if (html) {
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (text.length > 50) {
          content += text + "\n\n";
        }
      }
    }
  }

  if (!content.trim()) {
    throw new Error("无法从EPUB文件中提取文本内容");
  }

  onProgress({ stage: "analyzing", percent: 90, message: "正在分析词汇..." });
  onProgress({ stage: "complete", percent: 100, message: "解析完成！" });

  return { title, content };
}

// Parse PDF file
async function parsePdf(file: File, onProgress: ProgressCallback): Promise<{ title: string; content: string }> {
  onProgress({ stage: "reading", percent: 10, message: "正在读取文件..." });
  
  // PDF.js type definition
  interface PDFJSLib {
    getDocument: (options: { data: ArrayBuffer }) => {
      promise: Promise<{
        numPages: number;
        getPage: (num: number) => Promise<{
          getTextContent: () => Promise<{ items: Array<{ str: string }> }>
        }>
      }>
    };
    GlobalWorkerOptions: {
      workerSrc: string;
    };
  }
  
  const pdfjsLib = (window as unknown as { pdfjsLib: PDFJSLib }).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error("PDF.js library not loaded");
  }

  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js";

  onProgress({ stage: "reading", percent: 20, message: "正在读取文件..." });
  const arrayBuffer = await file.arrayBuffer();

  onProgress({ stage: "parsing", percent: 30, message: "正在解析文本..." });
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const numPages = pdf.numPages;
  const pageContents: string[] = [];
  let fullText = "";

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    pageContents.push(pageText);
    
    // Update progress
    const progress = 30 + Math.round((i / numPages) * 40);
    onProgress({ stage: "parsing", percent: progress, message: "正在解析文本..." });
  }

  fullText = pageContents.join("\n\n");
  
  // Count words
  const wordCount = fullText.split(/\s+/).filter((w) => w.length > 0).length;
  
  if (wordCount < MIN_PDF_WORDS) {
    throw new Error("SCAN_PDF");
  }

  onProgress({ stage: "analyzing", percent: 90, message: "正在分析词汇..." });
  onProgress({ stage: "complete", percent: 100, message: "解析完成！" });

  // Try to extract title from first page or use filename
  let title = file.name.replace(/\.[^/.]+$/, "");
  if (pageContents[0]) {
    const firstLine = pageContents[0].split("\n")[0].trim();
    if (firstLine.length > 0 && firstLine.length < 100) {
      title = firstLine;
    }
  }

  return { title, content: fullText };
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
      case "pdf":
        result = await parsePdf(file, onProgress);
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
    
    if (errorMessage === "SCAN_PDF") {
      onProgress({ stage: "error", percent: 0, message: "扫描版PDF" });
      return {
        title: "",
        content: "",
        success: false,
        error: "该PDF似乎是扫描版，暂不支持扫描版PDF，请上传文字版PDF或转换为TXT格式后上传",
      };
    }

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
