import { Router } from "express";
import { randomInt } from "node:crypto";
import { z } from "zod";
import {
  AccessGrant,
  AcademicYear,
  Attempt,
  Course,
  Counter,
  EnrollmentRequest,
  FacultyProfile,
  Grade,
  Lesson,
  Offering,
  Progress,
  Program,
  Quiz,
  QuizSession,
  Section,
  StudentProfile,
  User,
} from "../models/index.js";
import {
  allowRoles,
  asyncRoute,
  authenticate,
  fail,
  facultyOffering,
  facultyOfferings,
  studentOffering,
  studentOfferings,
  success,
} from "../middleware.js";
import { studentCanAccessLesson } from "../lesson-access.js";
import {
  evaluateQuiz,
  getLessonStatus,
  quizExpiresAt,
  quizIsExpired,
  quizPasses,
  shuffle,
} from "../logic.js";
import { departmentCode, departments } from "../catalog.js";
import {
  addStudentToOffering,
  COURSE_ENROLLMENT_LIMIT,
} from "../enrollment.js";

const router = Router();
const id = z.string().regex(/^[a-f\d]{24}$/i);
const isValid = (schema, body) => schema.safeParse(body);
const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const createInviteCode = () =>
  Array.from(
    { length: 8 },
    () => inviteAlphabet[randomInt(inviteAlphabet.length)],
  ).join("");

async function studentOfferingEligibility(studentId, offering) {
  const [profile, section] = await Promise.all([
    StudentProfile.findOne({ user: studentId }).populate(
      "program",
      "department",
    ),
    Section.findById(offering.section).populate("program", "department"),
  ]);
  if (!profile?.program || !section?.program)
    return "Your student profile or the course section is incomplete.";
  if (profile.program.department !== section.program.department)
    return "You can only join courses in your department.";
  if (String(profile.program._id) !== String(section.program._id))
    return "This course is for a different degree program.";
  if (profile.currentYearLevel !== section.yearLevel)
    return "This course is for a different year level.";
  return null;
}

router.get(
  "/faculty",
  asyncRoute(async (_req, res) => {
    const profiles = await FacultyProfile.find()
      .populate("user", "firstName middleName lastName")
      .lean();
    const directory = departments.map((department) => ({
      ...department,
      faculty: profiles
        .filter(
          (profile) => profile.department === department.name && profile.user,
        )
        .map((profile) => ({
          id: String(profile.user._id),
          firstName: profile.user.firstName,
          middleName: profile.user.middleName,
          lastName: profile.user.lastName,
        }))
        .sort(
          (a, b) =>
            a.lastName.localeCompare(b.lastName) ||
            a.firstName.localeCompare(b.firstName),
        ),
    }));
    return success(res, directory);
  }),
);

router.use(authenticate);

router.patch(
  "/student-profile/year-level",
  allowRoles("student"),
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({ currentYearLevel: z.string().trim().min(2).max(40) })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, 400, "Choose a valid year level.");
    const profile = await StudentProfile.findOne({
      user: req.user.id,
    }).populate("program", "yearLevels");
    if (!profile?.program)
      return fail(res, 404, "Student profile or degree program not found.");
    if (!profile.program.yearLevels.includes(parsed.data.currentYearLevel))
      return fail(
        res,
        400,
        "Choose a year level available in your degree program.",
      );

    const section = profile.section
      ? await Section.findById(profile.section).select("name yearLevel program")
      : null;
    if (
      profile.section &&
      (!section ||
        section.yearLevel !== parsed.data.currentYearLevel ||
        String(section.program) !== String(profile.program._id))
    )
      profile.section = undefined;
    profile.currentYearLevel = parsed.data.currentYearLevel;
    await profile.save();
    return success(res, {
      currentYearLevel: profile.currentYearLevel,
      section:
        section && profile.section
          ? { id: String(section._id), name: section.name }
          : null,
    });
  }),
);

router.get(
  "/classmates",
  allowRoles("student"),
  asyncRoute(async (req, res) => {
    const enrolled = await studentOfferings(req.user.id);
    const offerings = await Offering.find({
      _id: { $in: enrolled.map((offering) => offering._id) },
    })
      .select("students course section semester academicYear")
      .populate("course", "code title")
      .populate("section", "name yearLevel")
      .populate("academicYear", "label")
      .lean();
    const classmateIds = [
      ...new Set(
        offerings
          .flatMap((offering) => offering.students)
          .map(String)
          .filter((studentId) => studentId !== String(req.user.id)),
      ),
    ];
    const people = await User.find({ _id: { $in: classmateIds } })
      .select("firstName middleName lastName")
      .lean();
    const peopleById = new Map(
      people.map((person) => [String(person._id), person]),
    );
    const data = offerings
      .map((offering) => ({
        id: String(offering._id),
        course: offering.course,
        section: offering.section,
        semester: offering.semester,
        academicYear: offering.academicYear,
        classmates: offering.students
          .map((studentId) => peopleById.get(String(studentId)))
          .filter(Boolean)
          .sort(
            (a, b) =>
              a.lastName.localeCompare(b.lastName) ||
              a.firstName.localeCompare(b.firstName),
          )
          .map((person) => ({
            id: String(person._id),
            firstName: person.firstName,
            middleName: person.middleName,
            lastName: person.lastName,
          })),
      }))
      .sort((a, b) =>
        (a.course?.title || "").localeCompare(b.course?.title || ""),
      );
    return success(res, data);
  }),
);

router.get(
  "/my-enrollment-requests",
  allowRoles("student"),
  asyncRoute(async (req, res) => {
    const requests = await EnrollmentRequest.find({ student: req.user.id })
      .sort("-requestedAt")
      .limit(50)
      .populate({
        path: "offering",
        select: "course section semester academicYear",
        populate: [
          { path: "course", select: "code title" },
          { path: "section", select: "name yearLevel" },
          { path: "academicYear", select: "label" },
        ],
      })
      .lean();
    return success(
      res,
      requests
        .filter((request) => request.offering)
        .map((request) => ({
          id: String(request._id),
          status: request.status,
          requestedAt: request.requestedAt,
          offering: {
            id: String(request.offering._id),
            course: request.offering.course,
            section: request.offering.section,
            semester: request.offering.semester,
            academicYear: request.offering.academicYear,
          },
        })),
    );
  }),
);

