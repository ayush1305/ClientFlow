import os
import json
import csv
import urllib.request
import urllib.parse
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import html
import re
import time

# Try to import optional packages for better compatibility
try:
    import feedparser
except ImportError:
    feedparser = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

# Fallback basic XML parser for RSS if feedparser is not available
def parse_rss_fallback(xml_content):
    entries = []
    try:
        root = ET.fromstring(xml_content)
        for item in root.findall('.//item'):
            title_node = item.find('title')
            link_node = item.find('link')
            pub_date_node = item.find('pubDate')
            desc_node = item.find('description')
            
            title = title_node.text if title_node is not None else ""
            link = link_node.text if link_node is not None else ""
            pub_date_str = pub_date_node.text if pub_date_node is not None else ""
            description = desc_node.text if desc_node is not None else ""
            
            # Simple RFC 822/1123 parser fallback
            parsed_date = None
            if pub_date_str:
                clean_date = pub_date_str
                if ',' in clean_date:
                    clean_date = clean_date.split(',', 1)[1].strip()
                # Remove timezone names like GMT/UTC
                clean_date = re.sub(r'\s+[A-Z]{3,4}$', '', clean_date)
                # Remove offsets like +0000 or +00:00
                clean_date = re.sub(r'\s+[+-]\d{4}$', '', clean_date)
                clean_date = re.sub(r'\s+[+-]\d{2}:\d{2}$', '', clean_date)
                
                formats = [
                    "%d %b %Y %H:%M:%S",
                    "%d %b %Y %H:%M",
                    "%Y-%m-%d %H:%M:%S",
                    "%Y-%m-%d"
                ]
                for fmt in formats:
                    try:
                        parsed_date = datetime.strptime(clean_date, fmt)
                        break
                    except ValueError:
                        continue
            
            if not parsed_date:
                parsed_date = datetime.utcnow()
                
            entries.append({
                'title': title,
                'link': link,
                'published_datetime': parsed_date,
                'description': description
            })
    except Exception as e:
        print(f"Fallback RSS parsing error: {e}")
    return entries

def strip_html(html_content):
    if not html_content:
        return ""
    if BeautifulSoup:
        try:
            return BeautifulSoup(html_content, "html.parser").get_text()
        except Exception:
            pass
    # Regex fallback
    clean = re.compile('<.*?>')
    text = re.sub(clean, '', html_content)
    return html.unescape(text).strip()

def matches_keywords(text, keywords):
    if not keywords:
        return True
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in keywords)

# Make requests with custom user agents to avoid bot blocks
def fetch_url(url, json_response=False, custom_headers=None):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    if custom_headers:
        headers.update(custom_headers)
        
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            data = response.read()
            if json_response:
                return json.loads(data.decode('utf-8'))
            return data
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return None

