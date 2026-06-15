# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A proof-of-concept that drives a 0.96" SSD1306 OLED (128×64, I2C) using SolidJS JSX components with reactive signals. JSX compiles to a custom pragma (`oled.jsx`) that builds an element tree, which is recursively walked to call C driver functions via FFI (`koffi`). Target platform: Raspberry Pi (ARM64 Linux).

## Commands

```bash
# Node.js demos (OLED hardware required)
npm start              # CounterApp demo (counter + moving pixels)
npm run start:clock    # ClockApp demo (Chinese locale real-time clock)

# C-only demo (no Node.js needed)
make && make run       # Compile and run demo.c; displays "Hello OLED!" + one pixel

# Compile C shared library (if recompiling for a different arch)
cd oled_96 && make -f makefile && cd ..
# Or manual cross-platform: gcc -fPIC -shared -o liboled96.so oled96.c fonts.c -lpthread -lm
```

There is no test suite or linter configured.

## Architecture

Five-layer stack, top to bottom:

1. **JSX source** (`src/app.jsx`, `src/components.jsx`) — SolidJS components using `<Screen>`, `<Text>`, `<Pixel>`. Components must return `() => JSX` (a getter function), NOT JSX directly — `createSignal` calls go outside the returned function so they execute once.

2. **Custom JSX runtime** (`src/oled-renderer.js`) — Babel compiles JSX to `oled.jsx(Component, props, children)`. The `jsx()` factory function either calls component functions (uppercase) or creates `{type, props, children}` descriptor objects (lowercase built-ins). `renderElement()` switches on `el.type` (`'screen'`, `'text'`, `'pixel'`) and calls the corresponding C functions.

3. **FFI bridge** (`src/bindings.js`) — Uses `koffi` to load `oled_96/liboled96.so` and declare C function signatures. Exports: `oledInit`, `oledShutdown`, `oledFill`, `oledWriteString`, `oledSetPixel`, plus font constants (`FONT_NORMAL=0`, `FONT_BIG=1`, `FONT_SMALL=2`).

4. **C driver** (`oled_96/`) — Larry Bank's SSD1306 I2C driver (`oled96.c/.h` + `fonts.c`). Functions write directly to I2C; there is no separate flush step.

5. **Hardware** — SSD1306 128×64 OLED at I2C address `0x3C` on bus 1.

### Entry point

`src/run.js` registers `@babel/register` for `.jsx` compilation, then loads `src/run.jsx`. `run.jsx` picks an App component based on `process.argv[2]` and calls `oled.render(() => <App />)`.

### Reactive rendering flow

```
oled.render(code)
  → oledInit() once
  → const getTree = code()        // runs App once — creates signals + intervals
  → createRoot(dispose =>
      createRenderEffect(() => {   // tracks signals, runs synchronously (not rAF-based)
        oledFill(0)                // clear screen
        const tree = getTree()     // re-read signals → fresh JSX tree
        renderElement(tree)        // walk tree → C draw calls
      })
    )
  → signal changes → effect re-runs → screen updates
```

Renders are full-frame (no diffing) — 1024 bytes over I2C at 400kHz takes ~25ms, so flicker is imperceptible.

## Key design decisions & gotchas

- **`solid-js/dist/solid.cjs` is required**, NOT `solid-js`. The default export resolves to `server.cjs` (SSR stub) whose `createEffect` is a no-op.
- **`createRenderEffect`** is used instead of `createEffect` because `createEffect` schedules via `requestAnimationFrame` (absent in Node.js). `createRenderEffect` runs synchronously.
- **`koffi`** was chosen over `ffi-napi` because `ffi-napi`'s C++ code fails to compile on Node 20 + ARM64.
- **Classic JSX runtime** with custom pragma was chosen over `babel-preset-solid`'s universal mode, which requires a full reconciler interface (insert/setProp/effect/spread/memo) — overkill for a 1KB framebuffer.
- **App components must return `() => JSX`**, not JSX directly. Returning JSX directly causes `createSignal` + `setInterval` to run on every render cycle, leaking signals and causing display corruption (racing between correct/incorrect states).

## Adding a new built-in element

1. Define a component wrapper in `src/components.jsx` that returns the lowercase element.
2. Add a `case` to the `switch (el.type)` in `renderElement()` in `src/oled-renderer.js`.
3. If needed, add a new C function binding in `src/bindings.js` and potentially extend the C library.
