import zlib from "zlib";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFStream,
  PDFRawStream,
  PDFNumber,
  PDFArray,
} from "pdf-lib";
import type { FigureStatus } from "@man-u-ai/shared";

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
  const table: number[] = [];
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
 * Decodes PDF FlateDecode predictors according to ISO 32000-1 §7.4.4.4 Table 8:
 * - Predictor 1: No prediction (identity)
 * - Predictor 2: TIFF Predictor 2 (horizontal differencing)
 * - Predictor 10-14: PNG fixed filter corresponding to (predictor - 10), without a per-row filter byte prefix
 * - Predictor 15: PNG optimum prediction with a 1-byte filter prefix in [0, 4] for each row
 */
export function decodePdfPredictor(
  data: Buffer,
  predictor: number,
  width: number,
  height: number,
  colors: number,
  bitsPerComponent: number
): Buffer {
  if (bitsPerComponent !== 8) {
    throw new Error(
      `Unsupported bit depth ${bitsPerComponent} in DecodeParms (only 8-bit supported)`
    );
  }
  if (colors !== 1 && colors !== 3) {
    throw new Error(
      `Unsupported colors count ${colors} in DecodeParms (must be 1 for Grayscale or 3 for RGB)`
    );
  }
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid image dimensions (${width}x${height}) for predictor decoding`);
  }

  const bytesPerPixel = colors;
  const rowBytes = width * bytesPerPixel;

  // ── Predictor 1: No prediction ─────────────────────────────────────────────
  if (predictor === 1) {
    const requiredBytes = height * rowBytes;
    if (data.length < requiredBytes) {
      throw new Error(
        `Decompressed data length (${data.length}) is smaller than expected (${requiredBytes})`
      );
    }
    return data.subarray(0, requiredBytes);
  }

  // ── Predictor 2: TIFF Horizontal Differencing ──────────────────────────────
  if (predictor === 2) {
    const requiredBytes = height * rowBytes;
    if (data.length < requiredBytes) {
      throw new Error(
        `Decompressed TIFF predictor data length (${data.length}) is smaller than required bytes (${requiredBytes})`
      );
    }
    const raw = Buffer.alloc(requiredBytes);
    for (let y = 0; y < height; y++) {
      const srcRow = data.subarray(y * rowBytes, (y + 1) * rowBytes);
      for (let x = 0; x < rowBytes; x++) {
        const left = x >= bytesPerPixel ? raw[y * rowBytes + x - bytesPerPixel] : 0;
        raw[y * rowBytes + x] = (srcRow[x] + left) & 0xff;
      }
    }
    return raw;
  }

  // ── Predictors 10-15: PNG Predictors ──────────────────────────────────────
  const isPredictor15 = predictor === 15;
  const sourceStride = isPredictor15 ? 1 + rowBytes : rowBytes;
  const expectedTotalBytes = height * sourceStride;

  if (data.length < expectedTotalBytes) {
    throw new Error(
      `Decompressed data length (${data.length}) is smaller than expected (${expectedTotalBytes}) for Predictor ${predictor}`
    );
  }

  const fixedFilter = isPredictor15 ? null : predictor - 10;
  if (!isPredictor15 && (fixedFilter === null || fixedFilter < 0 || fixedFilter > 4)) {
    throw new Error(`Unsupported predictor algorithm ${predictor}`);
  }

  const raw = Buffer.alloc(height * rowBytes);
  const prevRow = Buffer.alloc(rowBytes);
  const currRow = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * sourceStride;
    const filter = isPredictor15 ? data[rowOffset] : fixedFilter!;
    if (filter < 0 || filter > 4) {
      throw new Error(`Invalid PNG filter byte ${filter} at row ${y} (must be 0-4)`);
    }

    const srcRow = isPredictor15
      ? data.subarray(rowOffset + 1, rowOffset + 1 + rowBytes)
      : data.subarray(rowOffset, rowOffset + rowBytes);

    for (let x = 0; x < rowBytes; x++) {
      const left = x >= bytesPerPixel ? currRow[x - bytesPerPixel] : 0;
      const above = prevRow[x];
      const upperLeft = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;
      let val = srcRow[x];

      if (filter === 0) {
        // None
      } else if (filter === 1) {
        // Sub
        val = (val + left) & 0xff;
      } else if (filter === 2) {
        // Up
        val = (val + above) & 0xff;
      } else if (filter === 3) {
        // Average
        val = (val + Math.floor((left + above) / 2)) & 0xff;
      } else if (filter === 4) {
        // Paeth
        const p = left + above - upperLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - above);
        const pc = Math.abs(p - upperLeft);
        let pr: number;
        if (pa <= pb && pa <= pc) pr = left;
        else if (pb <= pc) pr = above;
        else pr = upperLeft;
        val = (val + pr) & 0xff;
      }
      currRow[x] = val;
      raw[y * rowBytes + x] = val;
    }
    currRow.copy(prevRow);
  }

  return raw;
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
   * using robust AST/XRef dictionary and stream traversal subject to strict bounding limits
   * and honest status reporting.
   *
   * Coverage & Architectural Boundaries:
   * - Fully supports direct page XObject images (`/Subtype /Image`) in JPEG and FlateDecode.
   * - Supports page-tree inherited `/Resources` dictionaries from parent `/Pages` nodes.
   * - Supports standard predictors (Predictor 1, TIFF 2, and PNG 10-15).
   * - Form XObjects (`/Subtype /Form`) are identified and safely skipped without error;
   *   recursive unrolling of nested Form XObjects is deliberately out of scope for Task 2
   *   to prevent unbounded traversal of arbitrary nested stream hierarchies.
   */
  async extractFiguresFromPdf(
    pdfBuffer: Buffer,
    pageCount: number,
    pageTextMap?: Map<number, string>
  ): Promise<ExtractedFigureItem[]> {
    const figures: ExtractedFigureItem[] = [];
    if (!pdfBuffer || pdfBuffer.length === 0) return figures;

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    } catch (parseErr: any) {
      figures.push({
        figureId: "fig-corrupted",
        page: 1,
        status: "failed",
        processingError: `Corrupted or unparseable PDF document structure: ${parseErr?.message || parseErr}`,
      });
      return figures;
    }

    const pages = pdfDoc.getPages();
    const boundedPageCount = Math.min(
      pages.length,
      pageCount || pages.length,
      VISUAL_PROCESSING_LIMITS.MAX_PAGES_TO_PROCESS
    );

    const figuresPerPage = new Map<number, number>();

    for (let pageIdx = 0; pageIdx < boundedPageCount; pageIdx++) {
      if (figures.length >= VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_DOC) {
        break;
      }

      const pageNumber = pageIdx + 1;
      const page = pages[pageIdx];

      // Resolve Resources dictionary safely, including page-tree inherited resources
      let resources: any;
      try {
        let currNode: any = page.node;
        while (currNode && !resources) {
          const directRes = currNode.lookup(PDFName.of("Resources"));
          if (directRes) {
            resources = directRes instanceof PDFDict ? directRes : pdfDoc.context.lookup(directRes);
          } else {
            const parent = currNode.lookup(PDFName.of("Parent"));
            currNode = parent ? (parent instanceof PDFDict ? parent : pdfDoc.context.lookup(parent)) : null;
          }
        }
      } catch {
        continue;
      }
      if (!resources || !(resources instanceof PDFDict)) continue;

      // Resolve XObject dictionary safely (direct or indirect)
      let xObject: any;
      try {
        xObject = resources.lookup(PDFName.of("XObject"));
        if (!xObject) continue;
        if (!(xObject instanceof PDFDict)) {
          xObject = pdfDoc.context.lookup(xObject);
        }
      } catch {
        continue;
      }
      if (!xObject || !(xObject instanceof PDFDict)) continue;

      for (const [nameKey, ref] of xObject.entries()) {
        if (figures.length >= VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_DOC) {
          break;
        }

        const currentCountOnPage = figuresPerPage.get(pageNumber) || 0;
        if (currentCountOnPage >= VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_PAGE) {
          break;
        }

        const stream = pdfDoc.context.lookup(ref);
        if (
          !stream ||
          (!(stream instanceof PDFStream) && !(stream instanceof PDFRawStream)) ||
          !stream.dict
        ) {
          continue;
        }

        const dict = stream.dict;

        // Verify Subtype is /Image. Safely ignore /Form XObjects or other subtypes.
        const subtype = dict.lookup(PDFName.of("Subtype"));
        if (!subtype || subtype.toString() !== "/Image") {
          continue;
        }

        // Dimensions
        const widthObj = dict.lookup(PDFName.of("Width"));
        const heightObj = dict.lookup(PDFName.of("Height"));
        const width = widthObj instanceof PDFNumber ? widthObj.asNumber() : Number(widthObj || 0);
        const height = heightObj instanceof PDFNumber ? heightObj.asNumber() : Number(heightObj || 0);

        // Filter out icons, glyphs, and tiny spacers
        if (
          width < VISUAL_PROCESSING_LIMITS.MIN_IMAGE_DIMENSION ||
          height < VISUAL_PROCESSING_LIMITS.MIN_IMAGE_DIMENSION
        ) {
          continue;
        }

        // Stream byte content
        let streamBytes: Uint8Array;
        try {
          streamBytes = stream.getContents();
        } catch (streamErr: any) {
          figures.push({
            figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
            page: pageNumber,
            status: "failed",
            processingError: `Failed to retrieve image stream bytes: ${streamErr?.message || streamErr}`,
          });
          figuresPerPage.set(pageNumber, currentCountOnPage + 1);
          continue;
        }

        const streamBuffer = Buffer.from(streamBytes);

        // Enforce maximum size limit
        if (streamBuffer.length > VISUAL_PROCESSING_LIMITS.MAX_IMAGE_SIZE_BYTES) {
          figures.push({
            figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
            page: pageNumber,
            status: "failed",
            processingError: `Image stream exceeds size limit of ${VISUAL_PROCESSING_LIMITS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB`,
          });
          figuresPerPage.set(pageNumber, currentCountOnPage + 1);
          continue;
        }

        // ColorSpace
        const colorSpaceObj = dict.lookup(PDFName.of("ColorSpace"));
        let colorSpaceName = "DeviceRGB";
        if (colorSpaceObj) {
          const rawCs = colorSpaceObj.toString().replace(/^\//, "");
          if (rawCs.includes("DeviceGray") || rawCs === "DeviceGray") {
            colorSpaceName = "DeviceGray";
          } else if (rawCs.includes("DeviceRGB") || rawCs === "DeviceRGB") {
            colorSpaceName = "DeviceRGB";
          } else {
            colorSpaceName = rawCs;
          }
        }

        // BitsPerComponent
        const bitsPerCompObj = dict.lookup(PDFName.of("BitsPerComponent"));
        const bitsPerComponent =
          bitsPerCompObj instanceof PDFNumber
            ? bitsPerCompObj.asNumber()
            : bitsPerCompObj
            ? Number(bitsPerCompObj)
            : 8;

        // Filter
        const filterObj = dict.lookup(PDFName.of("Filter"));
        let filterName = "";
        if (filterObj instanceof PDFName) {
          filterName = filterObj.asString().replace(/^\//, "");
        } else if (filterObj instanceof PDFArray) {
          figures.push({
            figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
            page: pageNumber,
            status: "failed",
            processingError: "Chained or compound image filters are not supported",
          });
          figuresPerPage.set(pageNumber, currentCountOnPage + 1);
          continue;
        } else if (filterObj) {
          filterName = filterObj.toString().replace(/^\//, "");
        }

        let imageBuffer: Buffer | undefined;
        let mimeType: string | undefined;

        try {
          if (filterName === "DCTDecode" || filterName === "DCT") {
            // JPEG: Verify authentic SOI and EOI markers
            const startIdx = streamBuffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
            const endIdx = streamBuffer.lastIndexOf(Buffer.from([0xff, 0xd9]));
            if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
              throw new Error("Invalid JPEG stream: missing authentic SOI (0xFFD8) or EOI (0xFFD9) markers");
            }
            imageBuffer = streamBuffer.subarray(startIdx, endIdx + 2);
            mimeType = "image/jpeg";
          } else if (filterName === "FlateDecode" || filterName === "Flate") {
            if (colorSpaceName !== "DeviceRGB" && colorSpaceName !== "DeviceGray") {
              figures.push({
                figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
                page: pageNumber,
                status: "failed",
                processingError: `Unsupported image color space /${colorSpaceName}`,
              });
              figuresPerPage.set(pageNumber, currentCountOnPage + 1);
              continue;
            }

            if (bitsPerComponent !== 8) {
              figures.push({
                figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
                page: pageNumber,
                status: "failed",
                processingError: `Unsupported bit depth ${bitsPerComponent} (only 8-bit supported)`,
              });
              figuresPerPage.set(pageNumber, currentCountOnPage + 1);
              continue;
            }

            // Decompress Flate stream
            let decompressed: Buffer;
            try {
              decompressed = zlib.inflateSync(streamBuffer);
            } catch {
              decompressed = zlib.inflateRawSync(streamBuffer);
            }

            // Inspect and validate DecodeParms values
            const isRgb = colorSpaceName === "DeviceRGB";
            let predictor = 1;
            let columns = width;
            let colors = isRgb ? 3 : 1;
            let decodeBitsPerComponent = bitsPerComponent;

            let decodeParms = dict.lookup(PDFName.of("DecodeParms"));
            if (decodeParms && !(decodeParms instanceof PDFDict)) {
              decodeParms = pdfDoc.context.lookup(decodeParms) as any;
            }
            if (decodeParms instanceof PDFDict) {
              const predObj = decodeParms.lookup(PDFName.of("Predictor"));
              if (predObj instanceof PDFNumber) {
                predictor = predObj.asNumber();
              } else if (predObj) {
                predictor = Number(predObj);
              }

              const colObj = decodeParms.lookup(PDFName.of("Columns"));
              if (colObj instanceof PDFNumber) {
                columns = colObj.asNumber();
              } else if (colObj) {
                columns = Number(colObj);
              }

              const colorObj = decodeParms.lookup(PDFName.of("Colors"));
              if (colorObj instanceof PDFNumber) {
                colors = colorObj.asNumber();
              } else if (colorObj) {
                colors = Number(colorObj);
              }

              const bitsObj = decodeParms.lookup(PDFName.of("BitsPerComponent"));
              if (bitsObj instanceof PDFNumber) {
                decodeBitsPerComponent = bitsObj.asNumber();
              } else if (bitsObj) {
                decodeBitsPerComponent = Number(bitsObj);
              }
            }

            // Strict DecodeParms validation
            if (colors !== (isRgb ? 3 : 1)) {
              figures.push({
                figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
                page: pageNumber,
                status: "failed",
                processingError: `DecodeParms Colors (${colors}) does not match ColorSpace (${colorSpaceName})`,
              });
              figuresPerPage.set(pageNumber, currentCountOnPage + 1);
              continue;
            }

            if (columns !== width) {
              figures.push({
                figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
                page: pageNumber,
                status: "failed",
                processingError: `DecodeParms Columns (${columns}) does not match Image Width (${width})`,
              });
              figuresPerPage.set(pageNumber, currentCountOnPage + 1);
              continue;
            }

            if (decodeBitsPerComponent !== 8) {
              figures.push({
                figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
                page: pageNumber,
                status: "failed",
                processingError: `Unsupported bit depth ${decodeBitsPerComponent} in DecodeParms (only 8-bit supported)`,
              });
              figuresPerPage.set(pageNumber, currentCountOnPage + 1);
              continue;
            }

            // Decode predictor into raw pixel bytes
            const rawPixels = decodePdfPredictor(
              decompressed,
              predictor,
              width,
              height,
              colors,
              decodeBitsPerComponent
            );

            imageBuffer = encodeRawToPng(
              width,
              height,
              rawPixels,
              colorSpaceName as "DeviceRGB" | "DeviceGray"
            );
            mimeType = "image/png";
          } else {
            // Unsupported image compression filter
            figures.push({
              figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
              page: pageNumber,
              status: "failed",
              processingError: `Unsupported image compression algorithm /${filterName || "None"}`,
            });
            figuresPerPage.set(pageNumber, currentCountOnPage + 1);
            continue;
          }
        } catch (decodeErr: any) {
          figures.push({
            figureId: `fig-p${pageNumber}-${currentCountOnPage + 1}`,
            page: pageNumber,
            status: "failed",
            processingError: `Failed to decode image data stream: ${decodeErr?.message || decodeErr}`,
          });
          figuresPerPage.set(pageNumber, currentCountOnPage + 1);
          continue;
        }

        // Genuine caption matching from page text
        let figureId = `fig-p${pageNumber}-${currentCountOnPage + 1}`;
        let title: string | undefined;
        let caption: string | undefined;

        const pageText = pageTextMap?.get(pageNumber) || "";
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
          page: pageNumber,
          title,
          caption,
          buffer: imageBuffer,
          mimeType,
          width,
          height,
          sizeBytes: imageBuffer.length,
          status: "extracted",
        });

        figuresPerPage.set(pageNumber, currentCountOnPage + 1);
      }
    }

    return figures;
  }
}

export const visualService = new VisualService();
