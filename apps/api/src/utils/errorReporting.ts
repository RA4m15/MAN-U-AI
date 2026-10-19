import { Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { sanitizeError } from "../routes/settings.routes";

export interface ExtractedErrorInfo {
  errorName: string;
  errorMessage: string;
  sanitizedMessage: string;
  errorCode: string;
  httpStatus: number;
  stage: string;
  requestId: string;
  stack?: string;
}

/**
 * Extracts structured, sanitized error details from Error instances, plain objects,
 * nested causes, or unknown thrown values without using unhelpful String(object) conversion.
 */
export function extractStructuredErrorInfo(
  err: unknown,
  stage = "unknown",
  req?: Request
): ExtractedErrorInfo {
  const requestId =
    (req as any)?.id ||
    (typeof req?.headers?.["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined) ||
    `req-${uuidv4().slice(0, 8)}`;

  let errorName = "Error";
  let rawMessage = "An unexpected error occurred during processing";
  let errorCode = "UPLOAD_FAILED";
  let httpStatus = 500;
  let stack: string | undefined;

  if (err instanceof Error) {
    errorName = err.name || "Error";
    rawMessage = err.message || "Error without message";
    stack = err.stack;
    if ("code" in err && typeof (err as any).code === "string") {
      errorCode = (err as any).code;
    }
    if ("httpStatus" in err && typeof (err as any).httpStatus === "number") {
      httpStatus = (err as any).httpStatus;
    } else if ("status" in err && typeof (err as any).status === "number") {
      httpStatus = (err as any).status;
    }
  } else if (typeof err === "object" && err !== null) {
    // Handle Cloudinary-style error objects or plain objects: { message: "...", http_code: 401 }
    const obj = err as Record<string, any>;
    errorName = typeof obj.name === "string" ? obj.name : "StorageProviderError";

    if (typeof obj.message === "string") {
      rawMessage = obj.message;
    } else if (typeof obj.error === "string") {
      rawMessage = obj.error;
    } else if (obj.error && typeof obj.error.message === "string") {
      rawMessage = obj.error.message;
    } else {
      try {
        rawMessage = JSON.stringify(obj);
      } catch {
        rawMessage = "Complex error object";
      }
    }

    if (typeof obj.code === "string") {
      errorCode = obj.code;
    }
    if (typeof obj.http_code === "number") {
      httpStatus = obj.http_code;
    } else if (typeof obj.status === "number") {
      httpStatus = obj.status;
    } else if (typeof obj.statusCode === "number") {
      httpStatus = obj.statusCode;
    }
  } else if (typeof err === "string") {
    errorName = "StringError";
    rawMessage = err;
  } else {
    errorName = "PrimitiveError";
    rawMessage = String(err);
  }

  // Sanitize the message so credentials, tokens, URLs, and paths are redacted
  const sanitizedMessage = sanitizeError(rawMessage);

  // Map upstream status codes appropriately
  if (httpStatus === 401 || httpStatus === 403) {
    errorCode = "STORAGE_PROVIDER_AUTH_FAILED";
    httpStatus = 502; // Upstream storage provider auth failure is 502 Bad Gateway
  } else if (httpStatus === 404) {
    errorCode = "STORAGE_RESOURCE_NOT_FOUND";
    httpStatus = 404;
  } else if (httpStatus === 400) {
    errorCode = "STORAGE_BAD_REQUEST";
    httpStatus = 400;
  } else if (httpStatus === 503) {
    errorCode = "STORAGE_UNAVAILABLE";
    httpStatus = 503;
  } else if (httpStatus >= 500 && errorCode === "INTERNAL_ERROR") {
    errorCode = "UPLOAD_FAILED";
    httpStatus = 500;
  }

  return {
    errorName,
    errorMessage: rawMessage,
    sanitizedMessage,
    errorCode,
    httpStatus,
    stage,
    requestId,
    stack: stack ? sanitizeError(stack) : undefined,
  };
}

/**
 * Writes a structured error log entry with request correlation ID, pipeline stage,
 * and sanitized stack trace without leaking sensitive credentials or raw file data.
 */
export function logStructuredError(info: ExtractedErrorInfo, context?: Record<string, any>): void {
  try {
    const contextEntries: string[] = [];
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        if (v !== undefined && v !== null) {
          contextEntries.push(`${k}=${typeof v === "object" ? JSON.stringify(v) : v}`);
        }
      }
    }
    const contextStr = contextEntries.length > 0 ? ` [${contextEntries.join(", ")}]` : "";

    console.error(
      `[Upload Pipeline Failure] [Request ID: ${info.requestId}] [Stage: ${info.stage}] [${info.errorName} - ${info.errorCode} (HTTP ${info.httpStatus})]: ${info.sanitizedMessage}${contextStr}`
    );
    if (info.stack) {
      console.error(`[Upload Pipeline Failure] [Request ID: ${info.requestId}] Stack:\n${info.stack}`);
    }
  } catch (logErr) {
    try {
      console.error("[Upload Pipeline Failure] (Fallback log):", info.sanitizedMessage);
    } catch {
      // ignore
    }
  }
}
