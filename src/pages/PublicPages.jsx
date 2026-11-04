import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandIcon } from "../BrandIcon.jsx";
import { useAuth } from "../shared.jsx";

const quickLinks = [
  { to: "/how-it-works", label: "How Modulink works" },
  { to: "/student-guide", label: "Student guide" },
  { to: "/faculty-guide", label: "Faculty guide" },
  { to: "/faculty", label: "Faculty directory" },
  { to: "/privacy", label: "Privacy policy" },
];

export function PrivacyPolicyContent() {
  return (
    <div className="privacy-policy-copy">
      <p className="privacy-policy-updated">Updated November 4, 2026</p>
      <p>
        This notice explains what information Modulink handles, why it is used,
        and how it is shared. Modulink is a learning platform used by a school
        to support courses. The school operating this deployment is responsible
        for deciding how its academic records are managed.
      </p>

      <section>
        <h2>Information the platform handles</h2>
        <ul>
          <li>
            Account details such as your name, username, email address, role,
            and a securely hashed password.
          </li>
          <li>
            Student details such as student ID, program, enrollment year, year
            level, and section. Faculty profiles include department.
          </li>
          <li>
            Course membership, lesson access and progress, quiz answers and
            attempts, scores, grades, and submission times.
          </li>
          <li>
            Materials uploaded by faculty, including filenames and the
            associated lesson.
          </li>
        </ul>
      </section>

      <section>
        <h2>How it is used and who can see it</h2>
        <p>
          The platform uses this information to create accounts, organize
          courses, manage enrollment, deliver lessons and quizzes, record
          academic progress, and show grades to the student and faculty assigned
          to that course. Students enrolled in the same course can see
          classmates’ names. The public faculty directory shows faculty names
          and departments.
        </p>
      </section>

      <section>
        <h2>Service providers and AI features</h2>
        <p>
          Modulink uses MongoDB to store account and course records. Lesson
          files are stored with the configured file-storage provider, which may
          include Cloudinary. When faculty choose an AI summary or quiz-draft
          feature, Modulink extracts readable text from the selected
          presentation and sends that text to Groq to generate a draft. Faculty
          review generated content before using it. Student quiz answers are not
          sent to Groq by these features.
        </p>
      </section>

      <section>
        <h2>Sign-in and security</h2>
        <p>
          Modulink uses an HTTP-only session cookie to keep you signed in. In
          production, the cookie is sent over HTTPS and expires after eight
          hours. Passwords are stored as hashes rather than readable passwords.
          Access to course information is restricted by account role and course
          membership.
        </p>
      </section>

      <section>
        <h2>Retention and requests</h2>
        <p>
          The school operating the platform determines how long academic records
          must be kept. Removing a student from a course does not automatically
          erase quiz attempts or grade history. Modulink does not currently
          provide self-service account deletion. To request access to,
          correction of, or deletion or blocking of information, contact your
          school administrator or its designated privacy officer through the
          school’s official channel. Requests are handled subject to applicable
          law and school recordkeeping requirements.
        </p>
      </section>

      <section>
        <h2>Your privacy rights</h2>
        <p>
          Under applicable Philippine privacy law, you may have rights to be
          informed, access or correct your information, object to certain
          processing, request erasure or blocking where applicable, and pursue
          other rights provided by law. Your school’s privacy officer can
          explain how to submit a request. See the{" "}
          <a
            href="https://privacy.gov.ph/data-subject-rights/"
            target="_blank"
            rel="noreferrer"
          >
            National Privacy Commission’s guide to data subject rights
          </a>
          .
        </p>
      </section>

      <p className="privacy-policy-contact">
        Acknowledging this notice confirms that you have read it; it does not
        waive privacy rights granted by law. The school should provide its
        official privacy contact for requests about this deployment.
      </p>
    </div>
  );
}

