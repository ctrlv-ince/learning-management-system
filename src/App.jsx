import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api } from "./api.js";
import { AuthContext } from "./shared.jsx";
import { BrandIcon } from "./BrandIcon.jsx";
import { AuthPage } from "./pages/AuthPage.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { FacultyDirectoryPage } from "./pages/Faculty.jsx";
import { Workspace } from "./layout/Workspace.jsx";

function App() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api("/auth/me")
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecked(true));
  }, []);
  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3400);
  };
  if (!checked)
    return (
      <div className="boot">
        <BrandIcon />
        <span>Getting your workspace ready</span>
      </div>
    );
  return (
    <AuthContext.Provider value={{ session, setSession, notify }}>
      <Routes>
        <Route path="/" element={session ? <Workspace /> : <LandingPage />} />
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/faculty" element={<FacultyDirectoryPage />} />
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route
          path="/register"
          element={
            session ? <Navigate to="/" replace /> : <AuthPage register />
          }
        />
        <Route
          path="/*"
          element={session ? <Workspace /> : <Navigate to="/login" replace />}
        />
      </Routes>
      {notice && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
    </AuthContext.Provider>
  );
}

export default App;
