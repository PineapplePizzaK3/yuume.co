"""Flatten Affinity SVGs with embedded PNG layers into one RGBA PNG."""
from __future__ import annotations

import base64
import re
import sys
import xml.etree.ElementTree as ET
from io import BytesIO
from pathlib import Path

from PIL import Image

XLINK = "{http://www.w3.org/1999/xlink}href"


def _px(val: str | None, default: float = 0.0) -> float:
    if not val:
        return default
    v = val.strip()
    if v.endswith("px"):
        v = v[:-2]
    return float(v)


def _mat_identity() -> tuple[float, float, float, float, float, float]:
    return (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def _mat_mul(
    m1: tuple[float, float, float, float, float, float],
    m2: tuple[float, float, float, float, float, float],
) -> tuple[float, float, float, float, float, float]:
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    )


def _mat_parse(transform: str | None) -> tuple[float, float, float, float, float, float]:
    if not transform:
        return _mat_identity()
    m = re.search(
        r"matrix\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)",
        transform,
    )
    if m:
        return tuple(float(m.group(i)) for i in range(1, 7))  # type: ignore[return-value]
    t = re.search(
        r"translate\(\s*([-+]?\d*\.?\d+)(?:[\s,]+([-+]?\d*\.?\d+))?\s*\)",
        transform,
    )
    if t:
        tx = float(t.group(1))
        ty = float(t.group(2) or 0.0)
        return (1.0, 0.0, 0.0, 1.0, tx, ty)
    return _mat_identity()


def _apply(m: tuple[float, float, float, float, float, float], x: float, y: float) -> tuple[float, float]:
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)


def _load_embedded_pngs(svg: str) -> dict[str, Image.Image]:
    out: dict[str, Image.Image] = {}
    for m in re.finditer(
        r'id="(_Image\d+)"[^>]*xlink:href="data:image/png;base64,([A-Za-z0-9+/=\r\n]+)"',
        svg,
    ):
        rid = m.group(1)
        raw = base64.b64decode(re.sub(r"\s+", "", m.group(2)))
        out[rid] = Image.open(BytesIO(raw)).convert("RGBA")
    return out


def _parse_viewbox(svg: str) -> tuple[int, int]:
    m = re.search(r'viewBox="0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"', svg)
    if not m:
        return (3840, 1400)
    return (int(float(m.group(1))), int(float(m.group(2))))


def _collect_layers(svg: str) -> list[tuple[str, float, float, float, float, tuple[float, float, float, float, float, float]]]:
    root = ET.fromstring(svg)
    layers: list[tuple[str, float, float, float, float, tuple[float, float, float, float, float, float]]] = []

    def walk(node: ET.Element, parent_m: tuple[float, float, float, float, float, float]) -> None:
        current_m = _mat_mul(parent_m, _mat_parse(node.attrib.get("transform")))
        tag = node.tag.split("}")[-1]
        if tag == "use":
            href = node.attrib.get(XLINK) or node.attrib.get("xlink:href") or node.attrib.get("href") or ""
            if href.startswith("#_Image"):
                rid = href[1:]
                x = _px(node.attrib.get("x"))
                y = _px(node.attrib.get("y"))
                w = _px(node.attrib.get("width"), 1.0)
                h = _px(node.attrib.get("height"), 1.0)
                use_m = _mat_mul(current_m, _mat_parse(node.attrib.get("transform")))
                layers.append((rid, x, y, w, h, use_m))
        for child in list(node):
            walk(child, current_m)

    walk(root, _mat_identity())
    return layers


def flatten_svg_to_png(svg_path: Path, out_path: Path) -> None:
    svg = svg_path.read_text(encoding="utf-8", errors="replace")
    w, h = _parse_viewbox(svg)
    images = _load_embedded_pngs(svg)
    layers = _collect_layers(svg)
    if not images:
        raise SystemExit("no embedded PNG images found in SVG")
    if not layers:
        raise SystemExit("no drawable layers found in SVG")

    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    for rid, x, y, lw, lh, m in layers:
        src = images.get(rid)
        if not src:
            continue
        layer = src.resize((max(1, int(round(lw))), max(1, int(round(lh)))), Image.Resampling.LANCZOS)

        p1 = _apply(m, x, y)
        p2 = _apply(m, x + lw, y)
        p3 = _apply(m, x, y + lh)
        p4 = _apply(m, x + lw, y + lh)
        xs = [p1[0], p2[0], p3[0], p4[0]]
        ys = [p1[1], p2[1], p3[1], p4[1]]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        tw = max(1, int(round(max_x - min_x)))
        th = max(1, int(round(max_y - min_y)))

        if layer.size != (tw, th):
            layer = layer.resize((tw, th), Image.Resampling.LANCZOS)

        canvas.alpha_composite(layer, (int(round(min_x)), int(round(min_y))))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, format="PNG", optimize=True)


def main() -> None:
    if len(sys.argv) < 3:
        print("usage: flatten-affinity-svg.py <input.svg> <output.png>", file=sys.stderr)
        sys.exit(1)
    flatten_svg_to_png(Path(sys.argv[1]), Path(sys.argv[2]))
    print("wrote", Path(sys.argv[2]))


if __name__ == "__main__":
    main()