# Parse standard ISO format datetime strings
def parse_iso_datetime(date_str):
    if not date_str:
        return datetime.utcnow()
    # Normalize ending 'Z' to UTC offset representation
    normalized = date_str.replace('Z', '+00:00')
    # Split fractional seconds if not supported by standard fromisoformat
    if '.' in normalized:
        parts = normalized.split('.')
        date_part = parts[0]
        tz_part = ""
        offset_match = re.search(r'([+-]\d{2}:\d{2})$', parts[1])
        if offset_match:
            tz_part = offset_match.group(1)
        normalized = date_part + tz_part
    
    try:
        return datetime.fromisoformat(normalized).replace(tzinfo=None)
    except ValueError:
        try:
            cleaned = re.sub(r'[TZ]', ' ', date_str).strip()
            if '.' in cleaned:
                cleaned = cleaned.split('.')[0]
            return datetime.strptime(cleaned, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return datetime.utcnow()

# Scraper functions for each source
def scrape_we_work_remotely(keywords):
    jobs = []
    print("Scraping We Work Remotely...")
    url = "https://weworkremotely.com/remote-jobs.rss"
    xml_data = fetch_url(url)
    if not xml_data:
        return jobs
        
    if feedparser:
        feed = feedparser.parse(xml_data)
        for entry in feed.entries:
            title_text = entry.title
            company = "We Work Remotely"
            title = title_text
            if ":" in title_text:
                parts = title_text.split(":", 1)
                company = parts[0].strip()
                title = parts[1].strip()
                
            desc = entry.summary if hasattr(entry, 'summary') else ""
            desc_text = strip_html(desc)
            
            if matches_keywords(title + " " + desc_text, keywords):
                pub_date = datetime.utcnow()
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    import calendar
                    pub_date = datetime.utcfromtimestamp(calendar.timegm(entry.published_parsed))
                
                jobs.append({
                    'id': entry.link,
                    'title': title,
                    'company_poster': company,
                    'source': 'We Work Remotely',
                    'job_link': entry.link,
                    'user_link': entry.link,
                    'date_posted': pub_date
                })
    else:
        entries = parse_rss_fallback(xml_data)
        for entry in entries:
            title_text = entry['title']
            company = "We Work Remotely"
            title = title_text
            if ":" in title_text:
                parts = title_text.split(":", 1)
                company = parts[0].strip()
                title = parts[1].strip()
                
            desc_text = strip_html(entry['description'])
            if matches_keywords(title + " " + desc_text, keywords):
                jobs.append({
                    'id': entry['link'],
                    'title': title,
                    'company_poster': company,
                    'source': 'We Work Remotely',
                    'job_link': entry['link'],
                    'user_link': entry['link'],
                    'date_posted': entry['published_datetime']
                })
    print(f"-> Found {len(jobs)} matching jobs from We Work Remotely.")
    return jobs

def scrape_remotive(keywords):
    jobs = []
    print("Scraping Remotive...")
    url = "https://remotive.com/api/remote-jobs?limit=150"
    data = fetch_url(url, json_response=True)
    if not data or 'jobs' not in data:
        return jobs
        
    for item in data['jobs']:
        title = item.get('title', '')
        company = item.get('company_name', '')
        desc_text = strip_html(item.get('description', ''))
        
        if matches_keywords(title + " " + desc_text, keywords):
            pub_date_str = item.get('published_at', '')
            pub_date = parse_iso_datetime(pub_date_str)
            
            jobs.append({
                'id': item.get('url', ''),
                'title': title,
                'company_poster': company,
                'source': 'Remotive',
                'job_link': item.get('url', ''),
                'user_link': f"https://remotive.com/companies/{urllib.parse.quote(company.lower())}" if company else item.get('url', ''),
                'date_posted': pub_date
            })
    print(f"-> Found {len(jobs)} matching jobs from Remotive.")
    return jobs

def scrape_reddit_rss(subreddit, keywords):
    jobs = []
    print(f"Scraping Reddit r/{subreddit} via RSS...")
    url = f"https://www.reddit.com/r/{subreddit}/.rss"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    }
    xml_data = fetch_url(url, custom_headers=headers)
    if not xml_data:
        return jobs
        
    try:
        if feedparser:
            feed = feedparser.parse(xml_data)
            for entry in feed.entries:
                title = entry.title
                link = entry.link
                author = entry.author if hasattr(entry, 'author') else 'Reddit User'
                desc = entry.content[0].value if hasattr(entry, 'content') and entry.content else ""
                desc_text = strip_html(desc)
                
                if matches_keywords(title + " " + desc_text, keywords):
                    pub_date = datetime.utcnow()
                    if hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                        import calendar
                        pub_date = datetime.utcfromtimestamp(calendar.timegm(entry.updated_parsed))
                    elif hasattr(entry, 'published_parsed') and entry.published_parsed:
                        import calendar
                        pub_date = datetime.utcfromtimestamp(calendar.timegm(entry.published_parsed))
                        
                    jobs.append({
                        'id': link,
                        'title': title,
                        'company_poster': author,
                        'source': f"Reddit r/{subreddit}",
                        'job_link': link,
                        'user_link': f"https://www.reddit.com/user/{author.replace('/u/', '')}" if author else link,
                        'date_posted': pub_date
                    })
        else:
            root = ET.fromstring(xml_data)
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            entries = root.findall('atom:entry', ns)
            for entry in entries:
                title_node = entry.find('atom:title', ns)
                link_node = entry.find('atom:link', ns)
                updated_node = entry.find('atom:updated', ns)
                content_node = entry.find('atom:content', ns)
                author_node = entry.find('atom:author/atom:name', ns)
                
                title = title_node.text if title_node is not None else ""
                link = link_node.attrib.get('href', '') if link_node is not None else ""
                author = author_node.text if author_node is not None else "Reddit User"
                content_html = content_node.text if content_node is not None else ""
                
                desc_text = strip_html(content_html)
                if matches_keywords(title + " " + desc_text, keywords):
                    pub_date_str = updated_node.text if updated_node is not None else ""
                    pub_date = parse_iso_datetime(pub_date_str)
                    
                    jobs.append({
                        'id': link,
                        'title': title,
                        'company_poster': author,
                        'source': f"Reddit r/{subreddit}",
                        'job_link': link,
                        'user_link': f"https://www.reddit.com/user/{author.replace('/u/', '')}" if author else link,
                        'date_posted': pub_date
                    })
    except Exception as e:
        print(f"Error parsing Reddit r/{subreddit} RSS: {e}")
        
    print(f"-> Found {len(jobs)} matching jobs from r/{subreddit}.")
    return jobs

