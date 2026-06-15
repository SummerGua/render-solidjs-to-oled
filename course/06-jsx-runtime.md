# 第 6 课：自定义 JSX 运行时——JSX 怎么变成 OLED 指令

## 你会学到什么

- JSX 不是 React 专属的——它只是一个语法糖
- Babel 怎么把 JSX 编译成 JavaScript 函数调用
- 亲手写一个最小 JSX 运行时（20 行）
- 逐行解剖 `oled-renderer.js`

---

## 6.1 JSX 跟 React 没关系

很多前端开发者以为 JSX = React。其实 **JSX 只是 JavaScript 的语法扩展**——一种写嵌套函数调用的简写方式。

```jsx
<h1 className="title">Hello {name}</h1>
```

Babel 把它编译成：

```javascript
React.createElement('h1', { className: 'title' }, 'Hello ', name);
```

**`React.createElement` 只是默认的编译目标。** 你可以通过 `pragma` 配置改成任何函数。

看看本项目的 `.babelrc`：

```json
{
  "plugins": [["@babel/plugin-transform-react-jsx", {
    "runtime": "classic",
    "pragma": "oled.jsx",          // ← 编译成 oled.jsx() 而不是 React.createElement()
    "pragmaFrag": "oled.Fragment"  // ← <></> 编译成 oled.Fragment
  }]]
}
```

所以这段代码：

```jsx
<Screen>
  <Text x={0} y={0} font={SMALL}>Hello!</Text>
  <Pixel x={42} y={42} />
</Screen>
```

Babel 编译后变成：

```javascript
oled.jsx(
  Screen,
  null,
  oled.jsx(Text, { x: 0, y: 0, font: SMALL }, 'Hello!'),
  oled.jsx(Pixel, { x: 42, y: 42 })
);
```

**JSX 只是个翻译规则**——把尖括号翻译成函数调用。至于这个函数做什么，完全由你决定。React 用它生成 VDOM，本项目用它生成 OLED 绘制指令。

---

## 6.2 自己写一个最小 JSX 运行时（20 行）

先脱离 OLED，写一个能跑的最小 demo：

```javascript
// my-jsx-runtime.js

function jsx(type, props, ...children) {
  // 合并 children
  if (props && props.children) {
    children = [...children, ...(Array.isArray(props.children) ? props.children : [props.children])];
  }

  // 如果 type 是函数（组件），调用它
  if (typeof type === 'function') {
    return type({ ...props, children });
  }

  // 如果 type 是字符串（内置元素），返回描述对象
  return { type, props: props || {}, children: children.flat(Infinity) };
}

module.exports = { jsx };
```

写个 demo：

```javascript
// demo.js
/** @jsx jsx */
const { jsx } = require('./my-jsx-runtime');

function Greeting(props) {
  return <text>Hello, {props.name}!</text>;
}

const tree = <screen><Greeting name="OLED" /></screen>;

console.log(JSON.stringify(tree, null, 2));
```

注意文件顶部的 `/** @jsx jsx */`——这是告诉 Babel "用我的 `jsx` 函数，别用 `React.createElement`"。如果不用 Babel 编译而直接手写 `jsx()` 调用，可以跳过这行。

**这个 demo 揭示了自定义 JSX 运行时的全部秘密：** JSX 编译成 `jsx()` 调用，`jsx()` 递归处理组件和原生元素，最终产出一个树形对象。接下来你就可以遍历这个树做任何事——生成 HTML、渲染到 Canvas、或者驱动 OLED。

---

## 6.3 逐行解剖 oled-renderer.js

现在打开 `src/oled-renderer.js`。

### 第一部分：依赖

```javascript
const { createRoot, createRenderEffect } = require('solid-js/dist/solid.cjs');
const {
  oledInit, oledShutdown, oledFill,
  oledWriteString, oledSetPixel, FONT_SMALL
} = require('./bindings');
```

