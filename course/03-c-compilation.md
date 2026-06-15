# 第 3 课：C 语言编译全流程—— .c → .o → .so

## 你会学到什么

- C 语言从源码到可运行经历了什么
- `.o` 文件是什么，`.so` 文件又是什么
- 静态链接 vs 动态链接——用 JavaScript 类比
- 为什么这个项目需要 `liboled96.so`

---

## 3.1 用 JavaScript 的视角来理解

在 JS 世界，你写 `app.js`，然后 `node app.js` 直接跑。C 语言不是这样的——它必须**先编译，再运行。**

但类比可以帮助理解：

| 概念 | JavaScript 世界 | C 语言世界 |
|------|----------------|-----------|
| 源码 | `app.ts` | `demo.c` |
| 编译 | `tsc app.ts` → `app.js` | `gcc -c demo.c` → `demo.o` |
| 中间产物 | `.js`（TS 编译后） | `.o`（object file，目标文件） |
| 最终产物 | 直接 `node app.js` 跑 | 需要链接成 `./output` 才能跑 |
| 可复用库 | `npm install lodash` | `liboled96.so`（动态库） |

---

## 3.2 C 编译的四步流水线

从 `.c` 到可执行文件，gcc 内部经过 4 步。你通常不需要关心前两步，但知道全貌有助于理解：

```
demo.c
  │  (1) 预处理器 Preprocessor
  │  处理 #include, #define 等指令
  │  把 #include "oled96.h" 替换为 oled96.h 的完整内容
  ▼
demo.i  （预处理后的纯 C 代码，几万行）
  │  (2) 编译器 Compiler
  │  把 C 代码翻译成汇编语言
  ▼
demo.s  （汇编代码）
  │  (3) 汇编器 Assembler
  │  把汇编翻译成机器指令（二进制）
  ▼
demo.o  （目标文件，机器码 + 符号表）
  │  (4) 链接器 Linker
  │  把多个 .o 拼起来，解析函数地址
  ▼
output  （可执行文件）
```

平时你看到的是合并后的两步：

```bash
gcc -c demo.c -o demo.o       # 步骤 1-3：编译成 .o
gcc demo.o ... -o output      # 步骤 4：链接成可执行文件
```

---

## 3.3 .o 文件是什么？

`.o`（object file）就是"编译了但还没链接"的文件。它包含：

1. **机器码**——你的 C 函数编译后的二进制指令
2. **符号表**——一张"我提供了什么"和"我还需要什么"的清单

用 `nm` 命令看看 `.o` 里的符号表：

```bash
nm demo.o | head -10
# 输出类似：
#                  U oledFill       ← U = Undefined，"我需要 oledFill 这个函数"
#                  U oledInit       ← 同上，我还需要 oledInit
#                  U oledSetPixel
#                  U oledShutdown
#                  U oledWriteString
# 0000000000000000 T main          ← T = Text，"我提供了 main 函数"
```

JavaScript 类比：

`.o` 文件就像 webpack 打包前的某个模块——比如 `Header.js`。它里面 `import` 了 `React` 和 `useState`，但自己并不包含 React 的代码。只有 webpack 把所有模块链接（bundle）到一起后，`React` 才是真实可用的。

---

## 3.4 链接是什么？

链接就是把所有 `.o` 中"我需要"的符号，和"我提供了"的符号匹配起来。

```
demo.o:        我需要 oledInit, oledWriteString, oledSetPixel...
                       │
                       ▼ 链接器去找
oled96.o:      我提供了 oledInit, oledWriteString, oledSetPixel!
fonts.o:       我提供了字体数据
                       │
                       ▼
              output（完整的可执行文件）
```

JavaScript 类比：

```javascript
// button.js  —— 类似 .o 文件
import { createElement } from 'react';  // "我需要 createElement"
export function Button() { ... }        // "我提供了 Button"

// webpack bundle  —— 类似链接后的 output
// React 的代码 + Button 的代码 → 一个完整的 bundle.js
```

---

## 3.5 静态库 vs 动态库

这是重点，因为本项目同时用到了两者。

### 静态库（`.a`）

链接时把库的代码**复制**到你的可执行文件里。

```
编译链接时：libm.a 的代码 → 复制进 output
结果：output 变大，但运行时不需要 libm.a 了
```

类比：把 lodash 整个打进 `bundle.js`。

### 动态库（`.so`）

链接时只记录"我需要这个库"，运行时才去**加载**。

```
编译链接时：只记录"output 运行需要 liboled96.so"
结果：output 很小，但运行时必须能找到 liboled96.so
```

类比：webpack 的 `externals`——把 React 标记为 external，运行时从 CDN 加载。

| | 静态库 `.a` | 动态库 `.so` |
|---|---|---|
| 链接时机 | 编译时 | 运行时 |
| 产物大小 | 大（代码复制进去了） | 小（只记录了引用） |
| 更新库 | 需要重新编译 | 替换 .so 文件即可 |
| 类比 | webpack bundle all | webpack externals |

### Makefile 里的 `-lm` 和 `-lpthread`

```makefile
LIBS = -lm -lpthread
```

- `-lm`：链接 `libm.so`（数学库，提供 `sin`、`cos` 等）
- `-lpthread`：链接 `libpthread.so`（线程库）

这些都是系统自带的动态库。

---

## 3.6 .so 怎么编译出来？

`oled_96/` 目录下有个预编译好的 `liboled96.so`。如果你想自己编译：

```bash
cd oled_96
gcc -fPIC -shared -o liboled96.so oled96.c fonts.c -lpthread -lm
```

两个关键参数：

| 参数 | 含义 |
|------|------|
| `-fPIC` | "Position Independent Code"——生成与位置无关的代码，动态库必需 |
| `-shared` | 告诉 gcc 你要生成动态库，不是可执行文件 |

---

## 3.7 为什么 JS 要用 .so？

现在回到项目本身。我们的目标是：

> 在 Node.js 中调用 C 函数 `oledInit()`、`oledWriteString()` 来操作 OLED 屏幕。

Node.js 是用 C++ 写的，它提供了一个叫 **FFI（Foreign Function Interface）** 的机制，可以加载 `.so` 文件并调用里面的函数。

具体怎么做？下一课讲。

---

## 3.8 小结

```
源码            编译产物           链接产物
demo.c    ──→  demo.o    ──┐
oled96.c  ──→  oled96.o  ──┤──→ output（可执行文件，含 main）
fonts.c   ──→  fonts.o   ──┘

oled96.c  ──→ liboled96.so（动态库，可以被 JS 加载）
fonts.c
```

- `.o` = 编译了但还没链接的模块
- `.so` = 共享库，运行时加载
- 链接 = 把"我需要"和"我提供"匹配起来

**下一步 →** [第 4 课：FFI 与 koffi——从 JS 调用 C 函数](04-ffi-koffi.md)
