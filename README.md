# Cloudzen — Phone-first Code Editor

This is a practical upgraded starter build for the Cloudzen/Pocket Code project.

## Included
- Mobile-first editor with file tabs and local autosave
- New, rename, close, import and export files
- HTML/CSS/JavaScript syntax highlighting
- Find and replace
- HTML live preview with sandboxed iframe and console
- Extra mobile coding keys and bracket closing
- Dark/light theme and font-size controls
- Starter HTML/CSS/JS project
- PWA manifest and offline service worker

## Important limits
- The AI assistant and private GitHub write access are not enabled by this static-only build. Never put an AI API key or GitHub personal access token in a public frontend repository. A secure backend or a supported OAuth flow is needed.
- Preview runs HTML and JavaScript in a sandboxed iframe. It is not a full Node.js terminal/runtime.
- This package is a replacement starter package, not a verified merge with your current repository. Back up your existing repo before replacing files.

## Install
Replace the corresponding files in the `BadalStudio/Cloudzen` repository with these files, commit, then wait for GitHub Pages to rebuild. Clear/reload the site if an old service-worker cache remains.
