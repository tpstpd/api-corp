import express from 'express';
import axios from 'axios';
import { parseStringPromise, Builder } from 'xml2js'; // XML 파싱용
import qs from 'qs'; //쿼리 스트링 직렬화용

const app = express();

app.get("/corp", async (req, res) => {
  let { serviceKey, numOfRows = 100, pageNo = 1, resultType = "json", corpNm, crno } = req.query;

  const api_url = "http://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2";

  try {
    const response = await axios.get(api_url, {
      params: {
        serviceKey,
        numOfRows,
        pageNo,
        resultType,
        corpNm, //인코딩 없이 그대로 전달
      },
      headers: {
        'Content-Type': 'application/xml;charset=utf-8',
      },
      //안전한 인코딩을 위해 paramsSerializer 설정
      paramsSerializer: params => {
        return qs.stringify(params, { encode: true });
      }
    });

    let results: any[] = [];

    if (resultType === "xml") {
      const parsed = await parseStringPromise(response.data, { explicitArray: false });
      let items = parsed?.response?.body?.items?.item;

      if (items) {
        if (!Array.isArray(items)) items = [items];
        results = items;
      }
    } else {
      // resultType이 json인 경우
      const jsonData = response.data;
      results = jsonData?.body?.items?.item ? (Array.isArray(jsonData.body.items.item) ? jsonData.body.items.item : [jsonData.body.items.item]) : [];
    }

    // corpNm, crno로 최종 필터링
    const keywordName = corpNm ? String(corpNm) : "";
    const keywordCrno = crno ? String(crno) : "";

    const filteredResults = results.filter((item: any) => {
      const corpName = item.corpNm || item.corpName || "";
      const crnoValue = item.crno || item.jurirno || "";
      const nameMatch = keywordName ? corpName.includes(keywordName) : true;
      const crnoMatch = keywordCrno ? crnoValue.includes(keywordCrno) : true;
      return nameMatch && crnoMatch;
    });

    // 최종 응답 만들기
    if (resultType === "xml") {
      const builder = new Builder();
      const xmlResponse = builder.buildObject({
        response: {
          header: {
            resultCode: "00",
            resultMsg: "NORMAL SERVICE",
          },
          body: {
            items: {
              item: filteredResults.length > 1 ? filteredResults : (filteredResults[0] || {}),
            }
          }
        }
      });

      res.setHeader('Content-Type', 'application/xml');
      res.status(200).send(xmlResponse);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({
        response: {
          header: {
            resultCode: "00",
            resultMsg: "NORMAL SERVICE",
          },
          body: {
            items: filteredResults,
          }
        }
      });
    }

  } catch (error) {
    console.error("API 요청 중 오류 발생:", error);
    res.status(500).send('데이터 요청 중 오류가 발생했습니다');
  }
});

app.listen(3000, () => {
  console.log(`서버가 http://127.0.0.1:3000/corp?pageNo=1&numOfRows=1&resultType=xml&corpNm=%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90(%EC%A3%BC)&serviceKey=ZqDMcB9z2xwM8pqNALpRI0Dy4jqugWQPfSBFwEWeOe6GXmHv%2FJOjl0xmZKTME66FX%2FSOUwK9vjShZ7ms04STmA%3D%3D 로 테스트 가능합니다!`);
});
