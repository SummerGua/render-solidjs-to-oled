/**
 * bindings.js — FFI 桥接层
 * 用 koffi 把 C 动态库 liboled96.so 的函数映射为 JS 可调用的函数
 */
const koffi = require('koffi');
const path = require('path');

// 加载 C 动态库
const libPath = path.join(__dirname, '..', 'oled_96', 'liboled96.so');
const lib = koffi.load(libPath);

// 声明 C 函数签名
// koffi 格式: lib.func('C函数名', '返回类型', ['参数类型1', ...])

const oledInit = lib.func('oledInit', 'int', [
  'int',    // iChannel  — I2C 总线号（树莓派 I2C-1）
  'int',    // iAddress  — I2C 地址（通常 0x3C）
  'int',    // iType     — OLED 类型（128=128x64, 32=128x32）
  'int',    // bFlip     — 翻转 180°（0/1）
  'int',    // bInvert   — 反色（0/1）
]);

const oledShutdown = lib.func('oledShutdown', 'void', []);

const oledFill = lib.func('oledFill', 'int', ['uint8']);

const oledWriteString = lib.func('oledWriteString', 'int', [
  'int',    // x — 横坐标（字符宽度单位，FONT_SMALL 时 ×6 像素）
  'int',    // y — 纵坐标（page 单位，1 page = 8 行）
  'string', // szText — 要显示的字符串
  'int',    // iSize — 0=FONT_NORMAL(8x8), 1=FONT_BIG(16x24), 2=FONT_SMALL(6x8)
]);

const oledSetPixel = lib.func('oledSetPixel', 'int', [
  'int',    // x — 横坐标（像素，0-127）
  'int',    // y — 纵坐标（像素，0-63）
  'uint8',  // ucColor — 0=灭, 1=亮
]);

// 字体常量（与 oled96.h 的 FONTSIZE 枚举一致）
const FONT_NORMAL = 0;  // 8×8
const FONT_BIG    = 1;  // 16×24
const FONT_SMALL  = 2;  // 6×8

// OLED 类型常量
const OLED_128x64 = 128;
const OLED_128x32 = 32;

module.exports = {
  oledInit,
  oledShutdown,
  oledFill,
  oledWriteString,
  oledSetPixel,
  FONT_NORMAL,
  FONT_BIG,
  FONT_SMALL,
  OLED_128x64,
  OLED_128x32,
};
