# Render SolidJS to OLED

> 用 SolidJS 响应式 UI 驱动 0.96" SSD1306 OLED 显示屏的概念验证项目

Write JSX components (`<Text>`, `<Pixel>`, `<Screen>`), let SolidJS signals handle reactivity, and watch your OLED update automatically. The bottom layer talks to I2C hardware via FFI (`koffi` → C shared library).

```
┌─────────────────────────────────────────────┐
│  src/app.jsx          SolidJS components    │
│  src/components.jsx   JSX UI elements       │
│  src/oled-renderer.js Custom JSX → OLED     │
│  src/bindings.js      koffi FFI bridge      │
├─────────────────────────────────────────────┤
│  oled_96/liboled96.so C shared lib (ARM64)  │
│               ↓ I2C                         │
│        SSD1306 OLED display                 │
└─────────────────────────────────────────────┘
```

## Hardware

| Item | Detail |
|------|--------|
| **Board** | Raspberry Pi (ARM64) or any Linux SBC with I2C |
| **Display** | 0.96" SSD1306 OLED, 128×64, I2C |
| **Wiring** | VCC→3.3V, GND→GND, SDA→GPIO2, SCL→GPIO3 |
| **OS** | Linux ARM64, I2C enabled (`raspi-config` → Interface Options) |

```bash
sudo i2cdetect -y 1   # should show 0x3C
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the C library (if liboled96.so is missing or wrong arch)
cd oled_96 && make -f makefile && cd ..

# 3. Run
npm start             # Counter + moving pixels
npm run start:clock   # Real-time clock (Chinese locale)
```

Press `Ctrl+C` to exit (screen shuts down cleanly).

## Project Structure

```
render-solidjs-to-oled/
├── src/
│   ├── run.js              # Entry: registers Babel, loads run.jsx
│   ├── run.jsx             # Picks App component, calls oled.render()
│   ├── app.jsx             # CounterApp / ClockApp
│   ├── components.jsx      # <Screen>, <Text>, <Pixel> wrappers
│   ├── oled-renderer.js    # Custom JSX runtime + render engine
│   └── bindings.js         # koffi FFI — maps C functions to JS
├── oled_96/                # C OLED driver (Larry Bank)
│   ├── oled96.c / .h       # SSD1306 I2C driver
│   ├── fonts.c             # Font data (6×8, 8×8, 16×24)
│   └── liboled96.so        # Prebuilt ARM64 shared library
├── demo.c                  # Standalone C demo (no Node.js)
├── Makefile                # Build C demo
├── .babelrc                # JSX → oled.jsx() compilation
├── package.json
└── docs.html               # Architecture diagram (HTML)
```

## How It Works

### JSX → OLED Pipeline

1. **Babel** compiles JSX to `oled.jsx(Component, props, children)` calls
2. **Custom jsx runtime** (`oled-renderer.js`) builds an element tree
3. **FFI bridge** (`bindings.js`) exposes C functions via `koffi`
4. **Reactive render** — `createRenderEffect` tracks SolidJS signals; when a signal changes, the tree is rebuilt and redrawn onto the OLED

### Reactive Rendering Flow

```
npm start
  → run.js: register Babel
  → run.jsx: pick App
  → oled.render(() => <CounterApp />)
    → oledInit()
    → createRoot()
      → createRenderEffect()
        → oledFill(0)         // clear
        → getTree()           // read signals → fresh JSX tree
        → renderElement(tree) // walk tree → C draw calls
    → signal changes → effect re-runs → screen updates
```

Renders are full-frame (no diffing). 1024 bytes over I2C at 400 kHz takes ~25 ms — flicker is invisible.

## Available Components

| Component | Props | Notes |
|-----------|-------|-------|
| `<Screen>` | `children` | Root container (no rendering) |
| `<Text>` | `x`, `y`, `font`, `children` | Display text; coordinates in character rows/cols |
| `<Pixel>` | `x`, `y`, `on` | Single pixel; coordinates in pixels |

Font constants: `SMALL` (6×8), `FONT_NORMAL` (8×8), `FONT_BIG` (16×24).

## Write Your Own UI

```jsx
import oled from './oled-renderer';
import { Screen, Text, Pixel, SMALL } from './components';

export function MyApp() {
  const [x, setX] = createSignal(0);

  // ⚠️ App components MUST return () => JSX, not JSX directly
  return () => (
    <Screen>
      <Text x={0} y={0} font={SMALL}>Hello OLED!</Text>
      <Pixel x={x()} y={32} />
    </Screen>
  );
}
```

## C-Only Demo

```bash
make && make run    # shows "Hello OLED!" + a pixel; press Enter to quit
make clean
```

## Cross-Platform C Build

```bash
cd oled_96
gcc -fPIC -shared -o liboled96.so oled96.c fonts.c -lpthread -lm
```

## FAQ

**OLED init fails?** Check I2C: `sudo i2cdetect -y 1` (should show `0x3C`). Check wiring: SDA→GPIO2, SCL→GPIO3.

**"cannot open shared object file"?** Make sure `oled_96/liboled96.so` exists and matches your arch: `file oled_96/liboled96.so`.

**"koffi: unknown symbol"?** The shared library and `bindings.js` signatures are out of sync — rebuild `liboled96.so`.

## Tech Stack

| Layer | Tech |
|-------|------|
| UI framework | [SolidJS](https://www.solidjs.com/) |
| JSX compiler | Babel + classic JSX runtime |
| FFI | [koffi](https://koffi.dev/) |
| C driver | [OLED_96](https://github.com/bitbank2/oled_96) by Larry Bank |
| Hardware | SSD1306 128×64 OLED, I2C |
| Platform | Linux ARM64 (Raspberry Pi) |

## License

ISC — see [package.json](package.json). C driver (`oled_96/`) is Larry Bank's [OLED_96](https://github.com/bitbank2/oled_96) under its own license.
