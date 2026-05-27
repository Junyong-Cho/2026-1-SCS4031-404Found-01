from fastapi import FastAPI
import uvicorn
from pydantic import BaseModel, Field
from main import refine_comment#, ToxicClassificationError

class RequestCommentDto(BaseModel) :
    id : str
    text : str

class ResponseCommentDto(BaseModel) :
    id : str
    isToxic : bool = False
    # toxicType : str = '' # 기존: "Politics|Origin|Profanity" 형태
    # toxicTypes: list[str] = Field(default_factory=list) # 평가/디버깅용: ["Politics", "Origin", "Profanity"] 형태
    convertedText : str | None = None
    # 평가/디버깅용
    # processType: str = "" # dictionary_replacement / llm_refinement / pass 구분용 필드
    # originalText: str | None = None

app = FastAPI()

@app.get('/')
def index_page() :
    return 'index page'

@app.post('/request', response_model = ResponseCommentDto)
async def cleaning_comment(dto : RequestCommentDto) :
    print('일단 요청 도착')

    try :
        refined = await refine_comment(dto.text)

        response = ResponseCommentDto(
            id = dto.id,
            isToxic = refined["toxic_result"]["is_toxic"]
        )

        if response.isToxic :
            response.convertedText = refined["refined_text"]

        return response
    except Exception as e:
        return None
        



# 비동기 호출 용 / 댓글 1개 즉시 return 하는 구조

# @app.post('/request-one')
# def cleaning_one_comment(comment: ReqComment):

#     res = ResComment(id=comment.id, originalText=comment.text)

#     try:
#         refined = refine_comment(comment.text)

#         is_toxic = refined["toxic_result"]["is_toxic"]

#         labels = refined.get("labels", [])
#         process_type = refined.get("process_type", "")

#         res.isToxic = is_toxic
#         res.toxicType = "|".join(labels)
#         res.toxicTypes = labels
#         res.processType = process_type

#         if is_toxic:
#             res.convertedText = refined["refined_text"]

#     except ToxicClassificationError as e:

#         res.isToxic = True
#         res.toxicType = "ClassificationError"
#         res.toxicTypes = []
#         res.convertedText = "악플 판단에 실패한 댓글입니다."
#         res.processType = "toxic_classification_error"

#         print("독성 판단 실패")
#         print("원문 " + comment.text)
#         print("에러 " + str(e))

#         return res
    
    
#     return ResponseCommentsDto(results = results, stats = stat)

uvicorn.run(app = app, host='0.0.0.0', port=8080)