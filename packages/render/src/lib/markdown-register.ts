import type { Model } from '@saerskriven/model';
import type { Html } from 'mdast';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { MarkdownOptions } from './register-options.js';
import {
  registerClassNames,
  registerStylesheet,
} from './register-stylesheet.js';
import { registerDocument } from './register-tree.js';

const markdown = unified().use(remarkStringify, { bullet: '-' }).use(remarkGfm);

/** Serializes the shared register as portable or HTML-enriched Markdown. */
export function renderRegister(
  model: Model,
  options: MarkdownOptions = {},
): string {
  const tree = registerDocument(model, options);
  if (options.styled === true) {
    visit(tree, 'text', (node, index, parent) => {
      const badge = node.data?.registerBadge;
      if (badge === undefined || parent === undefined || index === undefined)
        return;
      const replacement: Html = {
        type: 'html',
        value: renderToStaticMarkup(
          createElement(
            'span',
            {
              className: `${registerClassNames.badge} saer-${badge.kind} saer-${badge.kind}-${badge.value}`,
            },
            createElement(
              'span',
              { className: registerClassNames.label },
              node.value,
            ),
          ),
        ),
      };
      parent.children.splice(index, 1, replacement);
    });
    tree.children.unshift({
      type: 'html',
      value: `<div class="${registerClassNames.root}">`,
    });
    tree.children.push({ type: 'html', value: '</div>' });
    if (options.stylesheet !== false)
      tree.children.unshift({
        type: 'html',
        value: `<style>\n${registerStylesheet(options.theme)}</style>`,
      });
  }
  return markdown.stringify(tree);
}
