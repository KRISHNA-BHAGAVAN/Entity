import os
import shutil
import subprocess
import tempfile
from typing import Generator
from fastapi import UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from server import app

load_dotenv(dotenv_path=".env")


def get_soffice_path() -> str:
    """
    Resolve the LibreOffice 'soffice' executable path.

    On Linux/macOS, 'soffice' is usually on PATH after installing LibreOffice.
    On Windows, it may be something like:
        C:\\Program Files\\LibreOffice\\program\\soffice.exe

    You can also set LIBREOFFICE_PATH in your environment.
    """
    env_path = os.getenv("LIBREOFFICE_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    # Try to find in PATH
    soffice = shutil.which("soffice")
    if soffice:
        return soffice

    raise RuntimeError(
        "LibreOffice 'soffice' not found. "
        "Install LibreOffice and/or set LIBREOFFICE_PATH to the soffice executable."
    )


def docx_bytes_to_pdf_bytes(docx_bytes: bytes) -> bytes:
    """
    Convert DOCX bytes to PDF bytes using LibreOffice in headless mode.

    :param docx_bytes: Input DOCX as bytes
    :return: Output PDF as bytes
    """
    if not docx_bytes:
        raise ValueError("Empty DOCX content")

    soffice_path = get_soffice_path()

    # Use a temporary directory to hold input and output files
    with tempfile.TemporaryDirectory() as tmpdir:
        input_docx_path = os.path.join(tmpdir, "input.docx")
        output_pdf_path = os.path.join(tmpdir, "input.pdf")

        # Write DOCX bytes to temp file
        with open(input_docx_path, "wb") as f:
            f.write(docx_bytes)

        # Build LibreOffice headless command
        # --headless: no UI
        # --convert-to pdf: convert to PDF
        # --outdir: output directory
        cmd = [
            soffice_path,
            "--headless",
            "--nologo",
            "--nofirststartwizard",
            "--convert-to",
            "pdf",
            "--outdir",
            tmpdir,
            input_docx_path,
        ]

        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"LibreOffice conversion failed with code {result.returncode}: "
                f"{result.stderr.decode(errors='ignore')}"
            )

        if not os.path.exists(output_pdf_path):
            # Some LibreOffice versions may name output a bit differently; fallback search
            candidates = [p for p in os.listdir(tmpdir) if p.lower().endswith(".pdf")]
            if not candidates:
                raise RuntimeError("PDF file not created by LibreOffice.")
            output_pdf_path = os.path.join(tmpdir, candidates[0])

        # Read resulting PDF into memory
        with open(output_pdf_path, "rb") as f:
            pdf_bytes = f.read()

        return pdf_bytes


@app.post("/convert-docx-to-pdf")
async def convert_docx_to_pdf(file: UploadFile = File(...)):
    """
    FastAPI endpoint: accepts DOCX upload, returns PDF as streaming response.
    """
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    content = await file.read()
    try:
        pdf_bytes = docx_bytes_to_pdf_bytes(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {exc}")

    # Simple generator for StreamingResponse
    def pdf_iter() -> Generator[bytes, None, None]:
        yield pdf_bytes

    headers = {
        "Content-Disposition": f'attachment; filename="{os.path.splitext(file.filename)[0]}.pdf"'
    }

    return StreamingResponse(
        pdf_iter(),
        media_type="application/pdf",
        headers=headers,
    )


if __name__ == "__main__":
    """
    Simple local test without running FastAPI:
    - Reads the given DOCX file
    - Converts to the given PDF path using the same converter
    """

    input_path = r"C:\Users\Krishna Bhagavan\projects\entity-v3\example-docs\3.Brouche -springboot-a.docx"
    output_path = r"C:\Users\Krishna Bhagavan\projects\entity-v3\backend\modified_brochure.pdf"

    if not os.path.exists(input_path):
        raise SystemExit(
            f"Test input file '{input_path}' not found.\n"
            f"Please check the path or update 'input_path' in __main__."
        )

    # Read DOCX into bytes
    with open(input_path, "rb") as f:
        input_bytes = f.read()

    # Convert bytes
    try:
        pdf_bytes = docx_bytes_to_pdf_bytes(input_bytes)
    except Exception as exc:
        raise SystemExit(f"Conversion failed in __main__ test: {exc}")

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Write PDF bytes to disk
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)

    print(f"Conversion successful. Wrote: {output_path}")
