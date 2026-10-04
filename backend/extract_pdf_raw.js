const fs = require('fs');
const content = fs.readFileSync('test_output.pdf', 'utf8');
const matches = content.match(/\([^\)]+\)\s*T[jJ]/g);
if (matches) {
    matches.forEach(m => console.log(m));
} else {
    console.log('No text matches found using simple regex.');
}