def scrape_hacker_news(keywords):
    jobs = []
    print("Scraping Hacker News 'Who is Hiring'...")
    # URL encode search query
    query = urllib.parse.quote('"Ask HN: Who is hiring?"')
    search_thread_url = f'https://hn.algolia.com/api/v1/search?query={query}&tags=story&hitsPerPage=1'
    thread_data = fetch_url(search_thread_url, json_response=True)
    if not thread_data or 'hits' not in thread_data or not thread_data['hits']:
        print("Failed to find latest HN 'Who is hiring' thread.")
        return jobs
        
    latest_thread = thread_data['hits'][0]
    story_id = latest_thread['objectID']
    story_title = latest_thread['title']
    print(f"Found latest HN thread: \"{story_title}\" (ID: {story_id})")
    
    # Fetch comments within that story
    comments_url = f"https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_{story_id}&hitsPerPage=100"
    comments_data = fetch_url(comments_url, json_response=True)
    if not comments_data or 'hits' not in comments_data:
        return jobs
        
    for hit in comments_data['hits']:
        comment_text = hit.get('comment_text', '')
        author = hit.get('author', '')
        comment_id = hit.get('objectID', '')
        
        clean_text = strip_html(comment_text)
        if not clean_text:
            continue
            
        first_line = clean_text.split('\n')[0].strip()
        if len(first_line) > 120:
            first_line = first_line[:117] + "..."
            
        if matches_keywords(clean_text, keywords):
            created_at_str = hit.get('created_at', '')
            pub_date = parse_iso_datetime(created_at_str)
            
            job_link = f"https://news.ycombinator.com/item?id={comment_id}"
            user_link = f"https://news.ycombinator.com/user?id={author}"
            
            jobs.append({
                'id': job_link,
                'title': first_line,
                'company_poster': author,
                'source': 'Hacker News',
                'job_link': job_link,
                'user_link': user_link,
                'date_posted': pub_date
            })
            
    print(f"-> Found {len(jobs)} matching jobs from Hacker News.")
    return jobs

