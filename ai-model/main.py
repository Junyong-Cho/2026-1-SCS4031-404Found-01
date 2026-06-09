# main.py

import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

from models.label_classifier import LabelClassifier
from models.refiner_v2 import Refiner, SAFE_MASKING_TEXT
from models.toxic_classifier import ToxicClassifier
from models.replacer import (
    load_bad_words,
    replace_bad_words
)
from models.PSR_checker import SemanticEvaluator

semantic_evaluator = SemanticEvaluator(threshold=0.5)

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

_SKIP_SEMANTIC_GATE = (
    "safe_masking",
    "fallback_raw",
    "fallback_empty",
)


async def apply_semantic_gate(
    reference_text: str,
    labels: list[str],
    refine_result: dict,
) -> dict:
    if semantic_evaluator.evaluate(
        reference_text,
        refine_result["refined_text"],
    )["semantic_pass"]:
        return refine_result

    second_result = await refiner.refine(
        text=reference_text,
        labels=labels,
    )

    second_process_type = second_result.get(
        "process_type",
        "llm_refinement",
    )

    if second_process_type in _SKIP_SEMANTIC_GATE:
        return second_result

    if semantic_evaluator.evaluate(
        reference_text,
        second_result["refined_text"],
    )["semantic_pass"]:
        return second_result

    return {
        "original_text": reference_text,
        "refined_text": SAFE_MASKING_TEXT,
        "process_type": "safe_masking",
        "mask_reason": "semantic_similarity_failed",
    }


async def refine_toxic_comment(
    reference_text: str,
    labels: list[str],
) -> dict:
    refine_result = await refiner.refine(
        text=reference_text,
        labels=labels,
    )

    process_type = refine_result.get(
        "process_type",
        "llm_refinement",
    )

    if process_type in _SKIP_SEMANTIC_GATE:
        return refine_result

    return await apply_semantic_gate(
        reference_text,
        labels,
        refine_result,
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

    # 그 외 toxic → 치환된 댓글을 Refiner 입력으로 정화 + 의미 유사도 검사
    elif len(labels) > 0:

        final_result = await refine_toxic_comment(
            reference_text=replaced_comment,
            labels=labels,
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

        final_result = await refine_toxic_comment(
            reference_text=replaced_comment,
            labels=labels,
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
        "그런 개나 소를 죄다 공기업 정규직 전환시켜버린 전 정부ㅠㅠ",
        # "똥양인들은 인종 개량해라. 시급하다.",
        # "너네나라가! 탄김치야!",
        "그래봤자 늙은 할머니 짱깨",
        # "개독과 미친x 목둥이가 답",
        "돼지가 삶은 소대가리가 웃겠다며 빠져라 하지 않았나??돼지가 노할텐데~",
        "좌좀 홍어들이 일베보다 더 극혐이다",
        "열폭 돼지녀들 출동!!!",
        # "진짜 흑자같은 사람이 있어야해, 이 시대엔 사기꾼들이 너무 많아",
        # "0:08 죽일 생각까지는 없었는데...",
        # "진짜 흑자같은 사람이 있어야해, 이 시대엔 사기꾼들이 너무 많아",
        # "아니 콘텐츠담당관 또 너야!",
        # "팔로알토 보고 온 사람 개추 ㅋㅋ",
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