router.post(
  "/enrollment-requests",
  allowRoles("student"),
  asyncRoute(async (req, res) => {
    const parsed = z
      .object({
        code: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-HJ-NP-Z2-9]{8}$/),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return fail(res, 400, "Enter a valid 8-character course code.");
    const offering = await Offering.findOne({
      joinCode: parsed.data.code,
    }).select("+joinCode");
    if (!offering)
      return fail(res, 404, "That course code is invalid or expired.");
    if (
      offering.students.some(
        (student) => String(student) === String(req.user.id),
      )
    )
      return fail(res, 409, "You are already enrolled in this course.");
    if (offering.students.length >= COURSE_ENROLLMENT_LIMIT)
      return fail(
        res,
        409,
        `This course is full. It can have up to ${COURSE_ENROLLMENT_LIMIT} students.`,
      );
    const eligibilityError = await studentOfferingEligibility(
      req.user.id,
      offering,
    );
    if (eligibilityError) return fail(res, 403, eligibilityError);
    const existing = await EnrollmentRequest.findOne({
      student: req.user.id,
      offering: offering.id,
    });
    if (existing?.status === "pending")
      return fail(
        res,
        409,
        "Your request is already waiting for faculty approval.",
      );
    if (existing?.status === "approved")
      return fail(res, 409, "You are already enrolled in this course.");
    if (existing) {
      existing.status = "pending";
      existing.requestedAt = new Date();
      existing.reviewedAt = undefined;
      existing.reviewedBy = undefined;
      await existing.save();
      return success(
        res,
        { message: "Your request was sent to the faculty member." },
        200,
      );
    }
    try {
      await EnrollmentRequest.create({
        student: req.user.id,
        offering: offering.id,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      return fail(
        res,
        409,
        "Your enrollment request is already being processed.",
      );
    }
    return success(
      res,
      { message: "Your request was sent to the faculty member." },
      201,
    );
  }),
);

async function reserveAttemptNumber({ studentId, quiz, lesson, resetAt }) {
  const counterKey = `attempt:${studentId}:${quiz.id}:${resetAt?.toISOString() || "initial"}`;
  const attemptWindow = resetAt ? { submittedAt: { $gt: resetAt } } : {};
  const priorCount = await Attempt.countDocuments({
    student: studentId,
    quiz: quiz.id,
    ...attemptWindow,
  });
  for (let retry = 0; retry < 3; retry += 1) {
    let counter = await Counter.findOne({ key: counterKey });
    if (!counter) {
      try {
        counter = await Counter.create({
          key: counterKey,
          sequence: priorCount,
          base: 0,
        });
      } catch (error) {
        if (error.code !== 11000 || retry === 2) throw error;
        continue;
      }
    }
    const reserved = await Counter.findOneAndUpdate(
      { _id: counter._id },
      { $inc: { sequence: 1 } },
      { new: true },
    );
    if (reserved) return reserved.base + reserved.sequence;
  }
  return null;
}

function quizForSession(quiz, session) {
  const quizData = quiz.toObject();
  const orderedIds = session.questionOrder.map(String);
  const questions = new Map(
    quizData.questions.map((question) => [String(question._id), question]),
  );
  const choicesByQuestion = new Map(
    session.choiceOrders.map((item) => [String(item.questionId), item.choices]),
  );
  quizData.questions = orderedIds
    .map((questionId) => questions.get(questionId))
    .filter(Boolean)
    .map(({ answer, explanation, ...question }) => ({
      ...question,
      choices: choicesByQuestion.get(String(question._id)) || question.choices,
    }));
  return quizData;
}

async function recordExpiredAttempt({ session, quiz, lesson, studentId, now }) {
  const expiredSession = await QuizSession.findOneAndDelete({
    _id: session._id,
    student: studentId,
    quiz: quiz._id,
    attemptNumber: { $gt: 0 },
  });
  if (!expiredSession) return null;
  const totalPoints = quiz.questions.reduce(
    (total, question) => total + question.points,
    0,
  );
  return Attempt.create({
    student: studentId,
    quiz: quiz._id,
    offering: lesson.offering,
    answers: [],
    earnedPoints: 0,
    totalPoints,
    percent: 0,
    passed: false,
    timedOut: true,
    submittedAt: now,
  });
}

async function lessonAccess(lesson, studentId) {
  return studentCanAccessLesson(lesson, studentId);
}

async function seedFirstLesson(offeringId, students) {
  if (!students.length) return;
  const first = await Lesson.findOne({ offering: offeringId })
    .sort("sequence")
    .select("_id published")
    .lean();
  if (
    !first?.published ||
    !(await Quiz.exists({ lesson: first._id, published: true }))
  )
    return;
  await Promise.all(
    students.map(async (student) => {
      try {
        await AccessGrant.updateOne(
          { student, offering: offeringId, lesson: first._id },
          {
            $setOnInsert: { student, offering: offeringId, lesson: first._id },
          },
          { upsert: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }),
  );
}

async function firstPublishedLessonWithQuiz(offeringId, afterSequence) {
  const query = {
    offering: offeringId,
    ...(afterSequence === undefined
      ? {}
      : { sequence: { $gt: afterSequence } }),
  };
  const lesson = await Lesson.findOne(query)
    .sort("sequence")
    .select("_id sequence published")
    .lean();
  if (
    !lesson?.published ||
    !(await Quiz.exists({ lesson: lesson._id, published: true }))
  )
    return null;
  return lesson;
}

async function grantNextLesson(lesson, studentId) {
  const nextLesson = await firstPublishedLessonWithQuiz(
    lesson.offering,
    lesson.sequence,
  );
  if (nextLesson)
    await AccessGrant.updateOne(
      { student: studentId, offering: lesson.offering, lesson: nextLesson._id },
      {
        $setOnInsert: {
          student: studentId,
          offering: lesson.offering,
          lesson: nextLesson._id,
          grantedByLesson: lesson.id,
        },
      },
      { upsert: true },
    );
}

router.get(
  "/dashboard",
  asyncRoute(async (req, res) => {
    if (req.user.role === "faculty") {
      const facultyCourses = await facultyOfferings(req.user.id);
      const offerings = await Offering.find({
        _id: { $in: facultyCourses.map((offering) => offering._id) },
      })
        .populate("course", "code title")
        .populate("section", "name yearLevel")
        .populate("academicYear", "label")
        .lean();
      const [lessons, quizzes, attempts, passed, failed] = await Promise.all([
        Lesson.countDocuments({
          offering: { $in: offerings.map((item) => item._id) },
        }),
        Quiz.countDocuments({
          lesson: {
            $in: await Lesson.find({
              offering: { $in: offerings.map((item) => item._id) },
            }).distinct("_id"),
          },
        }),
        Attempt.find({ offering: { $in: offerings.map((item) => item._id) } })
          .sort("-submittedAt")
          .limit(8)
          .populate("student", "firstName lastName")
          .populate("quiz", "lesson")
          .lean(),
        Attempt.countDocuments({
          offering: { $in: offerings.map((item) => item._id) },
          passed: true,
        }),
        Attempt.countDocuments({
          offering: { $in: offerings.map((item) => item._id) },
          passed: false,
        }),
      ]);
      const totalStudents = offerings.reduce(
        (total, item) => total + item.students.length,
        0,
      );
      return success(res, {
        role: "faculty",
        offerings,
        stats: {
          courses: offerings.length,
          students: totalStudents,
          lessons,
          quizzes,
          passed,
          failed,
        },
        recentAttempts: attempts,
      });
    }
    const profile = await StudentProfile.findOne({ user: req.user.id })
      .populate("program", "name code yearLevels")
      .populate("section", "name yearLevel")
      .lean();
    const studentCourses = await studentOfferings(req.user.id);
    const offerings = await Offering.find({
      _id: { $in: studentCourses.map((offering) => offering._id) },
    })
      .select("-students")
      .populate("course", "code title description")
      .populate("academicYear", "label current")
      .populate("section", "name yearLevel")
      .populate("faculty", "firstName lastName")
      .lean();
    const offeringIds = offerings.map((item) => item._id);
    const weekStart = new Date();
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const [
      lessons,
      passingAttempts,
      publishedQuizzes,
      progressResets,
      attempts,
      grades,
      weeklyAttempts,
    ] = await Promise.all([
      Lesson.find({ offering: { $in: offeringIds }, published: true })
        .select("_id offering sequence title")
        .sort("sequence")
        .lean(),
      Attempt.find({
        student: req.user.id,
        offering: { $in: offeringIds },
        passed: true,
      })
        .select("quiz submittedAt")
        .lean(),
      Quiz.find({
        published: true,
        lesson: {
          $in: await Lesson.find({
            offering: { $in: offeringIds },
            published: true,
          }).distinct("_id"),
        },
      })
        .select("_id lesson")
        .lean(),
      Progress.find({
        student: req.user.id,
        offering: { $in: offeringIds },
        resetAt: { $ne: null },
      })
        .select("lesson resetAt")
        .lean(),
      Attempt.find({ student: req.user.id, offering: { $in: offeringIds } })
        .sort("-submittedAt")
        .limit(5)
        .populate("quiz", "lesson")
        .populate({
          path: "quiz",
          populate: { path: "lesson", select: "title" },
        })
        .lean(),
      Grade.find({ student: req.user.id, offering: { $in: offeringIds } })
        .select("offering category title score maxScore")
        .lean(),
      Attempt.find({
        student: req.user.id,
        offering: { $in: offeringIds },
        submittedAt: { $gte: weekStart },
      })
        .select("submittedAt")
        .lean(),
    ]);
    const resetsByLesson = new Map(
      progressResets.map((progress) => [
        String(progress.lesson),
        progress.resetAt,
      ]),
    );
    const lessonsWithQuizzes = lessons.filter((lesson) =>
      publishedQuizzes.some(
        (quiz) => String(quiz.lesson) === String(lesson._id),
      ),
    );
    const completed = lessonsWithQuizzes.filter((lesson) => {
      const quiz = publishedQuizzes.find(
        (item) => String(item.lesson) === String(lesson._id),
      );
      if (!quiz) return false;
      const resetAt = resetsByLesson.get(String(lesson._id));
      return passingAttempts.some(
        (attempt) =>
          String(attempt.quiz) === String(quiz._id) &&
          (!resetAt || new Date(attempt.submittedAt) > new Date(resetAt)),
      );
    });
    const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        day: new Intl.DateTimeFormat("en", {
          weekday: "short",
          timeZone: "UTC",
        }).format(date),
        value: weeklyAttempts.filter(
          (attempt) => attempt.submittedAt.toISOString().slice(0, 10) === key,
        ).length,
      };
    });
    return success(res, {
      role: "student",
      profile,
      offerings,
      progress: {
        total: lessonsWithQuizzes.length,
        completed: completed.length,
        percent: lessonsWithQuizzes.length
          ? Math.round((completed.length * 100) / lessonsWithQuizzes.length)
          : 0,
      },
      recentAttempts: attempts,
      grades,
      weeklyActivity,
    });
  }),
);

router.get(
  "/offerings",
  asyncRoute(async (req, res) => {
    const filter =
      req.user.role === "faculty"
        ? {
            _id: {
              $in: (await facultyOfferings(req.user.id)).map(
                (item) => item._id,
              ),
            },
          }
        : {
            _id: {
              $in: (await studentOfferings(req.user.id)).map(
                (item) => item._id,
              ),
            },
          };
    const offeringRecords = await Offering.find(filter)
      .populate("course", "code title description")
      .populate("academicYear", "label current")
      .populate("section", "name yearLevel")
      .populate("faculty", "firstName lastName")
      .sort("-createdAt")
      .lean();
    const offerings =
      req.user.role === "student"
        ? offeringRecords.map(({ students = [], ...offering }) => ({
            ...offering,
            enrollmentCount: students.length,
          }))
        : offeringRecords;
    return success(res, offerings);
  }),
);

router.post(
  "/programs",
  allowRoles("faculty"),
  asyncRoute(async (_req, res) =>
    fail(res, 403, "Degree programs are centrally managed."),
  ),
);

router.post(
  "/academic-years",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const parsed = isValid(
      z.object({
        label: z.string().regex(/^\d{4}[-–]\d{4}$/),
        current: z.boolean().optional(),
      }),
      req.body,
    );
    if (!parsed.success)
      return fail(res, 400, "Enter an academic year such as 2026–2027.");
    if (parsed.data.current)
      await AcademicYear.updateMany({}, { current: false });
    return success(res, await AcademicYear.create(parsed.data), 201);
  }),
);

