import re
from html import escape, unescape
from typing import Any
from urllib.parse import parse_qs, urlparse

from django.conf import settings


SUPPORTED_BLOCK_TYPES = {
    "heading",
    "list",
    "table",
    "image",
    "youtube",
    "blockquote",
    "faq",
    "highlight",
    "code",
}

YOUTUBE_HOST_PATTERNS = (
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
)


def strip_html_tags(value: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(value or ""))).strip()


def plain_text_from_html(value: Any) -> str:
    without_scripts = re.sub(
        r"<(script|style)[^>]*>[\s\S]*?</\1>",
        " ",
        str(value or ""),
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", without_scripts))).strip()


def extract_headings_from_html(raw_html: Any) -> str:
    headings = re.findall(
        r"<h[1-6][^>]*>(.*?)</h[1-6]>",
        str(raw_html or ""),
        flags=re.IGNORECASE | re.DOTALL,
    )
    cleaned = []
    for heading in headings:
        normalized = plain_text_from_html(heading)
        if normalized:
            cleaned.append(normalized)
    return " ".join(cleaned)[:4000]


def estimate_word_count(content: Any = "", faq_blocks: Any = None) -> int:
    text_fragments = [plain_text_from_html(content)]
    for item in normalize_faq_blocks(faq_blocks):
        text_fragments.append(item["question"])
        text_fragments.append(item["answer"])

    words = [
        token
        for token in re.split(r"\s+", " ".join(text_fragments).strip())
        if token.strip()
    ]
    return len(words)


def estimate_reading_time_minutes(content: Any = "", faq_blocks: Any = None) -> int:
    return max(1, (estimate_word_count(content=content, faq_blocks=faq_blocks) + 199) // 200)


def normalize_faq_blocks(value: Any) -> list[dict[str, str]]:
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise ValueError("FAQ blocks must be an array.")
    if len(value) > 12:
        raise ValueError("FAQ blocks cannot exceed 12 items.")

    normalized = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ValueError(
                f"FAQ item #{index + 1} must be an object with question and answer."
            )

        question = str(item.get("question", "")).strip()
        answer = str(item.get("answer", "")).strip()

        if not question:
            raise ValueError(f"FAQ item #{index + 1} requires a question.")
        if not answer:
            raise ValueError(f"FAQ item #{index + 1} requires an answer.")
        if len(question) > 220:
            raise ValueError(
                f"FAQ item #{index + 1} question must be 220 characters or fewer."
            )
        if len(answer) > 2000:
            raise ValueError(
                f"FAQ item #{index + 1} answer must be 2000 characters or fewer."
            )

        normalized.append({"question": question, "answer": answer})

    return normalized


def _normalize_heading_block(block: dict[str, Any]) -> dict[str, Any]:
    level = int(block.get("level", 2))
    if level < 1 or level > 6:
        raise ValueError("Heading block level must be between 1 and 6.")

    text = str(block.get("text", "")).strip()
    if not text:
        raise ValueError("Heading block requires text.")

    return {"type": "heading", "level": level, "text": text[:300]}


def _normalize_list_block(block: dict[str, Any]) -> dict[str, Any]:
    items = block.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("List block requires one or more items.")

    cleaned_items = [str(item).strip() for item in items if str(item).strip()]
    if not cleaned_items:
        raise ValueError("List block requires one or more items.")

    style = str(block.get("style", "unordered")).strip().lower()
    if style not in {"unordered", "ordered"}:
        raise ValueError("List block style must be unordered or ordered.")

    return {"type": "list", "style": style, "items": cleaned_items[:50]}


def _normalize_table_block(block: dict[str, Any]) -> dict[str, Any]:
    rows = block.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Table block requires rows.")

    cleaned_rows = []
    for row in rows[:20]:
        if not isinstance(row, list):
            raise ValueError("Table rows must be arrays.")
        cleaned_cells = [str(cell).strip() for cell in row[:10]]
        if any(cleaned_cells):
            cleaned_rows.append(cleaned_cells)

    if not cleaned_rows:
        raise ValueError("Table block requires at least one non-empty row.")

    return {"type": "table", "rows": cleaned_rows}


def _normalize_image_block(block: dict[str, Any]) -> dict[str, Any]:
    src = str(block.get("src", "")).strip()
    if not src:
        raise ValueError("Image block requires src.")

    return {
        "type": "image",
        "src": src[:500],
        "alt": str(block.get("alt", "")).strip()[:240],
        "caption": str(block.get("caption", "")).strip()[:400],
    }


def _extract_youtube_url(value: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise ValueError("YouTube block requires url.")

    parsed = urlparse(cleaned)
    if parsed.netloc not in YOUTUBE_HOST_PATTERNS:
        raise ValueError("YouTube block requires a valid YouTube URL.")

    video_id = ""
    if "youtu.be" in parsed.netloc:
        video_id = parsed.path.strip("/")
    elif parsed.path.startswith("/embed/"):
        video_id = parsed.path.split("/embed/", 1)[1].split("/", 1)[0]
    else:
        video_id = parse_qs(parsed.query).get("v", [""])[0]

    if not re.fullmatch(r"[\w-]{6,20}", video_id):
        raise ValueError("YouTube block requires a valid video identifier.")

    return f"https://www.youtube.com/watch?v={video_id}"


def _normalize_youtube_block(block: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "youtube",
        "url": _extract_youtube_url(block.get("url", "")),
        "caption": str(block.get("caption", "")).strip()[:240],
    }


def _normalize_blockquote_block(block: dict[str, Any]) -> dict[str, Any]:
    quote = str(block.get("quote", "")).strip()
    if not quote:
        raise ValueError("Blockquote block requires quote text.")

    return {
        "type": "blockquote",
        "quote": quote[:1200],
        "citation": str(block.get("citation", "")).strip()[:240],
    }


def _normalize_highlight_block(block: dict[str, Any]) -> dict[str, Any]:
    text = str(block.get("text", "")).strip()
    if not text:
        raise ValueError("Highlight block requires text.")

    return {"type": "highlight", "text": text[:1200]}


def _normalize_code_block(block: dict[str, Any]) -> dict[str, Any]:
    code = str(block.get("code", "")).rstrip()
    if not code:
        raise ValueError("Code block requires code.")

    return {
        "type": "code",
        "language": str(block.get("language", "")).strip()[:40],
        "code": code[:10000],
    }


def _normalize_faq_block(block: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_faq_blocks([block])[0]
    return {"type": "faq", **normalized}


def normalize_content_blocks(value: Any) -> list[dict[str, Any]]:
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise ValueError("Content blocks must be an array.")
    if len(value) > 80:
        raise ValueError("Content blocks cannot exceed 80 items.")

    normalized = []
    for index, raw_block in enumerate(value):
        if not isinstance(raw_block, dict):
            raise ValueError(f"Block #{index + 1} must be an object.")

        block_type = str(raw_block.get("type", "")).strip().lower()
        if block_type not in SUPPORTED_BLOCK_TYPES:
            raise ValueError(f"Block #{index + 1} type '{block_type}' is not supported.")

        if block_type == "heading":
            normalized.append(_normalize_heading_block(raw_block))
        elif block_type == "list":
            normalized.append(_normalize_list_block(raw_block))
        elif block_type == "table":
            normalized.append(_normalize_table_block(raw_block))
        elif block_type == "image":
            normalized.append(_normalize_image_block(raw_block))
        elif block_type == "youtube":
            normalized.append(_normalize_youtube_block(raw_block))
        elif block_type == "blockquote":
            normalized.append(_normalize_blockquote_block(raw_block))
        elif block_type == "faq":
            normalized.append(_normalize_faq_block(raw_block))
        elif block_type == "highlight":
            normalized.append(_normalize_highlight_block(raw_block))
        elif block_type == "code":
            normalized.append(_normalize_code_block(raw_block))

    return normalized


def _youtube_embed_src(url: str) -> str:
    normalized = _extract_youtube_url(url)
    video_id = parse_qs(urlparse(normalized).query).get("v", [""])[0]
    return f"https://www.youtube.com/embed/{video_id}"


def render_content_blocks_to_html(blocks: Any) -> str:
    normalized_blocks = normalize_content_blocks(blocks)
    fragments = []

    for block in normalized_blocks:
        block_type = block["type"]
        if block_type == "heading":
            fragments.append(
                f"<h{block['level']}>{escape(block['text'])}</h{block['level']}>"
            )
        elif block_type == "list":
            tag = "ol" if block["style"] == "ordered" else "ul"
            items = "".join(f"<li>{escape(item)}</li>" for item in block["items"])
            fragments.append(f"<{tag}>{items}</{tag}>")
        elif block_type == "table":
            row_html = []
            for index, row in enumerate(block["rows"]):
                cell_tag = "th" if index == 0 else "td"
                cells = "".join(f"<{cell_tag}>{escape(cell)}</{cell_tag}>" for cell in row)
                row_html.append(f"<tr>{cells}</tr>")
            fragments.append("<table><tbody>" + "".join(row_html) + "</tbody></table>")
        elif block_type == "image":
            caption_html = (
                f"<figcaption>{escape(block['caption'])}</figcaption>"
                if block.get("caption")
                else ""
            )
            fragments.append(
                f"<figure><img src=\"{escape(block['src'])}\" alt=\"{escape(block.get('alt', ''))}\" />{caption_html}</figure>"
            )
        elif block_type == "youtube":
            caption_html = (
                f"<figcaption>{escape(block['caption'])}</figcaption>"
                if block.get("caption")
                else ""
            )
            fragments.append(
                "<figure class=\"tcb-youtube\">"
                f"<iframe src=\"{escape(_youtube_embed_src(block['url']))}\" "
                "title=\"YouTube video\" loading=\"lazy\" allowfullscreen></iframe>"
                f"{caption_html}</figure>"
            )
        elif block_type == "blockquote":
            citation_html = (
                f"<cite>{escape(block['citation'])}</cite>" if block.get("citation") else ""
            )
            fragments.append(
                f"<blockquote><p>{escape(block['quote'])}</p>{citation_html}</blockquote>"
            )
        elif block_type == "faq":
            fragments.append(
                "<details class=\"faq-block\">"
                f"<summary>{escape(block['question'])}</summary>"
                f"<p>{escape(block['answer'])}</p>"
                "</details>"
            )
        elif block_type == "highlight":
            fragments.append(
                f"<aside class=\"tcb-highlight\"><p>{escape(block['text'])}</p></aside>"
            )
        elif block_type == "code":
            language_class = (
                f" class=\"language-{escape(block['language'])}\""
                if block.get("language")
                else ""
            )
            fragments.append(
                f"<pre><code{language_class}>{escape(block['code'])}</code></pre>"
            )

    return "".join(fragments)


def _span_overlaps(start: int, end: int, spans: list[tuple[int, int]]) -> bool:
    return any(start < existing_end and end > existing_start for existing_start, existing_end in spans)


def _append_match(
    matches: list[tuple[int, dict[str, Any]]],
    spans: list[tuple[int, int]],
    match: re.Match[str],
    payload: dict[str, Any],
) -> None:
    start, end = match.span()
    if _span_overlaps(start, end, spans):
        return
    matches.append((start, payload))
    spans.append((start, end))


def _clean_attr_value(raw_tag: str, attr_name: str) -> str:
    attr_match = re.search(
        rf"{attr_name}\s*=\s*[\"']([^\"']+)[\"']",
        raw_tag,
        flags=re.IGNORECASE,
    )
    if not attr_match:
        return ""
    return unescape(attr_match.group(1).strip())


def extract_content_blocks_from_html(
    raw_html: Any,
    faq_blocks: Any = None,
) -> list[dict[str, Any]]:
    html = str(raw_html or "")
    if not html.strip():
        normalized_faq = []
        try:
            normalized_faq = normalize_faq_blocks(faq_blocks)
        except ValueError:
            normalized_faq = []
        return [{"type": "faq", **item} for item in normalized_faq]

    ordered_matches: list[tuple[int, dict[str, Any]]] = []
    spans: list[tuple[int, int]] = []

    for match in re.finditer(
        r"<h([1-6])[^>]*>(.*?)</h\1>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        text = plain_text_from_html(match.group(2))
        if not text:
            continue
        _append_match(
            ordered_matches,
            spans,
            match,
            {"type": "heading", "level": int(match.group(1)), "text": text[:300]},
        )

    for match in re.finditer(
        r"<(ul|ol)[^>]*>(.*?)</\1>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        items = [
            plain_text_from_html(item)
            for item in re.findall(r"<li[^>]*>(.*?)</li>", match.group(2), flags=re.IGNORECASE | re.DOTALL)
        ]
        cleaned_items = [item for item in items if item]
        if not cleaned_items:
            continue
        _append_match(
            ordered_matches,
            spans,
            match,
            {
                "type": "list",
                "style": "ordered" if match.group(1).lower() == "ol" else "unordered",
                "items": cleaned_items[:50],
            },
        )

    for match in re.finditer(
        r"<table[^>]*>(.*?)</table>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        rows = []
        for row_markup in re.findall(r"<tr[^>]*>(.*?)</tr>", match.group(1), flags=re.IGNORECASE | re.DOTALL):
            cells = [
                plain_text_from_html(cell)
                for cell in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row_markup, flags=re.IGNORECASE | re.DOTALL)
            ]
            if any(cells):
                rows.append(cells[:10])
        if not rows:
            continue
        _append_match(
            ordered_matches,
            spans,
            match,
            {"type": "table", "rows": rows[:20]},
        )

    for match in re.finditer(
        r"<figure[^>]*>(.*?)</figure>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        figure_markup = match.group(0)
        image_match = re.search(r"<img[^>]*>", figure_markup, flags=re.IGNORECASE)
        iframe_match = re.search(r"<iframe[^>]*>", figure_markup, flags=re.IGNORECASE)
        caption = plain_text_from_html(
            "".join(
                re.findall(
                    r"<figcaption[^>]*>(.*?)</figcaption>",
                    figure_markup,
                    flags=re.IGNORECASE | re.DOTALL,
                )
            )
        )

        if image_match:
            image_tag = image_match.group(0)
            src = _clean_attr_value(image_tag, "src")
            if src:
                _append_match(
                    ordered_matches,
                    spans,
                    match,
                    {
                        "type": "image",
                        "src": src[:500],
                        "alt": _clean_attr_value(image_tag, "alt")[:240],
                        "caption": caption[:400],
                    },
                )
                continue

        if iframe_match:
            iframe_tag = iframe_match.group(0)
            src = _clean_attr_value(iframe_tag, "src")
            if any(host in src for host in YOUTUBE_HOST_PATTERNS):
                try:
                    normalized_url = _extract_youtube_url(src)
                except ValueError:
                    continue
                _append_match(
                    ordered_matches,
                    spans,
                    match,
                    {
                        "type": "youtube",
                        "url": normalized_url,
                        "caption": caption[:240],
                    },
                )

    for match in re.finditer(r"<img[^>]*>", html, flags=re.IGNORECASE):
        src = _clean_attr_value(match.group(0), "src")
        if not src:
            continue
        _append_match(
            ordered_matches,
            spans,
            match,
            {
                "type": "image",
                "src": src[:500],
                "alt": _clean_attr_value(match.group(0), "alt")[:240],
                "caption": "",
            },
        )

    for match in re.finditer(
        r"<iframe[^>]*src=[\"']([^\"']+)[\"'][^>]*></iframe>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        src = unescape(match.group(1).strip())
        if not any(host in src for host in YOUTUBE_HOST_PATTERNS):
            continue
        try:
            normalized_url = _extract_youtube_url(src)
        except ValueError:
            continue
        _append_match(
            ordered_matches,
            spans,
            match,
            {"type": "youtube", "url": normalized_url, "caption": ""},
        )

    for match in re.finditer(
        r"<blockquote[^>]*>(.*?)</blockquote>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        citation = plain_text_from_html(
            "".join(
                re.findall(r"<cite[^>]*>(.*?)</cite>", match.group(1), flags=re.IGNORECASE | re.DOTALL)
            )
        )
        quote = plain_text_from_html(re.sub(r"<cite[^>]*>[\s\S]*?</cite>", " ", match.group(1), flags=re.IGNORECASE))
        if not quote:
            continue
        _append_match(
            ordered_matches,
            spans,
            match,
            {"type": "blockquote", "quote": quote[:1200], "citation": citation[:240]},
        )

    for match in re.finditer(
        r"<aside[^>]*class=[\"'][^\"']*(tcb-callout|tcb-highlight)[^\"']*[\"'][^>]*>(.*?)</aside>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        text = plain_text_from_html(match.group(2))
        if not text:
            continue
        _append_match(
            ordered_matches,
            spans,
            match,
            {"type": "highlight", "text": text[:1200]},
        )

    for match in re.finditer(
        r"<pre[^>]*>\s*<code([^>]*)>(.*?)</code>\s*</pre>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        language_match = re.search(
            r"class=[\"'][^\"']*language-([a-z0-9_+-]+)[^\"']*[\"']",
            match.group(1),
            flags=re.IGNORECASE,
        )
        code_text = unescape(match.group(2)).strip()
        if not code_text:
            continue
        _append_match(
            ordered_matches,
            spans,
            match,
            {
                "type": "code",
                "language": (language_match.group(1) if language_match else "")[:40],
                "code": code_text[:10000],
            },
        )

    try:
        normalized_faq = normalize_faq_blocks(faq_blocks)
    except ValueError:
        normalized_faq = []

    faq_block_matches = [
        (
            len(html) + index,
            {"type": "faq", "question": item["question"], "answer": item["answer"]},
        )
        for index, item in enumerate(normalized_faq)
    ]

    ordered_blocks = [payload for _, payload in sorted(ordered_matches + faq_block_matches, key=lambda item: item[0])]
    try:
        return normalize_content_blocks(ordered_blocks)
    except ValueError:
        return ordered_blocks


def build_slug_preview(slug: Any) -> str:
    site_url = str(getattr(settings, "FRONTEND_SITE_URL", "") or "").rstrip("/")
    path = f"/blog/{str(slug or '').strip('/')}/" if str(slug or "").strip() else "/blog/"
    if site_url:
        return f"{site_url}{path}"
    return path


def build_seo_preview(*, title: Any, seo_title: Any, excerpt: Any, seo_description: Any, slug: Any) -> dict[str, str]:
    preview_title = str(seo_title or title or "").strip()[:70]
    preview_description = str(seo_description or excerpt or plain_text_from_html(excerpt or "")).strip()[:170]
    return {
        "title": preview_title,
        "description": preview_description,
        "url": build_slug_preview(slug),
    }
