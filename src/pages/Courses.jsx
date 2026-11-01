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
import {
  useAuth,
  useData,
  PageHeader,
  Loading,
  EmptyPanel,
} from "../shared.jsx";

export function Courses() {
  const { data, loading, error } = useData("/offerings");
  const { session, notify } = useAuth();
  const faculty = session.user.role === "faculty";
  const [joinCode, setJoinCode] = useState("");
  const [joinRequests, setJoinRequests] = useState([]);
  const [joining, setJoining] = useState(false);
  useEffect(() => {
    if (!faculty)
      api("/my-enrollment-requests")
        .then(setJoinRequests)
        .catch((err) => notify(err.message));
  }, [faculty]);
  async function requestEnrollment(event) {
    event.preventDefault();
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
  if (loading) return <Loading />;
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
                  <span>{offering.semester}</span>
                  <span>{offering.academicYear?.label}</span>
                </div>
                <h2>{offering.course?.title}</h2>
                <p>
                  {offering.course?.description ||
                    "A course built around thoughtful practice."}
                </p>
                <div className="course-card-footer">
                  <span>
                    <Users size={14} /> {offering.students?.length ?? 0}{" "}
                    students
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
  const load = () =>
    Promise.all([api(`/offerings/${offeringId}/lessons`), api("/offerings")])
      .then(([items, all]) => {
        setLessons(items);
        setOffering(all.find((item) => item._id === offeringId));
      })
      .catch((error) => notify(error.message));
  useEffect(() => {
    load();
  }, [offeringId]);
  async function addLesson(event) {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(
        `/offerings/${offeringId}/lessons`,
        send("POST", {
          ...values,
          sequence: Number(values.sequence),
          published: true,
        }),
      );
      event.currentTarget.reset();
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
  if (!lessons) return <Loading />;
  return (
    <div className="page-shell">
      <Link to="/courses" className="back-link">
        ← All courses
      </Link>
      <div className="course-detail-head">
        <div>
          <span className="eyebrow">
            {offering?.course?.code} <span className="eyebrow-dot">·</span>{" "}
            {offering?.section?.name}
          </span>
          <h1>
            {offering?.course?.title || "Course lessons"}
            <span className="title-period">.</span>
          </h1>
          <p className="muted">
            {offering?.course?.description ||
              `${offering?.academicYear?.label || ""} · ${offering?.semester || ""}`}
          </p>
        </div>
        {faculty && (
          <span className="year-tag">
            <Users size={14} /> {offering?.students?.length || 0} students
          </span>
        )}
      </div>
      <div className="lesson-layout">
        <section className="lesson-list panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">A SEQUENCE, NOT A RACE</span>
              <h2>Course lessons</h2>
            </div>
            <span className="lesson-total">{lessons.length} LESSONS</span>
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
                  onMove={moveLesson}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="The page is still blank."
              body="Add the first lesson to give this course a path."
            />
          )}
        </section>
        {faculty && (
          <form onSubmit={addLesson} className="panel lesson-create">
            <span className="eyebrow">BUILD THE LEARNING PATH</span>
            <h2>Add a lesson</h2>
            <p>Keep each lesson focused. Students unlock them in sequence.</p>
            <label>
              Lesson title
              <input
                name="title"
                placeholder="e.g. Variables and data types"
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
            <label>
              Completion requirement
              <select name="completion">
                <option value="quiz">Pass a quiz</option>
                <option value="acknowledgement">Mark lesson complete</option>
              </select>
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

export function LessonRow({ lesson, faculty, index, count, onMove }) {
  const status = lesson.status || (lesson.published ? "available" : "draft");
  return (
    <div className={`lesson-row ${status}`}>
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
        <span className="lesson-status">
          {status === "completed"
            ? "COMPLETED"
            : status === "locked"
              ? "LOCKED"
              : faculty && !lesson.published
                ? "DRAFT"
                : "READY WHEN YOU ARE"}
        </span>
        <strong>{lesson.title}</strong>
        <small>
          {lesson.description ||
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
