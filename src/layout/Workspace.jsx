import { useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { api, send } from "../api.js";
import { useAuth, fullName, initials } from "../shared.jsx";
import { BrandIcon } from "../BrandIcon.jsx";
import { Dashboard } from "../pages/Dashboard.jsx";
import { Courses, CoursePage } from "../pages/Courses.jsx";
import {
  StudentsPage,
  StudentClassmatesPage,
  GradesPage,
  AcademicSetup,
} from "../pages/Faculty.jsx";
import { LessonPage } from "../pages/LessonPage.jsx";

export function Workspace() {
  const { session, setSession } = useAuth();
  const [mobileNav, setMobileNav] = useState(false);
  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);
  const wasMobileNavOpen = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const role = session.user.role;
  useEffect(() => {
    if (mainRef.current) mainRef.current.inert = mobileNav;
    if (mobileNav) {
      wasMobileNavOpen.current = true;
      const focusFrame = window.requestAnimationFrame(() => sidebarRef.current?.querySelector(".nav-item")?.focus());
      const closeOnEscape = (event) => {
        if (event.key === "Escape") setMobileNav(false);
      };
      window.addEventListener("keydown", closeOnEscape);
      return () => {
        window.cancelAnimationFrame(focusFrame);
        window.removeEventListener("keydown", closeOnEscape);
      };
    }
    if (wasMobileNavOpen.current) menuButtonRef.current?.focus();
    wasMobileNavOpen.current = false;
    return undefined;
  }, [mobileNav]);
  const nav =
    role === "faculty"
      ? [
          {
            label: "Your space",
            items: [
              { text: "Overview", to: "/", icon: LayoutDashboard },
              { text: "My courses", to: "/courses", icon: BookOpen },
              { text: "Enrolled students", to: "/students", icon: Users },
            ],
          },
          {
            label: "Keep things moving",
            items: [
              { text: "Gradebook", to: "/grades", icon: FileText },
              {
                text: "Programs & sections",
                to: "/academic-setup",
                icon: Settings2,
              },
            ],
          },
        ]
      : [
          {
            label: "Your space",
            items: [
              { text: "Overview", to: "/", icon: LayoutDashboard },
              { text: "My courses", to: "/courses", icon: BookOpen },
              { text: "My grades", to: "/grades", icon: FileText },
              { text: "Classmates", to: "/classmates", icon: Users },
            ],
          },
        ];
  async function logout() {
    await api("/auth/logout", send("POST", {})).catch(() => {});
    setSession(null);
    navigate("/login");
  }
  return (
    <div className="workspace">
      <aside ref={sidebarRef} id="workspace-navigation" aria-label="Workspace navigation" className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <Link className="brand sidebar-brand" to="/">
          <BrandIcon /> Modulink
        </Link>
        <div className="org-switch">
          <div className="org-glyph">M</div>
          <span>
            <strong>My campus</strong>
            <small>Learning community</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-groups">
          {nav.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => (
                <Link
                  onClick={() => setMobileNav(false)}
                  aria-current={location.pathname === item.to || (item.to === "/courses" && (location.pathname.startsWith("/courses/") || location.pathname.startsWith("/lesson/"))) ? "page" : undefined}
                  className={`nav-item ${location.pathname === item.to || (item.to === "/courses" && (location.pathname.startsWith("/courses/") || location.pathname.startsWith("/lesson/"))) ? "selected" : ""}`}
                  to={item.to}
                  key={item.to}
                >
                  <item.icon size={17} strokeWidth={1.8} />
                  <span>{item.text}</span>
                  {item.text === "Students" && (
                    <span className="nav-count">›</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <Link
            className="sidebar-public-home"
            to="/welcome"
            onClick={() => setMobileNav(false)}
          >
            <ArrowUpRight size={14} /> View public landing page
          </Link>
          <div className="term-card">
            <span className="term-symbol">
              <Sparkles size={15} />
            </span>
            <span>
              <b>A little at a time.</b>
              <small>It all adds up.</small>
            </span>
            <ArrowUpRight size={14} />
          </div>
          <button className="user-menu" onClick={logout}>
            <span className="avatar">{initials(session.user)}</span>
            <span>
              <strong>{fullName(session.user)}</strong>
              <small>{role === "faculty" ? "Faculty" : "Student"}</small>
            </span>
            <LogOut className="logout-icon" size={15} />
          </button>
        </div>
      </aside>
      {mobileNav && <button className="nav-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <button
        ref={menuButtonRef}
        aria-label={mobileNav ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNav}
        aria-controls="workspace-navigation"
        onClick={() => setMobileNav(!mobileNav)}
        className="mobile-menu"
      >
        <Menu />
      </button>
      <main ref={mainRef} className="main-area">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:offeringId" element={<CoursePage />} />
          <Route
            path="students"
            element={
              role === "faculty" ? (
                <StudentsPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="grades" element={<GradesPage />} />
          <Route
            path="classmates"
            element={
              role === "student" ? (
                <StudentClassmatesPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="academic-setup"
            element={
              role === "faculty" ? (
                <AcademicSetup />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="lesson/:lessonId" element={<LessonPage />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
