import { model } from '@panoptes/model';
import styles from './canvas.module.css';

export function PanoptesCanvas() {
  return <div className={styles['container']}>{model()}</div>;
}

export default PanoptesCanvas;
