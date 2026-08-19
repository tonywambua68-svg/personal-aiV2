# NEXUS//OS — GitHub Guide (beginner, exact clicks)

This guide connects your Personal AI project to a GitHub repository so it is
**backed up, versioned, and usable on any computer**. No experience needed —
every step says exactly what to click and what to type.

---

## PART 1 — Create a GitHub account (skip if you have one)

1. Open **https://github.com/signup**
2. Enter your **email**, choose a **username** (this appears in your project URL) and a **password**
3. Click **Continue** → verify the email GitHub sends you
4. When it asks about plans, click **continue with free**

That's it. You are signed in.

---

## PART 2 — Install Git on Windows

Git is the program that moves code between your PC and GitHub.

1. Open **https://git-scm.com/download/win** — the download starts automatically
2. Run the downloaded `.exe` file
3. Click **Next → Next → Next → Next → Install → Finish**
   (every default option is correct — do not change anything)
4. **Close VS Code and any open terminals**, then reopen them
5. Verify: press `Win + R`, type `cmd`, Enter, then type:
   ```cmd
   git --version
   ```
   You should see something like `git version 2.45.1.windows.1`

---

## PART 3 — Publish your project (one double-click)

1. Open File Explorer → go to your project folder (e.g. `C:\Users\YourName\personal-ai`)
2. **Double-click `publish-to-github.bat`**

The script does the work and shows green `[OK]` lines:
```
[OK] Git found
[OK] Safety check passed (.env, keys/, exports excluded)
[OK] Git repository initialized (branch: main)
[OK] Code committed locally (no secrets included)
```

Then it pauses and gives you the next steps (Part 4). **Keep the window open.**

### What the script protects
It **refuses to upload** if your `.env` file (API keys) is not excluded. Your
secrets, `keys/` folder, data exports, `node_modules` and `bridge.config.json`
(personal folder paths) never leave your PC.

---

## PART 4 — Create the repository on GitHub (2 minutes)

1. Open **https://github.com/new** (you're signed in from Part 1)
2. **Repository name:** type `nexus-os` (or `personal-ai`)
3. **Description:** optional — `My personal AI business assistant`
4. Choose **Private** ← recommended (your business logic stays yours; you can make it public later)
5. ⚠️ **Do NOT add** README, .gitignore, or a license
   (your project already has these — adding them causes an upload conflict)
6. Click the green **Create repository** button at the bottom

GitHub now shows a page with setup commands. Find the URL that ends in `.git`:

```
https://github.com/YOURNAME/nexus-os.git
```

7. Go back to the **publish-to-github.bat window**
8. **Paste that URL** and press **Enter**

```
[..] Uploading to GitHub...
Enumerating objects: done.
...
[OK] SUCCESS - your project is now on GitHub
```

9. **First time only:** a **browser window opens** asking you to sign in to GitHub
   (this is *Git Credential Manager* — safe and official). Click **Sign in with browser**
   → click **Authorize** → enter your GitHub password. Windows remembers this; you won't be asked again.

10. Refresh your GitHub repository page — **all your project files are there.** 🎉

---

## PART 5 — Daily backups (one double-click)

Whenever you change something and want it saved to GitHub:

**Double-click `update-github.bat`**

```
[OK] Changes committed locally
[..] Uploading to GitHub...
[OK] Backup complete.
```

If nothing changed, it tells you `Everything is up to date.` and stops.

**Good habit:** run it at the end of each working day. Your project now
survives a broken laptop, a Windows reinstall, or a deleted folder.

---

## PART 6 — Use the project on another PC (or after reinstalling Windows)

On the new computer:

1. Install **Node.js LTS** (https://nodejs.org) and **Git** (Part 2)
2. Open a terminal in the folder where you want the project (e.g. `C:\Users\YourName`)
3. Run:
   ```cmd
   git clone https://github.com/YOURNAME/nexus-os.git personal-ai
   cd personal-ai
   ```
   (GitHub asks you to sign in once — same browser popup as before)
4. Start the AI:
   ```cmd
   start-ai.bat
   ```

Your tasks, memory and demo data live in the **browser** on each PC
(localStorage), so each computer starts with a fresh demo dataset —
that's by design for privacy.

---

## PART 7 — Connect to an EXISTING repository instead

If you already have a repository (for example one you created earlier,
or one a team shared with you):

**Option A — during publishing:** when `publish-to-github.bat` asks for the URL,
paste the URL of your existing repository instead of creating a new one.

**Option B — switching later:**
```cmd
cd C:\Users\YourName\personal-ai
git remote set-url origin https://github.com/YOURNAME/OTHER-REPO.git
git push -u origin main
```

**Option C — keep two remotes** (e.g. GitHub + a backup mirror):
```cmd
git remote add backup https://github.com/YOURNAME/nexus-os-backup.git
git push backup main
```

**Working with another project on the same PC** (e.g. your electronics website repo):
each folder is independent — clone it next to this one:
```
C:\Users\YourName\
├── personal-ai\        ← JARVIS (this project)
└── electronics-site\   ← your website repo (git clone its URL)
```
Open each folder in its own VS Code window. They don't interfere.

---

## PART 8 — Troubleshooting

| Problem | Fix |
|---|---|
| `'git' is not recognized` | Git not installed, or terminal wasn't restarted after install. Install from git-scm.com, then **close and reopen** VS Code/terminal. |
| Script says *"Already connected"* but you want a different repo | `git remote set-url origin NEW_URL` then run `update-github.bat` |
| *"Repository not empty"* error on push | You added a README on GitHub. Run: `git pull origin main --allow-unrelated-histories` then `git push -u origin main` |
| Browser sign-in popup never appears | Run `git push` again — the popup comes from Git Credential Manager. Make sure popups aren't blocked. |
| Forgot what's connected | `git remote -v` shows your repository URL |
| Accidentally committed `.env` | It can't happen with these scripts (they check first). If you did it manually: rotate the exposed keys immediately, then ask me to scrub history. |
| Want to see what WILL be uploaded | `git status` — everything listed is safe; `.env` and `node_modules` never appear |

---

## PART 9 — What is backed up vs what stays local

| ✅ Uploaded to GitHub (safe) | ❌ Stays on your PC only |
|---|---|
| All source code (`src/`, `standalone/`) | `.env` (your API keys) |
| Docs (README, guides) | `keys/` folder |
| Scripts (`.bat` launchers) | `bridge.config.json` (your folder paths) |
| `.gitignore`, `.env.example` (template, no secrets) | `*-export.json` data exports |
| `package.json` config | `node_modules/` (reinstalled via `npm install`) |
| | Browser localStorage (tasks, memory, demo data) |

**The golden rule:** the `.env.example` file shows *which* keys exist, but
never their values. Real values live only in your `.env`, which never uploads.

---

## CHEAT SHEET

```
FIRST TIME ......... double-click  publish-to-github.bat
DAILY BACKUP ....... double-click  update-github.bat
CHECK CONNECTION ... git remote -v          (shows your repo URL)
SEE CHANGES ........ git status
ANOTHER PC ......... git clone YOUR_URL
SWITCH REPO ........ git remote set-url origin NEW_URL
```

**Done.** Your Personal AI is now versioned, backed up, and portable —
the same system professional developers use for every serious project.
