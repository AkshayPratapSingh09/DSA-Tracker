/**
 * LeetCode Question Scraper (GraphQL-based)
 * Output format:
 * ID,Category,Question,Problem Link,Companies,Difficulty,Status
 */

const LEETCODE_GRAPHQL = "https://leetcode.com/graphql";

const problems = [
  "https://leetcode.com/problems/maximum-subarray/",
  // add more leetcode links here
];

function getSlugFromUrl(url) {
  const match = url.match(/problems\/([^/]+)/);
  return match ? match[1] : null;
}

async function fetchProblemData(slug) {
  const query = `
    query getQuestionDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        title
        difficulty
        categoryTitle
        topicTags {
          name
        }
        companyTagStats
      }
    }
  `;

  const res = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Referer": "https://leetcode.com"
    },
    body: JSON.stringify({
      query,
      variables: { titleSlug: slug }
    })
  });

  const json = await res.json();
  return json.data.question;
}

function extractCompanies(companyTagStats) {
  if (!companyTagStats) return "";
  try {
    const stats = JSON.parse(companyTagStats);
    return Object.keys(stats).join(" ");
  } catch {
    return "";
  }
}

(async function main() {
  let id = 1;

  console.log(
    "ID,Category,Question,Problem Link,Companies,Difficulty,Status"
  );

  for (const link of problems) {
    const slug = getSlugFromUrl(link);
    if (!slug) continue;

    try {
      const data = await fetchProblemData(slug);

      const row = [
        id,
        data.categoryTitle || "",
        `"${data.title}"`,
        link,
        `"${extractCompanies(data.companyTagStats)}"`,
        data.difficulty || "",
        "" // Status (left blank intentionally)
      ].join(",");

      console.log(row);
      id++;
    } catch (err) {
      console.error(`Failed to fetch ${link}`, err);
    }
  }
})();
