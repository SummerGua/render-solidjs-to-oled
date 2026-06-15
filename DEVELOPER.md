# Render SolidJS to OLED — 开发者文档

## 项目概述

这是一个**概念验证项目**：用 SolidJS 的响应式 UI 模型来驱动一块 0.96 寸 SSD1306 OLED 显示屏（128×64 像素）。

核心思路——用 JSX 写 UI 组件（`<Text>`, `<Pixel>`, `<Screen>`），SolidJS 的 `createSignal` 负责响应式状态，变化时自动重绘 OLED 屏幕。底层通过 FFI（`koffi`）调用 C 动态库 `liboled96.so` 来操作 I2C 总线上的 OLED 硬件。

```
┌─────────────────────────────────────────────┐
│  src/app.jsx           SolidJS 组件         │
│  src/components.jsx    JSX UI 组件          │
│  src/oled-renderer.js  自定义 JSX → OLED    │
│  src/bindings.js       koffi FFI 桥接       │
├─────────────────────────────────────────────┤
│  oled_96/liboled96.so  C 动态库 (ARM64)     │
│                ↓ I2C                        │
│         SSD1306 OLED 显示屏                 │
└─────────────────────────────────────────────┘
```

---

## 硬件要求

| 项目 | 说明 |
|------|------|
| **单板计算机** | 树莓派（ARM64），或其他有 I2C 总线的 Linux SBC |
| **显示屏** | 0.96 寸 SSD1306 OLED，128×64 分辨率，I2C 接口 |
| **接线** | VCC → 3.3V, GND → GND, SDA → GPIO2 (Pin 3), SCL → GPIO3 (Pin 5) |
| **系统** | Linux (ARM aarch64)，已启用 I2C（`raspi-config` → Interface Options → I2C → Enable） |

验证 I2C 是否就绪：

```bash
sudo i2cdetect -y 1   # 应看到地址 0x3C
```

---

## 软件依赖

### Node.js ≥ 18

```bash
node --version  # 确认 ≥ 18
```

### 系统库（编译 C 部分需要）

```bash
sudo apt install build-essential
```

---

## 快速开始

### 1. 安装 Node 依赖

```bash
cd render-solidjs-to-oled
npm install
```

### 2. 编译 C 动态库（如果还没有 `liboled96.so`）

```bash
# 进入 OLED 驱动目录
cd oled_96
make -f makefile
cd ..
```

预编译的 `liboled96.so`（ARM64）已包含在仓库中。如果平台不同（x86-64 / 非树莓派），需要重新编译。

### 3. 运行

```bash
# 计数器 demo（默认）
npm start

# 实时时钟 demo
npm run start:clock
```

运行后 OLED 屏幕开始显示内容，按 `Ctrl+C` 退出并关闭屏幕。

---

## 项目结构

```
render-solidjs-to-oled/
├── src/
│   ├── run.js              # 入口：注册 babel，然后加载 run.jsx
│   ├── run.jsx             # JSX 入口：选择 App，调用 oled.render()
│   ├── app.jsx             # 应用组件：CounterApp / ClockApp
│   ├── components.jsx      # UI 组件：Screen, Text, Pixel
│   ├── oled-renderer.js    # 自定义 JSX 运行时 + OLED 渲染引擎
│   └── bindings.js         # koffi FFI 桥接，映射 C 函数到 JS
├── oled_96/                # C 语言 OLED 驱动库（by Larry Bank）
│   ├── oled96.c / .h       # SSD1306 I2C 驱动
│   ├── fonts.c             # 字体数据（6×8, 8×8, 16×24）
│   ├── liboled96.so        # 编译好的 ARM64 动态库
│   ├── makefile             # 库本身的 makefile
│   └── make_sample          # 编译 demo 的脚本
├── demo.c                  # C 语言独立 demo（不依赖 Node.js）
├── Makefile                # 编译 C demo 的 Makefile
├── .babelrc                # Babel 配置：JSX → oled.jsx() 调用
├── package.json
└── dist/                   # 空目录（预留）
```

---

## 架构详解

### 1. Babel 编译 JSX

`.babelrc` 配置了自定义 JSX pragma：

```json
{
  "plugins": [["@babel/plugin-transform-react-jsx", {
    "runtime": "classic",
    "pragma": "oled.jsx",
    "pragmaFrag": "oled.Fragment"
  }]]
}
```

这意味着：

```jsx
<Text x={0} y={0}>Hello</Text>
```

编译为：

```js
oled.jsx(Text, { x: 0, y: 0 }, "Hello")
```

### 2. 自定义 JSX 运行时 (`oled-renderer.js`)

不依赖 `babel-preset-solid` 的 universal 模式，而是实现了自己的 `jsx()` / `jsxs()` / `Fragment()`：

