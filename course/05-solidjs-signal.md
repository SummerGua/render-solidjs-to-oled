# 第 5 课：SolidJS Signal——响应式编程入门

## 你会学到什么

- `createSignal` 就是 React 的 `useState`，但有几个关键区别
- `createRoot` 和 `createRenderEffect` 是什么
- 为什么 App 必须返回 `() => JSX` 而不是直接返回 JSX
- 用 React 对照着学 SolidJS

---

## 5.1 从 React 的 useState 说起

React 组件里，数据变化 → UI 自动更新：

```jsx
function Counter() {
  const [count, setCount] = useState(0);   // 状态
  return <div>{count}</div>;               // 渲染
}
```

`setCount(1)` 触发整个 `Counter` 函数重新执行，React 比较新旧 VDOM，更新真实 DOM。

SolidJS 的写法几乎一样：

```jsx
function Counter() {
  const [count, setCount] = createSignal(0);  // 和 useState 一样
  return <div>{count()}</div>;                // 注意：count 是函数！
}
```

### 第一个区别：signal 是 getter 函数

在 React 中 `count` 是值（数字 0），在 SolidJS 中 `count` 是 **getter 函数**。

```javascript
// React
const [count, setCount] = useState(0);
console.log(count);   // 0（值）

// SolidJS
const [count, setCount] = createSignal(0);
console.log(count);   // [Function]（getter 函数）
console.log(count()); // 0（调用 getter 拿到值）
```

为什么要设计成函数？因为 SolidJS 需要**追踪**谁读了 signal。当你调用 `count()` 时，SolidJS 内部记录"这个 effect 依赖了 count"。等 `setCount` 被调用时，SolidJS 就知道"需要通知那些读取过 count 的 effect 重新运行"。

React 没有这种自动追踪——`useState` 返回的是裸值，追踪靠的是组件树 diff 和 `useEffect` 的依赖数组。

### 第二个区别：组件只执行一次

React 中，状态变化 → 整个组件函数重新执行：

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  console.log('组件执行');    // 每次 setCount 都会打印！
  return <div>{count}</div>;
}
```

SolidJS 中，组件函数**只执行一次**：

```jsx
function Counter() {
  const [count, setCount] = createSignal(0);
  console.log('组件执行');   // 只打印一次！
  return <div>{count()}</div>;
}
```

这解释了为什么本项目的组件要返回函数：

```jsx
export function CounterApp() {
  const [count, setCount] = createSignal(0);
  // ↑ 这些只执行一次（创建 signals 和 interval）

  return () => (          // ← 这个返回的函数会在每次 effect 时调用
    <Screen>
      <Text>{count()}</Text>  // ← 每次调用 count()，追踪依赖
    </Screen>
  );
}
```

---

## 5.2 createRoot 和 createRenderEffect

### React 版

```jsx
// React 内部有一个"根节点"
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
// React 内部自动追踪 state 变化，重新调用 App，重新 diff VDOM
```

### SolidJS 版

```javascript
createRoot((dispose) => {           // 创建响应式根作用域
  createRenderEffect(() => {        // 创建"渲染效果"
    oledFill(0);                     // 清屏
    const tree = getTree();          // 调用 App 返回的 () => JSX，追踪 signal
    renderElement(tree);             // 渲染到 OLED
  });
  // 当 getTree() 内部调用了任何 signal 的 getter，
  // SolidJS 自动知道：signal 变了 → 重新运行这个 effect
});
```

`createRenderEffect` 的行为类似 React 的：

```javascript
useEffect(() => {
  // 这里的逻辑会在依赖变化时重新执行
}, [依赖]);
```

区别是 SolidJS **不需要你手动写依赖数组**。`createRenderEffect` 自动追踪内部调用了哪些 signal，精确到"count 变了才重跑，time 变了不算"。

---

## 5.3 用伪代码理解自动追踪

```javascript
// SolidJS 内部的简化版追踪机制
let currentEffect = null;
const signalSubscriptions = new Map();

