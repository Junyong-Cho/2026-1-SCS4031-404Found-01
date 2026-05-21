# refiner.py

import json
from openai import AsyncOpenAI


class Refiner:
    def __init__(self, client: AsyncOpenAI, model_name: str):
        self.client = client
        self.model_name = model_name

    async def refine(self, text: str) -> dict:
        prompt = f"""
너는 한국어 온라인 댓글을 '의미를 유지한 채 정화'하는 문장 정제기다.

목표:
- 원문이 전달하려는 핵심 의미와 의도는 유지한다.
- 욕설, 모욕, 비하, 조롱, 공격적 표현은 완화한다.
- 지나치게 공손하거나 딱딱하게 바꾸지 말고, 자연스러운 한국어 댓글 톤을 유지한다.
- 원문의 주제가 사라지거나 의미가 왜곡되면 안 된다.

정화 원칙:
1. 원문의 핵심 주장과 의도는 유지한다.
2. 욕설, 비하, 조롱, 공격적 어조는 완화한다.
3. 비판은 가능하지만, 인신공격은 제거한다.
4. 최종 결과는 자연스러운 한 문장이어야 한다.
5. 의미를 지나치게 순화하거나 완전히 다른 의견으로 바꾸지 마라.

평가 기준:
- meaning_preservation: 원문의 의미와 의도를 얼마나 잘 유지했는가 (1~5)
- toxicity_reduction: 공격적 표현을 얼마나 잘 완화했는가 (1~5)
- naturalness: 한국어 문장으로 얼마나 자연스러운가 (1~5)

예시 1
원문: "진짜 생각 없는 행동이네. 그렇게밖에 못하냐?"
출력:
{{
  "candidates": [
    {{
      "text": "생각이 조금 아쉬운 행동 같네요. 더 나은 방식도 있었을 것 같습니다.",
      "meaning_preservation": 5,
      "toxicity_reduction": 5,
      "naturalness": 5,
      "total_score": 15
    }},
    {{
      "text": "조금 더 신중하게 행동했으면 좋았을 것 같아요.",
      "meaning_preservation": 4,
      "toxicity_reduction": 5,
      "naturalness": 5,
      "total_score": 14
    }},
    {{
      "text": "이건 좀 아쉽네요. 다른 방식으로 했으면 더 좋았을 것 같습니다.",
      "meaning_preservation": 4,
      "toxicity_reduction": 5,
      "naturalness": 5,
      "total_score": 14
    }}
  ],
  "selected_index": 0,
  "refined_text": "생각이 조금 아쉬운 행동 같네요. 더 나은 방식도 있었을 것 같습니다."
}}

예시 2
원문: "수준 진짜 처참하네 ㅋㅋ"
출력:
{{
  "candidates": [
    {{
      "text": "완성도가 많이 아쉽네요.",
      "meaning_preservation": 5,
      "toxicity_reduction": 5,
      "naturalness": 5,
      "total_score": 15
    }},
    {{
      "text": "전체적인 수준이 조금 아쉽게 느껴집니다.",
      "meaning_preservation": 4,
      "toxicity_reduction": 5,
      "naturalness": 5,
      "total_score": 14
    }},
    {{
      "text": "조금 더 보완이 필요해 보입니다.",
      "meaning_preservation": 4,
      "toxicity_reduction": 5,
      "naturalness": 4,
      "total_score": 13
    }}
  ],
  "selected_index": 0,
  "refined_text": "완성도가 많이 아쉽네요."
}}

예시 3
원문: "여자라서 저런가 수준이 좀 떨어지네."
출력:
{{
  "candidates": [
    {{
      "text": "설명이나 표현 방식이 다소 아쉽게 느껴집니다.",
      "meaning_preservation": 4,
      "toxicity_reduction": 5,
      "naturalness": 5,
      "total_score": 14
    }},
    {{
      "text": "전체적인 전달 방식이 조금 부족하게 느껴집니다.",
      "meaning_preservation": 4,
      "toxicity_reduction": 5,
      "naturalness": 5,
      "total_score": 14
    }},
    {{
      "text": "내용의 완성도가 조금 아쉽네요.",
      "meaning_preservation": 4,
      "toxicity_reduction": 5,
      "naturalness": 5,
      "total_score": 14
    }}
  ],
  "selected_index": 0,
  "refined_text": "설명이나 표현 방식이 다소 아쉽게 느껴집니다."
}}

이제 아래 원문 댓글을 정화하라.

원문:
"{text}"

반드시 아래 JSON 형식으로만 답하라.
설명, 이유, 마크다운 코드블록은 절대 포함하지 마라.

출력 형식:
{{
  "candidates": [
    {{
      "text": "후보1",
      "meaning_preservation": 1,
      "toxicity_reduction": 1,
      "naturalness": 1,
      "total_score": 3
    }},
    {{
      "text": "후보2",
      "meaning_preservation": 1,
      "toxicity_reduction": 1,
      "naturalness": 1,
      "total_score": 3
    }},
    {{
      "text": "후보3",
      "meaning_preservation": 1,
      "toxicity_reduction": 1,
      "naturalness": 1,
      "total_score": 3
    }}
  ],
  "selected_index": 0,
  "refined_text": "최종 선택된 문장"
}}
"""

        response = await self.client.responses.create(
            model=self.model_name,
            input=prompt
        )

        output_text = response.output_text.strip()

        # 혹시라도 코드블록으로 감싸져 오면 제거
        if output_text.startswith("```"):
            output_text = output_text.strip("`")
            output_text = output_text.replace("json", "", 1).strip()

        #result = json.loads(output_text)
        
        try:
            result = json.loads(output_text)
        except json.JSONDecodeError:
            return {
                "original_text": text,
                "refined_text": text,
                "candidates": [],
                "selected_candidate": None,
                "process_type": "fallback_raw"
            }

        if "candidates" not in result or not isinstance(result["candidates"], list):
            raise ValueError("Invalid response format: 'candidates' must be a list.")

        if len(result["candidates"]) == 0:
            raise ValueError("Invalid response format: 'candidates' is empty.")

        cleaned_candidates = []
        for candidate in result["candidates"]:
            if not isinstance(candidate, dict):
                continue

            text_value = candidate.get("text", "").strip()
            meaning = int(candidate.get("meaning_preservation", 0))
            toxicity = int(candidate.get("toxicity_reduction", 0))
            naturalness = int(candidate.get("naturalness", 0))
            total = int(candidate.get("total_score", meaning + toxicity + naturalness))

            if not text_value:
                continue

            cleaned_candidates.append({
                "text": text_value,
                "meaning_preservation": meaning,
                "toxicity_reduction": toxicity,
                "naturalness": naturalness,
                "total_score": total
            })

        if not cleaned_candidates:
            raise ValueError("No valid candidates returned.")

        # 모델이 selected_index를 이상하게 주더라도 total_score 기준으로 한 번 더 안전하게 선택
        best_candidate = max(cleaned_candidates, key=lambda x: x["total_score"])

        return {
            "original_text": text,
            "refined_text": best_candidate["text"],
            "candidates": cleaned_candidates,
            "selected_candidate": best_candidate
        }