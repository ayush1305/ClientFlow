import os
import csv
import json
from datetime import datetime, timedelta
import scraper

def run_test():
    print("=" * 60)
    print("RUNNING DATE AGING AND RETENTION SIMULATION TEST")
    print("=" * 60)
    
    # 1. Create a dummy config
    test_config = {
        "output_csv": "test_leads.csv",
        "retention_months": 4,
        "keywords": [],
        "sources": {
            "we_work_remotely": False,
            "remotive": False,
            "reddit": False,
            "hacker_news": False,
            "python_org": False
        }
    }
    with open("config.json", "w") as f:
        json.dump(test_config, f, indent=2)
        
    # Remove any existing test CSV
    if os.path.exists("test_leads.csv"):
        os.remove("test_leads.csv")
        
    # Get current base time
    now = datetime.utcnow()
    
    # Create absolute publication times
    time_job_a = now  # 0 days old (Today)
    time_job_b = now - timedelta(days=7)  # 7 days old
    time_job_c = now - timedelta(days=119)  # 119 days old (just inside 4 months)
    time_job_d = now - timedelta(days=125)  # 125 days old (outside 4 months, should be cleaned immediately)
    
    # 2. Write initial dummy CSV
    csv_headers = [
        'Job ID', 
        'Title', 
        'Company / Poster', 
        'Source', 
        'Job Link', 
        'User Link', 
        'Date Posted (UTC)', 
        'Days Posted'
    ]
    
    initial_rows = [
        {
            'Job ID': 'job-a-id',
            'Title': 'Job A - React Dev',
            'Company / Poster': 'Company A',
            'Source': 'Test Source',
            'Job Link': 'http://job-a.com',
            'User Link': 'http://job-a.com/user',
            'Date Posted (UTC)': time_job_a.strftime("%Y-%m-%dT%H:%M:%SZ"),
            'Days Posted': 'Today'
        },
        {
            'Job ID': 'job-b-id',
            'Title': 'Job B - Django Dev',
            'Company / Poster': 'Company B',
            'Source': 'Test Source',
            'Job Link': 'http://job-b.com',
            'User Link': 'http://job-b.com/user',
            'Date Posted (UTC)': time_job_b.strftime("%Y-%m-%dT%H:%M:%SZ"),
            'Days Posted': '7 days ago'
        },
        {
            'Job ID': 'job-c-id',
            'Title': 'Job C - Node Dev',
            'Company / Poster': 'Company C',
            'Source': 'Test Source',
            'Job Link': 'http://job-c.com',
            'User Link': 'http://job-c.com/user',
            'Date Posted (UTC)': time_job_c.strftime("%Y-%m-%dT%H:%M:%SZ"),
            'Days Posted': '119 days ago'
        },
        {
            'Job ID': 'job-d-id',
            'Title': 'Job D - Ancient Job',
            'Company / Poster': 'Company D',
            'Source': 'Test Source',
            'Job Link': 'http://job-d.com',
            'User Link': 'http://job-d.com/user',
            'Date Posted (UTC)': time_job_d.strftime("%Y-%m-%dT%H:%M:%SZ"),
            'Days Posted': '125 days ago'
        }
    ]
    
    with open("test_leads.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_headers)
        writer.writeheader()
        writer.writerows(initial_rows)
        
    print("Initial Test CSV Written with 4 jobs:")
    print(" - Job A: Posted 0 days ago (Today)")
    print(" - Job B: Posted 7 days ago")
    print(" - Job C: Posted 119 days ago")
    print(" - Job D: Posted 125 days ago (should be purged immediately)")
    print("-" * 50)
    
    # 3. Run scraper (will load CSV, update relative dates, filter out jobs > 120 days)
    print("Running scraper.py (Simulation Run 1: Same day)...")
    
    # Run scraper main
    scraper.main()
    
    # Verify results of Run 1
    print("\nVerifying Run 1 Results...")
    with open("test_leads.csv", "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        
    # We expect Job D to be deleted because it is 125 days old (over 120 days/4 months limit)
    # We expect Jobs A, B, C to remain
    job_ids = [r['Job ID'] for r in rows]
    print(f"Jobs remaining in CSV: {job_ids}")
    
    assert 'job-d-id' not in job_ids, "FAIL: Job D should have been deleted (exceeded 4 months)"
    print("SUCCESS: Job D (125 days old) was successfully purged.")
    
    # Verify days ago
    for r in rows:
        if r['Job ID'] == 'job-a-id':
            assert r['Days Posted'] == 'Today', f"Expected Today, got {r['Days Posted']}"
        elif r['Job ID'] == 'job-b-id':
            assert r['Days Posted'] == '7 days ago', f"Expected 7 days ago, got {r['Days Posted']}"
        elif r['Job ID'] == 'job-c-id':
            assert r['Days Posted'] == '119 days ago', f"Expected 119 days ago, got {r['Days Posted']}"
    print("SUCCESS: Relative ages are correct for Run 1.")
    print("-" * 50)
    
    # 4. Mock a 1-day time shift forward (simulating running the next day)
    print("Simulating Run 2 (Next Day - Mocking +1 Day shift)...")
    
    # We will temporarily override scraper's current time calculation by shifting the file timestamps back
    # or by mocking datetime.utcnow
    original_utcnow = datetime.utcnow
    
    # Mock datetime.utcnow to return 1 day in the future
    class MockDateTime:
        @classmethod
        def utcnow(cls):
            return original_utcnow() + timedelta(days=1)
        @classmethod
        def fromisoformat(cls, s):
            return datetime.fromisoformat(s)
        @classmethod
        def strptime(cls, s, fmt):
            return datetime.strptime(s, fmt)
            
    scraper.datetime = MockDateTime
    
    # Run the scraper again
    scraper.main()
    
    # Restore original datetime
    scraper.datetime = datetime
    
    # Verify results of Run 2
    print("\nVerifying Run 2 Results (after 1 day elapsed)...")
    with open("test_leads.csv", "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        
    job_ids = [r['Job ID'] for r in rows]
    print(f"Jobs remaining in CSV: {job_ids}")
    
    # After 1 day:
    # Job A (0 days old) -> should become 1 day old ("1 day ago")
    # Job B (7 days old) -> should become 8 days old ("8 days ago") -- THIS VERIFIES the user's specific request!
    # Job C (119 days old) -> should become 120 days old ("120 days ago") -- which is still <= 120 days
    # All three should still be in the CSV
    assert 'job-a-id' in job_ids
    assert 'job-b-id' in job_ids
    assert 'job-c-id' in job_ids
    
    for r in rows:
        if r['Job ID'] == 'job-a-id':
            assert r['Days Posted'] == '1 day ago', f"Expected 1 day ago, got {r['Days Posted']}"
            print("Job A: 'Today' correctly incremented to '1 day ago'.")
        elif r['Job ID'] == 'job-b-id':
            assert r['Days Posted'] == '8 days ago', f"Expected 8 days ago, got {r['Days Posted']}"
            print("Job B: '7 days ago' correctly incremented to '8 days ago'.")
        elif r['Job ID'] == 'job-c-id':
            assert r['Days Posted'] == '120 days ago', f"Expected 120 days ago, got {r['Days Posted']}"
            print("Job C: '119 days ago' correctly incremented to '120 days ago'.")
            
    print("SUCCESS: Relative ages correctly incremented on next day run.")
    print("-" * 50)
    
    # 5. Mock another 1-day time shift forward (simulating running on the 2nd day after initial run)
    print("Simulating Run 3 (Two days later - Mocking +2 Days shift)...")
    
    # Mock datetime.utcnow to return 2 days in the future
    class MockDateTime2:
        @classmethod
        def utcnow(cls):
            return original_utcnow() + timedelta(days=2)
        @classmethod
        def fromisoformat(cls, s):
            return datetime.fromisoformat(s)
        @classmethod
        def strptime(cls, s, fmt):
            return datetime.strptime(s, fmt)
            
    scraper.datetime = MockDateTime2
    
    # Run the scraper again
    scraper.main()
    
    # Restore original datetime
    scraper.datetime = datetime
    
    # Verify results of Run 3
    print("\nVerifying Run 3 Results (after 2 days elapsed)...")
    with open("test_leads.csv", "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        
    job_ids = [r['Job ID'] for r in rows]
    print(f"Jobs remaining in CSV: {job_ids}")
    
    # After 2 days:
    # Job A (0 days old) -> should become 2 days old ("2 days ago")
    # Job B (7 days old) -> should become 9 days old ("9 days ago")
    # Job C (119 days old) -> should become 121 days old -> EXCEEDS 120 days (4 months) -> MUST BE DELETED!
    assert 'job-c-id' not in job_ids, "FAIL: Job C should have been deleted (exceeded 4 months)"
    print("SUCCESS: Job C (121 days old) was successfully purged because it exceeded the 4-month retention window.")
    
    # Cleanup test files
    if os.path.exists("test_leads.csv"):
        os.remove("test_leads.csv")
    
    # Restore original config.json
    config_file = 'config.json'
    original_config = {
      "output_csv": "job_leads.csv",
      "retention_months": 4,
      "keywords": [
        "python",
        "django",
        "react",
        "node",
        "javascript",
        "developer",
        "engineer"
      ],
      "sources": {
        "we_work_remotely": True,
        "remotive": True,
        "reddit": True,
        "hacker_news": True,
        "python_org": True
      }
    }
    with open(config_file, "w") as f:
        json.dump(original_config, f, indent=2)
        
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED! AGING, RETENTION, AND PURGING WORK PERFECTLY.")
    print("=" * 60)

if __name__ == '__main__':
    run_test()
