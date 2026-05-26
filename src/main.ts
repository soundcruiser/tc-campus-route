import '../styles/app.css';
import { CampusRouteApp } from './app';

const app = new CampusRouteApp();
app.init().catch((err) => {
  console.error(err);
  document.body.innerHTML =
    '<p style="padding:2rem;color:#f66">起動に失敗しました。npm run dev で開いてください。</p>';
});
