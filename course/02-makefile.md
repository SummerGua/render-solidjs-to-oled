# 第 2 课：Makefile 从零开始

## 你会学到什么

- Makefile 到底是干嘛的——一个你早就会用的东西
- 逐行读懂本项目的 Makefile
- `make` / `make run` / `make clean` 背后发生了什么

---

## 2.1 先忘掉 C 语言——用前端类比

假设你有个前端项目，每次部署前要跑三步：

```bash
npx tsc app.ts -o app.js       # 编译 TypeScript
npx terser app.js -o app.min.js # 压缩
cp app.min.js ../dist/          # 复制到部署目录
```

每次改完代码都要手动敲这三条命令，很烦。你自然会想到：

> 写个脚本，一键执行！

于是你写了个 `build.sh`：

```bash
#!/bin/bash
npx tsc app.ts -o app.js
npx terser app.js -o app.min.js
cp app.min.js ../dist/
echo "✅ 部署完成"
```

**Makefile 就是 C 语言世界的 `build.sh`**——只是语法不同，功能完全一样：把编译步骤写下来，然后一键执行。

---

## 2.2 为什么叫 "Make"？

`make` 比 shell 脚本多一个关键能力：**增量编译。**

你的项目有 3 个 `.c` 文件。如果你只改了 `demo.c`，那两个没改的 `.c` 不需要重新编译。`make` 会比较文件修改时间，只编译"过期"的文件。

类比前端：你只改了 `Header.tsx`，webpack 不会重新编译整个 `node_modules`。webpack 的增量编译思想就是从 `make` 学的。

---

## 2.3 逐行解剖本项目的 Makefile

打开项目根目录的 `Makefile`，我们一行一行读：

### 第 1-5 行：变量定义

```makefile
CC     = gcc
CFLAGS = -Wall -O2 -I./oled_96
LIBS   = -lm -lpthread
OBJS   = demo.o oled_96/oled96.o oled_96/fonts.o
TARGET = output
```

这就是"配置区"，和你在 `package.json` 里定义 `scripts` 一个道理：

| 变量 | 值 | 含义（前端类比） |
|------|-----|-----------------|
| `CC` | `gcc` | 编译器 = `tsc` |
| `CFLAGS` | `-Wall -O2 -I./oled_96` | 编译选项 = `tsconfig.json` |
| `LIBS` | `-lm -lpthread` | 链接的库 = `dependencies` |
| `OBJS` | `demo.o oled_96/oled96.o ...` | 中间产物列表 |
| `TARGET` | `output` | 最终产物 = webpack 的 `output.filename` |

逐个解释 `CFLAGS` 里的参数：

| 参数 | 含义 |
|------|------|
| `-Wall` | 开启所有警告（"W" = Warning, "all" = 全部） |
| `-O2` | 优化级别 2（让编译出的程序跑得更快） |
| `-I./oled_96` | 告诉编译器去 `oled_96/` 目录找头文件（`#include "oled96.h"`） |

`LIBS` 里的参数：

| 参数 | 含义 |
|------|------|
| `-lm` | 链接数学库（`math.h`，如 `sin` `cos`） |
| `-lpthread` | 链接线程库（多线程支持） |

> 前缀 `-l` 代表 "library"。`-lm` 就是 "link the math library"。

---

### 第 8-9 行：默认目标

```makefile
all: $(TARGET)
	@echo "✅ 编译完成！运行：./$(TARGET)"
```

- `all` 是默认目标的名字——当你直接敲 `make` 不带参数时，就执行这个
- `$(TARGET)` 被替换成 `output`
- `all: $(TARGET)` 的意思是："要完成 all，先得完成 output"
- `@echo` 前面的 `@` 表示"只输出结果，不输出命令本身"

---

### 第 12-13 行：链接——把 .o 拼成可执行文件

```makefile
$(TARGET): $(OBJS)
	$(CC) $^ -o $@ $(LIBS)
```

展开后实际执行：

```bash
gcc demo.o oled_96/oled96.o oled_96/fonts.o -o output -lm -lpthread
```

