# careerCTL

AI-powered career toolkit built with FastAPI and the Claude API. Four tools to take you from resume to offer.

## Tools

- **Resume Reviewer** — upload or paste your resume and get scores for clarity, impact, and keywords, plus specific strengths and improvements
- **JD Analyzer** — paste your resume and a job description to get a match score, missing keywords, skill gaps, and seniority alignment
- **Bullet Rewriter** — click any resume bullet and get three AI-rewritten versions that naturally incorporate missing keywords
- **Cover Letter Generator** — paste your resume and a job description, choose your tone and length, and get a tailored cover letter in seconds

## Tech Stack

- **Frontend** — HTML, CSS, JavaScript
- **Backend** — Python, FastAPI
- **AI** — Anthropic Claude API

## Project Structure
```
careerctl/
├── main.py
├── .env
└── static/
    ├── index.html
    ├── style.css
    ├── reviewer.html / reviewer.js
    ├── analyzer.html / analyzer.js
    ├── rewriter.html / rewriter.js
    └── coverletter.html / coverletter.js
```
