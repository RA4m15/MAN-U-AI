import {
  WorkerAnswerDTO,
  WorkerCannotVerifyDTO,
  WorkerResponseDTO,
  WorkerLanguage,
  WorkerAnswerSchema,
  ManualSentenceDTO,
  splitTextIntoManualSentences,
  matchStepToSourceSentence,
  WorkerCannotVerifySchema,
} from "@man-u-ai/shared";
import { ANSWER_LIMITS } from "../config/limits";
import type { ScoredChunk } from "./vector.service";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedAnswer?: WorkerResponseDTO;
  softJargonViolations?: string[];
}

export class AnswerValidatorService {
  private readonly bannedPhrases = [
    "ensure that",
    "prior to",
    "in accordance with",
    "it is recommended",
    "pursuant to",
    "whereas",
    "please note that",
    "as per manufacturer",
  ];

  /**
   * Counts words in a string accurately across English, Hindi, and Hinglish.
   */
  countWords(text?: string | null): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Validates a worker response against all rules in Section 10 of the brief.
   */
  validate(
    data: any,
    retrievedChunks: ScoredChunk[],
    expectedLanguage: WorkerLanguage,
    isSimpler: boolean = false,
    requestId?: string
  ): ValidationResult {
    if (!data || typeof data !== "object") {
      return { valid: false, error: "Output is not a valid JSON object." };
    }

    // 1. Status Check & Schema Parsing
    if (data.status === "cannot_verify") {
      const parsed = WorkerCannotVerifySchema.safeParse(data);
      if (!parsed.success) {
        return {
          valid: false,
          error: `Invalid cannot_verify schema: ${parsed.error.message}`,
        };
      }
      return { valid: true, sanitizedAnswer: parsed.data };
    }

    const parsed = WorkerAnswerSchema.safeParse(data);
    if (!parsed.success) {
      return {
        valid: false,
        error: `Invalid answer schema: ${parsed.error.message}`,
      };
    }
    const answer = parsed.data;

    // 2. Language Check
    if (answer.language !== expectedLanguage) {
      // Soft-correct or validate
      console.warn(
        `[AnswerValidator] [Req: ${requestId}] Expected language ${expectedLanguage}, got ${answer.language}`
      );
    }

    // 3. Length & Limit Checks
    const maxHeadline = isSimpler
      ? ANSWER_LIMITS.SIMPLER_HEADLINE_MAX_WORDS
      : ANSWER_LIMITS.HEADLINE_MAX_WORDS;
    const maxStepsCount = isSimpler
      ? ANSWER_LIMITS.SIMPLER_STEPS_MAX_COUNT
      : ANSWER_LIMITS.STEPS_MAX_COUNT;
    const maxStepWords = isSimpler
      ? ANSWER_LIMITS.SIMPLER_STEP_MAX_WORDS
      : ANSWER_LIMITS.STEP_MAX_WORDS;

    if (this.countWords(answer.headline) > maxHeadline) {
      return {
        valid: false,
        error: `Headline exceeds ${maxHeadline} words (has ${this.countWords(answer.headline)} words).`,
      };
    }

    if (answer.steps.length > maxStepsCount && !answer.has_more_steps) {
      // Truncate to max steps and set has_more_steps = true
      answer.all_steps = [...answer.steps];
      answer.steps = answer.steps.slice(0, maxStepsCount);
      answer.has_more_steps = true;
    }

    for (const step of answer.steps) {
      if (this.countWords(step.text) > maxStepWords + 5) { // allow small flexibility before hard failing
        return {
          valid: false,
          error: `Step ${step.n} exceeds word limit (${this.countWords(step.text)} words: "${step.text}").`,
        };
      }
    }

    for (const warn of answer.warnings) {
      if (this.countWords(warn.text) > ANSWER_LIMITS.WARNING_MAX_WORDS + 4) {
        return {
          valid: false,
          error: `Warning exceeds word limit (${this.countWords(warn.text)} words: "${warn.text}").`,
        };
      }
    }

    // Calculate total visible words
    let totalVisibleWords = this.countWords(answer.headline);
    for (const w of answer.warnings) totalVisibleWords += this.countWords(w.text);
    for (const s of answer.steps) totalVisibleWords += this.countWords(s.text);
    for (const v of answer.values) {
      totalVisibleWords += this.countWords(v.label) + this.countWords(v.value) + this.countWords(v.unit);
    }

    if (totalVisibleWords > ANSWER_LIMITS.ANSWER_MAX_WORDS + 10) {
      return {
        valid: false,
        error: `Total visible text exceeds ${ANSWER_LIMITS.ANSWER_MAX_WORDS} words (found ${totalVisibleWords} words).`,
      };
    }

    // 4. Source Check
    const validChunkIds = new Set(retrievedChunks.map((r) => r.chunk.id));
    for (const step of answer.steps) {
      if (step.source_id && !validChunkIds.has(step.source_id)) {
        // If source_id wasn't in retrieved set, try matching with primary chunk
        if (retrievedChunks.length > 0) {
          step.source_id = retrievedChunks[0].chunk.id;
        }
      }
    }

    // 5. Number Guard: Check values and numbers with units against source text
    const chunksText = retrievedChunks.map((r) => r.chunk.text).join(" ");
    const chunkMap = new Map<string, string>();
    for (const r of retrievedChunks) {
      chunkMap.set(r.chunk.id, r.chunk.text);
    }

    for (const val of answer.values) {
      const sourcePassage = (val.source_id && chunkMap.get(val.source_id)) || chunksText;
      const cleanVal = val.value.replace(/[^0-9.]/g, "");
      if (cleanVal.length > 0 && !sourcePassage.includes(cleanVal)) {
        return {
          valid: false,
          error: `Number Guard Failed: Value "${val.value}" (${val.label}) does not appear in referenced source passage.`,
        };
      }
    }

    // 6. Warning Carry-over Check
    const hasHazardSource = retrievedChunks.some(
      (r) =>
        r.chunk.safetyCategory === "hazard_warning" ||
        r.chunk.safetyCategory === "loto_isolation" ||
        /\b(danger|warning|caution|hazard|lockout|loto)\b/i.test(r.chunk.text)
    );

    if (hasHazardSource && answer.warnings.length === 0) {
      // Carry over a warning from the safety chunk
      const safetyChunk = retrievedChunks.find(
        (r) =>
          r.chunk.safetyCategory === "hazard_warning" ||
          r.chunk.safetyCategory === "loto_isolation" ||
          /\b(danger|warning|caution|hazard|lockout|loto)\b/i.test(r.chunk.text)
      );
      if (safetyChunk) {
        answer.warnings.push({
          text: safetyChunk.chunk.text.slice(0, 80).replace(/\n/g, " "),
          source_id: safetyChunk.chunk.id,
        });
      }
    }

    // 7. Soft Jargon Check
    const softViolations: string[] = [];
    const allText = `${answer.headline} ${answer.steps.map((s) => s.text).join(" ")}`.toLowerCase();
    for (const phrase of this.bannedPhrases) {
      if (allText.includes(phrase)) {
        softViolations.push(phrase);
      }
    }
    if (softViolations.length > 0) {
      console.warn(
        `[AnswerValidator] [Req: ${requestId}] Soft jargon violations detected: ${softViolations.join(", ")}`
      );
    }

    // 8. Step-to-Source Sentence Mapping & Fidelity Linker
    if (!answer.manual_sentences || answer.manual_sentences.length === 0) {
      let sentCount = 1;
      const generatedSentences: ManualSentenceDTO[] = [];
      for (const r of retrievedChunks) {
        const chunkSentences = splitTextIntoManualSentences(r.chunk.text, {
          source_id: r.chunk.id,
          documentTitle: r.chunk.documentTitle,
          page: r.chunk.page,
          startIdIndex: sentCount,
        });
        sentCount += chunkSentences.length;
        generatedSentences.push(...chunkSentences);
      }
      answer.manual_sentences = generatedSentences;
      if (!answer.manual_text && generatedSentences.length > 0) {
        answer.manual_text = generatedSentences.map((s) => s.text).join(" ");
      }
    }

    if (answer.manual_sentences && answer.manual_sentences.length > 0) {
      const validSentenceIds = new Set(answer.manual_sentences.map((s) => s.id));
      for (const step of answer.steps) {
        if (!step.source_sentence_id || !validSentenceIds.has(step.source_sentence_id)) {
          step.source_sentence_id = matchStepToSourceSentence(
            step.text,
            answer.manual_sentences,
            step.source_id
          );
        }
      }
      if (answer.all_steps) {
        for (const step of answer.all_steps) {
          if (!step.source_sentence_id || !validSentenceIds.has(step.source_sentence_id)) {
            step.source_sentence_id = matchStepToSourceSentence(
              step.text,
              answer.manual_sentences,
              step.source_id
            );
          }
        }
      }
    }

    return {
      valid: true,
      sanitizedAnswer: answer,
      softJargonViolations: softViolations,
    };
  }
}

export const answerValidator = new AnswerValidatorService();
