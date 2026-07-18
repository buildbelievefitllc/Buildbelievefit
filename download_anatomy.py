import os
import requests
import sys


def download_anatomy_asset():
    target_dir = "assets/anatomy/"
    file_name = "model.glb"
    url = "https://github.com/hpfrei/body-anatomy-3d-viewer/raw/main/model.glb"
    save_path = os.path.join(target_dir, file_name)

    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        print(f"Created directory: {target_dir}")
    print(f"Starting download: {url}")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        total_size = int(response.headers.get('content-length', 0))
        downloaded_size = 0
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded_size += len(chunk)
                    if total_size > 0:
                        percent = (downloaded_size / total_size) * 100
                        sys.stdout.write(f"\rProgress: {percent:.1f}%")
                        sys.stdout.flush()
        print(f"\nSuccess: Asset saved to {save_path}")
    except requests.exceptions.RequestException as e:
        print(f"\nError downloading model: {e}")


if __name__ == "__main__":
    download_anatomy_asset()
