"use client";

import JSZip from 'jszip';

// TOC Entry interface
export interface TocEntry {
  title: string;
  href: string;
  page: number;
  paragraphIndex?: number; // Paragraph index for navigation
}

// Types for file parsing
export interface ParseProgress {
  stage: "idle" | "reading" | "parsing" | "analyzing" | "complete" | "error";
  percent: number;
  message: string;
}

export interface ParseResult {
  title: string;
  content: string;
  tableOfContents?: TocEntry[];
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
// Returns content blocks in order (headings and paragraphs mixed)
interface ContentBlock {
  type: 'heading' | 'paragraph';
  level?: number; // 1-6 for headings
  text: string;
}

function extractContentBlocksFromHtml(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  
  // Remove script and style tags first
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Try to use DOMParser for better parsing
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanHtml, "text/html");
    
    // Use querySelectorAll to get all headings and paragraphs in document order
    const elements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p');
    
    elements.forEach(el => {
      const tagName = el.tagName.toLowerCase();
      let text = el.textContent || "";
      text = decodeHtmlEntities(text);
      text = cleanText(text);
      
      if (!text) return; // Skip empty content
      
      if (tagName.startsWith('h')) {
        // This is a heading
        const level = parseInt(tagName[1], 10);
        blocks.push({ type: 'heading', level, text });
      } else {
        // This is a paragraph - only add if meaningful content (at least 10 chars)
        if (text.length >= 10) {
          blocks.push({ type: 'paragraph', text });
        }
      }
    });
    
    // If no blocks found via querySelectorAll, fall back to simpler approach
    if (blocks.length === 0) {
      return extractContentBlocksFallback(html);
    }
    
    return blocks;
  } catch {
    // Fallback to simpler regex-based extraction
    return extractContentBlocksFallback(html);
  }
}

// Fallback function for extracting content blocks when DOMParser fails
function extractContentBlocksFallback(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  
  // Remove script and style tags first
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Extract headings using regex (in order)
  const headingRegex = /<h([1-6])(?:[^>]*)>([\s\S]*?)<\/h\1>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
    const level = parseInt(headingMatch[1], 10);
    const headingText = cleanText(decodeHtmlEntities(headingMatch[2]));
    if (headingText.length > 0) {
      blocks.push({ type: 'heading', level, text: headingText });
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
      blocks.push({ type: 'paragraph', text });
    }
  }
  
  // If still no blocks, use block element splitting
  if (blocks.length === 0) {
    // Replace block-level elements with markers
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
        blocks.push({ type: 'paragraph', text: cleaned });
      }
    }
  }
  
  return blocks;
}

// Legacy function for backward compatibility
function extractParagraphsFromHtml(html: string): { paragraphs: string[]; headings: string[] } {
  const blocks = extractContentBlocksFromHtml(html);
  const paragraphs: string[] = [];
  const headings: string[] = [];
  
  for (const block of blocks) {
    if (block.type === 'heading') {
      headings.push(block.text);
    } else {
      paragraphs.push(block.text);
    }
  }
  
  return { paragraphs, headings };
}

// Parse EPUB file
async function parseEpub(file: File, onProgress: ProgressCallback): Promise<{ title: string; content: string; tableOfContents: TocEntry[] }> {
  console.log('开始解析EPUB:', file.name);
  onProgress({ stage: "reading", percent: 10, message: "正在读取文件..." });

  // Read file as array buffer
  const arrayBuffer = await file.arrayBuffer();
  onProgress({ stage: "reading", percent: 20, message: "正在读取文件..." });

  onProgress({ stage: "parsing", percent: 30, message: "正在解析文本..." });
  
  // Load the zip using JSZip
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  let title = file.name.replace(/\.(txt|epub|pdf)$/i, "").trim();
  let content = "";
  const tableOfContents: TocEntry[] = [];

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
    // Extract title from metadata - only use if not empty
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].trim();
    }

    // Try to find and parse TOC from nav.xhtml (EPUB 3) or toc.ncx (EPUB 2)
    await extractEpubToc(zip, opfContent, opfPrefix, tableOfContents);

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
    
    // Track chapter start paragraph indices for TOC
    let currentParagraphIndex = 0;
    const chapterStartIndices: { href: string; paragraphIndex: number }[] = [];
    
    for (let i = 0; i < spineIds.length; i++) {
      const id = spineIds[i];
      const href = manifest[id as string];
      if (!href) continue;

      // Record chapter start paragraph index
      chapterStartIndices.push({ href, paragraphIndex: currentParagraphIndex });

      const chapterPath = opfPrefix + href;
      const chapterHtml = await zip.file(chapterPath)?.async("string");
      
      if (chapterHtml) {
        // Extract content blocks (headings and paragraphs in order)
        const blocks = extractContentBlocksFromHtml(chapterHtml);
        
        // Process blocks and build content
        for (const block of blocks) {
          if (block.type === 'heading') {
            // Add heading with special prefix for rendering (allowing clicks on words)
            // Format: [H2]Chapter 1[/H2] - level is 2 for typical chapter headings
            const level = block.level || 2;
            chapterContents.push(`[H${level}]${block.text}[/H${level}]`);
            allHeadings.push(block.text);
            currentParagraphIndex++;
          } else {
            // Add paragraph
            chapterContents.push(block.text);
            currentParagraphIndex++;
          }
        }
      }
      
      // Update progress
      const progress = 30 + Math.round((i / spineIds.length) * 40);
      onProgress({ stage: "parsing", percent: progress, message: "正在解析文本..." });
    }
    
    // Map TOC entries to paragraph indices
    // Each TOC entry has an href that matches a chapter, so we find the corresponding chapter
    for (const tocEntry of tableOfContents) {
      // Find the chapter that matches this TOC entry's href
      const matchedChapter = chapterStartIndices.find(chapter => 
        tocEntry.href === chapter.href || 
        tocEntry.href.includes(chapter.href) || 
        chapter.href.includes(tocEntry.href)
      );
      if (matchedChapter) {
        tocEntry.paragraphIndex = matchedChapter.paragraphIndex;
      }
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

  return { title, content, tableOfContents };
}

