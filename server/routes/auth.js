import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  AccessGrant,
  AcademicYear,
  Counter,
  FacultyProfile,
  Lesson,
  Offering,
  Program,
  Section,
  StudentProfile,
  User,
} from "../models/index.js";
import {
  allowRoles,
  asyncRoute,
  authenticate,
  fail,
  success,
} from "../middleware.js";
import { formatStudentId } from "../logic.js";
import { departmentNames, departments } from "../catalog.js";
import {
  addStudentToOffering,
  COURSE_ENROLLMENT_LIMIT,
} from "../enrollment.js";

const router = Router();
const credentials = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  email: z.string().trim().email().max(254),
  password: z
    .string()
    .min(8)
    .max(128)
    .refine((value) => value.trim().length > 0, "Password cannot be blank."),
});
const signup = credentials.extend({
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(["student", "faculty"]),
  program: z.string().optional(),
  enrollmentYear: z.coerce.number().int().min(2000).max(2100).optional(),
  currentYearLevel: z.string().trim().min(2).max(40).optional(),
  section: z.string().optional(),
  department: z.enum(departmentNames).optional(),
  privacyAcknowledged: z.literal(true),
});
const loginCredentials = z
  .object({
    identifier: z.string().trim().min(3).max(254).optional(),
    username: z.string().trim().min(3).max(254).optional(),
    email: z.string().email().max(254).optional(),
    password: z
      .string()
      .min(8)
      .max(128)
      .refine((value) => value.trim().length > 0, "Password cannot be blank."),
  })
  .refine((data) => data.identifier || data.username || data.email, {
    message: "Enter your username or email and password.",
  });

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });
  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}

router.get(
  "/options",
  asyncRoute(async (_req, res) => {
    const [programs, years, sections] = await Promise.all([
      Program.find().select("name code department yearLevels").sort("code"),
      AcademicYear.find().select("label current").sort("-label"),
      Section.find()
        .select("name program yearLevel")
        .populate("program", "code department")
        .sort("name"),
    ]);
    return success(res, {
      departments,
      programs,
      academicYears: years,
      sections,
    });
  }),
);

