import {
  AccessGrant,
  Attempt,
  Lesson,
  Progress,
  Quiz,
} from "./models/index.js";
import { studentOffering } from "./middleware.js";

export async function studentCanAccessLesson(lesson, studentId) {
  const offering = await studentOffering(lesson.offering, studentId);
  if (!offering || !lesson.published) return false;

  const lessonId = lesson._id || lesson.id;
  if (!(await Quiz.exists({ lesson: lessonId, published: true }))) return false;

  const firstLesson = await Lesson.findOne({ offering: lesson.offering })
    .sort("sequence")
    .select("_id")
    .lean();
  if (!firstLesson) return false;

  if (String(firstLesson._id) !== String(lessonId)) {
    const previousLesson = await Lesson.findOne({
      offering: lesson.offering,
      sequence: { $lt: lesson.sequence },
    })
      .sort("-sequence")
      .select("_id published")
      .lean();
    if (!previousLesson?.published) return false;

    const previousQuiz = await Quiz.findOne({
      lesson: previousLesson._id,
      published: true,
    })
      .select("_id")
      .lean();
    if (!previousQuiz) return false;

    const previousProgress = await Progress.findOne({
      student: studentId,
      offering: lesson.offering,
      lesson: previousLesson._id,
    })
      .select("resetAt")
      .lean();
    const passed = await Attempt.exists({
      student: studentId,
      offering: lesson.offering,
      quiz: previousQuiz._id,
      passed: true,
      ...(previousProgress?.resetAt
        ? { submittedAt: { $gt: previousProgress.resetAt } }
        : {}),
    });
    if (!passed) return false;
  }

  try {
    await AccessGrant.updateOne(
      { student: studentId, offering: lesson.offering, lesson: lessonId },
      {
        $setOnInsert: {
          student: studentId,
          offering: lesson.offering,
          lesson: lessonId,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return true;
}
