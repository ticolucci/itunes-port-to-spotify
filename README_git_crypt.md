# git-crypt — encrypt files in this repository

This repository includes a simple git-crypt setup to protect sensitive files in the repo (for example `database.db`). These files are listed in `.gitattributes` and will be transparently encrypted/decrypted for authorized users.

- `.gitattributes` — rules specifying which files will be encrypted.
- `scripts/setup-git-crypt.sh` — helper to initialize `git-crypt` locally and add GPG users.

Quick guide

1. Install git-crypt and GPG

   macOS (Homebrew):

   brew install git-crypt gnupg

2. Initialize git-crypt (one time per repository)

   ./scripts/setup-git-crypt.sh init

   This will run `git-crypt init` (requires you to have git and git-crypt in PATH).

3. Add a collaborator's GPG public key

   ./scripts/setup-git-crypt.sh add-gpg /path/to/collaborator.pub

   This will run `git-crypt add-gpg-user --trusted <file>` which adds the user's public key so they can decrypt the files.

Notes & safety
- Do NOT commit private keys or unencrypted secrets. The point of git-crypt is to keep encrypted data in the repo; keep private keys out of source control.
- If you accidentally committed secrets unencrypted, rotate those secrets.

More info
- git-crypt: https://github.com/AGWA/git-crypt
