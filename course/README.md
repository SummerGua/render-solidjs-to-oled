# SolidJS → OLED 开发课程

## 面向谁

- React / Vue 前端开发者（JSX、组件、state 这些很熟）
- C 语言只有大学基础课水平（知道 `printf`、`gcc`，但没写过项目）
- 不了解 Makefile、动态库、FFI、SolidJS
- **想做 side project 但被底层知识挡住的开发者**

## 学完能收获什么

- 理解 Makefile 的本质（比 webpack config 简单）
- 理解 C 语言从源码到可执行的完整流程
- 能写出 JS 调用 C 函数的代码（FFI / koffi）
- 理解 SolidJS signal 的响应式原理（15 行代码实现核心）
- 理解 JSX 不是 React 专属的——能自己写 JSX 运行时
- 在脑海中跑通整个项目的完整执行路径

## 课程列表

| 课 | 主题 | 核心问题 | 依赖 |
|----|------|---------|------|
| [01](01-preface.md) | 前言 | 这个项目是什么，为什么要学 | — |
| [02](02-makefile.md) | Makefile | 为什么敲 `make` 就能编译？| — |
| [03](03-c-compilation.md) | C 编译全流程 | `.c` → `.o` → `.so` 是怎么回事 | 02 |
| [04](04-ffi-koffi.md) | FFI & koffi | JS 如何"遥控" C 函数 | 03 |
| [05](05-solidjs-signal.md) | SolidJS Signal | 比 React useState 更"薄"的响应式 | — |
| [06](06-jsx-runtime.md) | JSX 运行时 | 亲手写一个 JSX 渲染器 | 05 |
| [07](07-full-pipeline.md) | 全链路串讲 | `npm start` 按下去后发生了什么 | 02-06 |
| [08](08-hands-on.md) | 动手实验 | 改造代码，真正学会 | 01-07 |

## 学习路径

```
          ┌─→ 02 Makefile ──→ 03 C编译 ──→ 04 FFI/koffi ──┐
01 前言 ──┤                                                  ├─→ 07 全链路 ──→ 08 动手
          └─→ 05 Signal ──────→ 06 JSX运行时 ──────────────┘
```

两条主线可以独立学习，最后在 07 汇合：
- **底层线**（2→3→4）：从 Makefile 到 C 编译到 FFI 调用
- **UI 线**（5→6）：从 SolidJS 信号到自定义 JSX 运行时

## 建议

1. **顺序读**——每课都标注了依赖的前置课程
2. **打开项目对照**——每课会告诉你打开哪个文件
3. **动手跑实验**——第 8 课有 6 个实验，不需要 OLED 硬件就能跑 4 个
4. **遇到不懂的术语别跳过**——课程设计就是为了让你不需要 Google

## 课时

每课约 10-15 分钟阅读，实验部分另计。全部学完大约 2 小时。
