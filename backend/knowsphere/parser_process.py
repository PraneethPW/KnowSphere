"""Untrusted uploads are parsed in a short-lived, resource-bounded process."""

import asyncio
import contextlib
import json
import os
import sys

slots = asyncio.Semaphore(4)


async def parse_isolated(data: bytes, filename: str, max_chars: int) -> tuple[str, str]:
    extension = filename.rsplit(".", 1)[-1].lower()
    if extension not in {"pdf", "txt", "md", "csv"}:
        raise ValueError("Upload a PDF, TXT, Markdown, or CSV file.")
    try:
        await asyncio.wait_for(slots.acquire(), timeout=1)
    except TimeoutError as exc:
        raise ValueError("The file parser is busy. Please try again shortly.") from exc
    process = None
    try:
        # No application credentials are inherited by the parsing child.
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "knowsphere.parser_process",
            extension,
            str(max_chars),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env={"PATH": os.environ.get("PATH", ""), "PYTHONPATH": os.getcwd()},
        )
        stdout, _ = await asyncio.wait_for(process.communicate(data), timeout=30)
        if process.returncode != 0 or len(stdout) > max_chars * 8 + 4096:
            raise ValueError(
                "This file could not be parsed within safe resource limits. Upload extracted text instead."
            )
        result = json.loads(stdout)
        if "error" in result:
            raise ValueError(result["error"])
        return result["content"], extension
    except TimeoutError as exc:
        raise ValueError("File parsing timed out. Upload extracted text instead.") from exc
    finally:
        if process and process.returncode is None:
            with contextlib.suppress(ProcessLookupError):
                process.kill()
            await process.wait()
        slots.release()


def child():
    import resource

    # Linux production: bound address space and CPU before importing the PDF parser.
    resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
    if sys.platform.startswith("linux"):
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    from .text import parse_upload

    try:
        data = sys.stdin.buffer.read(20_000_001)
        if len(data) > 20_000_000:
            raise ValueError("File exceeds the upload limit.")
        content, _ = parse_upload(data, f"document.{sys.argv[1]}", int(sys.argv[2]))
        result = {"content": content}
    except ValueError as exc:
        result = {"error": str(exc)}
    except Exception:
        result = {"error": "This file could not be parsed. Check its format or upload extracted text."}
    print(json.dumps(result))


if __name__ == "__main__":
    child()
