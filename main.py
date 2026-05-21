from fastapi import FastAPI, Form, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from anthropic import Anthropic
from dotenv import load_dotenv
from datetime import datetime, timezone
import fitz
import os

load_dotenv()

app = FastAPI()
client = Anthropic()

LOG_FILE = "usage.log"

def log_usage(endpoint: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(LOG_FILE, "a") as f:
        f.write(f"{endpoint},{ts}\n")


# ── Resume Reviewer ────────────────────────────────────────

@app.post("/review")
async def review(
    text: str = Form(default=""),
    file: UploadFile = File(default=None),
):
    resume_text = text
    if file and file.filename:
        contents = await file.read()
        if file.filename.lower().endswith(".pdf"):
            doc = fitz.open(stream=contents, filetype="pdf")
            resume_text = "".join(page.get_text() for page in doc)
        else:
            resume_text = contents.decode("utf-8", errors="ignore")

    if not resume_text.strip():
        return JSONResponse(status_code=400, content={"error": "No resume content found."})

    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1000,
        system="""You are a professional resume reviewer. Analyze the resume and respond ONLY with a valid JSON object — no preamble, no markdown fences, no backticks. Use this exact format:

{
  "scores": { "clarity": <0-100>, "impact": <0-100>, "keywords": <0-100> },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": [
    {"title": "<short title>", "detail": "<specific actionable advice>"}
  ],
  "verdict": "<one sentence overall verdict>"
}

Rules:
- scores reflect genuine quality, not flattery
- strengths: up to 4 specific things done well
- improvements: up to 4 concrete, actionable suggestions
- verdict: honest one-sentence summary""",
        messages=[
            {"role": "user", "content": f"Review this resume:\n\n{resume_text[:3000]}"}
        ],
    )
    log_usage("review")
    return {"result": message.content[0].text}


# ── JD Analyzer ────────────────────────────────────────────

@app.post("/analyze")
async def analyze(
    resume: str = Form(default=""),
    job_description: str = Form(...),
    file: UploadFile = File(default=None),
):
    if file and file.filename:
        contents = await file.read()
        if file.filename.lower().endswith(".pdf"):
            doc = fitz.open(stream=contents, filetype="pdf")
            resume = "".join(page.get_text() for page in doc)
        else:
            resume = contents.decode("utf-8", errors="ignore")

    if not resume.strip() or not job_description.strip():
        return JSONResponse(status_code=400, content={"error": "Both resume and job description are required."})

    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1500,
        system="""You are an expert ATS (Applicant Tracking System) and career coach.
Compare the resume against the job description and respond ONLY with a valid JSON object —
no preamble, no markdown fences, no backticks. Use this exact format:

{
  "match_score": <integer 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "seniority": {
    "jd_level": "junior|mid|senior|staff|executive",
    "resume_level": "junior|mid|senior|staff|executive",
    "verdict": "<one sentence>"
  },
  "matched_keywords": ["keyword1", "keyword2", ...],
  "missing_keywords": ["keyword1", "keyword2", ...],
  "skill_gaps": [
    {"skill": "<skill name>", "importance": "high|medium|low", "suggestion": "<how to address it>"}
  ],
  "strengths": ["strength1", "strength2", ...],
  "quick_wins": ["actionable tip 1", "actionable tip 2", ...]
}

Rules:
- matched_keywords: keywords from the JD present in the resume (max 12)
- missing_keywords: important keywords from the JD not in the resume (max 12)
- skill_gaps: up to 5 specific gaps
- strengths: up to 4 strengths relative to the role
- quick_wins: up to 4 concrete edits to improve score immediately""",
        messages=[
            {
                "role": "user",
                "content": (
                    f"RESUME:\n{resume[:3000]}\n\n"
                    f"JOB DESCRIPTION:\n{job_description[:2000]}"
                ),
            }
        ],
    )
    log_usage("analyze")
    return {"result": message.content[0].text}


# ── Bullet Rewriter ────────────────────────────────────────

@app.post("/rewrite")
async def rewrite(
    bullet: str = Form(...),
    missing_keywords: str = Form(...),
    job_description: str = Form(...),
):
    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1000,
        system="""You are an expert resume coach. Rewrite the given resume bullet point to better match the job description by naturally incorporating missing keywords. Respond ONLY with a valid JSON object, no preamble or markdown fences:

{
  "rewrites": [
    {"version": "<rewritten bullet>", "explanation": "<one sentence on what changed>"},
    {"version": "<rewritten bullet>", "explanation": "<one sentence on what changed>"},
    {"version": "<rewritten bullet>", "explanation": "<one sentence on what changed>"}
  ]
}

Rules:
- Keep each rewrite to one bullet point sentence
- Sound natural, not keyword-stuffed
- Each version should take a different angle (metric-focused, skill-focused, impact-focused)
- Only use keywords that could plausibly apply given the original bullet""",
        messages=[
            {
                "role": "user",
                "content": (
                    f"ORIGINAL BULLET:\n{bullet}\n\n"
                    f"MISSING KEYWORDS:\n{missing_keywords}\n\n"
                    f"JOB DESCRIPTION:\n{job_description[:1500]}"
                ),
            }
        ],
    )
    log_usage("rewrite")
    return {"result": message.content[0].text}


