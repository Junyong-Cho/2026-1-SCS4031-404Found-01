# main.py

import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

from models.label_classifier import LabelClassifier
from models.refiner_v2 import Refiner
from models.toxic_classifier import ToxicClassifier
from models.replacer import (
    load_bad_words,
    replace_bad_words
)


load_dotenv()

client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

classifier = LabelClassifier(
    client=client,
    model_name="gpt-4o-mini"
)

refiner = Refiner(
    client=client,
    model_name="gpt-5.4-mini"
)

toxic_classifier = ToxicClassifier(
    client=client,
    model_name="gpt-4o-mini"
)

bad_words = load_bad_words(
    "models/profanityDict_result_v2.csv"
)


async def refine_comment(comment: str):

    # 1. 욕설 사전 치환
    replace_result = replace_bad_words(
        comment,
        bad_words
    )

    replaced_comment = replace_result["refined_text"]

    # 2. 치환된 댓글으로 GPT 판별·분류·정화
    toxic_result = await toxic_classifier.predict(
        replaced_comment
    )

    # non-toxic → 사전 치환 결과 반환 (모든 댓글은 사전을 통과함)
    if toxic_result["label"] == "non-toxic":

        return {
            "original_text": comment,
            "refined_text": replaced_comment,
            "process_type": (
                "dictionary_replacement"
                if replace_result["matched"]
                else "pass"
            ),
            "labels": [],
            "label_status": "not_executed",
            "label_error": "",
            "toxic_result": toxic_result
        }

    # toxic → 치환된 댓글 기준 라벨링
    label_info = await classifier.predict(
        replaced_comment
    )

    labels = label_info["labels"]

    label_status = (
        label_info["label_status"]
    )

    label_error = (
        label_info["label_error"]
    )

    # 의미 없는 단순 욕설 (SimpleProfanity)
    # 1차 치환 후에도 SimpleProfanity로 분류된 경우
    # 일단 남아 있는 변형 욕설을 LLM으로 "아잉❤️" 치환 (추후 치환사전 로직 추가 수정 계획중)
    if "SimpleProfanity" in labels:

        final_result = await refiner.replace_remaining_simple_profanity(
            replaced_comment
        )
        final_result["original_text"] = comment
        final_result["dictionary_refined_text"] = replaced_comment
        final_result["process_type"] = (
            "simple_profanity_llm_replacement"
        )

    # 그 외 toxic → 치환된 댓글을 Refiner 입력으로 정화
    elif len(labels) > 0:

        final_result = await refiner.refine(
            replaced_comment,
            labels
        )

        final_result["original_text"] = comment
        final_result["process_type"] = (
            final_result.get(
                "process_type",
                "llm_refinement"
            )
        )

    # 라벨링 실패 fallback
    else:

        final_result = await refiner.refine(
            replaced_comment,
            labels
        )

        final_result["original_text"] = comment
        final_result["process_type"] = (
            final_result.get(
                "process_type",
                "llm_refinement_type_label_error"
            )
        )

    final_result["labels"] = labels

    final_result["label_status"] = (
        label_status
    )

    final_result["label_error"] = (
        label_error
    )

    final_result["toxic_result"] = (
        toxic_result
    )

    return final_result


async def main():

    # 테스트용
    test_comments = [
        "너네나라가! 탄김치야!",
        "그래봤자 늙은 할머니 짱깨",
        "개독과 미친x 목둥이가 답",
        "돼지가 삶은 소대가리가 웃겠다며 빠져라 하지 않았나??돼지가 노할텐데~",
        "좌좀 홍어들이 일베보다 더 극혐이다",
        "ㅋㅋ 떡잎부터 한남새기들 다 거세시켜라",
        "그러니 짱개헥히라고 부르는거여 정신뱅자 멸족들아",
        "저 코리안 황인종 화상들~~ 니미 뭐하러 백인들 성지에 가서 빙신취급받고 다니냐??",
        "열폭 돼지녀들 출동!!!",
        "진짜 흑자같은 사람이 있어야해, 이 시대엔 사기꾼들이 너무 많아",
        "0:08 죽일 생각까지는 없었는데...",
        "진짜 흑자같은 사람이 있어야해, 이 시대엔 사기꾼들이 너무 많아",
        "아니 콘텐츠담당관 또 너야!",
        "팔로알토 보고 온 사람 개추 ㅋㅋ",
        "ㅋㅋ 아무래도 용 필 믿는 소수의 지지자들은 능지가..",
        "무슨 악마를 보았다 보는 줄 알았네 ㅋㅋㅋㅋㅋㅋㅋ “누구 다리에 걸려서 넘어진 거 같은데?” 하면서 씩 웃는 거 개소름 ㅋㅋㅋㅋㅋ 사패인가",
        # "하여튼 방구석 아낙들 일이란 왜 이리도 한심하기 짝이 없을까? ㅉㅉ 줌탱들 가십거리하나 늘었다고 신났네 남편애들저녁은 하고 댓글달고 있는건지",
        # "와 이거 완전 재앙이네. 깨끗한 나라 만든다면서 왜 이런 사건이 터지냐??",
        # "몬생긴 여자인간들은 찌그러져있어라 확그냥 막그냥",
        # "오면 화염병 던진다 돼지새키야",
        # "수꼴틀딱시키들이 다 디져야 나라가 똑바로 될것같다..답이 없는 종자들ㅠ",
        # "ㅇㅇ? 양놈이건 깜씨건 뭔 아방가르드하네",
        # "OOO천지 개독교 새끼들아 다 착해져라!",
        # "다들 오지랖 좀...되게 할 짓 없어보여요",
        # "연기못하는 방구쟁이년",
        # "뚱보끼린 뭔가 잘맞는게 있나보네",
        # "씨발",
    ]

    results = await asyncio.gather(
        *(
            refine_comment(comment)
            for comment in test_comments
        )
    )

    for result in results:
        print("=" * 50)
        print(
            "댓글:",
            result["original_text"])
        print(
            "독성여부:",
            result["toxic_result"])
        print(
            "분류:",
            result["labels"])
        print(
            "처리방식:",
            result["process_type"])
        print(
            "결과:",
            result["refined_text"])


if __name__ == "__main__":
    asyncio.run(main())