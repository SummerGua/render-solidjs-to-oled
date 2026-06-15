# 我用 SolidJS + JSX 驱动了一块 OLED 屏幕

> 一个 side project 分享，写给前端组的兄弟们。

---

## 先看效果

一块 0.96 寸 SSD1306 OLED 屏幕（128×64 像素），接在树莓派上。

用 **JSX** 写 UI，数据变化屏幕自动刷新——和 React 的 `setState` 触发 re-render 一个体验：

```jsx
export function CounterApp() {
  const [count, setCount] = createSignal(0);
  setInterval(() => setCount(c => c + 1), 1000);

  return () => (
    <Screen>
      <Text x={0} y={0} font={SMALL}>Count: {count()}</Text>
      <Pixel x={count() % 128} y={56} />
    </Screen>
  );
}
```

树莓派上跑 `npm start`，屏幕就开始计数，像素点每秒右移。`Ctrl+C` 退出。

---

## 怎么做到的？5 层翻译链

```
React-style JSX
      │  Babel（.babelrc 改 pragma）
      ▼
oled.jsx() 函数调用
      │  自定义 JSX 运行时（120 行）
      ▼
oledWriteString() / oledSetPixel()
      │  koffi FFI（20 行）
      ▼
liboled96.so（C 动态库）
      │  I2C 总线
      ▼
SSD1306 OLED 屏幕
```

### 第 1 层：Babel 改了一行配置

`.babelrc` 里把 JSX 编译目标从 `React.createElement` 改成了 `oled.jsx`：

```json
["@babel/plugin-transform-react-jsx", {
  "pragma": "oled.jsx",
  "pragmaFrag": "oled.Fragment"
}]
```

`<Text x={0}>Hello</Text>` → `oled.jsx(Text, {x:0}, "Hello")`。

**JSX 跟 React 没关系**，它只是一种语法糖，编译成什么函数完全由你决定。

### 第 2 层：自己写了个 JSX 运行时

不依赖 React 或 SolidJS 的渲染器。`jsx()` 函数递归处理组件（大写→调用函数）和内置元素（小写→生成 `{type, props, children}` 对象），然后 `renderElement()` 遍历这棵树，遇到 `text` 节点调 `oledWriteString()`，遇到 `pixel` 节点调 `oledSetPixel()`。

总共 120 行。比 React 的 reconciler 简单 3 个数量级。

### 第 3 层：koffi 让 JS 直接调 C

```javascript
const koffi = require('koffi');
const lib = koffi.load('oled_96/liboled96.so');

const oledWriteString = lib.func('oledWriteString', 'int', [
  'int', 'int', 'string', 'int'
]);
// 现在可以像普通 JS 函数一样调用！
oledWriteString(0, 0, 'Hello', 2);
```

koffi 做的事：加载 `.so` 到进程内存 → 找到 `oledWriteString` 的地址 → 自动做 JS ↔ C 的类型转换 → 返回包装函数。类似 JS 调用 HTTP API，只不过协议是 C ABI 而不是 JSON over HTTP。

### 第 4 层：SolidJS signal 替代 useState

为什么不用 React？因为 React 带了 VDOM diff、Fiber 调度器、合成事件——OLED 屏幕不需要这些。

SolidJS 的 `createSignal` 跟 `useState` 写法一样，但只用了不到 50 行的响应式核心。关键区别：SolidJS 组件只执行一次，signal 变化时只重跑依赖它的 `createRenderEffect`，不需要 diff 整棵树。

**原理 15 行就能写出来：** 每个 signal 维护一个 subscribers Set，getter 被读取时把当前 effect 加入 Set，setter 被调用时遍历通知。就这么简单。

### 第 5 层：C 驱动通过 I2C 控制芯片

`liboled96.so` 是 Larry Bank 写的开源 C 库，把"往 SSD1306 芯片写数据"封装成了 `oledWriteString` / `oledSetPixel` 这样的高层 API。

---

## 为什么值得分享？

这个项目虽小，但集中了前端开发者平时不太接触的几个知识点：

| 你不懂的东西 | 其实就一句话 |
|-------------|------------|
| Makefile | C 世界的 `build.sh`，加了增量编译 |
| `.so` 动态库 | 编译好的 C 代码，类似 npm 包，运行时加载 |
| koffi / FFI | JS 调 C 的翻译层，声明函数签名就能调用 |
| SolidJS signal | `useState` 精瘦版，getter 是函数而非值 |
| 自定义 JSX | Babel pragma 改一行，JSX 就能变成任何东西 |

每个概念拆开都不难，只是平时被"底层"、"编译"这些词吓住了。

---

## 不看 C 代码能跑吗？

能。项目里 4 个实验不需要 OLED 硬件：

1. **测试 FFI**——调用 C 标准库的 `strlen` `pow` `puts`，理解 JS → C 过程（4 行代码）
2. **测试 JSX 运行时**——把渲染目标从 OLED 换成 `console.log`，在任何电脑上跑
3. **手写 signal**——20 行代码写出 `createSignal` 核心机制
4. **不用 JSX 写法**——`h()` 函数调用等价于 JSX，理解编译原理

加上 OLED 硬件的完整 demo，一共 6 个实验。

---

## 更多内容

项目里有一整套课程文档（`course/` 目录），8 节课从 Makefile 讲到全链路串讲，由浅入深，每课 10-15 分钟。如果感兴趣可以自取：

- [课程目录](README.md)
- [第 4 课：FFI & koffi](04-ffi-koffi.md) — JS 如何调 C
- [第 5 课：SolidJS Signal](05-solidjs-signal.md) — 响应式原理
- [第 6 课：JSX 运行时](06-jsx-runtime.md) — 手写 JSX 渲染器
- [第 8 课：动手实验](08-hands-on.md) — 六个实验

---

## 技术栈

SolidJS 1.9 · Babel · koffi 3.0 · C (OLED_96) · SSD1306 128×64 OLED · 树莓派 ARM64

---

*有什么问题随时找我聊，或者直接看 `render-solidjs-to-oled/course/` 下的文档。*
