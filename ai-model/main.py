#main.py

import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI
import pandas as pd
import random

from models.label_classifier import LabelClassifier
from models.refiner import Refiner
from models.toxic_classifier import ToxicClassifier
from models.humor import replace_humor_words


  

def load_bad_words(csv_path: str):
    df = pd.read_csv(csv_path)
    return df["raw_word"].dropna().astype(str).tolist()


def replace_simple_profanity(text: str, bad_words: list):
    refined_text = text
    REPLACEMENT_WORDS = ["아잉❤️", "뀨❤️", "삐용⭐"]
    replacement = random.choice(REPLACEMENT_WORDS)

    matched = False  # 실제 치환이 확인 플래그

    for bad_word in sorted(bad_words, key=len, reverse=True):
        # 사전에 있는 긴 욕설부터 먼저 매칭 ex) 개병신 -> 개아잉❤️ 방지
        if bad_word and bad_word in refined_text:
            refined_text = refined_text.replace(bad_word, replacement)
            matched = True

    if not matched: # 매칭 안되면 문장 전체 치환
        refined_text = replacement

    return {
        "original_text": text,
        "refined_text": refined_text,
        "process_type": "dictionary_replacement"
    }


load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

classifier = LabelClassifier(
    client=client,
    #model_name="gpt-5.4-mini"
    model_name="gpt-4o-mini"
)

refiner = Refiner(
    client=client,
    model_name="gpt-4o-mini"
)

toxic_classifier = ToxicClassifier(
    client=client,
    model_name="gpt-4o-mini"
)

bad_words = load_bad_words("models/profanityDict_result_v2.csv")


async def refine_comment(comment: str):
    toxic_result = await toxic_classifier.predict(comment) # 독성 판단 실패 시 예외처리

    if toxic_result["label"] == "non-toxic":
        return {
            "original_text": comment,
            "refined_text": comment,
            "process_type": "pass",
            "labels": [],
            "label_status": "not_executed",
            "label_error": "",
            "toxic_result": toxic_result
        }

    label_info = await classifier.predict(comment) # toxic으로 분류된 경우에만 라벨링 수행. 실패하면 labels=[]로 반환됨

    labels = label_info["labels"]
    label_status = label_info["label_status"]
    label_error = label_info["label_error"]

    if "SimpleProfanity" in labels:
        final_result = replace_simple_profanity(comment, bad_words)
        final_result["process_type"] = "dictionary_replacement"

    elif len(labels) > 0:
        final_result = await refiner.refine(comment)
        final_result["process_type"] = final_result.get("process_type", "llm_refinement")

    else:
        final_result = await refiner.refine(comment)
        final_result["process_type"] = final_result.get("process_type", "llm_refinement_type_label_error")

    final_result["labels"] = labels
    final_result["label_status"] = label_status
    final_result["label_error"] = label_error
    final_result["toxic_result"] = toxic_result

    return final_result

#humor 모드
async def humor_comment(comment: str):

    toxic_result = await toxic_classifier.predict(comment)

    if toxic_result["label"] == "non-toxic":
        return {
            "original_text": comment,
            "refined_text": comment,
            "process_type": "pass",
            "labels": [],
            "label_status": "not_executed",
            "label_error": "",
            "toxic_result": toxic_result
        }

    label_info = await classifier.predict(comment)

    labels = label_info["labels"]
    label_status = label_info["label_status"]
    label_error = label_info["label_error"]

    final_result = replace_humor_words(
        comment,
        bad_words
    )

    final_result["labels"] = labels
    final_result["label_status"] = label_status
    final_result["label_error"] = label_error
    final_result["toxic_result"] = toxic_result

    return final_result

async def main():
    #테스트용
    test_comments = [
        "좌좀 홍어들이 일베보다 더 극혐이다",
        "와 이거 완전 재앙이네. 깨끗한 나라 만든다면서 왜 이런 사건이 터지냐??",
        "몬생긴 여자인간들은 찌그러져있어라 확그냥 막그냥",
        "오면 화염병 던진다 돼지새키야",
        "수꼴틀딱시키들이 다 디져야 나라가 똑바로 될것같다..답이 없는 종자들ㅠ",
        "ㅇㅇ? 양놈이건 깜씨건 뭔 아방가르드하네",
        "OOO천지 개독교 새끼들아 다 착해져라!",
        "다들 오지랖 좀...되게 할 짓 없어보여요",
        "연기못하는 방구쟁이년",
        "뚱보끼린 뭔가 잘맞는게 있나보네",
        "씨발",
    ]

    #for comment in test_comments:
    #    result = await refine_comment(comment)

    results = await asyncio.gather(
        *(refine_comment(comment) for comment in test_comments)
    )

    for result in results:
        print("=" * 50)
        print("댓글:", result["original_text"])
        print("독성여부:", result["toxic_result"])
        print("분류:", result["labels"])
        print("처리방식:", result["process_type"])
        print("결과:", result["refined_text"])


if __name__ == "__main__":
    asyncio.run(main())