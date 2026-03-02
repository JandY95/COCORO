const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });

function getRichText(prop) {
  try {
    return (prop?.rich_text || []).map(x => x.plain_text).join("") || "";
  } catch {
    return "";
  }
}

exports.handler = async (event) => {
  const receipt = (event.queryStringParameters?.receipt || "").trim();

  if (!receipt) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Missing receipt" }),
    };
  }

  try {
    const q = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      filter: { property: "접수번호", title: { equals: receipt } },
      page_size: 1,
    });

    if (!q.results?.length) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Not found" }),
      };
    }

    const page = q.results[0];
    const props = page.properties || {};

    const status = props["처리상태"]?.status?.name || "접수";
    const trackingNumber = getRichText(props["송장번호"]) || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        success: true,
        receipt,
        status,
        trackingNumber,
        lastEditedTime: page.last_edited_time,
      }),
    };
  } catch (err) {
    console.error("Query failed:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Query failed" }),
    };
  }
};
