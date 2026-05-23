#label_classifier.py

import json
from openai import AsyncOpenAI


class LabelClassifier:
    def __init__(self, client: AsyncOpenAI, model_name: str):
        self.client = client
        self.model_name = model_name

    async def predict(self, text: str) -> dict:
        prompt = f"""
너는 한국어 온라인 댓글의 독성 유형을 분류하는 멀티라벨 분류기다.

목표:
- 입력된 댓글이 어떤 독성 유형에 해당하는지 모두 판별하라.
- 하나의 댓글은 여러 라벨을 동시에 가질 수 있다.
- 해당하는 라벨이 없으면 빈 리스트 []를 반환하라.
- 출력은 반드시 JSON 형식만 사용하라.

라벨 정의:
- Profanity: 욕설, 비속어, 직접적인 모욕 표현. 단, 댓글이 의미 없는 욕설만으로 구성된 경우에는 SimpleProfanity로 분류한다.
- Politics: 정치 성향, 정치인, 정당, 이념에 대한 비하/혐오/조롱 표현
- Origin: 출신, 지역, 국가, 국적에 대한 비하 표현
- Physical: 외모, 체형, 신체 특징에 대한 비하 표현
- Age: 나이, 세대에 대한 비하 표현
- Gender: 성별에 대한 비하, 고정관념, 차별 표현
- Religion: 종교에 대한 비하, 혐오, 조롱 표현
- Race: 인종, 피부색, 민족에 대한 차별/혐오 표현
- SimpleProfanity : 댓글이 욕설, 비속어, 감탄형 욕설 중심으로만 구성되어 있으며, 조사/어미/감탄사/지시어를 제외했을 때 의미 있는 비난 대상이나 내용이 남지 않는 경우


판별 원칙:
- 반드시 댓글에 실제로 드러난 표현에 근거해서만 판단하라.
- 하나의 댓글에 여러 유형이 동시에 포함되면 모두 포함하라.
- 단순한 비판, 불만, 아쉬움, 의견 표현은 독성 라벨로 분류하지 마라.
- 특정 대상이 없고 공격성이 약한 일반 감탄/불만 표현은 과도하게 라벨링하지 마라.
- 욕설(Profanity)은 명확한 비속어, 욕 단어, 직접적인 모욕 표현이 포함된 경우에만 해당한다.
- 욕설 단어가 포함되지 않은 경우 Profanity로 분류하지 마라.
- "별로다", "수준이 낮다", "할 짓 없어 보인다", "실망이다" 등은 욕설이 아니다.
- 욕설이 성별, 나이, 종교, 출신, 인종 등 특정 속성에 대한 비하와 함께 쓰이면 Profanity와 해당 라벨을 모두 포함하라.
- 정치 관련 단어가 등장하더라도 단순 사실 언급이나 정책 비판이면 Politics로 분류하지 마라.
- 정치 성향/정당/정치인을 조롱하거나 비하할 때만 Politics로 분류하라.
- 나이를 단순히 언급하는 것은 Age가 아니다.
- 나이 또는 세대를 근거로 비하할 때만 Age로 분류하라.
- 성별을 단순히 언급하는 것은 Gender가 아니다.
- 성별을 근거로 능력, 성격, 행동을 일반화하거나 비하할 때만 Gender로 분류하라.
- 댓글이 욕설 중심으로만 구성되어 있고, 욕설을 제외했을 때 특정 대상, 상황, 주장, 평가 내용이 남지 않으면 SimpleProfanity로 분류하라.
- SimpleProfanity는 치환 사전을 통해 유희형 감탄사로 대체될 댓글을 구분하기 위한 라벨이다.
- SimpleProfanity에 해당하는 경우 Profanity는 함께 붙이지 말고 SimpleProfanity만 반환하라.
- 욕설이 포함되어 있더라도 특정 대상에 대한 평가, 비난, 조롱, 차별 의미가 함께 존재하면 Profanity로 분류하라.
- 애매할 경우 라벨을 붙이지 마라.

라벨 경계:
- Origin은 국가, 국적, 지역, 출신 집단에 대한 비하다.
- Race는 인종, 피부색, 민족적 정체성에 대한 비하다.
- 국가/국적 비하인지 인종/민족 비하인지 애매하면 문맥상 더 직접적인 라벨 하나만 선택하라.
- 외모/체형/얼굴/신체 특징을 비하하면 Physical로 분류하라.
- 단순히 "별로다", "아쉽다", "재미없다", "실망이다" 수준은 라벨 없음이다.


예시 1 (Origin)
댓글: "짱개들 지나간 곳은 폐허된다 ㅋㅋ"
출력:
{{"labels": ["Origin"]}}

예시 2 (Physical)
댓글: "밥맛없게생겼냐"
출력:
{{"labels": ["Physical"]}}

예시 3 (Politics)
댓글: "문재인 정권의 내로남불은 타의 추종을 불허하네."
출력:
{{"labels": ["Politics"]}}

예시 4 (Profanity)
댓글: "진짜 개멍청하네."
출력:
{{"labels": ["Profanity"]}}

예시 5 (Age)
댓글: "31살이 아이돌이래 미쳤나 기자"
출력:
{{"labels": ["Age"]}}

예시 6 (Gender)
댓글: "여자라서 저런가 수준이 좀 떨어지네."
출력:
{{"labels": ["Gender"]}}

예시 7 (Race)
댓글: "일본인이 우수하고 남조선인이 미개한건 사실 맞죠."
출력:
{{"labels": ["Race"]}}

예시 8 (Religion)
댓글: "개독교는 대한민국의 암적인 존재다"
출력:
{{"labels": ["Religion"]}}

예시 9 (multi label)
댓글: "여자라서 저런가 진짜 멍청하네."
출력:
{{"labels": ["Gender", "Profanity"]}}

예시 10 (not hate)
댓글: "오늘 영상은 기대보다 좀 아쉽네요."
출력:
{{"labels": []}}

예시 11 (SimpleProfanity)
댓글: "씨발ㅋㅋㅋㅋ"
출력:
{{"labels": ["SimpleProfanity"]}}

예시 12 (SimpleProfanity)
댓글: "존나 ㅋㅋㅋㅋ"
출력:
{{"labels": ["SimpleProfanity"]}}

예시 13 (Profanity)
댓글: "진짜 개멍청하네."
출력:
{{"labels": ["Profanity"]}}

예시 14 (Profanity)
댓글: "저 사람 하는 짓이 진짜 병신 같네."
출력:
{{"labels": ["Profanity"]}}

이제 아래 댓글을 분류하라.

댓글:
"{text}"

반드시 JSON 형식으로만 답하라.
설명, 이유, 마크다운 코드블록은 절대 포함하지 마라.

출력 형식:
{{"labels": ["라벨1", "라벨2"]}}
"""
        response = await self.client.responses.create(
            model=self.model_name,
            input=prompt
        )

        output_text = response.output_text.strip()
        result = json.loads(output_text)

        if "labels" not in result or not isinstance(result["labels"], list):
            raise ValueError("Invalid response format: 'labels' must be a list.")

        allowed_labels = {
            "Profanity",
            "Politics",
            "Origin",
            "Physical",
            "Age",
            "Gender",
            "Religion",
            "Race",
            "SimpleProfanity",
        }

        cleaned_labels = [
            label for label in result["labels"]
            if label in allowed_labels
        ]

        return {
            "labels": cleaned_labels
        }