# ── Cover Letter Generator ─────────────────────────────────

@app.post("/cover-letter")
async def cover_letter(
    resume: str = Form(...),
    job_description: str = Form(...),
    tone: str = Form(default="formal"),
    length: str = Form(default="full"),
    extra_instructions: str = Form(default=""),
):
    length_guide = (
        "3 short paragraphs, no more than 200 words total"
        if length == "short"
        else "4 paragraphs, around 350 words"
    )
    tone_guide = (
        "professional and formal"
        if tone == "formal"
        else "warm, confident and conversational"
    )

    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1500,
        system=f"""You are an expert career coach who writes outstanding cover letters.
Write a cover letter that is {tone_guide} in tone and {length_guide} in length.
Use the resume and job description provided. Address the letter to the hiring team.
Do not include a date or address header — start directly with the salutation.
Only output the cover letter text, nothing else.""",
        messages=[
            {
                "role": "user",
                "content": (
                    f"RESUME:\n{resume[:3000]}\n\n"
                    f"JOB DESCRIPTION:\n{job_description[:2000]}\n\n"
                    + (f"EXTRA INSTRUCTIONS:\n{extra_instructions}" if extra_instructions else "")
                ),
            }
        ],
    )
    log_usage("cover-letter")
    return {"result": message.content[0].text}


# ── Interview Prep ─────────────────────────────────────────

@app.post("/interview-prep")
async def interview_prep(
    job_description: str = Form(...),
    resume: str = Form(default=""),
):
    if not job_description.strip():
        return JSONResponse(status_code=400, content={"error": "Job description is required."})

    context = f"JOB DESCRIPTION:\n{job_description[:2000]}"
    if resume.strip():
        context += f"\n\nRESUME:\n{resume[:2000]}"

    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=2500,
        system="""You are an expert interview coach preparing candidates for job interviews.
Based on the job description (and resume if provided), generate exactly 5 technical questions
and exactly 5 behavioural questions an interviewer would ask for this specific role.

Respond ONLY with a valid JSON object — no preamble, no markdown fences, no backticks. Use this exact format:

{
  "technical": [
    {
      "question": "<the interview question>",
      "framework": "<concise answer framework — key points, structure, or approach the candidate should cover>",
      "why_asked": "<one sentence on what the interviewer is probing for>"
    }
  ],
  "behavioral": [
    {
      "question": "<the interview question>",
      "framework": "<STAR guidance: what Situation/Task to set up, what Action to describe, what Result to quantify>",
      "why_asked": "<one sentence on what the interviewer is probing for>"
    }
  ]
}

Rules:
- technical: questions specific to the skills, tools, technologies, and domain in the JD
- behavioral: past-behavior questions assessing soft skills, answered with the STAR method
- framework: practical and concise — tell the candidate exactly what to include in their answer
- why_asked: helps the candidate understand the interviewer's intent
- Generate exactly 5 of each type, no more, no less""",
        messages=[
            {"role": "user", "content": context}
        ],
    )
    log_usage("interviewprep")
    return {"result": message.content[0].text}


# ── LinkedIn Summary Generator ────────────────────────────

@app.post("/linkedin")
async def linkedin(
    resume: str = Form(default=""),
    tone: str = Form(default="professional"),
    focus: str = Form(default="job seeking"),
    file: UploadFile = File(default=None),
):
    if file and file.filename:
        contents = await file.read()
        if file.filename.lower().endswith(".pdf"):
            doc = fitz.open(stream=contents, filetype="pdf")
            resume = "".join(page.get_text() for page in doc)
        else:
            resume = contents.decode("utf-8", errors="ignore")

    if not resume.strip():
        return JSONResponse(status_code=400, content={"error": "No resume content found."})

    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1000,
        system=f"""You are a LinkedIn profile expert. Write three distinct LinkedIn About section summaries based on the resume provided.

Each summary must be under 300 characters, written in first person, {tone} in tone, and optimised for someone who is {focus}.

Respond ONLY with a valid JSON object — no preamble, no markdown fences, no backticks. Use this exact format:

{{
  "summaries": [
    {{"version": "<summary text>", "angle": "Achievement-focused"}},
    {{"version": "<summary text>", "angle": "Skill-focused"}},
    {{"version": "<summary text>", "angle": "Story-focused"}}
  ]
}}

Rules:
- Each summary must be strictly under 300 characters
- Write in first person (I, my)
- Each version should take a genuinely different angle
- Naturally reflect the job search status: {focus}
- Do not invent credentials not in the resume""",
        messages=[
            {"role": "user", "content": f"Write LinkedIn summaries for this resume:\n\n{resume[:3000]}"}
        ],
    )
    log_usage("linkedin")
    return {"result": message.content[0].text}


# ── Usage Stats ────────────────────────────────────────────

@app.get("/stats")
async def stats():
    counts: dict = {}
    try:
        with open(LOG_FILE) as f:
            for line in f:
                line = line.strip()
                if line:
                    endpoint = line.split(",")[0]
                    counts[endpoint] = counts.get(endpoint, 0) + 1
    except FileNotFoundError:
        pass
    return {"total": sum(counts.values()), "breakdown": counts}


# Serve static files — must be last
app.mount("/", StaticFiles(directory="static", html=True), name="static")
