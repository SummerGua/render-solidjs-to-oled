# 第 7 课：全链路串讲——从 `npm start` 到屏幕点亮

## 你会学到什么

- 把前 6 课串起来，追踪一次完整的执行路径
- 每个文件在什么时间点被加载、执行了什么
- 用时间线的方式理解整个系统

---

## 7.1 执行时间线

```
npm start
  │
  ├─→ package.json: "start": "node src/run.js"
  │
  ▼
═══════════════════════════════════════════
第 1 站：run.js   (角色：翻译官)
═══════════════════════════════════════════
  │
  ├─→ require('@babel/register')({ extensions: ['.jsx'] })
  │   注册 babel 钩子到 Node.js 的模块加载系统
  │   从此，任何 .jsx 文件被 require 时，自动编译 JSX → JS
  │   编译规则来自 .babelrc：<X> → oled.jsx(X, ...)
  │
  ├─→ require('./run.jsx')
  │
  ▼
═══════════════════════════════════════════
第 2 站：run.jsx   (角色：启动器)
═══════════════════════════════════════════
  │
  ├─→ import oled from './oled-renderer'
  │   │
  │   ├─→ require('./bindings')          ← 触发 bindings.js
  │   │   │
  │   │   ├─→ koffi.load('oled_96/liboled96.so')
  │   │   │   加载 C 动态库到进程内存（操作系统 dlopen）
  │   │   │
  │   │   ├─→ lib.func('oledInit', 'int', ['int','int','int','int','int'])
  │   │   │   lib.func('oledShutdown', 'void', [])
  │   │   │   lib.func('oledFill', 'int', ['uint8'])
  │   │   │   lib.func('oledWriteString', 'int', ['int','int','string','int'])
  │   │   │   lib.func('oledSetPixel', 'int', ['int','int','uint8'])
  │   │   │   ↑ 声明函数签名，获取 JS 包装函数
  │   │   │
  │   │   └─→ module.exports = { oledInit, oledShutdown, ... }
  │   │
  │   ├─→ require('solid-js/dist/solid.cjs')
  │   │   加载 SolidJS 响应式核心
  │   │
  │   └─→ module.exports = { jsx, jsxs, Fragment, render }
  │
  ├─→ import { CounterApp, ClockApp } from './app.jsx'
  │   │
  │   ├─→ Babel 编译 app.jsx（JSX → oled.jsx()）
  │   │   CounterApp 和 ClockApp 是两个普通函数
  │   │   它们内部使用了 createSignal, 返回 () => JSX
  │   │
  │   └─→ 导入 components.jsx
  │       Babel 编译 components.jsx
  │       Screen / Text / Pixel 是三个简单组件函数
  │
  ├─→ const App = process.argv[2] === 'clock' ? ClockApp : CounterApp
  │   根据命令行参数选应用
  │
  └─→ oled.render(() => <App />)
      │                         ↑
      │                         这个箭头函数是"code"参数
      │                         它不是立即执行的
      ▼
═══════════════════════════════════════════
第 3 站：oled-renderer.js render()  (角色：导演)
═══════════════════════════════════════════
  │
  ├─→ oledInit(1, 0x3C, 128, 0, 0)
  │   │
  │   ├─→ koffi 包装函数：
  │   │   JS number → C int × 5
  │   │   → 跳转到 liboled96.so 里 oledInit 的真实地址
  │   │   → 打开 /dev/i2c-1 设备文件
  │   │   → 发送 I2C 初始化序列给 SSD1306 芯片
  │   │   → C int 返回值 → JS number
  │   │
  │   └─→ 返回 0 → 初始化成功 ✅
  │
  ├─→ const getTree = code()
  │   │
  │   ├─→ code = () => <App />   (从 run.jsx 传入)
  │   ├─→ <App /> → oled.jsx(App, null)
  │   ├─→ App 是 CounterApp 函数 → CounterApp()
  │   │   │
  │   │   ├─→ const [count, setCount] = createSignal(0)
  │   │   │   const [distance, setDistance] = createSignal(0)
  │   │   │   setInterval(() => { setCount(c+1); setDistance(d+10) }, 1000)
  │   │   │   ↑ signals 和 interval 创建完毕
  │   │   │
  │   │   └─→ return () => (
  │   │         <Screen>
  │   │           <Text x={0} y={0} font={SMALL}>SolidJS OLED!</Text>
  │   │           <Text x={0} y={2} font={SMALL}>Count: {count()}</Text>
  │   │           <Pixel x={distance() % 128} y={56} />
  │   │           ...
  │   │         </Screen>
  │   │       )
  │   │
  │   └─→ getTree = 这个返回的箭头函数（闭包捕获了 count 和 distance）
  │
  ├─→ createRoot((dispose) => {
  │     │
  │     │  SolidJS: 创建响应式作用域
  │     │
  │     └─→ createRenderEffect(() => {
  │           │
  │           │  SolidJS: 创建渲染 effect，自动追踪依赖
  │           │
  │           ├─→ oledFill(0)
  │           │   → C 函数：清屏（全写 0）
  │           │
  │           ├─→ const tree = getTree()
  │           │   │
  │           │   ├─→ 返回 <Screen>...</Screen>
  │           │   ├─→ oled.jsx(Screen, null, ...)
  │           │   │   → Screen({ children: [...] })
  │           │   │   → jsx('screen', null, ...)
  │           │   │   → { type: 'screen', props: {}, children: [...] }
  │           │   │
  │           │   ├─→ 处理子元素 <Text>:
  │           │   │   → jsx(Text, {x:0, y:0, font:2}, 'SolidJS OLED!')
  │           │   │   → Text() 调用 → jsx('text', ...)
  │           │   │   → { type: 'text', props:..., children: ['SolidJS OLED!'] }
  │           │   │
  │           │   ├─→ 处理子元素 <Text>Count: {count()}</Text>:
  │           │   │   → count() 被调用 ← SolidJS 追踪：这个 effect 依赖 count
  │           │   │   → children: ['Count: ', count函数, ''] (函数是 reactive expr)
  │           │   │
  │           │   └─→ 处理子元素 <Pixel>:
  │           │       → distance() 被调用 ← SolidJS 追踪：这个 effect 依赖 distance
  │           │       → { type: 'pixel', props: {x: 0, y: 56, on: true} }
  │           │
  │           └─→ renderElement(tree)
  │               │
  │               ├─→ screen → 遍历 children
  │               ├─→ text("SolidJS OLED!") → oledWriteString(0, 0, "SolidJS OLED!", 2)
  │               │   → C 函数：写 I2C 数据到 SSD1306 的 GDDRAM
  │               ├─→ text("Count: 0") → oledWriteString(0, 2, "Count: 0", 2)
  │               ├─→ pixel(0, 56) → oledSetPixel(0, 56, 1)
  │               ├─→ pixel(10, 56) → oledSetPixel(10, 56, 1)
  │               └─→ pixel(20, 56) → oledSetPixel(20, 56, 1)
  │
  ├─→ 注册 SIGINT/SIGTERM 处理（Ctrl+C）
  │
  └─→ console.log('🚀 SolidJS OLED JSX 渲染器\n按 Ctrl+C 退出')
```

