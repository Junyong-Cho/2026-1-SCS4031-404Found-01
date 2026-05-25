#humor.py

# humor.py

import random
import pandas as pd


def load_bad_words(csv_path: str):
    df = pd.read_csv(csv_path)

    return (
        df["raw_word"]
        .dropna()
        .astype(str)
        .tolist()
    )


# 랜덤 치환용 유머 표현
HUMOR_WORDS = [
    "뀨",
    "아잉",
    "뿡",
    "에헴",
    "우왕",
    "빠밤",
    "헉스",
    "끼룩",
    "얍",
    "꺄항",
]


def replace_humor_words(text: str, bad_words: list):

    refined_text = text
    replaced = False

    for bad_word in bad_words:

        if bad_word in refined_text:

            humor_word = random.choice(HUMOR_WORDS)

            refined_text = refined_text.replace(
                bad_word,
                humor_word
            )

            replaced = True

    # 욕설 탐지 안 된 경우
    if not replaced:
        return {
            "original_text": text,
            "refined_text": text,
            "process_type": "humor_no_change"
        }

    return {
        "original_text": text,
        "refined_text": refined_text,
        "process_type": "humor_replacement"
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
        "오늘 날씨 좋다",
    ]

    for comment in test_comments:

        result = replace_humor_words(
            comment,
            bad_words
        )

        print("=" * 50)
        print("원문:", result["original_text"])
        print("결과:", result["refined_text"])
        print("처리방식:", result["process_type"])