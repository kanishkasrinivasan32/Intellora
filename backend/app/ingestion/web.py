import ipaddress
import socket
from urllib.parse import urlparse, parse_qs, urljoin
from urllib.robotparser import RobotFileParser
import httpx

def validate_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Use a public http or https URL.')
    try: addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == 'https' else 80))
    except socket.gaierror: raise ValueError('Could not resolve this website.')
    if any(not ipaddress.ip_address(x[4][0]).is_global for x in addresses):
        raise ValueError('Local and private network URLs cannot be ingested.')
    return parsed

def fetch_public(url):
    for _ in range(5):
        validate_url(url)
        with httpx.stream('GET', url, timeout=30, headers={'User-Agent': 'IntelloraLearningBot/1.0'}, follow_redirects=False) as response:
            if response.is_redirect:
                url = urljoin(url, response.headers['location']); continue
            response.raise_for_status()
            data = bytearray()
            for block in response.iter_bytes():
                data.extend(block)
                if len(data) > 5_000_000: raise ValueError('Website exceeds the 5 MB reading limit.')
            return bytes(data).decode('utf-8', errors='replace')
    raise ValueError('Too many website redirects.')

def read_website(url):
    parsed = validate_url(url)
    robots_url = f'{parsed.scheme}://{parsed.netloc}/robots.txt'
    robot = RobotFileParser()
    try: robot.parse(fetch_public(robots_url).splitlines())
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 404: raise ValueError('Cannot verify this site’s robots policy.')
        robot.parse([])
    if not robot.can_fetch('IntelloraLearningBot', url): raise ValueError('This site does not allow automated reading.')
    import trafilatura
    html = fetch_public(url)
    result = trafilatura.extract(html, include_tables=True, include_comments=False, output_format='json')
    if not result: raise ValueError('No readable public article found at this URL.')
    import json
    doc = json.loads(result)
    return doc.get('text', ''), {'title': doc.get('title') or parsed.hostname, 'url': url}

def read_youtube(url):
    parsed = urlparse(url)
    if parsed.hostname in ('youtu.be', 'www.youtu.be'): video_id = parsed.path.strip('/')
    elif parsed.hostname in ('youtube.com', 'www.youtube.com', 'm.youtube.com'):
        video_id = parse_qs(parsed.query).get('v', [''])[0] or parsed.path.split('/')[-1]
    else: raise ValueError('Please use a YouTube video URL.')
    import re
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id): raise ValueError('Invalid YouTube video ID.')
    from youtube_transcript_api import YouTubeTranscriptApi
    try:
        transcript = YouTubeTranscriptApi().fetch(video_id, languages=['en', 'hi', 'ta'])
        content = '\n\n'.join(f'[{int(x.start)//60:02d}:{int(x.start)%60:02d}] {x.text}' for x in transcript)
    except Exception: raise ValueError('A public transcript is not available for this video, or YouTube blocked access. Upload a transcript instead.') from None
    title = f'YouTube · {video_id}'
    try:
        import yt_dlp
        with yt_dlp.YoutubeDL({'quiet': True, 'skip_download': True, 'no_warnings': True, 'socket_timeout': 15}) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            title = info.get('title', title)
    except Exception: pass
    return content, {'title': title, 'video_id': video_id, 'url': url}
