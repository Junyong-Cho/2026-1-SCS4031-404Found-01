from fastapi import FastAPI
import uvicorn
from pydantic import BaseModel, ConfigDict
from main import refine_comment

class ReqComment(BaseModel) :
    id : str
    text : str

class RequestCommentsDto(BaseModel) :
    userSetting : str
    comments : list[ReqComment]

class ResComment(BaseModel) :
    id : str
    isToxic : bool = False
    toxicType : str = ''
    convertedText : str | None = None

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
def cleaing_comment(dto : RequestCommentsDto) :
    print('일단 요청 도착')

    total = len(dto.comments)
    stat = Stat(totalScanned = total)
    results = [None] * total

    for i in range(total) :
        comment = dto.comments[i]
        res = ResComment(id = comment.id)
        refined = refine_comment(comment.text)
        if refined['toxic_result']['is_toxic'] == True :
            stat.toxicCount += 1
            res.isToxic = True
            res.convertedText = refined['refined_text']
            print('독성 발견')
            print('원문 ' + comment.text)
            print('정화 ' + res.convertedText)
        results[i] = res
    
    return ResponseCommentsDto(results = results, stats = stat)

uvicorn.run(app = app, host='0.0.0.0', port=8080)