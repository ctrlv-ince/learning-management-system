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

export function Loading() {
  return (
    <div className="loading">
      <span className="spinner" />
      Finding your place…
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

export function CourseRow({ offering, index, showRoster = false }) {
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
