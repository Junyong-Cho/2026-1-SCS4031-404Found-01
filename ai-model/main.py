#main.py

import os
from dotenv import load_dotenv
from openai import OpenAI
import pandas as pd

from models.label_classifier import LabelClassifier
from models.refiner import Refiner
from models.toxic_classifier import ToxicClassifier


def load_bad_words(csv_path: str):
    df = pd.read_csv(csv_path)
    return df["raw_word"].dropna().astype(str).tolist()


def replace_simple_profanity(text: str, bad_words: list):
    refined_text = text

    for bad_word in bad_words:
        if bad_word in refined_text:
            refined_text = refined_text.replace(bad_word, "치환")

    if refined_text == text:
        refined_text = "치환"

    return {
        "original_text": text,
        "refined_text": refined_text,
        "process_type": "dictionary_replacement"
    }


load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

classifier = LabelClassifier(
    client=client,
    model_name="gpt-5.4-mini"
)

refiner = Refiner(
    client=client,
    model_name="gpt-5.4-mini"
)

toxic_classifier = ToxicClassifier(
    client=client,
    model_name="gpt-5.4-mini"
)

bad_words = load_bad_words("models/profanityDict_result_v2.csv")


def refine_comment(comment: str):
    toxic_result = toxic_classifier.predict(comment)

    if not toxic_result["is_toxic"]:
        return {
            "original_text": comment,
            "refined_text": comment,
            "process_type": "no_filter",
            "labels": [],
            "toxic_result": toxic_result
        }

    label_result = classifier.predict(comment)
    labels = label_result.get("labels", [])

    if "SimpleProfanity" in labels:
        final_result = replace_simple_profanity(comment, bad_words)

    elif len(labels) > 0:
        final_result = refiner.refine(comment)
        final_result["process_type"] = "llm_refinement"

    else:
        final_result = {
            "original_text": comment,
            "refined_text": comment,
            "process_type": "no_filter"
        }

    final_result["labels"] = labels
    final_result["toxic_result"] = toxic_result

    return final_result


def main():
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

    for comment in test_comments:
        result = refine_comment(comment)

        print("=" * 50)
        print("댓글:", result["original_text"])
        print("독성여부:", result["toxic_result"])
        print("분류:", result["labels"])
        print("처리방식:", result["process_type"])
        print("결과:", result["refined_text"])


if __name__ == "__main__":
    main()