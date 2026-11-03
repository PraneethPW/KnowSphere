import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X } from "lucide-react";
import { api, ApiError } from "./api";
import type { User } from "./types";
import Landing, { VisualBoundary } from "./Landing";
import Auth from "./Auth";
import { ErrorBox, Spinner, ToastContext } from "./components/UI";

const Workspace = lazy(() => import("./Workspace"));
function Protected() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
    retry: false,
  });
  if (query.isPending)
    return (
      <div className="full-loader">
        <Spinner label="Opening your knowledge space" />
      </div>
    );
  if (query.error instanceof ApiError && query.error.status === 401)
    return <Navigate to="/auth" replace />;
  if (query.error)
    return (
      <div className="full-loader">
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
        <a href="/">Return to KnowSphere</a>
      </div>
    );
  return (
    <VisualBoundary
      fallback={
        <div className="full-loader">
          <ErrorBox
            error="The workspace could not open. Reload the page to try again."
            retry={() => window.location.reload()}
          />
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="full-loader">
            <Spinner label="Preparing your workspace" />
          </div>
        }
      >
        <Workspace user={query.data!} />
      </Suspense>
    </VisualBoundary>
  );
}
export default function App() {
  const [toast, setToast] = useState(""),
    client = useQueryClient(),
    location = useLocation();
  useEffect(() => {
    const expired = () => {
      client.clear();
      window.location.assign("/auth");
    };
    window.addEventListener("knowsphere:expired", expired);
    return () => window.removeEventListener("knowsphere:expired", expired);
  }, [client]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash]);
  return (
    <ToastContext.Provider value={setToast}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/app/*" element={<Protected />} />
        <Route
          path="*"
          element={
            <main className="not-found">
              <h1>This connection leads nowhere.</h1>
              <p>The page you’re looking for doesn’t exist.</p>
              <a className="button button-primary" href="/">
                Back to KnowSphere
              </a>
            </main>
          }
        />
      </Routes>
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            role="status"
            className="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <CheckCircle2 size={18} />
            <span>{toast}</span>
            <button
              className="icon-button"
              onClick={() => setToast("")}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}
