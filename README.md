<div align="center">

# 💬 댓글세탁소

**AI 기반 유해 댓글 탐지 및 정화 시스템**<br>
크롬 확장 프로그램으로 유튜브 댓글을 실시간으로 정화합니다.

<br>

![Project](https://img.shields.io/badge/2026--1_CCD-404Found-white?style=flat-square&labelColor=white&color=white)
![Semester](https://img.shields.io/badge/2026.03_~_2026.06-gray?style=flat-square&labelColor=f5f5f5&color=f5f5f5&fontColor=555)

<br>

`#AI기반` &nbsp; `#크롬 확장 프로그램` &nbsp; `#건강한 온라인 환경`

</div>

<br>

## 👥 팀 소개

| 구분 | 성명 | 학번 | 소속학과 | 연계전공 | 이메일 |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 팀장 | 이은정 | 2021112383 | 산업시스템공학과 | 소프트웨어AI | etlee12@naver.com |
| 팀원 | 정예빈 | 2022112390 | 산업시스템공학과 | 소프트웨어AI | jeongyebin3@gamil.com |
| 팀원 | 조준용 | 2020111242 | 경찰행정학부 | 소프트웨어AI | junyong4510@gmail.com |
| 팀원 | 조현서 | 2022110269 | 통계학과 | 소프트웨어AI | hyun.cho0430@gmail.com |

- 🎓 **지도교수** 김민경 교수 · 동국대학교 소프트웨어AI 데이터사이언스 연계전공
- 🎓 **지도교수** 신연순 교수 · 동국대학교 컴퓨터 AI학부
- 💼 **멘토** 강성지 · 네이버클라우드
- 🧑‍💻 **조교** 최시은 · 동국대학교 컴퓨터 AI 학과 인공지능전공

<br>

## 📌 프로젝트 배경

| | 문제 | 설명 |
|:---:|:---:|---|
| 🚨 | **사이버 불링 증가** | 1인 미디어 시장 급성장과 함께 유튜브 크리에이터를 향한 악성 댓글 문제가 심각한 이슈로 대두 |
| ⚠️ | **기존 필터링의 한계** | 단순 키워드 차단·블라인드는 정당한 비판·개선 요구 등 유의미한 피드백까지 함께 소실 |
| 💡 | **해결 방안 필요** | 크리에이터의 정신적 스트레스를 방어하면서도 대중 여론을 정보 손실 없이 수용하는 기술 필요 |

> 본 프로젝트는 AI를 활용하여 **원문의 비판적 의도는 살리고 독성 표현만 중립적으로 순화**하는
> 실시간 크롬 확장 프로그램 솔루션을 제안합니다.

<br>

## 🎯 결과물 소개
 
### 1. 크롬 확장 프로그램
 
유튜브 댓글창에서 실시간으로 동작하는 확장 프로그램입니다.
 
- **댓글 정화 모드** — 클린 모드 활성화 시 아래 두 단계를 개별 설정할 수 있습니다.
 
| 단계 | 모드 | 설명 | 
|:---:|:---:|---|
| 1단계 | 🌫️ **Blur** | 유해 댓글을 블러 처리하여 내용을 숨김 |
| 2단계 | ✨ **Refined** | 정제된 표현으로 대체하여 건전한 환경을 조성 |
 
- **Google 로그인 후 사용 가능한 기능**
 
| 기능 | 설명 |
|:---:|---|
| 🚫 **맞춤 금지어 설정** | 한글·영문·숫자 1~10자, 최대 10개 등록 가능. 등록된 단어는 `'아잉 🩷'`으로 치환 |
| 📩 **의견 보내기** | 정화 결과에 대한 피드백을 태그와 함께 제출 |
 
- **실시간 통계** — 팝업 내에서 아래 수치를 실시간으로 확인할 수 있습니다.
 
| 항목 | 설명 |
|:---:|---|
| 📊 감지된 댓글 수 | 현재 페이지에서 탐지된 전체 댓글 수 |
| 🚨 감지된 악플 수 | 유해 댓글로 분류된 수 및 비율(%) |
 
<br>

### 2. 관리자 대시보드
 
크리에이터 및 운영자가 피드백 데이터를 모니터링하고 관리하는 웹 대시보드입니다.
 
| 기능 | 설명 |
|:---:|---|
| 📋 **피드백 목록** | 접수된 의견을 테이블로 조회. 날짜 범위·상태·태그·키워드로 필터링 및 정렬 |
| 🔄 **상태 관리** | 피드백별 확인 상태를 `미확인 / 확인완료`로 변경 |
| 🏷️ **태그별 분포 차트** | 오탐지·순화 어색함·의미 변형 등 태그별 도넛 차트로 시각화 |
| 🔢 **전체 요약** | 전체 접수 / 미확인 / 확인완료 건수를 실시간 집계 |
| 🔗 **영상 바로가기** | 피드백이 접수된 유튜브 영상으로 즉시 이동 |
 
<br>

## 🎬 시연 영상

<!-- 시연 영상 링크를 아래에 추가하세요 -->
> 📎 영상 링크: []

[![시연 영상 썸네일](assets/thumbnail.png)](https://youtube.com/링크를여기에입력)

<br>

## 🛠️ 기술 스택
 
**Frontend**
 
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome_Extension_Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
 
**Backend**
 
![ASP.NET Core](https://img.shields.io/badge/ASP.NET_Core_10.0-512BD4?style=flat-square&logo=.net&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-0089D6?style=flat-square&logo=microsoftazure&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
 
**AI**
 
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![OpenAI API](https://img.shields.io/badge/OpenAI_API-412991?style=flat-square&logo=openai&logoColor=white)
![Hugging Face Transformers](https://img.shields.io/badge/Hugging_Face_Transformers-FFD21E?style=flat-square&logo=huggingface&logoColor=black)
 
<br>

## 📁 주요 폴더 구조

```text
📁 2026-1-ccd-404found-01
├── 📁 ai-model                    # AI 모델 서버 (FastAPI)
│   ├── 📄 app.py                  
│   └── 📁 models                  # AI 유해성 탐지 및 순화 엔진
│       ├── 📄 label_classifier.py  
│       ├── 📄 refiner_v2.py      
│       └── 📄 toxic_classifier.py  
├── 📁 backend                     # 백엔드 메인 서버 (.NET C#)
│   └── 📁 MainServer/MainServer
│       ├── 📄 Program.cs        
│       ├── 📁 Controllers         # 클라이언트 API 요청 처리 핸들러
│       │   ├── 📄 AuthController.cs           
│       │   └── 📄 CleaningCommentsController.cs 
│       └── 📁 Dtos                # 데이터 전송 객체 (Data Transfer Object)
└── 📁 frontend                    # 크롬 확장 프로그램 (Vite 환경)
    └── 📁 src                     
        ├── 📁 background          # 백그라운드 서비스 워커 스크립트
        │   ├── 📄 auth.js         
        │   └── 📄 main.js        
        ├── 📁 content             # 웹페이지(유튜브 DOM) 직접 주입 스크립트
        │   ├── 📄 cleaner.js     
        │   └── 📄 injector.js    
        └── 📁 popup               # 팝업 대시보드 UI 영역
            ├── 📄 popup.html     
            └── 📁 js              
                ├── 📄 keywords.js 
                └── 📄 popup.js    
```                

<br>

## 🚀 설치 및 실행

### 1. 프로젝트 클론

```bash
git clone https://github.com/CSID-DGU/2026-1-CCD-404Found-01.git temp
cp -r temp/frontend .
rm -r -force temp
cd frontend
```

### 2. 빌드

**npm이 있는 경우**

```bash
npm install
npm run build
```

**Docker가 있는 경우**

```bash
docker run -it --rm -v .:/node -w /node node:24-alpine sh
npm install
npm run build
exit
docker rmi node:24-alpine
```

빌드 완료 시 `/frontend/dist` 폴더가 생성됩니다.

<br>

## 🧩 크롬 확장 프로그램 등록

| 단계 | 설명 |
|:---:|---|
| **1** | 크롬 주소창에 `chrome://extensions/` 입력 후 접속 |
| **2** | 우측 상단 **[개발자 모드]** 토글 활성화 |
| **3** | **[압축해제된 확장 프로그램을 로드합니다.]** 버튼 클릭 |
| **4** | `frontend/dist` 폴더 선택 및 업로드 |
| **5** | 확장 프로그램 목록에 **댓글세탁소** 등록 확인 |

등록 완료 후 유튜브 동영상 페이지에 접속하면 댓글 정화 기능이 실시간으로 작동합니다.
