# Design System Document

## 1. Overview & Creative North Star

### Creative North Star: "The Arcane Archivist"
This design system is not a standard dashboard; it is a high-performance, neo-occult terminal designed for the hyper-logical yet chaotic world of high-level Magic: The Gathering play. It rejects the "bubbly" friendliness of modern SaaS in favor of **Organic Brutalism**—a style defined by razor-sharp edges (0px radii), information density, and the cold precision of a command-line interface, interrupted by "leaks" of raw magical energy (Izzet Blue and Red).

To break the "template" look, we utilize **intentional asymmetry**. Align data-heavy columns to the left while allowing expressive typography to bleed off-grid or overlap container boundaries. We treat the screen as a digital grimoire where logic (the terminal) and power (the magic) coexist.

---

## 2. Colors & Surface Logic

The palette is rooted in a deep, nocturnal base to allow the "Izzet" spectrum to vibrate with intensity.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for defining layout sections. Instead, boundaries must be established through **Tonal Shifting**. A section is defined by moving from `surface` (#111318) to `surface_container_low` (#1a1c20). This creates a sophisticated, seamless environment that feels like a single, cohesive instrument rather than a collection of boxes.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers. 
- **Base Layer:** `surface_dim` (#111318).
- **Secondary Content:** `surface_container` (#1e2024).
- **Interactive/Raised Elements:** `surface_container_high` (#282a2e).
- **Active Terminal Prompts:** `surface_container_highest` (#333539).

### The "Glass & Gradient" Rule
To elevate the experience from "flat" to "premium," floating overlays (like card previews or stack details) should utilize **Glassmorphism**. Use `surface_variant` at 60% opacity with a `40px` backdrop blur. 
- **Signature Texture:** Apply a subtle linear gradient to primary CTAs, transitioning from `primary_container` (#0d52bd) to `primary` (#b1c5ff) at a 45-degree angle. This provides a "soul" to the color that feels like glowing mana.

---

## 3. Typography

The typographic system is a triad of contrasting personalities: the expressive (Syne), the functional (Plus Jakarta Sans), and the technical (JetBrains Mono).

| Level | Token | Font Family | Character |
| :--- | :--- | :--- | :--- |
| **Display** | `display-lg/md/sm` | **Syne** | Bold, wide, and expressive. Use for life totals and phase changes. |
| **Headline** | `headline-lg/md/sm` | **Syne** | Authoritative. Use for card names and section headers. |
| **Title** | `title-lg/md/sm` | **Plus Jakarta Sans** | Professional and clean. Use for modal titles and list categories. |
| **Body** | `body-lg/md/sm` | **Plus Jakarta Sans** | High readability. Use for card Oracle text and flavor text. |
| **Label** | `label-md/sm` | **JetBrains Mono** | The "Terminal" heart. Use for mana costs, power/toughness, and timestamps. |

**Hierarchy Note:** Use `JetBrains Mono` in `all-caps` for metadata to reinforce the sense of a high-speed data stream.

---

## 4. Elevation & Depth

We achieve hierarchy through **Tonal Layering** and light, not through structural shadows.

- **The Layering Principle:** Depth is created by "stacking." Place a `surface_container_lowest` card on a `surface_container_low` background to create a "recessed" look. Place a `surface_bright` element on a `surface_dim` background to "lift" it.
- **Ambient Shadows:** For high-priority floating elements, use an extra-diffused shadow. 
    - *Value:* `0px 20px 50px rgba(0, 0, 0, 0.5)`. 
    - *Tinting:* Incorporate 4% of the `primary` color into the shadow to mimic the glow of the interface reflecting off the background.
- **The "Ghost Border" Fallback:** If containment is absolutely necessary (e.g., in a dense data grid), use a **Ghost Border**. This is a 1px stroke using the `outline_variant` token at **15% opacity**. It should feel like a faint memory of a border, not a hard line.
- **Mana Glows:** Critical interactive elements should have an outer `box-shadow` glow using `primary` or `secondary` at 20% opacity to simulate magical radiance.

---

## 5. Components

### Buttons
- **Primary:** Filled with `primary_container`. Text in `on_primary_container`. 0px border-radius.
- **Secondary (Ghost):** 1px border using `primary` at 30% opacity. Text in `primary`.
- **States:** On hover, primary buttons should "flare," increasing the glow opacity and shifting the background color toward `primary`.

### Input Fields
- **Terminal Style:** No background fill. Only a 1px `ghost border` at the bottom (underline style).
- **Active State:** The bottom border transforms into a 2px `primary` solid line with a subtle 4px blur glow. Label uses `JetBrains Mono`.

### Cards (The "Grimoire" Card)
- **Structure:** No dividers. Separate the card image, name, and rules text using 16px or 24px vertical spacing from the spacing scale.
- **Interaction:** On hover, the card "lifts" by shifting from `surface_container_low` to `surface_container_high`.

### Specialized Components
- **The Stack Monitor:** A vertical list of spells using `surface_container_lowest` with `JetBrains Mono` labels. Each item is separated by an 8px gap (which aligns with `spacing: 2` scale).
- **Mana Pips:** Circular elements are forbidden. Use square or diamond-shaped containers (0px radius) to house mana symbols, maintaining the brutalist terminal aesthetic.

---

## 6. Do's and Don'ts

### Do
- **Embrace Density:** MTG is complex. Use `body-sm` and `label-sm` to keep data visible without scrolling.
- **Maintain Sharpness:** Every corner must be `0px`. Rounding breaks the "terminal" immersion.
- **Use Intentional Asymmetry:** Offset your headers or use "staggered" grid layouts to make the app feel bespoke and editorial.
- **Utilize Spaciousness:** Embrace a `spacious` feel to ensure complex information remains legible and to prevent visual clutter, aligning with the "editorial" aspect of the digital grimoire.

### Don't
- **Don't use Dividers:** Avoid horizontal rules (`<hr>`). Use spacing and background color shifts to separate content.
- **Don't use Pure White:** Use `on_surface_variant` (#c3c6d5) for secondary text to reduce eye strain in this dark-mode environment.
- **Don't Over-Glow:** Glows are for *emphasis* (a spell on the stack, a low life total). If everything glows, nothing is magical.