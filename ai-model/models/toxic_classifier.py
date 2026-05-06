#toxic_classifier.py (mvp.gpt)

import json
from openai import OpenAI


class ToxicClassifier:
    def __init__(self, client: OpenAI, model_name: str):
        self.client = client
        self.model_name = "gpt-5.4-mini"

    def predict(self, text: str) -> dict: #입력:댓글, 출력:결과 dict
        prompt = f"""
너는 한국어 온라인 댓글의 독성 여부를 판별하는 분류기다.

기준:
- toxic: 욕설, 모욕, 비하, 혐오, 차별, 공격적 표현이 포함된 경우
- non-toxic: 일반 의견, 비판, 감정 표현이지만 공격성이 없는 경우

#few shot 프롬프팅 -> 테스트 후에 toxic을 잡는 걸 보고 예시 조정 예정
#1차로 잡은 예시는 non-toxic: 취향, 아쉬움. toxic: 공격, 차별, 욕설, 비꼼

예시 1. 
댓글: "이 영상은 제 취향이 아니네요."
출력:
{{"label": "non-toxic"}}

예시 2. 
댓글: "여자라서 저런가 수준이 좀 떨어지네."
출력:
{{"label": "toxic"}}

예시 3
댓글: "설명이 조금 부족해서 아쉽네요."
출력:
{{"label": "non-toxic"}}

예시 4
댓글: "이딴 걸 영상이라고 올렸냐?"
출력:
{{"label": "toxic"}}

예시 5
댓글: "너 진짜 멍청하네."
출력:
{{"label": "toxic"}}
    
예시 6
댓글: "수준 진짜 처참하네 ㅋㅋ"
출력:
{{"label": "toxic"}}

이제 아래 댓글을 판별하라.

댓글:
"{text}"

아래 JSON 형식으로만 답해라.
{{
  "label": "toxic"
}}
또는
{{
  "label": "non-toxic"
}}
"""

#gpt 호출
        response = self.client.responses.create(
            model=self.model_name,
            input=prompt
        )

#gpt 결과 꺼내는 부분
        output_text = response.output_text.strip()
        result = json.loads(output_text)

        return {
            "label": result["label"],
            "is_toxic": result["label"] == "toxic"
        }