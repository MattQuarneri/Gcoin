# Code Visualization Patterns — a visual grammar for reflective code reading

*Matthew, 2026-10-23. Goal: an interactive HTML document that lets a
non-technical reader understand the **logical flow of action** in code —
who calls what, what changes, and **why** — without reading the code itself.*

The tool reads code **reflectively**: it instantiates (or statically models)
the program's objects, links them through their call graph, and renders them
as living SVG. Meaning is carried by **consistent visual patterns**: the same
logical action always looks the same, everywhere, so a reader learns the
grammar once and can then follow any program.

---

## 1. The object grammar (things)

| Code thing | Collapsed form | Expanded form | Notes |
|---|---|---|---|
| **Object / instance** | Circle with icon + name | Rounded box | Click = semantic zoom in/out; the SVG canvas grows/shrinks to fit |
| **Class / type** | Circle, double ring | Box with a "blueprint" header band | Instances link to their class with a faint `is-a` thread |
| **Property** | — (hidden) | **Pill** (rounded capsule) inside the box: name left, value right | Value changes animate (§2, Write) |
| **Method** | — (hidden) | **Row bar** hanging off a left spine, like comb fronds: name + parameter pills | Rows are the launch points for calls |
| **Parameter** | Small pill riding on a call pulse | Pill docked in the method row | A value you can watch travel |
| **Collection** | Circle with stacked-ring badge | Box whose rows repeat; count badge | Iteration animates row by row (§2, Loop) |
| **Module / file** | Large soft container region | Region containing its objects | Collapses to a labeled chip at far zoom |

Layout rule: an expanded object is a **comb** — a vertical spine, property
pills on top, method fronds below. Every expanded object in every program
has the same anatomy, so the eye learns where things live.

## 2. The action grammar (verbs → SVG animation)

Each pattern has: a **trigger** (what code event it renders), a **motion**,
and a **why-bubble template** (the plain-language explanation shown while it
plays; `{slots}` fill from the actual code).

| # | Pattern | Code event | Motion | Why-bubble template |
|---|---|---|---|---|
| A1 | **Call** | `a.m(x)` | A pulse carrying parameter pills travels the edge from caller's method row to callee's row; callee glows | “{caller} asks {callee} to {method}, handing it {params} — because {reason}.” |
| A2 | **Return** | `return v` | A thinner pulse travels back, carrying the result pill, which docks in the caller | “{callee} answers with {result}, which {caller} keeps as {name}.” |
| A3 | **Create** | `new X()` / factory | A new circle blossoms out of the creator, umbilical thread to its class, then settles | “A new {class} is born here — its own {props}, independent of the others.” |
| A4 | **Read** | property get | The property pill flashes; a ghost copy slides along the read path to the reader | “{reader} peeks at {object}.{prop} (currently {value}) without changing it.” |
| A5 | **Write** | property set | The pill fills with new color; old value fades, new value types in | “{object}.{prop} changes from {old} to {new} — this is the moment the state changes.” |
| A6 | **Branch** | `if / else` | The flow path forks; the untaken branch greys and its gate closes, the taken one opens | “The condition ‘{condition}’ is {true/false}, so we go this way — the other path is skipped this time.” |
| A7 | **Loop** | `for / while` | A circular track around the body; a bead travels it once per iteration, counter ticking; body rows light in rhythm | “We repeat {body} for each {item} — watch the bead: {n} times.” |
| A8 | **Transform** | `map / filter / reduce` | Dots (items) stream through a lens/funnel: reshaped (map), some dropped (filter), merging into one (reduce) | “Each item passes through {fn}: {kept} of {total} come out the other side.” |
| A9 | **Async / wait** | `await`, promise, callback | The pulse travels, then *parks* in a dashed waiting ring; the caller dims (“meanwhile…”); on completion the ring fills and the return pulse fires | “{caller} has to wait for {thing}. Nothing is stuck — other work can happen until it lands.” |
| A10 | **Emit / listen** | event, subscription | Concentric rings radiate from the emitter; every listener node ripples as the ring reaches it | “{emitter} announces ‘{event}’ — it doesn't know or care who is listening; {n} listeners react.” |
| A11 | **Throw / error** | `throw`, rejection | A jagged red pulse bursts backward up the call chain until a `catch` net (drawn as a basket) stops it, or it reaches the top and the frame shakes | “Something failed in {method}: {message}. The failure travels back up the chain until someone handles it.” |
| A12 | **Recurse** | self-call | The object spawns a smaller copy of itself inside itself, Russian-doll style, depth counter running | “{method} calls *itself* on a smaller piece — each doll must finish before the one around it can.” |
| A13 | **Pass / hand-off** | value moved between owners | The pill physically leaves one box and docks into the other; the source slot empties | “Ownership moves: {object} no longer has {thing}; {other} does.” |
| A14 | **Checkpoint / commit** | save, sign, anchor | A wax-seal stamp lands on the object; a hash thread ties it to the ledger/anchor point | “This moment is sealed: {what} is now permanent and provable.” |

