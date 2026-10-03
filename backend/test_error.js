const PDFDocument = require('pdfkit');
const fs = require('fs');
try {
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream('test_error.pdf'));
    doc.text('Here is a smart quote: “Hello” and an em-dash —');
    doc.end();
    console.log('Success');
} catch(e) {
    console.error('Error:', e.message);
}
