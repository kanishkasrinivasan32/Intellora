# Publish Intellora for LinkedIn

Intellora is prepared as a single Docker web service: FastAPI serves the built React app, and `/var/data` holds SQLite, uploaded resources, vectors, and encrypted per-user provider keys.

## 1. Put the project in a private Git repository

Do not commit `backend/.env` or `backend/data`. They are already excluded by `.gitignore` and `.dockerignore`.

## 2. Create the Render service

In Render, choose **New → Blueprint**, connect the repository, and deploy `render.yaml`. The Blueprint deliberately uses a paid Starter service with a persistent disk: free web-service files are ephemeral and would erase accounts and learning data after a restart or deploy.

## 3. Configure Google sign-in

In Google Cloud Console, create an OAuth 2.0 **Web application** client. After Render assigns the URL, add exactly:

- Authorized JavaScript origin: `https://YOUR-SERVICE.onrender.com`
- Authorized redirect URI: `https://YOUR-SERVICE.onrender.com/api/auth/google/callback`

Copy the client ID and secret into the Render environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then redeploy. Google requires an exact redirect-URI match.

## 4. Set the AI budget

The default Blueprint allows 20 AI requests per account per server day and 300 total per day. Static learning—reading lessons, notes, maps, and completed quizzes—does not spend model tokens.

Choose one policy before posting:

1. **Bring your own key (safest for a public LinkedIn launch):** leave the server cloud key empty. Visitors add Gemini, OpenRouter, Groq, or Sarvam in Ship Settings. Their key is encrypted and isolated to their account.
2. **Sponsored demo:** add one server `GEMINI_API_KEY`. Keep the daily limits low, monitor the provider dashboard, and set a hard billing budget/alert.
3. **Hybrid:** sponsor a small daily allowance and ask frequent users to add their own key.

Ollama remains the first route on local installations. A hosted Render container cannot call Ollama running on a visitor’s laptop, so hosted use needs a cloud key.

## 5. Post the link

Open the deployed app, verify Google sign-in with a second account, create a test note, log out/in, and confirm it persists. Then use **Invite a crewmate → Copy share link** and paste the HTTPS URL into LinkedIn.
