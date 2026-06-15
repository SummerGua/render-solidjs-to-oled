# Render SolidJS to OLED

> 用 SolidJS 响应式 UI 驱动 0.96 寸 SSD1306 OLED 显示屏的概念验证项目

用 JSX 写 UI 组件（`<Text>`、`<Pixel>`、`<Screen>`），用 SolidJS 信号管理响应式状态，状态变化时自动重绘 OLED 屏幕。底层通过 FFI（`koffi`）调用 C 动态库 `liboled96.so` 操作 I2C 总线上的 OLED 硬件。

```
┌─────────────────────────────────────────────┐
│  src/app.jsx          SolidJS 组件          │
│  src/components.jsx   JSX UI 组件           │
│  src/oled-renderer.js 自定义 JSX → OLED     │
│  src/bindings.js      koffi FFI 桥接        │
├─────────────────────────────────────────────┤
│  oled_96/liboled96.so C 动态库 (ARM64)      │
│               ↓ I2C                         │
│        SSD1306 OLED 显示屏                  │
└─────────────────────────────────────────────┘
```

## 硬件要求

| 项目 | 说明 |
|------|------|
| **单板计算机** | 树莓派（ARM64）或其他有 I2C 总线的 Linux SBC |
| **显示屏** | 0.96 寸 SSD1306 OLED，128×64 分辨率，I2C 接口 |
| **接线** | VCC → 3.3V，GND → GND，SDA → GPIO2（Pin 3），SCL → GPIO3（Pin 5） |
| **系统** | Linux ARM64，已启用 I2C（`raspi-config` → Interface Options → I2C → Enable） |

验证 I2C 是否就绪：

```bash
sudo i2cdetect -y 1   # 应看到地址 0x3C
```

## 快速开始

```bash
# 1. 安装 Node 依赖
npm install

# 2. 编译 C 动态库（如果 liboled96.so 不存在或平台不匹配）
cd oled_96 && make -f makefile && cd ..

# 3. 运行
npm start             # 计数器 + 移动像素点
npm run start:clock   # 中文格式实时时钟
```

按 `Ctrl+C` 退出，屏幕会自动关闭。

## 项目结构

```
render-solidjs-to-oled/
├── src/
│   ├── run.js              # 入口：注册 Babel，加载 run.jsx
│   ├── run.jsx             # JSX 入口：选择 App 组件，调用 oled.render()
│   ├── app.jsx             # 应用组件：CounterApp / ClockApp
│   ├── components.jsx      # UI 组件：Screen、Text、Pixel
│   ├── oled-renderer.js    # 自定义 JSX 运行时 + OLED 渲染引擎
│   └── bindings.js         # koffi FFI 桥接，C 函数 → JS
├── oled_96/                # C 语言 OLED 驱动库（Larry Bank）
│   ├── oled96.c / .h       # SSD1306 I2C 驱动
│   ├── fonts.c             # 字体数据（6×8、8×8、16×24）
│   └── liboled96.so        # 预编译 ARM64 动态库
├── demo.c                  # 独立 C 语言 demo（不依赖 Node.js）
├── Makefile                # 编译 C demo
├── .babelrc                # Babel 配置：JSX → oled.jsx()
├── package.json
└── docs.html               # 架构图（HTML）
```

## 工作原理

### JSX → OLED 管线

1. **Babel** 将 JSX 编译为 `oled.jsx(组件, props, children)` 调用
2. **自定义 JSX 运行时**（`oled-renderer.js`）构建元素树
3. **FFI 桥接**（`bindings.js`）通过 `koffi` 暴露 C 函数
4. **响应式渲染** — `createRenderEffect` 追踪 SolidJS 信号；信号变化时重建元素树并重绘 OLED

### 响应式渲染流程

```
npm start
  → run.js: 注册 Babel
  → run.jsx: 选择 App
  → oled.render(() => <CounterApp />)
    → oledInit()           // 初始化硬件
    → createRoot()         // 创建 SolidJS 响应式根
      → createRenderEffect()
        → oledFill(0)      // 清屏
        → getTree()        // 读取信号 → 生成新 JSX 树
        → renderElement()  // 遍历树 → 调用 C 绘图函数
    → 信号变化 → effect 重新执行 → 屏幕更新
```

每次渲染都是全帧刷新（不做 diff）。1024 字节通过 400 kHz I2C 传输只需约 25ms，无可见闪烁。

## 可用组件

| 组件 | Props | 说明 |
|------|-------|------|
| `<Screen>` | `children` | 根容器，无实际渲染效果 |
| `<Text>` | `x`, `y`, `font`, `children` | 显示文本，坐标单位为字符行列 |
| `<Pixel>` | `x`, `y`, `on` | 画单个像素，坐标单位为像素 |

字体常量：`SMALL`（6×8）、`FONT_NORMAL`（8×8）、`FONT_BIG`（16×24）。

## 编写自己的 UI

```jsx
import oled from './oled-renderer';
import { Screen, Text, Pixel, SMALL } from './components';

export function MyApp() {
  const [x, setX] = createSignal(0);

  // ⚠️ App 组件必须返回 () => JSX，不能直接返回 JSX
  return () => (
    <Screen>
      <Text x={0} y={0} font={SMALL}>Hello OLED!</Text>
      <Pixel x={x()} y={32} />
    </Screen>
  );
}
```

## 纯 C Demo

```bash
make && make run    # OLED 显示 "Hello OLED!" + 一个像素点，按 Enter 退出
make clean
```

## 跨平台编译 C 库

```bash
cd oled_96
gcc -fPIC -shared -o liboled96.so oled96.c fonts.c -lpthread -lm
```

## 常见问题

**OLED 初始化失败？** 检查 I2C：`sudo i2cdetect -y 1`（应显示 `0x3C`）。检查接线：SDA → GPIO2，SCL → GPIO3。

**"cannot open shared object file"？** 确认 `oled_96/liboled96.so` 存在且架构匹配：`file oled_96/liboled96.so`。

**"koffi: unknown symbol"？** 动态库与 `bindings.js` 中的函数签名不匹配，重新编译 `liboled96.so`。

## 技术栈

| 层 | 技术 |
|----|------|
| UI 框架 | [SolidJS](https://www.solidjs.com/) |
| JSX 编译 | Babel + 经典 JSX 运行时 |
| FFI 桥接 | [koffi](https://koffi.dev/) |
| C 驱动 | [OLED_96](https://github.com/bitbank2/oled_96) by Larry Bank |
| 硬件 | SSD1306 128×64 OLED，I2C |
| 平台 | Linux ARM64（树莓派） |

## 许可证

本项目使用 ISC 协议，详见 [package.json](package.json)。C 驱动部分（`oled_96/`）为 Larry Bank 的 [OLED_96](https://github.com/bitbank2/oled_96)，遵循其原有许可证。
