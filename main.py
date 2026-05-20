from fastapi import FastAPI, Form, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from anthropic import Anthropic
from dotenv import load_dotenv
import fitz
import os

load_dotenv()

app = FastAPI()
client = Anthropic()


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
    return {"result": message.content[0].text}


# Serve static files — must be last
app.mount("/", StaticFiles(directory="static", html=True), name="static")