router.get(
  "/programs",
  asyncRoute(async (req, res) => {
    let department;
    if (req.user.role === "faculty")
      department = departmentCode(
        (await FacultyProfile.findOne({ user: req.user.id }))?.department,
      );
    else {
      const profile = await StudentProfile.findOne({ user: req.user.id })
        .populate("program", "department")
        .lean();
      department = profile?.program?.department;
    }
    if (!department) return success(res, []);
    return success(
      res,
      await Program.find({ department })
        .select("name code description department yearLevels")
        .sort("code")
        .lean(),
    );
  }),
);
router.get(
  "/academic-years",
  asyncRoute(async (_req, res) =>
    success(
      res,
      await AcademicYear.find().select("label current").sort("-label").lean(),
    ),
  ),
);
router.get(
  "/sections",
  asyncRoute(async (req, res) => {
    let filter;
    if (req.user.role === "faculty") {
      const department = departmentCode(
        (await FacultyProfile.findOne({ user: req.user.id }))?.department,
      );
      const programs = department
        ? await Program.find({ department }).distinct("_id")
        : [];
      filter = { faculty: req.user.id, program: { $in: programs } };
    } else {
      const profile = await StudentProfile.findOne({ user: req.user.id })
        .populate("program", "department")
        .lean();
      const programs = profile?.program?.department
        ? await Program.find({
            department: profile.program.department,
          }).distinct("_id")
        : [];
      filter = { program: { $in: programs } };
    }
    return success(
      res,
      await Section.find(filter)
        .populate("program", "code department")
        .populate("academicYear", "label")
        .select("name yearLevel program academicYear")
        .sort("name")
        .lean(),
    );
  }),
);

router.post(
  "/sections",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const parsed = isValid(
      z.object({
        name: z.string().trim().min(1).max(40),
        program: id,
        yearLevel: z.string().min(2).max(40),
        academicYear: id,
      }),
      req.body,
    );
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
    const [facultyProfile, program, academicYear] = await Promise.all([
      FacultyProfile.findOne({ user: req.user.id }),
      Program.findById(parsed.data.program),
      AcademicYear.findById(parsed.data.academicYear),
    ]);
    if (
      !facultyProfile ||
      !program ||
      !academicYear ||
      program.department !== departmentCode(facultyProfile.department) ||
      !program.yearLevels.includes(parsed.data.yearLevel)
    )
      return fail(
        res,
        400,
        "Select a valid program, year level, and academic year.",
      );
    return success(
      res,
      await Section.create({ ...parsed.data, faculty: req.user.id }),
      201,
    );
  }),
);

