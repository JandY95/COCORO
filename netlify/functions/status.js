// COCORO/netlify/functions/status.js
const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DATABASE_ID;

// Vercel 정본과 동일한 속성명
const PROP_RECEIPT = "접수번호";   // Title
const PROP_STATUS  = "처리상태";   // Status(또는 Select)
const PROP_TRACK   = "송장번호";   // Rich text(Text)

function titleText(p) {
  const t = p?.title || [];
  return t.map(x => x.plain_text || "").join("").trim();
}
function richText(p) {
  const t = p?.rich_text || [];
  return t.map(x => x.plain_text || "").join("").trim();
}

exports.handler = async (event) => {
  const method = event.httpMethod;

  // GET/POST만 허용 (Vercel 정본과 동일)
  if (method !== "GET" && method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED", message: "허용되지 않는 요청입니다." });
  }

  // receipt 파라미터 읽기
  let receipt = "";
  if (method === "GET") {
    receipt = (event.queryStringParameters?.receipt || "").trim();
  } else {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      receipt = String(body.receipt || "").trim();
    } catch {
      receipt = "";
    }
  }

  if (!receipt) {
    return json(400, { error: "MISSING_RECEIPT", message: "접수번호를 입력해 주세요." });
  }

  try {
    const q = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        property: PROP_RECEIPT,
        title: { equals: receipt },
      },
      page_size: 1,
    });

    if (!q.results?.length) {
      return json(404, {
        error: "NOT_FOUND",
        message: "입력하신 접수번호를 찾을 수 없습니다.",
      });
    }

    const page = q.results[0];
    const props = page.properties || {};

    const receiptTitle = titleText(props[PROP_RECEIPT]);

    const statusName =
      props[PROP_STATUS]?.status?.name ||   // Status 타입
      props[PROP_STATUS]?.select?.name ||   // Select 타입(혹시 몰라서)
      "접수";

    const trackingNumber =
      richText(props[PROP_TRACK]) ||
      props[PROP_TRACK]?.number?.toString?.() ||
      "";

    // ✅ Vercel 정본과 동일 응답 구조
    return json(200, {
      receipt: receiptTitle,
      status: statusName,
      trackingNumber,
    });
  } catch (err) {
    console.error("Status lookup failed:", err);
    return json(500, {
      error: "LOOKUP_FAILED",
      message: "조회 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
    });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}
