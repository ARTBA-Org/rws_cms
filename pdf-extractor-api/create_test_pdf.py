#!/usr/bin/env python3
"""
Create sample PDFs for testing the PDF extractor API
"""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from datetime import datetime

def create_invoice_pdf(filename="test_invoice.pdf"):
    """Create a sample invoice PDF"""
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, height - 50, "INVOICE")
    
    # Company info
    c.setFont("Helvetica", 12)
    c.drawString(50, height - 100, "ABC Company Ltd.")
    c.drawString(50, height - 120, "123 Business Street")
    c.drawString(50, height - 140, "City, State 12345")
    
    # Invoice details
    c.drawString(400, height - 100, f"Date: {datetime.now().strftime('%Y-%m-%d')}")
    c.drawString(400, height - 120, "Invoice #: INV-2024-001")
    c.drawString(400, height - 140, "Due Date: 2024-02-15")
    
    # Client info
    c.drawString(50, height - 200, "Bill To:")
    c.drawString(50, height - 220, "XYZ Corporation")
    c.drawString(50, height - 240, "456 Client Avenue")
    c.drawString(50, height - 260, "Client City, State 67890")
    
    # Items table header
    c.setFont("Helvetica-Bold", 12)
    y_pos = height - 320
    c.drawString(50, y_pos, "Description")
    c.drawString(300, y_pos, "Qty")
    c.drawString(350, y_pos, "Price")
    c.drawString(450, y_pos, "Total")
    
    # Line under header
    c.line(50, y_pos - 5, 550, y_pos - 5)
    
    # Items
    c.setFont("Helvetica", 11)
    items = [
        ("Web Development Services", "40", "$125.00", "$5,000.00"),
        ("Database Setup", "8", "$150.00", "$1,200.00"),
        ("API Integration", "16", "$100.00", "$1,600.00"),
    ]
    
    y_pos -= 25
    for item in items:
        c.drawString(50, y_pos, item[0])
        c.drawString(300, y_pos, item[1])
        c.drawString(350, y_pos, item[2])
        c.drawString(450, y_pos, item[3])
        y_pos -= 20
    
    # Total
    c.line(400, y_pos - 10, 550, y_pos - 10)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(400, y_pos - 30, "TOTAL: $7,800.00")
    
    # Footer
    c.setFont("Helvetica", 10)
    c.drawString(50, 50, "Thank you for your business!")
    c.drawString(50, 35, "Payment due within 30 days")
    
    c.save()
    return filename

def create_slide_pdf(filename="test_slides.pdf"):
    """Create a sample slide presentation PDF"""
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    # Slide 1: Title slide
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(width/2, height - 200, "Introduction to Machine Learning")
    
    c.setFont("Helvetica", 16)
    c.drawCentredString(width/2, height - 250, "A beginner's guide to AI concepts")
    
    c.setFont("Helvetica", 12)
    c.drawCentredString(width/2, height - 350, "Presenter: Dr. Jane Smith")
    c.drawCentredString(width/2, height - 370, "Date: January 2024")
    
    c.showPage()  # New page
    
    # Slide 2: Content slide
    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, height - 80, "What is Machine Learning?")
    
    c.setFont("Helvetica", 14)
    content = [
        "• A subset of artificial intelligence (AI)",
        "• Algorithms that learn from data",
        "• Makes predictions or decisions",
        "• Improves performance with experience",
        "• Used in recommendation systems, image recognition, etc."
    ]
    
    y_pos = height - 150
    for line in content:
        c.drawString(70, y_pos, line)
        y_pos -= 30
    
    c.showPage()  # New page
    
    # Slide 3: Types slide
    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, height - 80, "Types of Machine Learning")
    
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 130, "1. Supervised Learning")
    c.setFont("Helvetica", 14)
    c.drawString(70, height - 155, "• Uses labeled training data")
    c.drawString(70, height - 175, "• Examples: Classification, Regression")
    
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 220, "2. Unsupervised Learning")
    c.setFont("Helvetica", 14)
    c.drawString(70, height - 245, "• Finds patterns in unlabeled data")
    c.drawString(70, height - 265, "• Examples: Clustering, Dimensionality reduction")
    
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 310, "3. Reinforcement Learning")
    c.setFont("Helvetica", 14)
    c.drawString(70, height - 335, "• Learns through interaction with environment")
    c.drawString(70, height - 355, "• Examples: Game playing, Robotics")
    
    c.save()
    return filename

if __name__ == "__main__":
    # Install reportlab if not available
    try:
        from reportlab.pdfgen import canvas
    except ImportError:
        print("Installing reportlab...")
        os.system("pip install reportlab")
        from reportlab.pdfgen import canvas
    
    invoice_pdf = create_invoice_pdf()
    slides_pdf = create_slide_pdf()
    
    print(f"Created test PDFs:")
    print(f"- {invoice_pdf}")
    print(f"- {slides_pdf}")