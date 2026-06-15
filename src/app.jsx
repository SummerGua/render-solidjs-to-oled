/**
 * app.jsx — Demo (JSX)
 */
import oled from './oled-renderer';
import { createSignal } from 'solid-js/dist/solid.cjs';
import { Screen, Text, Pixel, SMALL } from './components.jsx';

export function CounterApp() {
  const [count, setCount] = createSignal(0);
  const [distance, setDistance] = createSignal(0);
  setInterval(() => {
    setCount((c) => c + 1);
    setDistance((d) => d + 10);
  }, 1000);

  // 返回函数让 createRenderEffect 追踪 signal
  return () => (
    <Screen>
      <Text x={0} y={0} font={SMALL}>SolidJS OLED!</Text>
      <Text x={0} y={2} font={SMALL}>Count: {count()}</Text>
      <Pixel x={distance() % 128} y={56} />
      <Pixel x={(distance() + 10) % 128} y={56} />
      <Pixel x={(distance() + 20) % 128} y={56} />
    </Screen>
  );
}

export function ClockApp() {
  const [time, setTime] = createSignal(new Date());
  setInterval(() => setTime(new Date()), 1000);

  return () => (
    <Screen>
      <Text x={0} y={0} font={SMALL}>
        {time().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </Text>
      <Text x={0} y={2} font={SMALL}>
        {time().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
      </Text>
      <Pixel x={120} y={0} on={time().getSeconds() % 2 === 0} />
    </Screen>
  );
}
