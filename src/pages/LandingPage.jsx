import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  FileText,
  Layers3,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BrandIcon } from "../BrandIcon.jsx";
import { useAuth } from "../shared.jsx";

const highlights = [
  {
    icon: BookOpen,
    title: "A clear path through each course",
    detail: "Lessons, notes, and presentations stay together in one place.",
  },
  {
    icon: Layers3,
    title: "Learn one topic at a time",
    detail: "Move forward as you complete lessons and pass their quizzes.",
  },
  {
    icon: UsersRound,
    title: "Organized by department",
    detail:
      "Courses stay tied to their department, with a public directory of faculty across campus.",
  },
];

const quickLinks = [
  {
    to: "/how-it-works",
    title: "How it works",
    detail: "See how courses, lessons, and progress connect.",
  },
  {
    to: "/student-guide",
    title: "Student guide",
    detail: "Learn how to join a course and move through lessons.",
  },
  {
    to: "/faculty-guide",
    title: "Faculty guide",
    detail: "Set up course offerings, materials, and assessments.",
  },
  {
    to: "/faculty",
    title: "Faculty directory",
    detail: "Browse faculty members by department.",
  },
  {
    to: "/privacy",
    title: "Privacy policy",
    detail: "Understand how Modulink handles account and course data.",
  },
];

