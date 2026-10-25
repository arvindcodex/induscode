# UI/UX Design Engineering & Anti-Slop Frontend Standard

When creating, designing, refactoring, or reviewing web applications, landing pages, or frontend components, follow this high-craft standard derived from OpenDesign, Taste-Skill, and Emil Kowalski's Design Engineering.

---

## 1. Brief Inference & Aesthetic Direction
Before generating UI code:
1. **Infer the Audience & Context**:
   - Technical B2B / SaaS (Linear-clean, refined typography, subtle borders, high utility).
   - Premium Consumer / Agency (Awwwards-tier, spatial depth, editorial contrast, artistic layouts).
   - Minimalist / Document (Notion/Substack-style, warm monochrome, serif headings, high readability).
   - Industrial / Telemetry (Swiss grid, monospace data density, technical borders, stark contrast).
2. **Set the Visual Dials**:
   - `DESIGN_VARIANCE`: 5-6 (clean/symmetric) to 8-9 (creative bento / artistic split).
   - `MOTION_INTENSITY`: 3-4 (restrained micro-interactions) to 6-7 (fluid springs, tactile states).
   - `VISUAL_DENSITY`: 3-4 (airy, spacious) to 6-8 (dense dashboard/editor).

---

## 2. The Anti-AI-Slop Directives (Strict Rules)
Avoid generic LLM defaults that scream "AI-generated":
- **NO Default Purple/Blue Gradients**: Do not wrap every hero section in generic purple/indigo gradients or dark radial meshes. Pick intentional palettes.
- **NO Generic 3-Column Feature Cards**: Avoid 3 identical square cards with centered generic icons. Use asymmetrical Bento grids, variable card spans, and distinct visual treatments.
- **NO Raw Black/White**:
  - Dark mode: Use tinted charcoals (`#09090b`, `#0d0d10`, `#121214`), never `#000000`.
  - Light mode: Use warm paper/bone tones (`#fafaf9`, `#fdfbf7`, `#f8f9fa`), never harsh `#ffffff` on pure `#ffffff`.
- **NO Harsh Shadows**: Never use generic dark drop shadows (`rgba(0,0,0,0.3)`). Use ultra-diffuse ambient shadows (`box-shadow: 0 8px 30px rgba(0,0,0,0.04)`) or crisp micro-borders (`border border-white/10` or `border-black/5`).
- **NO Browser Default Fonts**: Never output unstyled system fonts or standard Inter everywhere. Pair characterful fonts:
  - Display/Headlines: `Geist Sans`, `Cabinet Grotesk`, `Outfit`, `Satoshi`, `Clash Display`, or editorial serifs like `Instrument Serif` / `Playfair Display`.
  - Monospace/Data: `Geist Mono`, `JetBrains Mono`.
- **NO Placeholders or AI Cliches**: Never use "Lorem Ipsum", "John Doe", or words like "Elevate", "Unleash", "Seamless", "Next-Gen". Write real, contextual copy.

---

## 3. Typographic Craft
- **Headlines**: Use large scale contrast (`clamp(2rem, 5vw, 4.5rem)`), tighter leading (`leading-[1.1]`), and negative tracking (`tracking-[-0.03em]`).
- **Body Text**: Limit line width to ~65 characters (`max-w-prose`), comfortable line-height (`leading-relaxed` / 1.6).
- **Labels & Caps**: When using uppercase labels or badges, always apply positive tracking (`tracking-wider` / `0.05em`).
- **Tabular Figures**: For numbers, stats, and prices, enable `tabular-nums` (`font-variant-numeric: tabular-nums`).

---

## 4. Animation & Interaction Discipline (Emil Kowalski)
- **Never use `transition: all`**: Always specify explicit transition properties:
  - Good: `transition: transform 150ms ease-out, opacity 150ms ease-out, background-color 150ms ease`
  - Bad: `transition: all 300ms`
- **Tactile Active Feedback**: All buttons, links, and cards must feel physically responsive:
  - Use `:active:scale-[0.98]` or `:active:scale-[0.96]` for instant touch feedback.
- **Natural Entrances**:
  - Elements should never appear from nothing (`scale(0)` is banned).
  - Use `transform: scale(0.95); opacity: 0` entering to `scale(1); opacity: 1`.
- **Easing**:
  - Entrances: snappy `ease-out` or spring curves (`cubic-bezier(0.16, 1, 0.3, 1)`).
  - Exits: fast `ease-in` or instant dismissal.
  - Hover transitions: 150ms–200ms maximum. Never make the user wait for an animation to finish.

---

## 5. Available Skills & Reference Library
Full OpenDesign skills and reference implementations are installed in `.agents/skills` and `~/.agents/skills`:
- `taste-skill`: Comprehensive anti-slop frontend design guidance.
- `emil-design-eng`: UI polish philosophy, component design, and micro-interactions.
- `ui-animation`: Springs, gestures, clip-paths, scroll triggers, transition recipes.
- `motion-design`: Pacing, visual continuity, kinetic choreography.
- `brandkit`: Identity boards, palettes, typography hierarchies.
- `redesign-skill`: Auditing and upgrading existing sites.
- `soft-skill`: High-end agency aesthetic (glass, luxury, bento).
- `brutalist-skill`: Industrial Swiss brutalism and technical telemetry.
- `minimalist-skill`: Utilitarian warm monochrome minimalism.
- `image-to-code-skill`: Replicating visual designs accurately.
- `design-systems/`: 150+ design system tokens and specs (Apple, Airbnb, Stripe, Linear, Vercel, Claude, etc.) under `.agents/design-systems`.

---

## 6. Mandatory Modular Architecture (HTML, CSS, JS Separation)
When building any website, landing page, or web project in HTML/CSS:
- **STRICT PROHIBITION**: NEVER inline or embed CSS inside `<style>` tags in HTML. NEVER bundle JavaScript inside `<script>` in HTML unless the user explicitly requests a single-file template.
- **MANDATORY SEPARATE FILES**: Always generate and save dedicated files:
  1. `index.html`: Clean, semantic HTML5 structure. Must link `style.css` via `<link rel="stylesheet" href="style.css">` and `script.js` via `<script src="script.js" defer></script>`.
  2. `style.css`: Dedicated external stylesheet containing CSS variables (`:root`), typography, responsive layout (grid/flexbox), animations, and media queries.
  3. `script.js`: Dedicated JavaScript file for interactive functionality, DOM events, animations, and micro-interactions.
- **STANDARD ENTRYPOINT**: Unless the user specifically asks for a custom filename, the primary page MUST ALWAYS be named `index.html` (NEVER arbitrary names like `iphone15.html`, `test.html`, `page.html`). This ensures the project runs immediately when opened or served.

---

## 7. Immediate Execution & Disk Saving (Zero Stalling)
- **NO BLOCKING QUESTIONS**: When asked to build, create, or implement code, NEVER pause to ask "which model, which color, what design direction?". Make executive, premium, high-taste decisions and start building immediately.
- **IMMEDIATE DISK PERSISTENCE**: Always invoke the `editor` tool in your very first response to save all files directly into the workspace root (`CWD`).
- Never describe code in chat without saving it to disk first. The user should never have to ask "did you save it?" or "hua bhai".
