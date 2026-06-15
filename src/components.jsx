/**
 * components.jsx — OLED UI 组件
 *
 * 每个 .jsx 文件顶部需要：
 *   import oled from './oled-renderer'
 * 这样 JSX 编译为 oled.jsx(Component, props)
 */
import oled from './oled-renderer';
import { FONT_SMALL } from './bindings';

const SMALL = FONT_SMALL;

export function Screen(props) {
  return <screen>{props.children}</screen>;
}

export function Text(props) {
  return (
    <text x={props.x ?? 0} y={props.y ?? 0} font={props.font ?? SMALL}>
      {props.children}
    </text>
  );
}

export function Pixel(props) {
  return <pixel x={props.x} y={props.y} on={props.on !== false} />;
}

export { SMALL };
