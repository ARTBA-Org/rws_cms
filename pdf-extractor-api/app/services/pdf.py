from typing import List, Optional

import fitz  # PyMuPDF


def pdf_to_images(pdf_bytes: bytes, max_pages: Optional[int] = None, dpi: int = 200) -> List[bytes]:
    """
    Render PDF pages to PNG bytes using PyMuPDF.

    :param pdf_bytes: Raw PDF file bytes
    :param max_pages: Render up to this many pages (from the start). None = all.
    :param dpi: Target DPI for rendering (72 base). Higher -> larger images.
    :return: List of PNG bytes, one per page
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images: List[bytes] = []

    try:
        total = doc.page_count
        limit = min(max_pages, total) if max_pages else total
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)

        for i in range(limit):
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            images.append(pix.tobytes("png"))
    finally:
        doc.close()

    return images
