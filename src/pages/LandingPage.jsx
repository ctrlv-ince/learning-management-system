import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
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

export function LandingPage() {
  const { session } = useAuth();
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="brand" to="/" aria-label="Modulink home">
          <BrandIcon /> Modulink
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
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
