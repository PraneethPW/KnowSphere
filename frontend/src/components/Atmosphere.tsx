import { motion, useReducedMotion, useScroll } from "framer-motion";

/** Decorative layers have no interaction and never obscure application content. */
export default function Atmosphere() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  return (
    <>
      <div className="immersive-atmosphere" aria-hidden="true">
        <div className="atmosphere-grid" />
        <div className="atmosphere-light light-cyan" />
        <div className="atmosphere-light light-orange" />
      </div>
      {reduced === false && (
        <motion.div
          className="scroll-progress"
          style={{ scaleX: scrollYProgress }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
