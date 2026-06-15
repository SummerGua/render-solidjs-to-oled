CC     = gcc
CFLAGS = -Wall -O2 -I./oled_96
LIBS   = -lm -lpthread
OBJS   = demo.o oled_96/oled96.o oled_96/fonts.o
TARGET = output

# 默认目标：编译
all: $(TARGET)
	@echo "✅ 编译完成！运行：./$(TARGET)"

# 链接所有 .o 文件生成可执行文件
$(TARGET): $(OBJS)
	$(CC) $^ -o $@ $(LIBS)

# 编译 demo.c
demo.o: demo.c
	$(CC) $(CFLAGS) -c $< -o $@

# 编译 OLED 驱动
oled_96/oled96.o: oled_96/oled96.c
	$(CC) $(CFLAGS) -c $< -o $@

# 编译字体数据
oled_96/fonts.o: oled_96/fonts.c
	$(CC) $(CFLAGS) -c $< -o $@

# 运行
run: all
	./$(TARGET)

# 清理
clean:
	rm -f $(OBJS) $(TARGET)
	@echo "🧹 清理完成"

.PHONY: all run clean
