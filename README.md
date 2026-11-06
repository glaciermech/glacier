# Notes from NTU — personal semester blog

A plain, static website inspired by traditional student blogs. There is no account, server, database service, subscription, external font or third-party JavaScript.

## What is included

- `index.html` — semester archive / home page
- `y1s1.html` through `y4s2.html` — eight **separate** semester posts
- `materials.html` — a separate page for study links, uploaded files and notes
- `edit.html` — local editor for entries, screenshots, resources and website title
- `site-data.js` — published copy of your writing, links and uploaded images/files
- `site.js` and `style.css` — site functions and styling

## First-time use

1. Extract all files into the **same folder** (do not move the HTML files away from `site.js`, `site-data.js` or `style.css`).
2. Open `index.html` to browse, or `edit.html` to write. If your device restricts opening local HTML files, publish the folder to GitHub Pages first using the steps below.
3. In `edit.html`, choose `Semester entry`, select a semester, write your courses, GPA and reflections, optionally attach a results screenshot, and press **Save this semester**.
4. Use the `Materials` tab to add links and files. Use `Site details` to change the site title.
5. Your edits are initially stored **only in that browser**. To publish or back up, open `Publish / backup` and download a new `site-data.js`.

**Important:** Clicking Save does not modify the files on your computer or immediately update the website on GitHub. Replace the published `site-data.js` with the downloaded one to publish your edits.

## Publish free on GitHub Pages

1. Sign in at https://github.com and make a **public** repository (for example, `my-ntu-blog`).
2. Upload the **contents** of this folder to the repository root, including `index.html`. Do not upload only the ZIP.
3. In the repository, go to **Settings → Pages → Build and deployment**.
4. Set **Source** to `Deploy from a branch`, choose the `main` branch and the `/(root)` folder, then Save.
5. The URL will normally be `https://YOUR-USERNAME.github.io/my-ntu-blog/`.

When you have new entries: open `edit.html` on the hosted website (for example `.../my-ntu-blog/edit.html`), save your work, click **Download updated site-data.js**, upload that file into the **same** GitHub repository (replacing the old one), and commit the change. GitHub Pages publishes your edits from the repository.

If you use a new browser or device, the published content in `site-data.js` will load. You can also import an exported `site-data.js` from the `Publish / backup` tab to restore drafts.

## Writing tips

- **Courses taken:** one course per line, e.g. `PH1011 Physics (4 AU)`.
- **Semester review:** blank lines separate paragraphs.
- **Individual module reviews:** place `## PH1011 Physics` on its own line before writing that module's review. The site turns it into an article heading.
- **Links inside reflections:** use `[my notes](https://example.com/notes)` if you want a clickable link in the text.
- **Resources:** attach small files (up to 8 MB each) or use normal links. External Drive links are preferable for large files.

## Privacy and limitations

- This is a **public static blog**, not a password-protected academic portal. Never publish an unredacted GPA screenshot that shows your matriculation number, personal identification, or other sensitive information.
- The public `Edit site` link does **not** let readers change your live site. It only lets them create local drafts in their own browser. Only someone with access to your GitHub repository can publish changes.
- No cross-device live syncing and no automatic cloud backup are provided. **Export** your `site-data.js` after editing. Do not rely on browser storage as your only copy.
- Uploaded files are embedded in `site-data.js` so that there are no extra assets to manage. Large file libraries will make that file large; use external hosted links for those.
- `site-data.js` is readable by visitors. Everything you publish should be treated as public.

Based on the structure of a classic semester-review blog, with no copied writing or third-party theme assets.