两个自动变量：

| 变量 | 含义 |
|------|------|
| `$^` | 所有依赖项（`:` 右边的全部） |
| `$@` | 目标名（`:` 左边） |

这一步叫**链接（link）**——把多个 `.o` 文件拼成一个可执行文件。第 3 课会详细讲。

---

### 第 16-25 行：编译——把 .c 变成 .o

```makefile
demo.o: demo.c
	$(CC) $(CFLAGS) -c $< -o $@
```

展开后：

```bash
gcc -Wall -O2 -I./oled_96 -c demo.c -o demo.o
```

| 参数 | 含义 |
|------|------|
| `-c` | "compile only"——只编译，不链接 |
| `$<` | 第一个依赖项（`demo.c`） |
| `$@` | 目标（`demo.o`） |

三条编译规则结构完全一样，只是文件名不同：

```makefile
demo.o: demo.c                  # 把 demo.c 编译成 demo.o
oled_96/oled96.o: oled_96/oled96.c  # 把 oled96.c 编译成 oled96.o
oled_96/fonts.o: oled_96/fonts.c    # 把 fonts.c 编译成 fonts.o
```

---

### 第 28-29 行：run 目标

```makefile
run: all
	./$(TARGET)
```

`run` 依赖 `all`，所以 `make run` 会先编译，再运行 `./output`。

---

### 第 32-34 行：clean 目标

```makefile
clean:
	rm -f $(OBJS) $(TARGET)
	@echo "🧹 清理完成"
```

删除所有编译产物。`-f` 是 "force"——文件不存在也不报错。

---

### 第 36 行：.PHONY

```makefile
.PHONY: all run clean
```

告诉 `make`：`all`、`run`、`clean` 是"伪目标"——它们不是真实的文件名。没有这一行，如果目录里恰好有个叫 `clean` 的文件，`make clean` 就会出错。

---

## 2.4 执行流程图

```
make
  │
  └─→ all 依赖 output
        │
        └─→ output 依赖 demo.o + oled96.o + fonts.o
              │
              ├─→ demo.o 依赖 demo.c    ─→ gcc -c demo.c -o demo.o
              ├─→ oled96.o 依赖 oled96.c ─→ gcc -c oled96.c -o oled96.o
              └─→ fonts.o 依赖 fonts.c   ─→ gcc -c fonts.c -o fonts.o
              │
              └─→ gcc demo.o oled96.o fonts.o -o output -lm -lpthread
```

**关键洞察：** `make` 不是按 Makefile 里的书写顺序执行的。它是按**依赖关系**——从最终目标往回推导，构建一棵依赖树，然后从叶子节点开始执行。

这和 webpack 的依赖解析逻辑一模一样——从入口文件开始，构建依赖图，然后从叶子模块开始打包。

---

## 2.5 如果不用 Makefile 呢？

你完全可以手动完成所有步骤：

```bash
# 编译三个 .c 文件
gcc -Wall -O2 -I./oled_96 -c demo.c -o demo.o
gcc -Wall -O2 -I./oled_96 -c oled_96/oled96.c -o oled_96/oled96.o
gcc -Wall -O2 -I./oled_96 -c oled_96/fonts.c -o oled_96/fonts.o

# 链接成可执行文件
gcc demo.o oled_96/oled96.o oled_96/fonts.o -o output -lm -lpthread

# 运行
./output
```

Makefile 的价值仅仅是：
1. 不用每次都敲这么多命令
2. 改一个文件时只重编译该文件（增量编译）
3. 别人拿到代码，`make` 一下就能跑

就这些。没什么魔法。

---

## 2.6 小结

| Makefile 概念 | 前端类比 |
|--------------|---------|
| `make` | `npm run build` |
| 目标（target） | npm script 名字 |
| 依赖（dependencies） | script 里的 `&&` 串联 |
| 变量 | webpack config 里的变量 |
| `.PHONY` | 没啥好比的，就是声明"这是命令名不是文件名" |

**下一步 →** [第 3 课：C 语言编译全流程——.c → .o → .so](03-c-compilation.md)
