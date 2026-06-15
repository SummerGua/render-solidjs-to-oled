# 第 8 课：动手实验

## 你会学到什么

- 在非树莓派环境测试每个独立模块
- 改造代码加深理解
- 排查常见错误

---

## 实验 1：不用 OLED，测试 FFI 调用 C 标准库

在项目根目录创建 `course/test-ffi.js`：

```javascript
const koffi = require('koffi');

const libc = koffi.load('libc.so.6');

// 声明一些 C 标准库函数
const puts    = libc.func('puts', 'int', ['string']);
const strlen  = libc.func('strlen', 'int', ['string']);
const abs     = libc.func('abs', 'int', ['int']);
const sqrt    = libc.func('sqrt', 'double', ['double']);
const toupper = libc.func('toupper', 'int', ['int']);

puts('=== FFI 基础实验 ===');

// 实验 1: 字符串操作
console.log('1. strlen("Hello, FFI!") =', strlen('Hello, FFI!'));

// 实验 2: 数学
console.log('2. abs(-42) =', abs(-42));
console.log('   sqrt(2.0) =', sqrt(2.0));

// 实验 3: 字符处理
const a_upper = toupper('a'.charCodeAt(0));
console.log('3. toupper("a") =', String.fromCharCode(a_upper));
```

运行：

```bash
node course/test-ffi.js
```

**你学到了：** koffi 不仅能调用你自己的 `.so`，还能调用系统自带的任何 C 库。

---

## 实验 2：不连 OLED，测试 JSX 运行时

可以在任何电脑上跑 JSX 运行时，只需要把 `renderElement` 里的 C 调用替换成 `console.log`。

创建 `course/test-jsx.js`：

```javascript
// 不依赖 OLED 硬件的 JSX 运行时测试
const { jsx, Fragment } = require('../src/oled-renderer');

// 自己写一个"假渲染引擎"
function fakeRenderElement(el) {
  if (el == null) return;
  if (typeof el === 'function') { fakeRenderElement(el()); return; }
  if (typeof el === 'string' || typeof el === 'number') return;

  switch (el.type) {
    case 'screen':
      console.log('📺 开始渲染屏幕');
      for (const child of el.children) fakeRenderElement(child);
      console.log('📺 渲染完毕\n');
      break;
    case 'text': {
      let str = '';
      for (const child of el.children) {
        if (typeof child === 'string' || typeof child === 'number') str += String(child);
        else if (typeof child === 'function') str += String(child());
      }
      console.log(`  ✏️  [文本] x=${el.props.x}, y=${el.props.y}: "${str}"`);
      break;
    }
    case 'pixel':
      console.log(`  🔵 [像素] x=${el.props.x}, y=${el.props.y}, on=${el.props.on}`);
      break;
  }
}

// 模拟组件
function MyBox(props) {
  return <screen>{props.children}</screen>;
}

function MyLabel(props) {
  return <text x={props.x} y={props.y}>{props.text}</text>;
}

// 构建 JSX 树
const tree = (
  <MyBox>
    <MyLabel x={0} y={0} text="Hello from JSX!" />
    <pixel x={10} y={20} on={true} />
    <pixel x={11} y={20} on={false} />
  </MyBox>
);

console.log('JSX 树结构:', JSON.stringify(tree, null, 2));
console.log('\n--- 渲染输出 ---\n');
fakeRenderElement(tree);
```

运行：

```bash
node course/test-jsx.js
```

你会看到 JSX 树被翻译成了控制台输出。

**你学到了：** JSX 运行时和 C 调用是解耦的。你可以把 OLED 换成任何渲染目标——终端、HTML、Canvas。

---

## 实验 3：手写 JSX 编译器（不用 Babel）

如果你不想依赖 Babel 编译，可以用 tagged template literal 或者纯函数调用来代替 JSX：

```javascript
// 不用 JSX，用 h() 函数调用来创建元素树
// 这就是 JSX 编译后的样子！

const { jsx } = require('../src/oled-renderer');

// JSX:  <Screen><Text x={0} y={0}>Hello</Text></Screen>
// 等价于:
const tree = jsx(Screen, null,
  jsx(Text, { x: 0, y: 0 }, 'Hello')
);

console.log(JSON.stringify(tree, null, 2));
```

**你学到了：** JSX 只是语法糖。你可以用 `h()` 函数调用获得完全一样的结果。这也是为什么很多框架（Preact、Vue render functions）用 `h()` 这个名字——它就是 `jsx()` 的别名。

---

## 实验 4：追踪信号订阅过程

创建 `course/test-signal.js`：

```javascript
// 最小化的 signal 实现——理解 SolidJS 的核心原理
let currentEffect = null;

function createSignal(value) {
  const subscribers = new Set();

  return [
    function getter() {
      if (currentEffect) {
        subscribers.add(currentEffect);
        console.log(`  📌 signal(getter) 被读取，effect 已订阅`);
      }
      return value;
    },
    function setter(newValue) {
      console.log(`  🔔 signal 变化: ${value} → ${newValue}`);
      value = newValue;
      subscribers.forEach(fn => fn());
    }
  ];
}

function createRenderEffect(fn) {
  function run() {
    console.log('  ▶️ effect 开始执行');
    currentEffect = run;
    fn();
    currentEffect = null;
    console.log('  ⏹️ effect 执行完毕\n');
  }
  run();
}

// === 测试 ===
console.log('--- 创建 signal ---');
const [count, setCount] = createSignal(0);

console.log('--- 创建 effect ---');
createRenderEffect(() => {
  console.log(`    当前 count = ${count()}`);
});

console.log('--- 更新 signal ---');
setCount(1);

console.log('--- 再次更新 signal ---');
setCount(2);
```

