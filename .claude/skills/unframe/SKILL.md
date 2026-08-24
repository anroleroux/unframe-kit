---
name: unframe
description: >-
  Build a small web app the "unframe" way — no framework, plain JS with a ~120-line
  Proxy-based reactivity core, HTML/CSS/JS components composed into a single static
  index.html by an awk-based Makefile, and an online/offline build toggle. Use this
  when the user wants to scaffold or extend a lightweight single-file web UI, add a
  reactive component, wire local-storage persistence, or set up the make-based
  single-file build. Reflects anroleroux's personal app-building conventions.
---

# unframe — building apps with no framework

This skill describes a specific, opinionated way to build small web apps: **plain
HTML/CSS/JS, zero npm dependencies, zero framework, one static `index.html` output.**
Reactivity comes from a ~120-line Proxy core; the build is an `awk` macro driven by a
Makefile. Follow these conventions when scaffolding or extending an app in this style.

The reusable runtime lives next to this file in `runtime/` (`reactivity.js`,
`tpl.mk`). Treat those as the source of truth — copy or submodule them, don't rewrite
them.

## The mental model

An app is a set of **components**, each a plain `.js` file, plus a **layout** that
declares where components and shared assets get inlined. A Makefile runs an `awk`
**composer** that replaces placeholder tokens in the layout with the contents of
mapped files, producing a single `dist/index.html` (with CSS and JS inlined). There is
no bundler, no transpile step, no runtime dependency fetch.

```
ui/
  layout.html      layout.css      layout.js      reactivity.js   ← shells + core
  comps/
    products.js    categories.js   ...                            ← one file per component
  dist/
    index.html  index.css  index.js                               ← generated, single-file
make/
  tpl.mk           ← the compose macro (from runtime/tpl.mk)
  web.map          ← token → file mapping
Makefile           ← build targets
```

## Reactivity: `reactive()` + `mount()`

`runtime/reactivity.js` gives you two primitives. Do not reach for a framework; use
these.

- **`reactive(obj, onChange)`** wraps an object in a `Proxy`. Any `set`/`delete` on it
  (or a nested object) calls `onChange`. The property `_draft` is exempt — it holds
  in-flight edit text without forcing a re-render.
- **`mount(root, state, templateFn)`** creates a reactive state object, renders
  `templateFn(state)` into `root.innerHTML`, and re-renders on every state mutation.
  It returns the reactive object; assigning to that object *is* how you update the UI.

A component follows this exact shape:

```js
// 1. A pure template: state in, HTML string out. No side effects.
function productsTemplate(state) {
    if (state.selected) return detailTemplate(state.selected);
    if (state.adding)   return addFormTemplate();
    return state.list.map(rowTemplate).join("");
}

// 2. Mount once, into a global named after the component.
var products = mount(
    document.getElementById("products-list"),
    { list: [], selected: null, adding: false, editing_field: null },
    productsTemplate
);

// 3. Handlers mutate the global; the mutation triggers the re-render.
function selectProduct(i) { products.selected = products.list[i]; }
```

Conventions that make this work:
- The mount global is named for the component (`products`, `categories`) and is
  referenced from inline `onclick=`/`oninput=` handlers by that name.
- Templates are **pure string builders** — never touch the DOM inside them; let
  `mount`'s `render()` own `innerHTML`.
- Inline-editable fields use the `editableField()` / `beginEdit` / `saveField` /
  `cancelEdit` helpers in `reactivity.js`, with `_draft` holding the unsaved value and
  `editing_field` naming the field currently in edit mode.

## The single-file build (composer)

`runtime/tpl.mk` defines one make macro:

```
$(call compose, SOURCE, MAP, OUTPUT)
```

It reads `MAP` (lines of `token:filepath`), then streams `SOURCE` line by line; when a
line contains a token, it splices in that file's contents **preserving the source
line's indentation**, otherwise it passes the line through. Output goes to `OUTPUT`.

The layout files carry the tokens:

- `layout.html` has `/*{{layout-css}}*/` inside `<style>` and `// {{layout-js}}` inside
  `<script>` — so the final HTML inlines all CSS and JS into one file.
- `layout.js` has `/* {{reactivity-js}} */` then one `/* {{component}}-js */` token per
  component, in load order.
- `web.map` maps every token to its file.

To add a component `foo`:
1. Create `ui/comps/foo.js` with a `fooTemplate`, a `mount(...)` into `var foo`, and
   its handlers.
2. Add a `<section id="page-foo">` (and nav button) to `layout.html`.
3. Add `/* {{foo-js}} */` to `layout.js` and `{{foo-js}}:ui/comps/foo.js` to `web.map`.
4. `make` — the token gets inlined into `dist/index.js` and then into `dist/index.html`.

Wildcard prerequisites (`$(wildcard ui/comps/*.js)`) mean the build re-runs when any
component changes; no manifest to maintain beyond `web.map`.

## Online / offline build modes

Data code is written **online-first**, then the online paths are wrapped in markers so
a build can strip them:

```js
async function loadProducts() {
    //online-start
    ... fetch("/api/products") ...   // stripped by `make uidev`
    return;
    //online-end
    products.list = loadLocal("products");   // the offline fallback runs
}
```

- `//online-start` … `//online-end` — a block deleted in offline builds.
- `//online` — a single trailing-comment line deleted in offline builds.
- The `uidev` / `TRX` target runs `sed` to delete those, leaving a pure
  **localStorage** app driven by `loadLocal` / `saveLocal` / `nextLocalId` (defined in
  `layout.js`). This is what deploys to GitHub Pages — a working demo with no backend.

Mode flags are tracked as letters in the target name:
`T` unit testing · `R` readable (unminified) web content · `G|S` back-end kind
(e.g. Go / SQL). `XXX` / `TRX` = the flag combination for a given build.

## When scaffolding a new app

1. Copy `runtime/reactivity.js` → `ui/reactivity.js` and `runtime/tpl.mk` → `make/tpl.mk`
   (or submodule this kit and reference them — see the kit README).
2. Create `ui/layout.html`, `layout.css`, `layout.js` with the placeholder tokens.
3. Add `make/web.map` and a `Makefile` that `include make/tpl.mk` and calls
   `$(call compose, …)` for html/css/js, plus a `uidev` target that `sed`-strips the
   online blocks.
4. Add one file per component under `ui/comps/`.
5. Build with `make`; deploy `ui/dist/` as static files.

Keep it dependency-free. If a task tempts you toward a framework, a bundler, or an npm
runtime dep, stop — the whole point of this style is that the output is one static file
and the toolchain is `make` + `awk` + `sed`.
