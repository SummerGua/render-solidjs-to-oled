const koffi = require('koffi');
const os = require('os');

// 跨平台：根据操作系统选择正确的库
const platform = os.platform(); // 'linux' | 'darwin' | 'win32'

let libm;
if (platform === 'linux') {
  libm = koffi.load('libm.so.6');   // Linux: 数学函数在独立库
} 

// 始终从 libm 取数学函数
const cos = libm.func('cos', 'double', ['double']);

console.log(cos(0));       // 1.0
console.log(cos(Math.PI)); // -1.0
