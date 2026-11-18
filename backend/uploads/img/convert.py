import os
from pathlib import Path
from PIL import Image

def convert_jpeg_to_webp(directory=".", delete_original=True):
    path = Path(directory)
    valid_extensions = {".jpg", ".jpeg", ".JPG", ".JPEG"}
    count = 0

    for file_path in path.iterdir():
        if file_path.suffix in valid_extensions:
            webp_path = file_path.with_suffix(".webp")

            try:
                with Image.open(file_path) as img:
                    img.save(webp_path, "WEBP", quality=80)

                print(f"Сконвертировано: {file_path.name} -> {webp_path.name}")

                if delete_original:
                    file_path.unlink()
                    print(f"Удален оригинал: {file_path.name}")

                count += 1
            except Exception as e:
                print(f"Ошибка при обработке {file_path.name}: {e}")

    print(f"\nГотово! Успешно обработано файлов: {count}")

if __name__ == "__main__":
    convert_jpeg_to_webp(delete_original=True)