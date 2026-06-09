# models/semantic_evaluator.py

import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel


class SemanticEvaluator:
    def __init__(
        self,
        model_name: str = "BM-K/KoSimCSE-roberta-multitask",
        threshold: float = 0.65,
        max_length: int = 128,
        device: str | None = None,
    ):
        self.model_name = model_name
        self.threshold = threshold
        self.max_length = max_length
        self.device = device or (
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModel.from_pretrained(self.model_name).to(self.device)
        self.model.eval()

    @torch.inference_mode()
    def _encode(self, texts: list[str]) -> torch.Tensor:
        inputs = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )

        inputs = {
            key: value.to(self.device)
            for key, value in inputs.items()
        }

        outputs = self.model(**inputs, return_dict=True)

        # SimCSE 계열에서는 CLS 토큰 임베딩 사용
        embeddings = outputs.last_hidden_state[:, 0, :]

        # cosine similarity 계산을 위해 정규화
        embeddings = F.normalize(
            embeddings,
            p=2,
            dim=1,
        )

        return embeddings

    def similarity(
        self,
        reference_text: str,
        candidate_text: str,
    ) -> float:
        if not reference_text or not candidate_text:
            return 0.0

        reference_text = reference_text.strip()
        candidate_text = candidate_text.strip()

        if not reference_text or not candidate_text:
            return 0.0

        embeddings = self._encode(
            [reference_text, candidate_text]
        )

        score = (
            embeddings[0] * embeddings[1]
        ).sum().detach().cpu().item()

        return float(score)

    def evaluate(
        self,
        reference_text: str,
        candidate_text: str,
    ) -> dict:
        score = self.similarity(
            reference_text=reference_text,
            candidate_text=candidate_text,
        )

        return {
            "semantic_model": self.model_name,
            "semantic_similarity": round(score, 4),
            "semantic_threshold": self.threshold,
            "semantic_pass": score >= self.threshold,
        }