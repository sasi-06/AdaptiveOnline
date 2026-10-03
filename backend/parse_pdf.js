const fs = require('fs');
const pdfParse = require('pdf-parse');

const dataBuffer = fs.readFileSync('test_output.pdf');

pdfParse(dataBuffer).then(function(data) {
    console.log("PDF TEXT EXTRACTED:");
    console.log("-------------------");
    console.log(data.text);
}).catch(err => {
    console.error(err);
});
