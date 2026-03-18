from __future__ import annotations

import base64
import binascii
import io
import posixpath
import re
import zipfile
from html.parser import HTMLParser
from xml.etree import ElementTree as ET


_BLOCK_TAGS = {
    "article",
    "aside",
    "blockquote",
    "br",
    "div",
    "figcaption",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "li",
    "main",
    "nav",
    "p",
    "section",
    "td",
    "th",
    "tr",
}
_IGNORED_TAGS = {"script", "style", "noscript"}
_HTML_MEDIA_TYPES = {
    "application/xhtml+xml",
    "text/html",
    "application/xml",
}


class _HTMLToTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        normalized = tag.lower()
        if normalized in _IGNORED_TAGS:
            self._ignored_depth += 1
            return
        if self._ignored_depth > 0:
            return
        if normalized in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.lower()
        if normalized in _IGNORED_TAGS and self._ignored_depth > 0:
            self._ignored_depth -= 1
            return
        if self._ignored_depth > 0:
            return
        if normalized in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._ignored_depth > 0:
            return
        if data:
            self._parts.append(data)

    def get_text(self) -> str:
        raw = "".join(self._parts)
        raw = re.sub(r"[ \t\r\f\v]+", " ", raw)
        lines = [line.strip() for line in raw.split("\n")]
        collapsed_lines = [line for line in lines if line]
        return "\n".join(collapsed_lines).strip()


def _decode_epub_payload(raw_content: str) -> bytes:
    value = raw_content.strip()
    if not value:
        raise ValueError("EPUB payload is empty")

    payload = value
    lowered = value.lower()
    if lowered.startswith("data:"):
        marker = ";base64,"
        idx = lowered.find(marker)
        if idx == -1:
            raise ValueError("EPUB data URL must be base64 encoded")
        payload = value[idx + len(marker) :]
    elif lowered.startswith("base64:"):
        payload = value.split(":", 1)[1]

    payload = re.sub(r"\s+", "", payload)
    try:
        decoded = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid base64 EPUB payload") from exc
    if not decoded:
        raise ValueError("EPUB payload is empty after decoding")
    return decoded


def _read_xml_from_zip(book: zipfile.ZipFile, path: str) -> ET.Element:
    try:
        content = book.read(path)
    except KeyError as exc:
        raise ValueError(f"EPUB missing required file: {path}") from exc
    try:
        return ET.fromstring(content)
    except ET.ParseError as exc:
        raise ValueError(f"Invalid XML in EPUB file: {path}") from exc


def _resolve_path(base_path: str, relative_path: str) -> str:
    base_dir = posixpath.dirname(base_path)
    return posixpath.normpath(posixpath.join(base_dir, relative_path))


def _find_opf_path(book: zipfile.ZipFile) -> str:
    try:
        container = _read_xml_from_zip(book, "META-INF/container.xml")
        for rootfile in container.findall(".//{*}rootfile"):
            full_path = (rootfile.attrib.get("full-path") or "").strip()
            if full_path:
                return full_path
    except ValueError:
        pass

    for path in book.namelist():
        if path.lower().endswith(".opf"):
            return path
    raise ValueError("Unable to locate OPF package document in EPUB")


def _collect_document_paths(book: zipfile.ZipFile, opf_path: str) -> list[str]:
    package = _read_xml_from_zip(book, opf_path)
    manifest: dict[str, str] = {}
    for item in package.findall(".//{*}manifest/{*}item"):
        item_id = (item.attrib.get("id") or "").strip()
        href = (item.attrib.get("href") or "").strip()
        media_type = (item.attrib.get("media-type") or "").strip().lower()
        if not item_id or not href:
            continue
        if media_type and media_type not in _HTML_MEDIA_TYPES:
            continue
        manifest[item_id] = _resolve_path(opf_path, href)

    ordered_paths: list[str] = []
    for itemref in package.findall(".//{*}spine/{*}itemref"):
        idref = (itemref.attrib.get("idref") or "").strip()
        if not idref:
            continue
        path = manifest.get(idref)
        if path and path not in ordered_paths:
            ordered_paths.append(path)

    if ordered_paths:
        return ordered_paths

    for path in manifest.values():
        if path not in ordered_paths:
            ordered_paths.append(path)
    if ordered_paths:
        return ordered_paths

    fallback_paths = [
        path
        for path in book.namelist()
        if path.lower().endswith((".xhtml", ".html", ".htm"))
    ]
    if fallback_paths:
        return fallback_paths

    raise ValueError("EPUB has no readable HTML content files")


def _html_to_text(content: bytes) -> str:
    parser = _HTMLToTextParser()
    parser.feed(content.decode("utf-8", errors="ignore"))
    parser.close()
    return parser.get_text()


def extract_text_from_epub_payload(raw_content: str) -> str:
    epub_bytes = _decode_epub_payload(raw_content)
    try:
        with zipfile.ZipFile(io.BytesIO(epub_bytes)) as book:
            opf_path = _find_opf_path(book)
            document_paths = _collect_document_paths(book, opf_path)
            blocks: list[str] = []
            for path in document_paths:
                try:
                    html_bytes = book.read(path)
                except KeyError:
                    continue
                text = _html_to_text(html_bytes)
                if text:
                    blocks.append(text)
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid EPUB zip archive") from exc

    if not blocks:
        raise ValueError("EPUB text extraction produced empty content")
    return "\n\n".join(blocks)
