FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN useradd --create-home --uid 10001 knowsphere
COPY requirements.lock ./
RUN pip install --require-hashes -r requirements.lock
COPY --chown=knowsphere:knowsphere knowsphere ./knowsphere
COPY --chown=knowsphere:knowsphere migrations ./migrations
USER knowsphere
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn knowsphere.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log --timeout-graceful-shutdown 160"]
