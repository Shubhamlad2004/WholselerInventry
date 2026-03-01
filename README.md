<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5a0cb7e7-f934-43cc-a56c-f6b5a8ec32b5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
## GitHub Pages deployment

This project can be deployed automatically using GitHub Pages. After creating a repository on GitHub and pushing the code, the included workflow (`.github/workflows/gh-pages.yml`) will build and publish the `dist` directory whenever you push to the `main` branch.

1. Create a repo on GitHub and push this project (`git push -u origin main`).
2. (Optional) set an environment variable `BASE_URL` in `package.json` or
   your workflow to the value `/your-repo-name/` if the site is not at the
   root of your GitHub Pages domain.
3. Go to **Settings → Pages** on GitHub and set the source to the `gh-pages`
   branch.
4. The URL will be `https://<username>.github.io/<repo-name>/`.