router.post(
  "/register",
  asyncRoute(async (req, res) => {
    const parsed = signup.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
    const data = parsed.data;
    const email = data.email.toLowerCase();
    const username = data.username?.toLowerCase();
    if (!username) return fail(res, 400, "Choose a username.");
    if (await User.exists({ email }))
      return fail(res, 409, "An account with that email already exists.");
    if (await User.exists({ username }))
      return fail(res, 409, "That username is already taken.");
    if (!data.department) return fail(res, 400, "Choose your department.");
    if (data.role === "student") {
      if (!data.program || !data.enrollmentYear || !data.currentYearLevel)
        return fail(
          res,
          400,
          "Program, enrollment year, and year level are required.",
        );
      const program = await Program.findById(data.program);
      if (
        !program ||
        program.department !==
          departments.find((item) => item.name === data.department)?.code
      )
        return fail(res, 400, "Choose a degree program in your department.");
      if (!program.yearLevels.includes(data.currentYearLevel))
        return fail(res, 400, "Choose a year level offered by the program.");
      if (
        data.section &&
        !(await Section.exists({
          _id: data.section,
          program: program.id,
          yearLevel: data.currentYearLevel,
        }))
      )
        return fail(
          res,
          400,
          "Choose a section for the selected program and year level.",
        );
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    let user;
    const fullCourses = [];
    try {
      user = await User.create({
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email,
        username,
        privacyAcknowledgement: {
          version: "2",
          acceptedAt: new Date(),
        },
        passwordHash,
        role: data.role,
      });
      if (data.role === "student") {
        const programCode = (await Program.findById(data.program)).code;
        const key = `${data.enrollmentYear}-${programCode}`;
        let counter;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            counter = await Counter.findOneAndUpdate(
              { key },
              { $inc: { sequence: 1 } },
              { upsert: true, new: true },
            );
            break;
          } catch (error) {
            if (error.code !== 11000 || attempt === 2) throw error;
          }
        }
        await StudentProfile.create({
          user: user.id,
          studentId: formatStudentId(
            data.enrollmentYear,
            programCode,
            counter.sequence,
          ),
          program: data.program,
          enrollmentYear: data.enrollmentYear,
          currentYearLevel: data.currentYearLevel,
          section: data.section || undefined,
        });
        if (data.section) {
          const offerings = await Offering.find({ section: data.section })
            .populate("course", "code")
            .lean();
          for (const offering of offerings) {
            const enrollmentStatus = await addStudentToOffering(
              offering._id,
              user.id,
            );
            if (enrollmentStatus === "full") {
              fullCourses.push(offering.course?.code || "Course");
              continue;
            }
            const firstLesson = await Lesson.findOne({
              offering: offering._id,
              published: true,
            })
              .sort("sequence")
              .select("_id");
            if (firstLesson)
              await AccessGrant.updateOne(
                {
                  student: user.id,
                  offering: offering._id,
                  lesson: firstLesson.id,
                },
                {
                  $setOnInsert: {
                    student: user.id,
                    offering: offering._id,
                    lesson: firstLesson.id,
                  },
                },
                { upsert: true },
              );
          }
        }
      } else {
        await FacultyProfile.create({
          user: user.id,
          department: data.department,
        });
      }
    } catch (error) {
      if (user) {
        await Promise.all([
          StudentProfile.deleteOne({ user: user.id }),
          FacultyProfile.deleteOne({ user: user.id }),
          Offering.updateMany(
            { students: user.id },
            { $pull: { students: user.id } },
          ),
          AccessGrant.deleteMany({ student: user.id }),
        ]);
        await User.findByIdAndDelete(user.id);
      }
      if (error.code === 11000)
        return fail(
          res,
          409,
          "An account or student ID already exists. Please try again.",
        );
      throw error;
    }
    setSession(res, user);
    return success(
      res,
      {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email,
          username,
          role: user.role,
        },
        ...(fullCourses.length
          ? {
              fullCourses,
              enrollmentLimit: COURSE_ENROLLMENT_LIMIT,
            }
          : {}),
      },
      201,
    );
  }),
);

router.post(
  "/login",
  asyncRoute(async (req, res) => {
    const parsed = loginCredentials.safeParse(req.body);
    if (!parsed.success)
      return fail(res, 400, "Enter a valid username or email and password.");
    const identity =
      parsed.data.identifier || parsed.data.username || parsed.data.email;
    const user = await User.findOne({
      $or: [
        { username: identity.toLowerCase() },
        { email: identity.toLowerCase() },
      ],
    }).select("+passwordHash firstName lastName username email role");
    if (
      !user ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    )
      return fail(res, 401, "Username/email or password is incorrect.");
    setSession(res, user);
    return success(res, {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  }),
);

router.get(
  "/me",
  authenticate,
  asyncRoute(async (req, res) => {
    const profile =
      req.user.role === "student"
        ? await StudentProfile.findOne({ user: req.user.id })
            .populate("program", "name code")
            .populate("section", "name yearLevel")
            .lean()
        : await FacultyProfile.findOne({ user: req.user.id }).lean();
    return success(res, {
      user: {
        id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role,
      },
      profile,
    });
  }),
);

router.patch(
  "/department",
  authenticate,
  allowRoles("faculty"),
  asyncRoute(async (req, res) => {
    const parsed = z.enum(departmentNames).safeParse(req.body.department);
    if (!parsed.success) return fail(res, 400, "Choose a valid department.");
    const profile = await FacultyProfile.findOne({ user: req.user.id });
    if (!profile) return fail(res, 404, "Faculty profile not found.");
    if (
      departments.some((department) => department.name === profile.department)
    )
      return fail(
        res,
        409,
        "Your department is already set and cannot be changed.",
      );
    profile.department = parsed.data;
    await profile.save();
    return success(res, { department: profile.department });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie("session", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return success(res, { message: "Signed out." });
});
export default router;
