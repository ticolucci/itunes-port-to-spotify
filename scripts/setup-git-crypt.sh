#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat <<EOF
Usage: $0 init|add-gpg <path-to-pubkey>

Commands:
  init            Initialize git-crypt in this repository (run once)
  add-gpg <file>  Add a GPG public key file so the owner can decrypt encrypted files

Examples:
  $0 init
  $0 add-gpg alice_pubkey.asc
EOF
}

if [ "$#" -lt 1 ]; then
  usage
  exit 2
fi

cmd="$1"

case "$cmd" in
  init)
    command -v git-crypt >/dev/null 2>&1 || { echo "git-crypt not found; install it (brew install git-crypt)"; exit 1; }
    (cd "$repo_root" && git-crypt init)
    echo "git-crypt initialized. Ensure you add collaborators' GPG public keys with '$0 add-gpg <file>'"
    ;;
  add-gpg)
    if [ "$#" -ne 2 ]; then
      usage
      exit 2
    fi
    pubkey="$2"
    if [ ! -f "$pubkey" ]; then
      echo "Public key file not found: $pubkey"
      exit 1
    fi
    command -v git-crypt >/dev/null 2>&1 || { echo "git-crypt not found; install it (brew install git-crypt)"; exit 1; }
    # Import the public key into the local GPG keyring so git-crypt can reference it.
    echo "Importing public key into local GPG keyring..."
    if ! gpg --import "$pubkey" >/dev/null 2>&1; then
      echo "Failed to import public key: $pubkey"
      exit 1
    fi

    # Extract the long key id from the key file (use import-show to avoid duplicates)
    keyid=$(gpg --with-colons --import-options import-show "$pubkey" 2>/dev/null | awk -F: '/^pub/ {print $5; exit}')
    if [ -z "$keyid" ]; then
      echo "Could not determine key id/fingerprint from $pubkey"
      exit 1
    fi

    (cd "$repo_root" && git-crypt add-gpg-user --trusted "$keyid")
    echo "Added GPG user (key id: $keyid) from $pubkey"
    ;;
  *)
    usage
    exit 2
    ;;
esac
