import { createContext, useContext, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  NavLink,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Radio,
  Crosshair,
  ChevronDown,
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { api, post } from "./api";
import type { Space, SystemInfo, User } from "./types";
import {
  Empty,
  ErrorBox,
  Logo,
  Modal,
  Spinner,
  useToast,
} from "./components/UI";
import { Overview, Insights, SettingsPage } from "./pages/Dashboard";
import Library from "./pages/Library";
import GraphPage from "./pages/Graph";
import ChatPage from "./pages/Chat";
import Operations from "./pages/Operations";
import { LiveProvider } from "./live";
import SearchConsole from "./components/SearchConsole";

type WorkspaceContextType = {
  space: Space;
  user: User;
  openDocument: (id: string) => void;
  openSearch: (query?: string) => void;
};
const WorkspaceContext = createContext<WorkspaceContextType | null>(null);
export const useWorkspace = () => useContext(WorkspaceContext)!;
const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/library", label: "Sources", icon: FileText },
  { to: "/app/chat", label: "AI chat", icon: MessageSquare },
  { to: "/app/graph", label: "Knowledge graph", icon: GitBranch },
  { to: "/app/operations", label: "Activity", icon: Radio },
];

export default function Workspace({ user }: { user: User }) {
  const [selected, setSelected] = useState(() => {
    try {
      return localStorage.getItem(`ks:space:${user.id}`) || "";
    } catch {
      return "";
    }
  });
  const [creating, setCreating] = useState(false),
    [spaceMenu, setSpaceMenu] = useState(false),
    [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInitial, setSearchInitial] = useState("");
  const [smallScreen, setSmallScreen] = useState(
    () => window.matchMedia("(max-width: 700px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setSmallScreen(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [mobile]);
  const client = useQueryClient(),
    toast = useToast(),
    navigate = useNavigate(),
    location = useLocation();
  const spaces = useQuery({
    queryKey: ["spaces"],
    queryFn: () => api<Space[]>("/spaces"),
  });
  const system = useQuery({
    queryKey: ["system"],
    queryFn: () => api<SystemInfo>("/system"),
    refetchInterval: 30_000,
  });
  const space = spaces.data?.find((s) => s.id === selected) || spaces.data?.[0];
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  useEffect(() => {
    try {
      if (space) localStorage.setItem(`ks:space:${user.id}`, space.id);
    } catch {
      /* Storage is optional. */
    }
  }, [space, user.id]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchInitial("");
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const name = new FormData(event.currentTarget).get("name");
      const created = await post<Space>("/spaces", { name });
      await client.invalidateQueries({ queryKey: ["spaces"] });
      setSelected(created.id);
      setCreating(false);
      toast("Knowledge space created.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await post("/auth/logout");
      client.clear();
      navigate("/auth");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sign out failed.");
    }
  }
  const page =
    navItems.find((n) => n.to === location.pathname)?.label ||
    (location.pathname === "/app/settings"
      ? "Settings"
      : location.pathname === "/app/insights"
        ? "Graph analysis"
        : "Page not found");
  if (spaces.isPending)
    return (
      <div className="full-loader">
        <Spinner label="Loading your spaces" />
      </div>
    );
  if (spaces.error || !space)
    return (
      <div className="full-loader">
        <ErrorBox
          error={spaces.error || "No knowledge space found."}
          retry={() => void spaces.refetch()}
        />
      </div>
    );
  return (
    <WorkspaceContext.Provider
      value={{
        space,
        user,
        openDocument: (id) => navigate(`/app/library?document=${id}`),
        openSearch: (query = "") => {
          setSearchInitial(query.slice(0, 500));
          setSearchOpen(true);
        },
      }}
    >
      <LiveProvider key={space.id} spaceId={space.id}>
        <div className="workspace">
          <a className="skip-link" href="#workspace-main">
            Skip to workspace content
          </a>
          {mobile && (
            <button
              className="sidebar-overlay"
              aria-label="Close navigation"
              onClick={() => setMobile(false)}
            />
          )}
          <aside
            className={`sidebar ${mobile ? "sidebar-open" : ""}`}
            inert={smallScreen && !mobile}
            aria-hidden={smallScreen && !mobile}
          >
            <div className="sidebar-brand">
              <NavLink to="/" aria-label="KnowSphere home">
                <Logo />
              </NavLink>
              <button
                className="icon-button mobile-only"
                onClick={() => setMobile(false)}
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-picker">
              <button
                className="space-picker-trigger"
                onClick={() => setSpaceMenu(!spaceMenu)}
                aria-expanded={spaceMenu}
              >
                <span className="space-avatar">
                  {space.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <small>WORKSPACE</small>
                  <strong>{space.name}</strong>
                </span>
                <ChevronDown size={15} />
              </button>
              {spaceMenu && (
                <div className="space-options">
                  {spaces.data?.map((s) => (
                    <button
                      key={s.id}
                      className={s.id === space.id ? "selected" : ""}
                      onClick={() => {
                        setSelected(s.id);
                        setSpaceMenu(false);
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setCreating(true);
                      setSpaceMenu(false);
                    }}
                  >
                    <Plus size={14} /> New knowledge space
                  </button>
                </div>
              )}
            </div>
            <nav className="sidebar-nav" aria-label="Workspace navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <NavLink
                to="/app/settings"
                className={({ isActive }) =>
                  `settings-link ${isActive ? "active" : ""}`
                }
              >
                <Settings2 size={17} /> Settings
              </NavLink>
              <div className="user-card">
                <span className="user-avatar">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{user.name}</strong>
                  <small>Personal account</small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => void logout()}
                  aria-label="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </aside>
          <div className="workspace-body">
            <header className="workspace-header">
              <div className="breadcrumbs">
                <button
                  className="icon-button mobile-only"
                  aria-label="Open navigation"
                  onClick={() => setMobile(true)}
                >
                  <Menu size={20} />
                </button>
                <strong>{page}</strong>
              </div>
              <div className="header-right">
                <button
                  className="search-shortcut"
                  aria-label="Search sources"
                  onClick={() => {
                    setSearchInitial("");
                    setSearchOpen(true);
                  }}
                >
                  <Search size={14} /> <span>Search sources</span>
                  <kbd>⌘ K</kbd>
                </button>
              </div>
            </header>
            <main id="workspace-main" className="workspace-main">
              {system.data &&
                (!system.data.ai_configured ||
                  system.data.worker !== "online") && (
                  <div className="configuration-banner">
                    <Activity size={16} />
                    <span>
                      {!system.data.ai_configured
                        ? "AI is not configured. Add your OpenRouter key to enable ingestion and answers."
                        : "The ingestion worker is offline. Queued jobs will resume when it reconnects."}
                    </span>
                    <NavLink to="/app/settings">Settings</NavLink>
                  </div>
                )}
              <motion.div
                key={space.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="operations" element={<Operations />} />
                  <Route path="graph" element={<GraphPage />} />
                  <Route path="library" element={<Library />} />
                  <Route path="chat" element={<ChatPage />} />
                  <Route path="insights" element={<Insights />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route
                    path="*"
                    element={
                      <div className="panel">
                        <Empty
                          icon={<Crosshair size={36} />}
                          title="Page not found"
                          description="Choose a page in navigation or return to your dashboard."
                          action={
                            <Link className="button button-primary" to="/app">
                              Dashboard
                            </Link>
                          }
                        />
                      </div>
                    }
                  />
                </Routes>
              </motion.div>
            </main>
          </div>
          {creating && (
            <Modal
              title="Create a knowledge space"
              onClose={() => setCreating(false)}
            >
              <p className="muted">
                Keep a separate graph and source library for each area of
                research.
              </p>
              <form className="form-stack" onSubmit={create}>
                <label>
                  Space name
                  <input
                    name="name"
                    required
                    maxLength={80}
                    placeholder="e.g. Research notes"
                    data-autofocus
                    autoFocus
                  />
                </label>
                {!!error && <ErrorBox error={error} />}
                <button disabled={busy} className="button button-primary">
                  {busy ? "Creating…" : "Create space"}
                  <Plus size={16} />
                </button>
              </form>
            </Modal>
          )}
        </div>
        {searchOpen && (
          <SearchConsole
            key={space.id}
            initialQuery={searchInitial}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </LiveProvider>
    </WorkspaceContext.Provider>
  );
}
