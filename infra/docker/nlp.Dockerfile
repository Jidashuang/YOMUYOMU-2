FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY services/nlp/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY services/nlp /app/services/nlp

WORKDIR /app/services/nlp
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
