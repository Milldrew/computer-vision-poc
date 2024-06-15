mv docs/browser/* docs
rm docs/3rdpartylicenses.txt
git add .
date=$(date)
git commit -m "Build: $date"
git push
