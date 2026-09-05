import type { Model } from '@panoptes/model';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { registerDocument } from './register-tree.js';

const markdown = unified().use(remarkStringify, { bullet: '-' }).use(remarkGfm);

/**
 * The threat register of a model as GFM markdown. What the register holds,
 * and in what order, is {@link registerDocument}'s; this function decides
 * only how that tree is written as markdown.
 *
 * The tree is serialized by remark, never concatenated, so every value that
 * reaches the output is a text node the serializer escapes: a title carrying
 * a pipe, a backtick, or a leading hash lands in the table and the heading as
 * that text and nothing else. Raw HTML in prose passes through as written,
 * because in markdown it is markup the author chose and what to do about it
 * belongs to whatever consumes the register.
 */
export function renderRegister(model: Model): string {
  return markdown.stringify(registerDocument(model));
}
