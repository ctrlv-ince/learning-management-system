import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Check, Layers3, Palette, Presentation } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { Breadcrumbs, PageHeader } from "../shared.jsx";
import PresentationBuilder from "../components/PresentationBuilder.jsx";

export function PresentationWorkspace() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLesson = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/lessons/${lessonId}`);
      setLesson(data.lesson);
    } catch (loadError) {
      setError(loadError.message || "Could not load this lesson.");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => { loadLesson(); }, [loadLesson]);

  if (loading) return <div className="page-shell"><div className="studio-loading"><span /><span /><span /></div></div>;
  if (error || !lesson) return (
    <div className="page-shell">
      <section className="panel studio-load-error" role="alert">
        <span className="eyebrow">PRESENTATION STUDIO</span>
        <h1>We could not open this lesson</h1>
        <p>{error || "The lesson could not be found."}</p>
        <div className="studio-load-actions">
          <button className="button secondary" type="button" onClick={loadLesson}>Try again</button>
          <Link className="button primary" to={`/lesson/${lessonId}`}>Back to lesson</Link>
        </div>
      </section>
    </div>
  );

  return (
    <div className="page-shell presentation-studio-shell">
      <Breadcrumbs items={[{ label: "Courses", to: "/courses" }, { label: "Lesson", to: `/lesson/${lessonId}` }, { label: "Presentation studio" }]} />
      <Link className="studio-back-link" to={`/lesson/${lessonId}`}><ArrowLeft size={16} /> Back to lesson</Link>
      <section className="presentation-studio-hero">
        <div className="studio-hero-copy">
          <span className="studio-overline"><Presentation size={15} /> MODULINK PRESENTATION STUDIO</span>
          <h1>Create a lesson presentation</h1>
          <p>Build a clear, student-ready slide deck for <strong>{lesson.title}</strong>. Add your explanations and key points, then save it to the lesson materials.</p>
          <div className="studio-lesson-chip"><BookOpen size={15} /><span>{lesson.title}</span></div>
        </div>
        <div className="studio-process-card" aria-label="Presentation creation steps">
          <div className="studio-process-heading"><span>YOUR WORKFLOW</span><span>3 STEPS</span></div>
          <div className="studio-process-step"><span className="studio-step-icon"><Layers3 size={16} /></span><span><b>Build the story</b><small>Arrange the lesson slide by slide</small></span><Check className="studio-step-check" size={15} /></div>
          <div className="studio-process-step"><span className="studio-step-icon"><Palette size={16} /></span><span><b>Make it yours</b><small>Choose a visual theme and refine text</small></span><Check className="studio-step-check" size={15} /></div>
          <div className="studio-process-step"><span className="studio-step-icon"><Presentation size={16} /></span><span><b>Save to your lesson</b><small>Attach the editable PowerPoint deck</small></span><Check className="studio-step-check" size={15} /></div>
        </div>
        <div className="studio-hero-decoration studio-decoration-one" />
        <div className="studio-hero-decoration studio-decoration-two" />
      </section>

      <div className="studio-section-heading">
        <div><span className="eyebrow">SLIDE EDITOR</span><h2>Shape your lesson</h2></div>
        <span className="studio-format-pill">16:9 · Editable PPTX</span>
      </div>
      <PresentationBuilder lessonId={lessonId} lessonTitle={lesson.title} onSaved={() => navigate(`/lesson/${lessonId}`, { replace: true })} standalone />
      <p className="studio-footer-note">Your presentation is attached to this lesson when saved. Students see it once the lesson is published.</p>
    </div>
  );
}
