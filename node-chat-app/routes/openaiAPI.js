var express = require("express");
var router = express.Router();

//db객체 참조하기
var db = require("../models/index.js");

//동적 SQL쿼리를 직접 작성해서 전달하기 위한 참조
var sequelize = db.sequelize;
const { QueryTypes } = sequelize;

//OpenAI API 호출을 위한 axios 패키지 참조하기
const axios = require("axios");

//파일처리를 위한 filesystem 내장객체 참조하기
const fs = require("fs");

//OpenAI 객체 생성하기
const { OpenAI } = require("openai");
const openai = new OpenAI({
  //OpenAI 클래스의 인스턴스를 생성하고, 이를 openai 변수에 할당합니다. 이 인스턴스를 통해 OpenAI API를 호출할 수 있습니다.
  apiKey: process.env.OPENAI_API_KEY, //process.env는 Node.js에서 환경 변수를 접근할 때 사용하는 객체입니다. 이를 통해 코드에 민감한 정보를 하드코딩하지 않고, 환경 변수로 관리할 수 있습니다.
});

// -openAI Dalle.3 API를 호출하여 프론트엔드에서 제공하는 프롬프트기반으로 이미지 생성 API를 호출하는 라우팅 메소드
// -호출주소: http://localhost:5000/api/openai//dalle
// -호출방식:post
// -응답결과: 생성된 이미지 JSON 데이터 반환
router.post("/dalle", async (req, res) => {
  let apiResult = {
    code: 400,
    data: null,
    msg: "",
  };

  try {
    //Step1: 프론트엔드에서 전달된 사용자 프롬프트 정보 추출하기
    //웹브라우저 UI보고 사용자가 입력하는 데이터가 어떤 것인지 확인하고 그것을 추출하는 과정임!!!!!!!!
    const model = req.body.model;
    const prompt = req.body.prompt;

    //Step2: OpenAI Dalle API 호출하기
    const response = await openai.images.generate({
      model: model, //화면에서 넘어온 model값임 request.body.model
      prompt, // 속성의 변수값 생략해도 됨, 사용자 프롬프트 정보
      n: 1, //이미지 생성갯수(dalle2는 최대 10개, dalle3는 최대 1개)
      size: "1024x1024", //이미지 사이즈 dall2는 256x256, 512x512, 1024x1024 dalle3는 1024x1024, 1792x1024, 1024x1792 -> api 문서 참조!!!!
      style: "vivid", //이미지 스타일 기본값:vivid, natural(dalle3만 지원 - 더 자연스럽고 초현실적인 이미지생성)
      response_format: "b64_json", //url: openai 사이트에 생성된 이미지 풀주소경로 반환, b64_json: 이미지 자체를 컴퓨터가 인식할 수 있는 바이너리 데이터로 받음==============================================
    });

    //Step3: Dalle API 호출결과에서 물리적 이미지 생성/서버공간에 저장하기

    // //url방식으로 이미지생성값을 반환받는 경우는 최대 1시간 이후에 openai이미지 서버에서 해당 이미지 삭제됨
    // //해당 이미지가 영구적으로 필요하면 반환된 url주소를 이용해 이미지를 백엔드에 생성하시면 됩니다.
    // const imageURL = response.data[0].url;
    // console.log("dall 이미지 생성 URL경로: ", imageURL);

    //이미지 경로를 이용해 물리적 이미지 파일 생성하기
    const imgFileName = `sample-${Date.now()}.png`;
    const imgFilePath = `./public/ai/${imgFileName}`;

    //이미지생성요청에 대한 응답값으로 이미지 바이너리 데이터로 반환 후 서버에 이미지 파일 생성하기
    const imageBinaryData = response.data[0].b64_json;
    console.log("이미지 바이너리 데이터: ", imageBinaryData);

    const buffer = Buffer.from(imageBinaryData, "base64");
    fs.writeFileSync(imgFilePath, buffer);

    //Step4: 최종 생성된 이미지 데이터 추출하기 -> DB에 저장하기
    const article = {
      board_type_code: 3,
      title: model,
      contents: prompt,
      article_type_code: 0,
      view_count: 0,
      ip_address:
        req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      is_display_code: 1,
      reg_date: Date.now(),
      reg_member_id: 10, //추후 JWT토큰에서 사용자 고유번호 추출하여 처리
    };

    //신규 등록된 게시글 정보를 반환받는다. -> 여기에 article_id가 포함되어 있음????????????????
    const registedArticle = await db.Article.create(article);

    //opeanai에 있는 이미지 경로가 아니라 우리 로컬 백엔드에 있는 이미지 경로임
    //개발할 때는 localhost 상관 없는데 서버에 배포 서비스 할 때는 이러면 안되니까 .env 설정 파일에 설정
    const imageFullPath = `${process.env.DALLE_IMG_DOMAIN}/ai/${imgFileName}`; //도메인주소를 포함한 백엔드 이미지 전체 url경로 //public 폴더는 도메인 주소 바로 밑으로 접근가능

    //DB에 집어넣을 파일 정보를 담는 객체
    //생성된 이미지 정보 만들고 저장하기
    const articleFile = {
      article_id: registedArticle.article_id,
      file_name: imgFileName,
      file_size: 0,
      file_path: imageFullPath,
      file_type: "PNG",
      reg_date: Date.now(),
      reg_member_id: 10, //추후 JWT토큰에서 사용자 고유번호 추출하여 처리
    };

    //Step5: DB 게시글 테이블에 사용자 이미지 생성요청 정보 등록처리하기
    const file = await db.ArticleFile.create(articleFile);

    // //단일 생성 이미지 파일 정보 생성하기
    // const filedata = {
    //   article_id: registedArticle.article_id,
    //   file_id: file.article_file_id,
    //   title: registedArticle.title,
    //   contents: registedArticle.contents,
    //   file_path: file.file_path,
    //   file_name: file.file_name,
    //   reg_member_id: 13,
    //   reg_member_name: "lohan",
    // };

    //Step6: 최종 생성된 이미지 정보를 프론트엔드로 반환하기
    apiResult.code = 200;
    apiResult.data = imageFullPath;
    apiResult.msg = "Ok";
  } catch (err) {
    apiResult.code = 500;
    apiResult.data = null;
    apiResult.msg = "Server Error";
  }
  //최종 처리결과값을 프론트엔드로 반환합니다.
  res.json(apiResult);
});

