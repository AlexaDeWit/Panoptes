import { modelMetadataSchema } from '@panoptes/model';
import styles from './canvas.module.css';

const placeholderMetadata = modelMetadataSchema.parse({
  title: 'model',
  owner: '',
  description: '',
  contributors: [],
});

/**
 * Placeholder canvas that reaches the model layer until its own slice lands.
 * data-testid anchors the e2e smoke spec: the CSS module class name is
 * hashed, so it cannot anchor a selector.
 */
export function PanoptesCanvas() {
  return (
    <div className={styles['container']} data-testid="canvas-container">
      {placeholderMetadata.title}
    </div>
  );
}
