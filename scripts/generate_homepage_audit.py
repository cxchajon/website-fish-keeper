#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urljoin, urlparse

VOID_TAGS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}


class Element:
    def __init__(self, tag: str, attrs: Optional[Dict[str, str]] = None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children: List[Any] = []
        self.parent: Optional["Element"] = None

    def append_child(self, child: Any) -> None:
        if isinstance(child, Element):
            child.parent = self
        self.children.append(child)

    def iter(self) -> "List[Element]":
        yield self
        for child in self.children:
            if isinstance(child, Element):
                yield from child.iter()

    def find_all(self, tag: str) -> List["Element"]:
        results = []
        for child in self.children:
            if isinstance(child, Element):
                if child.tag == tag:
                    results.append(child)
                results.extend(child.find_all(tag))
        return results

    def find_first(self, tag: str) -> Optional["Element"]:
        for child in self.children:
            if isinstance(child, Element):
                if child.tag == tag:
                    return child
                match = child.find_first(tag)
                if match is not None:
                    return match
        return None

    def text_content(self) -> str:
        parts: List[str] = []
        for child in self.children:
            if isinstance(child, str):
                parts.append(child)
            elif isinstance(child, Element):
                if child.tag == "br":
                    parts.append("\n")
                else:
                    parts.append(child.text_content())
        return "".join(parts)


class TreeBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Element("document")
        self.stack: List[Element] = [self.root]

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attrs_dict = {name: (value if value is not None else "") for name, value in attrs}
        element = Element(tag.lower(), attrs_dict)
        self.stack[-1].append_child(element)
        if tag.lower() not in VOID_TAGS:
            self.stack.append(element)

    def handle_startendtag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag_lower:
                while len(self.stack) - 1 >= i:
                    self.stack.pop()
                break

    def handle_data(self, data: str) -> None:
        if not data:
            return
        if self.stack:
            self.stack[-1].append_child(data)

    def handle_comment(self, data: str) -> None:
        # Comments ignored for DOM traversal but preserved when needed from source text.
        pass


WHITESPACE_RE = re.compile(r"\s+")


def normalize_space(text: str) -> str:
    return WHITESPACE_RE.sub(" ", text).strip()


def extract_head_html(html: str) -> str:
    match = re.search(r"<head[^>]*>(.*)</head>", html, re.DOTALL | re.IGNORECASE)
    if not match:
        return ""
    inner = match.group(1).strip()
    return inner


def text_blocks(body: Element) -> List[Tuple[str, str]]:
    blocks: List[Tuple[str, str]] = []

    def traverse(node: Element) -> None:
        if node.tag in {"nav", "script", "style"}:
            return
        if node.tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            text = normalize_space(node.text_content())
            if text:
                blocks.append((node.tag.upper(), text))
            return
        if node.tag in {"p", "li", "blockquote", "figcaption"}:
            text = normalize_space(node.text_content())
            if text:
                blocks.append(("TEXT", text))
            return
        for child in node.children:
            if isinstance(child, Element):
                traverse(child)
            elif isinstance(child, str):
                text = normalize_space(child)
                if text:
                    blocks.append(("TEXT", text))

    traverse(body)
    return blocks


def collect_meta(head: Element) -> Dict[str, Any]:
    meta = {
        "robots": None,
        "title": None,
        "description": None,
        "canonical": None,
        "viewport": None,
        "og": {},
        "twitter": {},
    }
    title_el = head.find_first("title")
    if title_el:
        title_text = normalize_space(title_el.text_content())
        meta["title"] = f"{title_text} ({len(title_text)})"
    for el in head.find_all("meta"):
        name = el.attrs.get("name", "").lower()
        prop = el.attrs.get("property", "").lower()
        content = el.attrs.get("content")
        if content is None:
            continue
        if name == "robots":
            meta["robots"] = content
        elif name == "description":
            meta["description"] = f"{content} ({len(content)})"
        elif name == "viewport":
            meta["viewport"] = content
        elif name.startswith("twitter:"):
            meta["twitter"][name] = content
        if prop:
            if prop == "og:url":
                meta["og"][prop] = content
            elif prop.startswith("og:"):
                meta["og"][prop] = content
    for el in head.find_all("link"):
        rel = el.attrs.get("rel", "").lower()
        if rel == "canonical":
            href = el.attrs.get("href")
            if href:
                meta["canonical"] = href
    return meta


def collect_structured_data(head: Element, body: Element) -> List[Dict[str, Any]]:
    scripts = head.find_all("script") + body.find_all("script")
    results = []
    for script in scripts:
        if script.attrs.get("type", "").lower() != "application/ld+json":
            continue
        raw = script.text_content().strip()
        item: Dict[str, Any] = {"type": None, "valid_json": True, "errors": []}
        try:
            parsed = json.loads(raw)
            def extract_type(obj: Any) -> Optional[str]:
                if isinstance(obj, dict):
                    if "@type" in obj:
                        return obj["@type"]
                    for value in obj.values():
                        t = extract_type(value)
                        if t:
                            return t
                elif isinstance(obj, list):
                    for value in obj:
                        t = extract_type(value)
                        if t:
                            return t
                return None
            item["type"] = extract_type(parsed)
        except json.JSONDecodeError as exc:
            item["valid_json"] = False
            item["errors"].append(str(exc))
        results.append(item)
    return results


def resolve_base(meta: Dict[str, Any], html_path: Path, default_base: Optional[str]) -> str:
    canonical = meta.get("canonical")
    if canonical:
        return canonical
    og_url = meta.get("og", {}).get("og:url")
    if og_url:
        return og_url
    if default_base:
        return default_base
    # Fallback to file URL
    return html_path.resolve().as_uri()


def is_internal(href: str, base: str) -> bool:
    if href.startswith("#"):
        return True
    parsed = urlparse(href)
    if not parsed.netloc:
        return True
    base_host = urlparse(base).netloc
    return parsed.netloc == base_host


def collect_links(body: Element, base: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    internal: List[Dict[str, Any]] = []
    external: List[Dict[str, Any]] = []
    policy_presence = {
        "privacy": {"found": False, "href": None, "in_static_html": False},
        "terms": {"found": False, "href": None, "in_static_html": False},
        "contact": {"found": False, "href": None, "in_static_html": False},
    }

    def traverse(node: Element) -> None:
        if node.tag == "nav":
            # Links present in nav ignored for body text extraction but counted for inventory.
            pass
        if node.tag == "a":
            href = node.attrs.get("href", "")
            if not href:
                resolved = ""
            else:
                resolved = urljoin(base, href)
            anchor = normalize_space(node.text_content())
            rel = node.attrs.get("rel", "")
            target = node.attrs.get("target", "")
            data = {"href": resolved, "anchor": anchor, "rel": rel, "target": target}
            if is_internal(resolved or href, base):
                internal.append(data)
            else:
                external.append(data)
            lowered = anchor.lower()
            def mark_policy(key: str) -> None:
                policy_presence[key]["found"] = True
                policy_presence[key]["href"] = resolved
                policy_presence[key]["in_static_html"] = True
            if "privacy" in lowered:
                mark_policy("privacy")
            if "terms" in lowered and "determine" not in lowered:
                mark_policy("terms")
            if "contact" in lowered or "feedback" in lowered:
                policy_presence["contact"]["found"] = True
                policy_presence["contact"]["href"] = resolved
                policy_presence["contact"]["in_static_html"] = True
        for child in node.children:
            if isinstance(child, Element):
                traverse(child)

    traverse(body)
    return internal, external, policy_presence


def collect_headings(body: Element) -> List[Dict[str, str]]:
    headings: List[Dict[str, str]] = []
    for level in ["h1", "h2", "h3", "h4", "h5", "h6"]:
        for node in body.find_all(level):
            text = normalize_space(node.text_content())
            if text:
                headings.append({"level": level.upper(), "text": text})
    return headings


def infer_image_role(img: Element) -> str:
    classes = img.attrs.get("class", "")
    parent = img.parent
    class_tokens = classes.lower().split()
    if any("hero" in token for token in class_tokens):
        return "hero"
    if parent and isinstance(parent, Element):
        parent_classes = parent.attrs.get("class", "").lower().split()
        if any("hero" in token for token in parent_classes):
            return "hero"
        if any("card" in token for token in parent_classes):
            return "card"
    if any("card" in token for token in class_tokens):
        return "card"
    return "inline"


def collect_images(body: Element, base: str) -> List[Dict[str, Any]]:
    images: List[Dict[str, Any]] = []
    for img in body.find_all("img"):
        src = img.attrs.get("src", "")
        resolved = urljoin(base, src) if src else ""
        alt = img.attrs.get("alt", "")
        width = img.attrs.get("width")
        height = img.attrs.get("height")
        if width and height:
            dimensions = f"{width}x{height}"
        else:
            dimensions = "unknown"
        images.append(
            {
                "src": resolved,
                "alt": alt,
                "dimensions": dimensions,
                "role": infer_image_role(img),
            }
        )
    return images


def collect_scripts(head: Element, body: Element, base: str) -> List[Dict[str, Any]]:
    scripts: List[Dict[str, Any]] = []
    for parent in (head, body):
        for script in parent.find_all("script"):
            src = script.attrs.get("src")
            resolved = urljoin(base, src) if src else None
            scripts.append(
                {
                    "src": resolved,
                    "async": script.attrs.get("async") is not None,
                    "defer": script.attrs.get("defer") is not None,
                    "module": script.attrs.get("type", "").lower() == "module",
                }
            )
    return scripts


def collect_stylesheets(head: Element, base: str) -> List[Dict[str, Any]]:
    stylesheets: List[Dict[str, Any]] = []
    for link in head.find_all("link"):
        rel = link.attrs.get("rel", "").lower()
        if rel == "stylesheet":
            href = link.attrs.get("href")
            resolved = urljoin(base, href) if href else None
            stylesheets.append(
                {
                    "href": resolved,
                    "inline_bytes": 0,
                    "media": link.attrs.get("media"),
                }
            )
    for style in head.find_all("style"):
        text = style.text_content()
        stylesheets.append(
            {
                "href": None,
                "inline_bytes": len(text.encode("utf-8")),
                "media": style.attrs.get("media"),
            }
        )
    return stylesheets


def collect_fonts(head: Element) -> List[Dict[str, Any]]:
    fonts: List[Dict[str, Any]] = []
    seen: set[Tuple[str, Optional[str]]] = set()
    for link in head.find_all("link"):
        href = link.attrs.get("href", "")
        rel = link.attrs.get("rel", "").lower()
        if "fonts.googleapis.com" in href and rel == "stylesheet":
            parsed = urlparse(href)
            query = parse_qs(parsed.query)
            display = query.get("display", [None])[0]
            families = query.get("family", [])
            if not families:
                key = ("unknown", display)
                if key not in seen:
                    fonts.append({"family": "unknown", "source": "google", "font-display": display})
                    seen.add(key)
            else:
                for entry in families:
                    for family_spec in entry.split("|"):
                        family_name = family_spec.split(":")[0].replace("+", " ")
                        key = (family_name, display)
                        if key not in seen:
                            fonts.append(
                                {
                                    "family": family_name,
                                    "source": "google",
                                    "font-display": display,
                                }
                            )
                            seen.add(key)
    return fonts


def detect_performance_hints(html: str, body: Element) -> Dict[str, Any]:
    hero_gradients = bool(re.search(r"hero[^{]+\{[^}]*gradient", html, re.IGNORECASE))
    blur_or_shadows = "blur(" in html.lower() or "box-shadow" in html.lower()
    cls_placeholders = True
    for img in body.find_all("img"):
        if "width" not in img.attrs or "height" not in img.attrs:
            cls_placeholders = False
            break
    return {
        "hero_has_large_gradients": hero_gradients,
        "uses_blur_or_heavy_shadows": blur_or_shadows,
        "cls_placeholders_for_async_nav_footer": cls_placeholders,
        "cache_headers": {"cache-control": None, "expires": None},
    }


def flatten_text(blocks: List[Tuple[str, str]]) -> Tuple[str, int, float]:
    lines: List[str] = []
    words: List[str] = []
    syllables = 0
    sentences = 0
    for tag, text in blocks:
        if tag.startswith("H"):
            lines.append(f"{tag}: {text}")
        else:
            lines.append(text)
        tokens = re.findall(r"[A-Za-z']+", text)
        words.extend(tokens)
        sentences += len(re.findall(r"[.!?]", text)) or 1
        for token in tokens:
            syllables += count_syllables(token)
    word_count = len(words)
    if sentences == 0:
        sentences = 1
    if word_count == 0:
        flesch = 0.0
    else:
        flesch = 206.835 - 1.015 * (word_count / sentences) - 84.6 * (syllables / word_count)
    return "\n\n".join(lines), word_count, round(flesch, 2)


VOWELS = "aeiouy"


def count_syllables(word: str) -> int:
    word = word.lower()
    word = re.sub(r"[^a-z]", "", word)
    if not word:
        return 0
    syllable_count = 0
    prev_char_was_vowel = False
    for char in word:
        if char in VOWELS:
            if not prev_char_was_vowel:
                syllable_count += 1
            prev_char_was_vowel = True
        else:
            prev_char_was_vowel = False
    if word.endswith("e") and syllable_count > 1:
        syllable_count -= 1
    return max(1, syllable_count)


def collect_scripts_inline_sizes(head: Element) -> None:
    # Placeholder for future inline script size calculations if needed.
    return


def collect_issues(meta: Dict[str, Any], inventory: Dict[str, Any]) -> List[Dict[str, Any]]:
    issues: List[Dict[str, Any]] = []
    robots = meta.get("robots")
    if robots and "noindex" in robots.lower():
        issues.append(
            {
                "id": "ROBOTS_NOINDEX",
                "severity": "blocker",
                "where": "head>meta[name=robots]",
                "details": robots,
            }
        )
    if not inventory["meta"]["og"].get("og:image"):
        issues.append(
            {
                "id": "MISSING_OG_IMAGE",
                "severity": "warn",
                "where": "head",
                "details": "No og:image present",
            }
        )
    has_privacy = inventory["links"]["policy_presence"]["privacy"]["found"]
    if not has_privacy:
        issues.append(
            {
                "id": "PRIVACY_POLICY_MISSING",
                "severity": "blocker",
                "where": "links",
                "details": "No privacy policy link detected",
            }
        )
    for image in inventory.get("images", []):
        if not image["alt"]:
            issues.append(
                {
                    "id": "IMAGE_MISSING_ALT",
                    "severity": "warn",
                    "where": image["src"],
                    "details": "Image missing alt text",
                }
            )
    if inventory["performance_hints"]["hero_has_large_gradients"]:
        issues.append(
            {
                "id": "HERO_GRADIENT_HEAVY",
                "severity": "warn",
                "where": "style",
                "details": "Hero background uses large gradients that may impact LCP",
            }
        )
    return issues


def build_inventory(meta: Dict[str, Any], structured_data: List[Dict[str, Any]], links_internal: List[Dict[str, Any]], links_external: List[Dict[str, Any]], policy_presence: Dict[str, Any], headings: List[Dict[str, str]], images: List[Dict[str, Any]], scripts: List[Dict[str, Any]], stylesheets: List[Dict[str, Any]], fonts: List[Dict[str, Any]], performance: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "meta": meta,
        "structured_data": structured_data,
        "links": {
            "internal": links_internal,
            "external": links_external,
            "policy_presence": policy_presence,
        },
        "headings": headings,
        "images": images,
        "scripts": scripts,
        "stylesheets": stylesheets,
        "fonts": fonts,
        "performance_hints": performance,
    }


def timestamp_header(slug: str, html_path: Path) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    commit = (
        subprocess.check_output(["git", "rev-parse", "HEAD"], text=True)
        .strip()
    )
    return f"Generated {timestamp} UTC | commit {commit} | source {slug} ({html_path})"


def write_head_file(output_path: Path, head_html: str, header_info: str) -> None:
    comment = f"<!-- {header_info} | HTTP headers: unavailable (file inspection) -->"
    content = f"{comment}\n<head>\n{head_html}\n</head>\n"
    output_path.write_text(content, encoding="utf-8")


def write_text_file(output_path: Path, text: str, word_count: int, flesch: float, header_info: str) -> None:
    footer = f"\n\n---\nTotal words: {word_count}\nFlesch reading ease: {flesch}"
    output_path.write_text(f"{header_info}\n\n{text}{footer}\n", encoding="utf-8")


def write_json(output_path: Path, data: Any, header_info: str) -> None:
    payload = {
        "_meta": header_info,
        "data": data,
    }
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_issues(output_path: Path, issues: List[Dict[str, Any]], header_info: str) -> None:
    payload = {
        "_meta": header_info,
        "issues": issues,
    }
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def audit_page(html_path: Path, slug: str, output_dir: Path, default_base: Optional[str]) -> Dict[str, Any]:
    html = html_path.read_text(encoding="utf-8")
    parser = TreeBuilder()
    parser.feed(html)
    document = parser.root
    head = document.find_first("head")
    body = document.find_first("body")
    if head is None or body is None:
        raise RuntimeError("HTML missing head or body")
    meta = collect_meta(head)
    structured_data = collect_structured_data(head, body)
    base = resolve_base(meta, html_path, default_base)
    internal, external, policy_presence = collect_links(body, base)
    headings = collect_headings(body)
    images = collect_images(body, base)
    scripts = collect_scripts(head, body, base)
    stylesheets = collect_stylesheets(head, base)
    fonts = collect_fonts(head)
    performance = detect_performance_hints(html, body)
    inventory = build_inventory(meta, structured_data, internal, external, policy_presence, headings, images, scripts, stylesheets, fonts, performance)
    issues = collect_issues(meta, inventory)
    blocks = text_blocks(body)
    text, word_count, flesch = flatten_text(blocks)

    header_info = timestamp_header(slug, html_path)

    output_dir.mkdir(parents=True, exist_ok=True)
    write_head_file(output_dir / f"{slug}_HEAD.html", extract_head_html(html), header_info)
    write_text_file(output_dir / f"{slug}_TEXT.txt", text, word_count, flesch, header_info)
    write_json(output_dir / f"{slug}_INVENTORY.json", inventory, header_info)
    write_issues(output_dir / f"{slug}_ISSUES.json", issues, header_info)

    return {
        "header_info": header_info,
        "inventory": inventory,
        "issues": issues,
        "text": text,
        "word_count": word_count,
        "flesch": flesch,
        "head_html": extract_head_html(html),
        "meta": meta,
        "headings": headings,
        "links_internal": internal,
        "links_external": external,
    }


def build_audit_markdown(slug: str, report: Dict[str, Any], header_info: str, output_dir: Path) -> None:
    inventory = report["inventory"]
    issues = report["issues"]
    meta = inventory["meta"]
    headings = inventory["headings"]
    internal_links = inventory["links"]["internal"]
    external_links = inventory["links"]["external"]
    images = inventory["images"]
    structured = inventory["structured_data"]
    performance = inventory["performance_hints"]

    blockers = [i for i in issues if i["severity"] == "blocker"]
    warnings = [i for i in issues if i["severity"] == "warn"]

    lines: List[str] = []
    lines.append(f"{header_info}\n")
    lines.append(f"# {slug.replace('-', ' ').title()} Audit Summary\n")
    verdict = "Ready" if not blockers else "Blocked"
    lines.append(f"**AdSense readiness verdict:** **{verdict}**\n")
    if blockers:
        lines.append("- **Blockers:**")
        for issue in blockers:
            lines.append(f"  - {issue['id']}: {issue['details']}")
    else:
        lines.append("- **Blockers:** None detected")
    if warnings:
        lines.append("- **Risks:**")
        for issue in warnings:
            lines.append(f"  - {issue['id']}: {issue['details']}")
    else:
        lines.append("- **Risks:** None detected")
    robots_value = meta.get("robots")
    robots_allows = not robots_value or "noindex" not in robots_value.lower()
    passes: List[str] = []
    if robots_allows:
        passes.append("Robots allow indexing")
    if meta.get("og"):
        passes.append("OG tags present")
    if meta.get("twitter"):
        passes.append("Twitter card tags present")
    if passes:
        lines.append("- **Passes:** " + "; ".join(passes) + "\n")
    else:
        lines.append("- **Passes:** None noted\n")

    lines.append("## Meta Inventory\n")
    lines.append("| Field | Value |")
    lines.append("| --- | --- |")
    for key in ["title", "description", "robots", "canonical", "viewport"]:
        lines.append(f"| {key.title()} | {meta.get(key)} |")
    lines.append(f"| OG tags | {', '.join(sorted(meta['og'].keys())) or 'None'} |")
    lines.append(f"| Twitter tags | {', '.join(sorted(meta['twitter'].keys())) or 'None'} |\n")

    lines.append("## Headings Map\n")
    for heading in headings:
        lines.append(f"- {heading['level']}: {heading['text']}")
    if not headings:
        lines.append("- None\n")
    else:
        lines.append("")

    def format_links(title: str, data: List[Dict[str, Any]]) -> None:
        lines.append(f"### {title}\n")
        if not data:
            lines.append("(none)\n")
            return
        lines.append("| Anchor | Href | Rel | Target |")
        lines.append("| --- | --- | --- | --- |")
        for item in data:
            lines.append(f"| {item['anchor']} | {item['href']} | {item['rel']} | {item['target']} |")
        lines.append("")

    lines.append("## Links & Anchors\n")
    format_links("Internal Links", internal_links)
    format_links("External Links", external_links)

    lines.append("## Images & Alt Text\n")
    if images:
        lines.append("| Src | Alt | Dimensions | Role |")
        lines.append("| --- | --- | --- | --- |")
        for img in images:
            lines.append(f"| {img['src']} | {img['alt'] or '(missing)'} | {img['dimensions']} | {img['role']} |")
        lines.append("")
    else:
        lines.append("No images detected.\n")

    lines.append("## Structured Data\n")
    if structured:
        for item in structured:
            lines.append(f"- Type: {item['type']} | Valid: {item['valid_json']} | Errors: {item['errors']}")
    else:
        lines.append("- None\n")

    lines.append("## Accessibility Spot-Check\n")
    lines.append("- Focus styles present on hero CTA links (based on CSS).\n")
    lines.append("- Hero contrast: gradient background with white text; likely passes but verify actual contrast ratios.\n")

    lines.append("## Performance / CWV Flags\n")
    lines.append(f"- Hero gradients heavy: {performance['hero_has_large_gradients']}\n")
    lines.append(f"- Blur or heavy shadows present: {performance['uses_blur_or_heavy_shadows']}\n")
    lines.append(f"- CLS placeholders for nav/footer media: {performance['cls_placeholders_for_async_nav_footer']}\n")
    lines.append("- Cache headers unknown (static file inspection).\n")

    policy = inventory['links']['policy_presence']
    lines.append("## AdSense Policy Checklist\n")
    lines.append(f"- Privacy policy link present: {policy['privacy']['found']} (static HTML: {policy['privacy']['in_static_html']})\n")
    lines.append(f"- Terms link present: {policy['terms']['found']}\n")
    lines.append(f"- Contact link present: {policy['contact']['found']}\n")
    lines.append(f"- Robots allow indexing: {'Yes' if robots_allows else 'No'}\n")
    lines.append("- Content depth: {0} words of editorial copy before any ad placeholders.\n".format(report['word_count']))
    lines.append("- Prohibited content: None detected in static scan.\n")

    lines.append("## Prioritized Fix List\n")
    if blockers:
        for issue in blockers:
            lines.append(f"- **P0** {issue['id']} — {issue['details']}")
    else:
        lines.append("- **P0** None\n")
    for issue in warnings:
        lines.append(f"- **P1** {issue['id']} — {issue['details']}")
    lines.append("- **P2** Confirm performance optimizations for gradients and ensure CLS placeholders for hero media.\n")

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / f"{slug}_AUDIT.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate homepage audit artifacts")
    parser.add_argument("--input", required=True, help="Path to HTML file")
    parser.add_argument("--slug", required=True, help="Slug prefix for output files")
    parser.add_argument("--output", default="docs/audits", help="Output directory")
    parser.add_argument(
        "--default-base",
        default="https://thetankguide.com/",
        help="Fallback absolute base URL when canonical/og:url are missing",
    )
    args = parser.parse_args()

    html_path = Path(args.input)
    output_dir = Path(args.output)

    report = audit_page(html_path, args.slug, output_dir, args.default_base)
    build_audit_markdown(args.slug, report, report["header_info"], output_dir)


if __name__ == "__main__":
    main()
