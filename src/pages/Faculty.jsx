import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  FileText,
  Plus,
  Printer,
  Sparkles,
  Users,
} from "lucide-react";
import { api, send } from "../api.js";
import { BrandIcon } from "../BrandIcon.jsx";
import {
  useAuth,
  useData,
  PageHeader,
  Loading,
  EmptyPanel,
  fullName,
  initials,
} from "../shared.jsx";

export function StudentsPage() {
  const { data, loading, error } = useData("/offerings");
  const { notify } = useAuth();
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState(null);
  const [requests, setRequests] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [email, setEmail] = useState("");
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
    try {
      await api(`/offerings/${selected}/enrollments`, send("POST", { email }));
      setEmail("");
      notify("Student enrolled in this course.");
      await loadOfferingRoster();
    } catch (err) {
      notify(err.message);
    }
  }
  async function changeYearLevel(studentId, currentYearLevel) {
    try {
      await api(`/offerings/${selected}/students/${studentId}/profile`, {
        method: "PATCH",
        body: JSON.stringify({ currentYearLevel }),
      });
      notify("Student year level updated. Their student ID remains the same.");
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
                <button className="button primary">
                  <Plus size={15} /> Enroll student
                </button>
              </form>
            )}
          </div>
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
                          {student.profile ? (
                            <select
                              className="year-level-select"
                              value={student.profile.currentYearLevel}
                              onChange={(event) =>
                                changeYearLevel(student._id, event.target.value)
                              }
                            >
                              {student.profile.program.yearLevels.map(
                                (level) => (
                                  <option key={level}>{level}</option>
                                ),
                              )}
                            </select>
                          ) : (
                            "—"
                          )}
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
                    {offering.semester} · {offering.academicYear?.label}
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
    <div className="page-shell">
      <header className="faculty-directory-nav">
        <Link className="brand" to="/" aria-label="Modulink home">
          <BrandIcon /> Modulink
        </Link>
        <nav aria-label="Directory navigation">
          <Link to="/">Home</Link>
          {session ? (
            <Link className="button primary" to="/">
              Your workspace
            </Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="button primary" to="/register">
                Create an account
              </Link>
            </>
          )}
        </nav>
      </header>
      <PageHeader
        eyebrow="ALL DEPARTMENTS"
        title="Faculty directory."
        detail="Meet the faculty across campus, grouped by department."
      />
      {error ? (
        <EmptyPanel title="Couldn’t load the faculty list." body={error} />
      ) : (
        <div className="faculty-departments">
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
          item.grade ?? "",
        ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "modulink-quiz-scores.csv";
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
        <div className="roster-toolbar">
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
                  onClick={downloadSpreadsheet}
                >
                  <Download size={15} /> Download spreadsheet
                </button>
              </div>
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
                              className="text-action"
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
            {faculty && (
              <>
                <GradeWeights
                  offeringId={selected}
                  weights={gradeData.weights}
                  onSaved={async () =>
                    setGradeData(await api(`/offerings/${selected}/grades`))
                  }
                />
                <GradeEntry
                  offeringId={selected}
                  onSaved={async () =>
                    setGradeData(await api(`/offerings/${selected}/grades`))
                  }
                />
              </>
            )}
            <h2 className="table-section-title">Course grades</h2>
            {gradeData.courseGrades.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {faculty && <th>STUDENT</th>}
                      <th>QUIZ AVERAGE</th>
                      <th>OTHER COURSEWORK</th>
                      <th>WEIGHTED COURSE GRADE</th>
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
                            {item.otherAverage == null
                              ? "—"
                              : `${item.otherAverage}%`}
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
            <h2 className="table-section-title">Individual grade entries</h2>
            {gradeData.grades.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{faculty ? "STUDENT" : "CATEGORY"}</th>
                      <th>ASSESSMENT</th>
                      <th>SCORE</th>
                      <th>REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeData.grades.map((grade) => (
                      <tr key={grade._id}>
                        <td>
                          {faculty ? fullName(grade.student) : grade.category}
                        </td>
                        <td>{grade.title}</td>
                        <td>
                          {grade.score} / {grade.maxScore}
                        </td>
                        <td>{grade.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted table-empty">
                No additional grades recorded.
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

function GradeWeights({ offeringId, weights, onSaved }) {
  const { notify } = useAuth();
  async function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(
        `/offerings/${offeringId}/grading`,
        send("PUT", {
          quiz: Number(values.quiz),
          other: Number(values.other),
        }),
      );
      notify("Course grading weights updated.");
      await onSaved();
    } catch (error) {
      notify(error.message);
    }
  }
  return (
    <form className="grade-entry grade-weights" onSubmit={save}>
      <div>
        <span className="eyebrow">COURSE GRADE WEIGHTS</span>
        <p>
          Set how quiz and other coursework combine. The weights must total
          100%.
        </p>
      </div>
      <div className="grade-entry-fields">
        <label>
          Quiz assessments %
          <input
            name="quiz"
            type="number"
            min="0"
            max="100"
            defaultValue={weights?.quiz ?? 70}
            required
          />
        </label>
        <label>
          Other coursework %
          <input
            name="other"
            type="number"
            min="0"
            max="100"
            defaultValue={weights?.other ?? 30}
            required
          />
        </label>
        <button className="button secondary">Update weights</button>
      </div>
    </form>
  );
}

export function GradeEntry({ offeringId, onSaved }) {
  const { notify } = useAuth();
  const [students, setStudents] = useState([]);
  useEffect(() => {
    api(`/offerings/${offeringId}/students`)
      .then(setStudents)
      .catch((error) => notify(error.message));
  }, [offeringId]);
  async function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.score = Number(values.score);
    values.maxScore = Number(values.maxScore);
    try {
      await api(`/offerings/${offeringId}/grades`, send("PUT", values));
      notify("Course grade saved.");
      event.currentTarget.reset();
      await onSaved();
    } catch (error) {
      notify(error.message);
    }
  }
  if (!students.length) return null;
  return (
    <form className="grade-entry" onSubmit={save}>
      <div>
        <span className="eyebrow">ADD OR EDIT A COURSE GRADE</span>
        <p>Quiz scores remain separate from course grades.</p>
      </div>
      <div className="grade-entry-fields">
        <select name="student" required defaultValue="">
          <option value="" disabled>
            Choose a student
          </option>
          {students.map((student) => (
            <option value={student._id} key={student._id}>
              {fullName(student)}
            </option>
          ))}
        </select>
        <input name="category" placeholder="Category (e.g. project)" required />
        <input name="title" placeholder="Assessment name" required />
        <input
          name="score"
          type="number"
          min="0"
          step="0.01"
          placeholder="Score"
          required
        />
        <input
          name="maxScore"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Out of"
          required
        />
        <input name="remarks" placeholder="Remark (optional)" />
        <button className="button primary">
          <Plus size={14} /> Save grade
        </button>
      </div>
    </form>
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
    setBusy(true);
    const form = event.currentTarget;
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
    setBusy(true);
    try {
      await api(
        "/auth/department",
        send("PATCH", {
          department: new FormData(event.currentTarget).get("department"),
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
              <input name="code" placeholder="IT 101" required />
            </label>
            <label>
              Course title
              <input
                name="title"
                placeholder="Introduction to Computing"
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
              <select name="semester">
                <option>First Semester</option>
                <option>Second Semester</option>
                <option>Summer</option>
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
