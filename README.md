# todaytourist.com — GitHub Pages

Static site published to GitHub Pages.

- Build thủ công: `cd todaytourist.com/dev && npm run build` rồi commit `dist/*`
- Hoặc admin đăng bài → worker commit JSON vào `todaytourist.com/dev/content/vi`
- Workflow `.github/workflows/build.yml` khi push `main`:
    dịch vi→en (chỉ file thay đổi) + Astro build → deploy lên Pages
