import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Sparkles,
  Users,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { api, send } from "../api.js";
import { validateRequiredValues } from "../formValidation.js";
import {
  useAuth,
  useData,
  PageHeader,
  Loading,
  EmptyPanel,
  CourseRow,
  fullName,
  initials,
} from "../shared.jsx";

export function Dashboard() {
  const { session } = useAuth();
  const { data, loading, error, refresh } = useData("/dashboard");
  const faculty = session.user.role === "faculty";
  if (loading) return <Loading variant="dashboard" />;
  if (!data)
    return (
      <div className="page-shell">
        <section className="panel load-error-panel" role="alert">
          <h2>Couldn’t load your overview</h2>
          <p>{error || "Check your connection, then try again."}</p>
          <button className="button secondary" onClick={refresh}>Try again</button>
        </section>
      </div>
    );
  return (
    <div className="page-shell">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">
            {new Intl.DateTimeFormat("en", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
              .format(new Date())
              .toUpperCase()}
          </span>
          <h1>
            {faculty ? "A good day to teach, " : "Welcome back, "}
            {session.user.firstName}
            <span className="title-period">.</span>
          </h1>
          <p className="muted">
            {faculty
              ? "Here’s what’s moving across your classes."
              : "A few steady steps can take you a long way."}
          </p>
        </div>
        <div className="welcome-decoration">
          <span>✳</span>
          <i>YOUR SPACE, IN GOOD ORDER</i>
        </div>
      </div>
      {faculty ? (
        <FacultyDashboard data={data} />
      ) : (
        <StudentDashboard data={data} profile={data.profile} />
      )}
    </div>
  );
}

export function FacultyDashboard({ data }) {
  const stats = [
    {
      label: "Courses in motion",
      value: data.stats.courses,
      icon: BookOpen,
      note: "assigned this term",
      tone: "mint",
    },
    {
      label: "Students learning",
      value: data.stats.students,
      icon: Users,
      note: "across your courses",
      tone: "lavender",
    },
    {
      label: "Lessons shared",
      value: data.stats.lessons,
      icon: FileText,
      note: `${data.stats.quizzes} assessments`,
      tone: "peach",
    },
  ];
  return (
    <>
      <section className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className={`stat-icon ${stat.tone}`}>
              <stat.icon size={18} />
            </div>
            <span className="stat-label">{stat.label}</span>
            <strong className="stat-value">{stat.value}</strong>
            <span className="stat-note">{stat.note}</span>
          </div>
        ))}
      </section>
      <div className="dashboard-grid faculty-grid">
        <section className="panel courses-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR CLASSROOM</span>
              <h2>Courses to tend</h2>
            </div>
            <Link className="text-link" to="/courses">
              All courses <ArrowRight size={14} />
            </Link>
          </div>
          {data.offerings.length ? (
            <div className="course-list">
              {data.offerings.slice(0, 5).map((offering, i) => (
                <div className="dashboard-course-actions" key={offering._id}>
                  <CourseRow offering={offering} index={i} showRoster />
                  <div className="quick-course-links">
                    <Link to={`/courses/${offering._id}`}>Manage lessons</Link>
                    <Link to={`/students?offering=${encodeURIComponent(offering._id)}`}>View students</Link>
                    <Link to={`/grades?offering=${encodeURIComponent(offering._id)}`}>Open gradebook</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="A blank page is a good start."
              body="Create your first course offering to bring a class together."
              link="/academic-setup"
              linkText="Set up a course"
            />
          )}
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">A LITTLE MOVEMENT</span>
              <h2>Recent assessments</h2>
            </div>
            <Activity size={18} className="subtle-icon" />
          </div>
          {data.recentAttempts.length ? (
            <div className="activity-list">
              {data.recentAttempts.slice(0, 5).map((attempt) => (
                <div className="activity-item" key={attempt._id}>
                  <span
                    className={`activity-dot ${attempt.passed ? "passed" : "failed"}`}
                  />
                  <div>
                    <strong>{fullName(attempt.student)}</strong>
                    <small>
                      {attempt.passed
                        ? "Passed an assessment"
                        : "Needs another try"}
                    </small>
                  </div>
                  <span
                    className={`score-chip ${attempt.passed ? "pass" : "fail"}`}
                  >
                    {attempt.percent}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="quiet-empty">
              <span className="quiet-icon">
                <Sparkles size={18} />
              </span>
              <strong>The first steps are still ahead.</strong>
              <p>Student activity will appear here.</p>
            </div>
          )}
          <div className="outcome-strip">
            <div>
              <span className="outcome-mark good">
                <Check size={13} />
              </span>
              <span>Passed</span>
              <b>{data.stats.passed}</b>
            </div>
            <div>
              <span className="outcome-mark retry">
                <ArrowDownRight size={13} />
              </span>
              <span>Needs a retry</span>
              <b>{data.stats.failed}</b>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export function StudentDashboard({ data, profile }) {
  const { session, notify } = useAuth();
  const progress = data.progress;
  const marks = data.weeklyActivity || [];
  const [yearLevel, setYearLevel] = useState(profile?.currentYearLevel || "");
  const [sectionName, setSectionName] = useState(
    profile?.section?.name || "Section not assigned",
  );
  const [savingYearLevel, setSavingYearLevel] = useState(false);
  const [nextLesson, setNextLesson] = useState(null);
  const [courseProgress, setCourseProgress] = useState({});
  const [nextLessonLoading, setNextLessonLoading] = useState(true);
  const [nextLessonError, setNextLessonError] = useState("");
  const [nextLessonRetry, setNextLessonRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function findNextLesson() {
      setNextLessonLoading(true);
      setNextLessonError("");
      try {
        const lessonResults = await Promise.allSettled(
          (data.offerings || []).map(async (offering) => ({
            offering,
            lessons: await api(`/offerings/${offering._id}/lessons`),
          })),
        );
        const successfulLessons = lessonResults
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value);
        const loadedById = new Map(successfulLessons.map(({ offering, lessons }) => [String(offering._id), lessons]));
        const summaries = Object.fromEntries((data.offerings || []).map((offering) => {
          const lessons = loadedById.get(String(offering._id));
          if (!lessons) return [offering._id, { completed: 0, total: 0, percent: 0, nextTitle: "Progress unavailable" }];
          const completed = lessons.filter((lesson) => lesson.status === "completed").length;
          const next = lessons.find((lesson) => lesson.status === "available");
          return [offering._id, {
            completed,
            total: lessons.length,
            percent: lessons.length ? Math.round((completed * 100) / lessons.length) : 0,
            nextTitle: next ? `Next: ${next.title}` : lessons.length ? "All lessons complete" : "No lessons published",
          }];
        }));
        const candidate = successfulLessons
          .flatMap(({ offering, lessons }) => lessons.map((lesson) => ({ ...lesson, offering })))
          .find((lesson) => lesson.status === "available");
        if (active) setCourseProgress(summaries);
        if (active) {
          setNextLesson(candidate || null);
          if (!successfulLessons.length && data.offerings.length) setNextLessonError("Course progress is temporarily unavailable.");
        }
      } catch (error) {
        if (active) {
          setNextLesson(null);
          setNextLessonError(error.message || "Could not check lesson access.");
        }
      } finally {
        if (active) setNextLessonLoading(false);
      }
    }
    findNextLesson();
    return () => { active = false; };
  }, [data.offerings, nextLessonRetry]);
  useEffect(() => {
    setYearLevel(profile?.currentYearLevel || "");
    setSectionName(profile?.section?.name || "Section not assigned");
  }, [profile?.currentYearLevel, profile?.section?.name]);
  async function updateYearLevel(event) {
    event.preventDefault();
    if (!validateRequiredValues(event.currentTarget)) return;
    if (!yearLevel || yearLevel === profile?.currentYearLevel) return;
    setSavingYearLevel(true);
    try {
      const updated = await api(
        "/student-profile/year-level",
        send("PATCH", { currentYearLevel: yearLevel }),
      );
      setYearLevel(updated.currentYearLevel);
      setSectionName(updated.section?.name || "Section not assigned");
      notify("Your year level was updated.");
    } catch (error) {
      setYearLevel(profile?.currentYearLevel || "");
      notify(error.message);
    } finally {
      setSavingYearLevel(false);
    }
  }
  return (
    <>
      <section className="student-banner">
        <div className="identity">
          <span className="avatar large">{initials(session.user)}</span>
          <div>
            <span className="eyebrow">YOUR ACADEMIC PROFILE</span>
            <h2>{profile?.studentId || "Student profile"}</h2>
            <p>
              {profile?.program?.code} <span>&middot;</span> {sectionName}
            </p>
            {profile?.program?.yearLevels?.length > 0 && (
              <form
                className="student-year-level-form"
                onSubmit={updateYearLevel}
              >
                <label htmlFor="student-year-level">Current year level</label>
                <select
                  id="student-year-level"
                  required
                  value={yearLevel}
                  onChange={(event) => setYearLevel(event.target.value)}
                  disabled={savingYearLevel}
                >
                  {profile.program.yearLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={
                    savingYearLevel || yearLevel === profile.currentYearLevel
                  }
                >
                  {savingYearLevel ? "Saving..." : "Save"}
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="banner-divider" />
        <div className="banner-progress">
          <div className="banner-progress-title">
            <span>LEARNING PROGRESS</span>
            <b>{progress.percent}%</b>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          <small>
            {progress.completed} of {progress.total} lessons completed
          </small>
        </div>
        <div className="banner-orbit">✳</div>
      </section>
      <section className="panel continue-learning-panel" aria-live="polite">
        <div>
          <span className="eyebrow">YOUR NEXT STEP</span>
          <h2>{nextLessonLoading ? "Finding your next lesson…" : nextLesson ? nextLesson.title : nextLessonError ? "Couldn’t check your next lesson" : "You’re all caught up"}</h2>
          <p>{nextLesson ? `${nextLesson.offering.course?.title || "Course"} · Lesson ${nextLesson.sequence}` : nextLessonLoading ? "Checking your enrolled courses." : nextLessonError ? nextLessonError : data.offerings.length ? "There are no unlocked lessons waiting right now. Check back when your faculty publishes the next lesson." : "Join a course with an invite code to get started."}</p>
        </div>
        {nextLesson ? (
          <Link className="button primary" to={`/lesson/${nextLesson._id}`}>Continue learning <ArrowRight size={15} /></Link>
        ) : !nextLessonLoading && nextLessonError ? (
          <button className="button secondary" onClick={() => setNextLessonRetry((value) => value + 1)}>Try again</button>
        ) : !nextLessonLoading && !data.offerings.length ? (
          <Link className="button secondary" to="/courses">Find a course <ArrowRight size={15} /></Link>
        ) : null}
      </section>
      <div className="dashboard-grid student-grid">
        <section className="panel courses-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THE WORK IN FRONT OF YOU</span>
              <h2>Your courses</h2>
            </div>
            <Link className="text-link" to="/courses">
              See all <ArrowRight size={14} />
            </Link>
          </div>
          {data.offerings.length ? (
            <div className="course-list">
              {data.offerings.slice(0, 5).map((offering, i) => (
                <CourseRow
                  key={offering._id}
                  offering={offering}
                  index={i}
                  progress={courseProgress[offering._id]}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="Your next chapter is on its way."
              body="Join a course with an invite code, or ask your faculty member to enroll you."
              link="/courses"
              linkText="Join a course"
            />
          )}
        </section>
        <section className="panel rhythm-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">STEADY IS A SUPERPOWER</span>
              <h2>Your learning rhythm</h2>
            </div>
            <span className="chart-period">
              THIS WEEK <ChevronDown size={12} />
            </span>
          </div>
          <div className="rhythm-caption">
            <b>{marks.reduce((total, day) => total + day.value, 0)}</b>
            <span>quiz attempts this week</span>
            <span className="trend-up">
              <Clock3 size={13} /> Small steps count
            </span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={marks}
                margin={{ left: -25, right: 4, top: 12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#688978" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#688978" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#95988f",
                    fontSize: 12,
                    fontFamily: "DM Sans",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e8e7e0",
                    fontSize: 14,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#648472"
                  strokeWidth={2.5}
                  fill="url(#progressFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-note">
            <span className="chart-legend-dot" />
            Quiz attempts submitted each day
          </div>
        </section>
      </div>
      <section className="recent-results">
        <div>
          <span className="eyebrow">GOOD THINGS ADD UP</span>
          <h2>Recent results</h2>
        </div>
        <div className="results-row">
          {data.recentAttempts.length ? (
            data.recentAttempts.slice(0, 3).map((attempt) => (
              <div className="result-pill" key={attempt._id}>
                <span
                  className={`result-icon ${attempt.passed ? "success" : "again"}`}
                >
                  {attempt.passed ? (
                    <Check size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                </span>
                <span>
                  <b>{attempt.quiz?.lesson?.title || "Lesson assessment"}</b>
                  <small>
                    {attempt.passed ? "Passed" : "Keep practicing"} ·{" "}
                    {new Date(attempt.submittedAt).toLocaleDateString()}
                  </small>
                </span>
                <strong>{attempt.percent}%</strong>
              </div>
            ))
          ) : (
            <p className="muted">
              Your first assessment result will show up here.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
