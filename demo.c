#include <stdint.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "oled96.h"

int main(int argc, char *argv[])
{
    // 初始化
    int iChannel = 1, bFlip = 0, bInvert = 0;
    int iOLEDAddr = 0x3c;
    int iOLEDType = OLED_128x64;
    oledInit(iChannel, iOLEDAddr, iOLEDType, bFlip, bInvert);

    // 清屏后渲染文字和像素
    oledFill(0);
    oledWriteString(0, 0, "Hello OLED!", FONT_SMALL);
    oledSetPixel(42, 42, 1);

    // 在用户输入后关闭屏幕
    printf("Press ENTER to quit!\n");
    getchar();
    oledShutdown();
}
