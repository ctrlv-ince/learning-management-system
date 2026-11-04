import mongoose from "mongoose";

const { Schema, model } = mongoose;
const options = { timestamps: true };

const UserSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    middleName: { type: String, trim: true, maxlength: 80, default: "" },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["faculty", "student"], required: true },
    privacyAcknowledgement: {
      version: { type: String, required: true },
      acceptedAt: { type: Date, required: true },
    },
  },
  options,
);

const ProgramSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    description: String,
    department: {
      type: String,
      enum: ["EAAD", "CAAD", "BASD", "MAAD"],
      required: true,
    },
    yearLevels: {
      type: [String],
      default: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
    },
    faculty: { type: Schema.Types.ObjectId, ref: "User" },
  },
  options,
);
const AcademicYearSchema = new Schema(
  {
    label: { type: String, required: true, unique: true },
    startsAt: Date,
    endsAt: Date,
    current: { type: Boolean, default: false },
  },
  options,
);
const SectionSchema = new Schema(
  {
    name: { type: String, required: true },
    program: { type: Schema.Types.ObjectId, ref: "Program", required: true },
    yearLevel: { type: String, required: true },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    faculty: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  options,
);
SectionSchema.index(
  { name: 1, program: 1, yearLevel: 1, academicYear: 1 },
  { unique: true },
);
const CourseSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true },
    title: { type: String, required: true },
    description: String,
  },
  options,
);
CourseSchema.index({ code: 1 }, { unique: true });
const OfferingSchema = new Schema(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    semester: {
      type: String,
      enum: ["First Semester", "Second Semester", "Third Semester", "Summer"],
      required: true,
    },
    section: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    faculty: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinCode: { type: String, select: false },
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
    gradeWeights: {
      quiz: { type: Number, default: 70 },
      other: { type: Number, default: 30 },
    },
  },
  options,
);
OfferingSchema.index(
  { course: 1, academicYear: 1, semester: 1, section: 1 },
  { unique: true },
);
OfferingSchema.index({ joinCode: 1 }, { unique: true, sparse: true });
const EnrollmentRequestSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    offering: { type: Schema.Types.ObjectId, ref: "Offering", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  options,
);
EnrollmentRequestSchema.index({ student: 1, offering: 1 }, { unique: true });
const LessonSchema = new Schema(
  {
    offering: {
      type: Schema.Types.ObjectId,
      ref: "Offering",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: String,
    content: String,
    summary: { type: String, maxlength: 5000, default: "" },
    sequence: { type: Number, required: true },
    materials: [
      {
        name: String,
        url: String,
        mimeType: String,
        size: Number,
        storage: {
          type: String,
          enum: ["local", "cloudinary"],
          default: "local",
        },
        cloudinaryPublicId: String,
        cloudinaryVersion: Number,
      },
    ],
    videoUrl: String,
    published: { type: Boolean, default: false },
    completion: {
      type: String,
      enum: ["quiz", "acknowledgement"],
      default: "quiz",
    },
  },
  options,
);
LessonSchema.index({ offering: 1, sequence: 1 }, { unique: true });
const QuestionSchema = new Schema({
  type: {
    type: String,
    enum: ["multiple-choice", "true-false", "short-answer"],
    required: true,
  },
  prompt: { type: String, required: true },
  choices: [String],
  answer: { type: String, required: true, select: false },
  points: { type: Number, min: 1, default: 1 },
  explanation: String,
});
const QuizSchema = new Schema(
  {
    lesson: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      unique: true,
    },
    passingPercent: { type: Number, min: 0, max: 100, default: 75 },
    attemptsAllowed: { type: Number, min: 1, default: 1 },
    timeLimitMinutes: { type: Number, min: 10, max: 10, default: 10 },
    availableFrom: Date,
    deadline: Date,
    randomizeQuestions: { type: Boolean, default: true },
    randomizeChoices: { type: Boolean, default: true },
    published: { type: Boolean, default: false },
    questions: [QuestionSchema],
  },
  options,
);
const AttemptSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    offering: { type: Schema.Types.ObjectId, ref: "Offering", required: true },
    answers: [{ questionId: Schema.Types.ObjectId, answer: String }],
    earnedPoints: Number,
    totalPoints: Number,
    percent: Number,
    passed: Boolean,
    timedOut: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
  },
  options,
);
AttemptSchema.index({ student: 1, quiz: 1, submittedAt: -1 });
const QuizSessionSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    quiz: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    offering: { type: Schema.Types.ObjectId, ref: "Offering", required: true },
    attemptNumber: { type: Number, required: true },
    startedAt: { type: Date, default: Date.now },
    questionOrder: [{ type: Schema.Types.ObjectId }],
    choiceOrders: [
      {
        questionId: { type: Schema.Types.ObjectId, required: true },
        choices: [String],
      },
    ],
  },
  options,
);
QuizSessionSchema.index({ student: 1, quiz: 1 }, { unique: true });
const ProgressSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    offering: { type: Schema.Types.ObjectId, ref: "Offering", required: true },
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    completedAt: Date,
    resetAt: Date,
    resetBy: { type: Schema.Types.ObjectId, ref: "User" },
    resetReason: String,
  },
  options,
);
ProgressSchema.index({ student: 1, offering: 1, lesson: 1 }, { unique: true });
const AccessGrantSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    offering: { type: Schema.Types.ObjectId, ref: "Offering", required: true },
    lesson: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    grantedByLesson: { type: Schema.Types.ObjectId, ref: "Lesson" },
  },
  options,
);
AccessGrantSchema.index(
  { student: 1, offering: 1, lesson: 1 },
  { unique: true },
);
const GradeSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    offering: { type: Schema.Types.ObjectId, ref: "Offering", required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 0 },
    remarks: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  options,
);
GradeSchema.index(
  { student: 1, offering: 1, category: 1, title: 1 },
  { unique: true },
);
const CounterSchema = new Schema({
  key: { type: String, unique: true, required: true },
  sequence: { type: Number, default: 0 },
  base: { type: Number, default: 0 },
});
const StudentProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    studentId: { type: String, unique: true, required: true },
    program: { type: Schema.Types.ObjectId, ref: "Program", required: true },
    enrollmentYear: { type: Number, required: true },
    currentYearLevel: { type: String, required: true },
    section: { type: Schema.Types.ObjectId, ref: "Section" },
  },
  options,
);
const FacultyProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    department: {
      type: String,
      enum: [
        "Electrical and Allied Department",
        "Civil and Allied Department",
        "Basic Arts and Sciences Department",
        "Mechanical and Allied Department",
      ],
      required: true,
    },
  },
  options,
);

export const User = model("User", UserSchema);
export const Program = model("Program", ProgramSchema);
export const AcademicYear = model("AcademicYear", AcademicYearSchema);
export const Section = model("Section", SectionSchema);
export const Course = model("Course", CourseSchema);
export const Offering = model("Offering", OfferingSchema);
export const EnrollmentRequest = model(
  "EnrollmentRequest",
  EnrollmentRequestSchema,
);
export const Lesson = model("Lesson", LessonSchema);
export const Quiz = model("Quiz", QuizSchema);
export const Attempt = model("Attempt", AttemptSchema);
export const QuizSession = model("QuizSession", QuizSessionSchema);
export const Progress = model("Progress", ProgressSchema);
export const AccessGrant = model("AccessGrant", AccessGrantSchema);
export const Grade = model("Grade", GradeSchema);
export const Counter = model("Counter", CounterSchema);
export const StudentProfile = model("StudentProfile", StudentProfileSchema);
export const FacultyProfile = model("FacultyProfile", FacultyProfileSchema);
