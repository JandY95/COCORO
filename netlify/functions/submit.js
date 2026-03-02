const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// KST(한국시간) 접수번호 생성: yyMMdd-HHmmss-이름-끝4
function buildReceiptTitle({ customerName, phoneDigits }) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC+9
  const yy = String(kst.getUTCFullYear()).slice(-2);
  const MM = pad2(kst.getUTCMonth() + 1);
  const dd = pad2(kst.getUTCDate());
  const HH = pad2(kst.getUTCHours());
  const mm = pad2(kst.getUTCMinutes());
  const ss = pad2(kst.getUTCSeconds());

  const safeName = (customerName || "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, 20) || "고객";

  const last4 = (phoneDigits || "").slice(-4) || "0000";
  return `${yy}${MM}${dd}-${HH}${mm}${ss}-${safeName}-${last4}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const {
    customerName,
    phone,
    postcode,
    baseAddress,
    detailAddress,
    fullAddress,
    request,
    website, // 허니팟
  } = body;

  // 허니팟(봇 차단)
  if (website) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ success: true, receiptTitle: "" }),
    };
  }

  // 필수값 체크
  if (!customerName || !phone || !postcode || !baseAddress || !detailAddress || !fullAddress) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Missing required fields" }),
    };
  }

  const phoneDigits = digitsOnly(phone);
  const receiptTitle = buildReceiptTitle({ customerName, phoneDigits });

  try {
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        // ✅ Notion DB 속성명과 100% 일치해야 함
        접수번호: { title: [{ text: { content: receiptTitle } }] },
        고객명: { rich_text: [{ text: { content: customerName } }] },
        연락처: { rich_text: [{ text: { content: phone } }] },
        우편번호: { rich_text: [{ text: { content: postcode } }] },
        기본주소: { rich_text: [{ text: { content: baseAddress } }] },
        상세주소: { rich_text: [{ text: { content: detailAddress } }] },
        전체주소: { rich_text: [{ text: { content: fullAddress } }] },
        요청사항: { rich_text: [{ text: { content: request || "" } }] },

        처리상태: { status: { name: "접수" } },
        송장번호: { rich_text: [] },
      },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ success: true, receiptTitle }),
    };
  } catch (err) {
    console.error("Notion save failed:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Notion save failed" }),
    };
  }
};