SolidJS 提供响应式追踪（第 5 课讲过），bindings 提供 C 函数调用（第 4 课讲过）。

### 第二部分：jsx() 函数

```javascript
function jsx(type, props, ...children) {
  const allProps = props || {};

  // 合并 children：Babel 可能把 children 放在 props.children 或者额外参数
  let kids = children.length > 0 ? children : allProps.children;
  if (kids && !Array.isArray(kids)) kids = [kids];

  // 组件：首字母大写，是 function
  if (typeof type === 'function') {
    return type({ ...allProps, children: kids });
    //     ↑ 直接调用！CounterApp() → 返回 () => JSX
  }

  // 内置元素：首字母小写，是字符串 'screen' / 'text' / 'pixel'
  return { type, props: allProps, children: normalizeChildren(kids) };
}
```

和上面 20 行的 demo 结构完全一样，只是多了 `normalizeChildren` 处理嵌套数组。

`normalizeChildren` 就是 `Array.flat(Infinity)` 的手写版，还过滤了 `null` / `false` / `undefined`：

```javascript
function normalizeChildren(children) {
  if (children == null || children === false) return [];
  if (!Array.isArray(children)) return [children];
  const result = [];
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) result.push(...normalizeChildren(c));
    else result.push(c);
  }
  return result;
}
```

### 第三部分：renderElement() 函数

这是"翻译引擎"：遍历 JSX 树，调用对应的 OLED C 函数。

```javascript
function renderElement(el) {
  if (el == null) return;

  if (typeof el === 'string' || typeof el === 'number') {
    return;  // 纯文本节点被父元素（<text>）处理
  }

  if (typeof el === 'function') {
    // reactive expression: {count()} → 调用它拿到最新值
    renderElement(el());
    return;
  }

  switch (el.type) {
    case 'screen':  // 根容器，递归渲染子元素
      for (const child of el.children) renderElement(child);
      break;

    case 'text': {
      const x = el.props.x ?? 0;
      const y = el.props.y ?? 0;
      const font = el.props.font ?? FONT_SMALL;
      let str = '';
      for (const child of el.children) {
        if (typeof child === 'string' || typeof child === 'number')
          str += String(child);
        else if (typeof child === 'function')
          str += String(child());  // {count()} → 调用 getter
      }
      oledWriteString(x, y, str, font);  // ← 调用 C 函数！
      break;
    }

    case 'pixel':
      oledSetPixel(
        el.props.x ?? 0,
        el.props.y ?? 0,
        el.props.on !== false ? 1 : 0
      );
      break;
  }
}
```

### 第四部分：render() 函数

```javascript
function render(code) {
  // 1. 初始化 OLED（只做一次）
  if (!initialized) {
    if (oledInit(1, 0x3C, 128, 0, 0) !== 0) {
      console.error('❌ OLED 初始化失败'); process.exit(1);
    }
    initialized = true;
    console.log('🟢 OLED 已初始化');
  }

  // 2. 调用 App 组件 → 拿到 () => JSX getter 函数
  const getTree = code();  // code = () => <CounterApp />
                           // CounterApp() 返回 () => <Screen>...</Screen>
  if (typeof getTree !== 'function') {
    throw new Error('App 必须返回 () => JSX，而不是直接返回 JSX');
  }

  // 3. 建立响应式渲染循环
  createRoot((dispose) => {
    createRenderEffect(() => {
      oledFill(0);               // 清屏
      const tree = getTree();     // 调用 getter → 追踪所有 signal
      renderElement(tree);        // 遍历 JSX 树 → 调用 C 函数绘制
    });

    // 4. Ctrl+C 时清理
    const cleanup = () => {
      oledFill(0);
      oledShutdown();
      console.log('\n👋 OLED 已关闭');
      dispose();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}
```

---

## 6.4 JSX 树的完整翻译过程

以一个实际例子走一遍：

