# replacer.py
# 1차로 치환사전과 매칭하는 파일

import random
import pandas as pd


REPLACEMENT_WORDS = [
    "아잉❤️ ",
]


def load_bad_words(csv_path: str):

    df = pd.read_csv(csv_path)

    return (
        df["raw_word"]
        .dropna()
        .astype(str)
        .tolist()
    )


def replace_bad_words(text: str, bad_words: list):

    original_text = text
    refined_text = text

    replaced = False

    replacement_word = random.choice(
        REPLACEMENT_WORDS
    )

    # 긴 욕설 우선 매칭
    for bad_word in sorted(
        bad_words,
        key=len,
        reverse=True
    ):

        if (
            bad_word
            and bad_word in refined_text
        ):

            refined_text = refined_text.replace(
                bad_word,
                replacement_word
            )

            replaced = True

    return {
        "original_text": original_text,
        "refined_text": refined_text,
        "matched": replaced,
        "process_type": (
            "dictionary_replacement"
            if replaced
            else "no_replacement"
        )
    }


# 테스트용
if __name__ == "__main__":

    bad_words = load_bad_words(
        "profanityDict_result_v2.csv"
    )

    test_comments = [
        "씨발 미친 너무 예쁜 여성이다",
        "병신 같은 소리하네",
        "개새끼야 진짜",
        "시 이 이 발",
        "오늘 날씨 좋다",
    ]

    for comment in test_comments:

        result = replace_bad_words(
            comment,
            bad_words
        )

        print("=" * 50)
        print("원문:", result["original_text"])
        print("결과:", result["refined_text"])
        print("매칭여부:", result["matched"])
        print("처리방식:", result["process_type"])