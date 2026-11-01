import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCourseGrade,
  evaluateQuiz,
  formatStudentId,
  getLessonStatus,
  quizExpiresAt,
  quizIsExpired,
  quizPasses,
  shuffle,
} from "./logic.js";

test("student ID includes entry year and program and pads the atomic sequence", () => {
  assert.equal(formatStudentId(2026, "bsit", 1), "2026-BSIT-0001");
  assert.equal(formatStudentId(2027, "BSCS", 28), "2027-BSCS-0028");
});

test("lesson access is granted to the first lesson and explicit earned grants", () => {
  assert.equal(
    getLessonStatus({ completed: false, granted: false, first: true }),
    "available",
  );
  assert.equal(
    getLessonStatus({ completed: false, granted: true, first: false }),
    "available",
  );
  assert.equal(
    getLessonStatus({ completed: false, granted: false, first: false }),
    "locked",
  );
  assert.equal(
    getLessonStatus({ completed: true, granted: false, first: false }),
    "completed",
  );
});

test("reordering does not unlock a lesson that has no student grant", () => {
  const reorderedLesson = { completed: false, granted: false, first: false };
  assert.equal(getLessonStatus(reorderedLesson), "locked");
});

test("quiz scoring uses server answer keys and rounds to a percentage", () => {
  const quiz = [
    { _id: "q1", type: "multiple-choice", answer: "A", points: 3 },
    { _id: "q2", type: "short-answer", answer: "Mercury", points: 1 },
  ];
  assert.deepEqual(
    evaluateQuiz(quiz, [
      { questionId: "q1", answer: "A" },
      { questionId: "q2", answer: "mercury" },
    ]),
    {
      earnedPoints: 4,
      totalPoints: 4,
      percent: 100,
      results: [
        { questionId: "q1", correct: true },
        { questionId: "q2", correct: true },
      ],
    },
  );
});

test("incorrect quiz answers retain the configured point weighting", () => {
  const result = evaluateQuiz(
    [
      { _id: "q1", type: "true-false", answer: "True", points: 3 },
      { _id: "q2", type: "short-answer", answer: "Mercury", points: 1 },
    ],
    [{ questionId: "q1", answer: "False" }],
  );
  assert.equal(result.earnedPoints, 0);
  assert.equal(result.percent, 0);
  assert.equal(
    result.results.every((item) => !item.correct),
    true,
  );
});

test("quiz passing uses the faculty threshold inclusively", () => {
  assert.equal(quizPasses(75, 75), true);
  assert.equal(quizPasses(74, 75), false);
  assert.equal(quizPasses(74.5, 75), false);
  assert.equal(quizPasses(90, 75), true);
});

test("quiz expiry is measured from the server session start", () => {
  const startedAt = new Date("2026-11-01T01:00:00.000Z");
  assert.equal(
    quizExpiresAt(startedAt, 30).toISOString(),
    "2026-11-01T01:30:00.000Z",
  );
  assert.equal(
    quizIsExpired(startedAt, 30, new Date("2026-11-01T01:29:59.000Z")),
    false,
  );
  assert.equal(
    quizIsExpired(startedAt, 30, new Date("2026-11-01T01:30:00.000Z")),
    true,
  );
});

test("shuffle preserves every item and does not mutate the input", () => {
  const input = [1, 2, 3, 4];
  const result = shuffle(input, () => 0);
  assert.deepEqual(input, [1, 2, 3, 4]);
  assert.deepEqual(result, [2, 3, 4, 1]);
  assert.deepEqual([...result].sort(), input);
});

test("course average renormalizes weights while a component has no grades", () => {
  assert.equal(
    calculateCourseGrade({
      quizScores: [80, 100],
      otherGrades: [{ score: 18, maxScore: 20 }],
      weights: { quiz: 70, other: 30 },
    }),
    90,
  );
  assert.equal(
    calculateCourseGrade({
      quizScores: [],
      otherGrades: [{ score: 18, maxScore: 20 }],
      weights: { quiz: 70, other: 30 },
    }),
    90,
  );
  assert.equal(
    calculateCourseGrade({
      quizScores: [],
      otherGrades: [],
      weights: { quiz: 70, other: 30 },
    }),
    null,
  );
});
