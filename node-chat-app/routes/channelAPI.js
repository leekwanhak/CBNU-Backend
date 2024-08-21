var express = require("express");
var router = express.Router();

//JWT토큰을 사용하기 위한 패키지 참조하기
var jwt = require("jsonwebtoken");

//ORM db객체 참조하기
var db = require("../models/index");

//전체 채널 목록 조회 요청 및 응답처리 API 라우팅 메소드
//호출주소: http://localhost:5000/api/channel/list
//호출방식: Get
//응답결과: 전체 채널 목록 데이터
router.get("/list", async (req, res) => {
  //백엔드 API를 호출하면 무조건 아래형식으로 데이터를 백엔드에서 반환합니다.
  //어떤 방식이든지 무조건 나오는 형식
  let apiResult = {
    code: 400, //요청상태코드: 200:정상처리 400:요청리소스가 없을때 500:서버개발자코딩에러
    data: null, //백엔드에서 프론트엔드로 전달한 데이터
    msg: "", //처리결과 코멘트(백엔드개발자가 프론트엔드 개발자에게 알려주는 코멘트메시지)
  };

  try {
    const channels = await db.Channel.findAll();
    apiResult.code = 200;
    apiResult.data = channels;
    apiResult.msg = "ok";
  } catch (err) {
    apiResult.code = 500;
    apiResult.data = null;
    apiResult.msg = "Server Error";
  }
  res.json(apiResult);
});

//신규 채널 등록 요청 및 응답처리 API 라우팅 메소드
//호출주소: http://localhost:5000/api/channel/create
//호출방식: Post
//응답결과: 등록된 단일 채널 데이터
router.post("/create", async (req, res) => {
  let apiResult = {
    code: 400, //요청상태코드: 200:정상처리 400:요청리소스가 없을때 500:서버개발자코딩에러
    data: null, //백엔드에서 프론트엔드로 전달한 데이터
    msg: "", //처리결과 코멘트(백엔드개발자가 프론트엔드 개발자에게 알려주는 코멘트메시지)
  };

  try {
    //Step0: 프론트엔드에서 전달된 JWT토큰값에서 추출해서 로그인 사용자 정보 추출하기
    var token = req.headers.authorization.split(`Bearer`)[1]; //ddd|r3rfwegsd -> 이런식으로 나오니까 Bearer [1] 이렇게 써줘야함
    console.log("게시글 등록 API에서 토큰값: ", token);

    //토큰 json데이터를 까겠다 -> jsonwebtoken 패키지 깔려있어야함.
    //사용자 토큰정보 유효성 검사 후 정상적이면 토큰내에 사용자인증 json 데이터를 반환합니다.
    var loginMember = await jwt.verify(token, process.env.JWT_AUTH_KEY);

    //Step1: 프론트엔드에서 전달한 데이터 추출하기
    const channel_name = req.body.channel_name;
    const user_limit = req.body.user_limit;
    const channel_state_code = req.body.channel_state_code;

    //Step2: DB Channel 테이블에 저장할 Json데이터 생성하기
    //channel.js 모델의 속성명과 데이터 속성명을 동일하게 작성해야한다.
    //이것도 enum ts로 만들어서 쓸 수 있나??????????????
    const channel = {
      community_id: 1,
      category_code: 2,
      channel_name,
      user_limit,
      channel_state_code,
      reg_date: Date.now(),
      reg_member_id: loginMember.member_id, //토큰내 사용자 인증 데이터에서 사용자고유번호 추출
    };

    //Step3: DB article 테이블에 데이터(신규 게시글정보) 저장하기
    const registedChannel = await db.Channel.create(channel);

    //Step4: 처리결과값 프론트엔드 반환
    apiResult.code = 200;
    apiResult.data = registedChannel;
    apiResult.msg = "Ok";
  } catch (err) {
    apiResult.code = 500;
    apiResult.data = null;
    apiResult.msg = "Failed";
  }
  res.json(apiResult);
});

module.exports = router;
