import { OfficeParser } from "officeparser";

const MAX_QUESTIONS = 20;
const MAX_TEXT_LENGTH = 100_000;

export async function extractQuizText(file) {
  const extension = file.originalname.toLowerCase().split(".").pop();
  if (extension === "txt") return file.buffer.toString("utf8");

  const ast = await OfficeParser.parseOffice(file.buffer, {
    fileType: extension,
    allowRemoteAssets: false,
    ocr: false,
    extractAttachments: false,
    includeFormatting: false,
    ignoreHeadersAndFooters: true,
    ignoreNotes: true,
    decompressionLimits: {
      maxUncompressedBytes: 32 * 1024 * 1024,
      maxZipEntries: 500,
      maxXmlElements: 250_000,
      maxTableCells: 20_000,
    },
    pdfParserConfig: {
      maxTextItems: 20_000,
      maxOperators: 100_000,
      maxTimeMs: 10_000,
      separateProcess: true,
      processMemoryMb: 512,
    },
  });
  return (await ast.to("text")).value;
}

export function parseQuizText(text) {
  if (typeof text !== "string" || !text.trim())
    throw new Error("No selectable text was found in this document.");
  if (text.length > MAX_TEXT_LENGTH)
    throw new Error("The extracted text is too long to import.");

  const questions = [];
  let current = null;
  let activeField = null;
  const finish = () => {
    if (!current) return;
    current.prompt = current.prompt.join(" ").trim();
    current.explanation = current.explanation.join(" ").trim();
    if (!current.prompt)
      throw new Error(`Question ${questions.length + 1} has no question text.`);
    if (current.prompt.length > 1000)
      throw new Error(
        `Question ${questions.length + 1} is longer than 1,000 characters.`,
      );
    if (current.choices.length < 2 || current.choices.length > 8)
      throw new Error(
        `Question ${questions.length + 1} must have 2 to 8 choices.`,
      );
    if (
      current.choices.some((choice) => !choice.text || choice.text.length > 250)
    )
      throw new Error(
        `Question ${questions.length + 1} choices must be 1 to 250 characters.`,
      );
    if (current.explanation.length > 1000)
      throw new Error(
        `Question ${questions.length + 1} explanation is longer than 1,000 characters.`,
      );
    const answerIndex = current.answerLabel
      ? current.choices.findIndex(
          (choice) => choice.label === current.answerLabel,
        )
      : -1;
    if (answerIndex < 0)
      throw new Error(
        `Question ${questions.length + 1} needs an Answer: line with a choice letter.`,
      );
    questions.push({
      type: "multiple-choice",
      prompt: current.prompt,
      choices: current.choices.map((choice) => choice.text),
      answer: current.choices[answerIndex].text,
      points: current.points,
      ...(current.explanation ? { explanation: current.explanation } : {}),
    });
  };

  for (const [lineIndex, sourceLine] of text
    .replace(/\r/g, "")
    .split("\n")
    .entries()) {
    const line = sourceLine.trim();
    if (!line) continue;
    const questionMatch = line.match(
      /^(?:Q(?:uestion)?\s*\d*\s*[:.)-])\s*(.*)$/i,
    );
    if (questionMatch) {
      finish();
      if (questions.length >= MAX_QUESTIONS)
        throw new Error(
          `A quiz can contain at most ${MAX_QUESTIONS} questions.`,
        );
      current = {
        prompt: questionMatch[1] ? [questionMatch[1]] : [],
        choices: [],
        answerLabel: "",
        explanation: [],
        points: 1,
      };
      activeField = "prompt";
      continue;
    }
    if (!current)
      throw new Error(
        `Line ${lineIndex + 1}: start each question with “Q:” or “Question 1:”.`,
      );

    const choiceMatch = line.match(/^([A-H])[.)]\s+(.+)$/i);
    if (choiceMatch) {
      const label = choiceMatch[1].toUpperCase();
      if (current.choices.some((choice) => choice.label === label))
        throw new Error(
          `Question ${questions.length + 1} repeats choice ${label}.`,
        );
      current.choices.push({ label, text: choiceMatch[2].trim() });
      activeField = "choice";
      continue;
    }
    const answerMatch = line.match(
      /^(?:Answer|Correct\s+answer)\s*:\s*([A-H])(?:[.)])?\s*$/i,
    );
    if (answerMatch) {
      current.answerLabel = answerMatch[1].toUpperCase();
      activeField = "answer";
      continue;
    }
    const pointsMatch = line.match(/^Points?\s*:\s*(\d+)\s*$/i);
    if (pointsMatch) {
      current.points = Number(pointsMatch[1]);
      if (current.points < 1 || current.points > 100)
        throw new Error(
          `Question ${questions.length + 1} points must be from 1 to 100.`,
        );
      activeField = "points";
      continue;
    }
    const explanationMatch = line.match(/^Explanation\s*:\s*(.*)$/i);
    if (explanationMatch) {
      if (explanationMatch[1]) current.explanation.push(explanationMatch[1]);
      activeField = "explanation";
      continue;
    }
    if (activeField === "prompt") current.prompt.push(line);
    else if (activeField === "choice" && current.choices.length)
      current.choices[current.choices.length - 1].text += ` ${line}`;
    else if (activeField === "explanation") current.explanation.push(line);
    else
      throw new Error(
        `Line ${lineIndex + 1}: use Q:, A./B./C./D., Answer:, Points: or Explanation: labels.`,
      );
  }
  finish();
  if (!questions.length)
    throw new Error("No questions were found. Use the displayed quiz format.");
  return questions;
}
