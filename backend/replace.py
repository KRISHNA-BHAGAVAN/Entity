import os
from typing import Any, Dict, List, Tuple, Union
import json
from io import BytesIO


from docx import Document
from docx.document import Document as _Document
from docx.table import _Cell, Table
from docx.text.paragraph import Paragraph
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.oxml.ns import qn


def _replace_across_runs_preserve_style(
    para: Paragraph,
    old_value: str,
    new_value: str,
    match_case: bool = True,
) -> int:
    """
    Join all runs' text, replace old_value->new_value, then
    distribute back into the same runs (keeps style containers).
    Works for long phrases split across multiple runs.
    Returns number of replacements done in this paragraph.
    """
    if not para.runs or not old_value:
        return 0

    def normalize(s: str) -> str:
        return s if match_case else s.lower()

    run_texts = [r.text or "" for r in para.runs]
    combined = "".join(run_texts)
    combined_norm = normalize(combined)
    old_norm = normalize(old_value)

    if old_norm not in combined_norm:
        return 0

    if match_case:
        occurrences = combined.count(old_value)
        if occurrences == 0:
            return 0
        replaced = combined.replace(old_value, new_value)
    else:
        # case-insensitive replace while preserving original casing elsewhere
        lower_text = combined_norm
        lower_old = old_norm
        start = 0
        pieces: List[str] = []
        occurrences = 0
        while True:
            idx = lower_text.find(lower_old, start)
            if idx == -1:
                pieces.append(combined[start:])
                break
            pieces.append(combined[start:idx])
            pieces.append(new_value)
            start = idx + len(lower_old)
            occurrences += 1
        if occurrences == 0:
            return 0
        replaced = "".join(pieces)

    remaining = replaced
    for r in para.runs:
        if not remaining:
            r.text = ""
            continue
        orig_len = len(r.text or "")
        r.text = remaining[:orig_len]
        remaining = remaining[orig_len:]

    # if replaced string is longer than total run lengths,
    # append the extra text to the last run
    if remaining:
        para.runs[-1].text = (para.runs[-1].text or "") + remaining

    return occurrences

def _iter_textbox_paragraphs(document: _Document):
    """
    Yield python-docx Paragraph objects for paragraphs that live
    inside text boxes (w:txbxContent) anywhere in the main body.

    This lets us run the same replacement logic inside brochure
    text boxes / shapes whose text is not in document.paragraphs.
    """
    body = document.element.body
    txbx_tag = qn("w:txbxContent")
    p_tag = qn("w:p")

    # For each w:txbxContent, wrap each w:p as a Paragraph
    for txbx in body.iter():
        if txbx.tag != txbx_tag:
            continue
        for p in txbx.iter():
            if p.tag == p_tag:
                # parent of this w:p is somewhere inside the drawing;
                # the Document object is still a valid container
                yield Paragraph(p, document)

def replace_text_in_document_bytes(
    file_bytes: bytes,
    replacements: List[Tuple[str, str]],
    match_case: bool = True
) -> Tuple[BytesIO, int]:
    """
    Replace text in DOCX file from bytes in-memory.
    Returns: (output_stream, total_replacements_count)
    """
    input_stream = BytesIO(file_bytes)
    doc = Document(input_stream)
    
    total_file_replacements = 0

    for old_value, new_value in replacements:
        if not old_value:
            continue

        # 1) main-story paragraphs
        for para in doc.paragraphs:
            total_file_replacements += _replace_across_runs_preserve_style(
                para, old_value, new_value, match_case
            )

        # 2) table cell paragraphs
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        total_file_replacements += _replace_across_runs_preserve_style(
                            para, old_value, new_value, match_case
                        )

        # 3) text inside text boxes / shapes
        for tb_para in _iter_textbox_paragraphs(doc):
            total_file_replacements += _replace_across_runs_preserve_style(
                tb_para, old_value, new_value, match_case
            )

    # Save the result to a new BytesIO stream
    output_stream = BytesIO()
    doc.save(output_stream)
    output_stream.seek(0)  # Move pointer to the start so it's ready to read

    return output_stream, total_file_replacements

if __name__ == "__main__":
    import json

    doc_paths = [
        r"C:\Users\Krishna Bhagavan\projects\experiments\docs\3.Brouche -springboot-a.docx"
    ]

    output_paths = [
        "multiple_modified_1.docx"
    ]


    multiple_replacements = [
        ("Build Web/Enterprise Applications using SpringBoot WITH REST API", "Build Application using Generative AI"),
        ("REGISTRATION FORM", "BOKKALO FORM"),
        ("Artificial Intelligence and Machine Learning", "Computer Science Engineering")
    ]

    try:
        # 3. Read the input file into bytes (simulating an upload)
        print(f"Reading {doc_paths[0]}...")
        with open(doc_paths[0], "rb") as f:
            input_bytes = f.read()

        # 4. Call your bytes-based function
        print("Processing replacements in memory...")
        modified_stream, count = replace_text_in_document_bytes(
            file_bytes=input_bytes,
            replacements=multiple_replacements,
            match_case=True
        )

        # 5. Save the resulting BytesIO stream to a physical file to inspect it
        print(f"Total replacements made: {count}")
        with open(output_paths[0], "wb") as f:
            f.write(modified_stream.getbuffer()) # getbuffer() is efficient for writing BytesIO to disk

        print(f"Success! Please check '{output_paths[0]}' to verify the changes.")

    except FileNotFoundError:
        print(f"Error: The file '{doc_paths[0]}' was not found. Please place a .docx file in this folder.")
    except Exception as e:
        print(f"An error occurred: {e}")