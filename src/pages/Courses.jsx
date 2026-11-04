import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleHelp,
  FileText,
  Plus,
  Users,
} from "lucide-react";
import { api, send } from "../api.js";
import { validateRequiredValues } from "../formValidation.js";
import {
  useAuth,
  useData,
  PageHeader,
  Breadcrumbs,
  Loading,
  EmptyPanel,
  semesterLabel,
  StatusBadge,
} from "../shared.jsx";

export function Courses() {
  const { data, loading, error } = useData("/offerings");
  const { session, notify } = useAuth();
  const faculty = session.user.role === "faculty";
  const [courseProgress, setCourseProgress] = useState({});
  const [joinCode, setJoinCode] = useState("");
  const [joinRequests, setJoinRequests] = useState([]);
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    if (faculty || !data?.length) return;
    let active = true;
    Promise.allSettled(data.map(async (offering) => ({
      id: offering._id,
      lessons: await api(`/offerings/${offering._id}/lessons`),
    }))).then((results) => {
      if (!active) return;
      const summaries = Object.fromEntries(data.map((offering, index) => {
        const result = results[index];
        if (result.status !== "fulfilled") return [offering._id, { completed: 0, total: 0, percent: 0, nextTitle: "Progress unavailable" }];
        const { lessons } = result.value;
        const completed = lessons.filter((lesson) => lesson.status === "completed").length;
        const next = lessons.find((lesson) => lesson.status === "available");
        return [offering._id, {
          completed,
          total: lessons.length,
          percent: lessons.length ? Math.round(completed * 100 / lessons.length) : 0,
          nextTitle: next ? `Next: ${next.title}` : lessons.length ? "All lessons complete" : "No lessons published",
        }];
      }));
      setCourseProgress(summaries);
    });
    return () => { active = false; };
  }, [data, faculty]);
  useEffect(() => {
    if (!faculty)
      api("/my-enrollment-requests")
        .then(setJoinRequests)
        .catch((err) => notify(err.message));
  }, [faculty]);
  async function requestEnrollment(event) {
    event.preventDefault();
    if (!validateRequiredValues(event.currentTarget)) return;
    setJoining(true);
    try {
      await api(
        "/enrollment-requests",
        send("POST", { code: joinCode.trim().toUpperCase() }),
      );
      setJoinCode("");
      setJoinRequests(await api("/my-enrollment-requests"));
      notify("Request sent. Faculty will review your enrollment.");
    } catch (err) {
      notify(err.message);
    } finally {
      setJoining(false);
    }
  }
  if (loading) return <Loading variant="courses" />;
  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={faculty ? "YOUR TEACHING LOAD" : "YOUR LEARNING PATH"}
        title={faculty ? "Courses to tend." : "Your courses."}
        detail={
          faculty
            ? "Every class, and the people growing inside it."
            : "A place for each subject, one lesson at a time."
        }
        action={
          faculty && (
            <Link className="button primary" to="/academic-setup">
              <Plus size={16} /> New course
            </Link>
          )
        }
      />
      {!faculty && (
        <section className="panel join-course-panel">
          <div className="join-course-copy">
            <span className="eyebrow">JOIN A SUBJECT</span>
            <h2>Have a course code?</h2>
            <p>
              Enter the invite code from your faculty member. They’ll approve
              your request after checking your program and year level.
            </p>
          </div>
          <form className="join-course-form" onSubmit={requestEnrollment}>
            <label htmlFor="course-invite-code">Course invite code</label>
            <div>
              <input
                id="course-invite-code"
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                minLength={8}
                maxLength={8}
                pattern="[A-HJ-NP-Z2-9]{8}"
                placeholder="8-character code"
                autoComplete="off"
                required
              />
              <button className="button primary" disabled={joining}>
                {joining ? "Sending…" : "Request to join"}
              </button>
            </div>
          </form>
          {joinRequests.length > 0 && (
            <div className="join-request-list">
              <h3>Your course requests</h3>
              {joinRequests.map((request) => (
                <div className="join-request-row" key={request.id}>
                  <span>
                    <b>{request.offering.course?.title}</b>
                    <small>
                      {request.offering.course?.code} ·{" "}
                      {request.offering.section?.name}
                    </small>
                  </span>
                  <span className={`request-status ${request.status}`}>
                    {request.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {error ? (
        <EmptyPanel title="Couldn’t find your courses" body={error} />
      ) : data?.length ? (
        <div className="all-courses-grid">
          {data.map((offering, index) => (
            <Link
              to={`/courses/${offering._id}`}
              className="course-card"
              key={offering._id}
            >
              <div
                className={`card-art course-${["mint", "lilac", "amber", "blue"][index % 4]}`}
              >
                <span>{offering.course?.code}</span>
                <BookOpen size={33} strokeWidth={1.3} />
              </div>
              <div className="course-card-body">
                <div className="course-card-kicker">
                  <span>{semesterLabel(offering.semester)}</span>
                  <span>{offering.academicYear?.label}</span>
                </div>
                <h2>{offering.course?.title}</h2>
                <p>
                  {offering.course?.description ||
                    "A course built around thoughtful practice."}
                </p>
                {faculty ? (
                  <div className="course-enrollment-meter">
                    <div><span>ENROLLMENT</span><b>{offering.students?.length ?? 0}/40</b></div>
                    <span className="course-progress-track"><span style={{ width: `${Math.min(100, (offering.students?.length ?? 0) * 100 / 40)}%` }} /></span>
                  </div>
                ) : courseProgress[offering._id] ? (
                  <div className="course-progress-card">
                    <div><span>LESSON PROGRESS</span><b>{courseProgress[offering._id].percent}%</b></div>
                    <span className="course-progress-track"><span style={{ width: `${courseProgress[offering._id].percent}%` }} /></span>
                    <small>{courseProgress[offering._id].completed} of {courseProgress[offering._id].total} lessons · {courseProgress[offering._id].nextTitle}</small>
                  </div>
                ) : (
                  <div className="course-progress-card is-loading" aria-label="Loading course progress"><span className="skeleton-block skeleton-line" /></div>
                )}
                <div className="course-card-footer">
                  <span>
                    <Users size={14} /> {offering.enrollmentCount ?? offering.students?.length ?? 0}{" "}
                    {offering.enrollmentCount === 1 || offering.students?.length === 1 ? "student" : "students"}
                  </span>
                  <span>
                    {offering.section?.name} <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyPanel
          title={
            faculty ? "Start with a course." : "Your courses are on their way."
          }
          body={
            faculty
              ? "Create a course offering and bring a section together."
              : "When faculty enroll you, your courses will show up here."
          }
          link={faculty ? "/academic-setup" : undefined}
          linkText="Set up a course"
        />
      )}
    </div>
  );
}

export function CoursePage() {
  const { offeringId } = useParams();
  const { session, notify } = useAuth();
  const faculty = session.user.role === "faculty";
  const [lessons, setLessons] = useState(null);
  const [offering, setOffering] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const load = () =>
    Promise.all([api(`/offerings/${offeringId}/lessons`), api("/offerings")])
      .then(([items, all]) => {
        setLessons(items);
        setOffering(all.find((item) => item._id === offeringId));
        setLoadError("");
      })
      .catch((error) => setLoadError(error.message));
  useEffect(() => {
    load();
  }, [offeringId]);
  async function addLesson(event) {
    event.preventDefault();
    const lessonForm = event.currentTarget;
    if (!validateRequiredValues(lessonForm)) return;
    setBusy(true);
    const values = Object.fromEntries(new FormData(lessonForm));
    try {
      await api(
        `/offerings/${offeringId}/lessons`,
        send("POST", {
          ...values,
          sequence: Number(values.sequence),
        }),
      );
      lessonForm.reset();
      notify("Lesson added to the course.");
      await load();
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function moveLesson(lessonId, direction) {
    const next = [...lessons];
    const at = next.findIndex((lesson) => lesson._id === lessonId);
    const target = at + direction;
    if (target < 0 || target >= next.length) return;
    [next[at], next[target]] = [next[target], next[at]];
    try {
      await api(
        `/offerings/${offeringId}/lessons/order`,
        send("PUT", { lessonIds: next.map((lesson) => lesson._id) }),
      );
      notify("Lesson order updated. Earned access stays tied to each lesson.");
      await load();
    } catch (error) {
      notify(error.message);
    }
  }
  if (!lessons && !loadError) return <Loading variant="course-detail" />;
  if (loadError)
    return (
      <div className="page-shell">
        <Link to="/courses" className="back-link">← All courses</Link>
        <section className="panel load-error-panel" role="alert">
          <h1>Couldn’t load this course</h1>
          <p>{loadError}</p>
          <button className="button secondary" onClick={() => { setLessons(null); setLoadError(""); load(); }}>Try again</button>
        </section>
      </div>
    );
  return (
    <div className="page-shell">
      <Breadcrumbs items={[{ label: "Courses", to: "/courses" }, { label: offering?.course?.title || "Course" }]} />
      <PageHeader
        eyebrow={`COURSE · ${offering?.course?.code || "LESSONS"} · ${offering?.section?.name || ""}`}
        title={offering?.course?.title || "Course lessons"}
        detail={offering?.course?.description || `${offering?.academicYear?.label || ""} · ${semesterLabel(offering?.semester || "")}`}
        action={faculty && <span className="year-tag"><Users size={14} /> {offering?.students?.length || 0} students</span>}
      />
      <div className="course-context-strip" aria-label="Course details">
        <span><small>TERM</small><b>{semesterLabel(offering?.semester || "")} · {offering?.academicYear?.label || "Academic year"}</b></span>
        <span><small>SECTION</small><b>{offering?.section?.name || "Section not set"} · {offering?.section?.yearLevel || "Year level not set"}</b></span>
        <span><small>FACULTY</small><b>{offering?.faculty ? `${offering.faculty.firstName} ${offering.faculty.lastName}` : faculty ? "You" : "Faculty member"}</b></span>
        {!faculty && <span><small>YOUR PROGRESS</small><b>{lessons.filter((lesson) => lesson.status === "completed").length} of {lessons.length} lessons complete</b></span>}
      </div>
      <div className="lesson-layout">
        <section className="lesson-list panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">A SEQUENCE, NOT A RACE</span>
              <h2>Course lessons</h2>
            </div>
            <span className="lesson-total">{lessons.filter((lesson) => lesson.status === "completed").length}/{lessons.length} COMPLETE</span>
          </div>
          {lessons.length ? (
            <div className="lesson-items">
              {lessons.map((lesson, index) => (
                <LessonRow
                  lesson={lesson}
                  key={lesson._id}
                  faculty={faculty}
                  index={index}
                  count={lessons.length}
                  previousLessonTitle={lessons[index - 1]?.title}
                  onMove={moveLesson}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="The page is still blank."
              body={faculty ? "Add the first lesson to give this course a path." : "Your faculty member has not published lessons for this course yet."}
            />
          )}
        </section>
        {faculty && (
          <form onSubmit={addLesson} className="panel lesson-create">
            <span className="eyebrow">BUILD THE LEARNING PATH</span>
            <h2>Add a lesson</h2>
            <p>Keep each lesson focused. Students unlock them in sequence.</p>
            <p className="lesson-upload-hint">New lessons stay hidden. Add and publish their quiz, then publish the lesson when it is ready.</p>
            <label>
              Lesson title
              <input
                name="title"
                placeholder="e.g. Variables and data types"
                minLength={2}
                required
              />
            </label>
            <label>
              Short description
              <textarea
                name="description"
                placeholder="What will students learn?"
                rows="3"
              />
            </label>
            <label>
              Lesson content
              <textarea
                name="content"
                placeholder="Write the lesson notes or directions here…"
                rows="5"
              />
            </label>
            <label>
              Lesson summary
              <textarea
                name="summary"
                placeholder="Key ideas students should remember"
                rows="3"
              />
            </label>
            <label>
              Lesson order
              <input
                name="sequence"
                type="number"
                min="1"
                defaultValue={lessons.length + 1}
                required
              />
            </label>
            <button className="button primary" disabled={busy}>
              <Plus size={16} /> {busy ? "Adding…" : "Add lesson"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function LessonRow({ lesson, faculty, index, count, onMove, previousLessonTitle }) {
  const status = lesson.status || (lesson.published ? "available" : "draft");
  const isCurrent = !faculty && status === "available";
  return (
    <div className={`lesson-row ${status}${isCurrent ? " is-current" : ""}`} aria-current={isCurrent ? "step" : undefined}>
      <span
        className={`lesson-step ${status === "completed" ? "step-complete" : status === "locked" ? "step-locked" : ""}`}
      >
        {status === "completed" ? (
          <Check size={15} />
        ) : status === "locked" ? (
          <span className="lock-dot">•</span>
        ) : (
          String(lesson.sequence).padStart(2, "0")
        )}
      </span>
      <div className="lesson-copy">
        <StatusBadge status={faculty && !lesson.published ? "draft" : status}>
          {status === "completed"
            ? "COMPLETED"
            : status === "locked"
              ? "LOCKED"
              : isCurrent
                ? "NEXT UP"
              : faculty && !lesson.published
                ? "DRAFT"
                : "READY WHEN YOU ARE"}
        </StatusBadge>
        <strong>{lesson.title}</strong>
        <small>
          {status === "locked"
            ? index > 0
              ? `Pass “${previousLessonTitle || lesson.previousLessonTitle || "the previous lesson"}” to unlock this lesson.`
              : "This lesson is locked. Ask your faculty member for help."
            : lesson.description ||
            (lesson.quiz
              ? `Assessment · pass ${lesson.quiz.passingPercent}%`
              : "Lesson materials and notes")}
        </small>
      </div>
      {lesson.quiz && (
        <span className="quiz-indicator">
          <CircleHelp size={14} /> Quiz
        </span>
      )}
      {faculty && (
        <div className="reorder-buttons">
          <button
            aria-label={`Move ${lesson.title} up`}
            disabled={index === 0}
            onClick={() => onMove(lesson._id, -1)}
          >
            <ArrowUp size={13} />
          </button>
          <button
            aria-label={`Move ${lesson.title} down`}
            disabled={index === count - 1}
            onClick={() => onMove(lesson._id, 1)}
          >
            <ArrowDown size={13} />
          </button>
        </div>
      )}
      {status !== "locked" && (
        <Link
          aria-label={`Open ${lesson.title}`}
          to={`/lesson/${lesson._id}`}
          className="lesson-open"
        >
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