- **组件**（首字母大写，如 `Text`, `Pixel`）→ 直接调用函数，返回元素描述对象
- **内置元素**（首字母小写，如 `screen`, `text`, `pixel`）→ 创建 `{ type, props, children }` 对象

### 3. FFI 桥接 (`bindings.js`)

使用 [`koffi`](https://koffi.dev/) 加载 `liboled96.so`，将 C 函数映射为 JS 可调用的函数：

| JS 函数 | C 函数 | 功能 |
|---------|--------|------|
| `oledInit(ch, addr, type, flip, invert)` | `oledInit()` | 初始化 OLED |
| `oledShutdown()` | `oledShutdown()` | 关闭 OLED |
| `oledFill(pattern)` | `oledFill()` | 填充全屏 |
| `oledWriteString(x, y, str, font)` | `oledWriteString()` | 写字符串 |
| `oledSetPixel(x, y, on)` | `oledSetPixel()` | 画像素 |

### 4. 响应式渲染流程

```
npm start
  → run.js: 注册 babel
  → run.jsx: 选择 App 组件
  → oled.render(() => <CounterApp />)
    → oledInit() 初始化硬件
    → createRoot() 创建 SolidJS 响应式根
      → createRenderEffect() 建立渲染 effect
        → oledFill(0) 清屏
        → getTree() 调用 App，追踪 signal 依赖
        → renderElement(tree) 遍历 VDOM 树，调用 OLED 绘图 API
    → signal 变化 → effect 自动重新执行 → 屏幕更新
```

### 5. 已有 demo

| 命令 | App | 效果 |
|------|-----|------|
| `npm start` | `CounterApp` | 显示计数器数字 + 3 个移动像素点 |
| `npm run start:clock` | `ClockApp` | 显示中文格式实时时钟 + 秒闪烁点 |

---

## 编写你自己的 UI

在 `src/` 下创建 `.jsx` 文件，使用提供的组件：

```jsx
import oled from './oled-renderer';
import { Screen, Text, Pixel, SMALL } from './components';

export function MyApp() {
  const [x, setX] = createSignal(0);

  return () => (
    <Screen>
      <Text x={0} y={0} font={SMALL}>Hello OLED!</Text>
      <Pixel x={x()} y={32} />
    </Screen>
  );
}
```

**关键规则：App 组件必须返回一个函数 `() => JSX`，不能直接返回 JSX**。这是因为 SolidJS 的 `createRenderEffect` 需要每次运行时重新调用这个函数来追踪 signal 依赖。

可用的组件：

| 组件 | Props | 说明 |
|------|-------|------|
| `<Screen>` | `children` | 根容器，无实际渲染效果 |
| `<Text>` | `x`, `y`, `font`, `children` | 显示文本，坐标单位为字符行列 |
| `<Pixel>` | `x`, `y`, `on` | 画单个像素，坐标单位为像素 |

字体常量：`SMALL`(6×8), `FONT_NORMAL`(8×8, 需从 bindings 导入), `FONT_BIG`(16×24, 需从 bindings 导入)

---

## 仅测试 C demo（不依赖 Node.js）

```bash
make        # 编译
make run    # 运行（OLED 显示 "Hello OLED!" + 一个像素点，按 Enter 退出）
make clean  # 清理
```

---

## 跨平台编译 C 库

如果需要在非树莓派平台（如 x86-64 Linux）编译：

```bash
cd oled_96
gcc -fPIC -shared -o liboled96.so oled96.c fonts.c -lpthread -lm
```

然后在 `bindings.js` 中，`libPath` 已经指向了 `oled_96/liboled96.so`，无需修改。

---

## 常见问题

### "OLED 初始化失败"
- 检查 I2C 是否启用：`sudo i2cdetect -y 1`
- 检查 I2C 地址是否正确（默认 `0x3C`）
- 检查接线：SDA → GPIO2, SCL → GPIO3

### "Error: liboled96.so: cannot open shared object file"
- 确认 `oled_96/liboled96.so` 存在
- 确认是 ARM64 格式：`file oled_96/liboled96.so`

### "koffi: unknown symbol"
- 动态库版本和 `bindings.js` 中声明的函数签名不匹配，重新编译 `liboled96.so`

---

## 技术栈

| 层 | 技术 |
|----|------|
| UI 框架 | [SolidJS](https://www.solidjs.com/) 1.9 |
| JSX 编译 | Babel + `@babel/plugin-transform-react-jsx` (classic runtime) |
| FFI 桥接 | [koffi](https://koffi.dev/) 3.0 |
| C 驱动 | [OLED_96](https://github.com/bitbank2/oled_96) by Larry Bank |
| 硬件 | SSD1306 128×64 OLED, I2C |
| 平台 | Linux ARM64 (树莓派) |
