import re
import unicodedata
import urllib.parse
import requests

WIKIPEDIA_USER_AGENT = 'TopicTyper/2.0 (https://github.com/naga-research-lab/topic-typer; contact@nagaresearch.org) PythonRequests/2.32'


def sanitize_text(raw_text: str) -> str:
    """
    Cleans raw Wikipedia extract text:
    - Strips HTML tags
    - Strips citations like [1], [edit], [citation needed]
    - Normalizes unicode quotes, dashes, ellipsis, spaces
    - Normalizes diacritics to standard ASCII
    - Cleans up orphaned spaces before punctuation
    - Retains printable ASCII characters (0x20 to 0x7E)
    """
    if not raw_text or not isinstance(raw_text, str):
        return ''

    text = raw_text

    # Remove HTML tags if present
    text = re.sub(r'<[^>]*>', '', text)

    # Remove bracketed citations and editor tags e.g. [1], [12], [edit], [citation needed], [note 1]
    text = re.sub(r'\[\s*(?:\d+|edit|citation needed|note\s*\d+|[a-zA-Z\s]+)\s*\]', '', text, flags=re.IGNORECASE)

    # Normalize unicode single quotes & apostrophes to ASCII '
    text = re.sub(r'[\u2018\u2019\u201A\u201B\u02BC\u02B9\u0060\u00B4]', "'", text)

    # Normalize unicode double quotes to ASCII "
    text = re.sub(r'[\u201C\u201D\u201E\u201F\u00AB\u00BB]', '"', text)

    # Normalize dashes (en-dash, em-dash, minus, horizontal bar) to standard hyphen -
    text = re.sub(r'[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]', '-', text)

    # Normalize ellipsis … to ...
    text = text.replace('\u2026', '...')

    # Normalize unusual spaces to standard space
    text = re.sub(r'[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]', ' ', text)

    # Normalize diacritics (e.g. Schrödinger -> Schrodinger, résumé -> resume)
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(c for c in text if not unicodedata.combining(c))

    # Replace mathematical multiply/divide
    text = text.replace('×', 'x').replace('÷', '/')

    # Retain standard printable ASCII (0x20 space to 0x7E ~)
    text = re.sub(r'[^\x20-\x7E]', '', text)

    # Clean empty parentheses or brackets left behind by stripped citations
    text = re.sub(r'\(\s*\)', '', text)
    text = re.sub(r'\[\s*\]', '', text)

    # Fix spaces immediately preceding punctuation
    text = re.sub(r'\s+([.,;:!?])', r'\1', text)

    # Collapse multiple whitespace into a single space
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


def fetch_wikipedia_summary(query: str) -> dict:
    """
    Fetches a Wikipedia article summary for a query title.
    Falls back to Wikipedia OpenSearch if direct REST lookup yields 404.
    """
    clean_query = query.strip()
    headers = {'User-Agent': WIKIPEDIA_USER_AGENT, 'Accept': 'application/json'}
    encoded_title = urllib.parse.quote(clean_query.replace(' ', '_'))

    url = f'https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_title}'
    try:
        resp = requests.get(url, headers=headers, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('type') != 'disambiguation' and data.get('extract'):
                extract = sanitize_text(data.get('extract', ''))
                source_url = data.get('content_urls', {}).get('desktop', {}).get('page') or f"https://en.wikipedia.org/wiki/{encoded_title}"
                return {
                    'title': data.get('title', clean_query),
                    'description': data.get('description', ''),
                    'extract': extract,
                    'source_url': source_url,
                }
    except Exception:
        pass

    # Search Fallback
    try:
        search_url = f'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(clean_query)}&utf8=&format=json&srlimit=1'
        s_resp = requests.get(search_url, headers=headers, timeout=6)
        if s_resp.status_code == 200:
            s_data = s_resp.json()
            results = s_data.get('query', {}).get('search', [])
            if results:
                best_title = results[0]['title']
                return fetch_wikipedia_summary(best_title)
    except Exception:
        pass

    return {
        'title': clean_query,
        'description': 'Wikipedia article',
        'extract': sanitize_text(f"{clean_query} is a subject explored in science, technology, and human history."),
        'source_url': f"https://en.wikipedia.org/wiki/{encoded_title}",
    }


def fetch_random_wikipedia_summary() -> dict:
    """
    Fetches a random Wikipedia summary from the official REST API.
    """
    headers = {'User-Agent': WIKIPEDIA_USER_AGENT, 'Accept': 'application/json'}
    url = 'https://en.wikipedia.org/api/rest_v1/page/random/summary'
    try:
        resp = requests.get(url, headers=headers, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('extract'):
                extract = sanitize_text(data.get('extract', ''))
                source_url = data.get('content_urls', {}).get('desktop', {}).get('page') or f"https://en.wikipedia.org/wiki/{urllib.parse.quote(data.get('title', ''))}"
                return {
                    'title': data.get('title', 'Random Topic'),
                    'description': data.get('description', ''),
                    'extract': extract,
                    'source_url': source_url,
                }
    except Exception:
        pass

    # Fallback to curated random topics
    fallback_topics = ['Quantum Mechanics', 'James Webb Space Telescope', 'Solar System', 'Ancient Egypt', 'Artificial Intelligence']
    import random
    choice = random.choice(fallback_topics)
    return fetch_wikipedia_summary(choice)