router.post(
  "/offerings",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const parsed = isValid(
      z.object({
        code: z.string().trim().min(2).max(16),
        title: z.string().trim().min(2).max(120),
        description: z.string().max(1000).optional(),
        academicYear: id,
        semester: z.enum([
          "First Semester",
          "Second Semester",
          "Third Semester",
        ]),
        section: id,
      }),
      req.body,
    );
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
    const [facultyProfile, section, academicYear] = await Promise.all([
      FacultyProfile.findOne({ user: req.user.id }),
      Section.findOne({
        _id: parsed.data.section,
        faculty: req.user.id,
      }).populate("program", "department"),
      AcademicYear.findById(parsed.data.academicYear),
    ]);
    if (
      !facultyProfile ||
      !section ||
      !academicYear ||
      section.program.department !== departmentCode(facultyProfile.department)
    )
      return fail(res, 403, "That section is unavailable to your account.");
    const enrolledStudents = await StudentProfile.find({
      section: section.id,
    }).distinct("user");
    if (enrolledStudents.length > COURSE_ENROLLMENT_LIMIT)
      return fail(
        res,
        409,
        `This section has more than ${COURSE_ENROLLMENT_LIMIT} students. Reduce the section roster before creating this course offering.`,
      );
    const code = parsed.data.code.toUpperCase();
    let course = await Course.findOne({ code });
    if (!course)
      course = await Course.create({
        code,
        title: parsed.data.title,
        description: parsed.data.description,
      });
    const semesterNames =
      parsed.data.semester === "Third Semester"
        ? ["Third Semester", "Summer"]
        : [parsed.data.semester];
    if (
      await Offering.exists({
        course: course.id,
        academicYear: academicYear.id,
        semester: { $in: semesterNames },
        section: section.id,
      })
    )
      return fail(
        res,
        409,
        "This course already has an offering for that section and semester.",
      );
    const offering = await Offering.create({
      course: course.id,
      academicYear: academicYear.id,
      semester: parsed.data.semester,
      section: section.id,
      faculty: req.user.id,
      students: enrolledStudents,
    });
    return success(res, offering, 201);
  }),
);

router.post(
  "/offerings/:offeringId/enrollments",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const email = z.string().email().safeParse(req.body.email);
    if (!email.success)
      return fail(res, 400, "Enter the student email address.");
    const offering = await facultyOffering(req.params.offeringId, req.user.id);
    const student = await User.findOne({
      email: email.data.toLowerCase(),
      role: "student",
    });
    if (!offering || !student)
      return fail(res, 404, "Course or student not found.");
    const [studentProfile, section] = await Promise.all([
      StudentProfile.findOne({ user: student.id }).populate(
        "program",
        "department",
      ),
      Section.findById(offering.section).populate("program", "department"),
    ]);
    if (
      !studentProfile?.program ||
      !section?.program ||
      studentProfile.program.department !== section.program.department
    )
      return fail(
        res,
        403,
        "Students can only enroll in courses within their department.",
      );
    const enrollmentStatus = await addStudentToOffering(
      offering.id,
      student.id,
    );
    if (enrollmentStatus === "full")
      return fail(
        res,
        409,
        `This course is full. It can have up to ${COURSE_ENROLLMENT_LIMIT} students.`,
      );
    await seedFirstLesson(offering.id, [student.id]);
    return success(res, { message: "Student enrolled." }, 201);
  }),
);

router.get(
  "/offerings/:offeringId/invite-code",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const offering = await facultyOffering(req.params.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");
    const record = await Offering.findById(offering.id).select("+joinCode");
    res.set("Cache-Control", "no-store");
    return success(res, { code: record?.joinCode || null });
  }),
);

router.post(
  "/offerings/:offeringId/invite-code",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const ownedOffering = await facultyOffering(
      req.params.offeringId,
      req.user.id,
    );
    if (!ownedOffering) return fail(res, 404, "Course offering not found.");
    const offering = await Offering.findById(ownedOffering.id).select(
      "+joinCode",
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      offering.joinCode = createInviteCode();
      try {
        await offering.save();
        res.set("Cache-Control", "no-store");
        return success(res, { code: offering.joinCode }, 201);
      } catch (error) {
        if (error.code !== 11000 || attempt === 4) throw error;
      }
    }
  }),
);

router.delete(
  "/offerings/:offeringId/invite-code",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const ownedOffering = await facultyOffering(
      req.params.offeringId,
      req.user.id,
    );
    if (!ownedOffering) return fail(res, 404, "Course offering not found.");
    const offering = await Offering.findById(ownedOffering.id).select(
      "+joinCode",
    );
    offering.joinCode = undefined;
    await offering.save();
    return success(res, { message: "The course invite code was revoked." });
  }),
);

router.get(
  "/offerings/:offeringId/enrollment-requests",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const offering = await facultyOffering(req.params.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");
    const requests = await EnrollmentRequest.find({
      offering: offering.id,
      status: "pending",
    })
      .sort("requestedAt")
      .limit(100)
      .populate("student", "firstName middleName lastName email")
      .lean();
    const profiles = await StudentProfile.find({
      user: {
        $in: requests.map((request) => request.student?._id).filter(Boolean),
      },
    })
      .populate("program", "code")
      .lean();
    const profilesByStudent = new Map(
      profiles.map((profile) => [String(profile.user), profile]),
    );
    return success(
      res,
      requests
        .filter((request) => request.student)
        .map((request) => ({
          id: String(request._id),
          requestedAt: request.requestedAt,
          student: {
            id: String(request.student._id),
            firstName: request.student.firstName,
            middleName: request.student.middleName,
            lastName: request.student.lastName,
            email: request.student.email,
            program: profilesByStudent.get(String(request.student._id))?.program
              ?.code,
            yearLevel: profilesByStudent.get(String(request.student._id))
              ?.currentYearLevel,
          },
        })),
    );
  }),
);

router.patch(
  "/offerings/:offeringId/enrollment-requests/:requestId",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const params = isValid(
      z.object({ offeringId: id, requestId: id }),
      req.params,
    );
    const body = isValid(
      z.object({ status: z.enum(["approved", "rejected"]) }),
      req.body,
    );
    if (!params.success || !body.success)
      return fail(res, 400, "Choose an enrollment request and valid decision.");
    const offering = await facultyOffering(params.data.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");
    const request = await EnrollmentRequest.findOne({
      _id: params.data.requestId,
      offering: offering.id,
      status: "pending",
    }).populate("student", "_id");
    if (!request)
      return fail(res, 404, "Pending enrollment request not found.");
    const studentId = String(request.student._id);
    const alreadyEnrolled = offering.students.some(
      (student) => String(student) === studentId,
    );
    if (body.data.status === "approved" && !alreadyEnrolled) {
      const eligibilityError = await studentOfferingEligibility(
        studentId,
        offering,
      );
      if (eligibilityError) return fail(res, 403, eligibilityError);
    }
    const reviewed = await EnrollmentRequest.findOneAndUpdate(
      { _id: request.id, status: "pending" },
      {
        $set: {
          status: body.data.status,
          reviewedAt: new Date(),
          reviewedBy: req.user.id,
        },
      },
      { new: true },
    );
    if (!reviewed) return fail(res, 409, "This request was already reviewed.");
    if (body.data.status === "approved") {
      try {
        const enrollmentStatus = await addStudentToOffering(
          offering.id,
          studentId,
        );
        if (enrollmentStatus === "full") {
          await EnrollmentRequest.updateOne(
            { _id: reviewed.id, status: "approved", reviewedBy: req.user.id },
            {
              $set: { status: "pending" },
              $unset: { reviewedAt: "", reviewedBy: "" },
            },
          );
          return fail(
            res,
            409,
            `This course is full. It can have up to ${COURSE_ENROLLMENT_LIMIT} students.`,
          );
        }
        if (enrollmentStatus === "enrolled")
          await seedFirstLesson(offering.id, [studentId]);
      } catch (error) {
        await EnrollmentRequest.updateOne(
          { _id: reviewed.id, status: "approved", reviewedBy: req.user.id },
          {
            $set: { status: "pending" },
            $unset: { reviewedAt: "", reviewedBy: "" },
          },
        );
        throw error;
      }
    }
    return success(res, { status: reviewed.status });
  }),
);

