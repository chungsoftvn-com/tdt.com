# todaytourist.com — GitHub Pages

Static site published to GitHub Pages.

- Nguồn & build: repo source `dieukhacvannhan.vn-dev` -> `todaytourist.com/dev`
- Cập nhật thủ công: `cd todaytourist.com/dev && npm run build` rồi commit `dist/*`
- Workflow `.github/workflows/build.yml` tự deploy khi push vào `main` (Pages Source: GitHub Actions).
