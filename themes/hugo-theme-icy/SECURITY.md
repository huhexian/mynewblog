# Security policy

## Supported versions

Security fixes go into the latest release. Update to it before you report a problem.

## Reporting a vulnerability

Please report vulnerabilities privately, not in a public issue:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability** and describe the problem, the affected version and how to reproduce it.

You will get an answer within a week. Once a fix is released, the advisory is published with credit to you, unless you prefer to stay anonymous.

## Scope

In scope: the theme's templates, CSS and JavaScript, and the scripts in `tools/`.

Out of scope: Hugo itself, the Ecoku and Plausible services, third-party libraries upstream (report those to their projects; tell us if Icy ships an affected version), and the hosting of the demo site.

## Protected posts

Password-protected posts are encrypted after the build (PBKDF2-SHA-256 with 600,000 iterations, AES-256-GCM) and decrypted in the reader's browser. This hides content from casual readers; it is not access control. These are known limits, not vulnerabilities:

- The encrypted files are public, so a weak password can be guessed offline.
- The title, date, hint and URL of a protected post are public.
- The password is in the post's front matter. Anyone who can read the site's source can read it.
- Anyone who unlocks a post can copy its content.
- Decrypted content is inserted into the page as HTML. It is the site author's own content, encrypted by the author's build, so it is trusted like any other page.

A way to read a protected post without its password, or a sealed site that still contains plaintext, is a vulnerability: please report it.
