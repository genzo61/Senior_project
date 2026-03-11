import qrcode
import os
import socket

def get_local_ip():
    try:
        # Create a dummy socket to determine the local IP address
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def generate_table_qrs(num_tables=10, port=3001):
    """
    Karekod oluşturucu
    Çalıştırmak için: pip install qrcode[pil]
    """
    ip_address = get_local_ip()
    base_url = f"http://{ip_address}:{port}/masa/"
    
    # Çıktı klasörünü oluştur
    output_dir = "Karekod_Ciktilari"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    print(f"🌍 Yerel IP Adresiniz: {ip_address}")
    print(f"📲 Karekodlar oluşturuluyor... Hedef: {base_url}[MASA_NO]")
    
    for i in range(1, num_tables + 1):
        table_url = f"{base_url}{i}"
        
        # QR kod oluştur
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(table_url)
        qr.make(fit=True)
        
        # QR resmi oluştur
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Kaydet
        filename = os.path.join(output_dir, f"Masa_{i}_QR.png")
        img.save(filename)
        print(f"✅ {filename} oluşturuldu -> {table_url}")

    print("\n🎉 Tüm karekodlar başarıyla oluşturuldu!")
    print(f"👉 Çıktıları '{output_dir}' klasöründe bulabilirsiniz.")
    print("⚠️ NOT: Telefonunuzun tarayıcıdan bağlanabilmesi için telefon ve bilgisayarınızın AYNI Wi-Fi AĞINA bağlı olduğundan emin olun.")

if __name__ == "__main__":
    try:
        import qrcode
    except ImportError:
        print("Lütfen önce qrcode kütüphanesini kurun: pip install qrcode[pil]")
        exit(1)
        
    generate_table_qrs()
