import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Maximize2,
  Minimize2,
  Plus,
} from "lucide-react";
import { api, apiUpload, send } from "../api.js";
import { validateRequiredValues } from "../formValidation.js";
import { normalizePresentationNamespacePrefixes } from "../presentationCompatibility.js";
import { useAuth, Loading } from "../shared.jsx";

function formatUploadSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function LessonPage() {
  const { lessonId } = useParams();
  const { session, notify } = useAuth();
  const faculty = session.user.role === "faculty";
  const [data, setData] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [quizStartError, setQuizStartError] = useState("");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const load = async () => {
    if (!data) setPageLoading(true);
    setPageError("");
    try {
      let lessonData = await api("/lessons/" + lessonId);
      if (
        !faculty &&
        lessonData.quiz &&
        !lessonData.attempts.some((attempt) => attempt.passed)
      ) {
        try {
          const current = await api(
            `/quizzes/${lessonData.quiz._id}/sessions/current`,
          );
          if (current.session || current.expired) {
            lessonData = {
              ...lessonData,
              ...current,
              attempts: current.attempt
                ? [...lessonData.attempts, current.attempt]
                : lessonData.attempts,
            };
          }
        } catch {
          // The lesson still loads; starting the quiz will show any access error.
        }
      }
      setData(lessonData);
    } catch (error) {
      setData(null);
      setPageError(error.message);
    } finally {
      setPageLoading(false);
    }
  };
  useEffect(() => {
    setData(null);
    setPageLoading(true);
    load();
  }, [lessonId]);
  useEffect(() => {
    const expiresAt = data?.session?.expiresAt;
    if (!expiresAt) {
      setSecondsLeft(null);
      return;
    }
    const update = () =>
      setSecondsLeft(
        Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [data?.session?.expiresAt]);
  async function submitQuiz(event) {
    event.preventDefault();
    if (!validateRequiredValues(event.currentTarget)) return;
    if (!data?.quiz) return;
    setBusy(true);
    try {
      const response = await api(
        `/quizzes/${data.quiz._id}/attempts`,
        send("POST", {
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      );
      setResult(response);
      setAnswers({});
      notify(response.message);
      await load();
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function startQuiz() {
    if (!data?.quiz) return;
    setBusy(true);
    setQuizStartError("");
    try {
      const active = await api(
        `/quizzes/${data.quiz._id}/sessions`,
        send("POST", {}),
      );
      setData((current) => ({ ...current, ...active }));
    } catch (error) {
      setQuizStartError(error.message);
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function toggleLessonPublication() {
    if (!data) return;
    const publish = !data.lesson.published;
    if (publish && !data.quiz?.published) {
      notify("Create and publish the quiz before publishing this lesson.");
      return;
    }
    setBusy(true);
    try {
      await api(`/lessons/${lessonId}`, send("PATCH", { published: publish }));
      notify(
        publish
          ? "Lesson published to students."
          : "Lesson moved back to draft.",
      );
      await load();
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data && pageLoading) return <Loading />;
  if (!data)
    return (
      <div className="page-shell">
        <section className="panel lesson-load-error" role="alert">
          <span className="eyebrow">LESSON UNAVAILABLE</span>
          <h1>We couldn’t open this lesson.</h1>
          <p>
            {pageError ||
              "This lesson may be locked, unpublished, or no longer available."}
          </p>
          <Link className="button secondary" to="/courses">
            Back to my courses
          </Link>
        </section>
      </div>
    );
  const { lesson, quiz } = data;
  const emptyQuiz = {
    questions: [],
    passingPercent: 75,
    attemptsAllowed: 1,
    timeLimitMinutes: 10,
    randomizeQuestions: true,
    randomizeChoices: true,
    published: false,
  };
  const hasPassedQuiz =
    data.attempts?.some((attempt) => attempt.passed) || false;
  return (
    <div className="page-shell">
      <Link to={`/courses/${lesson.offering}`} className="back-link">
        ← Back to course
      </Link>
      <div className="lesson-page-head">
        <span className="eyebrow">
          LESSON {String(lesson.sequence).padStart(2, "0")}{" "}
          <span className="eyebrow-dot">·</span>{" "}
          {faculty ? "FACULTY VIEW" : "YOUR LEARNING PATH"}
        </span>
        <h1>
          {lesson.title}
          <span className="title-period">.</span>
        </h1>
        <p className="muted">{lesson.description}</p>
      </div>
      <div className="lesson-content-grid">
        <article className="lesson-content panel">
          <div className="content-kicker">
            <span className="lesson-content-icon">
              <BookOpen size={16} />
            </span>
            <span>TAKE YOUR TIME WITH THIS ONE</span>
          </div>
          {lesson.summary && (
            <section className="lesson-summary">
              <h2>Lesson summary</h2>
              <div className="lesson-prose">
                {lesson.summary
                  .split("\n")
                  .map((paragraph, index) =>
                    paragraph ? (
                      <p key={index}>{paragraph}</p>
                    ) : (
                      <br key={index} />
                    ),
                  )}
              </div>
            </section>
          )}
          {lesson.content ? (
            <div className="lesson-prose">
              {lesson.content
                .split("\n")
                .map((paragraph, index) =>
                  paragraph ? (
                    <p key={index}>{paragraph}</p>
                  ) : (
                    <br key={index} />
                  ),
                )}
            </div>
          ) : (
            <div className="lesson-prose">
              <p>
                Start with the materials your instructor has shared, then take a
                moment to put the main idea into your own words.
              </p>
            </div>
          )}
          {lesson.videoUrl && (
            <a
              className="material-link"
              href={lesson.videoUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="material-file">
                <FileText size={15} />
              </span>
              <span>
                <b>Lesson video</b>
                <small>Opens in a new tab</small>
              </span>
              <ArrowUpRight size={15} />
            </a>
          )}
          {lesson.materials?.map((file) => {
            const isPresentation =
              file.mimeType ===
                "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
              file.name?.toLowerCase().endsWith(".pptx");
            if (isPresentation) {
              return <PresentationViewer file={file} key={file.url} />;
            }
            return (
              <a
                className="material-link"
                href={file.url}
                key={file.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="material-file">
                  <FileText size={15} />
                </span>
                <span>
                  <b>{file.name}</b>
                  <small>
                    {(file.size / 1024 / 1024).toFixed(1)} MB · Learning
                    material
                  </small>
                </span>
                <ArrowUpRight size={15} />
              </a>
            );
          })}
        </article>
        <aside className="lesson-aside">
          {faculty && (
            <>
              <section className="panel lesson-publication">
                <span className="eyebrow">
                  {lesson.published
                    ? "PUBLISHED TO STUDENTS"
                    : "DRAFT · HIDDEN FROM STUDENTS"}
                </span>
                <h3>
                  {lesson.published
                    ? "Lesson is live"
                    : "Lesson is not published"}
                </h3>
                {!lesson.published && !quiz?.published && (
                  <p>
                    Publish the assessment first. Students must pass it to
                    unlock the next lesson.
                  </p>
                )}
                {lesson.published && (
                  <p>
                    Students can view this lesson and must pass its quiz to
                    continue.
                  </p>
                )}
                <button
                  className={
                    lesson.published
                      ? "button secondary full-width"
                      : "button primary full-width"
                  }
                  type="button"
                  disabled={busy || (!lesson.published && !quiz?.published)}
                  onClick={toggleLessonPublication}
                >
                  {busy
                    ? "Saving…"
                    : lesson.published
                      ? "Unpublish lesson"
                      : quiz?.published
                        ? "Publish lesson to students"
                        : "Publish quiz first"}
                </button>
              </section>
              <UploadMaterials
                lessonId={lessonId}
                materials={lesson.materials || []}
                onUploaded={load}
              />
            </>
          )}
          {(quiz || faculty) && (
            <section className="panel quiz-panel">
              <div className="quiz-panel-top">
                <span className="quiz-icon">
                  <CircleHelp size={18} />
                </span>
                <span className="eyebrow">A MOMENT TO CHECK IN</span>
              </div>
              <h2>
                {faculty ? "Assessment settings" : "Quick knowledge check"}
              </h2>
              {faculty ? (
                <>
                  <p className="muted">
                    Generate questions from a presentation or import a formatted
                    quiz. Review every answer before publishing. Questions and
                    choices are shuffled for students.
                  </p>
                  <QuizImport
                    lessonId={lessonId}
                    quiz={quiz}
                    materials={lesson.materials || []}
                    onSaved={load}
                  />
                  <details className="manual-quiz-editor">
                    <summary>
                      {quiz ? "Edit quiz manually" : "Create quiz manually"}
                    </summary>
                    <QuizEditor
                      lessonId={lessonId}
                      quiz={quiz || emptyQuiz}
                      onSaved={load}
                    />
                  </details>
                </>
              ) : (
                <>
                  <div className="quiz-facts">
                    <span>
                      <b>{quiz.questions.length}</b> questions
                    </span>
                    <i />
                    <span>
                      <b>{quiz.passingPercent}%</b> to pass
                    </span>
                    {data.session && (
                      <>
                        <i />
                        <span className="time-remaining">
                          <Clock3 size={12} />
                          {secondsLeft === null
                            ? "Timed assessment"
                            : secondsLeft > 0
                              ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                              : "Time expired"}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="quiz-timer-note">
                    {data.session
                      ? `The ${quiz.timeLimitMinutes ?? 10}-minute timer is running. It started when you began this attempt.`
                      : `Time limit: ${quiz.timeLimitMinutes ?? 10} minutes. The timer starts when you click Start quiz.`}
                  </p>
                  {result && (
                    <div
                      className={`quiz-result ${result.attempt.passed ? "passed" : "failed"}`}
                    >
                      <span>
                        {result.attempt.passed
                          ? "You passed."
                          : "Not quite yet."}
                      </span>
                      <b>{result.attempt.percent}%</b>
                      <small>
                        {result.attempt.earnedPoints} /{" "}
                        {result.attempt.totalPoints} points · attempt{" "}
                        {result.attempt.attemptNumber}
                      </small>
                    </div>
                  )}
                  {data.attempts?.length > 0 && (
                    <p className="attempt-note">
                      {data.attempts.filter((item) => item.passed).length
                        ? "You’ve already passed this assessment."
                        : "You can retry after a failed attempt until you pass."}
                    </p>
                  )}
                  {quizStartError && (
                    <p className="upload-error" role="alert">
                      {quizStartError}
                    </p>
                  )}
                  {!hasPassedQuiz && !data.session && (
                    <>
                      {data.expired && (
                        <p className="attempt-note">
                          Your previous timer expired. Starting again records it
                          as a failed attempt.
                        </p>
                      )}
                      <button
                        className="button primary full-width"
                        type="button"
                        disabled={busy}
                        onClick={startQuiz}
                      >
                        {busy
                          ? "Starting quiz…"
                          : data.attempts?.length
                            ? "Start next attempt"
                            : "Start quiz"}
                        <ArrowRight size={15} />
                      </button>
                    </>
                  )}
                  {!data.attempts?.some((item) => item.passed) &&
                    data.session && (
                      <form onSubmit={submitQuiz} className="quiz-form">
                        {quiz.questions.map((question, index) => (
                          <fieldset
                            key={question._id}
                            disabled={secondsLeft === 0}
                          >
                            <legend>
                              <span className="question-number">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              {question.prompt}
                              <small>
                                {question.points} pt
                                {question.points === 1 ? "" : "s"}
                              </small>
                            </legend>
                            {question.type === "multiple-choice" ||
                            question.type === "true-false" ? (
                              (question.type === "true-false"
                                ? ["True", "False"]
                                : question.choices
                              ).map((choice) => (
                                <label
                                  className={`choice-option ${answers[question._id] === choice ? "chosen" : ""}`}
                                  key={choice}
                                >
                                  <input
                                    type="radio"
                                    name={question._id}
                                    value={choice}
                                    checked={answers[question._id] === choice}
                                    onChange={() =>
                                      setAnswers((current) => ({
                                        ...current,
                                        [question._id]: choice,
                                      }))
                                    }
                                    required
                                  />
                                  <span className="choice-mark" />
                                  {choice}
                                </label>
                              ))
                            ) : (
                              <input
                                className="short-answer"
                                value={answers[question._id] || ""}
                                onChange={(event) =>
                                  setAnswers((current) => ({
                                    ...current,
                                    [question._id]: event.target.value,
                                  }))
                                }
                                placeholder="Write your answer…"
                                required
                              />
                            )}
                          </fieldset>
                        ))}
                        <button
                          className="button primary full-width"
                          disabled={busy}
                        >
                          {busy
                            ? "Checking your answers…"
                            : "Submit for review"}
                          <ArrowRight size={15} />
                        </button>
                      </form>
                    )}
                </>
              )}
            </section>
          )}
          <div className="unlock-note">
            <span className="unlock-spark">✳</span>
            <p>
              {faculty
                ? "Progress is recorded for each student in this course."
                : quiz
                  ? "Pass the assessment to open the next lesson."
                  : "Your progress carries with you, wherever you are."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PresentationViewer({ file }) {
  const viewerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const officeViewerSupported =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);
  const [viewMode, setViewMode] = useState(() =>
    officeViewerSupported ? "office" : "local",
  );
  const [presentation, setPresentation] = useState(null);
  const [fallbackPreview, setFallbackPreview] = useState(false);
  const [slideUrl, setSlideUrl] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const filename = file.url.split("/").pop();
  const sourceUrl = new URL(
    `/office-preview-files/${encodeURIComponent(filename)}`,
    window.location.origin,
  ).href;
  const officeViewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(sourceUrl)}`;

  useEffect(() => {
    if (viewMode === "office") {
      setPresentation(null);
      setSlideUrl("");
      setError("");
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    let fileLoaded = false;
    let parsedDeck;
    setLoading(true);
    setError("");
    setPresentation(null);
    setFallbackPreview(false);
    setSlideUrl("");
    setSlideIndex(0);

    async function loadPresentation() {
      try {
        const [renderer, response] = await Promise.all([
          import("@web-ppt/core"),
          fetch(`/uploads/${encodeURIComponent(filename)}`, {
            credentials: "same-origin",
          }),
        ]);
        if (!response.ok) {
          const accessError = new Error(
            response.status === 401 || response.status === 403
              ? "Sign in with an account that can access this course to view the presentation."
              : "The presentation could not be loaded. Try downloading the original file.",
          );
          accessError.status = response.status;
          throw accessError;
        }
        const bytes = await response.arrayBuffer();
        fileLoaded = true;
        const compatibleBytes = normalizePresentationNamespacePrefixes(
          new Uint8Array(bytes),
        );
        parsedDeck = await renderer.parse(compatibleBytes, { lazy: true });
        if (cancelled) {
          parsedDeck.dispose?.();
          return;
        }
        if (!parsedDeck.slides.length) {
          parsedDeck.dispose?.();
          parsedDeck = undefined;
          setFallbackPreview(true);
          setLoading(false);
          return;
        }
        setPresentation({
          deck: parsedDeck,
          renderSlideToSvg: renderer.renderSlideToSvg,
        });
        setLoading(false);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError.status === 401 || loadError.status === 403) {
          setError(loadError.message);
        } else if (fileLoaded) {
          setFallbackPreview(true);
        } else {
          setError(
            loadError.message || "The presentation could not be previewed.",
          );
        }
        setLoading(false);
      }
    }

    loadPresentation();
    return () => {
      cancelled = true;
      parsedDeck?.dispose?.();
    };
  }, [filename, viewMode]);

  useEffect(() => {
    if (!presentation) return undefined;
    let objectUrl;
    try {
      const slide = presentation.deck.slides[slideIndex];
      if (!slide) throw new Error("This presentation has no readable slides.");
      const svg = presentation.renderSlideToSvg(presentation.deck, slide);
      objectUrl = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      );
      setSlideUrl(objectUrl);
      setError("");
    } catch {
      setSlideUrl("");
      setFallbackPreview(true);
      setError("");
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [presentation, slideIndex]);

  useEffect(() => {
    const syncFullscreen = () => {
      const active =
        (document.fullscreenElement || document.webkitFullscreenElement) ===
        viewerRef.current;
      setIsFullscreen(active);
      if (active) setExpanded(false);
    };
    const closeExpandedOnEscape = (event) => {
      if (
        event.key === "Escape" &&
        !document.fullscreenElement &&
        !document.webkitFullscreenElement
      )
        setExpanded(false);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    document.addEventListener("keydown", closeExpandedOnEscape);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
      document.removeEventListener("keydown", closeExpandedOnEscape);
    };
  }, []);

  async function toggleExpandedView() {
    const viewer = viewerRef.current;
    const fullscreenElement =
      document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenElement === viewer) {
      const exitFullscreen =
        document.exitFullscreen || document.webkitExitFullscreen;
      await exitFullscreen?.call(document);
      return;
    }
    if (expanded) {
      setExpanded(false);
      return;
    }
    const requestFullscreen =
      viewer?.requestFullscreen || viewer?.webkitRequestFullscreen;
    if (requestFullscreen) {
      try {
        await requestFullscreen.call(viewer);
        return;
      } catch {
        // Use the in-page expansion when fullscreen is blocked by the browser.
      }
    }
    setExpanded(true);
  }

  const slideCount = presentation?.deck.slides.length || 0;
  return (
    <section
      className={`presentation-viewer${expanded ? " presentation-expanded" : ""}`}
      ref={viewerRef}
      aria-label={`Presentation viewer for ${file.name}`}
    >
      <div className="presentation-viewer-heading">
        <div className="presentation-viewer-title">
          <span className="eyebrow">COURSE PRESENTATION</span>
          <h3>{file.name}</h3>
        </div>
        <div className="presentation-viewer-actions">
          <a className="presentation-download" href={file.url} download>
            Download original
          </a>
          <button
            className="presentation-expand presentation-viewer-mode"
            type="button"
            disabled={!officeViewerSupported && viewMode === "local"}
            aria-label={
              officeViewerSupported
                ? viewMode === "office"
                  ? "Use local presentation preview"
                  : "Try Microsoft presentation viewer"
                : "Microsoft viewer requires a publicly hosted HTTPS version of Modulink"
            }
            onClick={() =>
              setViewMode((mode) => (mode === "office" ? "local" : "office"))
            }
            title={
              officeViewerSupported
                ? "Switch between Microsoft and local presentation previews"
                : "Microsoft's viewer needs a publicly hosted HTTPS version of Modulink"
            }
          >
            {viewMode === "office"
              ? "Local preview"
              : officeViewerSupported
                ? "Microsoft viewer"
                : "Unavailable here"}
          </button>
          <button
            className="presentation-expand"
            type="button"
            onClick={toggleExpandedView}
            aria-label={
              isFullscreen
                ? "Exit full screen"
                : expanded
                  ? "Collapse presentation viewer"
                  : "Expand presentation viewer"
            }
            title={
              isFullscreen
                ? "Exit full screen (Esc)"
                : expanded
                  ? "Collapse viewer (Esc)"
                  : "Expand viewer"
            }
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>
              {isFullscreen
                ? "Exit full screen"
                : expanded
                  ? "Collapse"
                  : "Expand"}
            </span>
          </button>
        </div>
      </div>
      <div className="presentation-frame" aria-live="polite">
        {viewMode === "office" ? (
          <iframe
            className="presentation-legacy-frame"
            src={officeViewerUrl}
            title={`Microsoft PowerPoint preview: ${file.name}`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : loading ? (
          <p className="presentation-viewer-message">
            Preparing presentation...
          </p>
        ) : error ? (
          <div className="presentation-viewer-error" role="alert">
            <p>{error}</p>
            <a className="presentation-download" href={file.url} download>
              Download the original presentation
            </a>
          </div>
        ) : fallbackPreview ? (
          <iframe
            className="presentation-legacy-frame"
            src={`/uploads/${encodeURIComponent(filename)}/preview`}
            title={`Slide preview: ${file.name}`}
            loading="lazy"
            sandbox=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <>
            <div className="presentation-slide-stage">
              {slideUrl && (
                <img
                  className="presentation-slide-image"
                  src={slideUrl}
                  alt={`Slide ${slideIndex + 1} of ${slideCount}`}
                />
              )}
            </div>
            <nav
              className="presentation-slide-controls"
              aria-label="Slide navigation"
            >
              <button
                type="button"
                className="presentation-slide-nav"
                onClick={() => setSlideIndex((index) => Math.max(0, index - 1))}
                disabled={slideIndex === 0}
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} /> Previous
              </button>
              <span aria-live="polite">
                Slide {slideIndex + 1} of {slideCount}
              </span>
              <button
                type="button"
                className="presentation-slide-nav"
                onClick={() =>
                  setSlideIndex((index) => Math.min(slideCount - 1, index + 1))
                }
                disabled={slideIndex >= slideCount - 1}
                aria-label="Next slide"
              >
                Next <ChevronRight size={18} />
              </button>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}

function QuizImport({ lessonId, quiz, materials = [], onSaved }) {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const [passingPercent, setPassingPercent] = useState(
    quiz?.passingPercent ?? 75,
  );
  const [publishQuiz, setPublishQuiz] = useState(quiz?.published ?? true);
  const [progress, setProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [questionSource, setQuestionSource] = useState("document");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPresentation, setSelectedPresentation] = useState("");
  const settingsForm = useRef(null);
  const presentations = materials.filter((file) =>
    file.name?.toLowerCase().endsWith(".pptx"),
  );
  useEffect(() => {
    setPassingPercent(quiz?.passingPercent ?? 75);
    setPublishQuiz(quiz?.published ?? true);
  }, [quiz?.passingPercent, quiz?.published]);
  useEffect(() => {
    if (!presentations.some((file) => file.url === selectedPresentation))
      setSelectedPresentation(presentations[0]?.url || "");
  }, [materials, selectedPresentation]);
  async function extract(event) {
    event.preventDefault();
    const quizForm = event.currentTarget;
    if (!validateRequiredValues(quizForm)) return;
    const file = new FormData(quizForm).get("file");
    if (!file || file.size === 0) {
      setUploadError("Choose a quiz document.");
      return;
    }
    setBusy(true);
    setProgress(0);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await apiUpload(
        `/lessons/${lessonId}/quiz-import`,
        form,
        { onProgress: setProgress },
      );
      quizForm.reset();
      setSelectedFile(null);
      setQuestions(
        response.questions.map((question) => ({
          ...question,
          confirmed: false,
        })),
      );
      setQuestionSource("document");
      notify(
        `${response.questions.length} questions extracted. Review each one.`,
      );
    } catch (error) {
      setUploadError(error.message);
      notify(error.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function generateFromPresentation() {
    if (!selectedPresentation) {
      notify("Upload a PowerPoint presentation first.");
      return;
    }
    const filename = selectedPresentation.split("/").pop();
    setBusy(true);
    setUploadError("");
    try {
      const response = await api(
        `/lessons/${lessonId}/materials/${encodeURIComponent(filename)}/quiz-draft`,
        { method: "POST" },
      );
      setQuestions(
        response.questions.map((question) => ({
          ...question,
          confirmed: false,
        })),
      );
      setQuestionSource("presentation");
      notify(
        `${response.questions.length} quiz questions drafted. Review and confirm every answer.`,
      );
    } catch (error) {
      setUploadError(error.message);
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  function updateQuestion(index, changes) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index
          ? { ...question, ...changes, confirmed: false }
          : question,
      ),
    );
  }
  async function saveReviewedQuiz() {
    if (!validateRequiredValues(settingsForm.current)) return;
    if (
      questionSource === "presentation" &&
      (questions.length < 10 || questions.length > 20)
    ) {
      notify("AI generated quizzes must contain between 10 and 20 questions.");
      return;
    }
    if (!questions.length || questions.some((question) => !question.confirmed))
      return notify(
        "Confirm the correct answer for every question before saving.",
      );
    setBusy(true);
    try {
      await api(
        `/lessons/${lessonId}/quiz`,
        send("PUT", {
          passingPercent: Number(passingPercent),
          attemptsAllowed: 1,
          timeLimitMinutes: 10,
          availableFrom: quiz?.availableFrom,
          deadline: quiz?.deadline,
          randomizeQuestions: true,
          randomizeChoices: true,
          published: publishQuiz,
          questions: questions.map(({ confirmed, ...question }) => question),
        }),
      );
      notify(
        publishQuiz
          ? "Reviewed quiz published."
          : "Reviewed quiz saved as a draft.",
      );
      setQuestions([]);
      await onSaved();
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="quiz-import form-stack">
      <form className="form-stack" onSubmit={extract}>
        {busy && progress === null && (
          <p className="muted" role="status" aria-live="polite">
            Preparing quiz questions. This can take a few seconds…
          </p>
        )}
        {busy && progress !== null && (
          <div className="upload-progress" role="status" aria-live="polite">
            <div className="upload-progress-label">
              <span>
                {progress >= 100
                  ? "Upload complete; extracting questions…"
                  : "Uploading quiz document…"}
              </span>
              <span>{progress}%</span>
            </div>
            <progress
              max="100"
              value={progress}
              aria-label="Quiz upload progress"
            />
          </div>
        )}
        {uploadError && (
          <p className="upload-error" role="alert">
            {uploadError}
          </p>
        )}
        <label>
          Quiz document{" "}
          <span className="optional">TXT, PDF, DOCX OR PPTX · 5 MB MAX</span>
          <input
            name="file"
            type="file"
            accept=".txt,.pdf,.docx,.pptx"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] || null);
              setUploadError("");
            }}
            required
          />
          {selectedFile && (
            <span className="selected-upload-file">
              <b>{selectedFile.name}</b>
              <small>
                {formatUploadSize(selectedFile.size)} · ready to upload
              </small>
            </span>
          )}
        </label>
        <button className="button secondary" disabled={busy}>
          <FileText size={15} /> {busy ? "Extracting…" : "Extract questions"}
        </button>
      </form>
      <section className="quiz-presentation-generator">
        <span className="eyebrow">DRAFT FROM A PRESENTATION</span>
        <p>
          Generate at least 10 editable multiple-choice questions from the
          slides. You must review every answer before saving or publishing.
        </p>
        {presentations.length ? (
          <>
            <label>
              Presentation
              <select
                value={selectedPresentation}
                onChange={(event) =>
                  setSelectedPresentation(event.target.value)
                }
              >
                {presentations.map((file) => (
                  <option value={file.url} key={file.url}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button secondary"
              type="button"
              onClick={generateFromPresentation}
              disabled={busy || !selectedPresentation}
            >
              {busy ? "Generating quiz…" : "Generate quiz from presentation"}
            </button>
          </>
        ) : (
          <small>
            Upload a PowerPoint in this lesson to enable quiz generation.
          </small>
        )}
      </section>
      <form
        className="quiz-import-settings"
        ref={settingsForm}
        onSubmit={(event) => event.preventDefault()}
      >
        <span className="eyebrow">ASSESSMENT SETTINGS</span>
        <div className="field-row">
          <label>
            Passing score %
            <input
              type="number"
              min="0"
              max="100"
              required
              value={passingPercent}
              onChange={(event) => setPassingPercent(event.target.value)}
            />
          </label>
        </div>
        <p>
          Students can retry failed quizzes until they pass. Each attempt allows
          one submission. The 10-minute timer starts when they click Start quiz.
        </p>
        <label className="publish-check">
          <input
            type="checkbox"
            checked={publishQuiz}
            onChange={(event) => setPublishQuiz(event.target.checked)}
          />
          Publish quiz after I verify the imported questions
        </label>
      </form>
      <details className="quiz-format-help">
        <summary>Required document format</summary>
        <pre>{`Q: What is the capital of Japan?
A. Kyoto
B. Tokyo
C. Osaka
D. Sapporo
Answer: B
Points: 1
Explanation: Tokyo is Japan's capital.

Q: A second question goes here
A. First option
B. Second option
Answer: A`}</pre>
        <small>
          Use 2–8 choices per question. Answer must be a choice letter.
          Explanations and points are optional.
        </small>
      </details>
      {questions.length > 0 && (
        <form
          className="quiz-import-review"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validateRequiredValues(event.currentTarget)) return;
            saveReviewedQuiz();
          }}
        >
          <h3>
            Review {questions.length}{" "}
            {questionSource === "presentation" ? "generated" : "extracted"}{" "}
            questions
          </h3>
          <p className="muted">
            {questionSource === "presentation"
              ? "These AI-generated questions and answers are suggestions based on the slides. Check each one against the presentation."
              : "The selected answer is only a suggestion from the document. Verify it yourself."}
          </p>
          {questions.map((question, index) => (
            <fieldset className="editor-question" key={index}>
              <legend>Question {index + 1}</legend>
              <label>
                Question text
                <textarea
                  rows="3"
                  required
                  value={question.prompt}
                  onChange={(event) =>
                    updateQuestion(index, { prompt: event.target.value })
                  }
                />
              </label>
              <label>
                Choices <span className="optional">ONE PER LINE</span>
                <textarea
                  rows="4"
                  required={question.type === "multiple-choice"}
                  value={question.choices.join("\n")}
                  onChange={(event) => {
                    const choices = event.target.value
                      .split("\n")
                      .map((choice) => choice.trim())
                      .filter(Boolean);
                    updateQuestion(index, {
                      choices,
                      answer: choices.includes(question.answer)
                        ? question.answer
                        : choices[0] || "",
                    });
                  }}
                />
              </label>
              <label>
                Correct answer
                <select
                  value={question.answer}
                  onChange={(event) =>
                    updateQuestion(index, { answer: event.target.value })
                  }
                  required
                >
                  {question.choices.map((choice, choiceIndex) => (
                    <option key={`${choiceIndex}-${choice}`} value={choice}>
                      {String.fromCharCode(65 + choiceIndex)}. {choice}
                    </option>
                  ))}
                </select>
              </label>
              <label className="publish-check">
                <input
                  type="checkbox"
                  required
                  checked={question.confirmed}
                  onChange={(event) =>
                    setQuestions((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, confirmed: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                I verified this question and its correct answer.
              </label>
            </fieldset>
          ))}
          <button
            type="submit"
            className="button primary full-width"
            disabled={busy || questions.some((question) => !question.confirmed)}
          >
            {busy
              ? "Saving…"
              : publishQuiz
                ? "Save and publish quiz"
                : "Save quiz as draft"}
          </button>
        </form>
      )}
    </div>
  );
}

export function QuizEditor({ lessonId, quiz, onSaved }) {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const [questionCount, setQuestionCount] = useState(
    Math.max(quiz.questions?.length || 0, 1),
  );
  async function save(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validateRequiredValues(form)) return;
    setBusy(true);
    const values = Object.fromEntries(new FormData(form));
    const questions = Array.from({ length: questionCount }, (_, index) => {
      const type = values[`type_${index}`];
      return {
        type,
        prompt: values[`prompt_${index}`],
        answer: values[`answer_${index}`],
        points: Number(values[`points_${index}`]),
        ...(values[`explanation_${index}`]
          ? { explanation: values[`explanation_${index}`] }
          : {}),
        ...(type === "multiple-choice"
          ? {
              choices: values[`choices_${index}`]
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
            }
          : {}),
      };
    });
    const invalidChoices = questions.find(
      (question) =>
        question.type === "multiple-choice" &&
        (question.choices.length < 2 ||
          !question.choices.includes(question.answer)),
    );
    if (invalidChoices) {
      setBusy(false);
      notify(
        "Each multiple-choice question needs at least two choices, and the correct answer must match one of them.",
      );
      return;
    }
    try {
      await api(
        `/lessons/${lessonId}/quiz`,
        send("PUT", {
          passingPercent: Number(values.passingPercent),
          attemptsAllowed: 1,
          ...(values.timeLimitMinutes
            ? { timeLimitMinutes: Number(values.timeLimitMinutes) }
            : {}),
          ...(values.availableFrom
            ? { availableFrom: new Date(values.availableFrom).toISOString() }
            : {}),
          ...(values.deadline
            ? { deadline: new Date(values.deadline).toISOString() }
            : {}),
          randomizeQuestions: true,
          randomizeChoices: true,
          published: values.published === "on",
          questions,
        }),
      );
      notify("Assessment saved.");
      onSaved();
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack quiz-editor" onSubmit={save}>
      {Array.from({ length: questionCount }, (_, index) => {
        const question = quiz.questions?.[index];
        return (
          <fieldset className="editor-question" key={index}>
            <legend>Question {index + 1}</legend>
            <label>
              Question text
              <input
                name={`prompt_${index}`}
                required
                defaultValue={question?.prompt}
                placeholder="What should students understand?"
              />
            </label>
            <label>
              Question type
              <select
                name={`type_${index}`}
                required
                defaultValue={question?.type || "multiple-choice"}
              >
                <option value="multiple-choice">Multiple choice</option>
                <option value="true-false">True or false</option>
                <option value="short-answer">Short answer</option>
              </select>
            </label>
            <label>
              Choices <span className="optional">ONE PER LINE</span>
              <textarea
                name={`choices_${index}`}
                rows="3"
                required={question?.type === "multiple-choice"}
                placeholder={"First choice\nSecond choice\nThird choice"}
                defaultValue={question?.choices?.join("\n")}
              />
            </label>
            <label>
              Correct answer
              <input
                name={`answer_${index}`}
                required
                defaultValue={question?.answer}
                placeholder="Exact answer"
              />
            </label>
            <div className="field-row">
              <label>
                Points
                <input
                  name={`points_${index}`}
                  type="number"
                  min="1"
                  max="100"
                  required
                  defaultValue={question?.points || 1}
                />
              </label>
              <label>
                Explanation <span className="optional">OPTIONAL</span>
                <input
                  name={`explanation_${index}`}
                  defaultValue={question?.explanation}
                  placeholder="Shown after submission"
                />
              </label>
            </div>
          </fieldset>
        );
      })}
      {questionCount < 20 && (
        <button
          type="button"
          className="button secondary add-question"
          onClick={() => setQuestionCount((count) => count + 1)}
        >
          <Plus size={14} /> Add another question
        </button>
      )}
      {questionCount > 1 && (
        <button
          type="button"
          className="text-action remove-question"
          onClick={() => setQuestionCount((count) => count - 1)}
        >
          Remove last question
        </button>
      )}
      <div className="field-row">
        <label>
          Pass score %
          <input
            name="passingPercent"
            type="number"
            min="0"
            max="100"
            required
            defaultValue={quiz.passingPercent || 75}
          />
        </label>
      </div>
      <label>
        Time limit (minutes)
        <input
          name="timeLimitMinutes"
          type="number"
          min="10"
          max="10"
          value="10"
          required
          readOnly
        />
        <small>
          Fixed at 10 minutes. The timer starts when the student clicks Start
          quiz.
        </small>
      </label>
      <div className="field-row">
        <label>
          Available from
          <input
            name="availableFrom"
            type="datetime-local"
            defaultValue={quiz.availableFrom?.slice(0, 16)}
          />
        </label>
        <label>
          Deadline
          <input
            name="deadline"
            type="datetime-local"
            defaultValue={quiz.deadline?.slice(0, 16)}
          />
        </label>
      </div>
      <label className="publish-check">
        <input
          type="checkbox"
          name="published"
          defaultChecked={quiz.published}
        />{" "}
        Publish this quiz
      </label>
      <button className="button primary full-width" disabled={busy}>
        {busy ? "Saving…" : "Save assessment"}
      </button>
    </form>
  );
}

export function UploadMaterials({ lessonId, materials = [], onUploaded }) {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [summaryBusy, setSummaryBusy] = useState("");
  const [draft, setDraft] = useState(null);
  async function upload(event) {
    event.preventDefault();
    const uploadForm = event.currentTarget;
    if (!validateRequiredValues(uploadForm)) return;
    const form = new FormData(uploadForm);
    if (!form.getAll("files").some((item) => item.size > 0)) {
      setUploadError("Choose at least one file to upload.");
      return;
    }
    setBusy(true);
    setProgress(0);
    setUploadError("");
    try {
      await apiUpload(`/lessons/${lessonId}/materials`, form, {
        onProgress: setProgress,
      });
      notify("Learning materials uploaded.");
      uploadForm.reset();
      setSelectedFiles([]);
      await onUploaded();
    } catch (error) {
      setUploadError(error.message);
      notify(error.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function generateSummary(file) {
    setSummaryBusy(file.url);
    setDraft(null);
    try {
      const filename = file.url.split("/").pop();
      const generated = await api(
        `/lessons/${lessonId}/materials/${encodeURIComponent(filename)}/summary`,
        { method: "POST" },
      );
      setDraft({ filename, ...generated });
    } catch (error) {
      notify(error.message);
    } finally {
      setSummaryBusy("");
    }
  }
  async function applyDraft() {
    if (!draft) return;
    if (String(draft.title || "").trim().length < 2) {
      notify(
        "Add a lesson title with at least 2 characters before applying the draft.",
      );
      return;
    }
    setBusy(true);
    try {
      const { filename: _filename, ...lessonFields } = draft;
      await api(`/lessons/${lessonId}`, send("PATCH", lessonFields));
      notify("AI draft applied. Review it before publishing to students.");
      setDraft(null);
      await onUploaded();
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  const presentations = materials.filter((file) =>
    file.name?.toLowerCase().endsWith(".pptx"),
  );
  return (
    <form className="panel upload-panel" onSubmit={upload}>
      <span className="eyebrow">SHARE A RESOURCE</span>
      <h3>Upload a presentation</h3>
      <p className="upload-help">
        Add a PowerPoint to this lesson so students can view it here without
        downloading.
      </p>
      <label className="file-picker">
        <FileText size={17} />
        <span>
          Choose PowerPoint or other material
          <small>Up to 5 files, 15 MB each</small>
        </span>
        <input
          type="file"
          name="files"
          multiple
          accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp,.mp4"
          onChange={(event) => {
            setSelectedFiles(Array.from(event.target.files || []));
            setUploadError("");
          }}
          required
        />
        {selectedFiles.length > 0 && (
          <span className="selected-upload-file">
            {selectedFiles.map((file) => (
              <span key={`${file.name}-${file.lastModified}`}>
                <b>{file.name}</b>
                <small>{formatUploadSize(file.size)}</small>
              </span>
            ))}
          </span>
        )}
      </label>
      {busy && progress !== null && (
        <div className="upload-progress" role="status" aria-live="polite">
          <div className="upload-progress-label">
            <span>
              {progress >= 100
                ? "Upload complete; saving to lesson…"
                : "Uploading lesson materials…"}
            </span>
            <span>{progress}%</span>
          </div>
          <progress
            max="100"
            value={progress}
            aria-label="Lesson material upload progress"
          />
        </div>
      )}
      {uploadError && (
        <p className="upload-error" role="alert">
          {uploadError}
        </p>
      )}
      {presentations.length > 0 && (
        <div className="ai-summary-tools">
          <span className="eyebrow">OPTIONAL AI DRAFT</span>
          <p>
            Draft editable lesson fields from a deck. Extracted slide text is
            sent to Groq.
          </p>
          {presentations.map((file) => (
            <button
              className="button secondary full-width"
              type="button"
              key={file.url}
              disabled={Boolean(summaryBusy) || busy}
              onClick={() => generateSummary(file)}
            >
              {summaryBusy === file.url
                ? "Reading presentation…"
                : `Draft lesson from ${file.name}`}
            </button>
          ))}
          {draft && (
            <div className="ai-draft-fields">
              <p>Review the draft. Applying it replaces these lesson fields.</p>
              <label>
                Lesson title
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <label>
                Short description
                <textarea
                  rows="2"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
              </label>
              <label>
                Lesson content
                <textarea
                  rows="6"
                  value={draft.content}
                  onChange={(event) =>
                    setDraft({ ...draft, content: event.target.value })
                  }
                />
              </label>
              <label>
                Lesson summary
                <textarea
                  rows="4"
                  value={draft.summary}
                  onChange={(event) =>
                    setDraft({ ...draft, summary: event.target.value })
                  }
                />
              </label>
              <button
                className="button primary full-width"
                type="button"
                disabled={busy}
                onClick={applyDraft}
              >
                {busy ? "Applying…" : "Apply draft to lesson"}
              </button>
            </div>
          )}
        </div>
      )}
      <button className="button secondary full-width" disabled={busy}>
        {busy ? "Uploading…" : "Upload materials"}
      </button>
    </form>
  );
}
