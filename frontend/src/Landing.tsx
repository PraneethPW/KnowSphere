import { lazy, Suspense, useRef } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import VisualBoundary from "./components/VisualBoundary";

import { BookOpen, FileText, GitBranch, Search, Sparkles } from "lucide-react";
import { Logo } from "./components/UI";

const Orb = lazy(() => import("./components/Orb"));

export default function Landing() {
  const hero = useRef<HTMLElement>(null);
  const artwork = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(artwork, { margin: "100px" });
  const { scrollYProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const drift = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const turn = useTransform(scrollYProgress, [0, 1], [0, 12]);
  return (
    <div className="product-landing">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="public-header">
        <Link to="/" aria-label="KnowSphere home">
          <Logo />
        </Link>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <Link to="/auth">Sign in</Link>
          <Link className="button button-primary" to="/auth?mode=register">
            Get started
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="product-hero" ref={hero}>
          <motion.div
            className="hero-copy"
            initial={reduced ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="product-label">
              <Sparkles size={16} /> Your documents, connected
            </span>
            <h1>
              Find the answer.
              <br />
              <em>Keep the evidence.</em>
            </h1>
            <p>
              Upload your documents, find relevant passages with ML, and ask AI
              questions with links back to your sources.
            </p>
            <div className="product-actions">
              <Link className="button button-primary" to="/auth?mode=register">
                Create your workspace
              </Link>
              <Link className="button button-secondary" to="/auth">
                Sign in
              </Link>
            </div>
            <span className="product-note">
              PDF, TXT, Markdown and CSV · Private workspaces
            </span>
          </motion.div>
          <motion.div
            className="hero-artwork"
            ref={artwork}
            style={reduced ? undefined : { y: drift, rotate: turn }}
            aria-hidden="true"
          >
            <div className="orbital-halo" />
            <div className="orbital-geometry">
              <i />
              <i />
              <i />
              <span />
            </div>
            {inView && reduced === false && (
              <VisualBoundary decorative fallback={<span />}>
                <Suspense fallback={<span />}>
                  <Orb />
                </Suspense>
              </VisualBoundary>
            )}
          </motion.div>
          <a className="explore-cue" href="#features">
            Explore the features <span aria-hidden="true">↓</span>
          </a>
        </section>
        <section
          id="features"
          className="product-features"
          aria-label="What you can do"
        >
          {[
            {
              icon: FileText,
              title: "Add your sources",
              text: "Upload a file or paste text. Follow processing as your documents become searchable.",
            },
            {
              icon: Search,
              title: "Search with ML",
              text: "MiniLM ranks matching passages by relevance, keeping the original source text attached.",
            },
            {
              icon: BookOpen,
              title: "Ask AI, check the sources",
              text: "Get streamed answers with citations. Open the original passage to review the evidence.",
            },
            {
              icon: GitBranch,
              title: "Explore connections",
              text: "Discover extracted entities and relationships in a graph, with supporting quotes.",
            },
          ].map(({ icon: Icon, title, text }, index) => (
            <motion.article
              key={title}
              initial={reduced ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={
                reduced
                  ? undefined
                  : { y: -5, transition: { duration: 0.2, delay: 0 } }
              }
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.55, delay: index * 0.08 }}
            >
              <Icon size={23} />
              <h2>{title}</h2>
              <p>{text}</p>
            </motion.article>
          ))}
        </section>
        <motion.section
          className="product-start"
          initial={reduced ? false : { opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <h2>From documents to understanding.</h2>
            <p>
              Create an account, add a source, then search or ask a question.
            </p>
          </div>
          <Link className="button button-primary" to="/auth?mode=register">
            Get started
          </Link>
        </motion.section>
      </main>
      <footer className="public-footer">
        <Logo />
        <p>AI can make mistakes. Check the original sources.</p>
      </footer>
    </div>
  );
}
