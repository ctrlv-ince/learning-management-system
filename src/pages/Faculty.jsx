import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Download,
  FileText,
  Plus,
  Printer,
  Sparkles,
  Users,
  UserMinus,
} from "lucide-react";
import { api, send } from "../api.js";
import { validateRequiredValues } from "../formValidation.js";
import { BrandIcon } from "../BrandIcon.jsx";
import {
  useAuth,
  useData,
  PageHeader,
  Loading,
  EmptyPanel,
  fullName,
  initials,
  semesterLabel,
} from "../shared.jsx";

export function StudentsPage() {
  const enrollmentLimit = 40;
  const { data, loading, error } = useData("/offerings");
  const { notify } = useAuth();
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState(null);
  const [requests, setRequests] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [removingStudent, setRemovingStudent] = useState("");
  const courseIsFull = (students?.length || 0) >= enrollmentLimit;
  async function loadOfferingRoster(offeringId = selected) {
    if (!offeringId) return;
    const [roster, pending, invite] = await Promise.all([
      api(`/offerings/${offeringId}/students`),
      api(`/offerings/${offeringId}/enrollment-requests`),
      api(`/offerings/${offeringId}/invite-code`),
    ]);
    setStudents(roster);
    setRequests(pending);
    setInviteCode(invite.code);
  }
  useEffect(() => {
    if (selected)
      loadOfferingRoster(selected).catch((err) => notify(err.message));
  }, [selected]);
  async function enroll(event) {
    event.preventDefault();
    if (!validateRequiredValues(event.currentTarget)) return;
    try {
      await api(`/offerings/${selected}/enrollments`, send("POST", { email }));
      setEmail("");
      notify("Student enrolled in this course.");
      await loadOfferingRoster();
    } catch (err) {
      notify(err.message);
    }
  }
  async function createInviteCode() {
    setInviteBusy(true);
    try {
      const result = await api(
        `/offerings/${selected}/invite-code`,
        send("POST", {}),
      );
      setInviteCode(result.code);
      notify("Course invite code created. Any previous code is now invalid.");
    } catch (err) {
      notify(err.message);
    } finally {
      setInviteBusy(false);
    }
  }
  async function revokeInviteCode() {
    try {
      await api(`/offerings/${selected}/invite-code`, { method: "DELETE" });
      setInviteCode(null);
      notify("Course invite code revoked.");
    } catch (err) {
      notify(err.message);
    }
  }
  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      notify("Course invite code copied.");
    } catch {
      notify("Copy is unavailable here. Select and copy the code manually.");
    }
  }
  async function reviewEnrollmentRequest(requestId, status) {
    try {
      await api(
        `/offerings/${selected}/enrollment-requests/${requestId}`,
        send("PATCH", { status }),
      );
      notify(status === "approved" ? "Student enrolled." : "Request declined.");
      await loadOfferingRoster();
    } catch (err) {
      notify(err.message);
    }
  }
  async function removeStudent(student) {
    const studentName = fullName(student);
    if (
      !window.confirm(
        `Remove ${studentName} from this course? They will lose access. Quiz attempts and grade records will be retained.`,
      )
    )
      return;
    setRemovingStudent(String(student._id));
    try {
      await api(`/offerings/${selected}/students/${student._id}`, {
        method: "DELETE",
      });
      notify(`${studentName} was removed from this course.`);
      await loadOfferingRoster();
    } catch (err) {
      notify(err.message);
    } finally {
      setRemovingStudent("");
    }
  }
  if (loading) return <Loading />;
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="THE PEOPLE IN YOUR COURSES"
        title="Enrolled students."
        detail="Choose a subject to see the students enrolled in that course."
      />
      {error ? (
        <EmptyPanel title="Couldn’t load course roster" body={error} />
      ) : (
        <section className="panel roster-panel">
          <div className="roster-toolbar">
            <label>
              Course offering
              <select
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setStudents(null);
                  setRequests(null);
                  setInviteCode(null);
                }}
              >
                <option value="">Choose a course</option>
                {data?.map((item) => (
                  <option value={item._id} key={item._id}>
                    {item.course?.code} · {item.course?.title} ·{" "}
                    {item.section?.name} ({item.section?.yearLevel})
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <form className="enroll-form" onSubmit={enroll}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Student email address"
                  required
                />
                <button className="button primary" disabled={courseIsFull}>
                  <Plus size={15} /> Enroll student
                </button>
              </form>
            )}
          </div>
          {selected && students && (
            <p className={`enrollment-capacity ${courseIsFull ? "full" : ""}`}>
              {students.length} / {enrollmentLimit} students enrolled
              {courseIsFull ? " · Course is full" : ""}
            </p>
          )}
          {selected && (
            <div className="faculty-join-tools">
              <section className="invite-code-card">
                <div>
                  <span className="eyebrow">COURSE INVITE CODE</span>
                  <h2>Let eligible students request to join.</h2>
                  <p>
                    Share this code with students in the matching program and
                    year level. You approve each request before enrollment.
                  </p>
                  {inviteCode ? (
                    <code>{inviteCode}</code>
                  ) : (
                    <span className="invite-code-empty">No active code</span>
                  )}
                </div>
                <div className="invite-code-actions no-print">
                  <button
                    type="button"
                    className="button primary"
                    disabled={inviteBusy}
                    onClick={createInviteCode}
                  >
                    {inviteBusy
                      ? "Creating…"
                      : inviteCode
                        ? "Rotate code"
                        : "Create code"}
                  </button>
                  {inviteCode && (
                    <>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={copyInviteCode}
                      >
                        Copy code
                      </button>
                      <button
                        type="button"
                        className="text-action"
                        onClick={revokeInviteCode}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </section>
              <section className="enrollment-requests-card">
                <div className="enrollment-requests-heading">
                  <div>
                    <span className="eyebrow">REVIEW BEFORE ENROLLING</span>
                    <h2>Join requests</h2>
                  </div>
                  <span>{requests?.length ?? "…"} pending</span>
                </div>
                {requests?.length ? (
                  <div className="enrollment-request-list">
                    {requests.map((request) => (
                      <div className="enrollment-request-row" key={request.id}>
                        <div className="table-person">
                          <span className="avatar">
                            {initials(request.student)}
                          </span>
                          <span>
                            <b>{fullName(request.student)}</b>
                            <small>{request.student.email}</small>
                            <small>
                              {request.student.program || "Program unavailable"}{" "}
                              ·{" "}
                              {request.student.yearLevel || "Year unavailable"}
                            </small>
                          </span>
                        </div>
                        <div className="enrollment-request-actions no-print">
                          <button
                            type="button"
                            className="button primary"
                            disabled={courseIsFull}
                            onClick={() =>
                              reviewEnrollmentRequest(request.id, "approved")
                            }
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() =>
                              reviewEnrollmentRequest(request.id, "rejected")
                            }
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    {requests
                      ? "No pending requests for this subject."
                      : "Loading requests…"}
                  </p>
                )}
              </section>
            </div>
          )}
          {selected && students ? (
            students.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>STUDENT ID</th>
                      <th>PROGRAM</th>
                      <th>YEAR LEVEL</th>
                      <th className="no-print">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student._id}>
                        <td>
                          <div className="table-person">
                            <span className="avatar">{initials(student)}</span>
                            <span>
                              <b>{fullName(student)}</b>
                              <small>{student.email}</small>
                            </span>
                          </div>
                        </td>
                        <td>{student.profile?.studentId || "—"}</td>
                        <td>{student.profile?.program?.code || "—"}</td>
                        <td>
                          {student.profile?.currentYearLevel || "Not set"}
                        </td>
                        <td className="no-print">
                          <button
                            type="button"
                            className="remove-enrollment-button"
                            disabled={removingStudent === String(student._id)}
                            onClick={() => removeStudent(student)}
                            aria-label={`Remove ${fullName(student)} from this course`}
                          >
                            <UserMinus size={15} />
                            {removingStudent === String(student._id)
                              ? "Removing…"
                              : "Remove"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyPanel
                title="No students yet."
                body="Enroll a student with their registered email address."
              />
            )
          ) : (
            <div className="roster-empty">
              <Users size={22} />
              <span>
                Select one of your course offerings to see its students.
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function StudentClassmatesPage() {
  const { data, loading, error } = useData("/classmates");
  if (loading) return <Loading />;
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="LEARNING TOGETHER"
        title="Classmates."
        detail="Students enrolled in the same subjects as you, organized by course."
      />
      {error ? (
        <EmptyPanel title="Couldn’t load your classmates." body={error} />
      ) : data?.length ? (
        <div className="classmates-list">
          {data.map((offering) => (
            <section className="panel classmates-course" key={offering.id}>
              <div className="classmates-course-heading">
                <span className="classmates-course-icon">
                  <BookOpen size={17} />
                </span>
                <div>
                  <span className="eyebrow">
                    {offering.course?.code} · {offering.section?.name} ·{" "}
                    {offering.section?.yearLevel}
                  </span>
                  <h2>{offering.course?.title}</h2>
                  <p>
                    {semesterLabel(offering.semester)} ·{" "}
                    {offering.academicYear?.label}
                  </p>
                </div>
                <span className="classmates-total">
                  {offering.classmates.length} classmates
                </span>
              </div>
              {offering.classmates.length ? (
                <div className="classmate-people">
                  {offering.classmates.map((person) => (
                    <div className="classmate-person" key={person.id}>
                      <span className="avatar">{initials(person)}</span>
                      <span>{fullName(person)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="faculty-empty">
                  You’re the only student enrolled in this subject so far.
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <EmptyPanel
          title="No course enrollments yet."
          body="Your classmates will appear here after faculty enrolls you in a subject."
          link="/courses"
          linkText="View my courses"
        />
      )}
    </div>
  );
}

export function FacultyDirectoryPage() {
  const { data, loading, error } = useData("/faculty");
  const { session } = useAuth();
  if (loading) return <Loading />;
  return (
    <main className="landing-page faculty-directory-page">
      <header className="landing-nav">
        <Link className="brand" to="/welcome" aria-label="Modulink home">
          <BrandIcon /> Modulink
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/welcome">Home</Link>
          <a href="#departments">Departments</a>
          {session ? (
            <Link className="button primary" to="/">
              Your workspace <ArrowRight size={15} />
            </Link>
          ) : (
            <>
              <Link className="landing-signin" to="/login">
                Sign in <ArrowUpRight size={14} />
              </Link>
              <Link className="button primary" to="/register">
                Create an account
              </Link>
            </>
          )}
        </nav>
      </header>
      <div className="faculty-directory-content">
        <PageHeader
          eyebrow="ALL DEPARTMENTS"
          title="Faculty directory."
          detail="Meet the faculty across campus, grouped by department."
        />
        {error ? (
          <EmptyPanel title="Could not load the faculty list." body={error} />
        ) : (
          <div className="faculty-departments" id="departments">
            {data?.map((department) => (
              <section className="faculty-department" key={department.code}>
                <div className="faculty-department-heading">
                  <span className="eyebrow">{department.code}</span>
                  <h2>{department.name}</h2>
                  <span className="faculty-count">
                    {department.faculty.length} faculty
                  </span>
                </div>
                {department.faculty.length ? (
                  <div className="faculty-directory-grid">
                    {department.faculty.map((person) => (
                      <article
                        className="panel faculty-directory-card"
                        key={person.id}
                      >
                        <span className="avatar">{initials(person)}</span>
                        <div>
                          <h3>{fullName(person)}</h3>
                          <span className="faculty-directory-label">
                            FACULTY MEMBER
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="faculty-empty">
                    Faculty members will appear here when their profiles are set
                    up.
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export function GradesPage() {
  const { data: offerings, loading } = useData("/offerings");
  const { session, notify } = useAuth();
  const [selected, setSelected] = useState("");
  const [gradeData, setGradeData] = useState(null);
  const [reportSort, setReportSort] = useState("surname");
  const faculty = session.user.role === "faculty";
  const orderedAttempts = gradeData?.attempts
    ? [...gradeData.attempts].sort((a, b) => {
        if (reportSort === "score")
          return (
            (b.percent ?? 0) - (a.percent ?? 0) ||
            (a.student?.lastName || "").localeCompare(b.student?.lastName || "")
          );
        return (
          (a.student?.lastName || "").localeCompare(
            b.student?.lastName || "",
          ) ||
          (a.student?.firstName || "").localeCompare(
            b.student?.firstName || "",
          ) ||
          new Date(b.submittedAt) - new Date(a.submittedAt)
        );
      })
    : [];
  const orderedCourseGrades = gradeData?.courseGrades
    ? [...gradeData.courseGrades].sort((a, b) =>
        reportSort === "score"
          ? (b.grade ?? -1) - (a.grade ?? -1) ||
            (a.student?.lastName || "").localeCompare(b.student?.lastName || "")
          : (a.student?.lastName || "").localeCompare(
              b.student?.lastName || "",
            ) ||
            (a.student?.firstName || "").localeCompare(
              b.student?.firstName || "",
            ),
      )
    : [];
  const quizScoreLookup = new Map();
  const attemptsByStudentQuiz = new Map();
  for (const attempt of [...(gradeData?.attempts || [])].sort(
    (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
  )) {
    const studentId = String(attempt.student?._id || attempt.student);
    const quizId = String(attempt.quiz?._id || attempt.quiz);
    const key = `${studentId}:${quizId}`;
    if (!attemptsByStudentQuiz.has(key)) attemptsByStudentQuiz.set(key, []);
    attemptsByStudentQuiz.get(key).push(attempt);
    if (attempt.quiz?._id) quizScoreLookup.set(key, attempt);
  }
  const currentQuizRun = new Map(
    [...attemptsByStudentQuiz].map(([key, history]) => {
      const previousPassedIndex = history.findLastIndex(
        (attempt, index) => attempt.passed && index < history.length - 1,
      );
      const run = history.slice(previousPassedIndex + 1);
      return [key, { count: run.length, passed: run.at(-1)?.passed || false }];
    }),
  );
  const orderedQuizSummary = [...orderedCourseGrades].sort((a, b) =>
    reportSort === "score"
      ? (b.quizAverage ?? -1) - (a.quizAverage ?? -1) ||
        (a.student?.lastName || "").localeCompare(b.student?.lastName || "")
      : (a.student?.lastName || "").localeCompare(b.student?.lastName || "") ||
        (a.student?.firstName || "").localeCompare(b.student?.firstName || ""),
  );
  useEffect(() => {
    if (selected)
      api(`/offerings/${selected}/grades`)
        .then(setGradeData)
        .catch((error) => notify(error.message));
  }, [selected]);
  if (loading) return <Loading />;
  async function resetProgress(attempt) {
    if (
      !window.confirm(
        `Reset ${fullName(attempt.student)}’s progress for ${attempt.quiz?.lesson?.title || "this lesson"}?`,
      )
    )
      return;
    try {
      await api(
        `/students/${attempt.student._id}/lessons/${attempt.quiz.lesson._id}/reset`,
        send("POST", { reason: "Faculty progress reset" }),
      );
      notify("Student progress reset. Past attempts remain in the gradebook.");
      setGradeData(await api(`/offerings/${selected}/grades`));
    } catch (error) {
      notify(error.message);
    }
  }
  function downloadSpreadsheet() {
    if (!gradeData) return;
    const gradeByStudent = new Map(
      gradeData.courseGrades.map((item) => [
        String(item.studentId),
        item.grade,
      ]),
    );
    const attemptedStudents = new Set(
      orderedAttempts.map((attempt) => String(attempt.student?._id)),
    );
    const rows = [
      [
        "Surname",
        "First name",
        "Quiz / lesson",
        "Score",
        "Percent",
        "Result",
        "Attempts in current run",
        "Submitted",
        "Course grade",
      ],
      ...orderedAttempts.map((attempt) => [
        attempt.student?.lastName || "",
        attempt.student?.firstName || "",
        attempt.quiz?.lesson?.title || "Lesson quiz",
        `${attempt.earnedPoints} / ${attempt.totalPoints}`,
        `${attempt.percent ?? 0}%`,
        attempt.passed ? "Passed" : "Needs another try",
        currentQuizRun.get(
          `${String(attempt.student?._id || attempt.student)}:${String(attempt.quiz?._id || attempt.quiz)}`,
        )?.count ?? "",
        new Date(attempt.submittedAt).toLocaleString(),
        gradeByStudent.get(String(attempt.student?._id)) ?? "",
      ]),
      ...orderedCourseGrades
        .filter(
          (item) =>
            item.student && !attemptedStudents.has(String(item.studentId)),
        )
        .map((item) => [
          item.student.lastName || "",
          item.student.firstName || "",
          "",
          "",
          "",
          "No attempts",
          "",
          "",
          item.grade ?? "",
        ]),
    ];
    saveCsv("modulink-quiz-attempt-details.csv", rows);
  }
  function downloadSummarySpreadsheet() {
    if (!gradeData) return;
    const quizColumns = gradeData.quizColumns || [];
    const rows = [
      [
        "Surname",
        "First name",
        ...quizColumns.flatMap((quiz) => [
          `Lesson ${quiz.sequence}: ${quiz.title}`,
          `Lesson ${quiz.sequence}: attempts in current run`,
        ]),
        "Quiz average (latest attempt per quiz)",
        "Quiz-only course grade",
      ],
      ...orderedQuizSummary.map((item) => [
        item.student?.lastName || "",
        item.student?.firstName || "",
        ...quizColumns.flatMap((quiz) => {
          const attempt = quizScoreLookup.get(`${item.studentId}:${quiz.id}`);
          const run = currentQuizRun.get(`${item.studentId}:${quiz.id}`);
          return [attempt ? `${attempt.percent ?? 0}%` : "", run?.count ?? ""];
        }),
        item.quizAverage == null ? "" : `${item.quizAverage}%`,
        item.grade == null ? "" : `${item.grade}%`,
      ]),
    ];
    const courseCode = offerings
      ?.find((offering) => offering._id === selected)
      ?.course?.code?.toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");
    saveCsv(`modulink-${courseCode || "course"}-quiz-score-summary.csv`, rows);
  }
  function saveCsv(filename, rows) {
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
            return `"${safe.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={faculty ? "ASSESSMENTS & COURSEWORK" : "YOUR ACADEMIC RECORD"}
        title={faculty ? "The gradebook." : "Your results."}
        detail={
          faculty
            ? "Scores, progress, and the context around each student."
            : "A clear account of the work you’ve done."
        }
      />
      <section className="panel gradebook-panel">
        <div className="roster-toolbar no-print">
          <label>
            Course offering
            <select
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                setGradeData(null);
              }}
            >
              <option value="">Choose a course</option>
              {offerings?.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.course?.code} · {item.section?.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!selected ? (
          <div className="roster-empty">
            <FileText size={22} />
            <span>Select a course to see grades and quiz attempts.</span>
          </div>
        ) : gradeData ? (
          <>
            {faculty && (
              <h2 className="grade-report-print-title">
                {offerings?.find((item) => item._id === selected)?.course
                  ?.title || "Course"}{" "}
                · Quiz score report
              </h2>
            )}
            {faculty && (
              <div className="gradebook-actions no-print">
                <label>
                  Sort summary by
                  <select
                    value={reportSort}
                    onChange={(event) => setReportSort(event.target.value)}
                  >
                    <option value="surname">Surname</option>
                    <option value="score">Score (highest first)</option>
                  </select>
                </label>
                <button
                  className="button secondary"
                  onClick={() => window.print()}
                >
                  <Printer size={15} /> Print / Save PDF
                </button>
                <button
                  className="button secondary"
                  onClick={downloadSummarySpreadsheet}
                >
                  <Download size={15} /> Quiz score summary
                </button>
                <button
                  className="button secondary"
                  onClick={downloadSpreadsheet}
                >
                  <FileText size={15} /> Attempt details
                </button>
              </div>
            )}
            {faculty && (
              <>
                <h2 className="table-section-title">
                  All quiz scores per student
                </h2>
                {gradeData.quizColumns?.length ? (
                  <div className="table-wrap">
                    <table className="quiz-score-summary-table">
                      <thead>
                        <tr>
                          <th>STUDENT</th>
                          {gradeData.quizColumns.map((quiz) => (
                            <th key={quiz.id}>
                              LESSON {String(quiz.sequence).padStart(2, "0")} ·{" "}
                              {quiz.title}
                            </th>
                          ))}
                          <th>QUIZ AVG.</th>
                          <th>COURSE GRADE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderedQuizSummary.map((item) => (
                          <tr key={item.studentId}>
                            <td>{fullName(item.student) || "Student"}</td>
                            {gradeData.quizColumns.map((quiz) => {
                              const attempt = quizScoreLookup.get(
                                `${item.studentId}:${quiz.id}`,
                              );
                              const run = currentQuizRun.get(
                                `${item.studentId}:${quiz.id}`,
                              );
                              return (
                                <td key={quiz.id}>
                                  {attempt ? `${attempt.percent ?? 0}%` : "—"}
                                  {run && (
                                    <small className="grade-attempt-count">
                                      {run.passed
                                        ? `Passed in ${run.count} attempt${run.count === 1 ? "" : "s"}`
                                        : `${run.count} attempt${run.count === 1 ? "" : "s"} so far`}
                                    </small>
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              {item.quizAverage == null
                                ? "—"
                                : `${item.quizAverage}%`}
                            </td>
                            <td>
                              {item.grade == null ? "—" : `${item.grade}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted table-empty">
                    No quizzes have been added to this course yet.
                  </p>
                )}
              </>
            )}
            <h2 className="table-section-title">Quiz attempts</h2>
            {gradeData.attempts.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{faculty ? "STUDENT" : "ASSESSMENT"}</th>
                      <th>RESULT</th>
                      <th>SCORE</th>
                      <th>DATE</th>
                      {faculty && <th>PROGRESS</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {orderedAttempts.map((attempt) => (
                      <tr key={attempt._id}>
                        <td>
                          {faculty
                            ? fullName(attempt.student)
                            : attempt.quiz?.lesson?.title || "Lesson quiz"}
                        </td>
                        <td>
                          <span
                            className={`grade-status ${attempt.passed ? "good" : "needs-work"}`}
                          >
                            {attempt.passed ? "Passed" : "Needs another try"}
                          </span>
                        </td>
                        <td>
                          {attempt.earnedPoints} / {attempt.totalPoints}{" "}
                          <small>({attempt.percent}%)</small>
                        </td>
                        <td>
                          {new Date(attempt.submittedAt).toLocaleDateString()}
                        </td>
                        {faculty && (
                          <td>
                            <button
                              className="text-action no-print"
                              onClick={() => resetProgress(attempt)}
                            >
                              Reset progress
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted table-empty">No quiz attempts yet.</p>
            )}
            <h2 className="table-section-title">Course grades</h2>
            <p className="muted gradebook-calculation-note">
              Course grades use quiz scores from assessments completed on
              Modulink.
            </p>
            {gradeData.courseGrades.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {faculty && <th>STUDENT</th>}
                      <th>QUIZ AVERAGE</th>
                      <th>QUIZ COURSE GRADE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedCourseGrades.map((item) => {
                      return (
                        <tr key={item.studentId}>
                          {faculty && (
                            <td>{fullName(item.student) || "Student"}</td>
                          )}
                          <td>
                            {item.quizAverage == null
                              ? "—"
                              : `${item.quizAverage}%`}
                          </td>
                          <td>
                            {item.grade == null
                              ? "No grades yet"
                              : `${item.grade}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted table-empty">
                No enrolled students or grades recorded.
              </p>
            )}
          </>
        ) : (
          <Loading />
        )}
      </section>
    </div>
  );
}

export function AcademicSetup() {
  const { notify, session, setSession } = useAuth();
  const { data: initial } = useData("/auth/options");
  const [academic, setAcademic] = useState({
    programs: [],
    departments: [],
    academicYears: [],
    sections: [],
  });
  const [offerings, setOfferings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sectionProgram, setSectionProgram] = useState("");
  const department = academic.departments.find(
    (item) => item.name === session.profile?.department,
  );
  const departmentPrograms = academic.programs.filter(
    (program) => program.department === department?.code,
  );
  useEffect(() => {
    if (initial) setAcademic(initial);
    api("/offerings")
      .then(setOfferings)
      .catch(() => {});
  }, [initial]);
  async function create(event, endpoint, transform = (value) => value) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validateRequiredValues(form)) return;
    setBusy(true);
    const values = transform(Object.fromEntries(new FormData(form)));
    try {
      await api(endpoint, send("POST", values));
      form.reset();
      notify("Saved. Your academic structure has been updated.");
      const fresh = await api("/auth/options");
      setAcademic(fresh);
      setOfferings(await api("/offerings"));
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function updateDepartment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validateRequiredValues(form)) return;
    setBusy(true);
    try {
      await api(
        "/auth/department",
        send("PATCH", {
          department: new FormData(form).get("department"),
        }),
      );
      setSession(await api("/auth/me"));
      notify("Your department has been set.");
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="SET A THOUGHTFUL FOUNDATION"
        title="Academic setup."
        detail="Shape the programs, years, and sections your classes are built around."
      />
      {!department && (
        <section className="panel setup-card department-setup">
          <span className="eyebrow">FACULTY DEPARTMENT</span>
          <h2>Choose your department.</h2>
          <p>
            Your department controls which programs, sections, and students you
            can work with.
          </p>
          <form className="form-stack" onSubmit={updateDepartment}>
            <label>
              Department
              <select name="department" required defaultValue="">
                <option value="" disabled>
                  Choose your department
                </option>
                {academic.departments.map((item) => (
                  <option key={item.code} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" disabled={busy}>
              Save department
            </button>
          </form>
        </section>
      )}
      <div className="setup-grid">
        <section className="panel setup-card">
          <span className="setup-index">01</span>
          <span className="eyebrow">DEPARTMENT CATALOG</span>
          <h2>{department?.name || "Programs by department."}</h2>
          <div className="catalog-list">
            {(department ? [department] : academic.departments).map((item) => (
              <div key={item.code}>
                {!department && (
                  <span className="catalog-department">{item.name}</span>
                )}
                {academic.programs
                  .filter((program) => program.department === item.code)
                  .map((program) => (
                    <div className="catalog-program" key={program._id}>
                      <b>{program.code}</b>
                      <span>{program.name}</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </section>
        <section className="panel setup-card">
          <span className="setup-index">02</span>
          <span className="eyebrow">ACADEMIC YEAR</span>
          <h2>Set the current year.</h2>
          <form
            onSubmit={(event) =>
              create(event, "/academic-years", (value) => ({
                ...value,
                current: value.current === "on",
              }))
            }
            className="form-stack"
          >
            <label>
              Year label
              <input
                name="label"
                placeholder="2026-2027"
                pattern="\d{4}-\d{4}"
                required
              />
            </label>
            <label className="publish-check">
              <input name="current" type="checkbox" /> Mark this as the current
              academic year
            </label>
            <button disabled={busy} className="button primary">
              <Plus size={15} /> Add academic year
            </button>
          </form>
        </section>
        <section className="panel setup-card">
          <span className="setup-index">03</span>
          <span className="eyebrow">CLASS SECTION</span>
          <h2>Bring a section together.</h2>
          <form
            onSubmit={(event) => create(event, "/sections")}
            className="form-stack"
          >
            <label>
              Section name
              <input name="name" placeholder="IT-1A" required />
            </label>
            <label>
              Degree program
              <select
                name="program"
                required
                value={sectionProgram}
                onChange={(event) => setSectionProgram(event.target.value)}
              >
                <option value="">Choose a program</option>
                {departmentPrograms.map((p) => (
                  <option value={p._id} key={p._id}>
                    {p.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Year level
              <select name="yearLevel" required defaultValue="">
                <option value="">Choose a year</option>
                {(
                  departmentPrograms.find(
                    (program) => program._id === sectionProgram,
                  )?.yearLevels || []
                ).map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            <label>
              Academic year
              <select name="academicYear" required>
                <option value="">Choose a year</option>
                {academic.academicYears?.map((year) => (
                  <option value={year._id} key={year._id}>
                    {year.label}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy} className="button primary">
              <Plus size={15} /> Add section
            </button>
          </form>
        </section>
        <section className="panel setup-card">
          <span className="setup-index">04</span>
          <span className="eyebrow">COURSE OFFERING</span>
          <h2>Open a course.</h2>
          <form
            onSubmit={(event) => create(event, "/offerings")}
            className="form-stack"
          >
            <label>
              Course code
              <input name="code" placeholder="IT 101" minLength={2} required />
            </label>
            <label>
              Course title
              <input
                name="title"
                placeholder="Introduction to Computing"
                minLength={2}
                required
              />
            </label>
            <label>
              Short description
              <textarea name="description" rows="2" />
            </label>
            <label>
              Academic year
              <select name="academicYear" required>
                <option value="">Choose a year</option>
                {academic.academicYears?.map((year) => (
                  <option value={year._id} key={year._id}>
                    {year.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Semester
              <select name="semester" required>
                <option>First Semester</option>
                <option>Second Semester</option>
                <option>Third Semester</option>
              </select>
            </label>
            <label>
              Section
              <select name="section" required>
                <option value="">Choose a section</option>
                {academic.sections
                  ?.filter(
                    (section) =>
                      section.program?.department === department?.code,
                  )
                  .map((section) => (
                    <option value={section._id} key={section._id}>
                      {section.name} · {section.yearLevel}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy} className="button primary">
              <Plus size={15} /> Create course offering
            </button>
          </form>
        </section>
      </div>
      <div className="setup-footnote">
        <Sparkles size={15} />
        <span>
          Courses belong to a section and academic period. Students are enrolled
          individually from the <Link to="/students">roster</Link>.
        </span>
      </div>
      {offerings.length > 0 && (
        <section className="panel setup-offerings">
          <span className="eyebrow">CREATED IN YOUR SPACE</span>
          <h2>Courses ready to grow.</h2>
          {offerings.map((item) => (
            <Link
              key={item._id}
              to={`/courses/${item._id}`}
              className="simple-course-row"
            >
              <span className="course-index course-mint">01</span>
              <b>
                {item.course?.code} — {item.course?.title}
              </b>
              <span>{item.section?.name}</span>
              <ArrowRight size={15} />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
