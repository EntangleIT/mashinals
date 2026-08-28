import type { MashinalRecord } from '@mashinals/shared';
import { PixelSprite } from '../pixel/PixelSprite';

interface Props {
  record: MashinalRecord;
  selected?: boolean;
  size?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export function CharacterTile({ record, selected, size = 72, onClick, onDoubleClick }: Props) {
  return (
    <button
      type="button"
      className={`char-tile${selected ? ' selected' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="pixel-frame" style={{ padding: 4 }}>
        <PixelSprite spec={record.spec} size={size} title={record.name} />
      </div>
      <div className="name">{record.name}</div>
      <div className="gen">gen {record.generation}</div>
      {(record.origin || record.demoOrigin) && (
        <div style={{ marginTop: 4 }}>
          <span className={`badge${record.demoOrigin && !record.origin ? ' demo' : ''}`}>
            {record.origin ? '1SAT' : 'DEMO'}
          </span>
        </div>
      )}
    </button>
  );
}