function PublicLayout({ eyebrow, title, detail, children }) {
  const { session } = useAuth();
  return (
    <main className="landing-page public-info-page">
      <header className="landing-nav">
        <Link className="brand" to="/" aria-label="Modulink home">
          <BrandIcon /> Modulink
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/how-it-works">How it works</Link>
          <Link className="landing-signin" to="/faculty">
            Faculty directory
          </Link>
          <Link className="button primary" to={session ? "/" : "/register"}>
            {session ? "Your workspace" : "Create an account"}
            <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <div className="public-info-content">
        <Link className="public-back-link" to="/">
          <ArrowLeft size={15} /> Back to Modulink
        </Link>
        <header className="public-info-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{detail}</p>
        </header>
        {children}
        <nav
          className="public-info-quick-links"
          aria-label="More Modulink pages"
        >
          <span className="eyebrow">EXPLORE MODULINK</span>
          <div>
            {quickLinks.map((item) => (
              <Link to={item.to} key={item.to}>
                {item.label} <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        </nav>
      </div>
      <footer className="landing-footer public-info-footer">
        <Link className="brand" to="/">
          <BrandIcon /> Modulink
        </Link>
        <span>LEARN AT YOUR OWN PACE</span>
        <Link to={session ? "/" : "/login"}>
          {session ? "Return to your workspace" : "Sign in"}{" "}
          <ArrowUpRight size={13} />
        </Link>
      </footer>
    </main>
  );
}

export function PrivacyPolicyPage() {
  return (
    <PublicLayout
      eyebrow="PRIVACY NOTICE · VERSION 2"
      title="Your information, explained."
      detail="A plain-language guide to the information Modulink handles for learning and course administration."
    >
      <PrivacyPolicyContent />
    </PublicLayout>
  );
}

function GuideSection({ title, children }) {
  return (
    <section className="public-guide-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function HowItWorksPage() {
  return (
    <PublicLayout
      eyebrow="A QUICK TOUR"
      title="A clearer path through each course."
      detail="Modulink connects your course, lessons, learning materials, assessments, and progress in one place."
    >
      <div className="public-guide-grid">
        <GuideSection title="Courses start with a section">
          <p>
            Courses are organized by department, degree program, year level,
            section, and academic period. Faculty can enroll students directly
            or share an invite code for students to request a place.
          </p>
        </GuideSection>
        <GuideSection title="Lessons build in sequence">
          <p>
            Faculty publish focused lessons with notes and uploaded materials.
            Students unlock the next lesson by passing the current lesson’s
            quiz.
          </p>
        </GuideSection>
        <GuideSection title="Progress stays visible">
          <p>
            Students can review their lesson progress and results. Faculty can
            review enrolled students, quiz attempts, and course grades in the
            gradebook.
          </p>
        </GuideSection>
      </div>
    </PublicLayout>
  );
}

export function StudentGuidePage() {
  return (
    <PublicLayout
      eyebrow="FOR STUDENTS"
      title="Your course, one step at a time."
      detail="A short guide to joining a course and moving through its learning path."
    >
      <div className="public-guide-grid">
        <GuideSection title="1. Create your account">
          <p>
            Register with your school details, department, program, and current
            year level. Choose a section if one is available to you.
          </p>
        </GuideSection>
        <GuideSection title="2. Join your course">
          <p>
            Your faculty member may enroll you directly or share a course invite
            code. A request made with a code must be approved by faculty. Each
            course offering has room for up to 40 students.
          </p>
        </GuideSection>
        <GuideSection title="3. Learn and retry">
          <p>
            Open lessons in order, view the materials on the page, then take the
            quiz. Each attempt allows one submission. If you do not pass, you
            can review the lesson and try again until you pass.
          </p>
        </GuideSection>
      </div>
    </PublicLayout>
  );
}

export function FacultyGuidePage() {
  return (
    <PublicLayout
      eyebrow="FOR FACULTY"
      title="Build a course students can follow."
      detail="Set up a course, publish its learning path, and keep an eye on student progress."
    >
      <div className="public-guide-grid">
        <GuideSection title="1. Set up a course offering">
          <p>
            Create an academic year, section, and course offering for your
            department. A course offering can enroll up to 40 students.
          </p>
        </GuideSection>
        <GuideSection title="2. Add lessons and materials">
          <p>
            Keep lessons in a clear sequence. Upload presentations and other
            learning materials for students to view in Modulink.
          </p>
        </GuideSection>
        <GuideSection title="3. Check every assessment">
          <p>
            Build quizzes manually, import a formatted document, or draft a
            10–20 question quiz from a presentation with AI. Review questions
            and answers before publishing.
          </p>
        </GuideSection>
        <GuideSection title="4. Review progress">
          <p>
            Use the roster to manage enrollment and the gradebook to review
            scores, attempt counts, and course progress.
          </p>
        </GuideSection>
      </div>
    </PublicLayout>
  );
}
