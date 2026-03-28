# ============================================
#  NetWatch Monitor — Python Container
# ============================================

FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy monitor script
COPY netwatch_monitor.py .

# The monitor needs host network access to see real traffic.
# It also needs NET_ADMIN capability for connection scanning.
# Both are configured in docker-compose.yml.

ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["python3", "netwatch_monitor.py"]
CMD ["--api-url", "http://dashboard:8080", "--verbose"]