---

## 7.2 1 秒后：signal 更新触发重绘

```
setInterval 回调 (1秒后)：
  │
  ├─→ setCount(c => c + 1)
  │   → count signal 值变为 1
  │   → SolidJS 内部：通知所有订阅了 count 的 effect
  │   → createRenderEffect 的回调被重新调用！
  │
  ├─→ setDistance(d => d + 10)
  │   → distance signal 值变为 10
  │   → 同上，createRenderEffect 的回调被再次调用
  │   → (与上面同一次批处理)
  │
  └─→ createRenderEffect 回调：
      ├─→ oledFill(0)          // 清屏
      ├─→ getTree()            // 重新执行 () => JSX
      │   ├─→ count() → 1      // SolidJS 记录：这个 effect 依赖 count
      │   ├─→ distance() → 10  // SolidJS 记录：这个 effect 依赖 distance
      │   └─→ 返回新 JSX 树
      ├─→ renderElement(tree)  // 重新渲染
      │   ├─→ oledWriteString(0, 0, "SolidJS OLED!", 2)
      │   ├─→ oledWriteString(0, 2, "Count: 1", 2)    ← 屏幕显示 1
      │   ├─→ oledSetPixel(10 % 128, 56, 1)           ← 像素移动
      │   ├─→ oledSetPixel(20 % 128, 56, 1)
      │   └─→ oledSetPixel(30 % 128, 56, 1)
      └─→ 屏幕更新 ✅
```

每过 1 秒重复一次。整个过程完全自动——SolidJS 追踪 signal → effect，JSX 运行时翻译成 C 函数调用，koffi 桥接到硬件。

---

## 7.3 文件加载总览

```
run.js
  │
  ├── @babel/register  (全局钩子)
  │
  └── run.jsx
        │
        ├── oled-renderer.js
        │     ├── bindings.js
        │     │     ├── koffi (npm 包)
        │     │     └── liboled96.so (C 动态库)
        │     └── solid-js/dist/solid.cjs (npm 包)
        │
        ├── app.jsx (Babel 编译)
        │     └── components.jsx (Babel 编译)
        │           └── bindings.js (已加载，缓存)
        │
        └── 执行：oled.render(() => <App />)
```

---

## 7.4 各层职责一句话总结

| 层 | 文件 | 职责 |
|----|------|------|
| 响应式状态 | SolidJS | 追踪 signal 变化，自动触发 effect |
| JSX 编译 | `.babelrc` + Babel | `<Text>` → `oled.jsx(Text, ...)` |
| JSX 运行时 | `oled-renderer.js` | JSX 树 → OLED 绘制指令 |
| FFI 桥接 | `bindings.js` | JS 函数 → C 函数 |
| C 驱动 | `oled96.c` + `fonts.c` | I2C 协议操作 SSD1306 芯片 |
| 物理层 | SSD1306 | 控制 128×64 个 OLED 像素亮灭 |

---

## 7.5 小结

这个项目的每一层都是"翻译官"：

```
React-style JSX → jsx() 函数调用 → JSX 树 → OLED 指令 → C 函数 → I2C 信号 → 像素
```

整个链路中没有黑魔法。Babel 编译 JSX 是公开标准，koffi FFI 是公开 API，SolidJS signal 是不到 50 行的设计模式，C 驱动是经典的 I2C 操作。

**下一步 →** [第 8 课：动手实验](08-hands-on.md)
