FROM python:3.11-slim
WORKDIR /fast
COPY . .
RUN pip install -r requirements.txt && \
    rm -rf /var/lib/apt/lists/*
EXPOSE 8080
CMD ["python", "app.py"]