Color is grammatical too: **amber** = a value traveling, **teal** = control
flow (calls/returns), **violet** = creation, **red** = failure, **grey** =
skipped/inactive. A reader who knows the colors can follow a program's
story at a glance.

## 3. Explanation bubbles (the “why” layer)

- Every pattern instance carries a bubble; bubbles appear **while the motion
  plays**, anchored to the acting object, and persist in a side “story so
  far” log so the whole flow can be re-read as prose afterward.
- Bubbles are **templates over facts**, never freehand per program: the
  reader sees the same sentence shapes everywhere, with the actual names and
  values filled in.
- Three reading depths, reader's choice: **Story** (bubbles only, no code),
  **Guided** (bubbles + the method row highlighted), **Source** (the actual
  code fragment shown inside the expanded object — the Code Bubbles move).

## 4. How the reader gets built (architecture)

1. **Reflective reader** — two sources of truth, merged:
   - *Static:* parse JS with an AST parser (Acorn) → classes, methods,
     parameters, call sites → the call graph skeleton.
   - *Live:* run the program instrumented (Proxy-wrapped objects / traced
     calls) → real values, real order, real branches taken. This is what
     makes it *reflective*: the objects on screen are the program's objects.
2. **Model** — a uniform node/edge graph: nodes = objects/classes/methods;
   edges = calls / reads / writes / creates / listens. Each edge is tagged
   with its pattern ID (A1–A14), so rendering is table-driven.
3. **Renderer** — one SVG, semantic zoom (circle ⇄ comb box), animated
   layout (the canvas grows/shrinks as objects expand). Edges re-anchor to
   the *current* shape of their endpoints. Playback: story mode steps
   through a recorded trace; every step fires its pattern's motion + bubble.
4. **Narration** — bubble templates (§3) filled from the trace; the story
   log exports as plain prose — the non-technical deliverable.

## 5. What exists already (and the gap)

- **Code Bubbles** (Bragdon et al., Brown, 2010; also VS Debugger Canvas):
  code fragments as bubbles with call-stack traversal — for programmers,
  Java/IDE-bound, no narration.
- **Python Tutor** (Guo): step-through execution, objects as boxes with
  arrows — the closest “watch it happen” tool; linear, small programs.
- **Sourcetrail** (2016–2021, archived): interactive dependency graph next
  to source — static structure only, no flow, no story.
- **AppMap / CodeSee**: runtime-recorded dependency & sequence diagrams —
  engineering telemetry, not explanation.
- **Code City / CodeCharta**: codebases as cities — scale metaphor, no flow.
- **Explorable explanations** (Bret Victor's *Learnable Programming* et al.):
  the philosophy — reactive, visual, narrative — proven for articles and
  simulations, never generalized into a code reader.

**The gap is the combination**: reflective + call-graph traversal + one
consistent action grammar + why-bubbles for non-technical readers. Each
piece exists somewhere; nobody ships them together. That's the build.

## 6. Prototype 1 (this folder)

`reflective-reader-demo.html` — a hand-modeled miniature (a Gcoin wallet:
Wallet, Coin, Strand, Accountant) demonstrating the object grammar (§1),
call/return pulses with parameter pills (A1/A2), write/read pills (A4/A5),
story playback with why-bubbles and a story log (§3), plus a pattern stage
showing all 14 action patterns (§2) as living glyphs. Next step after
review: feed it a real trace from the actual wallet code.
