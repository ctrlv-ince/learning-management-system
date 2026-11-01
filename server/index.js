import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import academicRoutes from "./routes/academics.js";
import {
  authenticate,
  allowRoles,
  asyncRoute,
  fail,
  facultyOffering,
  success,
} from "./middleware.js";
import { Lesson, Offering } from "./models/index.js";
import { seedAcademicCatalog } from "./catalog.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4000);
const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

if (
  !process.env.MONGODB_URI ||
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32
) {
  throw new Error(
    "Set MONGODB_URI and a JWT_SECRET of at least 32 characters.",
  );
}

app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(
  cors({
    origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use((req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== origin
  )
    return fail(res, 403, "Request origin is not allowed.");
  return next();
});
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.get("/api/health", (_req, res) =>
  res.json({
    success: true,
    data: {
      status: "ok",
      database:
        mongoose.connection.readyState === 1 ? "connected" : "connecting",
    },
  }),
);
app.use("/api/auth", authRoutes);
app.use("/api", academicRoutes);

const uploadRoot = path.resolve(here, "../uploads");
await mkdir(uploadRoot, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadRoot,
  filename: (_req, file, callback) =>
    callback(
      null,
      `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`,
    ),
});
const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
]);
const typeExtensions = new Map([
  ["application/pdf", [".pdf"]],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    [".docx"],
  ],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    [".pptx"],
  ],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["video/mp4", [".mp4"]],
]);
const uploader = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    const allowed =
      typeExtensions
        .get(file.mimetype)
        ?.includes(path.extname(file.originalname).toLowerCase()) || false;
    callback(
      allowed
        ? null
        : new Error(
            "Upload a PDF, Office document, image, or MP4 video with its matching file extension.",
          ),
      allowed,
    );
  },
});
const checkLessonOwner = asyncRoute(async (req, res, next) => {
  const lesson = /^[a-f\d]{24}$/i.test(req.params.lessonId)
    ? await Lesson.findById(req.params.lessonId)
    : null;
  if (!lesson || !(await facultyOffering(lesson.offering, req.user.id)))
    return fail(res, 404, "Lesson not found.");
  req.lesson = lesson;
  return next();
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.post(
  "/api/lessons/:lessonId/materials",
  authenticate,
  allowRoles("faculty"),
  uploadLimiter,
  checkLessonOwner,
  uploader.array("files", 5),
  asyncRoute(async (req, res) => {
    const lesson = req.lesson;
    const files = (req.files || []).map((file) => ({
      name: path.basename(file.originalname).slice(0, 180),
      url: `/uploads/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
    }));
    lesson.materials.push(...files);
    await lesson.save();
    return success(res, lesson.materials, 201);
  }),
);
app.get(
  "/uploads/:filename",
  authenticate,
  asyncRoute(async (req, res) => {
    if (
      !/^[0-9a-f-]{36}\.(pdf|docx|pptx|jpe?g|png|webp|mp4)$/i.test(
        req.params.filename,
      )
    )
      return fail(res, 404, "File not found.");
    const fileUrl = `/uploads/${req.params.filename}`;
    const lesson = await Lesson.findOne({ "materials.url": fileUrl }).select(
      "offering",
    );
    if (!lesson) return fail(res, 404, "File not found.");
    const offering =
      req.user.role === "faculty"
        ? await facultyOffering(lesson.offering, req.user.id)
        : await Offering.findOne({
            _id: lesson.offering,
            students: req.user.id,
          });
    if (!offering) return fail(res, 404, "File not found.");
    return res.sendFile(path.join(uploadRoot, req.params.filename));
  }),
);
app.use("/api", (_req, res) => fail(res, 404, "API route not found."));
const clientRoot = path.resolve(here, "../dist");
if (existsSync(clientRoot)) {
  app.use(
    express.static(clientRoot, {
      index: false,
      maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    }),
  );
  app.get("*", (_req, res, next) =>
    res.sendFile(
      path.join(clientRoot, "index.html"),
      (error) => error && next(error),
    ),
  );
}
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError)
    return fail(
      res,
      400,
      error.code === "LIMIT_FILE_SIZE"
        ? "Files must be 15 MB or smaller."
        : "Upload limit exceeded.",
    );
  if (error.name === "ValidationError")
    return fail(res, 400, "Some submitted information is invalid.");
  if (error.code === 11000)
    return fail(res, 409, "That record already exists.");
  process.stderr.write(`Request error: ${error.message}\n`);
  return fail(
    res,
    500,
    app.get("env") === "development"
      ? error.message
      : "Something went wrong. Please try again.",
  );
});

await mongoose.connect(process.env.MONGODB_URI);
await seedAcademicCatalog();
app.listen(port, () =>
  process.stdout.write(`Modulink API listening on http://localhost:${port}\n`),
);
