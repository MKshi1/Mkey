import './App.css';
import { MKeyApp } from './app/MKeyApp';
import { AppTitlebar } from './shared/AppTitlebar';

export default function App() {
  const isWindows = navigator.userAgent.includes('Windows');
  return <div className={isWindows ? 'desktop-shell is-windows' : 'desktop-shell'}><AppTitlebar /><MKeyApp /></div>;
}
