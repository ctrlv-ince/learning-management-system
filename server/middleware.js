import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "./models/index.js";

export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid identifier");

export const authenticate = asyncRoute(async (req, res, next) => {
  const token = req.cookies?.session;
  if (!token)
    return res
      .status(401)
      .json({ success: false, error: "Sign in to continue." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select(
      "_id firstName middleName lastName username email role",
    );
    if (!user)
      return res
        .status(401)
        .json({ success: false, error: "Session is no longer valid." });
    req.user = user;
    return next();
  } catch {
    return res
      .status(401)
      .json({ success: false, error: "Session is no longer valid." });
  }
});

export const allowRoles =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({
          success: false,
          error: "You do not have access to this action.",
        });

export const fail = (res, status, error) =>
  res.status(status).json({ success: false, error });
export const success = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

export async function facultyOffering(id, facultyId) {
  const models = await import("./models/index.js");
  const [offering, profile] = await Promise.all([
    models.Offering.findOne({ _id: id, faculty: facultyId }),
    models.FacultyProfile.findOne({ user: facultyId }),
  ]);
  if (!offering || !profile) return null;
  const catalog = await import("./catalog.js");
  const department = catalog.departmentCode(profile.department);
  if (!department) return null;
  const section = await models.Section.findById(offering.section).populate(
    "program",
    "department",
  );
  return section?.program?.department === department ? offering : null;
}

export async function facultyOfferings(facultyId) {
  const models = await import("./models/index.js");
  const profile = await models.FacultyProfile.findOne({ user: facultyId });
  const catalog = await import("./catalog.js");
  const department = catalog.departmentCode(profile?.department);
  if (!department) return [];
  const programs = await models.Program.find({ department }).distinct("_id");
  const sections = await models.Section.find({
    faculty: facultyId,
    program: { $in: programs },
  }).distinct("_id");
  return models.Offering.find({
    faculty: facultyId,
    section: { $in: sections },
  });
}

export async function studentOffering(id, studentId) {
  const models = await import("./models/index.js");
  const [offering, profile] = await Promise.all([
    models.Offering.findOne({ _id: id, students: studentId }),
    models.StudentProfile.findOne({ user: studentId }).populate(
      "program",
      "department",
    ),
  ]);
  if (!offering || !profile?.program) return null;
  const section = await models.Section.findById(offering.section).populate(
    "program",
    "department",
  );
  return section?.program?.department === profile.program.department
    ? offering
    : null;
}

export async function studentOfferings(studentId) {
  const models = await import("./models/index.js");
  const profile = await models.StudentProfile.findOne({
    user: studentId,
  }).populate("program", "department");
  if (!profile?.program) return [];
  const programs = await models.Program.find({
    department: profile.program.department,
  }).distinct("_id");
  const sections = await models.Section.find({
    program: { $in: programs },
  }).distinct("_id");
  return models.Offering.find({
    students: studentId,
    section: { $in: sections },
  });
}
