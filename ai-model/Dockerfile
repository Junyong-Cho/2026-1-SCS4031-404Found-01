FROM python:3.11-slim
WORKDIR /fast
COPY . .
RUN pip install -r requirements.txt
EXPOSE 8080
CMD ["python", "app.py"]