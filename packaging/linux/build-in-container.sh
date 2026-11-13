#!/bin/sh
# UCNPL Billing - builds the .deb and the AppImage. Runs INSIDE a
# debian:bookworm-slim container started by scripts/build-linux.mjs:
#   /work/app             the staged app (server.js, dist, node_modules ...)
#   /work/node.tar.gz     Node.js linux-x64 (SHA256 checked by build-linux.mjs)
#   /work/appimagetool    appimagetool + /work/runtime-x86_64 (checked too)
#   /work/packaging       the packaging/ folder
# Writes /work/out/. Arguments: deb and/or appimage. Env: VERSION.
set -eu
V=${VERSION:?}
P=/work/packaging/linux
A=/build/app
rm -rf /build && mkdir -p /build /work/out

# --- The program tree: what goes to /opt/ucnpl-billing ---
cp -r /work/app "$A"
tar -xzf /work/node.tar.gz -C /build
mkdir -p "$A/node/bin" "$A/linux"
cp /build/node-v*-linux-x64/bin/node "$A/node/bin/node"
cp /build/node-v*-linux-x64/LICENSE "$A/node/LICENSE"
cp "$P/ucnpl-billing" "$A/ucnpl-billing"
cp "$P/old-installs.mjs" "$A/linux/old-installs.mjs"
# Files from Windows carry no Unix modes: set them all.
find "$A" -type d -exec chmod 755 {} +
find "$A" -type f -exec chmod 644 {} +
chmod 755 "$A/node/bin/node" "$A/ucnpl-billing" "$A"/*.sh
"$A/node/bin/node" -e 'process.exit(process.versions.node.startsWith("20.") ? 0 : 1)'
# A program file with Windows line endings fails on Linux.
if grep -rlI "$(printf '\r')" "$A/ucnpl-billing" "$A/linux" "$A"/*.sh; then echo 'CRLF line endings found' >&2; exit 1; fi

build_deb() {
  R=/build/deb
  O=/work/out/ucnpl-billing_${V}_amd64.deb
  rm -rf "$R"
  mkdir -p "$R/DEBIAN" "$R/opt" "$R/usr/bin" "$R/usr/share/applications" "$R/usr/share/doc/ucnpl-billing" \
    "$R/usr/share/icons/hicolor/512x512/apps" "$R/usr/share/icons/hicolor/192x192/apps"
  cp -a "$A" "$R/opt/ucnpl-billing"
  echo deb > "$R/opt/ucnpl-billing/install-kind.txt"
  ln -s /opt/ucnpl-billing/ucnpl-billing "$R/usr/bin/ucnpl-billing"
  install -m 644 "$P/ucnpl-billing.desktop" "$R/usr/share/applications/com.ucnpl.ucnpl-billing.desktop"
  install -m 644 "$A/dist/icons/icon-512.png" "$R/usr/share/icons/hicolor/512x512/apps/ucnpl-billing.png"
  install -m 644 "$A/dist/icons/icon-192.png" "$R/usr/share/icons/hicolor/192x192/apps/ucnpl-billing.png"
  install -m 644 "$A/LICENSE" "$R/usr/share/doc/ucnpl-billing/copyright"
  # No maintainer scripts: installing and removing touch no one's home
  # folder, start nothing and ask nothing. dpkg's own triggers refresh the menu.
  cat > "$R/DEBIAN/control" <<EOF
Package: ucnpl-billing
Version: $V
Architecture: amd64
Maintainer: UCNPL <contact@ucnpl.com>
Installed-Size: $(du -sk "$R/opt" "$R/usr" | awk '{s += $1} END {print s}')
Section: misc
Priority: optional
Recommends: xdg-utils, zip
Homepage: https://github.com/Mohitduaa/UCNPL-GST-Billing-Software
Description: UCNPL GST billing and invoicing software for India
 GST tax invoices, credit notes, delivery challans, GSTR-1 / GSTR-3B
 exports, e-Way Bill and reports. Runs on this computer only (127.0.0.1)
 and keeps each user's books in ~/.local/share/ucnpl-billing-data.
 Removing the package never deletes the books.
EOF
  dpkg-deb --root-owner-group -Zxz --build "$R" "$O"
  dpkg-deb --info "$O" > /dev/null
  echo "built $O"
}

build_appimage() {
  D=/build/AppDir
  O=/work/out/UCNPL-GST-Billing-Linux-x86_64.AppImage
  rm -rf "$D"
  cp -a "$A" "$D"
  echo appimage > "$D/install-kind.txt"
  ln -s ucnpl-billing "$D/AppRun"
  install -m 644 "$P/ucnpl-billing.desktop" "$D/ucnpl-billing.desktop"
  install -m 644 "$A/dist/icons/icon-512.png" "$D/ucnpl-billing.png"
  ln -s ucnpl-billing.png "$D/.DirIcon"
  install -m 755 /work/appimagetool /build/appimagetool
  # appimagetool refuses to start without the `file` command, which the slim
  # image lacks; ARCH is given, so it only needs one that answers.
  # ponytail: shim instead of apt-get install file (no extra download); use a
  # base image with `file` if appimagetool ever reads its output.
  if ! command -v file >/dev/null 2>&1; then
    mkdir -p /build/bin
    printf '#!/bin/sh\nfor f; do echo "$f: ELF 64-bit LSB executable, x86-64"; done\n' > /build/bin/file
    chmod 755 /build/bin/file
    PATH=/build/bin:$PATH
  fi
  (cd /build && ARCH=x86_64 ./appimagetool --appimage-extract-and-run --no-appstream \
    --runtime-file /work/runtime-x86_64 "$D" "$O")
  chmod 755 "$O"
  echo "built $O"
}

for t in "$@"; do
  case $t in
    deb) build_deb ;;
    appimage) build_appimage ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
done
