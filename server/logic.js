export function formatStudentId(year, programCode, sequence) {
  return `${year}-${programCode.toUpperCase()}-${String(sequence).padStart(4, "0")}`;
}

export function getLessonStatus({ completed, granted, first }) {
  if (completed) return "completed";
  return granted || first ? "available" : "locked";
}

export function quizPasses(percent, passingPercent) {
  return percent >= passingPercent;
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function quizExpiresAt(startedAt, timeLimitMinutes) {
  if (!timeLimitMinutes) return null;
  return new Date(new Date(startedAt).getTime() + timeLimitMinutes * 60_000);
}

export function quizIsExpired(startedAt, timeLimitMinutes, now = new Date()) {
  const expiresAt = quizExpiresAt(startedAt, timeLimitMinutes);
  return Boolean(expiresAt && new Date(now) >= expiresAt);
}

export function calculateCourseGrade({ quizScores, otherGrades, weights }) {
  const components = [];
  if (quizScores.length) {
    components.push({
      average: quizScores.reduce((total, score) => total + score, 0) / quizScores.length,
      weight: weights.quiz,
    });
  }
  if (otherGrades.length) {
    const average =
      otherGrades.reduce((total, grade) => total + grade.score / grade.maxScore, 0) /
      otherGrades.length;
    components.push({ average: average * 100, weight: weights.other });
  }
  const availableWeight = components.reduce((total, item) => total + item.weight, 0);
  if (!availableWeight) return null;
  const score = components.reduce((total, item) => total + item.average * item.weight, 0) / availableWeight;
  return Math.round(score * 100) / 100;
}

export function evaluateQuiz(questions, answers) {
  const answerMap = new Map(
    answers.map((item) => [item.questionId, item.answer.trim()]),
  );
  let earnedPoints = 0;
  const totalPoints = questions.reduce(
    (total, question) => total + question.points,
    0,
  );
  const results = questions.map((question) => {
    const submitted = answerMap.get(String(question._id)) || "";
    const correct =
      question.type === "short-answer"
        ? submitted.toLocaleLowerCase() ===
          question.answer.trim().toLocaleLowerCase()
        : submitted === question.answer;
    if (correct) earnedPoints += question.points;
    return {
      questionId: String(question._id),
      correct,
      ...(question.explanation ? { explanation: question.explanation } : {}),
    };
  });
  return {
    earnedPoints,
    totalPoints,
    percent: totalPoints
      ? Math.round((earnedPoints * 10000) / totalPoints) / 100
      : 0,
    results,
  };
}
