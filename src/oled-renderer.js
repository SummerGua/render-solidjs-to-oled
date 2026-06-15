/**
 * oled-renderer.js — OLED 渲染器（简化版）
 *
 * 自定义 JSX pragma，直接把 JSX → 元素描述对象 → OLED。
 * 不依赖 babel-preset-solid 的 universal 模式。
 */
const { createRoot, createRenderEffect } = require('solid-js/dist/solid.cjs');
const { oledInit, oledShutdown, oledFill, oledWriteString, oledSetPixel, FONT_SMALL } = require('./bindings');

let initialized = false;

// ============================================================
// 自定义 JSX 运行时（替代 babel-preset-solid universal）
// ============================================================

/**
 * jsx — JSX 工厂函数
 * <Text x={0}>hi</Text> → jsx(Text, { x: 0, children: "hi" })
 */
function jsx(type, props, ...children) {
  // babel classic: jsx(type, props, ...children)
  // props 可能为 null（无属性时）
  const allProps = props || {};

  // 合并 children：props.children 和额外参数
  let kids = children.length > 0 ? children : allProps.children;
  if (kids && !Array.isArray(kids)) kids = [kids];

  // 组件：大写 → 调用函数
  if (typeof type === 'function') {
    return type({ ...allProps, children: kids });
  }

  // 内置元素：小写 → 创建元素对象
  return { type, props: allProps, children: normalizeChildren(kids) };
}

function jsxs(type, props) { return jsx(type, props); }
function Fragment(props) { return props.children; }

function normalizeChildren(children) {
  if (children == null || children === false) return [];
  if (!Array.isArray(children)) return [children];
  const result = [];
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) result.push(...normalizeChildren(c));
    else result.push(c);
  }
  return result;
}

// ============================================================
// 渲染到 OLED
// ============================================================

function renderElement(el) {
  if (el == null) return;
  if (typeof el === 'string' || typeof el === 'number') {
    // 文本节点：这里只是占位，实际由 renderText 处理
    return;
  }
  if (typeof el === 'function') {
    // reactive expression: {count()} → 调用取值
    renderElement(el());
    return;
  }

  switch (el.type) {
    case 'screen':
      for (const child of el.children) renderElement(child);
      break;
    case 'text': {
      const x = el.props.x ?? 0;
      const y = el.props.y ?? 0;
      const font = el.props.font ?? FONT_SMALL;
      let str = '';
      for (const child of el.children) {
        if (typeof child === 'string' || typeof child === 'number') str += String(child);
        else if (typeof child === 'function') str += String(child());
      }
      oledWriteString(x, y, str, font);
      break;
    }
    case 'pixel':
      oledSetPixel(el.props.x ?? 0, el.props.y ?? 0, el.props.on !== false ? 1 : 0);
      break;
  }
}

function render(code) {
  if (!initialized) {
    if (oledInit(1, 0x3C, 128, 0, 0) !== 0) {
      console.error('❌ OLED 初始化失败'); process.exit(1);
    }
    initialized = true;
    console.log('🟢 OLED 已初始化');
  }

  // 只执行一次：创建 signals，返回读取器函数
  const getTree = code();
  if (typeof getTree !== 'function') {
    throw new Error('App 必须返回 () => JSX，而不是直接返回 JSX');
  }

  createRoot((dispose) => {
    createRenderEffect(() => {
      oledFill(0);
      const tree = getTree();  // 每次 effect 运行时调用，追踪 signal
      renderElement(tree);
    });

    const cleanup = () => { oledFill(0); oledShutdown(); console.log('\n👋 OLED 已关闭'); dispose(); process.exit(0); };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
  console.log('🚀 SolidJS OLED JSX 渲染器\n按 Ctrl+C 退出\n');
}

module.exports = { jsx, jsxs, Fragment, render };
