const fs = require('fs');
const path = require('path');

const directory = '.';
const ignoreDirs = ['node_modules', '.git', 'dist', '.gemini'];

function walkAndReplace(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (ignoreDirs.includes(file)) continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkAndReplace(filePath);
        } else {
            // Read file content
            try {
                let content = fs.readFileSync(filePath, 'utf8');
                let originalContent = content;

                // 1. Mind Palace -> Mind Palace
                content = content.replace(/Mind Palace/g, 'Mind Palace');
                content = content.replace(/Mind Palace/g, 'Mind Palace');
                content = content.replace(/mind palace/gi, 'mind palace');

                // 2. Component and File references
                content = content.replace(/Mind Palace\.tsx/g, 'MindPalace.tsx');
                content = content.replace(/export default function MindPalace/g, 'export default function MindPalace');
                content = content.replace(/import MindPalace from/g, 'import MindPalace from');
                content = content.replace(/component=\{Mind Palace\}/g, 'component={MindPalace}');

                // 3. Routing
                content = content.replace(/\/mind-palace/g, '/mind-palace');

                // 4. Text references
                content = content.replace(/\bCompendium\b/g, 'Mind Palace');
                content = content.replace(/\bcompendium\b/g, 'mind palace');

                if (content !== originalContent) {
                    fs.writeFileSync(filePath, content, 'utf8');
                    console.log(`Updated: ${filePath}`);
                }

                // File renaming
                if (file === 'MindPalace.tsx') {
                    const newPath = path.join(dir, 'MindPalace.tsx');
                    fs.renameSync(filePath, newPath);
                    console.log(`Renamed: ${filePath} -> ${newPath}`);
                }
            } catch (e) {
                // Ignore binary files or read errors
            }
        }
    }
}

walkAndReplace(directory);
console.log('Done.');
