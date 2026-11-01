import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  FileText,
  Plus,
} from "lucide-react";
import { api, send } from "../api.js";
import { useAuth, Loading } from "../shared.jsx";

export function LessonPage() {
  const { lessonId } = useParams();
  const { session, notify } = useAuth();
  const faculty = session.user.role === "faculty";
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const load = async () => {
    try {
      let lessonData = await api("/lessons/" + lessonId);
      if (
        !faculty &&
        lessonData.quiz &&
        !lessonData.attempts.some((attempt) => attempt.passed) &&
        lessonData.attempts.length < lessonData.quiz.attemptsAllowed
      ) {
        try {
          const active = await api(
            "/quizzes/" + lessonData.quiz._id + "/sessions",
            send("POST", {}),
          );
          lessonData = { ...lessonData, ...active };
        } catch (error) {
          const refreshed = await api("/lessons/" + lessonId).catch(() => null);
          if (refreshed) lessonData = refreshed;
          if (error.message !== "You have used all available attempts.")
            notify(error.message);
        }
      }
      setData(lessonData);
    } catch (error) {
      notify(error.message);
    }
  };
  useEffect(() => {
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
  async function completeLesson() {
    try {
      await api(`/lessons/${lessonId}/complete`, send("POST", {}));
      notify("Lesson marked complete.");
      await load();
    } catch (error) {
      notify(error.message);
    }
  }
  if (!data) return <Loading />;
  const { lesson, quiz } = data;
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
          {lesson.materials?.map((file) => (
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
                  {(file.size / 1024 / 1024).toFixed(1)} MB · Learning material
                </small>
              </span>
              <ArrowUpRight size={15} />
            </a>
          ))}
          {!faculty && !quiz && (
            <div className="acknowledgement">
              <span className="success-badge">
                <Check size={14} />
              </span>
              <div>
                <strong>Ready to move on?</strong>
                <p>This lesson uses a completion check rather than a quiz.</p>
              </div>
              <button className="button primary" onClick={completeLesson}>
                Mark complete <Check size={15} />
              </button>
            </div>
          )}
        </article>
        <aside className="lesson-aside">
          {quiz && (
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
                <QuizEditor lessonId={lessonId} quiz={quiz} onSaved={load} />
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
                        {result.attempt.attemptNumber} of{" "}
                        {result.attempt.attemptsAllowed}
                      </small>
                    </div>
                  )}
                  {data.attempts?.length > 0 && (
                    <p className="attempt-note">
                      {data.attempts.filter((item) => item.passed).length
                        ? "You’ve already passed this assessment."
                        : `${quiz.attemptsAllowed - data.attempts.length} attempt${quiz.attemptsAllowed - data.attempts.length === 1 ? "" : "s"} remaining.`}
                    </p>
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
          {faculty && <UploadMaterials lessonId={lessonId} onUploaded={load} />}
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

export function QuizEditor({ lessonId, quiz, onSaved }) {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  const [questionCount, setQuestionCount] = useState(
    Math.max(quiz.questions?.length || 0, 1),
  );
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
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
    try {
      await api(
        `/lessons/${lessonId}/quiz`,
        send("PUT", {
          passingPercent: Number(values.passingPercent),
          attemptsAllowed: Number(values.attemptsAllowed),
          ...(values.timeLimitMinutes
            ? { timeLimitMinutes: Number(values.timeLimitMinutes) }
            : {}),
          ...(values.availableFrom
            ? { availableFrom: new Date(values.availableFrom).toISOString() }
            : {}),
          ...(values.deadline
            ? { deadline: new Date(values.deadline).toISOString() }
            : {}),
          randomizeQuestions: values.randomizeQuestions === "on",
          randomizeChoices: values.randomizeChoices === "on",
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
        <label>
          Attempts
          <input
            name="attemptsAllowed"
            type="number"
            min="1"
            max="20"
            required
            defaultValue={quiz.attemptsAllowed || 3}
          />
        </label>
      </div>
      <label>
        Time limit
        <input
          name="timeLimitMinutes"
          type="number"
          min="10"
          max="10"
          value="10"
          readOnly
        />
      </label>
      <div className="quiz-random-options">
        <label className="publish-check">
          <input
            type="checkbox"
            name="randomizeQuestions"
            defaultChecked={quiz.randomizeQuestions}
          />
          Randomize question order
        </label>
        <label className="publish-check">
          <input
            type="checkbox"
            name="randomizeChoices"
            defaultChecked={quiz.randomizeChoices}
          />
          Randomize answer choices
        </label>
      </div>
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

export function UploadMaterials({ lessonId, onUploaded }) {
  const { notify } = useAuth();
  const [busy, setBusy] = useState(false);
  async function upload(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.getAll("files").some((item) => item.size > 0)) return;
    setBusy(true);
    try {
      await api(`/lessons/${lessonId}/materials`, {
        method: "POST",
        body: form,
      });
      notify("Learning materials uploaded.");
      event.currentTarget.reset();
      onUploaded();
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel upload-panel" onSubmit={upload}>
      <span className="eyebrow">SHARE A RESOURCE</span>
      <h3>Lesson materials</h3>
      <label className="file-picker">
        <FileText size={17} />
        <span>
          Choose PDF, Office, image or MP4
          <small>Up to 5 files, 15 MB each</small>
        </span>
        <input
          type="file"
          name="files"
          multiple
          accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp,.mp4"
          required
        />
      </label>
      <button className="button secondary full-width" disabled={busy}>
        {busy ? "Uploading…" : "Upload materials"}
      </button>
    </form>
  );
}
