#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import re, sys

ROOT = Path(__file__).resolve().parent
errors = []
warnings = []

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.ids = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        for key in ("href", "src"):
            value = attrs.get(key)
            if value:
                self.refs.append((tag, key, value))

for html in ROOT.glob("*.html"):
    parser = Parser()
    parser.feed(html.read_text(encoding="utf-8", errors="ignore"))

    duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicates:
        warnings.append(f"{html.name}: duplicate ids: {', '.join(duplicates)}")

    for tag, key, ref in parser.refs:
        if ref.startswith(("http:", "https:", "//", "#", "mailto:", "tel:", "data:", "javascript:")):
            continue
        clean = ref.split("?", 1)[0].split("#", 1)[0]
        if not clean:
            continue
        target = ROOT / clean
        if not target.exists():
            errors.append(f"{html.name}: missing {key} target {clean}")

for js in ROOT.glob("*.js"):
    text = js.read_text(encoding="utf-8", errors="ignore")
    if re.search(r"\bYOUR_PUBLIC_ANON_KEY\b", text) and js.name != "config.js":
        warnings.append(f"{js.name}: placeholder configuration referenced")

print(f"Checked {len(list(ROOT.glob('*.html')))} HTML files.")
for item in warnings:
    print("WARNING:", item)
for item in errors:
    print("ERROR:", item)

sys.exit(1 if errors else 0)
