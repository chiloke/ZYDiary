const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const outputDir = path.join(root, 'mobile-web');
const filesystemGradlePath = path.join(root, 'node_modules', '@capacitor', 'filesystem', 'android', 'build.gradle');
const filesToCopy = [
  'index.html',
  'daily.html',
  'review.html',
  'goals.html',
  'ledger.html',
  'reports.html',
  'profile.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest'
];
const dirsToCopy = ['assets', 'build'];

fs.mkdirSync(outputDir, { recursive: true });

for (const file of filesToCopy) {
  fs.copyFileSync(path.join(root, file), path.join(outputDir, file));
}

for (const dir of dirsToCopy) {
  fs.cpSync(path.join(root, dir), path.join(outputDir, dir), {
    recursive: true,
    force: true,
    dereference: true
  });
}

if (fs.existsSync(filesystemGradlePath)) {
  let gradleContent = fs.readFileSync(filesystemGradlePath, 'utf8');
  gradleContent = gradleContent
    .replace(/JavaVersion\.VERSION_21/g, 'JavaVersion.VERSION_17')
    .replace(/jvmToolchain\(21\)/g, 'jvmToolchain(17)');
  fs.writeFileSync(filesystemGradlePath, gradleContent, 'utf8');
}

console.log(`Prepared mobile web bundle at ${outputDir}`);
