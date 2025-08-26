import re

def slugify(value: str, max_length: int = 80) -> str:
    s = value.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    s = s.strip("-")
    if max_length:
        s = s[:max_length].rstrip("-")
    return s or "item"
