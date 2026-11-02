import { describe, it, expect } from "vitest";
import {
  splitTextIntoManualSentences,
  extractNumbersWithUnits,
  matchStepToSourceSentence,
  STEP_SOURCE_COLOR_PALETTE,
  WorkerAnswerDTO,
} from "@man-u-ai/shared";
import { answerValidator } from "../src/services/answer_validator.service";
import type { ScoredChunk } from "../src/services/vector.service";

describe("Step-to-Source Fidelity Lines & Number Verification", () => {
  const sampleManualText =
    "Section 4.2: Hydraulic System Calibration. Disconnect the primary supply line and verify 0 bar residual pressure. Fasten all M8 flange bolts with calibrated torque to 45 Nm in a diagonal pattern. Set relief valve threshold to 12.5 bar before restarting the booster pump.";

  it("splits manual passage into discrete sentences without breaking on decimals or abbreviations", () => {
    const sentences = splitTextIntoManualSentences(sampleManualText, {
      source_id: "chk-hydraulic-1",
      documentTitle: "Hydraulic Maintenance Manual",
      page: 14,
    });

    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences[0].id).toBe("sent-1");
    expect(sentences[0].documentTitle).toBe("Hydraulic Maintenance Manual");
    expect(sentences[0].page).toBe(14);

    // Verify 12.5 bar did not split across the decimal point
    const decimalSentence = sentences.find((s) => s.text.includes("12.5 bar"));
    expect(decimalSentence).toBeDefined();
    expect(decimalSentence?.text).toContain("12.5 bar before restarting");
  });

  it("extracts numbers with units and technical identifiers reliably", () => {
    const extracted = extractNumbersWithUnits(
      "Tighten bolt to 45 Nm, ensure line pressure is 0 bar, max 12.5 bar, speed 1500 RPM, error E17"
    );

    expect(extracted).toContain("45 Nm");
    expect(extracted).toContain("0 bar");
    expect(extracted).toContain("12.5 bar");
    expect(extracted).toContain("1500 RPM");
    expect(extracted).toContain("E17");
  });

  it("links worker step to the faithful manual sentence by matching exact numbers", () => {
    const sentences = splitTextIntoManualSentences(sampleManualText, {
      source_id: "chk-hydraulic-1",
      documentTitle: "Hydraulic Maintenance Manual",
      page: 14,
    });

    // Step has 45 Nm
    const stepWithTorque = "Torque M8 bolts to 45 Nm diagonally";
    const matchedSentId = matchStepToSourceSentence(stepWithTorque, sentences, "chk-hydraulic-1");

    const matchedSentence = sentences.find((s) => s.id === matchedSentId);
    expect(matchedSentence).toBeDefined();
    expect(matchedSentence?.text).toContain("45 Nm");

    // Step with 0 bar
    const stepZeroBar = "Ensure hydraulic pressure reads 0 bar before service";
    const matchedZeroId = matchStepToSourceSentence(stepZeroBar, sentences, "chk-hydraulic-1");
    const matchedZeroSent = sentences.find((s) => s.id === matchedZeroId);
    expect(matchedZeroSent).toBeDefined();
    expect(matchedZeroSent?.text).toContain("0 bar");
  });

  it("AnswerValidatorService enriches answers with manual_sentences and step source_sentence_id", () => {
    const dummyChunks: ScoredChunk[] = [
      {
        score: 0.95,
        chunk: {
          id: "chunk-101",
          documentId: "doc-1",
          documentTitle: "Drive System O&M",
          revision: "rev.3",
          page: 22,
          section: "Torque Specs",
          text: "Always isolate motor before servicing. Tighten main mounting studs to 85 Nm with threadlock.",
          tokenCount: 30,
        },
      },
    ];

    const rawWorkerAnswer: any = {
      status: "answered",
      language: "en",
      headline: "Drive Motor Servicing Procedure",
      warnings: [{ text: "Always isolate motor before servicing", source_id: "chunk-101" }],
      steps: [
        {
          n: 1,
          text: "Isolate motor power supply",
          source_id: "chunk-101",
        },
        {
          n: 2,
          text: "Tighten mounting studs to 85 Nm",
          source_id: "chunk-101",
        },
      ],
      values: [{ label: "Torque", value: "85", unit: "Nm", source_id: "chunk-101" }],
      sources: [{ document: "Drive System O&M", version: "rev.3", page: 22 }],
    };

    const result = answerValidator.validate(rawWorkerAnswer, dummyChunks, "en", false, "req-test-1");
    expect(result.valid).toBe(true);

    const sanitized = result.sanitizedAnswer as WorkerAnswerDTO;
    expect(sanitized.manual_sentences).toBeDefined();
    expect(sanitized.manual_sentences!.length).toBeGreaterThan(0);

    // Verify each step is linked to a source sentence ID
    for (const step of sanitized.steps) {
      expect(step.source_sentence_id).toBeDefined();
      expect(step.source_sentence_id).toMatch(/^sent-/);
    }

    // Step 2 has 85 Nm, so it must link to sentence containing 85 Nm
    const step2 = sanitized.steps.find((s) => s.n === 2);
    const linkedSentence = sanitized.manual_sentences!.find((s) => s.id === step2?.source_sentence_id);
    expect(linkedSentence?.text).toContain("85 Nm");
  });

  it("provides color theme palette for number fidelity matching", () => {
    expect(STEP_SOURCE_COLOR_PALETTE.length).toBeGreaterThanOrEqual(5);
    const amberTheme = STEP_SOURCE_COLOR_PALETTE.find((c) => c.id === "amber");
    expect(amberTheme).toBeDefined();
    expect(amberTheme?.stroke).toBe("#F59E0B");
  });
});
