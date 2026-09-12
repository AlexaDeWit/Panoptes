# Render themes and embedded registers

Change one severity colour with a separate YAML file:

```yaml
# theme.yaml
severity:
  high: '#b45309'
```

```sh
saer render model.yaml --format pdf --out model.pdf --theme theme.yaml
saer render model.yaml --format svg --out diagram.svg --theme theme.yaml
saer render model.yaml --format png --out diagram.png --theme theme.yaml
saer render model.yaml --format md --out register.md --styled --theme theme.yaml
```

The same theme controls diagram colours, the PNG background, and register badges.
PDF applies it to both the register and every embedded drawing.
Defaults come from the canvas light palette. Every badge keeps a readable label.
Diagram badges retain their threat count and severity letter.
Status colours apply to register labels. Diagram badges summarize open threats by severity.

## Partial overrides

Omit any section or key to keep its default. No schema version is required.
An empty file or a file containing only comments uses the defaults.
Valid entries apply independently, including siblings inside the same section.
Unknown keys, invalid values, and malformed sections produce warnings naming the
file and key. Those entries keep their defaults.
An unreadable file, broken YAML, or a document that is not a mapping uses all defaults.

Warnings go to standard error. They do not change the successful render's exit code
or enter the document written to standard output with `--out -`.
Theme parsing uses the model reader's size, nesting, and YAML alias limits.
The theme accepts data only. It cannot load fonts, execute code, or contain CSS or Typst source.

| Section    | Keys                                                                                           | Values                                         |
| ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `severity` | `critical`, `high`, `medium`, `low`, `undecided`                                               | Quoted `#RGB` or `#RRGGBB` colours             |
| `status`   | `open`, `mitigated`, `transferred`, `avoided`, `accepted-risk`, `eliminated`, `not-applicable` | Quoted `#RGB` or `#RRGGBB` colours             |
| `colours`  | `background`, `text`, `muted`, `element`, `actor`, `process`                                   | Quoted `#RGB` or `#RRGGBB` colours             |
| `fonts`    | `body`, `code`                                                                                 | A single font family name, up to 80 characters |
| `badges`   | `style`                                                                                        | `filled` or `outline`                          |
| `badges`   | `text`                                                                                         | `auto` or a quoted colour                      |
| `badges`   | `borderWidth`                                                                                  | A number from 0 to 3                           |

`background` and `text` apply to drawings and register pages. `muted`, `element`,
`actor`, and `process` name diagram roles. Website CSS exposes all these colours.
`body` selects register and diagram lettering. `code` selects register code text.
Font names contain letters, digits, spaces, periods, underscores, or hyphens.

Filled badges use their semantic colour as the background. Outlined badges use
that colour as the border and leave the background visible. `text: auto` uses
light lettering on filled badges and the semantic colour on outlined badges.
A text colour overrides that choice. `borderWidth` uses SVG units, CSS pixels,
or Typst points. Diagram badges keep their existing circular geometry.
Default badge lettering meets a 4.5:1 contrast ratio. Custom colours are the
consumer's choice and can reduce contrast.

```yaml
# A consumer can change appearance without changing the model or generated prose.
fonts:
  body: Liberation Mono
badges:
  style: outline
  borderWidth: 1
status:
  accepted-risk: '#795900'
```

The CLI bundles Liberation Sans and Liberation Mono. PDF and PNG substitute the
corresponding default for any other requested family and report the substitution.
SVG and website output name the requested family. Their viewer must supply it.
Font overrides do not change the model's diagram geometry. Long labels still wrap
using the canvas's width estimate, so inspect drawings after changing the family.
A renderer API caller supplies any extra font bytes to its compiler or rasterizer.

## Portable Markdown and website styling

Portable Markdown is the default. It keeps severity and status as text and retains
number-based navigation. A theme request with portable Markdown produces a warning
because the output cannot apply appearance settings.