def scrape_python_org(keywords):
    jobs = []
    print("Scraping Python.org Job Board...")
    url = "https://www.python.org/jobs/feed/rss/"
    xml_data = fetch_url(url)
    if not xml_data:
        return jobs
        
    if feedparser:
        feed = feedparser.parse(xml_data)
        for entry in feed.entries:
            title = entry.title
            desc = entry.summary if hasattr(entry, 'summary') else ""
            desc_text = strip_html(desc)
            
            company = "Python Job Poster"
            if matches_keywords(title + " " + desc_text, keywords):
                pub_date = datetime.utcnow()
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    import calendar
                    pub_date = datetime.utcfromtimestamp(calendar.timegm(entry.published_parsed))
                    
                jobs.append({
                    'id': entry.link,
                    'title': title,
                    'company_poster': company,
                    'source': 'Python.org',
                    'job_link': entry.link,
                    'user_link': entry.link,
                    'date_posted': pub_date
                })
    else:
        entries = parse_rss_fallback(xml_data)
        for entry in entries:
            title = entry['title']
            desc_text = strip_html(entry['description'])
            if matches_keywords(title + " " + desc_text, keywords):
                jobs.append({
                    'id': entry['link'],
                    'title': title,
                    'company_poster': "Python Job Poster",
                    'source': 'Python.org',
                    'job_link': entry['link'],
                    'user_link': entry['link'],
                    'date_posted': entry['published_datetime']
                })
    print(f"-> Found {len(jobs)} matching jobs from Python.org.")
    return jobs

def scrape_freelancer(keywords):
    jobs = []
    print("Scraping Freelancer.com active projects...")
    url = "https://www.freelancer.com/api/projects/0.1/projects/active?limit=80"
    data = fetch_url(url, json_response=True)
    if not data or data.get('status') != 'success' or 'result' not in data:
        return jobs
        
    projects = data['result'].get('projects', [])
    for p in projects:
        title = p.get('title', '')
        desc_text = strip_html(p.get('description', ''))
        
        if matches_keywords(title + " " + desc_text, keywords):
            submit_timestamp = p.get('submitdate')
            try:
                pub_date = datetime.fromtimestamp(submit_timestamp) if submit_timestamp else datetime.utcnow()
            except Exception:
                pub_date = datetime.utcnow()
                
            seo_url = p.get('seo_url', '')
            owner_id = p.get('owner_id', '')
            
            job_link = f"https://www.freelancer.com/projects/{seo_url}" if seo_url else "https://www.freelancer.com"
            user_link = f"https://www.freelancer.com/u/{owner_id}" if owner_id else job_link
            
            jobs.append({
                'id': job_link,
                'title': title,
                'company_poster': f"Client {owner_id}" if owner_id else "Freelancer Client",
                'source': 'Freelancer.com',
                'job_link': job_link,
                'user_link': user_link,
                'date_posted': pub_date
            })
    print(f"-> Found {len(jobs)} matching jobs from Freelancer.com.")
    return jobs

