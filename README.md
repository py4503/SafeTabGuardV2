# SafeTabGuard V2

SafeTabGuard V2 is a privacy-first browser security suite and real-time analytics dashboard. It combines lightweight heuristic scanning with on-demand AI analysis to block trackers, phishing attempts, and malware before they load, without compromising browser performance.

### Core Capabilities & Architecture Upgrades

* **The V1 Security Foundation:** Retains all core baseline protections, including instant malicious URL blocking, real-time local heuristic scanning, and interactive threat warning pages.
* **WebRTC IP Leak Protection (V2):** Intercepts and masks local and public IP addresses from being stealthily exposed through WebRTC STUN/TURN server requests.
* **Advanced Anti-Fingerprinting (V2):** Utilizes domain-seeded Canvas API poisoning to permanently defeat cross-site tracking without breaking site functionality or triggering Cloudflare bot-defenses.
* **Smart AI Orchestration (V2):** An optimized engine where heuristics handle the heavy lifting; API-heavy AI DOM analysis is dynamically triggered *only* when "Strict Mode" is enabled or complex threats are detected, drastically saving LLM token overhead.
* **Resilient Telemetry Sync (V2):** A bulletproof backend connection using Chrome Alarms and JIT (Just-In-Time) execution to ensure offline-installed devices are perfectly registered and threat logs are never orphaned.
* **Unified React Dashboard (V2):** A completely redesigned, SOC-style dark-mode dashboard featuring real-time telemetry, zero-filled time-series aggregation (via Recharts), and an immutable threat ledger backed by a custom Node.js/MongoDB pipeline.