// -기 생성된 이미지 목록정보 조회요청 및 응답처리 API 라우팅 메소드
// -호출주소: http://localhost:5000/api/openai/all
// -호출방식: GET
// -응답결과: 게시판 유형 3(생성형 이미지 정보)인 게시글 / 파일정보 목록 반환
router.get("/all", async (req, res) => {
  //기존에 있던 데이터를 처음 화면 마운트할 때 보여주기 위하여 get 방식으로 호출
  let apiResult = {
    code: 400,
    data: null,
    msg: "",
  };

  try {
    const query = `SELECT 
                        A.article_id,
                        A.title,
                        A.contents,
                        A.reg_member_id,
                        F.article_file_id as file_id,
                        F.file_name,
                        F.file_path,
                        M.name as reg_member_name
                        FROM article A INNER JOIN article_file F ON A.article_id = F.article_id
                        INNER JOIN member M ON A.reg_member_id = M.member_id
                        WHERE A.board_type_code = 3
                        ;`;

    //sql쿼리를 직접 수행하는 구문      ????????????????????????????????????????
    const blogFiles = await sequelize.query(query, {
      //sequelize.query - query를 날린다. //query문자열
      raw: true,
      type: QueryTypes.SELECT,
    });

    apiResult.code = 200;
    apiResult.data = blogFiles;
    apiResult.msg = "Ok";
  } catch (err) {
    apiResult.code = 500;
    apiResult.data = null;
    apiResult.msg = "Sever Error";
  }

  res.json(apiResult);
});

// -ChatGPT-4o 기반 질의/응답처리 API 라우팅 메소드
// -호출주소: http://localhost:5000/api/openai/gpt
// -호출방식:POST
// -응답결과: ChatGPT 응답 메시지결과
router.post("/gpt", async (req, res) => {
  let apiResult = {
    code: 400,
    data: null,
    msg: "",
  };

  try {
    //Step1: 프론트엔드에서 전달된 사용자 질의 정보(프롬프트) 추출하기
    const model = req.body.model;
    const prompt = req.body.prompt;

    //Step2: OpenAI ChatGPT API 호출하기
    const response = await openai.chat.create({
      model: model, //화면에서 넘어온 model값임 request.body.model
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    });

    //Step3: ChatGPT API 호출결과에서 응답 메시지 추출하기
    const chatResult = response.data.choices[0].message.content;

    //Step4: 최종 ChatGPT 응답 메시지 데이터 추출하기
    apiResult.code = 200;
    apiResult.data = chatResult;
    apiResult.msg = "Ok";
  } catch (err) {
    apiResult.code = 500;
    apiResult.data = null;
    apiResult.msg = "Server Error";
  }
  //최종 처리결과값을 프론트엔드로 반환합니다.
  res.json(apiResult);
});

module.exports = router;
