# Remove the old installation

sudo dpkg -r mail-extractor

# Rebuild the app

npm run build:deb

# Install the new version

sudo dpkg -i dist/\*.deb
