import zlib from "zlib";
import { storageService } from "./storage.service";
import { DocumentFigure, IDocumentFigure } from "../models";
import type { FigureStatus, DocumentFigureDTO } from "@man-u-ai/shared";

export const VISUAL_PROCESSING_LIMITS = {
  MAX_PAGES_TO_PROCESS: 50,
  MAX_FIGURES_PER_DOC: 20,
  MAX_FIGURES_PER_PAGE: 5,
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MIN_IMAGE_DIMENSION: 30, // 30px minimum width and height
};

export interface ExtractedFigureItem {
  figureId: string;
  page: number;
  title?: string;
  caption?: string;
  buffer?: Buffer;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  status: FigureStatus;
  processingError?: string;
}

/**
 * Standard CRC32 calculation for PNG chunk generation (0 external dependencies).
 */
function crc32(buf: Buffer): number {
  let table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Encodes raw uncompressed pixel data into a standard, valid PNG binary.
 */
export function encodeRawToPng(
  width: number,
  height: number,
  pixelData: Buffer,
  colorSpace: "DeviceRGB" | "DeviceGray" = "DeviceRGB"
): Buffer {
  const isRgb = colorSpace === "DeviceRGB";
  const bytesPerPixel = isRgb ? 3 : 1;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // 1. IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = isRgb ? 2 : 0; // 2 = RGB, 0 = Grayscale
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrTypeAndData = Buffer.concat([Buffer.from("IHDR"), ihdrData]);
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(crc32(ihdrTypeAndData), 0);
  const ihdrChunk = Buffer.concat([Buffer.alloc(4), ihdrTypeAndData, ihdrCrc]);
  ihdrChunk.writeUInt32BE(13, 0);

  // 2. Scanlines with filter byte 0 (None)
  const scanlineLength = 1 + width * bytesPerPixel;
  const scanlines = Buffer.alloc(height * scanlineLength);
  let inOffset = 0;
  let outOffset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[outOffset++] = 0; // Filter byte: None
    for (let x = 0; x < width * bytesPerPixel; x++) {
      scanlines[outOffset++] = inOffset < pixelData.length ? pixelData[inOffset++] : 0;
    }
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatTypeAndData = Buffer.concat([Buffer.from("IDAT"), compressed]);
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(idatTypeAndData), 0);
  const idatChunk = Buffer.concat([Buffer.alloc(4), idatTypeAndData, idatCrc]);
  idatChunk.writeUInt32BE(compressed.length, 0);

  // 3. IEND Chunk
  const iendType = Buffer.from("IEND");
  const iendCrc = Buffer.alloc(4);
  iendCrc.writeUInt32BE(crc32(iendType), 0);
  const iendChunk = Buffer.concat([Buffer.alloc(4), iendType, iendCrc]);
  iendChunk.writeUInt32BE(0, 0);

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

export class VisualService {
  /**
   * Extracts page-level technical diagrams, figures, and embedded images from a PDF buffer
   * subject to strict bounding limits and genuine caption correlation.
   */
  extractFiguresFromPdf(
    pdfBuffer: Buffer,
    pageCount: number,
    pageTextMap?: Map<number, string>
  ): ExtractedFigureItem[] {
    const figures: ExtractedFigureItem[] = [];
    if (!pdfBuffer || pdfBuffer.length === 0) return figures;

    const boundedPageCount = Math.min(pageCount, VISUAL_PROCESSING_LIMITS.MAX_PAGES_TO_PROCESS);
    const latinText = pdfBuffer.toString("latin1");

    // 1. Map object references to specific pages by analyzing Page dictionaries
    const pageObjMap = new Map<string, number>();
    const pageRegex = /(?:^|[\r\n])(\d+)\s+(\d+)\s+obj\s*<<([\s\S]*?)>>/g;
    let pageMatch: RegExpExecArray | null;
    let detectedPageIndex = 1;

    while ((pageMatch = pageRegex.exec(latinText)) !== null) {
      const dict = pageMatch[3];
      if (dict.includes("/Type") && dict.includes("/Page") && !dict.includes("/Pages")) {
        const currentPageNum = detectedPageIndex;
        // Search for /XObject << /Name objNum gen R ... >>
        const xobjMatch = dict.match(/\/XObject\s*<<([\s\S]*?)>>/);
        if (xobjMatch) {
          const xobjEntries = xobjMatch[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g);
          for (const entry of xobjEntries) {
            const referencedObjNum = entry[2];
            pageObjMap.set(referencedObjNum, currentPageNum);
          }
        }
        detectedPageIndex++;
        if (detectedPageIndex > boundedPageCount) break;
      }
    }

    // 2. Scan all objects in PDF for genuine image XObjects
    const parts = latinText.split("endobj");
    const figuresPerPage = new Map<number, number>();

    for (const part of parts) {
      if (figures.length >= VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_DOC) {
        break;
      }

      const objMatch = part.match(/(?:^|[\r\n])(\d+)\s+(\d+)\s+obj/);
      if (!objMatch) continue;
      const objNum = objMatch[1];

      // Check if this object is an Image XObject
      if (!part.includes("/Subtype") || !part.includes("/Image")) {
        continue;
      }

      const assignedPage = Math.min(pageObjMap.get(objNum) || 1, boundedPageCount);
      const currentCountOnPage = figuresPerPage.get(assignedPage) || 0;
      if (currentCountOnPage >= VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_PAGE) {
        continue;
      }

      // Extract dictionary metadata
      const widthMatch = part.match(/\/Width\s+(\d+)/);
      const heightMatch = part.match(/\/Height\s+(\d+)/);
      const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
      const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;

      // Filter out icons, glyphs, and 1x1 spacing pixels
      if (width < VISUAL_PROCESSING_LIMITS.MIN_IMAGE_DIMENSION || height < VISUAL_PROCESSING_LIMITS.MIN_IMAGE_DIMENSION) {
        continue;
      }

      const filterMatch = part.match(/\/Filter\s*\/([A-Za-z0-9]+)/);
      const filterName = filterMatch ? filterMatch[1] : "";

      const streamKeyword = "stream";
      const streamIdx = part.indexOf(streamKeyword);
      const endstreamIdx = part.lastIndexOf("endstream");

      if (streamIdx === -1 || endstreamIdx <= streamIdx) {
        figures.push({
          figureId: `fig-p${assignedPage}-${currentCountOnPage + 1}`,
          page: assignedPage,
          status: "failed",
          processingError: "Corrupted or missing image stream boundary in PDF object",
        });
        figuresPerPage.set(assignedPage, currentCountOnPage + 1);
        continue;
      }

      // Determine stream start offset (handle CRLF or LF after 'stream')
      let streamStart = streamIdx + streamKeyword.length;
      if (part[streamStart] === "\r" && part[streamStart + 1] === "\n") {
        streamStart += 2;
      } else if (part[streamStart] === "\n" || part[streamStart] === "\r") {
        streamStart += 1;
      }

      let streamEnd = endstreamIdx;
      if (part[streamEnd - 1] === "\n") {
        streamEnd -= 1;
        if (part[streamEnd - 1] === "\r") streamEnd -= 1;
      }

      const rawStreamString = part.slice(streamStart, streamEnd);
      const rawStreamBuffer = Buffer.from(rawStreamString, "latin1");

      if (rawStreamBuffer.length > VISUAL_PROCESSING_LIMITS.MAX_IMAGE_SIZE_BYTES) {
        figures.push({
          figureId: `fig-p${assignedPage}-${currentCountOnPage + 1}`,
          page: assignedPage,
          status: "failed",
          processingError: `Image stream exceeds size limit of ${VISUAL_PROCESSING_LIMITS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB`,
        });
        figuresPerPage.set(assignedPage, currentCountOnPage + 1);
        continue;
      }

      let imageBuffer: Buffer | undefined;
      let mimeType: string | undefined;

      try {
        if (filterName === "DCTDecode" || filterName === "DCT") {
          // JPEG image: must contain valid JPEG SOI (0xFFD8) and EOI (0xFFD9) markers
          const startIdx = rawStreamBuffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
          const endIdx = rawStreamBuffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
          if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
            throw new Error("Invalid JPEG stream: missing authentic SOI (0xFFD8) or EOI (0xFFD9) markers");
          }
          imageBuffer = rawStreamBuffer.subarray(startIdx, endIdx + 2);
          mimeType = "image/jpeg";
        } else if (filterName === "FlateDecode") {
          // Decompress Flate (deflate) bitmap
          let decompressed: Buffer;
          try {
            decompressed = zlib.inflateSync(rawStreamBuffer);
          } catch {
            decompressed = zlib.inflateRawSync(rawStreamBuffer);
          }
          const isGray = part.includes("/ColorSpace") && part.includes("/DeviceGray");
          imageBuffer = encodeRawToPng(width, height, decompressed, isGray ? "DeviceGray" : "DeviceRGB");
          mimeType = "image/png";
        } else {
          // Unsupported or unknown compression algorithm
          figures.push({
            figureId: `fig-p${assignedPage}-${currentCountOnPage + 1}`,
            page: assignedPage,
            status: "failed",
            processingError: `Unsupported image compression algorithm /${filterName || "Unknown"}`,
          });
          figuresPerPage.set(assignedPage, currentCountOnPage + 1);
          continue;
        }
      } catch (procErr: any) {
        figures.push({
          figureId: `fig-p${assignedPage}-${currentCountOnPage + 1}`,
          page: assignedPage,
          status: "failed",
          processingError: `Failed to decode image data stream: ${procErr?.message || String(procErr)}`,
        });
        figuresPerPage.set(assignedPage, currentCountOnPage + 1);
        continue;
      }

      // Check for authentic caption in the text of this page
      let figureId = `fig-p${assignedPage}-${currentCountOnPage + 1}`;
      let title: string | undefined;
      let caption: string | undefined;

      const pageText = pageTextMap?.get(assignedPage) || "";
      const captionMatch = pageText.match(
        /(?:Figure|Fig\.|Diagram|Schematic|Table)\s*([0-9]+[A-Za-z0-9\.\-_]*)(?:\s*[:—\-]\s*([^\n\r]+))?/i
      );

      if (captionMatch) {
        figureId = `Figure ${captionMatch[1]}`;
        title = captionMatch[2]?.trim() || `Figure ${captionMatch[1]}`;
        caption = captionMatch[0].trim();
      }

      figures.push({
        figureId,
        page: assignedPage,
        title,
        caption,
        buffer: imageBuffer,
        mimeType,
        width,
        height,
        sizeBytes: imageBuffer.length,
        status: "extracted",
      });

      figuresPerPage.set(assignedPage, currentCountOnPage + 1);
    }

    return figures;
  }
}

export const visualService = new VisualService();
