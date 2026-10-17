#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=== Building LaTeX Technical Report ==="

if command -v latexmk >/dev/null 2>&1; then
    echo "[+] Compiling with latexmk..."
    latexmk -pdf -interaction=nonstopmode main.tex
elif command -v pdflatex >/dev/null 2>&1; then
    echo "[+] Compiling with pdflatex and bibtex..."
    pdflatex -interaction=nonstopmode main.tex
    bibtex main || true
    pdflatex -interaction=nonstopmode main.tex
    pdflatex -interaction=nonstopmode main.tex
elif command -v docker >/dev/null 2>&1; then
    echo "[+] Local pdflatex not found. Using Docker texlive container..."
    docker run --rm -v "$DIR":/work -w /work texlive/texlive:latest sh -c \
      "pdflatex -interaction=nonstopmode main.tex && bibtex main && pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex"
else
    echo "[-] No LaTeX engine found locally. You can:"
    echo "  1. Upload 'report/main.tex' and 'report/references.bib' directly to Overleaf (https://overleaf.com)."
    echo "  2. Install TeXLive locally: sudo apt-get install texlive-latex-base texlive-latex-extra texlive-fonts-recommended"
    exit 1
fi

echo "[✓] Build complete: $(pwd)/main.pdf"