export function LandingPage() {
  const { session } = useAuth();
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="brand" to="/" aria-label="Modulink home">
          <BrandIcon /> Modulink
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/how-it-works">How it works</Link>
          <Link className="landing-signin" to="/faculty">
            Faculty
          </Link>
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
                Create an account <ArrowRight size={15} />
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">LEARNING, LINKED</span>
          <h1>
            Every lesson
            <br />
            leads <em>somewhere.</em>
          </h1>
          <p>
            Modulink brings courses, learning materials, quizzes, and progress
            together so students and faculty can focus on the work ahead.
          </p>
          <div className="landing-cta">
            {session ? (
              <>
                <Link className="button primary" to="/">
                  Go to your workspace <ArrowRight size={16} />
                </Link>
                <Link className="landing-text-link" to="/faculty">
                  Browse faculty
                </Link>
              </>
            ) : (
              <>
                <Link className="button primary" to="/register">
                  Get started <ArrowRight size={16} />
                </Link>
                <Link className="landing-text-link" to="/login">
                  I already have an account
                </Link>
              </>
            )}
          </div>
          <div className="landing-caption">
            <span className="landing-caption-mark" />A steady place to teach,
            learn, and keep moving.
          </div>
        </div>

        <div
          className="landing-art"
          aria-label="A preview of a course learning path"
        >
          <div className="landing-art-glow" />
          <div className="learning-preview">
            <div className="preview-topline">
              <span>YOUR LEARNING PATH</span>
              <span className="preview-live">IN PROGRESS</span>
            </div>
            <h2>Introduction to Computing</h2>
            <p>BSIT · First Semester</p>
            <div className="preview-progress">
              <span>
                <b>02</b> of 06 lessons
              </span>
              <span>33%</span>
            </div>
            <div className="preview-track">
              <span />
            </div>
            <div className="preview-lesson done">
              <span>✓</span>
              <div>
                <small>LESSON 01</small>
                <b>Getting started</b>
              </div>
              <span className="preview-state">COMPLETE</span>
            </div>
            <div className="preview-lesson current">
              <span>02</span>
              <div>
                <small>LESSON 02</small>
                <b>Thinking in steps</b>
              </div>
              <span className="preview-state">IN PROGRESS</span>
            </div>
            <div className="preview-lesson locked">
              <span>03</span>
              <div>
                <small>LESSON 03</small>
                <b>Data and decisions</b>
              </div>
              <span className="preview-state">UP NEXT</span>
            </div>
          </div>
          <div className="landing-art-note">
            <span>✳</span>
            <div>
              <b>One step at a time.</b>
              <small>Progress that stays with you.</small>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-workflow" aria-labelledby="landing-workflow-title">
        <div className="landing-workflow-heading">
          <span className="landing-workflow-kicker">THE MODULINK FLOW</span>
          <h2 id="landing-workflow-title">A course that keeps every step connected.</h2>
          <p>Materials lead into focused lessons. Lessons lead into quizzes. Progress makes the next step clear.</p>
        </div>
        <div className="landing-workflow-steps">
          <article className="landing-workflow-step">
            <span className="landing-workflow-icon"><FileText size={20} /></span>
            <small>01 · GET ORIENTED</small>
            <h3>Start with the material</h3>
            <p>Find course notes and presentations alongside the lesson they support.</p>
          </article>
          <span className="landing-workflow-connector" aria-hidden="true"><i /></span>
          <article className="landing-workflow-step">
            <span className="landing-workflow-icon"><BookOpen size={20} /></span>
            <small>02 · LEARN IN ORDER</small>
            <h3>Take one lesson at a time</h3>
            <p>Follow a clear sequence, with the next lesson ready when you are.</p>
          </article>
          <span className="landing-workflow-connector" aria-hidden="true"><i /></span>
          <article className="landing-workflow-step">
            <span className="landing-workflow-icon"><CircleHelp size={20} /></span>
            <small>03 · CHECK YOUR UNDERSTANDING</small>
            <h3>Practice and keep moving</h3>
            <p>Take the lesson quiz, see your result, and retry when you need to.</p>
          </article>
        </div>
        <Link className="landing-workflow-link" to="/how-it-works">See how Modulink works <ArrowRight size={16} /></Link>
      </section>

      <section className="landing-audiences" aria-labelledby="landing-audiences-title">
        <div className="landing-section-heading landing-audiences-heading">
          <span className="eyebrow">ONE CAMPUS, TWO WORKFLOWS</span>
          <h2 id="landing-audiences-title">A clearer way to move learning forward.</h2>
          <p>Students and faculty get the tools they need, with each course organized around a shared learning path.</p>
        </div>
        <div className="landing-audience-grid">
          <article className="landing-audience-card student-audience">
            <span className="landing-audience-index">01 / STUDENTS</span>
            <h3>Always know what comes next.</h3>
            <p>Follow lessons in sequence, view course materials, and retry quizzes until you meet the passing score.</p>
            <Link to={session ? "/courses" : "/student-guide"}>{session ? "Open your courses" : "Explore the student guide"}<ArrowRight size={16} /></Link>
          </article>
          <article className="landing-audience-card faculty-audience">
            <span className="landing-audience-index">02 / FACULTY</span>
            <h3>Build a path your students can follow.</h3>
            <p>Keep presentations, lesson notes, quizzes, and class progress together in each course offering.</p>
            <Link to={session ? "/courses" : "/faculty-guide"}>{session ? "Manage your courses" : "Explore the faculty guide"}<ArrowRight size={16} /></Link>
          </article>
        </div>
        <div className="landing-feature-rail" aria-label="Platform features">
          <span><b>01</b> Lessons unlock in sequence</span>
          <span><b>02</b> Quizzes with guided retries</span>
          <span><b>03</b> Course materials in one place</span>
        </div>
      </section>

      <section className="landing-highlights" id="how-it-works">
        <div className="landing-section-heading">
          <span className="eyebrow">MADE FOR THE WAY LEARNING HAPPENS</span>
          <h2>Everything has a place.</h2>
        </div>
        <div className="landing-highlight-grid">
          {highlights.map(({ icon: Icon, title, detail }, index) => (
            <article className="landing-highlight" key={title}>
              <span className={`landing-highlight-icon tone-${index}`}>
                <Icon size={19} />
              </span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="landing-quick-links"
        aria-labelledby="quick-links-title"
      >
        <div className="landing-section-heading">
          <span className="eyebrow">QUICK LINKS</span>
          <h2 id="quick-links-title">Find your next step.</h2>
        </div>
        <div className="landing-quick-link-grid">
          {quickLinks.map(({ to, title, detail }) => (
            <Link className="landing-quick-link" to={to} key={to}>
              <span>
                <b>{title}</b>
                <small>{detail}</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <Link className="brand" to="/">
          <BrandIcon /> Modulink
        </Link>
        <span>LEARN AT YOUR OWN PACE</span>
        <Link to={session ? "/" : "/register"}>
          {session ? "Return to your workspace" : "Join your learning space"}{" "}
          <ArrowUpRight size={13} />
        </Link>
      </footer>
    </main>
  );
}