router.get(
  "/offerings/:offeringId/students",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const offering = await facultyOffering(req.params.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");
    const [students, profiles] = await Promise.all([
      User.find({ _id: { $in: offering.students } })
        .select("firstName lastName email")
        .lean(),
      StudentProfile.find({ user: { $in: offering.students } })
        .populate("program", "code yearLevels")
        .lean(),
    ]);
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.user), profile]),
    );
    return success(
      res,
      students.map((student) => ({
        ...student,
        profile: profileMap.get(String(student._id)),
      })),
    );
  }),
);

router.delete(
  "/offerings/:offeringId/students/:studentId",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const params = isValid(
      z.object({ offeringId: id, studentId: id }),
      req.params,
    );
    if (!params.success) return fail(res, 400, "Choose a valid student.");
    const offering = await facultyOffering(params.data.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");

    const removalTime = new Date();
    const result = await Offering.updateOne(
      { _id: offering.id, students: params.data.studentId },
      { $pull: { students: params.data.studentId } },
    );
    if (!result.modifiedCount)
      return fail(res, 404, "Student is not enrolled in this course.");

    await Promise.all([
      AccessGrant.deleteMany({
        student: params.data.studentId,
        offering: offering.id,
      }),
      QuizSession.deleteMany({
        student: params.data.studentId,
        offering: offering.id,
      }),
      Progress.updateMany(
        { student: params.data.studentId, offering: offering.id },
        {
          $set: {
            completedAt: null,
            resetAt: removalTime,
            resetBy: req.user.id,
            resetReason: "Enrollment removed by faculty.",
          },
        },
      ),
      EnrollmentRequest.updateOne(
        {
          student: params.data.studentId,
          offering: offering.id,
          status: "approved",
        },
        {
          $set: {
            status: "rejected",
            reviewedAt: removalTime,
            reviewedBy: req.user.id,
          },
        },
      ),
    ]);
    return success(res, {
      removed: true,
      historyRetained: true,
    });
  }),
);

router.get(
  "/offerings/:offeringId/lessons",
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const offering =
      req.user.role === "faculty"
        ? await facultyOffering(req.params.offeringId, req.user.id)
        : await studentOffering(req.params.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");
    const allLessons = await Lesson.find({ offering: offering.id })
      .sort("sequence")
      .lean();
    if (req.user.role === "student")
      await seedFirstLesson(offering.id, [req.user.id]);
    let lessons =
      req.user.role === "student"
        ? allLessons.filter((lesson) => lesson.published)
        : allLessons;
    const quizzes = await Quiz.find({
      lesson: { $in: allLessons.map((item) => item._id) },
      ...(req.user.role === "student" ? { published: true } : {}),
    })
      .select(
        req.user.role === "student"
          ? "-questions.answer -questions.explanation"
          : "",
      )
      .lean();
    const quizMap = new Map(quizzes.map((quiz) => [String(quiz.lesson), quiz]));
    if (req.user.role === "student")
      lessons = lessons.filter((lesson) => quizMap.has(String(lesson._id)));
    const progressRows =
      req.user.role === "student"
        ? await Progress.find({
            student: req.user.id,
            offering: offering.id,
          })
            .select("lesson resetAt")
            .lean()
        : [];
    const attempts =
      req.user.role === "student"
        ? await Attempt.find({ student: req.user.id, offering: offering.id })
            .select("quiz percent passed submittedAt")
            .lean()
        : [];
    const attemptMap = new Map();
    attempts.forEach((attempt) => {
      const prior = attemptMap.get(String(attempt.quiz)) || [];
      attemptMap.set(String(attempt.quiz), [...prior, attempt]);
    });
    const progressMap = new Map(
      progressRows.map((item) => [String(item.lesson), item]),
    );
    const hasPassedLesson = (lesson) => {
      if (!lesson) return false;
      const quiz = quizMap.get(String(lesson._id));
      if (!quiz) return false;
      const resetAt = progressMap.get(String(lesson._id))?.resetAt;
      return (attemptMap.get(String(quiz._id)) || []).some(
        (attempt) =>
          attempt.passed &&
          (!resetAt || new Date(attempt.submittedAt) > new Date(resetAt)),
      );
    };
    const lessonPositions = new Map(
      allLessons.map((lesson, index) => [String(lesson._id), index]),
    );
    const response = await Promise.all(
      lessons.map(async (lesson, index) => ({
        ...lesson,
        quiz: quizMap.get(String(lesson._id)) || null,
        ...(req.user.role === "student"
          ? {
              status: getLessonStatus({
                completed: hasPassedLesson(lesson),
                granted: (() => {
                  const position = lessonPositions.get(String(lesson._id));
                  return position === 0
                    ? true
                    : position > 0 &&
                        Boolean(allLessons[position - 1]?.published) &&
                        hasPassedLesson(allLessons[position - 1]);
                })(),
                first: lessonPositions.get(String(lesson._id)) === 0,
              }),
              attempts: (
                attemptMap.get(String(quizMap.get(String(lesson._id))?._id)) ||
                []
              ).sort(
                (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
              ),
            }
          : {}),
        index,
      })),
    );
    return success(res, response);
  }),
);

router.post(
  "/offerings/:offeringId/lessons",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const parsed = isValid(
      z.object({
        title: z.string().trim().min(2).max(160),
        description: z.string().max(1000).optional(),
        content: z.string().max(20000).optional(),
        summary: z.string().max(5000).optional(),
        sequence: z.coerce.number().int().min(1),
        videoUrl: z.string().url().optional().or(z.literal("")),
      }),
      req.body,
    );
    if (!parsed.success || !id.safeParse(req.params.offeringId).success)
      return fail(
        res,
        400,
        parsed.success
          ? "Invalid course offering."
          : parsed.error.issues[0].message,
      );
    const offering = await facultyOffering(req.params.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");
    const lesson = await Lesson.create({
      ...parsed.data,
      offering: offering.id,
      published: false,
      completion: "quiz",
    });
    return success(res, lesson, 201);
  }),
);

