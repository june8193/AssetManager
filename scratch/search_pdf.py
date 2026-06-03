import os
from pypdf import PdfReader

def search_pdf():
    pdf_path = "docs/키움 REST API 문서.pdf"
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        return
        
    reader = PdfReader(pdf_path)
    print(f"Total pages: {len(reader.pages)}")
    
    # Print pages 263-264 and 271-272 (0-indexed: 262-263 and 270-271)
    target_pages = [262, 263, 270, 271]
    for page_num in target_pages:
        if page_num < len(reader.pages):
            print(f"================ PAGE {page_num + 1} ================")
            text = reader.pages[page_num].extract_text()
            print(text)
            print("===================================================\n")


if __name__ == "__main__":
    search_pdf()
