import { defineConfig } from 'vite';

/** GitHub Pages は /リポジトリ名/ 配下。ローカル・file:// は相対パス */
const base =
  process.env.GITHUB_PAGES === 'true' ? '/tc-campus-route/' : './';

export default defineConfig({
  base,
});
