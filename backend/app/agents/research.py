import httpx
from app.ingestion.web import validate_url

def find_sources(topic, limit=3):
    """Use Wikipedia's public search API; downstream readers still enforce robots.txt."""
    try:
        response = httpx.get('https://en.wikipedia.org/w/api.php', params={
            'action':'query', 'generator':'search', 'gsrsearch':topic, 'gsrnamespace':0,
            'gsrlimit':limit, 'prop':'info', 'inprop':'url', 'format':'json',
        }, headers={'User-Agent':'Intellora/1.0 (local learning companion)'}, timeout=25)
        response.raise_for_status()
        pages = sorted(response.json().get('query', {}).get('pages', {}).values(), key=lambda p:p.get('index',0))
        results = []
        for page in pages:
            url = page.get('fullurl')
            if url:
                validate_url(url)
                results.append({'title':page['title'], 'url':url})
        if not results: raise ValueError('No public sources found. Try a more specific topic or add a URL directly.')
        return results
    except (httpx.HTTPError, KeyError):
        raise ValueError('The public research service is unavailable. Add a website URL directly or try again later.') from None
