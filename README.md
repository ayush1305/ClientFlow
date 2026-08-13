# Job Leads Automation & Scraper Tool

This Python command-line utility automates the process of gathering job leads from multiple public developer and remote job platforms, merging them into a single local database (CSV), dynamically updating their posting ages, and maintaining a 4-month data retention policy.

## Features

- **Multi-Source Scraping**: Pulls job postings from:
  - **We Work Remotely** (via RSS)
  - **Remotive** (via public JSON API)
  - **Reddit Subreddits** (via RSS: `r/forhire`, `r/jobbit`, `r/devjobs`, `r/DesignJobs`, `r/webdeveloperjobs`, `r/remotework`, `r/hiring`)
  - **Hacker News "Who is Hiring"** (dynamically retrieves and parses comments from the latest monthly thread via Algolia search API)
  - **Python.org** (via RSS)
- **Increment & Merge Logic**: Loads existing jobs from `job_leads.csv`, recalculates their ages (e.g. from "7 days ago" to "8 days ago" as time passes) using absolute timestamps, and inserts newly found leads without creating duplicate records.
- **4-Month Data Retention**: Automatically removes all jobs from the CSV file that are older than 4 months (120 days).
- **Customizable Keywords**: Filters job postings by keywords (case-insensitive) specified in `config.json`.
- **Poster & Job Links**: Includes separate columns in the CSV for both the Job URL and the user profile/company URL (where available).

---

## Files

1. **`scraper.py`**: The core Python engine that handles fetching, parsing, merging, filtering, and writing to the CSV.
2. **`config.json`**: Configuration options for keywords, output filenames, and source toggles.
3. **`requirements.txt`**: Package dependencies list.
4. **`run.bat`**: A simple helper batch script to run the scraper on Windows.
5. **`discord_and_reddit_channels.md`**: Guide listing free Discord servers and subreddits to find jobs for free.

---

## Setup Instructions

1. Ensure Python 3 is installed and added to your system PATH.
2. Install the required dependencies:
   ```cmd
   pip install -r requirements.txt
   ```
3. Customize `config.json` to define your target job keywords and enable/disable platforms.

---

## How to Run

### Method 1: Double-click
Simply double-click the **`run.bat`** file in your file explorer. It will execute the scraper and keep the command window open so you can view the execution summary.

### Method 2: Command Line
Open a terminal in the folder and run:
```cmd
python scraper.py
```

---

## Configuration (`config.json`)

You can edit `config.json` using any text editor:
```json
{
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
    "we_work_remotely": true,
    "remotive": true,
    "reddit": true,
    "hacker_news": true,
    "python_org": true
  }
}
```
*Note: If `keywords` is empty (`[]`), the script will fetch and save ALL jobs it finds without filtering by topic.*

---

## Daily Automation (Windows Task Scheduler)

The tool is configured to run silently in the background **every day at 11:00 AM** using Windows Task Scheduler.

### Automating/Triggering Manually
- **Run the task immediately**:
  ```cmd
  schtasks /run /tn "JobLeadsScraperDaily"
  ```
- **Delete/Stop the daily schedule**:
  ```cmd
  schtasks /delete /tn "JobLeadsScraperDaily" /f
  ```
- **Check Task Status**:
  Open the **Task Scheduler** app in Windows and search for the task named `JobLeadsScraperDaily`.

