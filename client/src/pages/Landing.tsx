import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PixelSprite } from '../pixel/PixelSprite';
import { STARTERS } from '@mashinals/shared';

export function LandingPage() {
  const showcase = STARTERS.slice(0, 4);

  return (
    <section className="landing-hero">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <p className="badge" style={{ marginBottom: '1rem' }}>
          BSV · 1SATORDINALS · NO X API
        </p>
        <h1>
          MASHINALS
        </h1>
        <p>
          Mash two pixel characters. Get a new viral creature. Inscribe the discovery as a Bitcoin
          SV 1SatOrdinal — the inscription <em>is</em> the post. Remix on-chain lineage forever.
        </p>
        <div className="cta-row" style={{ marginTop: '1.25rem' }}>
          <Link to="/play" className="btn" style={{ textDecoration: 'none' }}>
            Enter the board
          </Link>
          <Link to="/feed" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            Peek the feed
          </Link>
        </div>
      </motion.div>

      <motion.div
        className="grid-chars"
        style={{ maxWidth: 520 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {showcase.map((s, i) => (
          <motion.div
            key={s.id}
            className="pixel-frame"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: [0, -6, 0], opacity: 1 }}
            transition={{ delay: 0.15 * i, duration: 2.4, repeat: Infinity, repeatDelay: 0.6 }}
          >
            <PixelSprite spec={s.spec} size={96} title={s.name} />
          </motion.div>
        ))}
      </motion.div>

      <div className="steps">
        <div className="step">
          <strong>1 · MASH</strong>
          Drop two discoveries into the combine slots. Same parents always make the same child.
        </div>
        <div className="step">
          <strong>2 · REMIX</strong>
          Keep mashing deeper generations. Genes mix hair, eyes, clothes, accessories, palettes.
        </div>
        <div className="step">
          <strong>3 · INSCRIBE</strong>
          Mint the 32×32 PNG as a 1SatOrdinal with parent lineage metadata. Play without a wallet;
          Inscribe when ready.
        </div>
      </div>
    </section>
  );
}