router.put(
  "/offerings/:offeringId/lessons/order",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const offering = id.safeParse(req.params.offeringId).success
      ? await facultyOffering(req.params.offeringId, req.user.id)
      : null;
    const parsed = isValid(
      z.object({
        lessonIds: z
          .array(id)
          .min(1)
          .max(200)
          .refine(
            (items) => new Set(items).size === items.length,
            "Each lesson must appear once.",
          ),
      }),
      req.body,
    );
    if (!offering || !parsed.success)
      return fail(
        res,
        offering ? 400 : 404,
        parsed.success
          ? "Course offering not found."
          : parsed.error.issues[0].message,
      );
    const current = await Lesson.find({ offering: offering.id }).select("_id");
    if (
      current.length !== parsed.data.lessonIds.length ||
      !current.every((lesson) =>
        parsed.data.lessonIds.includes(String(lesson._id)),
      )
    )
      return fail(
        res,
        400,
        "The order must include each lesson in this course exactly once.",
      );
    for (const [index, lessonId] of parsed.data.lessonIds.entries())
      await Lesson.updateOne(
        { _id: lessonId, offering: offering.id },
        { $set: { sequence: -(index + 1) } },
      );
    for (const [index, lessonId] of parsed.data.lessonIds.entries())
      await Lesson.updateOne(
        { _id: lessonId, offering: offering.id },
        { $set: { sequence: index + 1 } },
      );
    return success(
      res,
      await Lesson.find({ offering: offering.id }).sort("sequence").lean(),
    );
  }),
);

router.patch(
  "/lessons/:lessonId",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const lesson = id.safeParse(req.params.lessonId).success
      ? await Lesson.findById(req.params.lessonId)
      : null;
    if (!lesson || !(await facultyOffering(lesson.offering, req.user.id)))
      return fail(res, 404, "Lesson not found.");
    const parsed = isValid(
      z.object({
        title: z.string().trim().min(2).max(160).optional(),
        description: z.string().max(1000).optional(),
        content: z.string().max(20000).optional(),
        summary: z.string().max(5000).optional(),
        sequence: z.number().int().min(1).optional(),
        published: z.boolean().optional(),
        videoUrl: z.string().url().optional().or(z.literal("")),
      }),
      req.body,
    );
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
    const willBePublished = parsed.data.published ?? lesson.published;
    if (
      willBePublished &&
      !(await Quiz.exists({ lesson: lesson.id, published: true }))
    )
      return fail(
        res,
        400,
        "Publish a quiz for this lesson before making the lesson visible to students.",
      );
    Object.assign(lesson, parsed.data);
    await lesson.save();
    if (lesson.published) {
      const offering = await Offering.findById(lesson.offering).select(
        "students",
      );
      await seedFirstLesson(lesson.offering, offering?.students || []);
    }
    return success(res, lesson);
  }),
);

router.get(
  "/lessons/:lessonId",
  asyncRoute(async (req, res) => {
    const lesson = id.safeParse(req.params.lessonId).success
      ? await Lesson.findById(req.params.lessonId).lean()
      : null;
    if (!lesson) return fail(res, 404, "Lesson not found.");
    const offering =
      req.user.role === "faculty"
        ? await facultyOffering(lesson.offering, req.user.id)
        : await studentOffering(lesson.offering, req.user.id);
    if (!offering) return fail(res, 404, "Lesson not found.");
    if (req.user.role === "student" && !lesson.published)
      return fail(res, 404, "Lesson not found.");
    if (
      req.user.role === "student" &&
      !(await Quiz.exists({ lesson: lesson._id, published: true }))
    )
      return fail(
        res,
        404,
        "This lesson is still being prepared. Its quiz must be published first.",
      );
    if (
      req.user.role === "student" &&
      !(await lessonAccess(lesson, req.user.id))
    )
      return fail(
        res,
        403,
        "Pass the previous lesson assessment to unlock this lesson.",
      );
    const quiz = await Quiz.findOne({
      lesson: lesson._id,
      ...(req.user.role === "student" ? { published: true } : {}),
    })
      .select(
        req.user.role === "student"
          ? "-questions.answer -questions.explanation"
          : "+questions.answer",
      )
      .lean();
    let attempts = [];
    if (req.user.role === "student" && quiz) {
      const progress = await Progress.findOne({
        student: req.user.id,
        offering: lesson.offering,
        lesson: lesson._id,
      }).select("resetAt");
      attempts = await Attempt.find({
        student: req.user.id,
        quiz: quiz._id,
        ...(progress?.resetAt
          ? { submittedAt: { $gt: progress.resetAt } }
          : {}),
      })
        .sort("-submittedAt")
        .lean();
    }
    return success(res, { lesson, quiz, attempts });
  }),
);

router.post("/lessons/:lessonId/complete", allowRoles("student"), (_req, res) =>
  fail(
    res,
    410,
    "Lessons can only be completed by passing their published quiz.",
  ),
);

router.put(
  "/lessons/:lessonId/quiz",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const lesson = id.safeParse(req.params.lessonId).success
      ? await Lesson.findById(req.params.lessonId)
      : null;
    if (!lesson || !(await facultyOffering(lesson.offering, req.user.id)))
      return fail(res, 404, "Lesson not found.");
    const question = z.object({
      type: z.enum(["multiple-choice", "true-false", "short-answer"]),
      prompt: z.string().trim().min(1).max(1000),
      choices: z.array(z.string().trim().min(1).max(250)).max(8).optional(),
      answer: z.string().trim().min(1).max(500),
      points: z.number().min(1).max(100).default(1),
      explanation: z.string().max(1000).optional(),
    });
    const parsed = isValid(
      z.object({
        passingPercent: z.number().min(0).max(100),
        attemptsAllowed: z.literal(1).default(1),
        timeLimitMinutes: z.literal(10).default(10),
        availableFrom: z.coerce.date().optional(),
        deadline: z.coerce.date().optional(),
        randomizeQuestions: z.boolean().default(true),
        randomizeChoices: z.boolean().default(true),
        published: z.boolean(),
        questions: z.array(question).min(1).max(20),
      }),
      req.body,
    );
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
    if (lesson.published && !parsed.data.published)
      return fail(
        res,
        400,
        "Unpublish the lesson before taking its quiz offline.",
      );
    for (const item of parsed.data.questions)
      if (
        item.type === "multiple-choice" &&
        (!item.choices ||
          item.choices.length < 2 ||
          !item.choices.includes(item.answer))
      )
        return fail(
          res,
          400,
          "Multiple choice answers must match one of the choices.",
        );
      else if (
        item.type === "true-false" &&
        !["True", "False"].includes(item.answer)
      )
        return fail(res, 400, "True-or-false answers must be True or False.");
    const quiz = await Quiz.findOneAndUpdate(
      { lesson: lesson.id },
      { ...parsed.data },
      { upsert: true, new: true, runValidators: true },
    );
    return success(res, quiz);
  }),
);

