# 第 4 课：FFI 与 koffi——从 JS 调用 C 函数

## 你会学到什么

- FFI 是什么，为什么需要它
- koffi 干了什么——用一个 3 行的例子讲清楚
- 逐行解剖 `bindings.js`
- 自己写一个 FFI 调用

---

## 4.1 问题：JS 和 C 是两个世界

你有一个 C 函数，编译在 `liboled96.so` 里：

```c
// 参数1: I2C 通道号
// 参数2: I2C 地址
// 参数3: 屏幕类型 (128 = 128×64)
// 参数4: 是否翻转
// 参数5: 是否反色
// 返回值: 0 成功, 1 失败
int oledInit(int iChannel, int iAddress, int iType, int bFlip, int bInvert);
```

你想在 Node.js 里调用它：

```javascript
const result = oledInit(1, 0x3C, 128, 0, 0);
// result 应该是 0 或 1
```

**但 JS 不认识 C 函数。** JS 引擎只能执行 JavaScript，不能直接跳转到 `.so` 里的机器码。你需要一个翻译官。

---

## 4.2 翻译官 FFI

**FFI = Foreign Function Interface**（外部函数接口）

它可以：
1. 加载 `.so` 文件到内存
2. 找到你要的函数地址
3. 把 JS 的参数转换成 C 能理解的格式
4. 调用 C 函数
5. 把 C 的返回值转换成 JS 能理解的格式

```
JavaScript                     C
──────────          ┌──────────────┐       ──────────
const n =          │              │       int oledInit(
  oledInit(1,      │    FFI       │         int channel,
    0x3C, 128,     │   翻译层      │         int addr,
    0, 0);         │              │         int type,
                   │              │         int flip,
JS 返回值 ←────────┤              ├─────→   int invert)
  number           └──────────────┘       C 返回值 int
```

### 不用 FFI 行不行？

只有一种替代方案：写 Node.js 原生扩展（C++ addon），用 N-API。这需要在 C++ 里按照 Node 的规范写包装代码，编译成 `.node` 文件。工作量大得多。

FFI 的优势：**不需要改 C 代码**。任何现有的 `.so` 文件，直接加载就能调用。

---

## 4.3 最小示例：用 koffi 调用 C 标准库

在讲项目代码之前，先写一个你立刻能跑的 3 行例子。

C 标准库 `libc.so.6`（每台 Linux 都有）里有个函数：

```c
double cos(double x);  // 计算余弦
```

在 JS 里调用它：

```javascript
// 1. 引入 koffi
const koffi = require('koffi');

// 2. 加载动态库
const libc = koffi.load('libc.so.6');

// 3. 声明 C 函数签名
const cos = libc.func('cos', 'double', ['double']);
//                              │        │
//                              │        └── 参数类型
//                              └── 返回值类型

// 4. 直接调用！
console.log(cos(0));       // 1.0
console.log(cos(Math.PI)); // -1.0
```

**这 4 行代码就是 FFI 的全部精髓。** koffi 做的事情：

1. `koffi.load('libc.so.6')` → 调用操作系统的 `dlopen()`，把 `.so` 加载到当前进程的内存空间
2. `libc.func('cos', 'double', ['double'])` → 调用 `dlsym()` 找到 `cos` 函数的内存地址，然后基于类型信息生成一个 JS 包装函数
3. `cos(0)` → 包装函数把 JS 的 `number` 0 转成 C 的 `double` 0.0，调用真正的 `cos()`，把 C 的返回值 `double` 转回 JS 的 `number`（即 1.0）

```
cos(0)  ← JS 调用
   │
   ▼
koffi 包装函数:
  1. JS number 0 → C double 0.0
  2. 跳转到 libc.so 里 cos() 的真实地址
  3. C double 1.0 → JS number 1
  4. 返回 1
```

---

## 4.4 koffi 的类型系统

koffi 需要知道每个参数和返回值的 C 类型，才能正确地在 JS 和 C 之间转换数据。

常见类型映射：

| Koffi 字符串 | C 类型 | JS 类型 | 大小 |
|-------------|--------|---------|------|
| `'int'` | `int` | `number` | 4 字节 |
| `'double'` | `double` | `number` | 8 字节 |
| `'uint8'` | `unsigned char` | `number` | 1 字节 |
| `'string'` | `char *` | `string` | 指针 |
| `'void'` | `void` | `undefined` | 无返回值 |

---

## 4.5 再一个例子：有副作用的函数

`libc.so.6` 里还有个 `puts` 函数：

```c
int puts(const char *str);  // 打印字符串到 stdout，返回非负整数
```

用 koffi 调用：

```javascript
const koffi = require('koffi');
const libc = koffi.load('libc.so.6');

const puts = libc.func('puts', 'int', ['string']);

puts('你好 OLED！'); // 终端打印：你好 OLED！
```

这证明了 FFI 不仅能传数字，还能传字符串。koffi 在内部做了：
- JS string → C `char *`（以 `\0` 结尾的字节数组）
- 分配临时内存，调用 `puts()`，释放临时内存

---

## 4.6 逐行解剖 bindings.js

现在打开 `src/bindings.js`，一行一行读：

### 加载库

```javascript
const koffi = require('koffi');
const path = require('path');

const libPath = path.join(__dirname, '..', 'oled_96', 'liboled96.so');
const lib = koffi.load(libPath);  // ← 加载我们自己编译的 .so
```

`__dirname` 是当前文件所在目录（`src/`），`..` 回到项目根目录，然后进入 `oled_96/liboled96.so`。

### 声明 oledInit

