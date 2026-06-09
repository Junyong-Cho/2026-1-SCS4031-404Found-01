# toxic_classifier.py (mvp.gpt)

import json
from openai import AsyncOpenAI


class ToxicClassificationError(Exception):
    pass


class ToxicClassifier:

    def __init__(
        self,
        client: AsyncOpenAI,
        model_name: str
    ):
        self.client = client
        self.model_name = model_name


    async def predict(
        self,
        text: str,
        retry_count: int = 1
    ) -> dict:
        # 입력: 댓글
        # 출력: 결과 dict

        last_error = None

        for _ in range(retry_count + 1):

            try:

                prompt = f"""
너는 한국어 온라인 댓글의 독성 여부를 판별하는 분류기다.

기준:
- toxic: 욕설, 모욕, 비하, 혐오, 차별, 공격적 표현이 포함된 경우
- non-toxic: 일반 의견, 비판, 감정 표현이지만 공격성이 없는 경우

#few shot 프롬프팅 -> 테스트 후에 toxic을 잡는 걸 보고 예시 조정 예정
#1차로 잡은 예시는 non-toxic: 취향, 아쉬움. toxic: 공격, 차별, 욕설, 비꼼

유형 힌트(참고용):
아래와 같은 유형들이 독성 댓글이 될 수 있다.
- Profanity: 욕설, 비속어, 직접적인 모욕 표현. 단, 댓글이 의미 없는 욕설만으로 구성된 경우에는 SimpleProfanity로 분류한다.
- Politics: 정치 성향, 정치인, 정당, 이념에 대한 비하/혐오/조롱 표현
- Origin: 출신, 지역, 국가, 국적에 대한 비하 표현
- Physical: 외모, 체형, 신체 특징에 대한 비하 표현
- Age: 나이, 세대에 대한 비하 표현
- Gender: 성별에 대한 비하, 고정관념, 차별 표현
- Religion: 종교에 대한 비하, 혐오, 조롱 표현
- Race: 인종, 피부색, 민족에 대한 차별/혐오 표현
- SimpleProfanity : 댓글이 욕설, 비속어, 감탄형 욕설 중심으로만 구성되어 있으며, 조사/어미/감탄사/지시어를 제외했을 때 의미 있는 비난 대상이나 내용이 남지 않는 경우 ⭐->(이건 따로 정화 파일에도 넘겨야 하긴 하는데, 충분히 가능할 듯 합니다)

목표:
- 댓글을 해석해, toxic인지, non-toxic인지 판별하라.


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

예시 3
댓글: "진짜 OO같은 사람이 있어야해, 이 시대엔 사기꾼들이 너무 많아"
출력:
{{"label": "non-toxic"}}

예시 3
댓글: "또 콘텐츠 담당관이냐고요!"
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

예시 7
댓글: "너무 더럽다ㅜㅜ 토나올라한다"
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

                # GPT 호출
                response = await self.client.responses.create(
                    model=self.model_name,
                    input=prompt
                )

                # GPT 결과 꺼내기
                output_text = (
                    response.output_text.strip()
                )

                result = json.loads(output_text)

                # 응답 형식 검증
                if not isinstance(result, dict):
                    raise ValueError(
                        "result가 dict가 아닙니다."
                    )

                label = result.get("label")

                # 허용되지 않은 라벨 검증
                if label not in [
                    "toxic",
                    "non-toxic"
                ]:
                    raise ValueError(
                        f"잘못된 toxic label: {label}"
                    )

                return {
                    "label": label,
                    "is_toxic": (
                        label == "toxic"
                    ),
                    "toxic_status": "success"
                }

            except Exception as e:

                last_error = e

        raise ToxicClassificationError(
            str(last_error)
        )