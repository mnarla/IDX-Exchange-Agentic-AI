"""Run with: uv run --with pypdf python scripts/extract_knowledge.py /path/to/IDX"""
import json
import sys
from pathlib import Path
from pypdf import PdfReader
root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
for name, pages in [('Real Estate Data Analysis Primer', None), ('Trestle Property Metadata from IDX Exchange', None), ('AI Agentic Engineer Intern Handbook 2026', [4, 5, 6])]:
    path = source / (name + '.pdf')
    reader = PdfReader(path)
    docs = [{'title': name, 'location': f'page {i+1}', 'content': page.extract_text() or ''} for i, page in enumerate(reader.pages) if pages is None or i+1 in pages]
    (root / 'knowledge/sources' / (name + '.json')).write_text(json.dumps(docs, indent=2), encoding='utf8')
