build:
    pnpm run build
    cd ../elden913.github.io/ && git filter-branch --force --index-filter 'git rm -r --cached --ignore-unmatch .' --prune-empty --tag-name-filter cat -- --all && cp ../njt/dist/* . && git add . && git commit -m "new update" && git push -u origin main
    
