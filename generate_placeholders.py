import sys
import os
from PyQt6.QtWidgets import QApplication
from PyQt6.QtGui import QImage, QPainter, QFont, QColor, QLinearGradient
from PyQt6.QtCore import Qt, QRect

# Menu Items
items = [
    ("Hamburger", "#d35400", "#e67e22"),
    ("Pizza", "#c0392b", "#e74c3c"),
    ("Lahmacun", "#7f8c8d", "#95a5a6"),
    ("Kola", "#2c3e50", "#34495e"),
    ("Ayran", "#ecf0f1", "#bdc3c7"),
    ("Su", "#3498db", "#2980b9"),
    ("Çay", "#e74c3c", "#c0392b"),
    ("Kahve", "#6f4e37", "#8b4513") # Custom brown for coffee
]

# Ensure img directory exists
base_dir = os.path.dirname(os.path.abspath(__file__))
img_dir = os.path.join(base_dir, "Garson Robot", "img")
if not os.path.exists(img_dir):
    os.makedirs(img_dir)

app = QApplication(sys.argv)

def create_image(text, color1, color2):
    width, height = 400, 300 # High res for scaling down
    image = QImage(width, height, QImage.Format.Format_ARGB32)
    image.fill(Qt.GlobalColor.transparent)

    painter = QPainter(image)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)

    # Background Gradient
    gradient = QLinearGradient(0, 0, width, height)
    gradient.setColorAt(0, QColor(color1))
    gradient.setColorAt(1, QColor(color2))
    painter.fillRect(QRect(0, 0, width, height), gradient)

    # Text
    painter.setPen(QColor("white"))
    font = QFont("Segoe UI", 40, QFont.Weight.Bold)
    painter.setFont(font)
    painter.drawText(QRect(0, 0, width, height), Qt.AlignmentFlag.AlignCenter, text)

    # Icon/Circle Decoration
    painter.setPen(Qt.PenStyle.NoPen)
    painter.setBrush(QColor(255, 255, 255, 50))
    painter.drawEllipse(300, -50, 150, 150)
    
    painter.end()

    # Save
    path = os.path.join(img_dir, f"{text}.png")
    image.save(path)
    print(f"Generated: {path}")

for name, c1, c2 in items:
    create_image(name, c1, c2)

print("All images generated.")