```javascript
const oledInit = lib.func('oledInit', 'int', [
  'int',    // iChannel  — I2C 通道号（树莓派用 1）
  'int',    // iAddress  — I2C 设备地址（通常是 0x3C）
  'int',    // iType     — 屏幕类型（128 = 128×64）
  'int',    // bFlip     — 是否翻转 180 度
  'int',    // bInvert   — 是否反色
]);
```

对应 C 函数签名：

```c
int oledInit(int iChannel, int iAddress, int iType, int bFlip, int bInvert);
```

返回 0 表示成功，1 表示失败。

### 声明 oledShutdown

```javascript
const oledShutdown = lib.func('oledShutdown', 'void', []);
```

对应：

```c
void oledShutdown(void);
```

无参数，无返回值。就是关掉 OLED 并释放 I2C 资源。

### 声明 oledFill

```javascript
const oledFill = lib.func('oledFill', 'int', ['uint8']);
```

对应：

```c
int oledFill(unsigned char ucPattern);
```

- `'uint8'` = 无符号 8 位整数 = C 的 `unsigned char`
- `ucPattern`：填充模式，0 表示清屏（全黑），0xFF 表示全亮

### 声明 oledWriteString

```javascript
const oledWriteString = lib.func('oledWriteString', 'int', [
  'int',    // x — 横坐标（字符宽度单位，FONT_SMALL 时每字 6 像素）
  'int',    // y — 纵坐标（page 单位，1 page = 8 行）
  'string', // szText — 要显示的文字
  'int',    // iSize — 字体大小 (0=8×8, 1=16×24, 2=6×8)
]);
```

对应：

```c
int oledWriteString(int x, int y, char *szText, int iSize);
```

注意 `'string'` 类型——koffi 自动把 JS 字符串转成 C 的 `char *`。

### 声明 oledSetPixel

```javascript
const oledSetPixel = lib.func('oledSetPixel', 'int', [
  'int',    // x — 横坐标（像素，0-127）
  'int',    // y — 纵坐标（像素，0-63）
  'uint8',  // ucColor — 0 = 灭, 1 = 亮
]);
```

对应：

```c
int oledSetPixel(int x, int y, unsigned char ucPixel);
```

### 常量定义

```javascript
const FONT_NORMAL = 0;  // 8×8
const FONT_BIG    = 1;  // 16×24
const FONT_SMALL  = 2;  // 6×8
```

这些值必须和 `oled96.h` 里的 C 枚举一致：

```c
typedef enum {
   FONT_NORMAL = 0,
   FONT_BIG,          // = 1
   FONT_SMALL         // = 2
} FONTSIZE;
```

**如果 JS 这边常量写错了，C 函数就会用错误的字体参数——编译器不会帮你检查，因为它根本不知道 JS 这边在干嘛。** 这是 FFI 的风险之一。

### 导出

```javascript
module.exports = {
  oledInit, oledShutdown, oledFill,
  oledWriteString, oledSetPixel,
  FONT_NORMAL, FONT_BIG, FONT_SMALL,
};
```

这样 `oled-renderer.js` 就可以 `require('./bindings')` 拿到这些函数。

---

## 4.7 koffi 内部做了什么？（深入但不必须）

当你调用 `lib.func('oledInit', 'int', ['int', 'int', 'int', 'int', 'int'])` 时，koffi 内部：

```
1. dlsym(lib, "oledInit")
   → 在 liboled96.so 的符号表里找到 oledInit 的内存地址
   → 比如 0x7f8a4c001200

2. 基于类型信息 ['int','int','int','int','int'] → 'int'
   生成一个包装函数（用 libffi 库）

   包装函数伪代码：
   function wrapper(channel, addr, type, flip, invert) {
     // JS number → C int（截断小数，检查范围）
     // 把 5 个 int 放入寄存器/栈（遵循 ABI 调用约定）
     // CALL 0x7f8a4c001200
     // C int 返回值 → JS number
     return result;
   }

3. 返回 wrapper 函数给 JS 端
```

---

## 4.8 自己动手：写一个 FFI demo

创建一个文件测试一下（不用 OLED）：

```javascript
// test-ffi.js
const koffi = require('koffi');

// 加载 C 标准库
const libc = koffi.load('libc.so.6');

// 声明 puts 和 strlen
const puts = libc.func('puts', 'int', ['string']);
const strlen = libc.func('strlen', 'int', ['string']);
const pow = libc.func('pow', 'double', ['double', 'double']);

puts('=== FFI 测试 ===');
console.log('strlen("Hello") =', strlen('Hello')); // 5
console.log('pow(2, 10) =', pow(2, 10));          // 1024.0
```

运行：

```bash
node test-ffi.js
```

输出：
```
=== FFI 测试 ===
strlen("Hello") = 5
pow(2, 10) = 1024
```

你在 JavaScript 里直接调用了 C 标准库的函数。这就是 FFI。

---

## 4.9 小结

| 概念 | 一句话 |
|------|--------|
| FFI | JS 和 C 之间的翻译官 |
| koffi | Node.js 的 FFI 库 |
| `koffi.load(path)` | 加载 `.so` 到内存 |
| `lib.func(name, ret, args)` | 声明函数签名，获取 JS 包装函数 |
| 类型字符串 | `'int'` `'double'` `'string'` `'uint8'` `'void'` 等 |

**bindings.js 的本质：** 就是把 5 个 C 函数的签名"声明"给 koffi，然后导出给上层用。没有任何业务逻辑，纯粹是桥接。

**下一步 →** [第 5 课：SolidJS Signal——响应式编程入门](05-solidjs-signal.md)
