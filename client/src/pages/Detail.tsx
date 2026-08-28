import { Link, useParams } from 'react-router-dom';
import { useMashStore } from '../store';
import { InscribePanel } from '../components/InscribePanel';
import { PixelSprite } from '../pixel/PixelSprite';
import { capturePreviewPng } from '../pixel/render';
import { genesSummary } from '../lib/inscription';
import { useMemo } from 'react';

export function DetailPage() {
  const { id } = useParams();
  const discovered = useMashStore((s) => s.discovered);
  const record = id ? discovered[id] : undefined;

  const shareUrl = useMemo(() => {
    if (!record) return null;
    try {
      return capturePreviewPng(record.spec, 6);
    } catch {
      return null;
    }
  }, [record]);

  if (!record) {
    return (
      <div>
        <h1>Missing Mashinal</h1>
        <p className="muted">This character isn’t in your local discoveries.</p>
        <Link to="/play" className="btn" style={{ textDecoration: 'none' }}>
          Back to board
        </Link>
      </div>
    );
  }

  const parentA = record.parentAId ? discovered[record.parentAId] : null;
  const parentB = record.parentBId ? discovered[record.parentBId] : null;

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        <Link to="/gallery">Gallery</Link> / {record.name}
      </p>
      <div className="detail-layout">
        <div className="pixel-frame" style={{ alignSelf: 'start' }}>
          <PixelSprite spec={record.spec} size={192} title={record.name} />
        </div>
        <div>
          <h1 style={{ marginTop: 0 }}>{record.name}</h1>
          <p style={{ fontSize: '1.1rem' }}>{record.caption}</p>
          <p className="lineage">
            {record.parentAName && record.parentBName
              ? `${record.parentAName} + ${record.parentBName} = ${record.name}`
              : 'Primordial starter'}
          </p>
          <p className="muted">
            Generation {record.generation} · genes {genesSummary(record)}
          </p>
          {(record.origin || record.demoOrigin) && (
            <p>
              <span className={`badge${record.demoOrigin && !record.origin ? ' demo' : ''}`}>
                {record.origin ? 'ON-CHAIN' : 'DEMO ONLY — NOT ON-CHAIN'}
              </span>
              <br />
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {record.origin ?? record.demoOrigin}
              </span>
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', margin: '1rem 0', flexWrap: 'wrap' }}>
            {parentA && (
              <Link to={`/c/${parentA.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="pixel-frame">
                  <PixelSprite spec={parentA.spec} size={64} />
                </div>
                <div className="muted" style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                  {parentA.name}
                </div>
              </Link>
            )}
            {parentB && (
              <Link to={`/c/${parentB.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="pixel-frame">
                  <PixelSprite spec={parentB.spec} size={64} />
                </div>
                <div className="muted" style={{ textAlign: 'center', fontSize: '0.8rem' }}>
                  {parentB.name}
                </div>
              </Link>
            )}
          </div>

          <InscribePanel record={record} />

          {shareUrl && (
            <div className="panel" style={{ marginTop: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Share card</h3>
              <img
                src={shareUrl}
                alt={`${record.name} share preview`}
                width={192}
                height={192}
                style={{ imageRendering: 'pixelated', border: '3px solid #fff' }}
              />
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                {record.name} — {record.caption}
                {record.parentAName && record.parentBName
                  ? ` · ${record.parentAName} + ${record.parentBName}`
                  : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
