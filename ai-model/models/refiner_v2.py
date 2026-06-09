# refiner_v2.py

# 기존 refiner.py의 후보 생성 & 자가진단 삭제
# 원문 의미 보존에도 신경 쓰도록 프롬프팅 수정

import json
from typing import Optional
from openai import AsyncOpenAI

SAFE_MASKING_TEXT = (
    "공격적 표현이 많아 일부 내용을 숨겼습니다. 원문은 ‘원문 보기’버튼을 통해 확인할 수 있습니다."
)


class Refiner:
    def __init__(self, client: AsyncOpenAI, model_name: str):
        self.client = client
        self.model_name = model_name

    async def refine(
        self,
        text: str,
        labels: Optional[list[str]] = None,  # 라벨링 결과를 정화기에 넘겨서 hint로 사용할 수 있도록 추가
    ) -> dict:
        labels = labels or []
        labels_hint = ", ".join(labels) if labels else "없음"
        prompt = f"""
너는 한국어 온라인 댓글을 '원문의 주제와 불만 방향은 유지하면서,
공격성과 혐오 표현만 완화하는'
문장 정제기다.

[처리 방식 우선 결정]

정화문을 만들기 전에 반드시 원문의 의미를 구체적으로 이해한 후, 정화 가능성 판단 결과에 따라 process_type을 먼저 결정하라.

1. 기본값은 항상 "llm_refinement"이다.
- 욕설, 조롱, 인신공격, 비난, 비꼼, 감정적 표현이 강하더라도, 원문의 대상과 불만 방향을 대략 파악할 수 있으면 반드시 정화한다.
- 단순히 표현이 거칠거나 공격적이라는 이유만으로 safe_masking을 선택하지 마라.


2. 아래에 해당하면 process_type은 "safe_masking"(자연스러운 정화 대신 고정 안내문)이다.
- 문장 구조가 심하게 불명확해, 의미 있는 주장·대상·상황을 거의 파악할 수 없고, 욕설/은어/초성/비하 표현만 파편적으로 나열된 경우
- 특정 보호 집단 또는 인구집단 전체에 대한 배척, 비인간화, 폭력 선동, 인종개량·말살·추방 등 제거 지향 표현이 핵심 의미인 경우
- 혐오 표현 자연스러운 비판문으로 바꿀 최소한의 대상/불만 방향도 없는 경우
- 정화문을 만들기 위해 원문에 없는 주어, 이유, 주장, 해설을 다량 추가해야 하는 경우

3. 위 조건에 해당하지 않을 때는 process_type을 그대로 "llm_refinement"로 두고 refined_text를 생성하라.

4. safe_masking인 경우 refined_text는 빈 문자열로 두고, mask_reason은 아래 중 하나로 작성하라.
- "low_context": 문장 구조가 불명확해 의미를 파악할 수 없는 경우
- "unsafe_to_preserve": 핵심 의미 자체가 원색적 혐오라, 원문 의미를 보존해도 심한 혐오가 남고, 혐오를 제거하면 의미가 거의 사라지는 경우

목표:
- 우선 원문의 의미를 구체적으로 이해한다.
- 원댓글 자리에 그대로 들어갈 수 있는 자연스러운 댓글로 다시 쓴다.
- 욕설, 혐오 표현, 인신공격, 조롱 표현은 부드럽게 완화한다.
- 공격적 감정 표현은 최대한 줄이되, 원문의 핵심 대상, 주장, 불만 방향은 가능한 유지하라.
- 조롱, 혐오, 멸시 느낌이 남지 않도록 어조를 완화하라.
- 이미 "아잉❤️"으로 치환된 단어는 그대로 둔다.
- 원문에 띄어쓰기 오류, 붙여쓰기, 초성 변형, 욕설 변형이 있을 수 있다. 정화 전에 먼저 문장의 의미 단위를 추정해 문맥을 파악하라.

금지 규칙:
- 원문의 주제가 사라지거나 의미가 왜곡되면 안 된다.
- 원문에 없는 충고, 훈계, 해설을 추가하지 마라.
- 원문의 의미상 존재하지 않는 내용을 추가하지 마라.

정화 원칙:
1. 우선 원문의 의미를 구체적으로 이해한다.
2. 원문의 핵심 주장과 의도는 유지한다.
3. 욕설, 비하, 조롱, 공격적 어조는 최대한 완화한다.
4. 비판은 가능하지만, 조롱 및 인신공격은 제거한다. 
5. 최종 결과는 자연스러운 한 문장이어야 한다.
6. 의미를 지나치게 순화느라 완전히 다른 의견으로 바꾸지 마라.

safe_masking (자연스러운 정화 대신 고정 안내문):
다음 댓글은 자연스러운 정화문을 만들지 말고 safe_masking으로 처리하라.

1. 문장 구조가 심하게 불명확하고 욕설, 은어, 초성, 비하 표현이 나열된 경우
2. 특정 보호 집단 또는 인구집단 전체에 대한 배척, 비인간화, 폭력 선동, 인종개량·말살·추방 등 제거 지향 표현이 핵심 의미인 경우
3. 혐오 표현을 자연스러운 비판문으로 바꿀 최소한의 대상/불만 방향도 없는 경우

이 경우 JSON에 process_type을 "safe_masking"으로, mask_reason을 아래 중 하나로 넣는다.
- low_context: 1번에 해당
- unsafe_to_preserve: 2번 또는 3번에 해당
refined_text는 빈 문자열로 둔다.

유형 힌트(참고용):
- 아래 라벨은 독성 유형 분류기의 참고 결과다. 정답으로 단정하지 말고 문맥 해석에 함께 활용하라.
- 분류 라벨: {labels_hint}
- 라벨이 있으면 해당 유형의 공격성/차별 요소를 우선 완화하라.
- 라벨이 없거나 애매하면 원문 문맥 기준으로 정화하라.

출력 규칙:
- safe_masking이 아니면 정화된 댓글 1개만 생성한다.
- 자연스러운 한국어 댓글 톤으로 쓴다.
- 너무 공손하거나 딱딱하게 쓰지 않는다.
- 원문보다 지나치게 길어지지 않게 한다.
- 반드시 JSON만 출력한다.

예시 1
원문: "세 명 진짜 없어보이고 질 떨어져 보인다"
출력:
{{
    "process_type": "llm_refinement",
    "refined_text": "세 명 모두 행동이 조금 없어 보이고 수준이 다소 아쉬워 보입니다."
}}

예시 2
원문: "그냥 저 나이 먹고 저딴짓 하고 있는 것도 싫은데 그 돈은 지가 능력있어서 번 것도 아닌데다가 자기관리 안해서 심각한 비만이고 인성은 개뿔도 없는 게 맘에 안들어서 이제 그냥 무슨 짓을 하든 싫음ㅋㅋㅋ"
출력:
{{
    "process_type": "llm_refinement",
    "refined_text": "나이에 맞지 않는 행동처럼 보이고, 경제적 성과나 자기관리, 태도 면에서도 아쉬운 점이 많아 보여서 이제는 어떤 행동을 해도 긍정적으로 보이지 않습니다."
}}

예시 3
원문: "또라이같은 개독들 진짜 노답이다..."
출력:
{{
    "process_type": "llm_refinement",
    "refined_text": "일부 기독교인들의 극단적인 태도는 정말 이해하기 어렵습니다."
    }}

예시 4
원문: "수준 진짜 처참하네 ㅋㅋ"
출력:
{{
    "process_type": "llm_refinement",
    "refined_text": "수준이 조금은 아쉽네요."
}}

예시 5
원문: "틀딱할배들 여기서 기차놀이 하고 있노;;;"
출력:
{{
    "process_type": "llm_refinement",
    "refined_text": "일부 나이 드신 분들이 여기서 이런 행동을 하는 모습은 보기 불편합니다."
}}

예시 6
원문: "야 아나 머하냐? 쫌있으면 28이다 여자나이 28이면 다된거지 뭘 헛소리하고잇노 ㅉㅉ"
출력:
{{
    "process_type": "llm_refinement",
    "refined_text": "이제 곧 28살인데 현실적인 고민이 필요해 보입니다. 약간 상황에 맞지 않는 말을 하시는 것 같이 들려요."
}}

예시 7
원문: "돼지똘만이재앙이탄핵좃불들어라 범국민? 지롤하네 홍어들이"
출력:
{{
  "process_type": "safe_masking",
  "mask_reason": "low_context"
  "refined_text": ""
}}

예시 8
원문: "주적 북졷 맞아 미필 상ㅢ폐 불고기 걸레 3040. 문창년들아"
출력:
{{
  "process_type": "safe_masking",
  "mask_reason": "low_context"
  "refined_text": ""
}}


예시 9
원문: "똥양인들은 서양녀를 만나 인종개량이 시급하다"
출력:
{{
  "process_type": "safe_masking",
  "mask_reason": "unsafe_to_preserve",
  "refined_text": ""
}}

예시 10
원문: "사패인가 진짜 웃는 거 개소름"
출력:
{{
    "process_type": "llm_refinement", 
    "refined_text": "웃는 듯한 반응이 보여서 꽤 섬뜩한 기분이 드네요."
}}

예시 11
원문: "OO 얘는 깝깝하고 텁텁하고 무겁고 질퍽하고 꿉꿉하고 눅눅하고...."
출력:
{{
    "process_type": "llm_refinement", 
    "refined_text": "OO은(는) 전반적으로 답답하고 무겁고 찝찝하게 느껴지는 면이 있네요."
}}

예시 12
원문: "하나같이 콩밥 ㅊ먹어도 될만한 애들이군 근디 그 가족사기단 양팡?앙팡? 걔는없네"
출력:
{{
    "process_type": "llm_refinement",
    "refined_text": "다들 법적 책임을 져도 이상하지 않아 보이는 사람들이네요. 그런데 그 가족 사기 논란이 있던 양팡(?)은 없네요."
}}

예시 13
원문: "경계성지능 OO"
출력: 
{{
  "process_type": "llm_refinement",
  "refined_text": "OO은(는) 판단력이 다소 아쉬워 보입니다."
}}

예시 14
원문: "나도 울어봐? 다리에 걸려 넘어져?? 미친연아 라이브에 면상도 보이지 마라."
해석: 상대의 상황/해명을 비꼬며 라이브에서 보고 싶지 않다고 비난하는 댓글이다.
출력:
{{
  "process_type": "llm_refinement",
  "refined_text": "'나도 울어본다거나, 다리에 걸려 넘어진다'는 등, 그 상황에 대한 반응이나 해명이 불편하게 느껴져서 앞으로 라이브에서 보고 싶지 않을 정도였습니다."
}}

예시 15
원문: "걸려서 넘어진것 같은데~~? 할때 진심 사람이 이렇게 징그러울수있나 싶었음......"
해석: 그 사람이 넘어짐을 언급하는 말투나 태도가 너무 불쾌하고 섬뜩하게 느껴졌다
출력: 
{{
  "process_type": "llm_refinement",
  "refined_text": "'걸려서 넘어진 것 같은데?'라고 말하는 장면이 너무 불편하고 섬뜩하게 느껴졌습니다."
}}

원문:
"{text}"
"""

        response = await self.client.responses.create(
            model=self.model_name,
            input=prompt,
            temperature=0.1,
        )

        output_text = response.output_text.strip()

        # 혹시라도 코드블록으로 감싸져 오면 제거
        if output_text.startswith("```"):
            output_text = output_text.strip("`")
            output_text = output_text.replace("json", "", 1).strip()

        try:
            result = json.loads(output_text)
        except json.JSONDecodeError:
            return {
                "original_text": text,
                "refined_text": text,
                "process_type": "fallback_raw" # 모델 출력이 JSON이 아님 -> 들어온 대로 내뱉음
            }

        if result.get("process_type") == "safe_masking":
            mask_reason = str(
                result.get("mask_reason", "")
            ).strip()
            if mask_reason not in ("low_context", "unsafe_to_preserve"):
                mask_reason = "unsafe_to_preserve"
            return {
                "original_text": text,
                "refined_text": SAFE_MASKING_TEXT,
                "process_type": "safe_masking",
                "mask_reason": mask_reason,
            }

        refined_text = str(result.get("refined_text", "")).strip()

        if not refined_text:
            return {
                "original_text": text,
                "refined_text": text,
                "process_type": "fallback_empty" # JSON은 맞는데 정화가 안됨 -> 들어온 대로 내뱉음
            }

        return {
            "original_text": text,
            "refined_text": refined_text,
        }

    async def replace_remaining_simple_profanity(
        self,
        text: str
    ) -> dict:
        prompt = f"""
너는 한국어 온라인 댓글에서 남아 있는 단순 욕설만 유희형 표현으로 치환하는 정제기다.

상황:
- 이 댓글은 이미 1차 욕설 사전 치환을 거친 문장이다.
- 그런데도 SimpleProfanity로 분류되었으므로, 아직 사전에 잡히지 않은 변형 욕설이나 비속어가 남아 있을 수 있다.
- 이 댓글은 의미 있는 주장이나 비판보다 욕설, 감탄형 비속어, 웃음, 기호, 조사, 어미 중심의 댓글이다.

목표:
- 남아 있는 욕설, 비속어, 변형 욕설, 초성 욕설, 특수문자 섞인 욕설 등을 "아잉❤️"으로 치환한다.
- 이미 "아잉❤️"으로 치환된 부분은 그대로 둔다.
- ㅋㅋ, ㅎㅎ, ㅠㅠ, 느낌표, 물음표, 말줄임표 같은 감정 표현이나 문장부호는 자연스럽게 유지해도 된다.
- 의미 있는 새로운 문장으로 바꾸지 마라.
- 충고, 훈계, 해설을 추가하지 마라.
- 댓글 자리에 그대로 들어갈 수 있는 짧고 자연스러운 결과만 만든다.

치환 기준:
- 욕설 또는 비속어로 보이는 부분만 "아잉❤️"으로 바꾼다.
- 욕설이 여러 개 남아 있으면 각각 "아잉❤️"으로 바꾼다.
- 욕설이 아닌 웃음, 기호, 조사, 어미는 가능한 유지한다.
- 단, 전체가 욕설 변형뿐이라면 결과를 "아잉❤️" 중심으로 간단히 만든다.

출력 규칙 :
- 설명·마크다운 금지, 반드시 JSON 형식으로 답하라

예시 1
입력: "씨이이발ㅋㅋ"
출력:
{{
  "original_text": "씨이이발ㅋㅋ",
  "refined_text": "아잉❤️ㅋㅋ"
}}

예시 2
입력: "아잉❤️ ㅅ@ㅂㅋㅋ"
출력:
{{
  "original_text": "아잉❤️ ㅅ@ㅂㅋㅋ",
  "refined_text": "아잉❤️ 아잉❤️ㅋㅋ"
}}

예시 3
입력: "벼어어엉신 같네"
출력:
{{
  "original_text": "벼어어엉신 같네",
  "refined_text": "아잉❤️ 같네"
}}

예시 4
입력: "ㅅ@ㅂ 진짜"
출력:
{{
  "original_text": "ㅅ@ㅂ 진짜",
  "refined_text": "아잉❤️ 진짜"
}}

이제 아래 댓글을 정제하라.

입력:
"{text}"

출력 형식:
{{
  "original_text": "입력 댓글",
  "refined_text": "정제된 댓글"
}}
"""

        response = await self.client.responses.create(
            model=self.model_name,
            input=prompt
        )

        output_text = response.output_text.strip()

        if output_text.startswith("```"):
            output_text = output_text.strip("`")
            output_text = output_text.replace("json", "", 1).strip()

        try:
            result = json.loads(output_text)
        except json.JSONDecodeError:
            return {
                "original_text": text,
                "refined_text": "아잉❤️",
                "process_type": "simple_profanity_llm_fallback"
            }

        refined_text = (
            result
            .get("refined_text", "")
            .strip()
        )

        if not refined_text:
            refined_text = "아잉❤️"

        return {
            "original_text": text,
            "refined_text": refined_text,
            "process_type": "simple_profanity_llm_replacement"
        }