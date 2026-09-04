# Écluse threat register

| Number | Title                                                                                                 | Elements                                                    | Category                        | Severity | Status        |
| ------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------- | -------- | ------------- |
| 1      | Forwarded caller credentials aggregated in proxy memory                                               | Écluse proxy                                                | Information disclosure (STRIDE) | High     | Mitigated     |
| 2      | Chokepoint exhaustion via pathological upstream payload                                               | Écluse proxy                                                | Denial of service (STRIDE)      | Medium   | Mitigated     |
| 3      | Off-by-default edge auth assumes a sound network boundary                                             | npm read / publish (passthrough CodeArtifact token)         | Spoofing (STRIDE)               | Medium   | Mitigated     |
| 4      | Caller credential leak to the public upstream                                                         | anonymous packument / tarball fetch (caller token stripped) | Information disclosure (STRIDE) | High     | Mitigated     |
| 5      | SSRF via crafted identifier or upstream-declared dist.tarball                                         | anonymous packument / tarball fetch (caller token stripped) | Elevation of privilege (STRIDE) | High     | Mitigated     |
| 6      | Package shadowing via first-party publish                                                             | relay npm publish (publisher token forwarded)               | Tampering (STRIDE)              | High     | Mitigated     |
| 7      | Mirror-write credential is a standing privilege over the trusted store                                | publish mirrored artifact (minted write token)              | Elevation of privilege (STRIDE) | High     | Mitigated     |
| 8      | SSRF to the instance-metadata credential endpoint                                                     | mint via container role (IMDSv2 / STS)                      | Elevation of privilege (STRIDE) | Medium   | Mitigated     |
| 9      | Cross-client disclosure of a private package via shared cache (#115)                                  | Metadata cache&#xA;(public-gated only)                      | Information disclosure (STRIDE) | High     | Mitigated     |
| 10     | Registry collapse erases provenance and per-store policy                                              | Registry B:&#xA;mirror store (public-derived)               | Repudiation (STRIDE)            | Medium   | Mitigated     |
| 11     | Undetected artifact substitution across upstreams                                                     | Registry C:&#xA;pull-through read endpoint                  | Tampering (STRIDE)              | High     | Mitigated     |
| 12     | Upstream registry forges its own server-asserted metadata (e.g. a backdated publish time)             | Public npm registry                                         | Tampering (STRIDE)              | High     | Accepted risk |
| 13     | Malicious mirrored version persists and is served as trusted (no automatic post-ingestion revocation) | Registry B:&#xA;mirror store (public-derived)               | Tampering (STRIDE)              | Medium   | Open          |
| 14     | SSRF via the worker back-fill fetch (a blind sink)                                                    | back-fill artifact fetch (untrusted)                        | Elevation of privilege (STRIDE) | Low      | Mitigated     |
| 15     | Private-upstream aggregation admits the public registry, bypassing the gate                           | Registry C:&#xA;pull-through read endpoint                  | Tampering (STRIDE)              | High     | Mitigated     |
| 16     | Connect-time reachability/timing oracle for an attacker-controlled allowlisted DNS                    | anonymous packument / tarball fetch (caller token stripped) | Information disclosure (STRIDE) | Low      | Accepted risk |
| 17     | Pilot container-role privilege escalation                                                             | Écluse Pilot&#xA;(Ingestion Pipeline)                       | Elevation of privilege (STRIDE) | High     | Mitigated     |
| 18     | Proxy compromised via tampered OSV database                                                           | Écluse proxy                                                | Tampering (STRIDE)              | High     | Mitigated     |
| 20     | Pathological OSV Payload (DoS)                                                                        | Écluse Pilot&#xA;(Ingestion Pipeline)                       | Denial of service (STRIDE)      | Medium   | Mitigated     |
| 21     | Massive Purge DoS                                                                                     | Écluse Dredger                                              | Denial of service (STRIDE)      | Medium   | Open          |
| 22     | Mirror-write credential can be sent to a misconfigured registry target                                | publish mirrored artifact (minted write token)              | Information disclosure (STRIDE) | Medium   | Mitigated     |
| 23     | Package-name spoofing via invisible characters                                                        | npm read / publish (passthrough CodeArtifact token)         | Spoofing (STRIDE)               | Medium   | Mitigated     |
| 24     | Package-name typosquatting within the permitted character set                                         | npm read / publish (passthrough CodeArtifact token)         | Spoofing (STRIDE)               | Medium   | Open          |
| 25     | Dredger inappropriately purges valid packages                                                         | Écluse Dredger                                              | Denial of service (STRIDE)      | Medium   | Open          |
| 26     | Dredger container-role privilege escalation                                                           | Écluse Dredger                                              | Elevation of privilege (STRIDE) | High     | Open          |
| 27     | Poisoned OSV payload exploits parser                                                                  | Écluse Pilot&#xA;(Ingestion Pipeline)                       | Denial of service (STRIDE)      | Medium   | Mitigated     |
| 28     | First-party data loss from collapsed registries                                                       | Écluse Dredger                                              | Denial of service (STRIDE)      | High     | Open          |
| 101    | Oracle Blackout / Supply Chain DoS via OSV.dev compromise                                             | Écluse Pilot&#xA;(Ingestion Pipeline)                       | Spoofing (STRIDE)               | High     | Accepted risk |
| 102    | Accidental permanent deletion of registry data                                                        | Écluse Dredger                                              | Elevation of privilege (STRIDE) | Critical | Open          |

## Threat 1: Forwarded caller credentials aggregated in proxy memory

- **Elements**: Écluse proxy
- **Category**: Information disclosure (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

Under the canonical passthrough strategy the proxy transiently holds every caller's own CodeArtifact bearer token in process memory while it relays reads and publishes. One proxy compromise therefore harvests the credentials of all callers in transit, not one. A heap or memory dump, a log-field leak, and a malicious dependency in Écluse's own supply chain all reach that result. Passthrough spreads credential exposure across every user. A service identity would instead concentrate it in one short-lived token.

**Mitigation**

Écluse carries a token in a redacted type, the Secret newtype, whose Show renders a fixed placeholder, so a token never reaches a log field. Retention is request-scoped, and the code unwraps a token only at the point of use, to attach the bearer to an outbound request. Neither the data-plane nor the WAI span instrumentation records an Authorization header, so a credential never reaches a span. The WAI layer does record benign request headers, such as User-Agent. A regression test holds the split. Residual: a garbage-collected runtime cannot guarantee prompt erasure from the heap. The first-class compensating control is therefore hardening Écluse's own runtime and supply chain, through the attested, reproducible image that the image vulnerability-scan gate keeps clean.

## Threat 2: Chokepoint exhaustion via pathological upstream payload

- **Elements**: Écluse proxy
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

Écluse is a mandatory chokepoint, so degrading its availability is itself a supply-chain attack. Builds fail, or operators are tempted to bypass the gate. A hostile or compromised upstream registry, or a pathological public package, could return an oversized, version-flooded, or deeply nested packument. Parsing it and evaluating the rules per version could then exhaust CPU or memory.

**Mitigation**

Fail-closed caps bound the input: body size, version count, and nesting depth (ECLUSE\_LIMITS\_\_MAX\_RESPONSE\_BYTES, ECLUSE\_LIMITS\_\_MAX\_VERSION\_COUNT, ECLUSE\_LIMITS\_\_MAX\_NESTING\_DEPTH). The bounded read stops mid-stream. The serve path is O(n log n) in version count, a Map-based merge with no super-linear blow-up. The single-flight cache coalesces concurrent misses for the same package onto one computation, and a per-request timeout caps any single request. Écluse still projects the whole document before the version cap rejects it. Failing fast at the cap is an accepted residual for v0.1.0. The advisory-backed rules compound that cost. They evaluate each version on its own, with no memoisation, and take one or two advisory lookups per version, so a near-cap document multiplies those lookups. Batching them per package is required to remove the amplification. Resident-bytes and serve-concurrency admission bounds further cap the aggregate resident cost. The residual is resource amplification, not algorithmic complexity. A near-cap document still costs real CPU and heap, and distinct-key floods bypass single-flight, worst under a hostile or compromised upstream registry. Volumetric and concurrency rate-limiting is therefore an operator-edge responsibility, as access control is.

## Threat 3: Off-by-default edge auth assumes a sound network boundary

- **Elements**: npm read / publish (passthrough CodeArtifact token)
- **Category**: Spoofing (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

The edge token, server.authToken (ECLUSE\_SERVER\_\_AUTH\_TOKEN), is off by default. Écluse delegates 'who may reach the proxy' to the operator's access edge: a gateway, a mesh, or a network policy. If that boundary fails, an unauthenticated caller can drive the proxy. The east-west case is the notable one: a compromised neighbour reaches the pod directly and bypasses an ingress-only IP allow-list.

**Mitigation**

Compensating control: under passthrough the request carries only the caller's own forwarded token, and the read path never substitutes a standing credential. No forwarded token means no private read. A breach of the edge exposes only the public-gated view plus the untrusted-egress and denial-of-service surface, never private packages. The publish path is the one exception. A configured static publication-target credential (mounts.<eco>.publicationTargetToken) serves as the fallback for a tokenless publish, so 'no token, no publish' holds only for pure passthrough. The internal-credential publish mode is therefore fail-closed by construction. A configured publication-target token requires a verifiable inbound edge, server.authToken or stronger, so the composition root refuses internal-credential-plus-open-edge at boot. That state is unrepresentable, on the same principle the trusted-edge read identity follows. Restrict both north-south and east-west access, as the Golden Path documents. Any edge mode that substitutes Écluse's own identity, read or write, must require a verifiable edge. Use mTLS or a shared secret, never a bare spoofable header.

## Threat 4: Caller credential leak to the public upstream

- **Elements**: anonymous packument / tarball fetch (caller token stripped)
- **Category**: Information disclosure (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

The upstream registry is attacker-influenceable and must never receive a caller's credential. A failure to strip the caller token on the public fetch would disclose a live CodeArtifact token to public npm. So would following a cross-host 3xx with the bearer still attached, to an attacker-chosen redirect target, over the unguarded private manager.

**Mitigation**

Écluse strips the caller credential before every public fetch and queries the registry anonymously. A credential-bearing request never follows a redirect: attachCredential is the single credential-attach point, and it finalises every request it builds through finaliseRequest, which sets redirectCount=0. That matters because the http-client in use does not drop Authorization on a cross-host redirect.

## Threat 5: SSRF via crafted identifier or upstream-declared dist.tarball

- **Elements**: anonymous packument / tarball fetch (caller token stripped)
- **Category**: Elevation of privilege (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

Écluse builds outbound URLs from client-supplied package identifiers and upstream-declared artifact locations. A traversal, encoded-slash, or absolute-URL name could steer a fetch to an unintended target such as cloud metadata or the private network. So could a dist.tarball that points at an internal or attacker-chosen host.

**Mitigation**

Écluse canonicalises the identifier and encodes on build. It also enforces an outbound host and port allow-list, the load-bearing control, where it builds the request URL. Registry egress is https-only by construction. Every outbound registry URL goes through a typed boundary, mkRegistryUrl, which rejects any non-https scheme, and a non-https configured endpoint fails closed at boot. TLS certificate validation authenticates the dialled host. A name steered to an internal or rebound address cannot present a CA-trusted certificate for the requested host. Certificate validation therefore closes the resolve-to-internal and DNS-rebinding SSRF class, rather than a resolved-IP recheck. No data-plane request follows an upstream redirect, because finaliseRequest pins redirectCount=0 on every request attachCredential builds. No redirect hop can escape the build-time allow-list or downgrade the scheme. A disallow-by-default same-authority policy applies to dist.tarball, matched on host and port. Écluse upgrades a legacy http dist.tarball to https on the same host, and drops and records one on a foreign host. The trusted private origin meets the same https requirement. A cheap pure literal internal-range block remains as defence in depth on the dist.tarball host gate. An operator can extend that fixed range set with ECLUSE\_EGRESS\_\_ADDITIONAL\_BLOCKED\_RANGES for internal space the module cannot know in advance. That setting is widen-only and fails closed at boot on a malformed entry.

## Threat 6: Package shadowing via first-party publish

- **Elements**: relay npm publish (publisher token forwarded)
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

Écluse relays a publish to the private store with the publisher's own token. The packument merge serves private versions as trusted, winning collisions over public ones. A compromised-CI or insider publisher could clear the publish-scope check, or slip past it. They could then publish a name that the merge serves as a trusted version over the public package. That is a dependency-confusion path through Écluse's own trust model.

**Mitigation**

The publicationAllow allow-list, for npm a list of scopes, refuses any name outside the operator's scopes before any upstream write. That is the anti-shadowing guard. The scope match is exact on the parsed namespace, so a prefix such as @acme-evil does not satisfy an @acme allow-list. Soundness requires the authorised identity to be the written identity. Écluse validates the publish document's own declared name and \_id, and the per-version names, equal to the scope-guarded URL-path name before the relay. It then builds the write URL from that same canonical name. The guarded name, the written name, and the merge collision key are therefore one identity by construction. Residual: shadowing within an allow-listed scope, and allow-precedence choices, stay the operator's risk. Give the publisher's target credential least privilege.

## Threat 7: Mirror-write credential is a standing privilege over the trusted store

- **Elements**: publish mirrored artifact (minted write token)
- **Category**: Elevation of privilege (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

The mirror worker holds Écluse's only standing self-minted credential. It carries write access to the mirror store (Registry B), which feeds the trusted read path. A worker compromise, or any bypass of the admission gate, could write attacker-chosen bytes into the trusted store and poison future reads.

**Mitigation**

Containment of this standing privilege rests on least-privilege IAM on the container or task role: write to Registry B only. A CodeArtifact token bears the role's own permissions, so this is an IAM policy rather than a token-level scope. Minting from the container role beats static credentials, and the TTL is minimal, capped by CodeArtifact at 12h. The publish runs with redirectCount=0, because attachCredential attaches the mint token and finalises the request through finaliseRequest. The mirror queue sits inside the same trust boundary and is isolated and managed at the infrastructure level. A job is unauthenticated data that directs the worker to fetch and publish, so queue-send access is equivalent to trusted-write access. Scope the queue's IAM so only the serve role enqueues (SendMessage) and only the worker receives and acks. Écluse relies on access control for message authenticity, deliberately, rather than on signatures. That is the standard pattern for an internal single-producer, single-consumer queue. The worker's own attack surface is small. It hashes the fetched bytes and forwards them unchanged, with no decompression and no tarball parsing. A malicious artifact is therefore a poor code-execution vector. The dist.integrity check is anti-tamper-in-transit and anti-downgrade. It fails closed when the strongest present digest is in an uncomputable algorithm, and never downgrades to a forgeable weaker one. It proves the bytes match the upstream's asserted digest, so it catches back-fill corruption but not a hostile upstream or a worker compromise. Admission-gate soundness therefore bounds the poisoning of future reads, together with the role's blast radius and queue access control, not the integrity check. The trusted store is only as clean as what the gate admits, and only the gate may enqueue. A serve-only mount, with no mirrorTarget declared, removes this surface entirely. It holds and mints no write credential, and with zero mirrored mounts the process builds no mirror queue and starts no worker.

## Threat 8: SSRF to the instance-metadata credential endpoint

- **Elements**: mint via container role (IMDSv2 / STS)
- **Category**: Elevation of privilege (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

Container-role token minting must reach the instance-metadata endpoint (169.254.169.254) and STS. An SSRF that reached metadata could mint the worker's CodeArtifact credential.

**Mitigation**

Écluse follows an internal-resolving location only on the trusted private origin, never on a client-influenced or upstream-influenced target. Nothing can therefore steer the data plane at metadata. Minting uses amazonka's own client, off the guarded data-plane manager. Operator defence in depth: require IMDSv2 and set the hop limit to 1. Do not block metadata outright.

## Threat 9: Cross-client disclosure of a private package via shared cache (#115)

- **Elements**: Metadata cache
  (public-gated only)
- **Category**: Information disclosure (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

A cache key carries no credential dimension. If the cache held a private-origin document, one caller could warm an entry and a second, differently authorised caller could receive it. That second caller receives the document without the upstream ever authorising their own request.

**Mitigation**

Écluse never enters the private origin into the shared cache. Module encapsulation is the guarantee: the cache-entering client builder is unexported, and the private-origin path hard-codes an uncached fetch. The cache holds only the anonymous public-gated origin. Écluse re-consults the private origin on every request, with the caller's own forwarded token. The cache-recovering designs that would share a private entry, delegated-cache and memoised, are rejected by design. No shared private cache exists to leak.

## Threat 10: Registry collapse erases provenance and per-store policy

- **Elements**: Registry B:
  mirror store (public-derived)
- **Category**: Repudiation (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

Écluse supports collapsing its internal registry roles onto as few as one store. The recommended topology keeps the first-party store (A) and the public-derived mirror store (B) separate. It then unions them into the pull-through read endpoint (C) at the registry level. Collapsing them onto a single shared store is the degenerate floor. An undeclared mounts.<eco>.mirrorTarget makes the mount serve-only, with no mirror store at all. The fold is a mirrorTarget set equal to the private upstream, which the boot warns about and then accepts. Collapse loses the physical separation between first-party and public-derived inventory. Distinct storage-level rule sets and scanning per provenance become impossible. Collapse also muddies post-disclosure incident scoping, 'which mirrored public packages did we hold?', which weakens the arithmetic-not-forensics response.

**Mitigation**

Deploy the recommended three-registry topology, the Golden Path: a first-party store, a public-derived mirror store, and a pull-through aggregator read endpoint. The endpoint unions the other two at the registry level. Each of the three is independently governable. The single-registry collapse stays supported but discouraged. It trades auditability and defence in depth, not the perimeter. An operator who deliberately chooses a collapsed topology accepts that local residual risk against their own threat tolerance.

## Threat 11: Undetected artifact substitution across upstreams

- **Elements**: Registry C:
  pull-through read endpoint
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

The merge flags an integrity divergence when the private and public copies of a version contradict on a shared digest algorithm. A weak-only or absent digest could let a substituted artifact pass undetected and reach the client as the trusted copy. So could a flaw in the divergence key.

**Mitigation**

Écluse admits a public version only if it carries a digest that meets the integrity floor: a uniform SHA-256 default, hard-floored. Divergence compares each digest's asserted algorithm, not a bucketed tag. The merge detects a real same-version contradiction on a shared algorithm, and the serve path consumes it. Écluse logs it at WARNING, naming the package, the contradicting versions, and their digests, and meters it as ecluse.registry.merge.divergence. A substitution therefore surfaces, and the merge never silently reconciles it. The trusted copy always wins the served bytes. The operator's ECLUSE\_INTEGRITY\_\_DIVERGENCE\_POLICY then decides whether Écluse also withholds the contested version from the listing (fail-closed) or serves it with the alarm (warn, the default). Residual: warn detects without withholding, so an operator who wants prevention rather than detection must set fail-closed. The trusted-floor path is deliberately operator-loosenable, trading strictness for availability, and that is the remaining way a weak digest is accepted. A serve-only mount with no private upstream, the pure public gate, has a single origin, so cross-upstream divergence detection is structurally absent. That is an accepted residual of that sub-shape. A serve-only mount that reads a private upstream keeps the detection unchanged.

## Threat 12: Upstream registry forges its own server-asserted metadata (e.g. a backdated publish time)

- **Elements**: Public npm registry
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Accepted risk

**Description**

Écluse's freshness quarantine and integrity reasoning consume fields the upstream registry asserts, notably the per-version publish time and server-side integrity. A registry that asserted forged values could admit content the age and integrity gates would otherwise hold back. A backdated time defeats the age quarantine, and a manufactured digest defeats the integrity check.

**Mitigation**

Risk treatment: accepted by trust assumption. The primary registries stamp these fields server-side. The publish time is not part of the publish document, so a publisher cannot forge it. Écluse reads the registry's metadata, so it necessarily extends a floor of trust to the registry operator's honesty. A hostile operator is an adversary this model cannot counter, the same class as 'what if npm itself is malicious'. What is untrusted here are the tarball contents and the author-supplied fields, and the rules engine and the integrity floor do gate those. The freshness quarantine's age signal depends on the upstream's timestamp honesty, so a registry that asserted a forged time could in theory defeat it. Écluse could re-anchor age to its own first observation of a version and remove that dependence. It deliberately does not. The central public registries, npmjs and PyPI among them, are foundational to modern software infrastructure. Trusting their server-stamped timestamps is the only practical recourse. A dependable first-observation anchor would need durable, replica-shared state, at odds with Écluse's network-broker design. It would also narrow only a surface that already sits outside the practical treatment boundary. Écluse records this as accepted residual risk rather than mitigated.

## Threat 13: Malicious mirrored version persists and is served as trusted (no automatic post-ingestion revocation)

- **Elements**: Registry B:
  mirror store (public-derived)
- **Category**: Tampering (STRIDE)
- **Severity**: Medium
- **Status**: Open

**Description**

Écluse mirrors approved public versions into Registry B and, by design, resists upstream yanks so a benign yank does not break installs. The cost is that a version later found malicious persists in B and is served as trusted. The merge serves the private origin unfiltered by the rules. Nothing removes it automatically: neither an upstream yank nor a rules change reaches an already-mirrored artifact.

**Mitigation**

The freshness quarantine (`AllowIfOlderThan`) is the primary defence. It delays serving a new version until advisories have time to surface, so the rules deny most malicious versions at admission, before any mirroring. This threat is the residual for a version found bad after it cleared the quarantine and was mirrored. Detection is delegated: operator scanning of Registry B, upstream advisories, and security-holding signals decide what to revoke. Enforcement is layered across the version's lifecycle. The hard deny-by-identity rule (DenyByIdentity) halts re-admission on the serve path and re-mirroring at the worker's ingest re-check. That is the immediate, surgical stop, and it also breaks the re-mirror treadmill. An automated reaper, the Écluse Dredger, must continually prune already-mirrored versions that match an advisory or age condition, so recovery follows a public alert without an operator step. It is required to run as a separate service that shares the core rules engine and exposes only its liveness and readiness probes. The operator can also purge a version from Registry B directly. The rules never run on trusted content, so a purge is what removes the already-mirrored copy. Order the two as deny then purge, so demand does not re-mirror during the purge. A purge alone is a treadmill while the version is still live upstream. The typical pattern is the inverse. An upstream yank or security hold removes or changes the bytes first. Re-mirroring then cannot reproduce them, and a purge clears the stale copy. Irreducible residual: a malicious version with no public advisory cannot be reaped, because there is nothing to detect on. That is the bound the freshness quarantine exists to provide. A serve-only mount has no trusted store of mirrored versions at all. Every serve re-gates under current policy, so a rules change or a fresh advisory takes effect immediately. This threat's surface exists only where a mirrorTarget is declared.

## Threat 14: SSRF via the worker back-fill fetch (a blind sink)

- **Elements**: back-fill artifact fetch (untrusted)
- **Category**: Elevation of privilege (STRIDE)
- **Severity**: Low
- **Status**: Mitigated

**Description**

The mirror worker fetches the approved artifact from an upstream-declared dist.tarball location to replicate it. Like the serve-path public fetch, this is untrusted egress to an attacker-influenceable target. In principle it carries the same SSRF surface: a dist.tarball steered at an internal or cloud-metadata address.

**Mitigation**

The fetch runs on the same validating-TLS data-plane manager as the serve path. That manager gives https-only egress, certificate validation that authenticates the host, and the universal no-redirect invariant. The dist.tarball is https-only, and the outbound allow-list admitted the location host at serve time, before the job was enqueued. Decisively, this is a blind sink. The worker verifies the bytes against dist.integrity and publishes them. It never returns them to a caller. An internal or metadata response can present neither a CA-trusted certificate for the host nor a match for the asserted digest. The job therefore fails closed and is dropped rather than exfiltrating. Its impact sits well below the serve-path fetch. A serve-only mount enqueues no back-fill jobs, so this surface does not exist there.

## Threat 15: Private-upstream aggregation admits the public registry, bypassing the gate

- **Elements**: Registry C:
  pull-through read endpoint
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

The recommended topology unions the trusted stores, first-party A and the sanitised mirror B, into the pull-through read endpoint C at the registry level. CodeArtifact upstream relationships are one such mechanism. If that aggregation also holds a direct connection to the upstream registry, raw public packages reach clients through C as a trusted source. They skip Écluse's gate entirely: the rules, the integrity floor, and the freshness quarantine. The same upstream-merger mechanism that makes the ideal topology work makes this the natural misconfiguration. A CodeArtifact repository's default npm-store upstream to npmjs is exactly this shape.

**Mitigation**

The control is an operator-architecture invariant, documented in the registry model and the Golden Path. The aggregating private upstream composes trusted stores only, first-party plus Écluse's sanitised mirror, and never carries a direct public upstream. Public content enters only through Écluse's gate. Écluse cannot detect a violation: the private upstream is trusted by construction, and its upstream wiring sits outside the proxy. The control is therefore operator discipline and this documented invariant, not a structural check.

## Threat 16: Connect-time reachability/timing oracle for an attacker-controlled allowlisted DNS

- **Elements**: anonymous packument / tarball fetch (caller token stripped)
- **Category**: Information disclosure (STRIDE)
- **Severity**: Low
- **Status**: Accepted risk

**Description**

An attacker who controls the DNS for an allowlisted host can repoint it at internal addresses. https-only egress with certificate validation makes the TLS handshake fail, because an internal address cannot present a CA-trusted certificate for the requested host. Écluse therefore sends no request and leaks no data. The success or failure and the timing of the TCP connect and the TLS handshake are still a coarse internal-reachability or port-scan oracle.

**Mitigation**

Risk treatment: accepted residual. No data crosses the boundary: the connection fails at the TLS handshake, before any request body goes out. The surface covers only allowlisted hosts whose DNS the attacker already controls, and the signal is coarse, connect and handshake timing alone. The host allowlist bounds which names can be aimed inward at all. It does not remove the residual timing signal.

## Threat 17: Pilot container-role privilege escalation

- **Elements**: Écluse Pilot
  (Ingestion Pipeline)
- **Category**: Elevation of privilege (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

An attacker who compromises Pilot could use its standing container credentials.

**Mitigation**

Least-privilege IAM limits the role to s3:PutObject on the one bucket prefix. Pilot runs in its own container, separate from the proxy.

## Threat 18: Proxy compromised via tampered OSV database

- **Elements**: Écluse proxy
- **Category**: Tampering (STRIDE)
- **Severity**: High
- **Status**: Mitigated

**Description**

An attacker who can write to the S3 bucket could supply a tampered osv.db and bypass the vulnerability gates. Worse, they could exploit memory-corruption bugs in the underlying C SQLite engine when the proxy runs a query. A Magellan-style exploit or a malicious trigger is the vector.

**Mitigation**

The S3 bucket is private, and the proxy's IAM role holds GetObject only. An atomic shadow-swap prevents a partial read. The proxy binds the SQLite connection to read-only mode and disables trusted schema (PRAGMA trusted\_schema = OFF;) as it opens the connection. An attacker-controlled trigger or view therefore never runs. Acceptance then verifies the artifact before the proxy serves it: the schema epoch stamp, a PRAGMA quick\_check integrity walk, the required tables, and the ecosystem. The quick\_check walk also verifies stored values against each STRICT table's declared column types. The required tables must be real STRICT tables carrying the required columns. Acceptance refuses a failing artifact as a rejection value, remembers its ETag, and keeps the last-good database serving.

## Threat 20: Pathological OSV Payload (DoS)

- **Elements**: Écluse Pilot
  (Ingestion Pipeline)
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

OSV.dev, or a compromised upstream, could serve an oversized, deeply nested, or malformed JSON file. Parsing it could exhaust CPU or memory and crash Pilot.

**Mitigation**

Pilot streams the archive and bounds each advisory as it unzips. It drains an entry past the per-advisory byte cap (8 MiB) to its boundary and drops it before it reaches the decoder. It also drops an entry whose JSON does not decode. Pilot logs and tallies both, so a few poisoned records never halt ingestion. Pilot logs an advisory that fans out into an anomalous number of ranges, and still ingests it. Deep nesting is bounded implicitly. The per-entry byte cap holds decode cost to a constant multiple of the input. Pilot also runs under the boot-resolved process heap ceiling (ECLUSE\_RUNTIME\_\_MAX\_HEAP\_BYTES, else cgroup memory.max). A small but deep payload therefore fails as a bounded, clean process exit rather than exhausting the machine. A systemic drop rate aborts the compile without publishing, so the proxy keeps its last-good osv.db instead of adopting a hole-ridden one. That guard reads the run's own drop tally. It fires only once at least 16 entries dropped and those drops are at least a tenth of the run, which marks a mostly unusable feed, the shape of a compromised or truncated export. Residual: an isolated depth bomb is a bounded Pilot crash rather than a per-record soft drop. A well-formed but empty or near-empty export drops nothing, so the guard passes it, and the run's row count is never read back on accept. Volumetric abuse of the fetch itself stays an operator-edge concern.

## Threat 21: Massive Purge DoS

- **Elements**: Écluse Dredger
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Open

**Description**

A bug in Dredger, or a malicious rule configuration, could fire thousands of deletion requests at once. That exhausts the registry API limits and denies service to the private mirror.

**Mitigation**

Not yet built. Dredger's deletion logic must be explicitly batched and rate-limited.

## Threat 22: Mirror-write credential can be sent to a misconfigured registry target

- **Elements**: publish mirrored artifact (minted write token)
- **Category**: Information disclosure (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

A minted CodeArtifact write token is a live bearer credential scoped to a domain. If an operator could choose the write credential and the mirror-target endpoint independently, the two could diverge. They could point the mirror target at one registry while the token was minted for another. That would disclose the bearer to an endpoint that could log or replay it.

**Mitigation**

Écluse derives the mirror-write credential from the mirror-target URL rather than from separate configuration, so the two cannot diverge. A CodeArtifact endpoint mints a token scoped to the domain parsed from that same host. Écluse writes to any other host with an operator-supplied static token. No configuration expresses a CodeArtifact identity independent of the target, so a minted token can never reach an endpoint it was not scoped for. The divergence class is unrepresentable. Config load rejects both a non-CodeArtifact target with no static token and a CodeArtifact target that also carries a static token. Least-privilege IAM also scopes the container role write-only to the intended mirror store, as defence in depth. A serve-only mount declares no mirror target and holds no mirror-write credential, so this surface does not exist there.

## Threat 23: Package-name spoofing via invisible characters

- **Elements**: npm read / publish (passthrough CodeArtifact token)
- **Category**: Spoofing (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

A requested or published package name can impersonate another package to a human reader. Unicode format characters (zero-width and bidirectional controls) render invisibly or reorder glyphs, so two distinct names look identical in a lockfile, a log line, or a review diff. A name can arrive from an upstream fetch as well as from a first-party publish, so the boundary applies to both directions.

**Mitigation**

Every package-name component parses against an explicit ASCII allowlist before routing, caching, queueing, or publish admission. For npm the allowlist is the validator's own hard boundary: letters, digits, and - \_ . ! \~ \* ' ( ), with @ and / as scope structure and no leading period, hyphen, or underscore. A codepoint outside the set, non-ASCII or control, cannot enter by construction, on the serve path or the publish path.

## Threat 24: Package-name typosquatting within the permitted character set

- **Elements**: npm read / publish (passthrough CodeArtifact token)
- **Category**: Spoofing (STRIDE)
- **Severity**: Medium
- **Status**: Open

**Description**

A name built only from permitted ASCII characters can read as another name to a human: a capital I in place of a lowercase l, rn in place of m, a swapped or doubled letter, a hyphen moved or dropped. The upstream npm namespace already contains such look-alike names, and a first-party publish can introduce one. A reader of a lockfile, a log line, or a review diff resolves the wrong package.

**Mitigation**

The ASCII allowlist bounds the space to visible permitted characters, which keeps every name renderable and comparable. Detection or refusal of look-alike names within the permitted set is not implemented.

## Threat 25: Dredger inappropriately purges valid packages

- **Elements**: Écluse Dredger
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Open

**Description**

A misconfiguration in Dredger, or poisoned OSV data, could delete legitimate, needed packages from Registry B. That causes cache misses or upstream fetch failures.

**Mitigation**

Dredger must delete only from the mirror. On the next request the proxy can re-mirror the version if it passes admission, so a delete then behaves as a cache eviction. A serve-only mount enqueues no back-fill jobs, so this surface does not exist there.

## Threat 26: Dredger container-role privilege escalation

- **Elements**: Écluse Dredger
- **Category**: Elevation of privilege (STRIDE)
- **Severity**: High
- **Status**: Open

**Description**

Dredger holds a standing high privilege over Registry B: delete-only. An attacker who compromised Dredger could wipe the whole registry.

**Mitigation**

Dredger exposes only the liveness and readiness probes. Least-privilege IAM scopes it delete-only on Registry B. It prefers container-role minting over static secrets.

## Threat 27: Poisoned OSV payload exploits parser

- **Elements**: Écluse Pilot
  (Ingestion Pipeline)
- **Category**: Denial of service (STRIDE)
- **Severity**: Medium
- **Status**: Mitigated

**Description**

A maliciously crafted or unexpectedly massive OSV payload from upstream could cause Pilot to exhaust memory or crash during JSON parsing.

**Mitigation**

Pilot runs apart from the proxy. If Pilot runs out of memory or fails, it only delays updates. The proxy keeps serving traffic from the last-known-good osv.db snapshot.

## Threat 28: First-party data loss from collapsed registries

- **Elements**: Écluse Dredger
- **Category**: Denial of service (STRIDE)
- **Severity**: High
- **Status**: Open

**Description**

An operator can collapse the mirror target and the publication target onto a single registry. Dredger could then purge first-party packages, taking them for stale or vulnerable public ones.

**Mitigation**

Dredger must refuse to boot when mounts.<eco>.mirrorTarget and mounts.<eco>.publicationTarget resolve to the same registry. The proxy's own boot warns on that pair and then proceeds. Collapsing the registries deliberately surrenders Dredger's automated pruning.

## Threat 101: Oracle Blackout / Supply Chain DoS via OSV.dev compromise

- **Elements**: Écluse Pilot
  (Ingestion Pipeline)
- **Category**: Spoofing (STRIDE)
- **Severity**: High
- **Status**: Accepted risk

**Description**

An attacker who gains control of osv.dev can push malicious vulnerability records. Those records trigger false positives, or fast-lane a malicious remediation package. The attack is strongest when the attacker also publishes a malicious package. Écluse explicitly trusts the OSV database as the oracle of truth.

**Mitigation**

Risk treatment: accepted by trust assumption. A compromised security oracle is a foundational supply-chain compromise. Pilot relies on OSV as a source of vulnerability truth. A hostile oracle defeats the defence outright. Transport, parsing, validation, and last-good-database controls mitigate tampering in transit, malformed payloads, and update outages. They cannot make a hostile source of truth trustworthy.

## Threat 102: Accidental permanent deletion of registry data

- **Elements**: Écluse Dredger
- **Category**: Elevation of privilege (STRIDE)
- **Severity**: Critical
- **Status**: Open

**Description**

Dredger issues permanent hard deletions against the mirror registry. Misconfigured, or pointed at the wrong registry, it destroys data permanently.

**Mitigation**

Dredger must verify explicit operator consent before it runs any destructive action. It is required to query the target CodeArtifact repository for a specific resource tag, for example `Dredger: PermanentDeletionAllowed`, and to fail closed without that tag. It must also refuse to boot when mounts.<eco>.mirrorTarget and mounts.<eco>.publicationTarget resolve to the same registry.
