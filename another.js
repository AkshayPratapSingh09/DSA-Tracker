/**
 * GeeksforGeeks Problem Scraper
 * Output:
 * ID,Category,Question,Problem Link,Companies,Difficulty,Status
 */

const axios = require("axios");
const cheerio = require("cheerio");

const problems = [
  {
    id: 1,
    category: "Arrays",
    link: "https://www.geeksforgeeks.org/maximum-and-minimum-in-an-array/"
  },
  {
    id: 2,
    category: "Arrays",
    link: "https://www.geeksforgeeks.org/write-a-program-to-reverse-an-array-or-string/"
  }
];

async function scrapeGFGProblem(problem) {
  const { data: html } = await axios.get(problem.link, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(html);

  // Question Title
  const title =
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  // Difficulty (if present)
  let difficulty = "";
  $("span").each((_, el) => {
    const text = $(el).text().trim();
    if (["Easy", "Medium", "Hard"].includes(text)) {
      difficulty = text;
    }
  });

  // Companies (best-effort extraction)
  let companies = [];
  $("a").each((_, el) => {
    const text = $(el).text().trim();
    if (
      text.length > 2 &&
      text === text.toUpperCase() &&
      !text.includes("GEEKS")
    ) {
      companies.push(text);
    }
  });
  companies = [...new Set(companies)].join(" ");

  return {
    ID: problem.id,
    Category: problem.category,
    Question: title,
    Link: problem.link,
    Companies: companies,
    Difficulty: difficulty,
    Status: ""
  };
}

(async function main() {
  console.log(
    "ID,Category,Question,Problem Link,Companies,Difficulty,Status"
  );

  for (const problem of problems) {
    try {
      const data = await scrapeGFGProblem(problem);

      const row = [
        data.ID,
        data.Category,
        `"${data.Question}"`,
        data.Link,
        `"${data.Companies}"`,
        data.Difficulty,
        data.Status
      ].join(",");

      console.log(row);
    } catch (err) {
      console.error(`Failed to scrape ${problem.link}`, err.message);
    }
  }
})();
