const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  AI: /\b(ai|artificial intelligence|machine learning|neural|llm|gpt|transformer|deep learning|model training|nlp|chatbot|agent|diffusion)\b/i,
  Security: /\b(security|crypto|hack|vulnerability|encrypt|auth|firewall|malware|phishing|zero.day|exploit|penetration|cybersec)\b/i,
  Design: /\b(design|ux|ui|user experience|user interface|figma|typography|layout|aesthetic|wireframe|prototype|visual)\b/i,
  Engineering: /\b(code|programming|dev|software|engineer|api|function|component|algorithm|database|backend|frontend|deploy|git|docker|kubernetes|microservice|react|typescript|javascript|python|rust|golang)\b/i,
  Business: /\b(business|startup|finance|revenue|market|strategy|growth|invest|valuation|profit|saas|enterprise|founder|venture|capital|ipo)\b/i,
  Science: /\b(science|research|study|experiment|hypothesis|biology|physics|chemistry|neuroscience|genetics|quantum|data.?set|peer.?review|journal|clinical)\b/i,
  Writing: /\b(writ|essay|article|blog|narrative|storytelling|prose|draft|edit|publish|author|journal|memoir|rhetoric)\b/i,
  Health: /\b(health|fitness|medicine|exercise|nutrition|wellness|mental health|therapy|diet|sleep|cardio|clinical|patient|diagnosis)\b/i,
};

export function inferTags(text: string): string[] {
  const matched: string[] = [];

  for (const [category, regex] of Object.entries(CATEGORY_KEYWORDS)) {
    if (regex.test(text)) {
      matched.push(category);
    }
    if (matched.length >= 3) break;
  }

  return matched;
}
