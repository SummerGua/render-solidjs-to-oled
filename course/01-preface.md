# 第 1 课：前言——这个项目到底干了什么？

## 你是谁？

假设你是这样一个开发者：

- ✅ 写过 React / Vue 前端，JSX、组件、state 这些很熟
- ✅ 大学上过 C 语言课，知道 `printf`、指针、`gcc` 这些词，但也就到这了
- ❌ 没碰过 Makefile，看到 `CC = gcc` 就头疼
- ❌ 不知道 `.so` 是什么，不知道为什么 JS 能调用 C 函数
- ❌ 没接触过 SolidJS，`createSignal` 和 `createRenderEffect` 像天书

**这门课就是为你准备的。** 8 节课，从零开始，用这个项目当活教材，把所有"不懂"变成"原来如此"。

---

## 这个项目在做什么？

一句话：**用 React 写 UI 的方式，驱动一块物理 OLED 屏幕。**

你用 JSX 写组件：

```jsx
<Screen>
  <Text x={0} y={0} font={SMALL}>Hello OLED!</Text>
  <Pixel x={42} y={42} />
</Screen>
```

然后这块 128×64 像素的小屏幕就真的显示出来了。数据变化时屏幕自动刷新——跟 React 的 `setState` 触发 re-render 一个道理。

---

## 技术栈全景图

```
你的 JSX 代码（app.jsx）
        │
        ▼
  Babel 编译：JSX → oled.jsx() 函数调用
        │
        ▼
  自定义 JSX 运行时（oled-renderer.js）
  把组件树翻译成：oledWriteString() / oledSetPixel()
        │
        ▼
  koffi FFI 桥接层（bindings.js）
  把 JS 函数调用转发给 C 动态库
        │
        ▼
  liboled96.so（C 编译产物）
  通过 I2C 总线操作 SSD1306 芯片
        │
        ▼
  OLED 物理屏幕亮起！
```

---

## 为什么要学这个项目？

这个项目虽然小，但踩到了前端开发者知识体系的**每一个盲区**：

| 你不懂的 | 对应课程 | 其实没那么难 |
|----------|---------|------------|
| Makefile 是什么 | 第 2 课 | 就是个"编译脚本"，比 webpack config 简单 |
| `.o` `.so` 是什么 | 第 3 课 | 类比 JS 的 `.js` → 浏览器执行的流程 |
| JS 怎么能调用 C | 第 4 课 | 类比 `fetch` 调用 HTTP API，只是协议不同 |
| `createSignal` 干嘛的 | 第 5 课 | 就是 `useState`，但更纯粹 |
| JSX 怎么变成渲染指令 | 第 6 课 | 就是 React 的 `createElement`，自己写一遍就懂了 |

---

## 课程地图

| 课 | 主题 | 核心问题 |
|----|------|---------|
| 01 | 前言 | 这个项目是什么 |
| 02 | Makefile | 为什么敲 `make` 就能编译？ |
| 03 | C 编译全流程 | `.c` → `.o` → `.so` 是怎么回事 |
| 04 | FFI & koffi | JS 如何"遥控" C 函数 |
| 05 | SolidJS Signal | 比 React 更"薄"的响应式 |
| 06 | JSX 运行时 | 亲手写一个 JSX 渲染器 |
| 07 | 全链路串讲 | `npm start` 按下去后发生了什么 |
| 08 | 动手实验 | 改造代码，真正学会 |

---

## 准备工作

把项目代码放在手边，每节课会告诉你打开哪个文件对照着看。

```bash
cd render-solidjs-to-oled
ls src/      # JS 源码
ls oled_96/  # C 驱动代码
```

**开始吧 →** [第 2 课：Makefile 从零开始](02-makefile.md)
