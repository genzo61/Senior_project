import argparse
import os
import socket

import qrcode


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def generate_table_qrs(num_tables=10, port=5174, host=None):
    ip_address = host or get_local_ip()
    base_url = f"http://{ip_address}:{port}/masa/"

    output_dir = "Karekod_Ciktilari"
    os.makedirs(output_dir, exist_ok=True)

    print(f"Hedef adres: {ip_address}")
    print(f"Karekodlar olusturuluyor... Hedef: {base_url}[MASA_NO]")

    for i in range(1, num_tables + 1):
        table_url = f"{base_url}{i}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(table_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        filename = os.path.join(output_dir, f"Masa_{i}_QR.png")
        img.save(filename)
        print(f"OK: {filename} -> {table_url}")

    print("\nTum karekodlar basariyla olusturuldu.")
    print(f"Ciktilari '{output_dir}' klasorunde bulabilirsiniz.")


def parse_args():
    parser = argparse.ArgumentParser(description="Masa QR kodlari olustur.")
    parser.add_argument("--host", help="QR icine yazilacak IP veya domain")
    parser.add_argument("--port", type=int, default=5174, help="Frontend portu")
    parser.add_argument("--tables", type=int, default=10, help="Masa sayisi")
    return parser.parse_args()


if __name__ == "__main__":
    try:
        import qrcode  # noqa: F401
    except ImportError:
        print("Lutfen once qrcode kutuphanesini kurun: pip install qrcode[pil]")
        raise SystemExit(1)

    args = parse_args()
    generate_table_qrs(num_tables=args.tables, port=args.port, host=args.host)