GitHub's Markdown viewer strips CSS classes and appearance rules. Custom badge
colours are therefore unavailable there. GitHub Pages can host a Zola site whose
own CSS styles the generated register.
See [GitHub's Markdown rendering pipeline](https://github.com/github/markup#github-markup).

`--styled` adds semantic spans and a `saer-register` wrapper. It includes the light
stylesheet, with theme overrides applied. Every selector stays inside that wrapper.
No generated element has inline appearance rules. Defaults use zero specificity
so the host can override them without controlling stylesheet order.

Use `--styled --no-stylesheet` when the site supplies its own CSS. A theme file in
this mode produces a warning because the omitted stylesheet would carry its values.
The renderer API also exports `registerStylesheet(theme)` for a separate CSS file.
A consumer can load that file before its own overrides, or replace it completely.

Stable classes are `saer-register`, `saer-badge`, and `saer-badge-label`.
Severity badges also carry `saer-severity` and `saer-severity-<value>`.
Status badges carry `saer-status` and `saer-status-<value>`.
The values are the YAML keys above, including `accepted-risk` and `undecided`.
Labels remain readable if the site removes every stylesheet.

The stylesheet supports these CSS variables within `.saer-register`.
Unspecified badge fill and lettering values fall back to the current semantic tone:

| Variables                                                                                              | Purpose                             |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `--saer-severity-<value>`, `--saer-status-<value>`                                                     | Semantic colours                    |
| `--saer-background`, `--saer-text`, `--saer-muted`, `--saer-element`, `--saer-actor`, `--saer-process` | Colour roles                        |
| `--saer-font-body`, `--saer-font-code`                                                                 | Font families                       |
| `--saer-tone`                                                                                          | The current badge's semantic colour |
| `--saer-badge-text`, `--saer-badge-colour`                                                             | Lettering colours                   |
| `--saer-badge-background`, `--saer-badge-border-width`                                                 | Fill and border                     |
| `--saer-badge-radius`, `--saer-badge-padding`                                                          | Website badge geometry              |

For example, a site's CSS can set `.saer-register { --saer-badge-radius: 0; }`
in its stylesheet. Default selectors use `:where()` with zero specificity, so
consumer class selectors win regardless of stylesheet order.

## Embed below an existing heading

```sh
saer render model.yaml --format md --out register.md --no-title --heading-level 3
```

Include that file beneath an existing H2 section. Threat headings start at H3,
with no generated document title. Add `--styled` for website badges.

`--heading-level` takes 1 to 6 and names the first included generated heading.
With the title included, it sets the title's level and threat headings start one
level lower. With `--no-title`, it sets the threat headings directly.
Defaults remain an H1 title and H2 threats. Prose headings shift below their threat
heading by their original depth. Levels beyond H6 clamp to H6, flattening the
remaining hierarchy while keeping every heading's text.

Title omission and heading levels never change `threat-<number>` anchors or overview
links. These controls apply to both Markdown modes. Other output formats ignore
Markdown embedding options and report that limitation.

## Zola inclusion

Save the generated register outside `content/`, for example at
`generated/threat-register.md`. Create `templates/shortcodes/threat_register.html`:

```html
{{ load_data(path="generated/threat-register.md", format="plain") | markdown |
safe }}
```

Include it below the existing heading in page Markdown:

```markdown
## Threats

{{ threat_register() }}
```

This path builds with Zola 0.22.1's default link checker and retains semantic
classes, heading levels, and named anchors. Direct inclusion in an ordinary page
also works. Direct inclusion in the root section, `content/_index.md`, makes
Zola's source-anchor checker report a missing named anchor. Use the shortcode
for that root-section case. Zola does not index links produced by the template's
Markdown filter, so check the rendered links when changing the integration.

## Renderer API

`readThemeOverrides(value)` returns `{ theme, diagnostics }` from a parsed mapping.
`defaultRenderTheme` contains every resolved default. The CLI reads YAML with the
bounded `parseYaml` function from `@saerskriven/formats` before resolving overrides.

Pass the resolved theme to `renderSvg(diagram, model, theme)`,
`renderTypst(model, theme)`, or `renderPng(diagram, model, { assets, theme })`.
Use `renderRegister(model, { theme, styled: true, title: false, headingLevel: 3 })`
for an embedded website register. Set `stylesheet: false` to use the site's CSS.
The CLI uses `withBundledFonts(theme)` before PDF and PNG rendering.
API consumers can use it for the same substitution diagnostics.
