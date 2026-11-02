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
  const y = useTransform(scrollYProgress, [0, 1], [0, 130]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 14]);
  return (
    <div className="landing">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="landing-nav">
        <Link to="/" aria-label="KnowSphere home">
          <Logo />
        </Link>
        <div className="landing-links">
          <a href="#possibilities">The possibilities</a>
          <a href="#how-it-works">How it works</a>
        </div>
        <Link className="nav-enter" to="/auth">
          Enter your space <ArrowUpRight size={16} />
        </Link>
      </nav>
      <main id="main">
        <section className="hero" ref={hero}>
          <div className="hero-grid" aria-hidden="true" />
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="eyebrow">
              <span className="live-dot" /> KNOWLEDGE, CONNECTED.
            </div>
            <h1>
              Find the
              <br />
              connections.
              <br />
              <span>
                See the bigger
                <br className="small-break" /> picture.
              </span>
            </h1>
            <p>
              Your knowledge is more than a collection of files.
              <br className="desktop-only" /> Turn it into a living universe of
              ideas, relationships,
              <br className="desktop-only" /> and discoveries. Every connection
              has a source.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/auth?mode=register">
                Start connecting <ArrowUpRight size={18} />
              </Link>
              <a className="text-link" href="#how-it-works">
                Explore the process <ArrowDown size={15} />
              </a>
            </div>
            <div className="hero-note">
              <Check size={14} /> Your documents. Your graph. Your next
              discovery.
            </div>
          </motion.div>
          <motion.div style={{ y, rotate }} className="hero-visual">
            <div className="orb-halo" />
            <VisualBoundary>
              <Suspense fallback={<div className="orb-fallback" />}>
                <Orb />
              </Suspense>
            </VisualBoundary>
            <span className="orbit-caption orbit-caption-one">
              <i /> IDEAS
            </span>
            <span className="orbit-caption orbit-caption-two">
              <i /> RELATIONSHIPS
            </span>
            <span className="orbit-caption orbit-caption-three">
              <i /> CONTEXT
            </span>
            <div className="visual-coordinates">
              <span>AN EXPLORATION OF CONNECTED THINKING</span>
              <span>↗ DRAG YOUR CURIOSITY FURTHER</span>
            </div>
          </motion.div>
          <div className="hero-bottom">
            <span>BUILT FOR THE CURIOUS MIND</span>
            <a href="#possibilities">
              Scroll to discover <ArrowDown size={14} />
            </a>
            <span className="hero-version">KNOWSPHERE / 01</span>
          </div>
        </section>
        <section id="possibilities" className="possibilities landing-section">
          <div className="section-intro">
            <span className="eyebrow">FROM INFORMATION TO UNDERSTANDING</span>
            <h2>
              The interesting part is
              <br />
              <span>between the dots.</span>
            </h2>
            <p>
              Connect what you read to what you already know.
              <br />
              Then follow the thread somewhere new.
            </p>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: <GitBranch />,
                n: "01",
                title: "Make knowledge visible.",
                text: "Explore entities and relationships in an interactive 3D graph. Move through your ideas, inspect connections, and find the source behind each one.",
                tags: "3D exploration · Source evidence",
              },
              {
                icon: <Sparkles />,
                n: "02",
                title: "Ask with context.",
                text: "Go beyond keyword search. Ask questions across your documents and get answers grounded in retrieved passages, with citations you can inspect.",
                tags: "Graph-assisted retrieval · Cited answers",
              },
              {
                icon: <ScanLine />,
                n: "03",
                title: "Follow what emerges.",
                text: "Discover connected communities and influential concepts using graph analysis. Watch your knowledge space change as new documents are indexed.",
                tags: "Community detection · Live progress",
              },
            ].map((f, i) => (
              <motion.article
                className="feature-card"
                key={f.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                <div className="feature-top">
                  {f.icon}
                  <span>{f.n}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <div className="feature-tags">{f.tags}</div>
              </motion.article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="process landing-section">
          <div className="section-intro">
            <span className="eyebrow">A CLEAR PATH TO DISCOVERY</span>
            <h2>
              Bring your sources.
              <br />
              <span>Leave with perspective.</span>
            </h2>
          </div>
          <div className="process-steps">
            {[
              {
                icon: <FileText />,
                title: "Bring it together",
                text: "Upload a PDF, Markdown, text, or CSV document. Or paste a passage directly into your knowledge space.",
              },
              {
                icon: <Layers3 />,
                title: "Let the structure emerge",
                text: "AI extracts entities and relationships. Supporting quotes are checked against the original text before entering your graph.",
              },
              {
                icon: <Box />,
                title: "Explore. Ask. Connect.",
                text: "Navigate in 3D, inspect source evidence, and ask questions that bring connected information into focus.",
              },
            ].map((step, i) => (
              <motion.div
                className="process-step"
                key={step.title}
                initial={{ opacity: 0, x: -15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="step-number">0{i + 1}</div>
                <div className="step-icon">{step.icon}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <span className="eyebrow">YOUR NEXT IDEA IS ALREADY CONNECTED.</span>
          <h2>Go find it.</h2>
          <Link className="button button-primary" to="/auth?mode=register">
            Create your knowledge space <ArrowRight size={18} />
          </Link>
          <p>Start with your own sources. Build from there.</p>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>Intelligence begins with a connection.</span>
        <a href="#main">
          Back to the beginning <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
