import re

def chunk_text(text: str, max_words=350, overlap=45):
    """Keep paragraphs/headings intact where possible, splitting long blocks with overlap."""
    blocks = re.split(r'\n\s*\n|(?=^#{1,6} )', text.strip(), flags=re.M)
    chunks, current = [], []
    for block in blocks:
        words = block.split()
        if not words: continue
        if len(current) + len(words) > max_words and current:
            chunks.append(' '.join(current))
            current = current[-overlap:]
        while len(words) + len(current) > max_words:
            take = max_words - len(current)
            current.extend(words[:take]); words = words[take:]
            chunks.append(' '.join(current)); current = current[-overlap:]
        current.extend(words)
    if current and (not chunks or ' '.join(current) != chunks[-1]): chunks.append(' '.join(current))
    return chunks