function createSignal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  function getter() {
    // 当前正在执行的 effect 订阅了这个 signal
    if (currentEffect) subscribers.add(currentEffect);
    return value;
  }

  function setter(newValue) {
    value = newValue;
    // 通知所有订阅者重新运行
    subscribers.forEach(effect => effect());
  }

  return [getter, setter];
}

function createRenderEffect(fn) {
  currentEffect = fn;
  fn();              // 第一次执行，fn 内部的 getter() 调用会订阅
  currentEffect = null;
}
```

当执行 `count()` 时，SolidJS 内部做了"谁在调用我？哦，是 `createRenderEffect` 传进来的那个函数。记下来——以后 `setCount` 时通知它重跑。"

---

## 5.4 为什么 App 必须返回 () => JSX？

这是本项目最容易困惑的地方。看两段代码：

### ❌ 错误写法

```jsx
export function CounterApp() {
  const [count, setCount] = createSignal(0);
  setInterval(() => setCount(c => c + 1), 1000);

  return (
    <Screen>
      <Text>{count()}</Text>  {/* 组件只执行一次！count() 只被调用一次 */}
    </Screen>
  );
}
```

问题：`CounterApp` 只被调用一次，所以 `count()` 也只在这次被调用。SolidJS 追踪到了这次读取，但 effect 重跑时不会再调用 `CounterApp`，所以永远拿不到新的 count。

### ✅ 正确写法

```jsx
export function CounterApp() {
  const [count, setCount] = createSignal(0);
  setInterval(() => setCount(c => c + 1), 1000);

  return () => (              // 返回一个函数
    <Screen>
      <Text>{count()}</Text>  {/* 这个函数每次 effect 都调用 → count() 被反复读取 */}
    </Screen>
  );
}
```

`oled-renderer.js` 里的用法正好匹配：

```javascript
const getTree = code();  // 调用 CounterApp() → 拿到 () => JSX
// getTree 就是那个返回的函数

createRenderEffect(() => {
  oledFill(0);
  const tree = getTree();  // 每次 effect 重跑都调这个函数
  renderElement(tree);     // count() 在里面被调用 → 自动追踪
});
```

| | React | SolidJS（本项目用法）|
|---|---|---|
| 组件执行次数 | 每次 state 变化 | 只执行一次 |
| 渲染内容 | 组件 return 的 JSX | 组件 return 的函数 return 的 JSX |
| 追踪方式 | diff VDOM | signal getter 订阅 |

---

## 5.5 本项目只用了 SolidJS 的一小部分

SolidJS 是个完整的 UI 框架（有 DOM 渲染器、路由、SSR 等）。本项目只用到了它的响应式核心：

```javascript
const { createRoot, createRenderEffect } = require('solid-js/dist/solid.cjs');
```

这两个 API 加起来不到 50 行逻辑，但提供了完整的自动追踪能力。本项目的 `oled-renderer.js` 自己实现了 JSX → 像素的渲染，所以不需要 SolidJS 的 DOM 渲染器。

---

## 5.6 小结

| 概念 | React 对应 | 关键区别 |
|------|-----------|---------|
| `createSignal` | `useState` | 返回 getter 函数，不是裸值 |
| `createRenderEffect` | `useEffect` | 自动追踪依赖，不用写依赖数组 |
| `createRoot` | `createRoot` | 创建追踪上下文 |
| 组件执行 | 每次 state 变化都执行 | 只执行一次 |
| `() => JSX` | 组件 return | SolidJS 中这是 effect 每次重跑时的内容 |

```javascript
// 一张图记住 SolidJS 的数据流：
setCount(1)
  → signal 值更新
  → 自动通知所有订阅了这个 signal 的 effect
  → createRenderEffect 重新运行
  → getTree() 重新调用
  → count() 返回新值
  → JSX 树更新
  → renderElement() 重新渲染到 OLED
```

**下一步 →** [第 6 课：自定义 JSX 运行时——JSX 怎么变成 OLED 指令](06-jsx-runtime.md)
