build:
    pnpm run build
    cd ../njt-pages/ && git rm -rf . && git clean -fxd
    cp dist/* ../njt-pages/
