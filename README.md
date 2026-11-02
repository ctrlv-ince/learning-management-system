# Modulink Learning

Modulink is a MERN learning platform for faculty and students. Its name blends “module” and “link,” reflected in the connected-module app icon. It models academic programs, academic years, sections, course offerings, lesson materials, quizzes, individual progress, attempts, and grades.

## Run locally

Requirements: Node.js 20 or newer and a reachable MongoDB database.

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `JWT_SECRET` (at least 32 characters), and `CLIENT_ORIGIN`.
2. Install dependencies with `npm install`.
3. Start the client and API with `npm run dev`.
4. Open `http://localhost:5173`. The first faculty account can register, create an academic year, section, and course offering. Faculty can enroll students by registered email or share a course invite code for student requests that faculty approve.

`npm run build` creates the frontend bundle. `npm start` starts Express and serves `dist` when it exists, including the SPA fallback. Uploads are written to the local `uploads/` directory; use persistent private storage when deploying beyond a single local server.

## Academic and progression model

- The only account roles are `faculty` and `student`.
- New accounts register with a unique username and email. Users can sign in with their username; previously created email-only accounts can continue signing in with email.
- Registration requires a privacy acknowledgment for both roles. The server records its version and acceptance time. The public home page explains Modulink, and anyone can browse a faculty directory grouped by department.
- The academic catalog seeds four departments and their approved programs when the server connects to MongoDB. Faculty choose one department at registration; students choose a department, then a program and year level from that department.
- Faculty can create sections and course offerings only for their department. Student registration and faculty enrollment reject cross-department assignments.
- Student IDs are assigned on the server in `YEAR-PROGRAM-SEQUENCE` form. A MongoDB atomic counter gives each year/program pair its own sequence.
- A faculty member owns their programs, sections, and offerings. Students see offerings only after enrollment.
- Faculty can create or rotate a unique invite code per offering. Students can request enrollment with the code; the server checks department, program, and year level, and faculty approval is required before the student is added to the roster.
- Students receive a grant for the first published lesson when enrolled. Passing a lesson quiz or completing an explicitly configured acknowledgement grants access to the next lesson for that student and offering.
- Grants are tied to lesson IDs, so changing lesson order does not grant access to a newly positioned lesson. A faculty reset records the actor, time, and reason, revokes later grants, and starts a fresh attempt window while preserving the attempt history.
- Correct answers are never returned to student clients. The API grades answers and records results.
- Lessons support a separate student-facing summary and uploaded presentation materials. Quizzes are limited to 20 questions, use a 10-minute time limit, and default to a 75% passing score. Students unlock the next lesson only after passing.
- Faculty grade summaries can be sorted by surname or score, printed or saved as PDF, and downloaded as a spreadsheet-compatible CSV with all quiz attempts.

## API overview

Authentication lives under `/api/auth`. Academic and coursework endpoints live under `/api`: `/dashboard`, `/programs`, `/academic-years`, `/sections`, `/offerings`, `/lessons`, `/quizzes`, and `/students`. The API uses a consistent `{ success, data, error }` response envelope.

The session is an HTTP-only, same-site cookie. Set the exact frontend origin in `CLIENT_ORIGIN`. Production deployments must use HTTPS and a persistent MongoDB database. Uploaded files require an authenticated session and authorization through the associated lesson's course offering.

Faculty can add a PowerPoint from a lesson page using the **Upload a presentation** panel. After upload, **Draft lesson from…** can extract slide text and ask Groq to prepare editable title, description, lesson content, and summary fields. Review the draft before applying it. The extracted text is sent to Groq for processing.

To enable AI drafts, add `GROQ_API_KEY=your-key` to the root `.env` file (the file is gitignored) and restart the server. `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`. The key stays server-side. Without it, PowerPoint upload and in-page viewing still work; AI drafting is disabled.

## Verification

- `npm test` exercises student ID formatting, server quiz scoring, and access-grant behavior when lessons move.
- `npm run build` builds the React app.
- Full endpoint and concurrent-registration checks require a running MongoDB instance; this workspace does not include one.