// Helper function to extract TOC from EPUB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractEpubToc(zip: any, opfContent: string, opfPrefix: string, tableOfContents: TocEntry[]): Promise<void> {
  // Find nav.xhtml (EPUB 3) or toc.ncx (EPUB 2) in manifest
  const manifestMatches = opfContent.match(/<item[^>]+>/g) || [];
  let navPath = "";
  
  for (const item of manifestMatches) {
    // Look for EPUB 3 nav
    if (item.includes('epub:type="toc"') || item.includes("nav")) {
      const hrefMatch = item.match(/href="([^"]+)"/);
      if (hrefMatch) {
        navPath = opfPrefix + hrefMatch[1];
        break;
      }
    }
    // Look for NCX (EPUB 2)
    if (item.includes('media-type="application/x-dtbncx+xml"')) {
      const hrefMatch = item.match(/href="([^"]+)"/);
      if (hrefMatch) {
        navPath = opfPrefix + hrefMatch[1];
        break;
      }
    }
  }
  
  if (!navPath) return;
  
  const navContent = await zip.file(navPath)?.async("string");
  if (!navContent) return;
  
  // Try EPUB 3 nav.xhtml format
  // Look for <nav epub:type="toc"> or <nav id="toc">
  const navMatch = navContent.match(/<nav[^>]*epub:type="toc"[^>]*>([\s\S]*?)<\/nav>/i) ||
                   navContent.match(/<nav[^>]*id="toc"[^>]*>([\s\S]*?)<\/nav>/i) ||
                   navContent.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
  
  if (navMatch) {
    const navHtml = navMatch[1];
    // Extract links
    const linkMatches = navHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);
    for (const match of linkMatches) {
      const href = match[1];
      const text = match[2].trim();
      if (text) {
        // Decode HTML entities
        const decodedText = text
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        tableOfContents.push({
          title: decodedText,
          href: href,
          page: 1, // Will be refined later based on content position
        });
      }
    }
  }
  
  // If no EPUB 3 nav found, try NCX format (EPUB 2)
  if (tableOfContents.length === 0) {
    const ncxMatch = navContent.match(/<navMap>([\s\S]*?)<\/navMap>/i);
    if (ncxMatch) {
      const navMap = ncxMatch[1];
      // Extract navPoints
      const navPointMatches = navMap.matchAll(/<navPoint[^>]*>([\s\S]*?)<\/navPoint>/gi);
      for (const match of navPointMatches) {
        const navPointContent = match[1];
        const labelMatch = navPointContent.match(/<text>([^<]+)<\/text>/i);
        const srcMatch = navPointContent.match(/<content[^>]+src="([^"]+)"/i);
        if (labelMatch) {
          tableOfContents.push({
            title: labelMatch[1].trim(),
            href: srcMatch ? srcMatch[1] : "",
            page: 1,
          });
        }
      }
    }
  }
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

  // Extract title - use filename (without extension) as default
  const title = file.name.replace(/\.(txt|epub|pdf)$/i, "").trim();

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
    let result: { title: string; content: string; tableOfContents?: TocEntry[] };

    switch (extension) {
      case "epub":
        result = await parseEpub(file, onProgress);
        break;
      case "txt":
        const txtResult = await parseTxt(file, onProgress);
        result = { ...txtResult, tableOfContents: [] };
        break;
      default:
        const defaultResult = await parseTxt(file, onProgress);
        result = { ...defaultResult, tableOfContents: [] };
        break;
    }

    // Final delay for completion state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      title: result.title,
      content: result.content,
      tableOfContents: result.tableOfContents,
      success: true,
    };
  } catch (error) {
    console.error('EPUB解析错误:', error);
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
