import pdfParse from "pdf-parse";
import { geminiService } from "./gemini.service";

export interface ExtractedPageChunk {
  page: number;
  section?: string;
  text: string;
  tokenCount: number;
}

export type PdfExtractionOutcome =
  | "digital_text_extracted"
  | "ocr_success"
  | "ocr_required_unresolved"
  | "extraction_failed";

export interface PdfExtractionResult {
  outcome: PdfExtractionOutcome;
  pageCount: number;
  totalText: string;
  chunks: ExtractedPageChunk[];
  requiresOcr: boolean;
  ocrPerformed: boolean;
  ocrError?: string;
  error?: string;
}

/**
 * Validates that the buffer starts with the authentic PDF magic bytes (%PDF-).
 */
export function isValidPdfSignature(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export class PdfService {
  /**
   * Safely extracts text with full outcome semantics, returning outcome="extraction_failed"
   * instead of throwing when extraction fails for non-OCR reasons (e.g. invalid signature, corrupted structure).
   */
  async extractSafe(pdfBuffer: Buffer, docTitle: string): Promise<PdfExtractionResult> {
    return this.extractAndChunk(pdfBuffer, docTitle, { throwOnError: false });
  }

  /**
   * Validates and extracts text from a PDF buffer, chunking by page and section.
   * Scanned PDFs are transcribed via OCR. Malformed files are rejected explicitly or return extraction_failed.
   */
  async extractAndChunk(
    pdfBuffer: Buffer,
    docTitle: string,
    options?: { throwOnError?: boolean }
  ): Promise<PdfExtractionResult> {
    const shouldThrow = options?.throwOnError ?? true;
    try {
      if (!isValidPdfSignature(pdfBuffer)) {
        throw new Error("Invalid PDF signature: file does not begin with standard %PDF- magic bytes.");
      }

      if (pdfBuffer.length < 50) {
        throw new Error("Malformed PDF file: file size is too small to contain a valid document structure.");
      }

    const uint8 = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);
    const options = {
      pagerender: async (pageData: any) => {
        const textContent = await pageData.getTextContent();
        let lastY: any, text = "";
        for (const item of textContent.items) {
          if (lastY === item.transform[4] || !lastY) {
            text += item.str;
          } else {
            text += "\n" + item.str;
          }
          lastY = item.transform[4];
        }
        return `\n\n--- PAGE ${pageData.pageIndex + 1} ---\n\n` + text;
      },
    };

    let data: any;
    try {
      data = await pdfParse(uint8 as unknown as Buffer, options);
    } catch (parseErr: unknown) {
      throw new Error(`Failed to parse PDF document structure: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
    }

    const pageCount = data.numpages || 1;
    let totalText = data.text || "";

    // Low text detection: if average text per page is < 30 characters, likely a scanned image requiring OCR
    const avgCharsPerPage = totalText.length / Math.max(1, pageCount);
    const isLowText = avgCharsPerPage < 30 || totalText.trim().length < 30;

    // If scanned/low-text PDF, execute OCR extraction and inspect whether genuine text is produced
    if (isLowText) {
      console.log(`[PdfService] Scanned or low-text PDF detected for "${docTitle}" (${avgCharsPerPage.toFixed(1)} chars/page). Executing OCR...`);
      let ocrText: string | null = null;
      let ocrAttempted = false;
      let ocrError: string | undefined;

      if (geminiService.isLiveClientConfigured()) {
        try {
          ocrAttempted = true;
          ocrText = await geminiService.transcribePdfWithOcr(pdfBuffer);
        } catch (err: unknown) {
          ocrError = err instanceof Error ? err.message : String(err);
          console.warn(`[PdfService] OCR transcription failed for "${docTitle}":`, ocrError);
        }
      } else {
        ocrError = "OCR multimodal client is not configured in this environment.";
      }

      // Inspect whether OCR returned genuine, non-empty extracted text
      const isGenuineText = Boolean(ocrText && ocrText.trim().length >= 30);
      if (isGenuineText && ocrText) {
        const chunks = this.chunkTextByPageAndSection(ocrText, pageCount);
        if (chunks.length > 0) {
          return {
            outcome: "ocr_success",
            pageCount,
            totalText: ocrText,
            chunks,
            requiresOcr: false, // OCR successfully completed, so OCR is no longer required
            ocrPerformed: true,
          };
        }
      }

      // OCR was required but unavailable, failed, or returned unreadable text
      return {
        outcome: "ocr_required_unresolved",
        pageCount,
        totalText: "",
        chunks: [],
        requiresOcr: true, // OCR is still required
        ocrPerformed: ocrAttempted,
        ocrError: ocrError || "OCR returned empty or unreadable text content.",
      };
    }

    if (totalText.trim().length === 0) {
      throw new Error("Document contains no extractable or readable text content.");
    }

    const chunks = this.chunkTextByPageAndSection(totalText, pageCount);

    if (chunks.length === 0) {
      throw new Error("Document text extraction yielded zero valid structural chunks.");
    }

    return {
      outcome: "digital_text_extracted",
      pageCount,
      totalText,
      chunks,
      requiresOcr: false,
      ocrPerformed: false,
    };
    } catch (err: unknown) {
      if (!shouldThrow) {
        return {
          outcome: "extraction_failed",
          pageCount: 0,
          totalText: "",
          chunks: [],
          requiresOcr: false,
          ocrPerformed: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      throw err;
    }
  }

  /**
   * Partitions extracted text into page-aligned chunks preserving 1-indexed page references.
   */
  private chunkTextByPageAndSection(totalText: string, pageCount: number): ExtractedPageChunk[] {
    const chunks: ExtractedPageChunk[] = [];
    let currentPage = 1;
    const paragraphs = totalText.split(/\n\s*\n/);
    let currentChunkText = "";

    for (const para of paragraphs) {
      let trimmed = para.trim();
      if (!trimmed) continue;

      // Detect page markers (e.g. "--- PAGE 2 ---" or "Page 2")
      const pageMarkerMatch = trimmed.match(/^--- PAGE (\d+) ---\s*(.*)$/is) || trimmed.match(/^(?:PAGE|Page)\s+(\d+)\s*(.*)$/is);
      if (pageMarkerMatch && parseInt(pageMarkerMatch[1])) {
        const newPage = parseInt(pageMarkerMatch[1]);
        if (newPage !== currentPage && currentChunkText.trim()) {
          chunks.push({
            page: Math.min(currentPage, pageCount),
            section: `Section on Page ${currentPage}`,
            text: currentChunkText.trim(),
            tokenCount: Math.ceil(currentChunkText.length / 4),
          });
          currentChunkText = "";
        }
        currentPage = newPage;
        const remainder = pageMarkerMatch[2]?.trim();
        if (!remainder) {
          continue;
        }
        trimmed = remainder;
      }

      // Detect potential section headers (e.g. "4.2 Seal Replacement" or "SECTION 3:")
      let sectionHeader: string | undefined;
      const headerMatch = trimmed.match(/^(\d+(\.\d+)*\s+[A-Z][A-Za-z0-9\s—\-]+)/);
      if (headerMatch) {
        sectionHeader = headerMatch[1];
      }

      if (currentChunkText.length + trimmed.length > 800) {
        if (currentChunkText.trim()) {
          chunks.push({
            page: Math.min(currentPage, pageCount),
            section: sectionHeader || `Section on Page ${currentPage}`,
            text: currentChunkText.trim(),
            tokenCount: Math.ceil(currentChunkText.length / 4),
          });
        }
        currentChunkText = trimmed;
      } else {
        currentChunkText += (currentChunkText ? "\n\n" : "") + trimmed;
      }
    }

    if (currentChunkText.trim()) {
      chunks.push({
        page: Math.min(currentPage, pageCount),
        section: `Section on Page ${currentPage}`,
        text: currentChunkText.trim(),
        tokenCount: Math.ceil(currentChunkText.length / 4),
      });
    }

    return chunks;
  }
}

export const pdfService = new PdfService();
