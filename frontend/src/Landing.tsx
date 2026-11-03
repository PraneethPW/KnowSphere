import { Component, lazy, Suspense, useRef } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  FileText,
  GitBranch,
  Layers3,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Logo } from "./components/UI";

const Orb = lazy(() => import("./components/Orb"));
export class VisualBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* WebGL can be unavailable on low-power devices. */
  }
  render() {
    return this.state.failed
      ? this.props.fallback || (
          <div className="orb-fallback" aria-hidden="true" />
        )
      : this.props.children;
  }
}

export default function Landing() {
  const hero = useRef(null);
  const { scrollYProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 90]);
  return (
    <div className="landing cockpit-landing">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="landing-nav">
        <Link to="/" aria-label="KnowSphere home">
          <Logo />
        </Link>
        <div className="landing-links">
          <a href="#systems">System modules</a>
          <a href="#pipeline">The pipeline</a>
        </div>
        <Link className="nav-enter" to="/auth">
          Operator sign in <ArrowUpRight size={16} />
        </Link>
      </nav>
      <main id="main">
        <section className="cockpit-hero" ref={hero}>
          <div className="hero-topline">
            <span>
              <i /> KNOWLEDGE OPERATING SYSTEM
            </span>
            <span>KS—02 / RESEARCH DIVISION</span>
          </div>
          <motion.div
            className="cockpit-hero-copy"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="hero-kicker">
              THE NEXT CONNECTION IS YOURS TO FIND.
            </span>
            <h1>
              YOUR
              <br />
              KNOWLEDGE.
              <br />
              <em>FULL CONTROL.</em>
            </h1>
            <p>
              Turn scattered sources into connected intelligence. Command your
              graph, watch knowledge take shape, and trace every answer back to
              its evidence.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/auth?mode=register">
                Launch cockpit <ArrowUpRight size={20} />
              </Link>
              <a href="#systems" className="text-link">
                Explore systems <ArrowDown size={15} />
              </a>
            </div>
            <div className="hero-security">
              <Check size={13} /> PRIVATE SPACES <span>/</span> SOURCE-GROUNDED
              AI <span>/</span> LIVE OPERATIONS
            </div>
          </motion.div>
          <motion.div className="reactor-viewport" style={{ y }}>
            <div className="reactor-grid" />
            <div className="reactor-axis axis-x" />
            <div className="reactor-axis axis-y" />
            <span className="reactor-coord coord-top">
              KNOWSPHERE / NEURAL REACTOR
            </span>
            <span className="reactor-coord coord-bottom">
              PROCEDURAL 3D ARTWORK · DRAG TO ROTATE
            </span>
            <div className="reactor-bracket bracket-tl" />
            <div className="reactor-bracket bracket-br" />
            <VisualBoundary>
              <Suspense fallback={<div className="orb-fallback" />}>
                <Orb />
              </Suspense>
            </VisualBoundary>
            <div className="reactor-label reactor-label-one">
              <span>01 / INPUT</span>
              <strong>YOUR SOURCES</strong>
              <i />
            </div>
            <div className="reactor-label reactor-label-two">
              <span>02 / STRUCTURE</span>
              <strong>VERIFIED EVIDENCE</strong>
              <i />
            </div>
            <div className="reactor-label reactor-label-three">
              <span>03 / OUTPUT</span>
              <strong>CONNECTED KNOWLEDGE</strong>
              <i />
            </div>
            <span className="reactor-cross">+</span>
          </motion.div>
          <div className="hero-bottomline">
            <span>SCATTERED INFORMATION → CONNECTED INTELLIGENCE</span>
            <a href="#systems">
              SCROLL TO INITIALIZE <ArrowDown size={14} />
            </a>
          </div>
        </section>
        <div className="system-marquee" aria-hidden="true">
          <span>SOURCE INGESTION</span>
          <i>+</i>
          <span>LIVE TELEMETRY</span>
          <i>+</i>
          <span>3D GRAPH EXPLORATION</span>
          <i>+</i>
          <span>EVIDENCE TRACING</span>
          <i>+</i>
          <span>CITED INTELLIGENCE</span>
        </div>
        <section id="systems" className="systems-section">
          <div className="systems-intro">
            <div>
              <span className="eyebrow">LOADOUT / CORE SYSTEMS</span>
              <h2>
                Built for the
                <br />
                <em>deep dive.</em>
              </h2>
            </div>
            <p>
              One cockpit for your entire research operation. Real documents.
              Real relationships. Every signal has a source.
            </p>
          </div>
          <div className="system-cards">
            {[
              {
                n: "01",
                icon: <ScanLine />,
                label: "OPERATIONS",
                title: "Watch it happen.",
                text: "Follow ingestion from queue to evidence checkpoints to graph publication. A durable event log shows what changed and when.",
                tags: "Live pipeline / Event history",
              },
              {
                n: "02",
                icon: <GitBranch />,
                label: "TACTICAL GRAPH",
                title: "Connect the unseen.",
                text: "Orbit your knowledge in 3D. Isolate neighborhoods, trace paths between entities, and inspect the original quote behind a connection.",
                tags: "3D exploration / Path tracing",
              },
              {
                n: "03",
                icon: <Sparkles />,
                label: "INTELLIGENCE COMMS",
                title: "Question everything.",
                text: "Ask across your indexed sources. Watch the research trace, inspect retrieved passages, and receive streamed answers with citations.",
                tags: "Source retrieval / Cited answers",
              },
            ].map((f, i) => (
              <motion.article
                key={f.n}
                className="system-card"
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="system-card-top">
                  {f.icon}
                  <span>MODULE / {f.n}</span>
                </div>
                <span className="eyebrow">{f.label}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <div>
                  {f.tags}
                  <ArrowUpRight size={17} />
                </div>
              </motion.article>
            ))}
          </div>
        </section>
        <section id="pipeline" className="landing-pipeline">
          <div>
            <span className="eyebrow">PROTOCOL / SOURCE TO SIGNAL</span>
            <h2>
              Feed the system.
              <br />
              <em>Expand your edge.</em>
            </h2>
            <p>
              Your knowledge grows from the documents you bring. No prefilled
              universe. Start with a source and follow the connections.
            </p>
            <Link to="/auth?mode=register" className="button button-primary">
              Initialize your space <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="protocol-steps">
            {[
              {
                icon: <FileText />,
                n: "01",
                title: "DEPLOY A SOURCE",
                text: "Upload PDF, TXT, Markdown, CSV — or paste your research directly.",
              },
              {
                icon: <Layers3 />,
                n: "02",
                title: "EXTRACT & VALIDATE",
                text: "AI identifies entities and relations. Evidence quotes must match the source before publication.",
              },
              {
                icon: <Box />,
                n: "03",
                title: "EXPLORE & INTERROGATE",
                text: "Follow the graph, find connecting paths, and ask questions grounded in retrieved passages.",
              },
            ].map((step) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <span>{step.n}</span>
                <div className="protocol-icon">{step.icon}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
        <section className="cockpit-cta">
          <span className="eyebrow">MISSION / YOUR NEXT DISCOVERY</span>
          <h2>
            Take the
            <br />
            <em>controls.</em>
          </h2>
          <Link className="button button-primary" to="/auth?mode=register">
            Enter KnowSphere <ArrowRight size={18} />
          </Link>
          <span className="cta-coordinate">
            SOURCE → STRUCTURE → UNDERSTANDING
          </span>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>KNOWLEDGE IS YOUR ADVANTAGE.</span>
        <a href="#main">
          BACK TO SURFACE <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
