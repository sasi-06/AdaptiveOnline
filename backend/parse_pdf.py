import PyPDF2
with open('test_output.pdf', 'rb') as f:
    reader = PyPDF2.PdfReader(f)
    for i in range(len(reader.pages)):
        print(reader.pages[i].extract_text())
