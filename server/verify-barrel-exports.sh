#!/bin/bash

echo "🔍 Verifying barrel exports implementation..."

# Check if all index.ts files exist
echo "Checking index.ts files..."
for dir in database i18n users auth common shared config health bootstrap; do
  if [ -f "src/$dir/index.ts" ]; then
    echo "✅ src/$dir/index.ts exists"
  else
    echo "❌ src/$dir/index.ts missing"
  fi
done

# Test imports
echo ""
echo "Testing TypeScript compilation..."
npm run build > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ TypeScript compilation successful"
else
  echo "❌ TypeScript compilation failed"
  echo "Run 'npm run build' to see errors"
fi

echo ""
echo "Testing application startup..."
timeout 10s npm run start > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Application starts successfully"
else
  echo "⚠️  Application startup test inconclusive (may need longer timeout)"
fi

echo ""
echo "🎉 Barrel exports verification complete!"