# Main execution loop
def main():
    # Load config
    config_file = 'config.json'
    if os.path.exists(config_file):
        with open(config_file, 'r') as f:
            config = json.load(f)
    else:
        config = {
            "output_csv": "job_leads.csv",
            "retention_months": 4,
            "keywords": [],
            "sources": {
                "we_work_remotely": True,
                "remotive": True,
                "reddit": True,
                "hacker_news": True,
                "python_org": True
            }
        }
        
    output_csv = config.get("output_csv", "job_leads.csv")
    retention_months = config.get("retention_months", 4)
    keywords = config.get("keywords", [])
    enabled_sources = config.get("sources", {})
    
    # 4 months calculation
    retention_days = retention_months * 30
    current_time = datetime.utcnow()
    
    print("=" * 60)
    print(f"Starting Job Scraper - Time: {current_time.isoformat()} UTC")
    print(f"Keywords: {keywords if keywords else 'None (Fetching all)'}")
    print(f"Retention Window: {retention_months} months ({retention_days} days)")
    print("=" * 60)
    
    # 1. Load existing CSV records to merge and update them
    existing_jobs = {}
    if os.path.exists(output_csv):
        print(f"Loading existing jobs from '{output_csv}'...")
        try:
            with open(output_csv, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    job_id = row.get('Job ID')
                    date_str = row.get('Date Posted (UTC)')
                    source = row.get('Source', '')
                    if job_id and date_str:
                        # Migrate old plain URL IDs to "Source - URL" format
                        if source and not job_id.startswith(f"{source} - "):
                            job_id = f"{source} - {job_id}"
                            
                        pub_date = parse_iso_datetime(date_str)
                        age_days = (current_time - pub_date).days
                        
                        if age_days <= retention_days:
                            row_data = {
                                'id': job_id,
                                'title': row.get('Title', ''),
                                'company_poster': row.get('Company / Poster', ''),
                                'source': source,
                                'job_link': row.get('Job Link', ''),
                                'user_link': row.get('User Link', ''),
                                'date_posted': pub_date,
                                'access_cost': row.get('Access Cost', ''),
                                'applied': row.get('Applied', ''),
                                'rejection': row.get('Rejection', '')
                            }
                            existing_jobs[job_id] = row_data
            print(f"Loaded {len(existing_jobs)} jobs within the 4-month retention window.")
        except Exception as e:
            print(f"Error loading CSV file: {e}. Starting fresh.")
            existing_jobs = {}
            
    # 2. Gather new jobs from all active sources
    new_jobs = []
    
    if enabled_sources.get("we_work_remotely", True):
        try:
            new_jobs.extend(scrape_we_work_remotely(keywords))
        except Exception as e:
            print(f"Error scraping We Work Remotely: {e}")
            
    if enabled_sources.get("remotive", True):
        try:
            new_jobs.extend(scrape_remotive(keywords))
        except Exception as e:
            print(f"Error scraping Remotive: {e}")
            
    if enabled_sources.get("reddit", True):
        try:
            subreddits = [
                "forhire", "jobbit", "devjobs", "DesignJobs", "webdeveloperjobs", 
                "remotework", "hiring", "entrepreneur", "smallbusiness", "webdev", 
                "startups", "freelance", "freelance_jobs", "sideproject", "gamedevjobs", 
                "softwareengineering", "jobs", "workfromhome", "consulting", 
                "marketingjobs", "salesjobs", "datascience"
            ]
            for sub in subreddits:
                new_jobs.extend(scrape_reddit_rss(sub, keywords))
                time.sleep(3.5)  # Rest to avoid Reddit's 429 Too Many Requests rate limits
        except Exception as e:
            print(f"Error scraping Reddit: {e}")
            
    if enabled_sources.get("hacker_news", True):
        try:
            new_jobs.extend(scrape_hacker_news(keywords))
        except Exception as e:
            print(f"Error scraping Hacker News: {e}")
            
    if enabled_sources.get("python_org", True):
        try:
            new_jobs.extend(scrape_python_org(keywords))
        except Exception as e:
            print(f"Error scraping Python.org: {e}")
            

    if enabled_sources.get("freelancer", True):
        try:
            new_jobs.extend(scrape_freelancer(keywords))
        except Exception as e:
            print(f"Error scraping Freelancer.com: {e}")
            
    # 3. Merge new jobs into database
    added_count = 0
    updated_count = 0
    
    for job in new_jobs:
        # Prepend source name to the job ID to differentiate platform jobs
        job_id = f"{job['source']} - {job['id']}"
        job['id'] = job_id
        
        pub_date = job['date_posted']
        age_days = (current_time - pub_date).days
        
        if age_days > retention_days:
            continue
            
        if job_id not in existing_jobs:
            # Set default empty values for custom columns
            job['applied'] = ''
            job['rejection'] = ''
            job['access_cost'] = ''
            existing_jobs[job_id] = job
            added_count += 1
        else:
            orig_date = existing_jobs[job_id]['date_posted']
            # Preserve existing user-input columns
            orig_applied = existing_jobs[job_id].get('applied', '')
            orig_rejection = existing_jobs[job_id].get('rejection', '')
            orig_access_cost = existing_jobs[job_id].get('access_cost', '')
            
            existing_jobs[job_id].update(job)
            
            existing_jobs[job_id]['date_posted'] = orig_date
            existing_jobs[job_id]['applied'] = orig_applied
            existing_jobs[job_id]['rejection'] = orig_rejection
            existing_jobs[job_id]['access_cost'] = orig_access_cost
            updated_count += 1
            
    # 4. Filter, format days, and sort
    final_list = []
    for job_id, job in existing_jobs.items():
        pub_date = job['date_posted']
        age_days = (current_time - pub_date).days
        
        if age_days <= retention_days:
            if age_days <= 0:
                days_posted_str = "Today"
            elif age_days == 1:
                days_posted_str = "1 day ago"
            else:
                days_posted_str = f"{age_days} days ago"
                
            # Calculate/verify access cost type
            source_lower = job['source'].lower()
            if 'upwork' in source_lower or 'freelancer' in source_lower or 'fiverr' in source_lower:
                access_cost = "Paid (Connects / Bids)"
            else:
                access_cost = "Free (No Fees)"
                
            final_list.append({
                'Job ID': job['id'],
                'Title': job['title'],
                'Company / Poster': job['company_poster'],
                'Source': job['source'],
                'Job Link': job['job_link'],
                'User Link': job['user_link'],
                'Date Posted (UTC)': pub_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
                'Days Posted': days_posted_str,
                'Access Cost': access_cost,
                'Applied': job.get('applied', ''),
                'Rejection': job.get('rejection', ''),
                '_age_days': age_days
            })
            
    # Sort: Reddit sources first (alphabetically grouped), then newest first (youngest age)
    final_list.sort(key=lambda x: (0 if "Reddit" in x['Source'] else 1, x['_age_days']))
    
    # 5. Write back to CSV
    csv_headers = [
        'Job ID', 
        'Title', 
        'Company / Poster', 
        'Source', 
        'Job Link', 
        'User Link', 
        'Date Posted (UTC)', 
        'Days Posted',
        'Access Cost',
        'Applied',
        'Rejection'
    ]
    
    try:
        with open(output_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=csv_headers)
            writer.writeheader()
            for item in final_list:
                row = {k: v for k, v in item.items() if k != '_age_days'}
                writer.writerow(row)
                
        # Generate pretty-aligned text table
        output_txt = output_csv.rsplit('.', 1)[0] + "_table.txt"
        table_headers = ['Source', 'Days Posted', 'Access Cost', 'Title', 'Company / Poster', 'Job Link', 'Applied', 'Rejection']
        
        # Calculate column widths
        widths = {h: len(h) for h in table_headers}
        for item in final_list:
            for h in table_headers:
                val = str(item.get(h, ''))
                # Truncate links/titles to keep the text file readable
                if len(val) > 40 and h in ['Title', 'Job Link']:
                    val = val[:37] + "..."
                widths[h] = max(widths[h], len(val))
                
        with open(output_txt, 'w', encoding='utf-8') as f:
            header_row = " | ".join(f"{h:<{widths[h]}}" for h in table_headers)
            f.write(header_row + "\n")
            separator = "-+-".join("-" * widths[h] for h in table_headers)
            f.write(separator + "\n")
            for item in final_list:
                row_cells = []
                for h in table_headers:
                    val = str(item.get(h, ''))
                    if len(val) > 40 and h in ['Title', 'Job Link']:
                        val = val[:37] + "..."
                    row_cells.append(f"{val:<{widths[h]}}")
                f.write(" | ".join(row_cells) + "\n")
                
        print("=" * 60)
        print("Scrape and Sync Completed Successfully!")
        print(f"CSV Location: {os.path.abspath(output_csv)}")
        print(f"Text Table: {os.path.abspath(output_txt)}")
        print(f"Total jobs in CSV: {len(final_list)}")
        print(f"Newly Added: {added_count}")
        print(f"Existing Updated: {updated_count}")
        print(f"Active Retention limit: {retention_months} months ({retention_days} days)")
        print("=" * 60)
    except Exception as e:
        print(f"Critical error writing outputs: {e}")

if __name__ == '__main__':
    main()
