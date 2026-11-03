# ARCADIA PS2 — Web emulation

Original dark-themed front end with a **real Play! WebAssembly emulator**. The Play! open-source engine implements a high-level BIOS; no external BIOS is required or supported. Not all PS2 games work, and the web port is experimental.

## Setup and test

Run `bash fetch-engine.sh`. This retrieves Play.js, Play.wasm, License.txt and coi-serviceworker.js from a public distribution, and builds a `dist/` directory. Then run `python3 -m http.server 8080 --directory dist` and open http://localhost:8080 (do not open `index.html` with file://). One reload may be needed for COOP/COEP via service worker.

## Deploy

For Vercel, import the project and set root to `arcadia-ps2` (if stored in a monorepo): the `build` script runs `fetch-engine.sh`, and Vercel serves `dist`. For GitHub Pages, turn on Pages → Source: GitHub Actions and use the supplied workflow (adjust the job path if placed in a subfolder). Large WASM files are downloaded during builds, not committed.

## Controls

D-pad: arrows, left analog: T/F/G/H, right analog I/J/K/L, square A, cross Z, triangle S, circle X, Start Enter, Select Backspace, L1/L2/L3: 1/2/3, R1/R2/R3: 8/9/0. Gamepad and on-screen touch supported by browser shell.

## Legal and technical notes

No games, BIOS images, or commercial discs are provided. You supply your own lawful disk images; they stay local to your browser. The engine is from [Play!](https://github.com/jpd002/Play-), with prebuilt assets obtained from [ps2-web](https://github.com/alekseichmsk/ps2-web), which documents their provenance and original Play! licensing. Respect upstream notices and licenses. The PS2 and PlayStation names belong to their owners. ARCADIA is an independent interface, not endorsed by Sony.

This source ZIP excludes the large WASM binaries because this execution environment cannot retrieve external files; `fetch-engine.sh` is required prior to launch. Game execution has **not been end-to-end verified in this environment**.