router.get(
  "/quizzes/:quizId/sessions/current",
  allowRoles("student"),
  asyncRoute(async (req, res) => {
    const quiz = id.safeParse(req.params.quizId).success
      ? await Quiz.findById(req.params.quizId).select("+questions.answer")
      : null;
    if (!quiz || !quiz.published) return fail(res, 404, "Quiz not found.");
    const lesson = await Lesson.findById(quiz.lesson);
    if (!lesson || !(await lessonAccess(lesson, req.user.id)))
      return fail(res, 403, "This lesson is still locked.");
    const active = await QuizSession.findOne({
      student: req.user.id,
      quiz: quiz.id,
    });
    if (!active) return success(res, { session: null });
    if (!active.attemptNumber)
      return success(res, { session: null, starting: true });
    const expiresAt = quizExpiresAt(
      active.startedAt,
      quiz.timeLimitMinutes ?? 10,
    );
    if (new Date() >= expiresAt) {
      const attempt = await recordExpiredAttempt({
        session: active,
        quiz,
        lesson,
        studentId: req.user.id,
        now: new Date(),
      });
      return success(res, {
        session: null,
        expired: true,
        ...(attempt ? { attempt } : {}),
      });
    }
    return success(res, {
      session: {
        id: active.id,
        attemptNumber: active.attemptNumber,
        attemptsAllowed: 1,
        startedAt: active.startedAt,
        expiresAt,
      },
      quiz: quizForSession(quiz, active),
    });
  }),
);

router.post(
  "/quizzes/:quizId/sessions",
  allowRoles("student"),
  asyncRoute(async (req, res) => {
    const quiz = id.safeParse(req.params.quizId).success
      ? await Quiz.findById(req.params.quizId).select("+questions.answer")
      : null;
    if (!quiz || !quiz.published) return fail(res, 404, "Quiz not found.");
    const timeLimitMinutes = quiz.timeLimitMinutes ?? 10;
    const lesson = await Lesson.findById(quiz.lesson);
    if (!lesson || !(await lessonAccess(lesson, req.user.id)))
      return fail(res, 403, "This lesson is still locked.");
    const now = new Date();
    if (
      (quiz.availableFrom && now < quiz.availableFrom) ||
      (quiz.deadline && now > quiz.deadline)
    )
      return fail(res, 403, "This quiz is outside its availability period.");
    const progress = await Progress.findOne({
      student: req.user.id,
      offering: lesson.offering,
      lesson: lesson.id,
    }).select("completedAt resetAt");
    if (progress?.completedAt)
      return fail(res, 409, "You have already passed this assessment.");

    let session = await QuizSession.findOne({
      student: req.user.id,
      quiz: quiz.id,
    });
    if (
      session &&
      session.attemptNumber > 0 &&
      !quizIsExpired(session.startedAt, timeLimitMinutes, now)
    ) {
      return success(res, {
        session: {
          id: session.id,
          attemptNumber: session.attemptNumber,
          attemptsAllowed: 1,
          startedAt: session.startedAt,
          expiresAt: quizExpiresAt(session.startedAt, timeLimitMinutes),
        },
        quiz: quizForSession(quiz, session),
      });
    }
    if (session?.attemptNumber === 0)
      return fail(res, 503, "Your quiz is starting. Please retry in a moment.");
    if (session) {
      const totalPoints = quiz.questions.reduce(
        (total, question) => total + question.points,
        0,
      );
      await Attempt.create({
        student: req.user.id,
        quiz: quiz.id,
        offering: lesson.offering,
        answers: [],
        earnedPoints: 0,
        totalPoints,
        percent: 0,
        passed: false,
        timedOut: true,
        submittedAt: now,
      });
      await QuizSession.deleteOne({ _id: session.id, student: req.user.id });
    }

    const questionIds = quiz.questions.map((question) => question._id);
    const questionOrder = shuffle(
      questionIds,
      () => randomInt(0, 0x100000000) / 0x100000000,
    );
    const choiceOrders = quiz.questions.map((question) => ({
      questionId: question._id,
      choices:
        question.type === "multiple-choice"
          ? shuffle(
              question.choices,
              () => randomInt(0, 0x100000000) / 0x100000000,
            )
          : question.choices,
    }));
    try {
      session = await QuizSession.create({
        student: req.user.id,
        quiz: quiz.id,
        offering: lesson.offering,
        attemptNumber: 0,
        questionOrder,
        choiceOrders,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      session = await QuizSession.findOne({
        student: req.user.id,
        quiz: quiz.id,
      });
      if (!session || session.attemptNumber === 0)
        return fail(
          res,
          503,
          "Your quiz is starting. Please retry in a moment.",
        );
      return success(res, {
        session: {
          id: session.id,
          attemptNumber: session.attemptNumber,
          attemptsAllowed: 1,
          startedAt: session.startedAt,
          expiresAt: quizExpiresAt(session.startedAt, timeLimitMinutes),
        },
        quiz: quizForSession(quiz, session),
      });
    }

    const attemptNumber = await reserveAttemptNumber({
      studentId: req.user.id,
      quiz,
      lesson,
      resetAt: progress?.resetAt,
    });
    if (!attemptNumber) {
      await QuizSession.deleteOne({ _id: session.id });
      return fail(res, 403, "You have used all available attempts.");
    }
    session.attemptNumber = attemptNumber;
    await session.save();
    return success(
      res,
      {
        session: {
          id: session.id,
          attemptNumber,
          attemptsAllowed: 1,
          startedAt: session.startedAt,
          expiresAt: quizExpiresAt(session.startedAt, timeLimitMinutes),
        },
        quiz: quizForSession(quiz, session),
      },
      201,
    );
  }),
);

router.post(
  "/quizzes/:quizId/attempts",
  allowRoles("student"),
  asyncRoute(async (req, res) => {
    const quiz = id.safeParse(req.params.quizId).success
      ? await Quiz.findById(req.params.quizId).select("+questions.answer")
      : null;
    if (!quiz || !quiz.published) return fail(res, 404, "Quiz not found.");
    const timeLimitMinutes = quiz.timeLimitMinutes ?? 10;
    const lesson = await Lesson.findById(quiz.lesson);
    if (!lesson || !(await lessonAccess(lesson, req.user.id)))
      return fail(res, 403, "This lesson is still locked.");
    const session = await QuizSession.findOne({
      student: req.user.id,
      quiz: quiz.id,
    });
    if (!session || session.attemptNumber < 1)
      return fail(res, 409, "Start this quiz before submitting answers.");
    const parsed = isValid(
      z.object({
        answers: z
          .array(z.object({ questionId: id, answer: z.string().max(1000) }))
          .max(20)
          .refine(
            (answers) =>
              new Set(answers.map((item) => item.questionId)).size ===
              answers.length,
            "A question can only be answered once.",
          ),
      }),
      req.body,
    );
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
    const questionIds = new Set(
      quiz.questions.map((question) => String(question._id)),
    );
    if (
      parsed.data.answers.some((answer) => !questionIds.has(answer.questionId))
    )
      return fail(res, 400, "Answers must belong to this quiz.");

    const now = new Date();
    const timedOut = quizIsExpired(session.startedAt, timeLimitMinutes, now);
    const evaluated = timedOut
      ? {
          earnedPoints: 0,
          totalPoints: quiz.questions.reduce(
            (total, question) => total + question.points,
            0,
          ),
          percent: 0,
          results: quiz.questions.map((question) => ({
            questionId: String(question._id),
            correct: false,
            ...(question.explanation
              ? { explanation: question.explanation }
              : {}),
          })),
        }
      : evaluateQuiz(quiz.questions, parsed.data.answers);
    const { earnedPoints, totalPoints, percent, results } = evaluated;
    const passed = !timedOut && quizPasses(percent, quiz.passingPercent);
    const attempt = await Attempt.create({
      student: req.user.id,
      quiz: quiz.id,
      offering: lesson.offering,
      answers: timedOut ? [] : parsed.data.answers,
      earnedPoints,
      totalPoints,
      percent,
      passed,
      timedOut,
      submittedAt: now,
    });
    await QuizSession.deleteOne({ _id: session.id, student: req.user.id });
    if (passed) {
      await Progress.updateOne(
        { student: req.user.id, offering: lesson.offering, lesson: lesson.id },
        {
          $set: { completedAt: now },
          $setOnInsert: {
            student: req.user.id,
            offering: lesson.offering,
            lesson: lesson.id,
          },
        },
        { upsert: true },
      );
      await grantNextLesson(lesson, req.user.id);
    }
    return success(
      res,
      {
        attempt: {
          id: attempt.id,
          earnedPoints,
          totalPoints,
          percent,
          passed,
          timedOut,
          attemptNumber: session.attemptNumber,
          attemptsAllowed: 1,
        },
        results,
        message: timedOut
          ? "Time expired. This attempt was recorded as incomplete."
          : passed
            ? "Assessment passed. The next lesson is now unlocked."
            : "Assessment not passed. Review the lesson and try again.",
      },
      201,
    );
  }),
);

router.post(
  "/students/:studentId/lessons/:lessonId/reset",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const params = isValid(
      z.object({ studentId: id, lessonId: id }),
      req.params,
    );
    if (!params.success) return fail(res, 400, "Invalid student or lesson.");
    const lesson = await Lesson.findById(params.data.lessonId);
    if (!lesson || !(await facultyOffering(lesson.offering, req.user.id)))
      return fail(res, 404, "Lesson not found.");
    const offering = await Offering.findById(lesson.offering);
    if (
      !offering.students.some(
        (student) => String(student) === params.data.studentId,
      )
    )
      return fail(res, 404, "Student is not enrolled in this course.");
    const reason = z
      .string()
      .max(500)
      .parse(req.body.reason || "Faculty reset");
    const downstream = await Lesson.find({
      offering: offering.id,
      sequence: { $gte: lesson.sequence },
    }).select("_id");
    const downstreamIds = downstream.map((item) => item._id);
    const resetAt = new Date();
    await Progress.updateMany(
      {
        student: params.data.studentId,
        offering: offering.id,
        lesson: { $in: downstreamIds },
      },
      {
        $set: {
          completedAt: null,
          resetAt,
          resetBy: req.user.id,
          resetReason: reason,
        },
      },
    );
    await Progress.updateOne(
      {
        student: params.data.studentId,
        offering: offering.id,
        lesson: lesson.id,
      },
      {
        $set: {
          completedAt: null,
          resetAt,
          resetBy: req.user.id,
          resetReason: reason,
        },
        $setOnInsert: {
          student: params.data.studentId,
          offering: offering.id,
          lesson: lesson.id,
        },
      },
      { upsert: true },
    );
    await AccessGrant.deleteMany({
      student: params.data.studentId,
      offering: offering.id,
      lesson: {
        $in: downstreamIds.filter((item) => String(item) !== String(lesson.id)),
      },
    });
    const downstreamQuizIds = await Quiz.find({
      lesson: { $in: downstreamIds },
    }).distinct("_id");
    await QuizSession.deleteMany({
      student: params.data.studentId,
      quiz: { $in: downstreamQuizIds },
    });
    return success(res, { reset: true, audit: "Progress reset recorded." });
  }),
);

