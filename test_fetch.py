import urllib.request
import urllib.parse
import json
import xml.etree.ElementTree as ET

def fetch_url(url, custom_headers=None):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    if custom_headers:
        headers.update(custom_headers)
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.read()
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

# Test Hacker News Algolia
print("--- Testing Hacker News Algolia ---")
query = urllib.parse.quote('"Ask HN: Who is hiring?"')
search_thread_url = f'https://hn.algolia.com/api/v1/search?query={query}&tags=story&hitsPerPage=1'
print(f"URL: {search_thread_url}")
hn_data = fetch_url(search_thread_url)
if hn_data:
    try:
        obj = json.loads(hn_data.decode('utf-8'))
        if obj.get('hits'):
            hit = obj['hits'][0]
            print(f"Success! Thread: {hit['title']} (ID: {hit['objectID']})")
            
            # Now let's try reading comments
            story_id = hit['objectID']
            comments_url = f"https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_{story_id}&hitsPerPage=5"
            comments_data = fetch_url(comments_url)
            if comments_data:
                c_obj = json.loads(comments_data.decode('utf-8'))
                print(f"Fetched {len(c_obj.get('hits', []))} comments successfully!")
                for c in c_obj.get('hits', [])[:2]:
                    print(f"Comment by {c['author']}: {c['comment_text'][:100]}...")
        else:
            print("No hits found.")
    except Exception as e:
        print(f"Error parsing HN JSON: {e}")
else:
    print("Failed to fetch HN data.")

# Test Reddit RSS
print("\n--- Testing Reddit RSS ---")
reddit_url = "https://www.reddit.com/r/forhire/.rss"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
}
xml_data = fetch_url(reddit_url, custom_headers=headers)
if xml_data:
    print(f"Success fetching Reddit RSS! Length: {len(xml_data)} bytes")
    try:
        root = ET.fromstring(xml_data)
        # Find entry elements (Reddit RSS uses Atom format, so <entry>)
        entries = root.findall('{http://www.w3.org/2005/Atom}entry')
        print(f"Found {len(entries)} entry tags using Atom namespace.")
        for entry in entries[:3]:
            title = entry.find('{http://www.w3.org/2005/Atom}title')
            link = entry.find('{http://www.w3.org/2005/Atom}link')
            author = entry.find('{http://www.w3.org/2005/Atom}author/{http://www.w3.org/2005/Atom}name')
            print(f"Entry: {title.text if title is not None else 'None'}")
            print(f"Author: {author.text if author is not None else 'None'}")
            print(f"Link: {link.attrib.get('href') if link is not None else 'None'}")
    except Exception as e:
        print(f"Error parsing Reddit RSS XML: {e}")
else:
    print("Failed to fetch Reddit RSS.")
