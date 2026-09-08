import os
from docx import Document
from docx.shared import Pt
import re

def convert_markdown_to_docx(md_path, docx_path):
    if not os.path.exists(md_path):
        print(f"Error: {md_path} not found.")
        return

    doc = Document()
    
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    in_table = False
    table_data = []

    for line in lines:
        stripped = line.strip()
        
        # Handle Tables
        if '|' in line and '---' not in line:
            in_table = True
            cells = [c.strip() for c in line.split('|') if c.strip()]
            if cells:
                table_data.append(cells)
            continue
        elif in_table and ('|' in line or stripped == ''):
            if stripped == '' and table_data:
                # End of table, render it
                t = doc.add_table(rows=len(table_data), cols=len(table_data[0]))
                t.style = 'Table Grid'
                for i, row in enumerate(table_data):
                    for j, val in enumerate(row):
                        if j < len(t.columns):
                            t.cell(i, j).text = val
                doc.add_paragraph()
                table_data = []
                in_table = False
            elif '---' in line:
                continue
            else:
                cells = [c.strip() for c in line.split('|') if c.strip()]
                if cells:
                    table_data.append(cells)
            continue
        elif in_table:
             # Just in case there's a break without a blank line
             if table_data:
                t = doc.add_table(rows=len(table_data), cols=len(table_data[0]))
                t.style = 'Table Grid'
                for i, row in enumerate(table_data):
                    for j, val in enumerate(row):
                         if j < len(t.columns):
                            t.cell(i, j).text = val
                doc.add_paragraph()
             table_data = []
             in_table = False

        # Handle Headings
        if stripped.startswith('# '):
            doc.add_heading(stripped[2:], level=0)
        elif stripped.startswith('## '):
            doc.add_heading(stripped[3:], level=1)
        elif stripped.startswith('### '):
            doc.add_heading(stripped[4:], level=2)
        
        # Handle Lists
        elif stripped.startswith('* ') or stripped.startswith('- '):
            doc.add_paragraph(stripped[2:], style='List Bullet')
        elif re.match(r'^\d+\.', stripped):
            doc.add_paragraph(re.sub(r'^\d+\.\s*', '', stripped), style='List Number')
        
        # Handle Bold/Italic (Basic)
        elif stripped:
            # Simple bold removal/handling
            clean_text = stripped.replace('**', '').replace('__', '')
            p = doc.add_paragraph(clean_text)
            
        else:
            # Empty line
            pass

    # Final table check if file ends
    if in_table and table_data:
        t = doc.add_table(rows=len(table_data), cols=len(table_data[0]))
        t.style = 'Table Grid'
        for i, row in enumerate(table_data):
            for j, val in enumerate(row):
                 if j < len(t.columns):
                    t.cell(i, j).text = val
        doc.add_paragraph()

    doc.save(docx_path)
    print(f"Successfully converted to {docx_path}")

if __name__ == "__main__":
    convert_markdown_to_docx('PROJECT_REPORT_CONTENT.md', 'PROJECT_REPORT_CONTENT.docx')
