from models.toxic_classifier import ToxicClassifier

classifier = ToxicClassifier(
    model_name="your-model-name",
    threshold=0.5
)

comment = "진짜 개별로네"
result = classifier.predict(comment)

print(result)