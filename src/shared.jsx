import { createContext, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { api } from "./api.js";

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const fullName = (person) =>
  [person?.firstName, person?.middleName, person?.lastName]
    .filter(Boolean)
    .join(" ");
export const initials = (person) =>
  [person?.firstName?.[0], person?.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();
export const semesterLabel = (semester) =>
  semester === "Summer" ? "Third Semester" : semester;

export function PageHeader({ eyebrow, title, detail, action }) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {detail && <p className="muted">{detail}</p>}
      </div>
      {action}
    </header>
  );
}

export function Breadcrumbs({ items = [] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.to && index < items.length - 1 ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const statusLabels = {
  completed: "Completed", available: "Ready", locked: "Locked", draft: "Draft",
  published: "Published", passed: "Passed", failed: "Retry needed", pending: "Pending",
};
export function StatusBadge({ status, children }) {
  return <span className={`status-badge status-${status}`}>{children || statusLabels[status] || status}</span>;
}

export function Loading({ variant = "page", count = 3 }) {
  return (
    <div className={`skeleton-page skeleton-${variant}`} role="status" aria-label="Loading content">
      <span className="sr-only">Loading content</span>
      <div className="skeleton-heading">
        <span className="skeleton-block skeleton-eyebrow" />
        <span className="skeleton-block skeleton-title" />
        <span className="skeleton-block skeleton-subtitle" />
      </div>
      {variant === "dashboard" && <div className="skeleton-stats">{Array.from({ length: 3 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>}
      {variant === "courses" ? (
        <div className="skeleton-cards">{Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><span className="skeleton-block skeleton-art" /><span className="skeleton-block skeleton-line short" /><span className="skeleton-block skeleton-line" /><span className="skeleton-block skeleton-line medium" /><span className="skeleton-block skeleton-line footer" /></div>)}</div>
      ) : variant === "table" ? (
        <div className="skeleton-table">{Array.from({ length: 6 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>
      ) : (
        <div className="skeleton-panels"><div className="skeleton-panel"><span className="skeleton-block skeleton-line" /><span className="skeleton-block skeleton-line medium" /><span className="skeleton-block skeleton-line" /><span className="skeleton-block skeleton-line short" /></div>{variant !== "lesson" && <div className="skeleton-panel"><span className="skeleton-block skeleton-line" /><span className="skeleton-block skeleton-line medium" /><span className="skeleton-block skeleton-line" /><span className="skeleton-block skeleton-line short" /></div>}</div>
      )}
    </div>
  );
}

export function useData(path) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const refresh = () =>
    api(path)
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((error) =>
        setState({ data: null, loading: false, error: error.message }),
      );
  useEffect(() => {
    refresh();
  }, [path]);
  return { ...state, refresh };
}

export function CourseRow({ offering, index, showRoster = false, progress }) {
  const colors = [
    "course-mint",
    "course-lilac",
    "course-amber",
    "course-blue",
    "course-rose",
  ];
  return (
    <Link to={`/courses/${offering._id}`} className="course-row">
      <span className={`course-index ${colors[index % colors.length]}`}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="course-name">
        <span className="course-code">
          {offering.course?.code} <span>·</span>{" "}
          {offering.section?.yearLevel || offering.section?.name}
        </span>
        <strong>{offering.course?.title}</strong>
        <small>
          {offering.academicYear?.label || "Current year"} ·{" "}
          {semesterLabel(offering.semester)}
        </small>
        {progress && (
          <span className="course-row-progress">
            <span className="course-progress-track"><span style={{ width: `${progress.percent}%` }} /></span>
            <small>{progress.completed}/{progress.total} lessons · {progress.nextTitle || (progress.total ? "All lessons complete" : "No lessons published")}</small>
          </span>
        )}
      </div>
      <div className="course-row-meta">
        {showRoster && (
          <span>
            {offering.students?.length ?? 0} <small>students</small>
          </span>
        )}
        <ArrowRight size={16} />
      </div>
    </Link>
  );
}

export function EmptyPanel({ title, body, link, linkText }) {
  return (
    <div className="empty-panel">
      <div className="empty-symbol">
        <BookOpen size={18} />
      </div>
      <strong>{title}</strong>
      <p>{body}</p>
      {link && (
        <Link to={link} className="text-link">
          {linkText} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