router.get(
  "/offerings/:offeringId/grades",
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const offering =
      req.user.role === "faculty"
        ? await facultyOffering(req.params.offeringId, req.user.id)
        : await studentOffering(req.params.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");
    const attempts = await Attempt.find({
      offering: offering.id,
      ...(req.user.role === "student" ? { student: req.user.id } : {}),
    })
      .sort("-submittedAt")
      .populate("student", "firstName lastName")
      .populate({ path: "quiz", populate: { path: "lesson", select: "title" } })
      .lean();
    const weights = { quiz: 100, other: 0 };
    const studentIds =
      req.user.role === "faculty"
        ? offering.students.map(String)
        : [String(req.user.id)];
    const roster = await User.find({ _id: { $in: studentIds } })
      .select("firstName lastName email")
      .lean();
    let quizColumns = [];
    if (req.user.role === "faculty") {
      const lessons = await Lesson.find({ offering: offering.id })
        .select("title sequence")
        .lean();
      const lessonById = new Map(
        lessons.map((lesson) => [String(lesson._id), lesson]),
      );
      const quizzes = await Quiz.find({
        lesson: { $in: lessons.map((lesson) => lesson._id) },
      })
        .select("lesson")
        .lean();
      quizColumns = quizzes
        .map((quiz) => {
          const lesson = lessonById.get(String(quiz.lesson));
          return lesson
            ? {
                id: String(quiz._id),
                title: lesson.title,
                sequence: lesson.sequence,
              }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.sequence - b.sequence);
    }
    const rosterById = new Map(
      roster.map((student) => [String(student._id), student]),
    );
    const latestQuizScores = new Map();
    for (const attempt of attempts) {
      const studentId = String(attempt.student?._id || attempt.student);
      const key = `${studentId}:${String(attempt.quiz?._id || attempt.quiz)}`;
      if (!latestQuizScores.has(key))
        latestQuizScores.set(key, attempt.percent || 0);
    }
    const courseGrades = studentIds.map((studentId) => {
      const quizScores = [...latestQuizScores.entries()]
        .filter(([key]) => key.startsWith(`${studentId}:`))
        .map(([, score]) => score);
      const quizAverage = quizScores.length
        ? Math.round(
            (quizScores.reduce((total, score) => total + score, 0) /
              quizScores.length) *
              100,
          ) / 100
        : null;
      const grade = quizAverage;
      return {
        studentId,
        student: rosterById.get(studentId) || null,
        grade,
        quizAverage,
      };
    });
    return success(res, {
      attempts,
      weights,
      courseGrades,
      quizColumns,
    });
  }),
);

router.put(
  "/offerings/:offeringId/grading",
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    if (!id.safeParse(req.params.offeringId).success)
      return fail(res, 400, "Invalid course offering.");
    const offering = await facultyOffering(req.params.offeringId, req.user.id);
    if (!offering) return fail(res, 404, "Course offering not found.");
    return fail(
      res,
      410,
      "Course grades are calculated from quiz results only; grading weights are no longer configurable.",
    );
  }),
);

router.put(
  "/offerings/:offeringId/grades",
  allowRoles("faculty"),
  asyncRoute(async (_req, res) =>
    fail(res, 410, "Grades come from Modulink quiz attempts only."),
  ),
);

export default router;
