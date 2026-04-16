"""Extract first embedded data:image/png;base64 from Affinity-style SVG to a PNG file."""
import base64
import re
import sys
from pathlib import Path


def main():
    if len(sys.argv) < 3:
        print("usage: extract-png-from-svg.py <input.svg> <output.png>", file=sys.stderr)
        sys.exit(1)
    svg_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    svg = svg_path.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"data:image/png;base64,([A-Za-z0-9+/=\r\n]+)", svg)
    if not m:
        print("no embedded PNG found", file=sys.stderr)
        sys.exit(1)
    b64 = re.sub(r"\s+", "", m.group(1))
    raw = base64.b64decode(b64)
    out_path.write_bytes(raw)
    print(len(raw), "bytes ->", out_path)


if __name__ == "__main__":
    main()