运行：

```bash
node course/test-signal.js
```

你会看到：
```
--- 创建 signal ---
--- 创建 effect ---
  ▶️ effect 开始执行
  📌 signal(getter) 被读取，effect 已订阅
    当前 count = 0
  ⏹️ effect 执行完毕

--- 更新 signal ---
  🔔 signal 变化: 0 → 1
  ▶️ effect 开始执行
  📌 signal(getter) 被读取，effect 已订阅
    当前 count = 1
  ⏹️ effect 执行完毕
```

**你学到了：** SolidJS 的 `createSignal` 不是什么黑魔法——就是用 Set 存订阅者，setter 里遍历通知。不到 20 行代码就实现了核心机制。

---

## 实验 5：给 App 加一个新组件——画线

在 `src/components.jsx` 里加一个画水平线的组件：

```jsx
// 加到 components.jsx 里
export function HLine(props) {
  // 画一条水平线：在 (props.y) 这一行画多个像素
  const pixels = [];
  const x0 = props.x ?? 0;
  const x1 = props.x1 ?? 127;
  for (let x = x0; x <= x1; x++) {
    pixels.push(<pixel x={x} y={props.y} on={true} />);
  }
  // 返回 Fragment 避免多余的嵌套元素
  return <>{pixels}</>;
}
```

然后在 `oled-renderer.js` 的 `renderElement` 里不需要添加 `case 'hline'`——因为 HLine 组件展开成了多个 `<pixel>` 元素，现有的 `case 'pixel'` 已经能处理。

在 `CounterApp` 里加上：

```jsx
<HLine y={50} x={0} x1={127} />
```

---

## 实验 6：添加一个新 App —— 进度条

在 `src/app.jsx` 里添加：

```jsx
export function ProgressApp() {
  const [progress, setProgress] = createSignal(0);
  setInterval(() => setProgress(p => (p + 1) % 101), 50);

  return () => {
    const pct = progress();
    const barWidth = Math.floor(pct * 1.2);  // 0-100 → 0-120
    return (
      <Screen>
        <Text x={0} y={0} font={SMALL}>Progress: {pct}%</Text>
        {/* 进度条背景 */}
        <HLine y={30} x={3} x1={124} />
        {/* 进度条前景（用像素画在下方一行） */}
        {Array.from({ length: barWidth }, (_, i) => (
          <Pixel x={i + 3} y={28} />
        ))}
      </Screen>
    );
  };
}
```

然后在 `src/run.jsx` 里添加：

```jsx
if (process.argv[2] === 'progress') App = ProgressApp;
```

---

## 调试技巧

### 1. 检查 .so 是否正确加载

```bash
file oled_96/liboled96.so
# 应该输出: ELF 64-bit LSB shared object, ARM aarch64
# 如果在 x86 机器上，会看到 x86-64，也能用（但 OLED 硬件连不上）
```

### 2. 检查 I2C 是否连通

```bash
sudo i2cdetect -y 1
# 应该看到地址 0x3C 有设备
```

### 3. 查看 .so 导出了哪些符号

```bash
nm -D oled_96/liboled96.so | grep ' T '
# T = Text section（代码段），列出所有导出的函数
```

### 4. 单独测试 C demo

在排查 JS 层问题之前，先用纯 C demo 确认硬件正常：

```bash
make
sudo ./output    # I2C 需要 root 权限
```

---

## 常见错误速查表

| 错误信息 | 原因 | 解决 |
|---------|------|------|
| `cannot open shared object file` | `.so` 文件不存在或路径错误 | 检查 `bindings.js` 中的 `libPath` |
| `unknown symbol` | `.so` 里没有这个函数 | `nm -D liboled96.so` 检查导出符号 |
| `permission denied` | I2C 需要 root 权限 | `sudo node src/run.js` 或把用户加入 `i2c` 组 |
| `App 必须返回 () => JSX` | 组件直接返回了 JSX | 改 `return <Screen>` 为 `return () => <Screen>` |
| `oled.jsx is not a function` | Babel 编译失效 | 检查 `.babelrc` + `run.js` 中的 `@babel/register` |
| `FONT_SMALL is not defined` | 忘记导入常量 | `import { SMALL } from './components'` |

---

## 结语

如果你完成了所有 8 课，你应该已经理解了：

1. **Makefile** = 编译脚本，依赖驱动，增量编译
2. **.o / .so** = 编译中间产物 / 运行时加载的动态库
3. **koffi / FFI** = JS 到 C 的翻译官，类型映射是关键
4. **SolidJS signal** = getter 函数 + 自动订阅 + 自动通知
5. **JSX 运行时** = Babel 编译 JSX → jsx() → 元素树 → renderElement()
6. **整个项目** = 6 层翻译链，没有黑魔法

这个项目虽小，但它展示了一个通用模式：**用声明式 UI 框架驱动非浏览器的渲染目标**。同样的模式可以驱动 LED 矩阵、电子墨水屏、打印机、绘图仪——任何"接收绘制指令"的设备。

**相关资源：**
- [koffi 文档](https://koffi.dev/)
- [SolidJS 文档](https://www.solidjs.com/)
- [Babel JSX 插件文档](https://babeljs.io/docs/babel-plugin-transform-react-jsx)
- [SSD1306 数据手册](https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf)
