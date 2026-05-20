import json
import pytest

SAMPLE_RESUME = """
Jane Smith | Senior Software Engineer | jane@example.com

Experience:
Senior Software Engineer, Acme Corp (2020–2024)
- Built Python microservices with FastAPI and Docker, cutting latency by 40%
- Led a team of 5 engineers delivering REST API integrations on schedule
- Implemented CI/CD pipelines using GitHub Actions and AWS CodeDeploy

Skills: Python, FastAPI, Docker, AWS, REST APIs, PostgreSQL, Git, Linux
"""

SAMPLE_JD = """
We are hiring a Senior Software Engineer to join our platform team.
Requirements:
- 5+ years of Python development
- Experience with FastAPI or Django REST Framework
- Docker and Kubernetes
- AWS cloud infrastructure (EC2, S3, RDS)
- Team leadership and strong communication skills
"""

SAMPLE_BULLET = "Built Python microservices with FastAPI and Docker, cutting latency by 40%"
SAMPLE_MISSING_KEYWORDS = "Kubernetes, CI/CD, RDS"


class TestReview:
    def test_happy_path(self, client):
        response = client.post("/review", data={"text": SAMPLE_RESUME})
        assert response.status_code == 200
        assert "result" in response.json()

    def test_missing_input_returns_400(self, client):
        response = client.post("/review", data={"text": ""})
        assert response.status_code == 400
        assert "error" in response.json()

    def test_result_format(self, client):
        response = client.post("/review", data={"text": SAMPLE_RESUME})
        data = json.loads(response.json()["result"])
        assert "scores" in data
        assert "strengths" in data
        assert "improvements" in data
        assert "verdict" in data


class TestAnalyze:
    def test_happy_path(self, client):
        response = client.post("/analyze", data={
            "resume": SAMPLE_RESUME,
            "job_description": SAMPLE_JD,
        })
        assert response.status_code == 200
        assert "result" in response.json()

    def test_missing_input_returns_400(self, client):
        response = client.post("/analyze", data={
            "resume": "",
            "job_description": "",
        })
        assert response.status_code == 400
        assert "error" in response.json()

    def test_result_format(self, client):
        response = client.post("/analyze", data={
            "resume": SAMPLE_RESUME,
            "job_description": SAMPLE_JD,
        })
        data = json.loads(response.json()["result"])
        assert "match_score" in data
        assert "summary" in data
        assert "seniority" in data
        assert "matched_keywords" in data
        assert "missing_keywords" in data
        assert "skill_gaps" in data


class TestRewrite:
    def test_happy_path(self, client):
        response = client.post("/rewrite", data={
            "bullet": SAMPLE_BULLET,
            "missing_keywords": SAMPLE_MISSING_KEYWORDS,
            "job_description": SAMPLE_JD,
        })
        assert response.status_code == 200
        assert "result" in response.json()

    def test_missing_input_returns_422(self, client):
        # /rewrite has no custom validation — FastAPI returns 422 for missing required fields
        response = client.post("/rewrite", data={})
        assert response.status_code == 422

    def test_result_format(self, client):
        response = client.post("/rewrite", data={
            "bullet": SAMPLE_BULLET,
            "missing_keywords": SAMPLE_MISSING_KEYWORDS,
            "job_description": SAMPLE_JD,
        })
        data = json.loads(response.json()["result"])
        assert "rewrites" in data
        assert len(data["rewrites"]) > 0


class TestCoverLetter:
    def test_happy_path(self, client):
        response = client.post("/cover-letter", data={
            "resume": SAMPLE_RESUME,
            "job_description": SAMPLE_JD,
        })
        assert response.status_code == 200
        assert "result" in response.json()

    def test_missing_input_returns_422(self, client):
        # /cover-letter has no custom validation — FastAPI returns 422 for missing required fields
        response = client.post("/cover-letter", data={})
        assert response.status_code == 422

    def test_result_is_nonempty_string(self, client):
        response = client.post("/cover-letter", data={
            "resume": SAMPLE_RESUME,
            "job_description": SAMPLE_JD,
        })
        result = response.json()["result"]
        assert isinstance(result, str)
        assert len(result) > 0
