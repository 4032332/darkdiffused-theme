#!/bin/bash
# Dark & Diffused — Theme Setup Script
# Run this from: /Users/robbrown/Desktop/CodingProjects/Shopify/darkdiffused-theme

set -e

echo "🏛️  Dark & Diffused Theme Setup"
echo "================================"

# Check we're in the right directory
if [ ! -f "layout/theme.liquid" ]; then
  echo "❌ Error: layout/theme.liquid not found."
  echo "   Make sure you're running this from inside the darkdiffused-theme folder."
  exit 1
fi

echo "✓ Theme files detected"

# Initialise git if needed
if [ ! -d ".git" ]; then
  echo "→ Initialising git repository..."
  git init
  git remote add origin https://github.com/4032332/darkdiffused-theme.git
  echo "✓ Git initialised and remote added"
else
  echo "✓ Git already initialised"
  # Ensure remote is set
  git remote set-url origin https://github.com/4032332/darkdiffused-theme.git 2>/dev/null || \
  git remote add origin https://github.com/4032332/darkdiffused-theme.git 2>/dev/null || true
fi

# Stage and commit
echo "→ Staging all files..."
git add -A

echo "→ Committing..."
git commit -m "feat: initial Dark & Diffused theme — gentleman's study aesthetic

- Complete Shopify theme with dark luxury design system
- Brass/gold accent system with wood grain & leather textures
- Hero section with wainscoting and filament lamp effect
- Three-range navigation (Elevated Man, Man Child, Happy Wife)
- Product card system with mist animations
- Full product page with gallery, variant selection
- Cart page with summary and discount code
- Responsive across all breakpoints
- GitHub Actions deploy workflow included"

echo "→ Pushing to GitHub..."
git branch -M main
git push -u origin main --force

echo ""
echo "✅ Theme pushed to GitHub successfully"
echo ""
echo "Next steps:"
echo "  1. Add SHOPIFY_CLI_THEME_TOKEN to GitHub repo secrets"
echo "     → https://github.com/4032332/darkdiffused-theme/settings/secrets/actions"
echo ""
echo "  2. Push to live store manually (first time):"
echo "     shopify theme push --store=darkdiffused.myshopify.com"
echo ""
echo "  After that, every push to main auto-deploys via GitHub Actions."
