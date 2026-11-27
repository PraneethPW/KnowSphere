"""Download the pinned, checksum-verified ONNX model. No user documents are transmitted."""

import hashlib
import json
import os
import tempfile
import time
from pathlib import Path

import httpx

from .config import settings

MANIFEST = json.loads(Path(__file__).with_name("ml_manifest.json").read_text())


def verified(path: Path, description: dict) -> bool:
    if not path.is_file() or path.stat().st_size != description["bytes"]:
        return False
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest() == description["sha256"]


def prepare():
    directory = settings().ml_model_dir
    directory.mkdir(parents=True, exist_ok=True)
    for filename, description in MANIFEST["files"].items():
        target = directory / filename
        if verified(target, description):
            print(f"Verified {filename}")
            continue
        url = f"https://huggingface.co/{MANIFEST['model']}/resolve/{MANIFEST['revision']}/{description['source']}"
        for attempt in range(3):
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=directory, delete=False) as handle:
                    temporary = Path(handle.name)
                    total = 0
                    with httpx.stream("GET", url, follow_redirects=True, timeout=120) as response:
                        response.raise_for_status()
                        for block in response.iter_bytes():
                            total += len(block)
                            if total > description["bytes"]:
                                raise ValueError("Downloaded model file exceeds its pinned size")
                            handle.write(block)
                if not verified(temporary, description):
                    raise ValueError("Downloaded model failed its pinned SHA-256 check")
                os.replace(temporary, target)
                print(f"Prepared {filename}")
                break
            except (httpx.HTTPError, ValueError):
                if attempt == 2:
                    raise RuntimeError(
                        f"Could not prepare verified {filename}; retry python -m knowsphere.prepare_ml"
                    ) from None
                time.sleep(2**attempt)
            finally:
                if temporary:
                    temporary.unlink(missing_ok=True)
    print(f"Ready: {MANIFEST['model']} @ {MANIFEST['revision']}")


if __name__ == "__main__":
    prepare()
