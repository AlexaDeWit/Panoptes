#set document(title: "Écluse", date: none)
#set page(paper: "a4", margin: 2cm, numbering: "1")
#set text(font: "Liberation Sans", size: 10pt)
#show raw: set text(font: "Liberation Mono", size: 9pt)
#set table(inset: 5pt)
#show table: set text(size: 8pt)

#page(flipped: true)[
#grid(rows: (auto, 1fr), row-gutter: 1em,
heading(level: 1)[#"High Level"],
align(center + horizon)[
#image(bytes("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-98 2 1798 1236\" width=\"1798\" height=\"1236\"><title>High Level</title><style>.pn-element {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}
.pn-shape {
  fill: #ffffff;
  stroke: #1f2937;
  stroke-width: 1.5;
}
.pn-actor {
  fill: #eef2ff;
}
.pn-process {
  fill: #f0fdf4;
}
.pn-store {
  fill: none;
  stroke-width: 2;
}
.pn-boundary-box,
.pn-boundary-curve {
  fill: none;
  stroke: #6b7280;
  stroke-width: 2;
  stroke-dasharray: 8 6;
}
.pn-out-of-scope {
  opacity: 0.5;
}
.pn-out-of-scope .pn-shape {
  stroke-dasharray: 6 4;
}
.pn-label {
  fill: #111827;
  font-size: 12px;
  font-weight: 500;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-note {
  fill: #374151;
  font-size: 12px;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-flow {
  fill: none;
}
.pn-flow-arrow {
  fill: #1f2937;
  stroke: none;
}
.pn-flow-label {
  fill: #374151;
  font-size: 11px;
  text-anchor: middle;
  dominant-baseline: central;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 3;
  stroke-linejoin: round;
}
.pn-badge {
  stroke: #ffffff;
  stroke-width: 1.5;
}
.pn-badge-count {
  fill: #ffffff;
  stroke: none;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-badge-primary .pn-badge-count {
  font-size: 11px;
}
.pn-badge-secondary .pn-badge-count {
  font-size: 9px;
}
.pn-badge-mark {
  fill: #ffffff;
  stroke: none;
  font-size: 9px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}
.pn-tone-critical {
  fill: #7f1d1d;
}
.pn-tone-high {
  fill: #b91c1c;
}
.pn-tone-medium {
  fill: #b45309;
}
.pn-tone-low {
  fill: #1d4ed8;
}
.pn-tone-neutral {
  fill: #52525b;
}
</style><g transform=\"translate(240, 10)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-boundary-box\" width=\"1180\" height=\"1180\"></rect><text class=\"pn-label\" x=\"590\" y=\"12\"><tspan x=\"590\" dy=\"0\">Operator trust zone (VPC / mesh): access edge enforced here</tspan></text></g></g><g transform=\"translate(-90, 640)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-boundary-box\" width=\"240\" height=\"200\"></rect><text class=\"pn-label\" x=\"120\" y=\"12\"><tspan x=\"120\" dy=\"0\">Public internet (untrusted)</tspan></text></g></g><g transform=\"translate(1452, 755)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-boundary-box\" width=\"240\" height=\"200\"></rect><text class=\"pn-label\" x=\"120\" y=\"12\"><tspan x=\"120\" dy=\"0\">Public internet (untrusted)</tspan></text></g></g><g transform=\"translate(10, 350)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-actor\" width=\"170\" height=\"90\"></rect><text class=\"pn-label\" x=\"85\" y=\"37.5\"><tspan x=\"85\" dy=\"0\">npm client</tspan><tspan x=\"85\" dy=\"15\">(developer / CI)</tspan></text></g></g><g transform=\"translate(-60, 695)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-actor\" width=\"180\" height=\"90\"></rect><text class=\"pn-label\" x=\"90\" y=\"45\"><tspan x=\"90\" dy=\"0\">Public npm registry</tspan></text></g></g><g transform=\"translate(635, 740)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-actor\" width=\"190\" height=\"90\"></rect><text class=\"pn-label\" x=\"95\" y=\"45\"><tspan x=\"95\" dy=\"0\">AWS IMDS + STS</tspan></text></g></g><g transform=\"translate(530, 475)\"><g class=\"pn-element\"><circle class=\"pn-shape pn-process\" cx=\"65\" cy=\"65\" r=\"65\"></circle><text class=\"pn-label\" x=\"65\" y=\"65\"><tspan x=\"65\" dy=\"0\">Écluse proxy</tspan></text></g></g><g transform=\"translate(350, 990)\"><g class=\"pn-element\"><circle class=\"pn-shape pn-process\" cx=\"65\" cy=\"65\" r=\"65\"></circle><text class=\"pn-label\" x=\"65\" y=\"57.5\"><tspan x=\"65\" dy=\"0\">Mirror</tspan><tspan x=\"65\" dy=\"15\">worker</tspan></text></g></g><g transform=\"translate(635, 910)\"><g class=\"pn-element\"><circle class=\"pn-shape pn-process\" cx=\"70\" cy=\"70\" r=\"70\"></circle><text class=\"pn-label\" x=\"70\" y=\"62.5\"><tspan x=\"70\" dy=\"0\">Credential</tspan><tspan x=\"70\" dy=\"15\">provider</tspan></text></g></g><g transform=\"translate(360, 110)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"180\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"90\" x2=\"180\" y2=\"90\"></line><text class=\"pn-label\" x=\"90\" y=\"37.5\"><tspan x=\"90\" dy=\"0\">Metadata cache</tspan><tspan x=\"90\" dy=\"15\">(public-gated only)</tspan></text></g></g><g transform=\"translate(325, 810)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"180\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"90\" x2=\"180\" y2=\"90\"></line><text class=\"pn-label\" x=\"90\" y=\"45\"><tspan x=\"90\" dy=\"0\">Mirror queue (SQS)</tspan></text></g></g><g transform=\"translate(910, 475)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"200\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"90\" x2=\"200\" y2=\"90\"></line><text class=\"pn-label\" x=\"100\" y=\"37.5\"><tspan x=\"100\" dy=\"0\">Registry C:</tspan><tspan x=\"100\" dy=\"15\">pull-through read endpoint</tspan></text></g></g><g transform=\"translate(1150, 140)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"200\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"90\" x2=\"200\" y2=\"90\"></line><text class=\"pn-label\" x=\"100\" y=\"37.5\"><tspan x=\"100\" dy=\"0\">Registry A:</tspan><tspan x=\"100\" dy=\"15\">private store (first-party)</tspan></text></g></g><g transform=\"translate(1190, 665)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"200\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"90\" x2=\"200\" y2=\"90\"></line><text class=\"pn-label\" x=\"100\" y=\"30\"><tspan x=\"100\" dy=\"0\">Registry B:</tspan><tspan x=\"100\" dy=\"15\">mirror store</tspan><tspan x=\"100\" dy=\"15\">(public-derived)</tspan></text><g class=\"pn-badge\" transform=\"translate(200, 0)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-medium\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"6\">M</text></g></g></g></g><g transform=\"translate(920, 915)\"><g class=\"pn-element\"><circle class=\"pn-shape pn-process\" cx=\"65\" cy=\"65\" r=\"65\"></circle><text class=\"pn-label\" x=\"65\" y=\"50\"><tspan x=\"65\" dy=\"0\">Écluse Pilot</tspan><tspan x=\"65\" dy=\"15\">(Ingestion</tspan><tspan x=\"65\" dy=\"15\">Pipeline)</tspan></text></g></g><g transform=\"translate(1477, 810)\"><g class=\"pn-element\"><rect class=\"pn-shape pn-actor\" width=\"170\" height=\"110\"></rect><text class=\"pn-label\" x=\"85\" y=\"55\"><tspan x=\"85\" dy=\"0\">OSV.dev</tspan></text></g></g><g transform=\"translate(920, 640)\"><g class=\"pn-element\"><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"0\" x2=\"180\" y2=\"0\"></line><line class=\"pn-shape pn-store\" x1=\"0\" y1=\"130\" x2=\"180\" y2=\"130\"></line><text class=\"pn-label\" x=\"90\" y=\"65\"><tspan x=\"90\" dy=\"0\">S3 (OSV Datasets)</tspan></text></g></g><g transform=\"translate(400, 1100)\"><g class=\"pn-element\"><circle class=\"pn-shape pn-process\" cx=\"65\" cy=\"65\" r=\"65\"></circle><text class=\"pn-label\" x=\"65\" y=\"57.5\"><tspan x=\"65\" dy=\"0\">Écluse</tspan><tspan x=\"65\" dy=\"15\">Dredger</tspan></text><g class=\"pn-badge\" transform=\"translate(130, 0)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-critical\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">5</text><text class=\"pn-badge-mark\" y=\"6\">C</text></g></g></g></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 180 395 L 530 540\"></path><path class=\"pn-flow-arrow\" d=\"M 530 540 L 517 540.026 L 520.827 530.788 Z\"></path><text class=\"pn-flow-label\" x=\"334.415\" y=\"503.437\"><tspan x=\"334.415\" dy=\"0\">npm read / publish</tspan><tspan x=\"334.415\" dy=\"13.75\">(passthrough</tspan><tspan x=\"334.415\" dy=\"13.75\">CodeArtifact token)</tspan></text><g class=\"pn-badge\" transform=\"translate(366.859, 438.874)\"><g class=\"pn-badge-primary\"><circle class=\"pn-tone-medium\" r=\"13\"></circle><text class=\"pn-badge-count\" y=\"-3\">1</text><text class=\"pn-badge-mark\" y=\"6\">M</text></g></g></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 660 540 L 910 520\"></path><path class=\"pn-flow-arrow\" d=\"M 910 520 L 898.437 525.941 L 897.639 515.973 Z\"></path><text class=\"pn-flow-label\" x=\"844.449\" y=\"473.117\"><tspan x=\"844.449\" dy=\"0\">read packument /</tspan><tspan x=\"844.449\" dy=\"13.75\">tarball (caller token</tspan><tspan x=\"844.449\" dy=\"13.75\">forwarded)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 595 475 L 450 200\"></path><path class=\"pn-flow-arrow\" d=\"M 450 200 L 460.02 208.283 L 451.174 212.947 Z\"></path><text class=\"pn-flow-label\" x=\"462.405\" y=\"362.311\"><tspan x=\"462.405\" dy=\"0\">cache public-gated</tspan><tspan x=\"462.405\" dy=\"13.75\">metadata</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 530 540 L 120 740\"></path><path class=\"pn-flow-arrow\" d=\"M 120 740 L 128.593 730.245 L 132.977 739.233 Z\"></path><text class=\"pn-flow-label\" x=\"350.934\" y=\"679.414\"><tspan x=\"350.934\" dy=\"0\">anonymous packument /</tspan><tspan x=\"350.934\" dy=\"13.75\">tarball fetch (caller</tspan><tspan x=\"350.934\" dy=\"13.75\">token stripped)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 660 540 L 1150 185\"></path><path class=\"pn-flow-arrow\" d=\"M 1150 185 L 1143.216 196.089 L 1137.349 187.991 Z\"></path><text class=\"pn-flow-label\" x=\"940.061\" y=\"397.144\"><tspan x=\"940.061\" dy=\"0\">relay npm publish</tspan><tspan x=\"940.061\" dy=\"13.75\">(publisher token</tspan><tspan x=\"940.061\" dy=\"13.75\">forwarded)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 595 605 L 415 810\"></path><path class=\"pn-flow-arrow\" d=\"M 415 810 L 419.16 797.684 L 426.675 804.282 Z\"></path><text class=\"pn-flow-label\" x=\"552.402\" y=\"742.246\"><tspan x=\"552.402\" dy=\"0\">enqueue mirror job</tspan><tspan x=\"552.402\" dy=\"13.75\">(demand-driven)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 415 990 L 415 900\"></path><path class=\"pn-flow-arrow\" d=\"M 415 900 L 420 912 L 410 912 Z\"></path><text class=\"pn-flow-label\" x=\"456.225\" y=\"945\"><tspan x=\"456.225\" dy=\"0\">poll jobs</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 350 1055 L 120 740\"></path><path class=\"pn-flow-arrow\" d=\"M 120 740 L 131.114 746.743 L 123.038 752.64 Z\"></path><text class=\"pn-flow-label\" x=\"182.284\" y=\"929.116\"><tspan x=\"182.284\" dy=\"0\">back-fill artifact</tspan><tspan x=\"182.284\" dy=\"13.75\">fetch (untrusted)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 480 1055 L 635 980\"></path><path class=\"pn-flow-arrow\" d=\"M 635 980 L 626.376 989.728 L 622.02 980.726 Z\"></path><text class=\"pn-flow-label\" x=\"535.073\" y=\"964.275\"><tspan x=\"535.073\" dy=\"0\">request mirror-write</tspan><tspan x=\"535.073\" dy=\"13.75\">token</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 705 910 L 730 830\"></path><path class=\"pn-flow-arrow\" d=\"M 730 830 L 731.193 842.945 L 721.648 839.962 Z\"></path><text class=\"pn-flow-label\" x=\"797.771\" y=\"888.21\"><tspan x=\"797.771\" dy=\"0\">mint via container role</tspan><tspan x=\"797.771\" dy=\"13.75\">(IMDSv2 / STS)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 480 1055 L 1180 1065 L 1290 755\"></path><path class=\"pn-flow-arrow\" d=\"M 1290 755 L 1290.699 767.981 L 1281.275 764.637 Z\"></path><text class=\"pn-flow-label\" x=\"829.511\" y=\"1080.445\"><tspan x=\"829.511\" dy=\"0\">publish mirrored</tspan><tspan x=\"829.511\" dy=\"13.75\">artifact (minted write</tspan><tspan x=\"829.511\" dy=\"13.75\">token)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 1110 520 L 1150 185\"></path><path class=\"pn-flow-arrow\" d=\"M 1150 185 L 1153.542 197.508 L 1143.613 196.323 Z\"></path><text class=\"pn-flow-label\" x=\"1184.13\" y=\"352.088\"><tspan x=\"1184.13\" dy=\"0\">pull-through</tspan><tspan x=\"1184.13\" dy=\"13.75\">(first-party)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 1110 520 L 1190 710\"></path><path class=\"pn-flow-arrow\" d=\"M 1190 710 L 1180.735 700.881 L 1189.951 697 Z\"></path><text class=\"pn-flow-label\" x=\"1223.968\" y=\"583.856\"><tspan x=\"1223.968\" dy=\"0\">pull-through (mirrored)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 825 785 L 920 980\"></path><path class=\"pn-flow-arrow\" d=\"M 920 980 L 910.249 971.402 L 919.239 967.022 Z\"></path><text class=\"pn-flow-label\" x=\"917.548\" y=\"793.358\"><tspan x=\"917.548\" dy=\"0\">mint token (container</tspan><tspan x=\"917.548\" dy=\"13.75\">role)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 1480 860 L 1050 980\"></path><path class=\"pn-flow-arrow\" d=\"M 1050 980 L 1060.214 971.958 L 1062.902 981.59 Z\"></path><text class=\"pn-flow-label\" x=\"1280.102\" y=\"967.239\"><tspan x=\"1280.102\" dy=\"0\">OSV Dataset for</tspan><tspan x=\"1280.102\" dy=\"13.75\">Supported Registries</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 985 915 L 1010 770\"></path><path class=\"pn-flow-arrow\" d=\"M 1010 770 L 1012.888 782.675 L 1003.034 780.976 Z\"></path><text class=\"pn-flow-label\" x=\"1070.971\" y=\"855.167\"><tspan x=\"1070.971\" dy=\"0\">Push osv.db (SQLite)</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 920 705 L 660 540\"></path><path class=\"pn-flow-arrow\" d=\"M 660 540 L 672.811 542.208 L 667.453 550.652 Z\"></path><text class=\"pn-flow-label\" x=\"813.017\" y=\"586.23\"><tspan x=\"813.017\" dy=\"0\">Download osv.db</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 530 1165 L 1190 710\"></path><path class=\"pn-flow-arrow\" d=\"M 1190 710 L 1182.958 720.928 L 1177.282 712.694 Z\"></path><text class=\"pn-flow-label\" x=\"1064.902\" y=\"881.63\"><tspan x=\"1064.902\" dy=\"0\">delete pruned versions</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 920 980 L 825 785\"></path><path class=\"pn-flow-arrow\" d=\"M 825 785 L 834.751 793.598 L 825.761 797.978 Z\"></path><text class=\"pn-flow-label\" x=\"797.065\" y=\"852.055\"><tspan x=\"797.065\" dy=\"0\">mint container</tspan><tspan x=\"797.065\" dy=\"13.75\">credentials</tspan></text></g><g class=\"pn-element\"><path class=\"pn-shape pn-flow\" d=\"M 660 540 L 920 705\"></path><path class=\"pn-flow-arrow\" d=\"M 920 705 L 907.189 702.792 L 912.547 694.348 Z\"></path><text class=\"pn-flow-label\" x=\"760.903\" y=\"668.35\"><tspan x=\"760.903\" dy=\"0\">poll &amp; download osv.db</tspan></text></g></svg>
"), format: "svg", fit: "contain", width: 100%, height: 100%)
],
)
]

#heading(level: 1)[#"Écluse threat register"]

#table(columns: 6,
[#"Number"], [#"Title"], [#"Elements"], [#"Category"], [#"Severity"], [#"Status"],
[#"1"], [#"Forwarded caller credentials aggregated in proxy memory"], [#"Écluse proxy"], [#"Information disclosure (STRIDE)"], [#"High"], [#"Mitigated"],
[#"2"], [#"Chokepoint exhaustion via pathological upstream payload"], [#"Écluse proxy"], [#"Denial of service (STRIDE)"], [#"Medium"], [#"Mitigated"],
[#"3"], [#"Off-by-default edge auth assumes a sound network boundary"], [#"npm read / publish (passthrough CodeArtifact token)"], [#"Spoofing (STRIDE)"], [#"Medium"], [#"Mitigated"],
[#"4"], [#"Caller credential leak to the public upstream"], [#"anonymous packument / tarball fetch (caller token stripped)"], [#"Information disclosure (STRIDE)"], [#"High"], [#"Mitigated"],
[#"5"], [#"SSRF via crafted identifier or upstream-declared dist.tarball"], [#"anonymous packument / tarball fetch (caller token stripped)"], [#"Elevation of privilege (STRIDE)"], [#"High"], [#"Mitigated"],
[#"6"], [#"Package shadowing via first-party publish"], [#"relay npm publish (publisher token forwarded)"], [#"Tampering (STRIDE)"], [#"High"], [#"Mitigated"],
[#"7"], [#"Mirror-write credential is a standing privilege over the trusted store"], [#"publish mirrored artifact (minted write token)"], [#"Elevation of privilege (STRIDE)"], [#"High"], [#"Mitigated"],
[#"8"], [#"SSRF to the instance-metadata credential endpoint"], [#"mint via container role (IMDSv2 / STS)"], [#"Elevation of privilege (STRIDE)"], [#"Medium"], [#"Mitigated"],
[#"9"], [#"Cross-client disclosure of a private package via shared cache (#115)"], [#"Metadata cache (public-gated only)"], [#"Information disclosure (STRIDE)"], [#"High"], [#"Mitigated"],
[#"10"], [#"Registry collapse erases provenance and per-store policy"], [#"Registry B: mirror store (public-derived)"], [#"Repudiation (STRIDE)"], [#"Medium"], [#"Mitigated"],
[#"11"], [#"Undetected artifact substitution across upstreams"], [#"Registry C: pull-through read endpoint"], [#"Tampering (STRIDE)"], [#"High"], [#"Mitigated"],
[#"12"], [#"Upstream registry forges its own server-asserted metadata (e.g. a backdated publish time)"], [#"Public npm registry"], [#"Tampering (STRIDE)"], [#"High"], [#"Accepted risk"],
[#"13"], [#"Malicious mirrored version persists and is served as trusted (no automatic post-ingestion revocation)"], [#"Registry B: mirror store (public-derived)"], [#"Tampering (STRIDE)"], [#"Medium"], [#"Open"],
[#"14"], [#"SSRF via the worker back-fill fetch (a blind sink)"], [#"back-fill artifact fetch (untrusted)"], [#"Elevation of privilege (STRIDE)"], [#"Low"], [#"Mitigated"],
[#"15"], [#"Private-upstream aggregation admits the public registry, bypassing the gate"], [#"Registry C: pull-through read endpoint"], [#"Tampering (STRIDE)"], [#"High"], [#"Mitigated"],
[#"16"], [#"Connect-time reachability/timing oracle for an attacker-controlled allowlisted DNS"], [#"anonymous packument / tarball fetch (caller token stripped)"], [#"Information disclosure (STRIDE)"], [#"Low"], [#"Accepted risk"],
[#"17"], [#"Pilot container-role privilege escalation"], [#"Écluse Pilot (Ingestion Pipeline)"], [#"Elevation of privilege (STRIDE)"], [#"High"], [#"Mitigated"],
[#"18"], [#"Proxy compromised via tampered OSV database"], [#"Écluse proxy"], [#"Tampering (STRIDE)"], [#"High"], [#"Mitigated"],
[#"20"], [#"Pathological OSV Payload (DoS)"], [#"Écluse Pilot (Ingestion Pipeline)"], [#"Denial of service (STRIDE)"], [#"Medium"], [#"Mitigated"],
[#"21"], [#"Massive Purge DoS"], [#"Écluse Dredger"], [#"Denial of service (STRIDE)"], [#"Medium"], [#"Open"],
[#"22"], [#"Mirror-write credential can be sent to a misconfigured registry target"], [#"publish mirrored artifact (minted write token)"], [#"Information disclosure (STRIDE)"], [#"Medium"], [#"Mitigated"],
[#"23"], [#"Package-name spoofing via invisible characters"], [#"npm read / publish (passthrough CodeArtifact token)"], [#"Spoofing (STRIDE)"], [#"Medium"], [#"Mitigated"],
[#"24"], [#"Package-name typosquatting within the permitted character set"], [#"npm read / publish (passthrough CodeArtifact token)"], [#"Spoofing (STRIDE)"], [#"Medium"], [#"Open"],
[#"25"], [#"Dredger inappropriately purges valid packages"], [#"Écluse Dredger"], [#"Denial of service (STRIDE)"], [#"Medium"], [#"Open"],
[#"26"], [#"Dredger container-role privilege escalation"], [#"Écluse Dredger"], [#"Elevation of privilege (STRIDE)"], [#"High"], [#"Open"],
[#"27"], [#"Poisoned OSV payload exploits parser"], [#"Écluse Pilot (Ingestion Pipeline)"], [#"Denial of service (STRIDE)"], [#"Medium"], [#"Mitigated"],
[#"28"], [#"First-party data loss from collapsed registries"], [#"Écluse Dredger"], [#"Denial of service (STRIDE)"], [#"High"], [#"Open"],
[#"101"], [#"Oracle Blackout / Supply Chain DoS via OSV.dev compromise"], [#"Écluse Pilot (Ingestion Pipeline)"], [#"Spoofing (STRIDE)"], [#"High"], [#"Accepted risk"],
[#"102"], [#"Accidental permanent deletion of registry data"], [#"Écluse Dredger"], [#"Elevation of privilege (STRIDE)"], [#"Critical"], [#"Open"],
)

#heading(level: 2)[#"Threat 1: Forwarded caller credentials aggregated in proxy memory"]

#list([#strong[#"Elements"]#": Écluse proxy"], [#strong[#"Category"]#": Information disclosure (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"Under the canonical passthrough strategy the proxy transiently holds every caller's own CodeArtifact bearer token in process memory while it relays reads and publishes. One proxy compromise therefore harvests the credentials of all callers in transit, not one. A heap or memory dump, a log-field leak, and a malicious dependency in Écluse's own supply chain all reach that result. Passthrough spreads credential exposure across every user. A service identity would instead concentrate it in one short-lived token."

#strong[#"Mitigation"]

#"Écluse carries a token in a redacted type, the Secret newtype, whose Show renders a fixed placeholder, so a token never reaches a log field. Retention is request-scoped, and the code unwraps a token only at the point of use, to attach the bearer to an outbound request. Neither the data-plane nor the WAI span instrumentation records an Authorization header, so a credential never reaches a span. The WAI layer does record benign request headers, such as User-Agent. A regression test holds the split. Residual: a garbage-collected runtime cannot guarantee prompt erasure from the heap. The first-class compensating control is therefore hardening Écluse's own runtime and supply chain, through the attested, reproducible image that the image vulnerability-scan gate keeps clean."

#heading(level: 2)[#"Threat 2: Chokepoint exhaustion via pathological upstream payload"]

#list([#strong[#"Elements"]#": Écluse proxy"], [#strong[#"Category"]#": Denial of service (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"Écluse is a mandatory chokepoint, so degrading its availability is itself a supply-chain attack. Builds fail, or operators are tempted to bypass the gate. A hostile or compromised upstream registry, or a pathological public package, could return an oversized, version-flooded, or deeply nested packument. Parsing it and evaluating the rules per version could then exhaust CPU or memory."

#strong[#"Mitigation"]

#"Fail-closed caps bound the input: body size, version count, and nesting depth (ECLUSE_LIMITS__MAX_RESPONSE_BYTES, ECLUSE_LIMITS__MAX_VERSION_COUNT, ECLUSE_LIMITS__MAX_NESTING_DEPTH). The bounded read stops mid-stream. The serve path is O(n log n) in version count, a Map-based merge with no super-linear blow-up. The single-flight cache coalesces concurrent misses for the same package onto one computation, and a per-request timeout caps any single request. Écluse still projects the whole document before the version cap rejects it. Failing fast at the cap is an accepted residual for v0.1.0. The advisory-backed rules compound that cost. They evaluate each version on its own, with no memoisation, and take one or two advisory lookups per version, so a near-cap document multiplies those lookups. Batching them per package is required to remove the amplification. Resident-bytes and serve-concurrency admission bounds further cap the aggregate resident cost. The residual is resource amplification, not algorithmic complexity. A near-cap document still costs real CPU and heap, and distinct-key floods bypass single-flight, worst under a hostile or compromised upstream registry. Volumetric and concurrency rate-limiting is therefore an operator-edge responsibility, as access control is."

#heading(level: 2)[#"Threat 3: Off-by-default edge auth assumes a sound network boundary"]

#list([#strong[#"Elements"]#": npm read / publish (passthrough CodeArtifact token)"], [#strong[#"Category"]#": Spoofing (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"The edge token, server.authToken (ECLUSE_SERVER__AUTH_TOKEN), is off by default. Écluse delegates 'who may reach the proxy' to the operator's access edge: a gateway, a mesh, or a network policy. If that boundary fails, an unauthenticated caller can drive the proxy. The east-west case is the notable one: a compromised neighbour reaches the pod directly and bypasses an ingress-only IP allow-list."

#strong[#"Mitigation"]

#"Compensating control: under passthrough the request carries only the caller's own forwarded token, and the read path never substitutes a standing credential. No forwarded token means no private read. A breach of the edge exposes only the public-gated view plus the untrusted-egress and denial-of-service surface, never private packages. The publish path is the one exception. A configured static publication-target credential (mounts."#"<eco>"#".publicationTargetToken) serves as the fallback for a tokenless publish, so 'no token, no publish' holds only for pure passthrough. The internal-credential publish mode is therefore fail-closed by construction. A configured publication-target token requires a verifiable inbound edge, server.authToken or stronger, so the composition root refuses internal-credential-plus-open-edge at boot. That state is unrepresentable, on the same principle the trusted-edge read identity follows. Restrict both north-south and east-west access, as the Golden Path documents. Any edge mode that substitutes Écluse's own identity, read or write, must require a verifiable edge. Use mTLS or a shared secret, never a bare spoofable header."

#heading(level: 2)[#"Threat 4: Caller credential leak to the public upstream"]

#list([#strong[#"Elements"]#": anonymous packument / tarball fetch (caller token stripped)"], [#strong[#"Category"]#": Information disclosure (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"The upstream registry is attacker-influenceable and must never receive a caller's credential. A failure to strip the caller token on the public fetch would disclose a live CodeArtifact token to public npm. So would following a cross-host 3xx with the bearer still attached, to an attacker-chosen redirect target, over the unguarded private manager."

#strong[#"Mitigation"]

#"Écluse strips the caller credential before every public fetch and queries the registry anonymously. A credential-bearing request never follows a redirect: attachCredential is the single credential-attach point, and it finalises every request it builds through finaliseRequest, which sets redirectCount=0. That matters because the http-client in use does not drop Authorization on a cross-host redirect."

#heading(level: 2)[#"Threat 5: SSRF via crafted identifier or upstream-declared dist.tarball"]

#list([#strong[#"Elements"]#": anonymous packument / tarball fetch (caller token stripped)"], [#strong[#"Category"]#": Elevation of privilege (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"Écluse builds outbound URLs from client-supplied package identifiers and upstream-declared artifact locations. A traversal, encoded-slash, or absolute-URL name could steer a fetch to an unintended target such as cloud metadata or the private network. So could a dist.tarball that points at an internal or attacker-chosen host."

#strong[#"Mitigation"]

#"Écluse canonicalises the identifier and encodes on build. It also enforces an outbound host and port allow-list, the load-bearing control, where it builds the request URL. Registry egress is https-only by construction. Every outbound registry URL goes through a typed boundary, mkRegistryUrl, which rejects any non-https scheme, and a non-https configured endpoint fails closed at boot. TLS certificate validation authenticates the dialled host. A name steered to an internal or rebound address cannot present a CA-trusted certificate for the requested host. Certificate validation therefore closes the resolve-to-internal and DNS-rebinding SSRF class, rather than a resolved-IP recheck. No data-plane request follows an upstream redirect, because finaliseRequest pins redirectCount=0 on every request attachCredential builds. No redirect hop can escape the build-time allow-list or downgrade the scheme. A disallow-by-default same-authority policy applies to dist.tarball, matched on host and port. Écluse upgrades a legacy http dist.tarball to https on the same host, and drops and records one on a foreign host. The trusted private origin meets the same https requirement. A cheap pure literal internal-range block remains as defence in depth on the dist.tarball host gate. An operator can extend that fixed range set with ECLUSE_EGRESS__ADDITIONAL_BLOCKED_RANGES for internal space the module cannot know in advance. That setting is widen-only and fails closed at boot on a malformed entry."

#heading(level: 2)[#"Threat 6: Package shadowing via first-party publish"]

#list([#strong[#"Elements"]#": relay npm publish (publisher token forwarded)"], [#strong[#"Category"]#": Tampering (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"Écluse relays a publish to the private store with the publisher's own token. The packument merge serves private versions as trusted, winning collisions over public ones. A compromised-CI or insider publisher could clear the publish-scope check, or slip past it. They could then publish a name that the merge serves as a trusted version over the public package. That is a dependency-confusion path through Écluse's own trust model."

#strong[#"Mitigation"]

#"The publicationAllow allow-list, for npm a list of scopes, refuses any name outside the operator's scopes before any upstream write. That is the anti-shadowing guard. The scope match is exact on the parsed namespace, so a prefix such as @acme-evil does not satisfy an @acme allow-list. Soundness requires the authorised identity to be the written identity. Écluse validates the publish document's own declared name and _id, and the per-version names, equal to the scope-guarded URL-path name before the relay. It then builds the write URL from that same canonical name. The guarded name, the written name, and the merge collision key are therefore one identity by construction. Residual: shadowing within an allow-listed scope, and allow-precedence choices, stay the operator's risk. Give the publisher's target credential least privilege."

#heading(level: 2)[#"Threat 7: Mirror-write credential is a standing privilege over the trusted store"]

#list([#strong[#"Elements"]#": publish mirrored artifact (minted write token)"], [#strong[#"Category"]#": Elevation of privilege (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"The mirror worker holds Écluse's only standing self-minted credential. It carries write access to the mirror store (Registry B), which feeds the trusted read path. A worker compromise, or any bypass of the admission gate, could write attacker-chosen bytes into the trusted store and poison future reads."

#strong[#"Mitigation"]

#"Containment of this standing privilege rests on least-privilege IAM on the container or task role: write to Registry B only. A CodeArtifact token bears the role's own permissions, so this is an IAM policy rather than a token-level scope. Minting from the container role beats static credentials, and the TTL is minimal, capped by CodeArtifact at 12h. The publish runs with redirectCount=0, because attachCredential attaches the mint token and finalises the request through finaliseRequest. The mirror queue sits inside the same trust boundary and is isolated and managed at the infrastructure level. A job is unauthenticated data that directs the worker to fetch and publish, so queue-send access is equivalent to trusted-write access. Scope the queue's IAM so only the serve role enqueues (SendMessage) and only the worker receives and acks. Écluse relies on access control for message authenticity, deliberately, rather than on signatures. That is the standard pattern for an internal single-producer, single-consumer queue. The worker's own attack surface is small. It hashes the fetched bytes and forwards them unchanged, with no decompression and no tarball parsing. A malicious artifact is therefore a poor code-execution vector. The dist.integrity check is anti-tamper-in-transit and anti-downgrade. It fails closed when the strongest present digest is in an uncomputable algorithm, and never downgrades to a forgeable weaker one. It proves the bytes match the upstream's asserted digest, so it catches back-fill corruption but not a hostile upstream or a worker compromise. Admission-gate soundness therefore bounds the poisoning of future reads, together with the role's blast radius and queue access control, not the integrity check. The trusted store is only as clean as what the gate admits, and only the gate may enqueue. A serve-only mount, with no mirrorTarget declared, removes this surface entirely. It holds and mints no write credential, and with zero mirrored mounts the process builds no mirror queue and starts no worker."

#heading(level: 2)[#"Threat 8: SSRF to the instance-metadata credential endpoint"]

#list([#strong[#"Elements"]#": mint via container role (IMDSv2 / STS)"], [#strong[#"Category"]#": Elevation of privilege (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"Container-role token minting must reach the instance-metadata endpoint (169.254.169.254) and STS. An SSRF that reached metadata could mint the worker's CodeArtifact credential."

#strong[#"Mitigation"]

#"Écluse follows an internal-resolving location only on the trusted private origin, never on a client-influenced or upstream-influenced target. Nothing can therefore steer the data plane at metadata. Minting uses amazonka's own client, off the guarded data-plane manager. Operator defence in depth: require IMDSv2 and set the hop limit to 1. Do not block metadata outright."

#heading(level: 2)[#"Threat 9: Cross-client disclosure of a private package via shared cache (#115)"]

#list([#strong[#"Elements"]#": Metadata cache (public-gated only)"], [#strong[#"Category"]#": Information disclosure (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"A cache key carries no credential dimension. If the cache held a private-origin document, one caller could warm an entry and a second, differently authorised caller could receive it. That second caller receives the document without the upstream ever authorising their own request."

#strong[#"Mitigation"]

#"Écluse never enters the private origin into the shared cache. Module encapsulation is the guarantee: the cache-entering client builder is unexported, and the private-origin path hard-codes an uncached fetch. The cache holds only the anonymous public-gated origin. Écluse re-consults the private origin on every request, with the caller's own forwarded token. The cache-recovering designs that would share a private entry, delegated-cache and memoised, are rejected by design. No shared private cache exists to leak."

#heading(level: 2)[#"Threat 10: Registry collapse erases provenance and per-store policy"]

#list([#strong[#"Elements"]#": Registry B: mirror store (public-derived)"], [#strong[#"Category"]#": Repudiation (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"Écluse supports collapsing its internal registry roles onto as few as one store. The recommended topology keeps the first-party store (A) and the public-derived mirror store (B) separate. It then unions them into the pull-through read endpoint (C) at the registry level. Collapsing them onto a single shared store is the degenerate floor. An undeclared mounts."#"<eco>"#".mirrorTarget makes the mount serve-only, with no mirror store at all. The fold is a mirrorTarget set equal to the private upstream, which the boot warns about and then accepts. Collapse loses the physical separation between first-party and public-derived inventory. Distinct storage-level rule sets and scanning per provenance become impossible. Collapse also muddies post-disclosure incident scoping, 'which mirrored public packages did we hold?', which weakens the arithmetic-not-forensics response."

#strong[#"Mitigation"]

#"Deploy the recommended three-registry topology, the Golden Path: a first-party store, a public-derived mirror store, and a pull-through aggregator read endpoint. The endpoint unions the other two at the registry level. Each of the three is independently governable. The single-registry collapse stays supported but discouraged. It trades auditability and defence in depth, not the perimeter. An operator who deliberately chooses a collapsed topology accepts that local residual risk against their own threat tolerance."

#heading(level: 2)[#"Threat 11: Undetected artifact substitution across upstreams"]

#list([#strong[#"Elements"]#": Registry C: pull-through read endpoint"], [#strong[#"Category"]#": Tampering (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"The merge flags an integrity divergence when the private and public copies of a version contradict on a shared digest algorithm. A weak-only or absent digest could let a substituted artifact pass undetected and reach the client as the trusted copy. So could a flaw in the divergence key."

#strong[#"Mitigation"]

#"Écluse admits a public version only if it carries a digest that meets the integrity floor: a uniform SHA-256 default, hard-floored. Divergence compares each digest's asserted algorithm, not a bucketed tag. The merge detects a real same-version contradiction on a shared algorithm, and the serve path consumes it. Écluse logs it at WARNING, naming the package, the contradicting versions, and their digests, and meters it as ecluse.registry.merge.divergence. A substitution therefore surfaces, and the merge never silently reconciles it. The trusted copy always wins the served bytes. The operator's ECLUSE_INTEGRITY__DIVERGENCE_POLICY then decides whether Écluse also withholds the contested version from the listing (fail-closed) or serves it with the alarm (warn, the default). Residual: warn detects without withholding, so an operator who wants prevention rather than detection must set fail-closed. The trusted-floor path is deliberately operator-loosenable, trading strictness for availability, and that is the remaining way a weak digest is accepted. A serve-only mount with no private upstream, the pure public gate, has a single origin, so cross-upstream divergence detection is structurally absent. That is an accepted residual of that sub-shape. A serve-only mount that reads a private upstream keeps the detection unchanged."

#heading(level: 2)[#"Threat 12: Upstream registry forges its own server-asserted metadata (e.g. a backdated publish time)"]

#list([#strong[#"Elements"]#": Public npm registry"], [#strong[#"Category"]#": Tampering (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Accepted risk"])

#strong[#"Description"]

#"Écluse's freshness quarantine and integrity reasoning consume fields the upstream registry asserts, notably the per-version publish time and server-side integrity. A registry that asserted forged values could admit content the age and integrity gates would otherwise hold back. A backdated time defeats the age quarantine, and a manufactured digest defeats the integrity check."

#strong[#"Mitigation"]

#"Risk treatment: accepted by trust assumption. The primary registries stamp these fields server-side. The publish time is not part of the publish document, so a publisher cannot forge it. Écluse reads the registry's metadata, so it necessarily extends a floor of trust to the registry operator's honesty. A hostile operator is an adversary this model cannot counter, the same class as 'what if npm itself is malicious'. What is untrusted here are the tarball contents and the author-supplied fields, and the rules engine and the integrity floor do gate those. The freshness quarantine's age signal depends on the upstream's timestamp honesty, so a registry that asserted a forged time could in theory defeat it. Écluse could re-anchor age to its own first observation of a version and remove that dependence. It deliberately does not. The central public registries, npmjs and PyPI among them, are foundational to modern software infrastructure. Trusting their server-stamped timestamps is the only practical recourse. A dependable first-observation anchor would need durable, replica-shared state, at odds with Écluse's network-broker design. It would also narrow only a surface that already sits outside the practical treatment boundary. Écluse records this as accepted residual risk rather than mitigated."

#heading(level: 2)[#"Threat 13: Malicious mirrored version persists and is served as trusted (no automatic post-ingestion revocation)"]

#list([#strong[#"Elements"]#": Registry B: mirror store (public-derived)"], [#strong[#"Category"]#": Tampering (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Open"])

#strong[#"Description"]

#"Écluse mirrors approved public versions into Registry B and, by design, resists upstream yanks so a benign yank does not break installs. The cost is that a version later found malicious persists in B and is served as trusted. The merge serves the private origin unfiltered by the rules. Nothing removes it automatically: neither an upstream yank nor a rules change reaches an already-mirrored artifact."

#strong[#"Mitigation"]

#"The freshness quarantine ("#raw("AllowIfOlderThan")#") is the primary defence. It delays serving a new version until advisories have time to surface, so the rules deny most malicious versions at admission, before any mirroring. This threat is the residual for a version found bad after it cleared the quarantine and was mirrored. Detection is delegated: operator scanning of Registry B, upstream advisories, and security-holding signals decide what to revoke. Enforcement is layered across the version's lifecycle. The hard deny-by-identity rule (DenyByIdentity) halts re-admission on the serve path and re-mirroring at the worker's ingest re-check. That is the immediate, surgical stop, and it also breaks the re-mirror treadmill. An automated reaper, the Écluse Dredger, must continually prune already-mirrored versions that match an advisory or age condition, so recovery follows a public alert without an operator step. It is required to run as a separate service that shares the core rules engine and exposes only its liveness and readiness probes. The operator can also purge a version from Registry B directly. The rules never run on trusted content, so a purge is what removes the already-mirrored copy. Order the two as deny then purge, so demand does not re-mirror during the purge. A purge alone is a treadmill while the version is still live upstream. The typical pattern is the inverse. An upstream yank or security hold removes or changes the bytes first. Re-mirroring then cannot reproduce them, and a purge clears the stale copy. Irreducible residual: a malicious version with no public advisory cannot be reaped, because there is nothing to detect on. That is the bound the freshness quarantine exists to provide. A serve-only mount has no trusted store of mirrored versions at all. Every serve re-gates under current policy, so a rules change or a fresh advisory takes effect immediately. This threat's surface exists only where a mirrorTarget is declared."

#heading(level: 2)[#"Threat 14: SSRF via the worker back-fill fetch (a blind sink)"]

#list([#strong[#"Elements"]#": back-fill artifact fetch (untrusted)"], [#strong[#"Category"]#": Elevation of privilege (STRIDE)"], [#strong[#"Severity"]#": Low"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"The mirror worker fetches the approved artifact from an upstream-declared dist.tarball location to replicate it. Like the serve-path public fetch, this is untrusted egress to an attacker-influenceable target. In principle it carries the same SSRF surface: a dist.tarball steered at an internal or cloud-metadata address."

#strong[#"Mitigation"]

#"The fetch runs on the same validating-TLS data-plane manager as the serve path. That manager gives https-only egress, certificate validation that authenticates the host, and the universal no-redirect invariant. The dist.tarball is https-only, and the outbound allow-list admitted the location host at serve time, before the job was enqueued. Decisively, this is a blind sink. The worker verifies the bytes against dist.integrity and publishes them. It never returns them to a caller. An internal or metadata response can present neither a CA-trusted certificate for the host nor a match for the asserted digest. The job therefore fails closed and is dropped rather than exfiltrating. Its impact sits well below the serve-path fetch. A serve-only mount enqueues no back-fill jobs, so this surface does not exist there."

#heading(level: 2)[#"Threat 15: Private-upstream aggregation admits the public registry, bypassing the gate"]

#list([#strong[#"Elements"]#": Registry C: pull-through read endpoint"], [#strong[#"Category"]#": Tampering (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"The recommended topology unions the trusted stores, first-party A and the sanitised mirror B, into the pull-through read endpoint C at the registry level. CodeArtifact upstream relationships are one such mechanism. If that aggregation also holds a direct connection to the upstream registry, raw public packages reach clients through C as a trusted source. They skip Écluse's gate entirely: the rules, the integrity floor, and the freshness quarantine. The same upstream-merger mechanism that makes the ideal topology work makes this the natural misconfiguration. A CodeArtifact repository's default npm-store upstream to npmjs is exactly this shape."

#strong[#"Mitigation"]

#"The control is an operator-architecture invariant, documented in the registry model and the Golden Path. The aggregating private upstream composes trusted stores only, first-party plus Écluse's sanitised mirror, and never carries a direct public upstream. Public content enters only through Écluse's gate. Écluse cannot detect a violation: the private upstream is trusted by construction, and its upstream wiring sits outside the proxy. The control is therefore operator discipline and this documented invariant, not a structural check."

#heading(level: 2)[#"Threat 16: Connect-time reachability/timing oracle for an attacker-controlled allowlisted DNS"]

#list([#strong[#"Elements"]#": anonymous packument / tarball fetch (caller token stripped)"], [#strong[#"Category"]#": Information disclosure (STRIDE)"], [#strong[#"Severity"]#": Low"], [#strong[#"Status"]#": Accepted risk"])

#strong[#"Description"]

#"An attacker who controls the DNS for an allowlisted host can repoint it at internal addresses. https-only egress with certificate validation makes the TLS handshake fail, because an internal address cannot present a CA-trusted certificate for the requested host. Écluse therefore sends no request and leaks no data. The success or failure and the timing of the TCP connect and the TLS handshake are still a coarse internal-reachability or port-scan oracle."

#strong[#"Mitigation"]

#"Risk treatment: accepted residual. No data crosses the boundary: the connection fails at the TLS handshake, before any request body goes out. The surface covers only allowlisted hosts whose DNS the attacker already controls, and the signal is coarse, connect and handshake timing alone. The host allowlist bounds which names can be aimed inward at all. It does not remove the residual timing signal."

#heading(level: 2)[#"Threat 17: Pilot container-role privilege escalation"]

#list([#strong[#"Elements"]#": Écluse Pilot (Ingestion Pipeline)"], [#strong[#"Category"]#": Elevation of privilege (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"An attacker who compromises Pilot could use its standing container credentials."

#strong[#"Mitigation"]

#"Least-privilege IAM limits the role to s3:PutObject on the one bucket prefix. Pilot runs in its own container, separate from the proxy."

#heading(level: 2)[#"Threat 18: Proxy compromised via tampered OSV database"]

#list([#strong[#"Elements"]#": Écluse proxy"], [#strong[#"Category"]#": Tampering (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"An attacker who can write to the S3 bucket could supply a tampered osv.db and bypass the vulnerability gates. Worse, they could exploit memory-corruption bugs in the underlying C SQLite engine when the proxy runs a query. A Magellan-style exploit or a malicious trigger is the vector."

#strong[#"Mitigation"]

#"The S3 bucket is private, and the proxy's IAM role holds GetObject only. An atomic shadow-swap prevents a partial read. The proxy binds the SQLite connection to read-only mode and disables trusted schema (PRAGMA trusted_schema = OFF;) as it opens the connection. An attacker-controlled trigger or view therefore never runs. Acceptance then verifies the artifact before the proxy serves it: the schema epoch stamp, a PRAGMA quick_check integrity walk, the required tables, and the ecosystem. The quick_check walk also verifies stored values against each STRICT table's declared column types. The required tables must be real STRICT tables carrying the required columns. Acceptance refuses a failing artifact as a rejection value, remembers its ETag, and keeps the last-good database serving."

#heading(level: 2)[#"Threat 20: Pathological OSV Payload (DoS)"]

#list([#strong[#"Elements"]#": Écluse Pilot (Ingestion Pipeline)"], [#strong[#"Category"]#": Denial of service (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"OSV.dev, or a compromised upstream, could serve an oversized, deeply nested, or malformed JSON file. Parsing it could exhaust CPU or memory and crash Pilot."

#strong[#"Mitigation"]

#"Pilot streams the archive and bounds each advisory as it unzips. It drains an entry past the per-advisory byte cap (8 MiB) to its boundary and drops it before it reaches the decoder. It also drops an entry whose JSON does not decode. Pilot logs and tallies both, so a few poisoned records never halt ingestion. Pilot logs an advisory that fans out into an anomalous number of ranges, and still ingests it. Deep nesting is bounded implicitly. The per-entry byte cap holds decode cost to a constant multiple of the input. Pilot also runs under the boot-resolved process heap ceiling (ECLUSE_RUNTIME__MAX_HEAP_BYTES, else cgroup memory.max). A small but deep payload therefore fails as a bounded, clean process exit rather than exhausting the machine. A systemic drop rate aborts the compile without publishing, so the proxy keeps its last-good osv.db instead of adopting a hole-ridden one. That guard reads the run's own drop tally. It fires only once at least 16 entries dropped and those drops are at least a tenth of the run, which marks a mostly unusable feed, the shape of a compromised or truncated export. Residual: an isolated depth bomb is a bounded Pilot crash rather than a per-record soft drop. A well-formed but empty or near-empty export drops nothing, so the guard passes it, and the run's row count is never read back on accept. Volumetric abuse of the fetch itself stays an operator-edge concern."

#heading(level: 2)[#"Threat 21: Massive Purge DoS"]

#list([#strong[#"Elements"]#": Écluse Dredger"], [#strong[#"Category"]#": Denial of service (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Open"])

#strong[#"Description"]

#"A bug in Dredger, or a malicious rule configuration, could fire thousands of deletion requests at once. That exhausts the registry API limits and denies service to the private mirror."

#strong[#"Mitigation"]

#"Not yet built. Dredger's deletion logic must be explicitly batched and rate-limited."

#heading(level: 2)[#"Threat 22: Mirror-write credential can be sent to a misconfigured registry target"]

#list([#strong[#"Elements"]#": publish mirrored artifact (minted write token)"], [#strong[#"Category"]#": Information disclosure (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"A minted CodeArtifact write token is a live bearer credential scoped to a domain. If an operator could choose the write credential and the mirror-target endpoint independently, the two could diverge. They could point the mirror target at one registry while the token was minted for another. That would disclose the bearer to an endpoint that could log or replay it."

#strong[#"Mitigation"]

#"Écluse derives the mirror-write credential from the mirror-target URL rather than from separate configuration, so the two cannot diverge. A CodeArtifact endpoint mints a token scoped to the domain parsed from that same host. Écluse writes to any other host with an operator-supplied static token. No configuration expresses a CodeArtifact identity independent of the target, so a minted token can never reach an endpoint it was not scoped for. The divergence class is unrepresentable. Config load rejects both a non-CodeArtifact target with no static token and a CodeArtifact target that also carries a static token. Least-privilege IAM also scopes the container role write-only to the intended mirror store, as defence in depth. A serve-only mount declares no mirror target and holds no mirror-write credential, so this surface does not exist there."

#heading(level: 2)[#"Threat 23: Package-name spoofing via invisible characters"]

#list([#strong[#"Elements"]#": npm read / publish (passthrough CodeArtifact token)"], [#strong[#"Category"]#": Spoofing (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"A requested or published package name can impersonate another package to a human reader. Unicode format characters (zero-width and bidirectional controls) render invisibly or reorder glyphs, so two distinct names look identical in a lockfile, a log line, or a review diff. A name can arrive from an upstream fetch as well as from a first-party publish, so the boundary applies to both directions."

#strong[#"Mitigation"]

#"Every package-name component parses against an explicit ASCII allowlist before routing, caching, queueing, or publish admission. For npm the allowlist is the validator's own hard boundary: letters, digits, and - _ . ! ~ * ' ( ), with @ and / as scope structure and no leading period, hyphen, or underscore. A codepoint outside the set, non-ASCII or control, cannot enter by construction, on the serve path or the publish path."

#heading(level: 2)[#"Threat 24: Package-name typosquatting within the permitted character set"]

#list([#strong[#"Elements"]#": npm read / publish (passthrough CodeArtifact token)"], [#strong[#"Category"]#": Spoofing (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Open"])

#strong[#"Description"]

#"A name built only from permitted ASCII characters can read as another name to a human: a capital I in place of a lowercase l, rn in place of m, a swapped or doubled letter, a hyphen moved or dropped. The upstream npm namespace already contains such look-alike names, and a first-party publish can introduce one. A reader of a lockfile, a log line, or a review diff resolves the wrong package."

#strong[#"Mitigation"]

#"The ASCII allowlist bounds the space to visible permitted characters, which keeps every name renderable and comparable. Detection or refusal of look-alike names within the permitted set is not implemented."

#heading(level: 2)[#"Threat 25: Dredger inappropriately purges valid packages"]

#list([#strong[#"Elements"]#": Écluse Dredger"], [#strong[#"Category"]#": Denial of service (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Open"])

#strong[#"Description"]

#"A misconfiguration in Dredger, or poisoned OSV data, could delete legitimate, needed packages from Registry B. That causes cache misses or upstream fetch failures."

#strong[#"Mitigation"]

#"Dredger must delete only from the mirror. On the next request the proxy can re-mirror the version if it passes admission, so a delete then behaves as a cache eviction. A serve-only mount enqueues no back-fill jobs, so this surface does not exist there."

#heading(level: 2)[#"Threat 26: Dredger container-role privilege escalation"]

#list([#strong[#"Elements"]#": Écluse Dredger"], [#strong[#"Category"]#": Elevation of privilege (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Open"])

#strong[#"Description"]

#"Dredger holds a standing high privilege over Registry B: delete-only. An attacker who compromised Dredger could wipe the whole registry."

#strong[#"Mitigation"]

#"Dredger exposes only the liveness and readiness probes. Least-privilege IAM scopes it delete-only on Registry B. It prefers container-role minting over static secrets."

#heading(level: 2)[#"Threat 27: Poisoned OSV payload exploits parser"]

#list([#strong[#"Elements"]#": Écluse Pilot (Ingestion Pipeline)"], [#strong[#"Category"]#": Denial of service (STRIDE)"], [#strong[#"Severity"]#": Medium"], [#strong[#"Status"]#": Mitigated"])

#strong[#"Description"]

#"A maliciously crafted or unexpectedly massive OSV payload from upstream could cause Pilot to exhaust memory or crash during JSON parsing."

#strong[#"Mitigation"]

#"Pilot runs apart from the proxy. If Pilot runs out of memory or fails, it only delays updates. The proxy keeps serving traffic from the last-known-good osv.db snapshot."

#heading(level: 2)[#"Threat 28: First-party data loss from collapsed registries"]

#list([#strong[#"Elements"]#": Écluse Dredger"], [#strong[#"Category"]#": Denial of service (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Open"])

#strong[#"Description"]

#"An operator can collapse the mirror target and the publication target onto a single registry. Dredger could then purge first-party packages, taking them for stale or vulnerable public ones."

#strong[#"Mitigation"]

#"Dredger must refuse to boot when mounts."#"<eco>"#".mirrorTarget and mounts."#"<eco>"#".publicationTarget resolve to the same registry. The proxy's own boot warns on that pair and then proceeds. Collapsing the registries deliberately surrenders Dredger's automated pruning."

#heading(level: 2)[#"Threat 101: Oracle Blackout / Supply Chain DoS via OSV.dev compromise"]

#list([#strong[#"Elements"]#": Écluse Pilot (Ingestion Pipeline)"], [#strong[#"Category"]#": Spoofing (STRIDE)"], [#strong[#"Severity"]#": High"], [#strong[#"Status"]#": Accepted risk"])

#strong[#"Description"]

#"An attacker who gains control of osv.dev can push malicious vulnerability records. Those records trigger false positives, or fast-lane a malicious remediation package. The attack is strongest when the attacker also publishes a malicious package. Écluse explicitly trusts the OSV database as the oracle of truth."

#strong[#"Mitigation"]

#"Risk treatment: accepted by trust assumption. A compromised security oracle is a foundational supply-chain compromise. Pilot relies on OSV as a source of vulnerability truth. A hostile oracle defeats the defence outright. Transport, parsing, validation, and last-good-database controls mitigate tampering in transit, malformed payloads, and update outages. They cannot make a hostile source of truth trustworthy."

#heading(level: 2)[#"Threat 102: Accidental permanent deletion of registry data"]

#list([#strong[#"Elements"]#": Écluse Dredger"], [#strong[#"Category"]#": Elevation of privilege (STRIDE)"], [#strong[#"Severity"]#": Critical"], [#strong[#"Status"]#": Open"])

#strong[#"Description"]

#"Dredger issues permanent hard deletions against the mirror registry. Misconfigured, or pointed at the wrong registry, it destroys data permanently."

#strong[#"Mitigation"]

#"Dredger must verify explicit operator consent before it runs any destructive action. It is required to query the target CodeArtifact repository for a specific resource tag, for example "#raw("Dredger: PermanentDeletionAllowed")#", and to fail closed without that tag. It must also refuse to boot when mounts."#"<eco>"#".mirrorTarget and mounts."#"<eco>"#".publicationTarget resolve to the same registry."