```jsx
// 源码（components.jsx 和 app.jsx）
function Text(props) {
  return <text x={props.x} y={props.y} font={props.font}>{props.children}</text>;
}

function Pixel(props) {
  return <pixel x={props.x} y={props.y} on={props.on !== false} />;
}

<Screen>
  <Text x={0} y={0} font={SMALL}>Hello</Text>
  <Pixel x={10} y={20} />
</Screen>
```

**Step 1：Babel 编译**

```javascript
oled.jsx(Screen, null,
  oled.jsx(Text, { x: 0, y: 0, font: SMALL }, 'Hello'),
  oled.jsx(Pixel, { x: 10, y: 20 })
);
```

**Step 2：jsx() 处理外层**

```javascript
OLED.jsx(Screen, null, ...)
// Screen 是 function → 调用 Screen({ children: [...] })
// Screen 返回 <screen>...</screen>
// → jsx('screen', null, ...)
// → { type: 'screen', props: {}, children: [...] }
```

**Step 3：jsx() 处理内层 Text**

```javascript
OLED.jsx(Text, { x: 0, y: 0, font: SMALL }, 'Hello')
// Text 是 function → 调用 Text({ x: 0, y: 0, font: SMALL, children: ['Hello'] })
// Text 返回 <text x={0} y={0} font={SMALL}>Hello</text>
// → jsx('text', { x: 0, y: 0, font: 2 }, 'Hello')
// → { type: 'text', props: { x: 0, y: 0, font: 2 }, children: ['Hello'] }
```

**Step 4：jsx() 处理内层 Pixel**

```javascript
OLED.jsx(Pixel, { x: 10, y: 20 })
// Pixel 是 function → 调用 Pixel({ x: 10, y: 20 })
// → jsx('pixel', { x: 10, y: 20, on: true })
// → { type: 'pixel', props: { x: 10, y: 20, on: true }, children: [] }
```

**Step 5：完整树**

```javascript
{
  type: 'screen', props: {}, children: [
    { type: 'text', props: { x: 0, y: 0, font: 2 }, children: ['Hello'] },
    { type: 'pixel', props: { x: 10, y: 20, on: true }, children: [] }
  ]
}
```

**Step 6：renderElement() 遍历**

```
renderElement(screen)
  → renderElement(text)
    → oledWriteString(0, 0, 'Hello', 2)    // ← C 函数！屏幕显示 "Hello"
  → renderElement(pixel)
    → oledSetPixel(10, 20, 1)              // ← C 函数！(10,20) 像素点亮
```

---

## 6.5 为什么不用 React 而要手写？

React 也可以做这件事——但 React 带了大量你不需要的东西：

- Virtual DOM diff 算法（OLED 不需要 diff，每次全屏重绘即可）
- 合成事件系统（OLED 没有事件）
- Fiber 调度器（OLED 不需要并发渲染）
- 真实的 DOM 渲染器（你没法把 `<div>` 插到 OLED 上）

手写 JSX 运行时的总共不到 120 行，包含了 Babel 编译约定 + 元素树构建 + OLED 指令生成 + SolidJS 响应式集成。每一行你都看得懂。

---

## 6.6 小结

```
JSX 源码
  │ Babel + pragma: 'oled.jsx'
  ▼
jsx() 函数调用（组件大写→直接调，元素小写→生成对象）
  │
  ▼
树形对象 { type: 'text', props: {x:0, y:0}, children: ['Hello'] }
  │ renderElement() 遍历
  ▼
oledWriteString(0, 0, 'Hello', 2)   ← C 函数调用
  │
  ▼
OLED 屏幕显示 "Hello"
```

核心认知：**JSX 不是 React 的财产。** 它是一种语法糖，Babel 把它编译成函数调用。你写什么函数，JSX 就变什么。

**下一步 →** [第 7 课：全链路串讲——从 npm start 到屏幕点亮](07-full-pipeline.md)
