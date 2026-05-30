from fastapi import FastAPI
import uvicorn
from pydantic import BaseModel, Field

from main import refine_comment
from models.toxic_classifier import ToxicClassificationError

class ReqComment(BaseModel) :
    id : str
    text : str

class RequestCommentsDto(BaseModel) :
    userSetting : str
    comments : list[ReqComment]

class ResComment(BaseModel) :
    id : str
    isToxic : bool = False
    toxicType : str = '' # 기존: "Politics|Origin|Profanity" 형태
    toxicTypes: list[str] = Field(default_factory=list) # 평가/디버깅용: ["Politics", "Origin", "Profanity"] 형태
    convertedText : str | None = None
    # 평가/디버깅용
    processType: str = "" # dictionary_replacement / simple_profanity_llm_replacement/ llm_refinement / safe_masking / pass 구분용 필드
    maskReason: str = "" # safe_masking 전용: low_context / unsafe_to_preserve
    originalText: str | None = None

class Stat(BaseModel) :
    toxicCount : int = 0
    totalScanned : int

class ResponseCommentsDto(BaseModel) :
    results : list[ResComment]
    stats : Stat

app = FastAPI()

@app.get('/')
def index_page() :
    return 'index page'

@app.post('/request', response_model = ResponseCommentsDto)
async def cleaing_comment(dto : RequestCommentsDto) :
    print('일단 요청 도착')

    total = len(dto.comments)
    stat = Stat(totalScanned = total)
    results = [None] * total

    for i in range(total):
        comment = dto.comments[i]
        res = ResComment(id=comment.id, originalText=comment.text)

        try:
            refined = await refine_comment(comment.text)

            is_toxic = refined["toxic_result"]["is_toxic"]

            labels = refined.get("labels", [])
            process_type = refined.get("process_type", "")

            res.isToxic = is_toxic
            res.toxicType = "|".join(labels)
            res.toxicTypes = labels
            res.processType = process_type
            res.maskReason = refined.get("mask_reason", "")

            if is_toxic:
                stat.toxicCount += 1
                res.convertedText = refined["refined_text"]

        except ToxicClassificationError as e:
            res.isToxic = True # 독성 판단 실패 시 원문 노출 방지
            res.toxicType = "ClassificationError" 

            res.toxicTypes = []
            res.convertedText = "악플 판단에 실패한 댓글입니다." # 독성 판단 실패 시 정화하지 않고 고정 안내문 출력

            res.processType = "toxic_classification_error" # 평가에서 별도 제외/집계할 수 있도록 처리 타입 기록

            stat.toxicCount += 1 # 차단된 댓글이므로 toxicCount++

            print("독성 판단 실패")
            print("원문 " + comment.text)
            print("에러 " + str(e))

        results[i] = res

    return ResponseCommentsDto(results=results, stats=stat)


# 비동기 호출 용 / 댓글 1개 즉시 return 하는 구조

@app.post('/request-one', response_model=ResComment)
async def cleaning_one_comment(comment: ReqComment):

    res = ResComment(id=comment.id, originalText=comment.text)

    try:
        refined = await refine_comment(comment.text)

        is_toxic = refined["toxic_result"]["is_toxic"]

        labels = refined.get("labels", [])
        process_type = refined.get("process_type", "")

        res.isToxic = is_toxic
        res.toxicType = "|".join(labels)
        res.toxicTypes = labels
        res.processType = process_type
        res.maskReason = refined.get("mask_reason", "")

        if is_toxic:
            res.convertedText = refined["refined_text"]

    except ToxicClassificationError as e:

        res.isToxic = True
        res.toxicType = "ClassificationError"
        res.toxicTypes = []
        res.convertedText = "악플 판단에 실패한 댓글입니다."
        res.processType = "toxic_classification_error"

        print("독성 판단 실패")
        print("원문 " + comment.text)
        print("에러 " + str(e))

    return res

uvicorn.run(app = app, host='0.0.0.0', port=8080)
