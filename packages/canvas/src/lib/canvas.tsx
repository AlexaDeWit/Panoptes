import { modelMetadataSchema } from '@panoptes/model';
import styles from './canvas.module.css';

// Placeholder wiring probe: parses through the model layer so the workspace
// dependency is exercised. Replaced when this package gets its own slice.
export function PanoptesCanvas() {
  const metadata = modelMetadataSchema.parse({
    title: 'model',
    owner: '',
    description: '',
  });
  // data-testid is the stable hook for the e2e smoke spec: the CSS module
  // class name is hashed, so it cannot anchor a selector.
  return (
    <div className={styles['container']} data-testid="canvas-container">
      {metadata.title}
    </div>
  );
}
