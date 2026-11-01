import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  GraduationCap,
  Sparkles,
  Users,
} from "lucide-react";
import { api, send } from "../api.js";
import { useAuth } from "../shared.jsx";
import { BrandIcon } from "../BrandIcon.jsx";

export function AuthPage({ register = false }) {
  const { setSession, notify } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("student");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedYearLevel, setSelectedYearLevel] = useState("");
  const [options, setOptions] = useState({
    departments: [],
    programs: [],
    sections: [],
    academicYears: [],
  });
  const [optionsError, setOptionsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  useEffect(() => {
    if (register)
      api("/auth/options")
        .then((data) => {
          setOptions({
            departments: data?.departments || [],
            programs: data?.programs || [],
            sections: data?.sections || [],
            academicYears: data?.academicYears || [],
          });
          setOptionsError("");
        })
        .catch((error) => setOptionsError(error.message));
  }, [register]);
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (register && values.password !== values.confirmPassword) {
      notify("Your passwords do not match.");
      return;
    }
    delete values.confirmPassword;
    setBusy(true);
    try {
      const result = await api(
        `/auth/${register ? "register" : "login"}`,
        send(
          "POST",
          register
            ? {
                ...values,
                department: options.departments.find(
                  (item) => item.code === values.department,
                )?.name,
                role,
                privacyAcknowledged: values.privacyAcknowledged === "on",
                ...(role === "student"
                  ? { enrollmentYear: Number(values.enrollmentYear) }
                  : {}),
              }
            : values,
        ),
      );
      setSession(await api("/auth/me"));
      notify(
        register
          ? "Your learning space is ready."
          : `Welcome back, ${result.user.firstName}.`,
      );
      navigate("/");
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-art">
        <div className="art-grain" />
        <Link to="/login" className="brand">
          <BrandIcon light /> Modulink
        </Link>
        <div className="art-copy">
          <span className="eyebrow light">A calmer way to learn</span>
          <h1>
            Good work
            <br />
            takes <em>practice.</em>
          </h1>
          <p>
            A focused place for classes, lessons, and the small steps that add
            up.
          </p>
          <div className="art-quote">
            <div className="quote-line" />
            <span>LEARN AT YOUR OWN PACE</span>
          </div>
        </div>
        <div className="art-bottom">
          <span>01 — LEARN WITH INTENTION</span>
          <span>EST. FOR THE ACADEMIC YEAR</span>
        </div>
        <div className="art-stamp">
          <Sparkles size={19} />
          <span>
            Curiosity
            <br />
            looks good on you.
          </span>
        </div>
      </div>
      <section className="auth-panel">
        <div className="auth-topline">
          <span>YOUR ACADEMIC SPACE</span>
          <span>01 / 02</span>
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">
            {register ? "Start here" : "Good to see you"}
          </span>
          <h2>
            {register ? "Make room to grow." : "Pick up where you left off."}
          </h2>
          <p className="muted">
            {register
              ? "Create your account and step into your learning space."
              : "Sign in to see what’s waiting for you."}
          </p>
          {register && (
            <div className="role-switch">
              <button
                className={role === "student" ? "active" : ""}
                onClick={() => setRole("student")}
                type="button"
              >
                <GraduationCap size={16} /> I’m a student
              </button>
              <button
                className={role === "faculty" ? "active" : ""}
                onClick={() => setRole("faculty")}
                type="button"
              >
                <Users size={16} /> I teach here
              </button>
            </div>
          )}
          <form onSubmit={submit} className="form-stack">
            {register && (
              <label>
                Department
                <select
                  name="department"
                  required
                  value={selectedDepartment}
                  onChange={(event) => {
                    setSelectedDepartment(event.target.value);
                    setSelectedProgram("");
                    setSelectedYearLevel("");
                  }}
                >
                  <option value="" disabled>
                    {optionsError
                      ? "Department list unavailable"
                      : options.departments.length
                        ? "Select your department"
                        : "Loading departments…"}
                  </option>
                  {(options.departments || []).map((department) => (
                    <option key={department.code} value={department.code}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {optionsError && (
                  <small role="alert" className="field-error">
                    Could not load the department list. {optionsError}
                  </small>
                )}
              </label>
            )}
            {register && (
              <>
                <div className="field-row">
                  <label>
                    First name
                    <input
                      name="firstName"
                      placeholder="e.g. Alex"
                      required
                      autoComplete="given-name"
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      name="lastName"
                      placeholder="e.g. Reyes"
                      required
                      autoComplete="family-name"
                    />
                  </label>
                </div>
                <label>
                  Middle name <span className="optional">OPTIONAL</span>
                  <input
                    name="middleName"
                    placeholder="e.g. Santos"
                    autoComplete="additional-name"
                  />
                </label>
              </>
            )}
            <label>
              Username
              <input
                name="username"
                type="text"
                placeholder={register ? "e.g. alex.reyes" : "Your username"}
                minLength={3}
                maxLength={register ? 32 : 254}
                pattern={register ? "[A-Za-z0-9._-]+" : undefined}
                required
                autoComplete="username"
              />
            </label>
            {register && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  placeholder="you@school.edu"
                  required
                  autoComplete="email"
                />
              </label>
            )}
            <label>
              Password
              <span className="password-field">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    register ? "At least 8 characters" : "Your password"
                  }
                  required
                  minLength={8}
                  autoComplete={register ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {register && (
              <label>
                Confirm password
                <span className="password-field">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Enter your password again"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                    aria-pressed={showConfirmPassword}
                    onClick={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </span>
              </label>
            )}
            {register && role === "student" && (
              <>
                <label>
                  Degree program
                  <select
                    name="program"
                    required
                    disabled={!selectedDepartment}
                    value={selectedProgram}
                    onChange={(event) => {
                      setSelectedProgram(event.target.value);
                      setSelectedYearLevel("");
                    }}
                  >
                    <option value="" disabled>
                      {selectedDepartment
                        ? "Select your program"
                        : "Choose a department first"}
                    </option>
                    {(options.programs || [])
                      .filter(
                        (program) => program.department === selectedDepartment,
                      )
                      .map((program) => (
                        <option value={program._id} key={program._id}>
                          {program.code} — {program.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="field-row">
                  <label>
                    Enrollment year
                    <input
                      name="enrollmentYear"
                      type="number"
                      min="2000"
                      max="2100"
                      defaultValue={new Date().getFullYear()}
                      required
                    />
                  </label>
                  <label>
                    Starting year level
                    <select
                      name="currentYearLevel"
                      required
                      value={selectedYearLevel}
                      onChange={(event) =>
                        setSelectedYearLevel(event.target.value)
                      }
                    >
                      <option value="" disabled>
                        Choose
                      </option>
                      {(
                        (options.programs || []).find(
                          (program) => program._id === selectedProgram,
                        )?.yearLevels || []
                      ).map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {(options.sections || []).some(
                  (section) =>
                    String(section.program?._id) === selectedProgram &&
                    section.yearLevel === selectedYearLevel,
                ) && (
                  <label>
                    Class section <span className="optional">OPTIONAL</span>
                    <select name="section" defaultValue="">
                      <option value="">I’ll be assigned later</option>
                      {(options.sections || [])
                        .filter(
                          (section) =>
                            String(section.program?._id) === selectedProgram &&
                            section.yearLevel === selectedYearLevel,
                        )
                        .map((section) => (
                          <option value={section._id} key={section._id}>
                            {section.name} · {section.yearLevel}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}
            {register && (
              <fieldset className="privacy-consent">
                <legend>Your privacy rights</legend>
                <p>
                  Modulink uses your account details and course activity to
                  provide classes, coursework, and grades. You may ask your
                  school about accessing or correcting your personal data and
                  other rights under applicable privacy rules.
                </p>
                <label>
                  <input type="checkbox" name="privacyAcknowledged" required />
                  <span>
                    I have read this notice and agree to the described use of my
                    information to provide Modulink.
                  </span>
                </label>
              </fieldset>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : register
                  ? "Create my account"
                  : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-switch">
            {register ? "Already have an account?" : "New to Modulink?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}{" "}
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
        <div className="auth-footer">
          <span>© MODULINK LEARNING</span>
          <span>MADE FOR THE LONG WAY AROUND.</span>
        </div>
      </section>
    </main>
  );
}
