#!/bin/zsh

# Count lines of code by file type, excluding third-party and generated files

ROOT="$(dirname "$0")"

EXCLUDES=(
  '*/node_modules/*'
  '*/.git/*'
  '*/dist/*'
  '*/build/*'
  '*/.nyc_output/*'
  '*/coverage/*'
  '*/playwright-report/*'
  '*/test-results/*'
  '*/package-lock.json'
  '*/yarn.lock'
  '*/.vscode/*'
)

exclude_args=()
for pat in "${EXCLUDES[@]}"; do
  exclude_args+=(-not -path "$pat")
done

EXTENSIONS=(jsx js ts tsx css html md sql yml json)

printf "\n%-10s %6s %8s\n" "Type" "Files" "Lines"
printf "%-10s %6s %8s\n" "----------" "------" "--------"

total_files=0
total_lines=0

for ext in "${EXTENSIONS[@]}"; do
  files=$(find "$ROOT" -type f -name "*.$ext" "${exclude_args[@]}" | wc -l | awk '{print $1}')
  if [ "$files" -gt 0 ]; then
    lines=$(find "$ROOT" -type f -name "*.$ext" "${exclude_args[@]}" -print0 | xargs -0 wc -l | tail -1 | awk '{print $1}')
    printf "%-10s %6s %8s\n" ".$ext" "$files" "$lines"
    total_files=$((total_files + files))
    total_lines=$((total_lines + lines))
  fi
done

printf "%-10s %6s %8s\n" "----------" "------" "--------"
printf "%-10s %6s %8s\n" "Total" "$total_files" "$total_lines"
echo ""
