/**
 * run.jsx — JSX 入口
 */
import oled from './oled-renderer';
import { CounterApp, ClockApp } from './app.jsx';

const App = process.argv[2] === 'clock' ? ClockApp : CounterApp;
const name = process.argv[2] === 'clock' ? '实时时钟' : '计数器';

console.log('🎯 SolidJS → OLED (JSX) — ' + name + '\n');

oled.render(() => <App />);
