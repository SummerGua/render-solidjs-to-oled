/**
 * run.js — 入口：注册 babel 编译 JSX，然后加载应用
 */
require('@babel/register')({
  extensions: ['.jsx'],
  only: [__dirname],
});

require('./run.jsx');
